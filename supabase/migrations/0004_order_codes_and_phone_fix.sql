-- ============================================================================
-- Sake of Health — Migration 0004
-- 1. Product-based order codes (e.g. CUR-001, MUL-IRN-001, MIP-0001)
-- 2. Customer phone-correction support (audit trail + merge helper)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRODUCT-BASED ORDER CODES
-- ----------------------------------------------------------------------------
-- category -> short codes used to build order_code from the products in an order.
create or replace function public.category_prefix(p_category product_category, p_short boolean)
returns text
language sql
immutable
as $$
  select case p_category
    when 'multivitamin'         then case when p_short then 'M' else 'MUL' end
    when 'iron'                  then case when p_short then 'I' else 'IRN' end
    when 'probiotic_prebiotic'  then case when p_short then 'P' else 'PRO' end
    when 'curcumin'              then case when p_short then 'C' else 'CUR' end
    else                              case when p_short then 'O' else 'OTH' end
  end
$$;

-- Running counter per unique prefix-combination so numbering is independent
-- per product mix (CUR-001, CUR-002 ... vs MUL-IRN-001, MUL-IRN-002 ...).
create table if not exists public.order_code_counters (
  prefix text primary key,
  last_value integer not null default 0
);

-- Builds the final order code from an array of distinct product categories
-- already present on the order (order_items must exist for the order).
create or replace function public.generate_order_code(p_order_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_categories product_category[];
  v_count integer;
  v_prefix text;
  v_next integer;
  v_padding integer;
begin
  select array_agg(distinct p.category order by p.category)
    into v_categories
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id;

  if v_categories is null or array_length(v_categories, 1) is null then
    return null; -- no items yet, caller keeps the fallback code
  end if;

  v_count := array_length(v_categories, 1);

  if v_count = 1 then
    -- Single product: full 3-letter prefix, e.g. CUR
    v_prefix := public.category_prefix(v_categories[1], false);
    v_padding := 3;
  elsif v_count = 2 then
    -- Two products: both 3-letter prefixes joined, e.g. MUL-IRN
    v_prefix := public.category_prefix(v_categories[1], false) || '-' || public.category_prefix(v_categories[2], false);
    v_padding := 3;
  else
    -- Three or more: single-letter initials joined, e.g. MIP, MIPC
    select string_agg(public.category_prefix(c, true), '' order by c)
      into v_prefix
      from unnest(v_categories) as c;
    v_padding := 4;
  end if;

  -- Atomically bump the counter for this exact prefix combination
  insert into public.order_code_counters (prefix, last_value)
  values (v_prefix, 1)
  on conflict (prefix) do update set last_value = public.order_code_counters.last_value + 1
  returning last_value into v_next;

  return v_prefix || '-' || lpad(v_next::text, v_padding, '0');
end;
$$;

grant execute on function public.generate_order_code to authenticated;

-- Reassign order_code once items exist. Called at the end of create_offline_order.
create or replace function public.create_offline_order(
  p_client_txn_id text,
  p_customer_id uuid,
  p_event_id uuid,
  p_staff_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payment_method payment_method,
  p_payment_status payment_status,
  p_notes text
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_line_total numeric;
  v_product public.products;
  v_new_code text;
begin
  if p_client_txn_id is not null then
    select * into v_order from public.orders where client_txn_id = p_client_txn_id;
    if found then
      return v_order;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Product % not found', (v_item->>'product_id');
    end if;
    if v_product.stock_quantity < (v_item->>'quantity')::integer then
      raise exception 'Insufficient stock for %: have %, need %', v_product.name, v_product.stock_quantity, (v_item->>'quantity');
    end if;
    v_line_total := ((v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer) - coalesce((v_item->>'discount')::numeric, 0);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  insert into public.orders (
    client_txn_id, customer_id, event_id, staff_id, subtotal, discount, total_amount,
    payment_method, payment_status, notes, sales_channel, source
  ) values (
    p_client_txn_id, p_customer_id, p_event_id, p_staff_id, v_subtotal, coalesce(p_discount,0),
    v_subtotal - coalesce(p_discount,0), p_payment_method, p_payment_status, p_notes, 'offline_event', 'offline'
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_total := ((v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer) - coalesce((v_item->>'discount')::numeric, 0);

    insert into public.order_items (order_id, product_id, quantity, unit_price, discount, total_price)
    values (v_order.id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric, coalesce((v_item->>'discount')::numeric,0), v_line_total);

    update public.products
      set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
      where id = (v_item->>'product_id')::uuid;

    insert into public.inventory_transactions (product_id, transaction_type, quantity, reference_type, reference_id, created_by, notes)
    values ((v_item->>'product_id')::uuid, 'sale', -1 * (v_item->>'quantity')::integer, 'order', v_order.id, p_staff_id, 'Sale via order ' || v_order.order_code);
  end loop;

  -- Now that items are known, replace the fallback ORD-YYYY-###### code
  -- with a product-based code, e.g. CUR-001, MUL-IRN-001, MIP-0001.
  v_new_code := public.generate_order_code(v_order.id);
  if v_new_code is not null then
    update public.orders set order_code = v_new_code where id = v_order.id returning * into v_order;
  end if;

  insert into public.payments (order_id, amount, payment_method, payment_status)
  values (v_order.id, v_order.total_amount, p_payment_method, p_payment_status);

  update public.customers
    set status = case
      when (select count(*) from public.orders where customer_id = p_customer_id and order_status = 'completed') > 1
        and (select coalesce(sum(total_amount),0) from public.orders where customer_id = p_customer_id and order_status = 'completed')
            >= (select (value->>'vip_spend_threshold')::numeric from public.app_settings where key = 'customer_segmentation')
        then 'vip'::customer_status
      when (select count(*) from public.orders where customer_id = p_customer_id and order_status = 'completed') >=
            (select (value->>'repeat_order_threshold')::int from public.app_settings where key = 'customer_segmentation')
        then 'repeat'::customer_status
      else 'active'::customer_status
    end
  where id = p_customer_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (p_staff_id, 'created', 'order', v_order.id, 'Order ' || v_order.order_code || ' created (' || v_order.total_amount || ')');

  return v_order;
end;
$$;

grant execute on function public.create_offline_order to authenticated;

-- ----------------------------------------------------------------------------
-- 2. CUSTOMER PHONE-CORRECTION SUPPORT
-- ----------------------------------------------------------------------------
-- Keeps a history of phone number changes so staff mistakes are traceable
-- (who changed it, when, from what number to what number).
create table if not exists public.customer_phone_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  old_phone text,
  new_phone text not null,
  changed_by uuid references public.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists customer_phone_history_customer_idx on public.customer_phone_history (customer_id);

alter table public.customer_phone_history enable row level security;
create policy customer_phone_history_select on public.customer_phone_history for select using (public.is_app_user());
create policy customer_phone_history_insert on public.customer_phone_history for insert with check (public.is_app_user());

-- RPC: safely correct a customer's phone number.
-- - Logs the change to customer_phone_history
-- - If the "corrected" number already belongs to another customer, raises a
--   clear error naming that existing customer so staff can merge manually
--   instead of silently overwriting/duplicating data.
create or replace function public.update_customer_phone(
  p_customer_id uuid,
  p_new_phone text,
  p_staff_id uuid,
  p_reason text default null
)
returns public.customers
language plpgsql
security definer
as $$
declare
  v_customer public.customers;
  v_conflict public.customers;
  v_old_phone text;
begin
  select * into v_customer from public.customers where id = p_customer_id and deleted_at is null for update;
  if not found then
    raise exception 'Customer not found';
  end if;

  v_old_phone := v_customer.phone;

  if v_old_phone = trim(p_new_phone) then
    return v_customer; -- no-op
  end if;

  select * into v_conflict from public.customers
    where phone = trim(p_new_phone) and deleted_at is null and id <> p_customer_id;
  if found then
    raise exception 'Phone % already belongs to customer % (%). Use the merge tool instead of overwriting.',
      p_new_phone, v_conflict.name, v_conflict.customer_code;
  end if;

  update public.customers set phone = trim(p_new_phone) where id = p_customer_id returning * into v_customer;

  insert into public.customer_phone_history (customer_id, old_phone, new_phone, changed_by, reason)
  values (p_customer_id, v_old_phone, trim(p_new_phone), p_staff_id, p_reason);

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (p_staff_id, 'updated', 'customer', p_customer_id,
    'Phone corrected for ' || v_customer.name || ': ' || coalesce(v_old_phone, '(none)') || ' -> ' || v_customer.phone);

  return v_customer;
end;
$$;

grant execute on function public.update_customer_phone to authenticated;

-- RPC: merge a duplicate customer record into a target customer (e.g. the
-- same person got created twice because of a phone typo). Moves orders,
-- feedback, and followups to the target, then soft-deletes the duplicate.
create or replace function public.merge_customers(
  p_target_id uuid,
  p_duplicate_id uuid,
  p_staff_id uuid
)
returns public.customers
language plpgsql
security definer
as $$
declare
  v_target public.customers;
  v_duplicate public.customers;
begin
  if p_target_id = p_duplicate_id then
    raise exception 'Cannot merge a customer into itself';
  end if;

  select * into v_target from public.customers where id = p_target_id and deleted_at is null for update;
  if not found then raise exception 'Target customer not found'; end if;

  select * into v_duplicate from public.customers where id = p_duplicate_id and deleted_at is null for update;
  if not found then raise exception 'Duplicate customer not found'; end if;

  update public.orders set customer_id = p_target_id where customer_id = p_duplicate_id;
  update public.feedback set customer_id = p_target_id where customer_id = p_duplicate_id;
  update public.followups set customer_id = p_target_id where customer_id = p_duplicate_id;

  update public.customers
    set deleted_at = now(),
        notes = coalesce(notes, '') || E'\n[Merged into ' || v_target.customer_code || ' on ' || now()::date || ']'
    where id = p_duplicate_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (p_staff_id, 'updated', 'customer', p_target_id,
    'Merged duplicate ' || v_duplicate.customer_code || ' (' || coalesce(v_duplicate.phone,'no phone') || ') into ' || v_target.customer_code);

  return v_target;
end;
$$;

grant execute on function public.merge_customers to authenticated;
