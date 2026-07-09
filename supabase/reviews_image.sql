-- ============================================================
--  سُفرة — صورة مع التقييم (التقييم بالصور)
--  الصقه في Supabase → SQL Editor → New query → Run  (مرة واحدة)
--  رابط مباشر لمحرّر SQL في مشروعك:
--  https://supabase.com/dashboard/project/uzwuvzxdjijlbfguhlmc/sql/new
-- ============================================================

-- صورة الطبق التي يرفقها العميل مع تقييمه (فارغة = بدون صورة)
alter table public.reviews add column if not exists image_url text;
