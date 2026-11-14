-- ============================================================
--  سُفرة · 120_family.sql · دوال مساعدة لتطبيق الأسر (إضافة فقط، بدون تعديل أي دالة موجودة)
-- ============================================================

-- sf_f_save: حفظ إعدادات المطبخ من تطبيق الأسرة بأمان.
-- السبب: sf_family_save يكتب الحقول الرقمية بصيغة coalesce(least(greatest(القيمة, حد), حد), القديم)،
-- و greatest/least في PostgreSQL تتجاهل null، فلو الحقل ما انرسل يتحول للحد الأدنى بدل ما يبقى:
-- وقت التجهيز 5، أقل طلب 0، أبعد مسافة 1، سعة الفترة 1، سعة اليوم 1، أيام الحجز 0.
-- هنا نكمّل الطلب بالقيم الحالية من الجدول قبل ما نمرره، فالحقول اللي ما تغيرت تبقى مثل ما هي.
create or replace function public.sf_f_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare fam uuid := public.sf_my_family(); f public.sf_families;
begin
  if fam is null then raise exception 'SF_FORBIDDEN'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'SF_BAD'; end if;
  select * into f from public.sf_families where id = fam;
  return public.sf_family_save(
    jsonb_build_object(
      'prep_min', f.prep_min, 'min_order', f.min_order, 'delivery_max_km', f.delivery_max_km,
      'slot_capacity', f.slot_capacity, 'daily_capacity', f.daily_capacity, 'preorder_days', f.preorder_days)
    || (p - 'family_id'));
end $$;
revoke all on function public.sf_f_save(jsonb) from public, anon;
grant execute on function public.sf_f_save(jsonb) to authenticated;

notify pgrst, 'reload schema';
