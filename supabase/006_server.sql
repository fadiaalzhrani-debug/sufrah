-- ============================================================
--  سُفرة · 006_server.sql · دعم دوال الخادم: حدود رسائل الدخول، وإرسال الإشعار الجماعي للجوالات
-- ============================================================

-- حدود رمز الدخول لكل رقم: 5 بالساعة و12 باليوم، وسقف عام 400 بالساعة
create or replace function public.sf_sms_allow(p_phone text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := public.sf_norm_phone(p_phone); h int; d int; g int;
begin
  if ph is null then return jsonb_build_object('ok', false, 'reason', 'phone'); end if;
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*) into h, d
    from public.sf_sms_log where phone = ph and kind = 'otp' and created_at > now() - interval '1 day';
  select count(*) into g from public.sf_sms_log where created_at > now() - interval '1 hour';
  if h >= 5 then return jsonb_build_object('ok', false, 'reason', 'hour'); end if;
  if d >= 12 then return jsonb_build_object('ok', false, 'reason', 'day'); end if;
  if g >= 400 then return jsonb_build_object('ok', false, 'reason', 'global'); end if;
  insert into public.sf_sms_log (phone, kind, ok) values (ph, 'otp', true);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sf_sms_allow(text) from public, anon, authenticated;

-- الإشعار الجماعي: بعد ما تنضاف صفوف الإشعار، نطلب من دالة notify ترسلها للجوالات
create or replace function public.sf_admin_broadcast(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.sf_broadcasts; n int := 0;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if length(btrim(coalesce(p->>'title', ''))) < 2 or p->>'audience' not in ('customers', 'families', 'all') then
    return jsonb_build_object('ok', false, 'ar', 'اكتب العنوان واختر المستلمين', 'en', 'Enter a title and audience'); end if;
  insert into public.sf_broadcasts (audience, title, body, link, created_by)
  values (p->>'audience', left(btrim(p->>'title'), 80), left(p->>'body', 300), left(p->>'link', 300), auth.uid()) returning * into b;
  insert into public.sf_notifications (user_id, title, body, link, kind)
  select u, b.title, b.body, b.link, 'broadcast' from (
    select pr.id u from public.sf_profiles pr where b.audience in ('customers', 'all') and pr.marketing_ok and not pr.blocked
      and not exists (select 1 from public.sf_staff s where s.user_id = pr.id)
    union
    select s.user_id from public.sf_staff s where b.audience in ('families', 'all') and s.active and s.user_id is not null and s.family_id is not null) t;
  get diagnostics n = row_count;
  update public.sf_broadcasts set recipients = n where id = b.id;
  perform public.sf__log('broadcast', b.id::text, p);
  if n > 0 then perform public.sf_hook('notify/broadcast', jsonb_build_object('id', b.id)); end if;
  return jsonb_build_object('ok', true, 'id', b.id, 'recipients', n);
end $$;

notify pgrst, 'reload schema';
