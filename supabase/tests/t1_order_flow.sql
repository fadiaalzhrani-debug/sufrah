-- تجربة كاملة لدورة الطلب داخل معاملة تنلغي (ما يبقى منها شي)
begin;
do $$
declare cu uuid := gen_random_uuid(); fu uuid := gen_random_uuid(); fam uuid; dish uuid; dish2 uuid; q jsonb; sl jsonb; win text; o jsonb; r jsonb;
  res jsonb := '{}'::jsonb; oid uuid; st text; notif int; fin jsonb; me jsonb; ev int; bad jsonb;
begin
  insert into auth.users (id, phone, aud, role, instance_id) values
    (cu, '966500000091', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (fu, '966500000092', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  select id into fam from public.sf_families where slug = 'umfahad';
  insert into public.sf_staff (phone, name, role, family_id) values ('966500000092', 'tester', 'family_owner', fam);
  select id into dish from public.sf_dishes where family_id = fam and name_ar = 'كبسة دجاج';
  select id into dish2 from public.sf_dishes where family_id = fam and name_ar = 'جريش بالدجاج';

  -- العميل
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  me := public.sf_me();
  res := res || jsonb_build_object('me_role', me->>'role');
  sl := public.sf_slots(fam, jsonb_build_array(jsonb_build_object('dish_id', dish)), 'delivery');
  res := res || jsonb_build_object('asap_ok', sl->'asap'->'ok', 'asap_reason', sl->'asap'->'reason', 'days', jsonb_array_length(sl->'days'), 'lead', sl->'lead_min');
  win := case when (sl->'asap'->>'ok')::boolean then null else sl->'days'->0->'windows'->0->>'start' end;

  -- خيار إلزامي ناقص يرجع خطأ
  bad := public.sf_quote(jsonb_build_object('family_id', fam, 'items', jsonb_build_array(jsonb_build_object('dish_id', dish, 'qty', 1)),
           'fulfillment', 'delivery', 'lat', 26.2810, 'lng', 50.2050, 'pay_method', 'cod', 'scheduled_for', win));
  res := res || jsonb_build_object('missing_option_err', bad->'errors'->0->>'code');

  q := public.sf_quote(jsonb_build_object('family_id', fam, 'items', jsonb_build_array(
          jsonb_build_object('dish_id', dish, 'qty', 2, 'options', jsonb_build_array('s2', 'x1')),
          jsonb_build_object('dish_id', dish2, 'qty', 1)),
         'fulfillment', 'delivery', 'lat', 26.2810, 'lng', 50.2050, 'pay_method', 'cod', 'scheduled_for', win));
  res := res || jsonb_build_object('quote_ok', q->'ok', 'quote_errors', q->'errors', 'subtotal', q->'subtotal', 'fee', q->'delivery_fee', 'km', q->'distance_km', 'total', q->'total', 'commission', q->'commission', 'net', q->'family_net');

  -- خارج نطاق التوصيل
  bad := public.sf_quote(jsonb_build_object('family_id', fam, 'items', jsonb_build_array(jsonb_build_object('dish_id', dish2, 'qty', 1)),
           'fulfillment', 'delivery', 'lat', 26.95, 'lng', 49.60, 'pay_method', 'cod', 'scheduled_for', win));
  res := res || jsonb_build_object('far_err', (select string_agg(e->>'code', ',') from jsonb_array_elements(bad->'errors') e));

  -- البطاقة مقفلة لين يتفعل ميسر
  bad := public.sf_quote(jsonb_build_object('family_id', fam, 'items', jsonb_build_array(jsonb_build_object('dish_id', dish2, 'qty', 1)),
           'fulfillment', 'pickup', 'pay_method', 'card', 'scheduled_for', win));
  res := res || jsonb_build_object('card_err', (select string_agg(e->>'code', ',') from jsonb_array_elements(bad->'errors') e));

  o := public.sf_place_order(jsonb_build_object('family_id', fam, 'name', 'عميل تجربة', 'items', jsonb_build_array(
          jsonb_build_object('dish_id', dish, 'qty', 2, 'options', jsonb_build_array('s2', 'x1'), 'note', 'بدون بصل'),
          jsonb_build_object('dish_id', dish2, 'qty', 1)),
         'fulfillment', 'delivery', 'lat', 26.2810, 'lng', 50.2050, 'address', jsonb_build_object('label', 'البيت', 'district', 'الحزام الذهبي'),
         'pay_method', 'cod', 'scheduled_for', win));
  res := res || jsonb_build_object('place', o->'ok', 'place_err', o->'errors', 'status', o->'status', 'no', o->'order_no');
  oid := (o->>'id')::uuid;
  select count(*) into notif from public.sf_notifications where order_id = oid;
  res := res || jsonb_build_object('notifs_after_place', notif);

  -- الأسرة
  perform set_config('request.jwt.claims', json_build_object('sub', fu, 'role', 'authenticated')::text, true);
  me := public.sf_me();
  res := res || jsonb_build_object('fam_role', me->>'role', 'fam_sees', (select count(*) from public.sf_orders where id = oid));
  r := public.sf_family_set_status(oid, 'ready'); res := res || jsonb_build_object('skip_to_ready', r->'ok');
  r := public.sf_family_set_status(oid, 'preparing', 40); res := res || jsonb_build_object('accept', r->'ok');
  r := public.sf_family_set_status(oid, 'ready'); res := res || jsonb_build_object('ready', r->'ok');
  r := public.sf_family_set_status(oid, 'on_the_way'); res := res || jsonb_build_object('otw', r->'ok');
  r := public.sf_family_set_status(oid, 'delivered'); res := res || jsonb_build_object('delivered', r->'ok');

  -- العميل يقيّم
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role', 'authenticated')::text, true);
  r := public.sf_order_rate(oid, 5, 'لذيذ جدًا', null); res := res || jsonb_build_object('rate', r->'ok');
  select status into st from public.sf_orders where id = oid;
  select count(*) into ev from public.sf_order_events where order_id = oid;
  select count(*) into notif from public.sf_notifications where order_id = oid;
  res := res || jsonb_build_object('final_status', st, 'events', ev, 'notifs_total', notif,
    'pay_status', (select pay_status from public.sf_orders where id = oid),
    'cust_sees_other', (select count(*) from public.sf_orders where user_id <> cu));

  -- حساب الأسرة
  perform set_config('request.jwt.claims', json_build_object('sub', fu, 'role', 'authenticated')::text, true);
  fin := public.sf_family_finance((now() at time zone 'Asia/Riyadh')::date, (now() at time zone 'Asia/Riyadh')::date);
  res := res || jsonb_build_object('fin_orders', fin->'orders', 'fin_net', fin->'net', 'fin_balance', fin->'balance', 'cod_comm', fin->'cod_commission');

  reset role;
  res := res || jsonb_build_object('family_rating', (select rating_count from public.sf_families where id = fam));
  raise exception 'TEST RESULTS %', res::text;
end $$;
rollback;
