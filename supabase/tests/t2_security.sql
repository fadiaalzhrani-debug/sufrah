-- اختبار الصلاحيات داخل معاملة تنلغي: كل محاولة لازم تنرفض أو ترجع فاضي
begin;
do $$
declare cu uuid := gen_random_uuid(); fu uuid := gen_random_uuid(); fam uuid; other_fam uuid; dish_other uuid; r jsonb := '{}'::jsonb; n int; ok boolean; v text;
begin
  insert into auth.users (id, phone, aud, role, instance_id) values
    (cu, '966500000081', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (fu, '966500000082', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  select id into fam from public.sf_families where slug = 'umfahad';
  select id into other_fam from public.sf_families where slug = 'halabait';
  select id into dish_other from public.sf_dishes where family_id = other_fam limit 1;
  insert into public.sf_staff (phone, name, role, family_id) values ('966500000082', 'tester', 'family_owner', fam);

  -- زائر
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.sf_orders; r := r || jsonb_build_object('anon_orders', n); exception when others then r := r || jsonb_build_object('anon_orders', 'denied'); end;
  begin select count(*) into n from public.sf_family_private; r := r || jsonb_build_object('anon_private', n); exception when others then r := r || jsonb_build_object('anon_private', 'denied'); end;
  begin select count(*) into n from public.sf_secrets; r := r || jsonb_build_object('anon_secrets', n); exception when others then r := r || jsonb_build_object('anon_secrets', 'denied'); end;
  begin select count(*) into n from public.sf_settings where key = 'commission_pct'; r := r || jsonb_build_object('anon_private_setting', n); exception when others then r := r || jsonb_build_object('anon_private_setting', 'denied'); end;
  begin perform public.sf_place_order('{}'::jsonb); r := r || jsonb_build_object('anon_place', 'ran'); exception when others then r := r || jsonb_build_object('anon_place', 'denied'); end;
  begin perform public.sf_admin_stats(current_date, current_date); r := r || jsonb_build_object('anon_admin', 'ran'); exception when others then r := r || jsonb_build_object('anon_admin', 'denied'); end;
  begin perform public.sf_sweep(); r := r || jsonb_build_object('anon_sweep', 'ran'); exception when others then r := r || jsonb_build_object('anon_sweep', 'denied'); end;
  begin perform public.sf_hook('notify', '{}'::jsonb); r := r || jsonb_build_object('anon_hook', 'ran'); exception when others then r := r || jsonb_build_object('anon_hook', 'denied'); end;
  begin insert into public.sf_dishes (family_id, name_ar, price) values (fam, 'x', 1); r := r || jsonb_build_object('anon_dish_insert', 'ran'); exception when others then r := r || jsonb_build_object('anon_dish_insert', 'denied'); end;

  -- عميل
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role', 'authenticated')::text, true);
  begin perform public.sf_admin_stats(current_date, current_date); r := r || jsonb_build_object('cust_admin', 'ran'); exception when others then r := r || jsonb_build_object('cust_admin', 'denied'); end;
  begin perform public.sf_admin_settings_save('{"commission_pct":"0"}'::jsonb); r := r || jsonb_build_object('cust_settings', 'ran'); exception when others then r := r || jsonb_build_object('cust_settings', 'denied'); end;
  begin update public.sf_settings set value = '0' where key = 'commission_pct'; get diagnostics n = row_count; r := r || jsonb_build_object('cust_settings_upd_rows', n); exception when others then r := r || jsonb_build_object('cust_settings_upd_rows', 'denied'); end;
  begin insert into public.sf_dishes (family_id, name_ar, price) values (fam, 'x', 1); r := r || jsonb_build_object('cust_dish_insert', 'ran'); exception when others then r := r || jsonb_build_object('cust_dish_insert', 'denied'); end;
  begin update public.sf_families set commission_pct = 0 where id = fam; get diagnostics n = row_count; r := r || jsonb_build_object('cust_family_upd_rows', n); exception when others then r := r || jsonb_build_object('cust_family_upd_rows', 'denied'); end;
  begin insert into public.sf_staff (phone, role) values ('966500000083', 'admin'); r := r || jsonb_build_object('cust_staff_insert', 'ran'); exception when others then r := r || jsonb_build_object('cust_staff_insert', 'denied'); end;
  begin select count(*) into n from public.sf_family_private; r := r || jsonb_build_object('cust_private', n); exception when others then r := r || jsonb_build_object('cust_private', 'denied'); end;
  begin perform public.sf_family_set_status(gen_random_uuid(), 'preparing'); r := r || jsonb_build_object('cust_family_status', 'ran_ok_false'); exception when others then r := r || jsonb_build_object('cust_family_status', 'denied'); end;
  begin perform public.sf_family_save('{"name_ar":"hack"}'::jsonb); r := r || jsonb_build_object('cust_family_save', 'ran'); exception when others then r := r || jsonb_build_object('cust_family_save', 'denied'); end;
  begin update public.sf_profiles set blocked = false where id = cu; get diagnostics n = row_count; r := r || jsonb_build_object('cust_unblock_self_rows', n); exception when others then r := r || jsonb_build_object('cust_unblock_self_rows', 'denied'); end;
  begin perform public.sf_order_rate(gen_random_uuid(), 5, 'x', null); r := r || jsonb_build_object('cust_rate_other', 'ran_ok_false'); exception when others then r := r || jsonb_build_object('cust_rate_other', 'denied'); end;

  -- أسرة تحاول تعدّل أسرة ثانية
  perform set_config('request.jwt.claims', json_build_object('sub', fu, 'role', 'authenticated')::text, true);
  perform public.sf_me();
  begin update public.sf_dishes set price = 1 where id = dish_other; get diagnostics n = row_count; r := r || jsonb_build_object('fam_other_dish_upd_rows', n); exception when others then r := r || jsonb_build_object('fam_other_dish_upd_rows', 'denied'); end;
  begin insert into public.sf_dishes (family_id, name_ar, price) values (other_fam, 'x', 1); r := r || jsonb_build_object('fam_other_dish_insert', 'ran'); exception when others then r := r || jsonb_build_object('fam_other_dish_insert', 'denied'); end;
  begin insert into public.sf_dishes (family_id, name_ar, price, is_demo) values (fam, 'mine', 1, false); r := r || jsonb_build_object('fam_own_dish_insert', 'ok'); exception when others then r := r || jsonb_build_object('fam_own_dish_insert', 'denied ' || sqlerrm); end;
  begin update public.sf_families set commission_pct = 0, featured = true where id = fam; get diagnostics n = row_count; r := r || jsonb_build_object('fam_self_commission_rows', n); exception when others then r := r || jsonb_build_object('fam_self_commission_rows', 'denied'); end;
  begin perform public.sf_admin_payout(jsonb_build_object('family_id', fam, 'amount', 1000)); r := r || jsonb_build_object('fam_payout', 'ran'); exception when others then r := r || jsonb_build_object('fam_payout', 'denied'); end;
  begin select count(*) into n from public.sf_family_private where family_id = other_fam; r := r || jsonb_build_object('fam_other_private', n); exception when others then r := r || jsonb_build_object('fam_other_private', 'denied'); end;
  begin select count(*) into n from public.sf_family_private where family_id = fam; r := r || jsonb_build_object('fam_own_private', n); exception when others then r := r || jsonb_build_object('fam_own_private', 'denied'); end;
  reset role;
  raise exception 'TEST RESULTS %', r::text;
end $$;
rollback;
