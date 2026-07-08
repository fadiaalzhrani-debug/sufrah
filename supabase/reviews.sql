-- ============================================================
--  سُفرة — التقييمات
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);
alter table public.reviews enable row level security;

-- الجميع يقرأ التقييمات
drop policy if exists "read_reviews" on public.reviews;
create policy "read_reviews" on public.reviews for select using (true);

-- العميل المسجّل يضيف تقييمه
drop policy if exists "add_review" on public.reviews;
create policy "add_review" on public.reviews for insert with check (auth.uid() = customer_id);

-- العميل يعدّل/يحذف تقييمه (والأدمن يحذف أي تقييم)
drop policy if exists "own_review_update" on public.reviews;
create policy "own_review_update" on public.reviews for update using (auth.uid() = customer_id);
drop policy if exists "review_delete" on public.reviews;
create policy "review_delete" on public.reviews for delete using (
  auth.uid() = customer_id or (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
);

do $$ begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null; end $$;
