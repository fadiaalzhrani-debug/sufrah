-- ============================================================
--  سُفرة · 008_wa.sql · جداول بوت الواتساب وتنبيهاته
--  البوت مطفي لين يتربط رقم واتساب (wa_enabled=0)
-- ============================================================
create table if not exists public.sf_wa_log (
  id bigserial primary key,
  msg_id text unique,
  phone9 text not null,
  wa_name text,
  kind text not null,                 -- text | interactive | image | notify | echo ...
  body text,
  intent text,
  reply text,
  out_id text,
  status text,
  err text,
  created_at timestamptz not null default now()
);
create index if not exists sf_wa_log_p on public.sf_wa_log (phone9, created_at desc);
create table if not exists public.sf_wa_pause (phone9 text primary key, until timestamptz not null, updated_at timestamptz not null default now());
create table if not exists public.sf_wa_welcomed (phone9 text primary key, at timestamptz not null default now());
alter table public.sf_wa_log enable row level security;
alter table public.sf_wa_pause enable row level security;
alter table public.sf_wa_welcomed enable row level security;
revoke all on public.sf_wa_log, public.sf_wa_pause, public.sf_wa_welcomed from anon, authenticated;
drop policy if exists sf_wa_log_admin on public.sf_wa_log;
create policy sf_wa_log_admin on public.sf_wa_log for select using ((select public.sf_is_admin()));
grant select on public.sf_wa_log to authenticated;

insert into public.sf_settings (key, value, is_public, note) values
  ('wa_welcome_days', '30', false, 'كل كم يوم ينعاد الترحيب لنفس الرقم'),
  ('wa_pause_hours', '6', false, 'سكوت البوت بعد رد يدوي'),
  ('wa_tpl_family_order', '', false, 'قالب تنبيه الأسرة بطلب جديد (اسم القالب المعتمد)'),
  ('wa_tpl_lang', 'ar', false, null),
  ('app_url', 'https://fadiaalzhrani-debug.github.io/sufrah/', true, 'رابط التطبيق للروابط والرسائل')
on conflict (key) do nothing;

-- تنبيه واتساب للأسرة بطلب جديد (بعد ما يوصل لها): يستدعي دالة wa لو البوت شغّال
create or replace function public.sf_orders_wa() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'new' and (tg_op = 'INSERT' or old.status is distinct from 'new') and public.sf_setting_on('wa_enabled', false) then
    perform public.sf_hook('wa/notify', jsonb_build_object('type', 'family_order', 'order_id', new.id));
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('preparing', 'ready', 'on_the_way', 'rejected', 'cancelled') and public.sf_setting_on('wa_enabled', false) then
    perform public.sf_hook('wa/notify', jsonb_build_object('type', 'customer_status', 'order_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists sf_orders_wa on public.sf_orders;
create trigger sf_orders_wa after insert or update of status on public.sf_orders for each row execute function public.sf_orders_wa();

notify pgrst, 'reload schema';
