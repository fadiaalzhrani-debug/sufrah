-- ============================================================
--  سُفرة · 003_events.sql · الإشعارات والمهام المجدولة
-- ============================================================

-- نداء دالة خادم (pg_net) بمفتاح الخدمة المحفوظ في sf_secrets. ما يوقف حفظ الطلب أبدًا
create or replace function public.sf_hook(p_fn text, p_payload jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  select value into v_key from public.sf_secrets where key = 'service_key';
  if v_key is null then return; end if;
  perform net.http_post(
    url := 'https://uzwuvzxdjijlbfguhlmc.supabase.co/functions/v1/' || p_fn,
    body := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    timeout_milliseconds := 5000);
exception when others then return;
end $$;
revoke all on function public.sf_hook(text, jsonb) from public, anon, authenticated;

-- نص الإشعار حسب الحالة واللغة
create or replace function public.sf__order_msg(o public.sf_orders, p_for text, p_lang text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare fam text; t text; b text; no text := o.order_no::text; en boolean := p_lang = 'en';
begin
  select case when en then coalesce(name_en, name_ar) else name_ar end into fam from public.sf_families where id = o.family_id;
  if p_for = 'customer' then
    case o.status
      when 'new' then t := case when en then 'Order sent to ' || fam else 'وصل طلبك لـ ' || fam end;
                      b := case when en then 'Order #' || no || ' is waiting for the kitchen to accept' else 'طلب رقم ' || no || ' بانتظار قبول الأسرة' end;
      when 'preparing' then t := case when en then fam || ' is preparing your order' else fam || ' بدأت تجهيز طلبك' end;
                      b := case when en then 'Expected ready at ' || public.sf_fmt_time(o.ready_eta, 'en') else 'متوقع يجهز الساعة ' || public.sf_fmt_time(o.ready_eta, 'ar') end;
      when 'ready' then t := case when o.fulfillment = 'pickup' then case when en then 'Your order is ready for pickup' else 'طلبك جاهز للاستلام' end
                                  else case when en then 'Your order is ready' else 'طلبك جاهز وبيطلع لك' end end;
                      b := case when en then 'Order #' || no else 'طلب رقم ' || no end;
      when 'on_the_way' then t := case when en then 'Your order is on the way' else 'طلبك في الطريق لك' end; b := case when en then 'Order #' || no else 'طلب رقم ' || no end;
      when 'delivered', 'picked_up' then t := case when en then 'Enjoy your meal' else 'بالعافية عليك' end;
                      b := case when en then 'Tell us how order #' || no || ' was' else 'قيّم طلب رقم ' || no || ' وساعد الأسرة' end;
      when 'rejected' then t := case when en then fam || ' could not take your order' else 'اعتذرت ' || fam || ' عن طلبك' end;
                      b := coalesce(o.cancel_reason, '') || case when o.pay_status = 'refund_pending' then case when en then ' · Your payment will be refunded' else ' · بيرجع لك المبلغ' end else '' end;
      when 'cancelled' then t := case when en then 'Order #' || no || ' was cancelled' else 'انلغى طلب رقم ' || no end;
                      b := coalesce(o.cancel_reason, '') || case when o.pay_status = 'refund_pending' then case when en then ' · Your payment will be refunded' else ' · بيرجع لك المبلغ' end else '' end;
      else return null;
    end case;
  else
    case o.status
      when 'new' then t := 'طلب جديد رقم ' || no;
                      b := jsonb_array_length(o.items) || ' أصناف · ' || trim(to_char(o.total, 'FM999990.##')) || ' ريال · '
                           || case when o.scheduled_for is null then 'بأسرع وقت' else 'موعد ' || to_char(o.scheduled_for at time zone 'Asia/Riyadh', 'FMDD/FMMM') || ' ' || public.sf_fmt_time(o.scheduled_for, 'ar') end
                           || case when o.pay_method = 'cod' then ' · كاش' else '' end;
      when 'cancelled' then
        if o.cancelled_by in ('family') then return null; end if;
        t := 'انلغى طلب رقم ' || no; b := coalesce(o.cancel_reason, '');
      when 'rejected' then
        if o.cancelled_by <> 'system' then return null; end if;
        t := 'انلغى طلب رقم ' || no || ' لأنه ما انقبل'; b := 'اقبل الطلبات بسرعة عشان ما تضيع';
      else return null;
    end case;
  end if;
  return jsonb_build_object('title', t, 'body', b);
end $$;

-- بعد أي إنشاء أو تغيير حالة: سجل الحالة، وإشعار للعميل والأسرة، ونداء دالة الإرسال
create or replace function public.sf_orders_after() returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb; v_lang text; ids bigint[] := '{}'; nid bigint; s record;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.sf_order_events (order_id, status, by_role, note) values (new.id, new.status, 'customer', null);
  end if;
  if new.status = 'pending_payment' then return new; end if;
  -- العميل
  if new.user_id is not null then
    select coalesce(pr.lang, 'ar') into v_lang from public.sf_profiles pr where pr.id = new.user_id;
    m := public.sf__order_msg(new, 'customer', coalesce(v_lang, 'ar'));
    if m is not null then
      insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
      values (new.user_id, m->>'title', m->>'body', '?order=' || new.id, 'order', new.id) returning id into nid;
      ids := ids || nid;
    end if;
  end if;
  -- الأسرة
  m := public.sf__order_msg(new, 'family', 'ar');
  if m is not null then
    for s in select user_id from public.sf_staff where family_id = new.family_id and active and user_id is not null loop
      insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
      values (s.user_id, m->>'title', m->>'body', '?order=' || new.id, 'family_order', new.id) returning id into nid;
      ids := ids || nid;
    end loop;
  end if;
  if array_length(ids, 1) > 0 then perform public.sf_hook('notify', jsonb_build_object('ids', to_jsonb(ids), 'order_id', new.id, 'status', new.status)); end if;
  return new;
end $$;
drop trigger if exists sf_orders_after on public.sf_orders;
create trigger sf_orders_after after insert or update of status on public.sf_orders for each row execute function public.sf_orders_after();

-- تقييم جديد: يتحدث متوسط الأسرة، وتوصلها كلمة
create or replace function public.sf_orders_rating() returns trigger language plpgsql security definer set search_path = public as $$
declare nid bigint; s record; ids bigint[] := '{}';
begin
  update public.sf_families f set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.sf_orders where family_id = f.id and rating is not null and not review_hidden and not is_test), 0),
    rating_count = (select count(*) from public.sf_orders where family_id = f.id and rating is not null and not review_hidden and not is_test)
  -- الأسر التجريبية تحتفظ بتقييمها المزروع، وإلا أي تقييم تجربة يصفّره
  where f.id = new.family_id and not f.is_demo;
  if new.rating is not null and old.rating is null then
    for s in select user_id from public.sf_staff where family_id = new.family_id and active and user_id is not null loop
      insert into public.sf_notifications (user_id, title, body, link, kind, order_id)
      values (s.user_id, 'تقييم جديد ' || repeat('★', new.rating), coalesce(left(new.review, 120), 'طلب رقم ' || new.order_no), '?order=' || new.id, 'review', new.id)
      returning id into nid;
      ids := ids || nid;
    end loop;
    if array_length(ids, 1) > 0 then perform public.sf_hook('notify', jsonb_build_object('ids', to_jsonb(ids))); end if;
  end if;
  return new;
end $$;
drop trigger if exists sf_orders_rating on public.sf_orders;
create trigger sf_orders_rating after update of rating, review_hidden on public.sf_orders for each row execute function public.sf_orders_rating();

-- مكافأة الدعوة: أول طلب مكتمل للصديق يعطي اللي دعاه رصيد
create or replace function public.sf_orders_referral() returns trigger language plpgsql security definer set search_path = public as $$
declare r public.sf_referrals;
begin
  if new.status in ('delivered', 'picked_up') and old.status not in ('delivered', 'picked_up') and new.user_id is not null then
    select * into r from public.sf_referrals where referred_id = new.user_id and not rewarded;
    if found then
      update public.sf_referrals set rewarded = true where referred_id = new.user_id;
      insert into public.sf_credits (user_id, amount, reason, order_id) values (r.referrer_id, public.sf_setting_num('referral_reward_credit', 10), 'referral_reward', new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sf_orders_referral on public.sf_orders;
create trigger sf_orders_referral after update of status on public.sf_orders for each row execute function public.sf_orders_referral();

-- ───────── الكنس الدوري (كل دقيقة) ─────────
-- (1) طلب بطاقة ما اندفع خلال المهلة ينلغي، (2) طلب ما قبلته الأسرة خلال المهلة يعتذر عنه النظام،
-- (3) تذكير الأسرة بنص المهلة
create or replace function public.sf_sweep() returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; n_unpaid int := 0; n_auto int := 0; n_rem int := 0; pay_to int := public.sf_setting_num('pay_timeout_min', 20)::int;
  acc_to int := public.sf_setting_num('accept_timeout_min', 15)::int; acc_sched int := public.sf_setting_num('accept_timeout_sched_min', 180)::int; nid bigint; s record; ids bigint[];
begin
  for o in select id from public.sf_orders where status = 'pending_payment' and created_at < now() - make_interval(mins => pay_to) for update skip locked loop
    perform public.sf__set_status(o.id, 'cancelled', 'system', 'ما اكتمل الدفع');
    n_unpaid := n_unpaid + 1;
  end loop;
  for o in select id, scheduled_for, status_at from public.sf_orders where status = 'new'
            and ((scheduled_for is null and status_at < now() - make_interval(mins => acc_to))
              or (scheduled_for is not null and (status_at < now() - make_interval(mins => acc_sched) or scheduled_for < now() + interval '30 minutes')))
            for update skip locked loop
    perform public.sf__set_status(o.id, 'rejected', 'system', 'الأسرة ما ردت على الطلب');
    n_auto := n_auto + 1;
  end loop;
  -- تذكير مرة وحدة لما يعدي نص المهلة
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
  return jsonb_build_object('unpaid', n_unpaid, 'auto_rejected', n_auto, 'reminded', n_rem);
end $$;
revoke all on function public.sf_sweep() from public, anon, authenticated;

create or replace function public.sf_cleanup() returns void language sql security definer set search_path = public as $$
  delete from public.sf_rate_hits where at < now() - interval '3 days';
  delete from public.sf_notifications where created_at < now() - interval '120 days' and read_at is not null;
  delete from public.sf_sms_log where created_at < now() - interval '60 days';
$$;
revoke all on function public.sf_cleanup() from public, anon, authenticated;

-- الدوال الداخلية ما تنادى من التطبيق مباشرة
revoke all on function public.sf__price(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.sf__set_status(uuid, text, text, text, int) from public, anon, authenticated;
revoke all on function public.sf__release(uuid) from public, anon, authenticated;
revoke all on function public.sf__log(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.sf__order_msg(public.sf_orders, text, text) from public, anon, authenticated;
revoke all on function public.sf_rate_ok(text, int, interval) from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('sf-sweep', 'sf-cleanup', 'sf-pay-sweep');
end $$;
select cron.schedule('sf-sweep', '* * * * *', $c$ select public.sf_sweep() where exists (select 1 from public.sf_orders where status in ('pending_payment', 'new')) $c$);
select cron.schedule('sf-cleanup', '20 1 * * *', $c$ select public.sf_cleanup() $c$);
select cron.schedule('sf-pay-sweep', '*/3 * * * *', $c$ select public.sf_hook('pay/sweep', '{}'::jsonb) where exists (select 1 from public.sf_orders where pay_status = 'refund_pending' or (status = 'pending_payment' and created_at < now() - interval '2 minutes')) $c$);

notify pgrst, 'reload schema';
