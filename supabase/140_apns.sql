-- 2026-11-14: إشعارات الآيفون عبر APNs مباشرة؛ نحفظ بيئة آبل الصحيحة لكل جهاز
alter table public.sf_devices add column if not exists apns_env text check (apns_env in ('production', 'sandbox'));
