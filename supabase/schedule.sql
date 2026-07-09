-- ============================================================
--  سُفرة — جدولة الطلب (احجز وقت الاستلام/التوصيل)
--  الصقه في Supabase → SQL Editor → New query → Run  (مرة واحدة)
--  رابط مباشر لمحرّر SQL في مشروعك:
--  https://supabase.com/dashboard/project/uzwuvzxdjijlbfguhlmc/sql/new
-- ============================================================

-- موعد الطلب المحجوز (فارغ = في أقرب وقت)
alter table public.orders add column if not exists scheduled_for timestamptz;

-- فهرس لتسريع الترتيب/التذكير حسب الموعد لاحقاً
create index if not exists orders_scheduled_for_idx on public.orders (scheduled_for);
