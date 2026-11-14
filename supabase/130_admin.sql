-- ============================================================
--  سُفرة · 130_admin.sql · أدوات لوحة الإدارة (إضافة فقط، ما تعدّل أي شي موجود)
--  sf_a_log: يسجل في sf_admin_log التعديلات اللي تسويها اللوحة مباشرة على الجداول
--  (بيانات الأسرة، الأطباق، الوثائق، العروض، الشكاوى، المدن والتصنيفات)
--  عشان يطلع كل شي في «السجل» مثل إجراءات الدوال.
-- ============================================================

create or replace function public.sf_a_log(p_action text, p_target text default null, p_data jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare a text := left(regexp_replace(lower(coalesce(p_action, '')), '[^a-z0-9_]', '', 'g'), 40);
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if a = '' then return; end if;
  -- يمنع تزوير أسماء إجراءات الخادم (اللي تسجلها الدوال نفسها)
  if a in ('family_create', 'join_approve', 'join_reject', 'settings', 'staff_save', 'payout', 'broadcast', 'customer_set', 'delete_demo')
     or a like 'order\_%' then return; end if;
  if not public.sf_rate_ok('alog:' || auth.uid(), 600, interval '1 hour') then return; end if;
  insert into public.sf_admin_log (actor, action, target, data)
  values (auth.uid(), a, left(p_target, 80), case when p_data is null or pg_column_size(p_data) > 4000 then null else p_data end);
end $$;

revoke all on function public.sf_a_log(text, text, jsonb) from public, anon;
grant execute on function public.sf_a_log(text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
