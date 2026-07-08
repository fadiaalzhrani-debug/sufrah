-- ============================================================
--  سُفرة — طريقة الدفع على الطلب
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.orders add column if not exists payment_method text default 'cash';
