-- ============================================================
--  سُفرة — كوبونات الخصم
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  discount_type text not null default 'fixed',   -- 'fixed' (ر.س) أو 'percent' (%)
  value         numeric not null,
  active        boolean default true,
  created_at    timestamptz default now()
);
alter table public.coupons enable row level security;

-- الجميع يقرأ الكوبونات (للتحقق عند الطلب)
drop policy if exists "read_coupons" on public.coupons;
create policy "read_coupons" on public.coupons for select using (true);

-- الأدمن يدير الكوبونات
drop policy if exists "admin_coupons" on public.coupons;
create policy "admin_coupons" on public.coupons for all
  using ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com');

-- كوبون تجريبي للبداية (خصم ١٠ ر.س)
insert into public.coupons (code, discount_type, value) values ('WELCOME10', 'fixed', 10)
  on conflict (code) do nothing;
