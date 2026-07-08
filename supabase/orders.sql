-- ============================================================
--  سُفرة — نظام الطلبات
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  kitchen_id     uuid not null references public.kitchens(id) on delete cascade,
  customer_name  text,
  customer_phone text,
  address        text,
  delivery_method text default 'pickup',
  items          jsonb not null default '[]',
  subtotal       numeric default 0,
  delivery_fee   numeric default 0,
  total          numeric default 0,
  status         text not null default 'new',
  created_at     timestamptz default now()
);
alter table public.orders enable row level security;

-- أي عميل (حتى بدون حساب) يقدر ينشئ طلب
drop policy if exists "create_order" on public.orders;
create policy "create_order" on public.orders for insert with check (true);

-- الأسرة تشوف طلبات مطبخها فقط + الأدمن يشوف الكل
drop policy if exists "read_orders" on public.orders;
create policy "read_orders" on public.orders for select using (
  (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
  or exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid())
);

-- الأسرة تحدّث حالة طلبات مطبخها + الأدمن
drop policy if exists "update_orders" on public.orders;
create policy "update_orders" on public.orders for update using (
  (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
  or exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid())
);

-- الأدمن يحذف الطلبات
drop policy if exists "delete_orders" on public.orders;
create policy "delete_orders" on public.orders for delete using (
  (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
);

-- تفعيل التحديث اللحظي للطلبات
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
