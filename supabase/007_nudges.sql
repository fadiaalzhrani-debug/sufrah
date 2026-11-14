-- ============================================================
--  سُفرة · 007_nudges.sql · التنبيهات التلقائية
--  للعميل: تذكير يكمّل الدفع، وطلب تقييم بعد ساعة من الاستلام
--  للإدارة: طلب انضمام جديد، شكوى جديدة، طلب انلغى لأن الأسرة ما ردت
-- ============================================================

-- إشعار لكل الإدارة (admin + support) مع نداء الإرسال
create or replace function public.sf__notify_admins(p_title text, p_body text, p_link text) returns void language plpgsql security definer set search_path = public as $$
declare s record; nid bigint; ids bigint[] := '{}';
begin
  for s in select user_id from public.sf_staff where role in ('admin', 'support') and active and user_id is not null loop
    insert into public.sf_notifications (user_id, title, body, link, kind) values (s.user_id, p_title, p_body, p_link, 'admin') returning id into nid;
    ids := ids || nid;
  end loop;
  if array_length(ids, 1) > 0 then perform public.sf_hook('notify', jsonb_build_object('ids', to_jsonb(ids))); end if;
end $$;
revoke all on function public.sf__notify_admins(text, text, text) from public, anon, authenticated;

create or replace function public.sf_join_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sf__notify_admins('طلب انضمام جديد', new.kitchen_name || ' · ' || coalesce((select name_ar from public.sf_cities where id = new.city_id), ''), '#join');
  return new;
end $$;
drop trigger if exists sf_join_after on public.sf_join_requests;
create trigger sf_join_after after insert on public.sf_join_requests for each row execute function public.sf_join_after();

create or replace function public.sf_complaint_after() returns trigger language plpgsql security definer set search_path = public as $$
declare no text;
begin
  select order_no::text into no from public.sf_orders where id = new.order_id;
  perform public.sf__notify_admins('شكوى جديدة' || coalesce(' على طلب ' || no, ''), left(new.body, 120), '#complaints');
  return new;
end $$;
drop trigger if exists sf_complaint_after on public.sf_complaints;
create trigger sf_complaint_after after insert on public.sf_complaints for each row execute function public.sf_complaint_after();

-- الكنس الدوري بعد إضافة التذكيرات
create or replace function public.sf_sweep() returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; n_unpaid int := 0; n_auto int := 0; n_rem int := 0; n_pay int := 0; n_rate int := 0;
  pay_to int := public.sf_setting_num('pay_timeout_min', 20)::int; acc_to int := public.sf_setting_num('accept_timeout_min', 15)::int;
  acc_sched int := public.sf_setting_num('accept_timeout_sched_min', 180)::int; nid bigint; s record; ids bigint[]; v_lang text; en boolean;
begin
  -- (1) طلب بطاقة ما اندفع خلال المهلة
  for o in select id from public.sf_orders where status = 'pending_payment' and created_at < now() - make_interval(mins => pay_to) for update skip locked loop
    perform public.sf__set_status(o.id, 'cancelled', 'system', 'ما اكتمل الدفع');
    n_unpaid := n_unpaid + 1;
  end loop;
  -- (2) الأسرة ما ردت
  for o in select so.id, so.order_no, f.name_ar from public.sf_orders so join public.sf_families f on f.id = so.family_id where so.status = 'new'
            and ((so.scheduled_for is null and so.status_at < now() - make_interval(mins => acc_to))
              or (so.scheduled_for is not null and (so.status_at < now() - make_interval(mins => acc_sched) or so.scheduled_for < now() + interval '30 minutes')))
            for update of so skip locked loop
    perform public.sf__set_status(o.id, 'rejected', 'system', 'الأسرة ما ردت على الطلب');
    perform public.sf__notify_admins('طلب ' || o.order_no || ' انلغى لأن الأسرة ما ردت', o.name_ar, '#orders');
    n_auto := n_auto + 1;
  end loop;
  -- (3) تذكير الأسرة بنص المهلة
  for o in select so.* from public.sf_orders so where so.status = 'new' and so.scheduled_for is null
            and so.status_at < now() - make_interval(mins => greatest(acc_to / 2, 3))
            and not exists (select 1 from public.sf_order_events e where e.order_id = so.id and e.status = 'reminded') loop
    insert into public.sf_order_events (order_id, status, by_role) values (o.id, 'reminded', 'system');
    ids := '{}';
    for s in select user_id from public.sf_staff where family_id = o.family_id and active and user_id is not null loop
      insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
      values (s.user_id, 'طلب رقم ' || o.order_no || ' ينتظر قبولك', 'لو ما انقبل خلال دقايق بيتلغى تلقائيًا', '?order=' || o.id, 'family_order', o.id) returning id into nid;
      ids := ids || nid;
    end loop;
    if array_length(ids, 1) > 0 then perform public.sf_hook('notify', jsonb_build_object('ids', to_jsonb(ids))); end if;
    n_rem := n_rem + 1;
  end loop;
  -- (4) العميل ما كمّل الدفع بعد 4 دقايق: تذكير مرة وحدة
  for o in select so.* from public.sf_orders so where so.status = 'pending_payment' and so.created_at < now() - interval '4 minutes' and so.user_id is not null
            and not exists (select 1 from public.sf_order_events e where e.order_id = so.id and e.status = 'pay_nudged') loop
    insert into public.sf_order_events (order_id, status, by_role) values (o.id, 'pay_nudged', 'system');
    select coalesce(pr.lang, 'ar') into v_lang from public.sf_profiles pr where pr.id = o.user_id; en := v_lang = 'en';
    insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
    values (o.user_id, case when en then 'Complete your payment' else 'كمّل دفع طلبك' end,
            case when en then 'Order #' || o.order_no || ' reaches the kitchen once paid' else 'طلب رقم ' || o.order_no || ' يوصل للأسرة بعد الدفع' end,
            '?order=' || o.id, 'order', o.id) returning id into nid;
    perform public.sf_hook('notify', jsonb_build_object('ids', jsonb_build_array(nid)));
    n_pay := n_pay + 1;
  end loop;
  -- (5) طلب تقييم بعد ساعة من الاستلام
  for o in select so.* from public.sf_orders so where so.status in ('delivered', 'picked_up') and so.rating is null and so.user_id is not null
            and so.done_at < now() - interval '60 minutes' and so.done_at > now() - interval '3 days'
            and not exists (select 1 from public.sf_order_events e where e.order_id = so.id and e.status = 'rate_nudged') limit 50 loop
    insert into public.sf_order_events (order_id, status, by_role) values (o.id, 'rate_nudged', 'system');
    select coalesce(pr.lang, 'ar') into v_lang from public.sf_profiles pr where pr.id = o.user_id; en := v_lang = 'en';
    insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
    values (o.user_id, case when en then 'How was your meal?' else 'كيف كان الأكل؟' end,
            case when en then 'Rate order #' || o.order_no || ' in one tap' else 'قيّم طلب رقم ' || o.order_no || ' بضغطة' end,
            '?order=' || o.id || '&rate=1', 'order', o.id) returning id into nid;
    perform public.sf_hook('notify', jsonb_build_object('ids', jsonb_build_array(nid)));
    n_rate := n_rate + 1;
  end loop;
  return jsonb_build_object('unpaid', n_unpaid, 'auto_rejected', n_auto, 'reminded', n_rem, 'pay_nudged', n_pay, 'rate_nudged', n_rate);
end $$;
revoke all on function public.sf_sweep() from public, anon, authenticated;

-- الكنس يشتغل لو فيه طلبات حية أو طلبات انتهت وتحتاج تقييم
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'sf-sweep'; end $$;
select cron.schedule('sf-sweep', '* * * * *', $c$ select public.sf_sweep() where exists (
  select 1 from public.sf_orders where status in ('pending_payment', 'new')
     or (status in ('delivered', 'picked_up') and rating is null and done_at > now() - interval '3 days' and done_at < now() - interval '60 minutes')) $c$);

notify pgrst, 'reload schema';
