-- سُفرة · 009: تعديل الملف الشخصي يكون عبر sf_profile_save بس (عشان العميل الموقوف ما يفك الإيقاف عن نفسه)
drop policy if exists sf_profiles_upd on public.sf_profiles;
revoke update on public.sf_profiles from authenticated;
notify pgrst, 'reload schema';
