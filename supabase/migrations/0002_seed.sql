-- ============================================================================
-- Migration 0002: Seed data
-- Real product catalog (from sakeofhealth.in) + optional demo data for dev.
-- ============================================================================

-- Real catalog — always safe to run in production.
insert into public.products (name, category, description, selling_price, original_price, stock_quantity, minimum_stock, sku, status) values
  ('Multivitamin Gummies', 'multivitamin', 'Vitamins, Omega-3 and Panax Ginseng — complete daily cover in a single gummy.', 621, 690, 150, 20, 'SOH-MV-001', 'active'),
  ('Iron Gummies', 'iron', 'Iron, Folic Acid and Vitamin C — the absorption trio that fights fatigue and boosts haemoglobin.', 581, 645, 150, 20, 'SOH-IR-001', 'active'),
  ('Probiotic & Prebiotic Gummies', 'probiotic_prebiotic', 'ENZ Tribe, Sodium and Fibres — rebuild your microbiome and feel the gut-brain difference.', 626, 695, 150, 20, 'SOH-PB-001', 'active'),
  ('Curcumin Gummies', 'curcumin', 'Curcumin, Turmeric and Piperine — India''s golden healer, with 2000% better bioavailability.', 576, 640, 150, 20, 'SOH-CU-001', 'active');

-- Opening stock ledger entries for the above (keeps inventory_transactions consistent with stock_quantity)
insert into public.inventory_transactions (product_id, transaction_type, quantity, reference_type, notes)
select id, 'opening', stock_quantity, 'manual', 'Initial opening stock' from public.products;

-- ----------------------------------------------------------------------------
-- DEMO DATA (development only — safe to skip in production by not running this
-- file, or delete rows below the marker before deploying).
-- All demo rows are tagged so they can be identified and purged later.
-- ----------------------------------------------------------------------------
do $$
declare
  v_event_id uuid;
  v_mv_id uuid; v_ir_id uuid; v_pb_id uuid; v_cu_id uuid;
  v_cust1 uuid; v_cust2 uuid; v_cust3 uuid;
begin
  select id into v_mv_id from public.products where sku = 'SOH-MV-001';
  select id into v_ir_id from public.products where sku = 'SOH-IR-001';
  select id into v_pb_id from public.products where sku = 'SOH-PB-001';
  select id into v_cu_id from public.products where sku = 'SOH-CU-001';

  insert into public.events (name, location, start_date, end_date, organizer, stall_number, budget, status, notes)
  values ('Health & Wellness Expo [DEMO]', 'Bengaluru', current_date - 2, current_date, 'Expo India', 'B-14', 25000, 'active', 'Demo/sample event — safe to delete before go-live.')
  returning id into v_event_id;

  insert into public.customers (name, phone, email, city, age_group, gender, status, communication_consent, tags, notes)
  values ('Priya Ramesh [DEMO]', '9900000001', 'priya.demo@example.com', 'Bengaluru', '25-34', 'Female', 'repeat', true, array['Event Customer','Interested in Multivitamin'], 'Sample record')
  returning id into v_cust1;

  insert into public.customers (name, phone, email, city, age_group, gender, status, communication_consent, tags, notes)
  values ('Arjun Mehta [DEMO]', '9900000002', 'arjun.demo@example.com', 'Mumbai', '35-44', 'Male', 'active', true, array['Interested in Iron'], 'Sample record')
  returning id into v_cust2;

  insert into public.customers (name, phone, email, city, age_group, gender, status, communication_consent, tags, notes)
  values ('Sneha Iyer [DEMO]', '9900000003', 'sneha.demo@example.com', 'Pune', '18-24', 'Female', 'new', true, array['Event Customer'], 'Sample record')
  returning id into v_cust3;

  perform public.create_offline_order(
    'demo-txn-1', v_cust1, v_event_id, null,
    jsonb_build_array(jsonb_build_object('product_id', v_mv_id, 'quantity', 2, 'unit_price', 621, 'discount', 0)),
    0, 'upi', 'paid', 'Demo order'
  );

  perform public.create_offline_order(
    'demo-txn-2', v_cust2, v_event_id, null,
    jsonb_build_array(jsonb_build_object('product_id', v_ir_id, 'quantity', 1, 'unit_price', 581, 'discount', 0)),
    0, 'cash', 'paid', 'Demo order'
  );

  perform public.create_offline_order(
    'demo-txn-3', v_cust3, v_event_id, null,
    jsonb_build_array(
      jsonb_build_object('product_id', v_pb_id, 'quantity', 1, 'unit_price', 626, 'discount', 0),
      jsonb_build_object('product_id', v_cu_id, 'quantity', 1, 'unit_price', 576, 'discount', 50)
    ),
    50, 'card', 'paid', 'Demo order'
  );

  insert into public.feedback (customer_id, product_id, rating, feedback_type, review, status)
  values
    (v_cust1, v_mv_id, 5, 'taste', 'Loved the taste, will buy again! [DEMO]', 'reviewed'),
    (v_cust2, v_ir_id, 4, 'overall_experience', 'Good energy boost after a few weeks. [DEMO]', 'new');

  insert into public.followups (customer_id, followup_date, reason, contact_method, status, notes)
  values
    (v_cust3, current_date + 1, 'Ask about product experience [DEMO]', 'whatsapp', 'pending', 'Sample follow-up'),
    (v_cust2, current_date, 'Request Google review [DEMO]', 'whatsapp', 'pending', 'Sample follow-up');
end $$;
