-- ============================================================
--  سُفرة — المستوى ٣: نقاط الولاء + الاشتراكات الأسبوعية
--  الصقه كامل في Supabase → SQL Editor → New query → Run  (مرة واحدة)
--  رابط مباشر لمحرّر SQL في مشروعك:
--  https://supabase.com/dashboard/project/uzwuvzxdjijlbfguhlmc/sql/new
-- ============================================================

-- (١) نقاط الولاء — رصيد نقاط العميل
alter table public.profiles add column if not exists points int not null default 0;

-- (٢) الاشتراكات الأسبوعية
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references auth.users(id) on delete cascade,
  customer_name  text,
  customer_phone text,
  kitchen_id     uuid not null references public.kitchens(id) on delete cascade,
  days           jsonb not null default '[]',   -- ['sun','mon',...]
  note           text,
  status         text not null default 'active', -- active | paused
  created_at     timestamptz default now()
);
alter table public.subscriptions enable row level security;

-- العميل ينشئ اشتراكه فقط
drop policy if exists "subs_insert" on public.subscriptions;
create policy "subs_insert" on public.subscriptions for insert with check (auth.uid() = customer_id);

-- العميل يشوف اشتراكاته، والأسرة تشوف مشتركي مطبخها، والأدمن الكل
drop policy if exists "subs_read" on public.subscriptions;
create policy "subs_read" on public.subscriptions for select using (
  auth.uid() = customer_id
  or (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
  or exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid())
);

-- العميل يعدّل/يوقف اشتراكه، والأدمن
drop policy if exists "subs_update" on public.subscriptions;
create policy "subs_update" on public.subscriptions for update using (
  auth.uid() = customer_id or (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
);

-- العميل يلغي اشتراكه، والأدمن
drop policy if exists "subs_delete" on public.subscriptions;
create policy "subs_delete" on public.subscriptions for delete using (
  auth.uid() = customer_id or (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
);
