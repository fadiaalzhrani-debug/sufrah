-- ============================================================
--  سُفرة — صلاحيات الأدمن + جدول الإعلانات
--  الأدمن: fadiaalzhrani@gmail.com
--  الصقيه في Supabase → SQL Editor → New query → Run
--  (آمن لإعادة التشغيل)
-- ============================================================

-- الأدمن يتحكّم بكل المطابخ (توثيق/حذف)
drop policy if exists "admin_kitchens" on public.kitchens;
create policy "admin_kitchens" on public.kitchens for all
  using ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com');

-- الأدمن يتحكّم بكل الأطباق (حذف)
drop policy if exists "admin_dishes" on public.dishes;
create policy "admin_dishes" on public.dishes for all
  using ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com');

-- جدول الإعلانات (رسائل الأدمن للمطابخ)
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  created_at timestamptz default now()
);
alter table public.announcements enable row level security;

drop policy if exists "read_announcements" on public.announcements;
create policy "read_announcements" on public.announcements for select using (true);

drop policy if exists "admin_announcements" on public.announcements;
create policy "admin_announcements" on public.announcements for all
  using ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com');

-- تفعيل اللحظي للإعلانات (آمن لإعادة التشغيل)
do $$ begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null; end $$;
