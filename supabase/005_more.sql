-- ============================================================
--  سُفرة · 005_more.sql · دوال الواجهات: الرئيسية، التقييمات، التواصل، أدوات الإدارة
-- ============================================================

-- الصفحة الرئيسية: الأسر النشطة مع حالة الفتح وأقل وأعلى رسوم توصيل، والأطباق الأكثر طلبًا
create or replace function public.sf_home(p_city text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'families', coalesce((select jsonb_agg(x order by x.open_now desc, x.featured desc, x.sort, x.rating_avg desc) from (
      select f.id, f.slug, f.name_ar, f.name_en, f.bio_ar, f.bio_en, f.logo_url, f.cover_url, f.city_id, f.district, f.is_open,
             f.prep_min, f.min_order, f.pickup_enabled, f.delivery_enabled, f.cuisines, f.tags, f.featured, f.sort,
             f.rating_avg, f.rating_count, f.orders_count, f.is_demo,
             public.sf_family_open_now(f.id) as open_now,
             (select min((t->>'fee')::numeric) from jsonb_array_elements(f.delivery_tiers) t) as fee_from,
             (select max((t->>'fee')::numeric) from jsonb_array_elements(f.delivery_tiers) t) as fee_to,
             (select array_agg(distinct d.category_id) from public.sf_dishes d where d.family_id = f.id and d.category_id is not null) as categories,
             (select min(h.open_min) from public.sf_family_hours h where h.family_id = f.id and h.dow = extract(dow from public.sf_local_now())::int
                and h.open_min > (extract(hour from public.sf_local_now()) * 60 + extract(minute from public.sf_local_now()))::int) as opens_today_min
        from public.sf_families f
       where f.status = 'active' and (p_city is null or f.city_id = p_city or f.city_id is null)) x), '[]'::jsonb),
    'popular', coalesce((select jsonb_agg(y) from (
      select d.id, d.family_id, d.name_ar, d.name_en, d.image_url, d.price, d.old_price, d.category_id, f.name_ar as family_ar, f.name_en as family_en, f.slug,
             coalesce((select sum((x->>'qty')::int) from public.sf_orders o, jsonb_array_elements(o.items) x
                        where o.family_id = d.family_id and x->>'dish_id' = d.id::text and o.status in ('delivered', 'picked_up') and not o.is_test
                          and o.created_at > now() - interval '45 days'), 0) as sold
        from public.sf_dishes d join public.sf_families f on f.id = d.family_id
       where f.status = 'active' and d.available and (p_city is null or f.city_id = p_city or f.city_id is null)
       order by sold desc, f.rating_avg desc, d.sort limit 12) y), '[]'::jsonb));
end $$;

-- تقييمات أسرة للعموم: بدون أسماء كاملة ولا أرقام
create or replace function public.sf_family_reviews(p_family uuid, p_limit int default 20) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('rating', o.rating, 'review', o.review, 'photo', o.review_photo, 'reply', o.family_reply,
           'at', o.reviewed_at, 'name', coalesce(split_part(btrim(o.customer_name), ' ', 1), 'عميل'),
           'items', (select string_agg(x->>'name_ar', '، ') from jsonb_array_elements(o.items) x)) order by o.reviewed_at desc), '[]'::jsonb)
    from (select * from public.sf_orders where family_id = p_family and rating is not null and not review_hidden and not is_test
           order by reviewed_at desc limit least(greatest(p_limit, 1), 50)) o
$$;

-- تواصل العميل مع الأسرة بعد ما تقبل طلبه: الجوال وموقع الاستلام
create or replace function public.sf_order_contact(p_order uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.sf_orders; fp public.sf_family_private;
begin
  select * into o from public.sf_orders where id = p_order;
  if not found or o.user_id is distinct from auth.uid() then return jsonb_build_object('ok', false); end if;
  if o.status not in ('preparing', 'ready', 'on_the_way', 'delivered', 'picked_up') or coalesce(o.done_at, now()) < now() - interval '2 days' then
    return jsonb_build_object('ok', false, 'reason', 'not_yet');
  end if;
  select * into fp from public.sf_family_private where family_id = o.family_id;
  return jsonb_build_object('ok', true, 'phone', coalesce(fp.whatsapp, fp.phone), 'whatsapp', coalesce(fp.whatsapp, fp.phone),
    'pickup', case when o.fulfillment = 'pickup' then jsonb_build_object('lat', fp.lat, 'lng', fp.lng, 'address', fp.address_text) end);
end $$;

-- ───────── الإدارة: العملاء ─────────
create or replace function public.sf_admin_customers(p_q text default null, p_limit int default 50) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(x order by x.last_order desc nulls last, x.created_at desc) from (
    select pr.id, pr.name, pr.phone, pr.blocked, pr.created_at, pr.marketing_ok,
      (select count(*) from public.sf_orders o where o.user_id = pr.id and o.status in ('delivered', 'picked_up')) as orders,
      (select coalesce(sum(total), 0) from public.sf_orders o where o.user_id = pr.id and o.status in ('delivered', 'picked_up')) as spent,
      (select max(created_at) from public.sf_orders o where o.user_id = pr.id) as last_order,
      (select coalesce(sum(amount), 0) from public.sf_credits c where c.user_id = pr.id) as credit
    from public.sf_profiles pr
    where q is null or pr.phone like '%' || regexp_replace(q, '\D', '', 'g') || '%' and length(regexp_replace(q, '\D', '', 'g')) >= 3 or pr.name ilike '%' || q || '%'
    order by pr.created_at desc limit least(greatest(p_limit, 1), 200)) x), '[]'::jsonb);
end $$;

create or replace function public.sf_admin_customer_set(p_user uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if p ? 'blocked' then update public.sf_profiles set blocked = (p->>'blocked')::boolean where id = p_user; end if;
  if nullif(p->>'credit', '') is not null and (p->>'credit')::numeric <> 0 then
    insert into public.sf_credits (user_id, amount, reason) values (p_user, round((p->>'credit')::numeric, 2), left(coalesce(p->>'reason', 'admin'), 60));
  end if;
  perform public.sf__log('customer_set', p_user::text, p);
  return jsonb_build_object('ok', true);
end $$;

-- حذف البيانات التجريبية كلها (الأسر وأطباقها وطلباتها) قبل الإطلاق
create or replace function public.sf_admin_delete_demo() returns jsonb language plpgsql security definer set search_path = public as $$
declare n_f int; n_o int;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  delete from public.sf_orders where family_id in (select id from public.sf_families where is_demo);
  get diagnostics n_o = row_count;
  delete from public.sf_staff where family_id in (select id from public.sf_families where is_demo) and phone not like '9665000000%';
  delete from public.sf_families where is_demo;
  get diagnostics n_f = row_count;
  perform public.sf__log('delete_demo', null, jsonb_build_object('families', n_f, 'orders', n_o));
  return jsonb_build_object('ok', true, 'families', n_f, 'orders', n_o);
end $$;

-- حذف حساب العميل (من التطبيق): نخفي بياناته الشخصية من الطلبات ونقفل الملف، والحساب نفسه تحذفه دالة الخادم
create or replace function public.sf_account_anonymize(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sf_orders set customer_name = 'عميل محذوف', customer_phone = null,
         address = case when address is null then null else jsonb_build_object('district', address->>'district', 'city_id', address->>'city_id') end
   where user_id = p_user;
  delete from public.sf_addresses where user_id = p_user;
  delete from public.sf_devices where user_id = p_user;
  delete from public.sf_favorites where user_id = p_user;
  delete from public.sf_notifications where user_id = p_user;
  update public.sf_profiles set name = null, phone = null, marketing_ok = false where id = p_user;
end $$;
revoke all on function public.sf_account_anonymize(uuid) from public, anon, authenticated;

-- كود رابط للأسرة (للمشاركة): slug فريد
create or replace function public.sf_family_slug_set(p_slug text) returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid := public.sf_my_family(); s text := lower(regexp_replace(coalesce(p_slug, ''), '[^a-zA-Z0-9-]', '', 'g'));
begin
  if fam is null then raise exception 'SF_FORBIDDEN'; end if;
  if length(s) < 3 then return jsonb_build_object('ok', false, 'ar', 'الرابط قصير', 'en', 'Too short'); end if;
  if exists (select 1 from public.sf_families where slug = s and id <> fam) then return jsonb_build_object('ok', false, 'ar', 'الرابط مستخدم', 'en', 'Taken'); end if;
  update public.sf_families set slug = s where id = fam;
  return jsonb_build_object('ok', true, 'slug', s);
end $$;

notify pgrst, 'reload schema';
