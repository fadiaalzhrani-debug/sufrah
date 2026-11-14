-- سُفرة · 010: ملخص اليوم للإدارة (إشعار الساعة 11 الليل بتوقيت الرياض)
create or replace function public.sf_daily_digest() returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Riyadh')::date; n_done int; gmv numeric; comm numeric; n_cancel int; n_new_fam int; body text;
begin
  select count(*), coalesce(sum(total), 0), coalesce(sum(commission + small_order_fee - discount - credit_used), 0)
    into n_done, gmv, comm
    from public.sf_orders where not is_test and status in ('delivered', 'picked_up') and (done_at at time zone 'Asia/Riyadh')::date = d;
  select count(*) into n_cancel from public.sf_orders where not is_test and status in ('cancelled', 'rejected') and (cancelled_at at time zone 'Asia/Riyadh')::date = d;
  select count(*) into n_new_fam from public.sf_join_requests where status = 'new';
  body := n_done || ' طلب مكتمل · ' || trim(to_char(gmv, 'FM999999990.##')) || ' ريال · صافي المنصة ' || trim(to_char(comm, 'FM999999990.##'))
          || case when n_cancel > 0 then ' · ' || n_cancel || ' ملغي' else '' end
          || case when n_new_fam > 0 then ' · ' || n_new_fam || ' طلب انضمام ينتظر' else '' end;
  perform public.sf__notify_admins('ملخص اليوم', body, '#dashboard');
  return jsonb_build_object('done', n_done, 'gmv', gmv, 'net', comm, 'cancelled', n_cancel);
end $$;
revoke all on function public.sf_daily_digest() from public, anon, authenticated;
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'sf-digest'; end $$;
select cron.schedule('sf-digest', '0 20 * * *', $c$ select public.sf_daily_digest() $c$);
