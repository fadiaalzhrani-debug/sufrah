-- ============================================================
--  سُفرة — برنامج الإحالة (كود صديق)
--  الصقه كامل في Supabase → SQL Editor → New query → Run  (مرة واحدة)
--  رابط مباشر لمحرّر SQL في مشروعك:
--  https://supabase.com/dashboard/project/uzwuvzxdjijlbfguhlmc/sql/new
-- ============================================================

-- كود الإحالة الخاص بكل عميل (يُنشأ تلقائياً من التطبيق)
alter table public.profiles add column if not exists referral_code text unique;

-- سجل الإحالات: كل عميل جديد يُحال مرة واحدة فقط
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid references auth.users(id) on delete cascade,
  referred_id  uuid references auth.users(id) on delete cascade unique,
  created_at   timestamptz default now()
);
alter table public.referrals enable row level security;

drop policy if exists "ref_read" on public.referrals;
create policy "ref_read" on public.referrals for select using (
  auth.uid() = referrer_id or auth.uid() = referred_id
  or (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
);

-- دالة آمنة: العميل الجديد يستخدم كود صديقه فيربح الطرفان نقاطاً
create or replace function public.redeem_referral(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_id uuid;
  me uuid := auth.uid();
  bonus int := 50;
begin
  if me is null then return json_build_object('ok', false, 'error', 'not_authed'); end if;
  select id into ref_id from public.profiles where referral_code = upper(trim(code)) limit 1;
  if ref_id is null then return json_build_object('ok', false, 'error', 'invalid_code'); end if;
  if ref_id = me then return json_build_object('ok', false, 'error', 'self'); end if;
  if exists (select 1 from public.referrals where referred_id = me) then
    return json_build_object('ok', false, 'error', 'already_used');
  end if;
  insert into public.referrals (referrer_id, referred_id) values (ref_id, me);
  update public.profiles set points = coalesce(points, 0) + bonus where id = me;
  update public.profiles set points = coalesce(points, 0) + bonus where id = ref_id;
  return json_build_object('ok', true, 'bonus', bonus);
end;
$$;
grant execute on function public.redeem_referral(text) to authenticated;
