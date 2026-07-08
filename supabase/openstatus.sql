-- ============================================================
--  سُفرة — حالة المطبخ (مفتوح/مغلق)
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.kitchens add column if not exists is_open boolean default true;
