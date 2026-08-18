-- ============================================================================
-- Sake of Health — Offline Sales, CRM & Analytics
-- Migration 0001: Core schema, relationships, RLS, audit trail, order RPC
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'manager', 'staff');
create type customer_status as enum ('new', 'active', 'repeat', 'vip', 'inactive');
create type product_category as enum ('multivitamin', 'iron', 'probiotic_prebiotic', 'curcumin', 'other');
create type product_status as enum ('active', 'inactive', 'archived');
create type event_status as enum ('upcoming', 'active', 'completed', 'cancelled');
create type payment_method as enum ('cash', 'upi', 'card', 'other');
create type payment_status as enum ('paid', 'partial', 'pending', 'refunded');
create type order_status as enum ('completed', 'archived', 'cancelled');
create type sales_channel as enum ('offline_event', 'online', 'direct', 'other');
create type inventory_txn_type as enum ('opening', 'restock', 'sale', 'adjustment', 'damaged', 'returned');
create type feedback_type as enum ('taste', 'quality', 'packaging', 'price', 'buying_experience', 'overall_experience', 'other');
create type feedback_status as enum ('new', 'reviewed', 'follow_up_required', 'resolved');
create type followup_status as enum ('pending', 'contacted', 'completed', 'not_interested');
create type followup_contact_method as enum ('whatsapp', 'call', 'sms', 'email', 'other');

-- ----------------------------------------------------------------------------
-- USERS (mirrors auth.users; role lives here since auth.users is Supabase-managed)
-- ----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SETTINGS (single-row-per-key config, e.g. VIP threshold, inactive days)
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

insert into public.app_settings (key, value) values
  ('customer_segmentation', '{"vip_spend_threshold": 5000, "repeat_order_threshold": 2, "inactive_days_threshold": 90}'),
  ('business_info', '{"name": "Sake of Health", "company": "Ixitek Healthcare and Wellness Pvt. Ltd.", "phone": "+917483927125", "email": "info@sakeofhealth.in"}');

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create sequence public.customer_code_seq start 1;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique default ('CUS-' || lpad(nextval('customer_code_seq')::text, 6, '0')),
  name text not null,
  phone text not null,
  email text,
  city text,
  age_group text,
  gender text,
  preferred_product_id uuid,
  heard_from text,
  communication_consent boolean not null default false,
  status customer_status not null default 'new',
  tags text[] not null default '{}',
  notes text,
  source sales_channel not null default 'offline_event',
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index customers_phone_unique_idx on public.customers (phone) where deleted_at is null;
create index customers_email_idx on public.customers (email);
create index customers_status_idx on public.customers (status);
create index customers_name_trgm_idx on public.customers using gin (name gin_trgm_ops);
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
create sequence public.product_code_seq start 1;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique default ('PRD-' || lpad(nextval('product_code_seq')::text, 4, '0')),
  name text not null,
  category product_category not null,
  description text,
  image_url text,
  sku text unique,
  selling_price numeric(10,2) not null check (selling_price >= 0),
  original_price numeric(10,2) check (original_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 10,
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers add constraint customers_preferred_product_fk
  foreign key (preferred_product_id) references public.products(id);

create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category);

-- ----------------------------------------------------------------------------
-- EVENTS
-- ----------------------------------------------------------------------------
create sequence public.event_code_seq start 1;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique default ('EVT-' || extract(year from now())::text || '-' || lpad(nextval('event_code_seq')::text, 3, '0')),
  name text not null,
  location text,
  start_date date not null,
  end_date date,
  organizer text,
  stall_number text,
  staff_members text[] default '{}',
  budget numeric(10,2),
  status event_status not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_status_idx on public.events (status);
create index events_start_date_idx on public.events (start_date);

-- ----------------------------------------------------------------------------
-- ORDERS + ORDER_ITEMS
-- ----------------------------------------------------------------------------
create sequence public.order_code_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('ORD-' || extract(year from now())::text || '-' || lpad(nextval('order_code_seq')::text, 6, '0')),
  client_txn_id text unique, -- idempotency key from frontend (offline queue safety)
  customer_id uuid not null references public.customers(id),
  event_id uuid references public.events(id),
  staff_id uuid references public.users(id),
  order_date timestamptz not null default now(),
  sales_channel sales_channel not null default 'offline_event',
  source text not null default 'offline',
  source_order_id text,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  payment_method payment_method not null default 'cash',
  payment_status payment_status not null default 'paid',
  order_status order_status not null default 'completed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_event_idx on public.orders (event_id);
create index orders_date_idx on public.orders (order_date);
create index orders_code_idx on public.orders (order_code);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  total_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ----------------------------------------------------------------------------
-- PAYMENTS
-- ----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_method payment_method not null,
  payment_status payment_status not null default 'paid',
  transaction_reference text,
  payment_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

-- ----------------------------------------------------------------------------
-- FEEDBACK
-- ----------------------------------------------------------------------------
create sequence public.feedback_code_seq start 1;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_code text not null unique default ('FDB-' || lpad(nextval('feedback_code_seq')::text, 6, '0')),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  product_id uuid references public.products(id),
  rating smallint not null check (rating between 1 and 5),
  feedback_type feedback_type not null default 'overall_experience',
  review text,
  staff_id uuid references public.users(id),
  follow_up_required boolean not null default false,
  status feedback_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_customer_idx on public.feedback (customer_id);
create index feedback_date_idx on public.feedback (created_at);
create index feedback_status_idx on public.feedback (status);

-- ----------------------------------------------------------------------------
-- FOLLOWUPS
-- ----------------------------------------------------------------------------
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  product_id uuid references public.products(id),
  followup_date date not null,
  reason text not null,
  contact_method followup_contact_method not null default 'whatsapp',
  status followup_status not null default 'pending',
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index followups_date_idx on public.followups (followup_date);
create index followups_status_idx on public.followups (status);
create index followups_customer_idx on public.followups (customer_id);

-- ----------------------------------------------------------------------------
-- INVENTORY TRANSACTIONS (append-only ledger — never overwrite stock directly)
-- ----------------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  transaction_type inventory_txn_type not null,
  quantity integer not null, -- positive = stock in, negative = stock out
  reference_type text, -- 'order', 'manual', etc
  reference_id uuid,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index inventory_txn_product_idx on public.inventory_transactions (product_id);
create index inventory_txn_created_idx on public.inventory_transactions (created_at);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null, -- created | updated | archived | deleted | restored
  entity_type text not null,
  entity_id uuid,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at);

-- ============================================================================
-- TRIGGERS: updated_at maintenance
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_feedback_updated before update on public.feedback
  for each row execute function public.set_updated_at();
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RPC: create_offline_order — atomic, idempotent multi-table order creation
-- Handles: order + order_items + payment + inventory decrement + audit log
-- ============================================================================
create or replace function public.create_offline_order(
  p_client_txn_id text,
  p_customer_id uuid,
  p_event_id uuid,
  p_staff_id uuid,
  p_items jsonb, -- [{product_id, quantity, unit_price, discount}]
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
begin
  -- Idempotency: if this client_txn_id was already synced, return the existing order
  if p_client_txn_id is not null then
    select * into v_order from public.orders where client_txn_id = p_client_txn_id;
    if found then
      return v_order;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Validate stock and compute subtotal up front
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

  insert into public.payments (order_id, amount, payment_method, payment_status)
  values (v_order.id, v_order.total_amount, p_payment_method, p_payment_status);

  -- Customer status recalculation
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

-- ============================================================================
-- RPC: adjust_inventory — safe stock change with ledger entry
-- ============================================================================
create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_transaction_type inventory_txn_type,
  p_quantity integer, -- signed
  p_notes text,
  p_created_by uuid
)
returns public.products
language plpgsql
security definer
as $$
declare
  v_product public.products;
begin
  update public.products
    set stock_quantity = greatest(0, stock_quantity + p_quantity)
    where id = p_product_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into public.inventory_transactions (product_id, transaction_type, quantity, reference_type, notes, created_by)
  values (p_product_id, p_transaction_type, p_quantity, 'manual', p_notes, p_created_by);

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (p_created_by, 'updated', 'product', p_product_id, 'Inventory adjusted by ' || p_quantity || ' (' || p_transaction_type || ')');

  return v_product;
end;
$$;

grant execute on function public.adjust_inventory to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.feedback enable row level security;
alter table public.followups enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

-- Helper: is the caller an authenticated app user (any role)?
create or replace function public.is_app_user()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.users where id = auth.uid() and active = true);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin' and active = true);
$$;

create or replace function public.is_admin_or_manager()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.users where id = auth.uid() and role in ('admin','manager') and active = true);
$$;

-- Any authenticated app user can read/write operational data (staff need this at events).
-- Deletes are restricted to admins; everything else uses soft-delete (archive) at the app layer.
create policy users_select on public.users for select using (public.is_app_user());
create policy users_admin_write on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy customers_select on public.customers for select using (public.is_app_user());
create policy customers_insert on public.customers for insert with check (public.is_app_user());
create policy customers_update on public.customers for update using (public.is_app_user());
create policy customers_delete on public.customers for delete using (public.is_admin());

create policy products_select on public.products for select using (public.is_app_user());
create policy products_write on public.products for insert with check (public.is_admin_or_manager());
create policy products_update on public.products for update using (public.is_admin_or_manager());
create policy products_delete on public.products for delete using (public.is_admin());

create policy events_select on public.events for select using (public.is_app_user());
create policy events_write on public.events for insert with check (public.is_app_user());
create policy events_update on public.events for update using (public.is_app_user());
create policy events_delete on public.events for delete using (public.is_admin());

create policy orders_select on public.orders for select using (public.is_app_user());
create policy orders_insert on public.orders for insert with check (public.is_app_user());
create policy orders_update on public.orders for update using (public.is_app_user());
create policy orders_delete on public.orders for delete using (public.is_admin());

create policy order_items_select on public.order_items for select using (public.is_app_user());
create policy order_items_write on public.order_items for insert with check (public.is_app_user());

create policy payments_select on public.payments for select using (public.is_app_user());
create policy payments_write on public.payments for insert with check (public.is_app_user());

create policy feedback_select on public.feedback for select using (public.is_app_user());
create policy feedback_insert on public.feedback for insert with check (public.is_app_user());
create policy feedback_update on public.feedback for update using (public.is_app_user());
create policy feedback_delete on public.feedback for delete using (public.is_admin());

create policy followups_select on public.followups for select using (public.is_app_user());
create policy followups_insert on public.followups for insert with check (public.is_app_user());
create policy followups_update on public.followups for update using (public.is_app_user());
create policy followups_delete on public.followups for delete using (public.is_admin());

create policy inventory_txn_select on public.inventory_transactions for select using (public.is_app_user());
create policy inventory_txn_insert on public.inventory_transactions for insert with check (public.is_app_user());

create policy audit_logs_select on public.audit_logs for select using (public.is_admin_or_manager());
create policy audit_logs_insert on public.audit_logs for insert with check (public.is_app_user());

create policy app_settings_select on public.app_settings for select using (public.is_app_user());
create policy app_settings_write on public.app_settings for update using (public.is_admin());

-- ============================================================================
-- New-user provisioning: mirror auth.users -> public.users on signup
-- (First user created becomes admin; change manually afterward as needed.)
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    case when (select count(*) from public.users) = 0 then 'admin' else 'staff' end
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
