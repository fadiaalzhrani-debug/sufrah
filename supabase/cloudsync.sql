-- ============================================================
--  سُفرة — حفظ سلة/مدينة/إشعارات العميل على السحابة
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.profiles add column if not exists cart   jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists city   text;
alter table public.profiles add column if not exists notifs jsonb default '[]'::jsonb;
