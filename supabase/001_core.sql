-- ============================================================
--  سُفرة · منصة أكل البيوت من الأسر المنتجة
--  001_core.sql · الجداول والفهارس والصلاحيات (RLS) والدوال المساعدة
--  مشروع Supabase: uzwuvzxdjijlbfguhlmc (Sufrah). كل الجداول بالبادئة sf_
--  الجداول القديمة (kitchens, dishes, orders...) باقية بدون لمس.
-- ============================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ───────── الإعدادات والمدن والتصنيفات ─────────
create table if not exists public.sf_settings (
  key text primary key,
  value text not null default '',
  is_public boolean not null default true,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.sf_secrets (
  key text primary key,
  value text not null
);

create table if not exists public.sf_cities (
  id text primary key,
  name_ar text not null,
  name_en text,
  lat double precision,
  lng double precision,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists public.sf_categories (
  id text primary key,
  name_ar text not null,
  name_en text,
  image_url text,
  sort int not null default 0,
  active boolean not null default true
);

-- ───────── الأسر (المطابخ) ─────────
create table if not exists public.sf_families (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name_ar text not null,
  name_en text,
  bio_ar text,
  bio_en text,
  logo_url text,
  cover_url text,
  city_id text references public.sf_cities(id),
  district text,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'closed')),
  is_open boolean not null default true,
  prep_min int not null default 45 check (prep_min between 5 and 1440),
  min_order numeric(10,2) not null default 0 check (min_order >= 0),
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default true,
  delivery_max_km numeric(6,2) not null default 10,
  delivery_tiers jsonb not null default '[{"km":3,"fee":10},{"km":7,"fee":15},{"km":12,"fee":20}]'::jsonb,
  slot_capacity int not null default 4 check (slot_capacity between 1 and 200),
  daily_capacity int not null default 20 check (daily_capacity between 1 and 2000),
  preorder_days int not null default 3 check (preorder_days between 0 and 30),
  commission_pct numeric(5,2) check (commission_pct is null or commission_pct between 0 and 100),
  cuisines text[] not null default '{}',
  tags text[] not null default '{}',
  featured boolean not null default false,
  sort int not null default 0,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  orders_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sf_families_status on public.sf_families (status, city_id);

-- بيانات خاصة بالأسرة: ما تنقرأ للعموم (الموقع الدقيق للمطبخ، الجوال، الآيبان)
create table if not exists public.sf_family_private (
  family_id uuid primary key references public.sf_families(id) on delete cascade,
  phone text,
  whatsapp text,
  lat double precision,
  lng double precision,
  address_text text,
  iban text,
  iban_name text,
  owner_name text,
  national_id text,
  admin_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.sf_family_hours (
  id bigserial primary key,
  family_id uuid not null references public.sf_families(id) on delete cascade,
  dow int not null check (dow between 0 and 6),          -- 0 = الأحد
  open_min int not null check (open_min between 0 and 1440),
  close_min int not null check (close_min between 1 and 1440),
  check (close_min > open_min)
);
create index if not exists sf_family_hours_f on public.sf_family_hours (family_id, dow);

create table if not exists public.sf_family_timeoff (
  id bigserial primary key,
  family_id uuid not null references public.sf_families(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text,
  check (to_date >= from_date)
);
create index if not exists sf_family_timeoff_f on public.sf_family_timeoff (family_id, to_date);

create table if not exists public.sf_family_docs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.sf_families(id) on delete cascade,
  kind text not null check (kind in ('freelance', 'family_cert', 'health_cert', 'municipal', 'iban_cert', 'id', 'other')),
  file_path text not null,
  expires_on date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);

-- ───────── الأطباق ─────────
create table if not exists public.sf_dishes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.sf_families(id) on delete cascade,
  category_id text references public.sf_categories(id),
  section text,                                   -- قسم في منيو الأسرة (الأطباق الرئيسية، الحلا...)
  name_ar text not null,
  name_en text,
  desc_ar text,
  desc_en text,
  image_url text,
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2) check (old_price is null or old_price >= 0),
  serves text,
  prep_min int check (prep_min is null or prep_min between 5 and 2880),
  min_lead_hours int not null default 0 check (min_lead_hours between 0 and 168),
  daily_limit int check (daily_limit is null or daily_limit between 1 and 10000),
  options jsonb not null default '[]'::jsonb,     -- [{id,name_ar,name_en,type:single|multi,required,max,choices:[{id,name_ar,name_en,price}]}]
  available boolean not null default true,
  sort int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sf_dishes_family on public.sf_dishes (family_id, sort);

-- ───────── العملاء والطاقم ─────────
create table if not exists public.sf_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  name text,
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  marketing_ok boolean not null default true,
  referral_code text unique,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sf_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  city_id text references public.sf_cities(id),
  district text,
  street text,
  details text,
  lat double precision not null,
  lng double precision not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sf_addresses_user on public.sf_addresses (user_id);

create table if not exists public.sf_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.sf_families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, family_id)
);

-- الطاقم: الإدارة والأسر (والسائقين لاحقًا). الدخول برمز الجوال، والربط بالرقم
create table if not exists public.sf_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  phone text not null unique,                    -- 9665XXXXXXXX
  name text,
  role text not null check (role in ('admin', 'support', 'family_owner', 'family_staff', 'driver')),
  family_id uuid references public.sf_families(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role in ('family_owner', 'family_staff')) = (family_id is not null))
);

create table if not exists public.sf_join_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null,
  kitchen_name text not null,
  city_id text references public.sf_cities(id),
  district text,
  cuisines text[] not null default '{}',
  specialties text,
  has_license boolean not null default false,
  license_kind text,
  instagram text,
  notes text,
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  admin_note text,
  family_id uuid references public.sf_families(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ───────── الطلبات ─────────
create table if not exists public.sf_orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated by default as identity (start with 10001) unique,
  user_id uuid references auth.users(id) on delete set null,
  family_id uuid not null references public.sf_families(id),
  customer_name text,
  customer_phone text,
  fulfillment text not null check (fulfillment in ('delivery', 'pickup')),
  address jsonb,
  distance_km numeric(6,2),
  scheduled_for timestamptz,                     -- فاضي = بأسرع وقت
  window_end timestamptz,
  items jsonb not null,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  small_order_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  credit_used numeric(10,2) not null default 0,
  promo_code text,
  vat numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  commission_pct numeric(5,2) not null default 0,
  commission numeric(10,2) not null default 0,
  family_net numeric(10,2) not null default 0,
  pay_method text not null check (pay_method in ('card', 'cod', 'free')),
  pay_status text not null default 'unpaid' check (pay_status in ('unpaid', 'pending', 'paid', 'refund_pending', 'refunded', 'failed')),
  paid_amount numeric(10,2) not null default 0,
  refunded_amount numeric(10,2) not null default 0,
  status text not null check (status in ('pending_payment', 'new', 'preparing', 'ready', 'on_the_way', 'delivered', 'picked_up', 'cancelled', 'rejected')),
  status_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_eta timestamptz,
  ready_at timestamptz,
  done_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer', 'family', 'admin', 'system')),
  cancel_reason text,
  note text,
  family_note text,
  rating int check (rating between 1 and 5),
  review text,
  review_photo text,
  reviewed_at timestamptz,
  review_hidden boolean not null default false,
  family_reply text,
  source text not null default 'app' check (source in ('app', 'web', 'wa', 'admin')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sf_orders_user on public.sf_orders (user_id, created_at desc);
create index if not exists sf_orders_family on public.sf_orders (family_id, status, created_at desc);
create index if not exists sf_orders_status on public.sf_orders (status, status_at);
create index if not exists sf_orders_sched on public.sf_orders (family_id, scheduled_for) where status not in ('cancelled', 'rejected');

create table if not exists public.sf_order_events (
  id bigserial primary key,
  order_id uuid not null references public.sf_orders(id) on delete cascade,
  status text not null,
  by_role text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists sf_order_events_o on public.sf_order_events (order_id, id);

create table if not exists public.sf_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.sf_orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'moyasar' check (provider in ('moyasar', 'cash', 'manual')),
  provider_id text unique,
  amount numeric(10,2) not null,
  method text,
  status text not null default 'initiated' check (status in ('initiated', 'paid', 'failed', 'refunded', 'partially_refunded', 'expired')),
  refunded_amount numeric(10,2) not null default 0,
  pay_url text,
  raw jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists sf_payments_order on public.sf_payments (order_id);

-- ───────── العروض والرصيد ─────────
create table if not exists public.sf_promos (
  code text primary key,                         -- محفوظ بحروف كبيرة
  kind text not null check (kind in ('fixed', 'pct')),
  value numeric(10,2) not null check (value > 0),
  max_discount numeric(10,2),
  min_subtotal numeric(10,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  per_user int not null default 1,
  first_order_only boolean not null default false,
  family_id uuid references public.sf_families(id) on delete cascade,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.sf_promo_uses (
  id bigserial primary key,
  code text not null references public.sf_promos(code) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.sf_orders(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sf_promo_uses_code on public.sf_promo_uses (code, user_id);

create table if not exists public.sf_credits (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,                 -- موجب = رصيد، سالب = استخدام
  reason text not null,
  order_id uuid references public.sf_orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sf_credits_user on public.sf_credits (user_id);

create table if not exists public.sf_referrals (
  referred_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────── الدعم والإشعارات ─────────
create table if not exists public.sf_complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.sf_orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  family_id uuid references public.sf_families(id) on delete set null,
  kind text not null check (kind in ('late', 'quality', 'missing', 'wrong', 'cancel', 'refund', 'payment', 'other')),
  body text not null,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.sf_notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  kind text,
  order_id uuid references public.sf_orders(id) on delete cascade,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sf_notifications_user on public.sf_notifications (user_id, id desc);

create table if not exists public.sf_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('webpush', 'fcm', 'apns')),
  token text not null,                            -- webpush: JSON الاشتراك كامل
  keyhash text not null,
  ua text,
  created_at timestamptz not null default now(),
  last_ok timestamptz,
  unique (keyhash)
);
create index if not exists sf_devices_user on public.sf_devices (user_id);

create table if not exists public.sf_broadcasts (
  id bigserial primary key,
  audience text not null check (audience in ('customers', 'families', 'all')),
  title text not null,
  body text,
  link text,
  recipients int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sf_payouts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.sf_families(id) on delete cascade,
  amount numeric(10,2) not null,                  -- موجب = دفعنا للأسرة، سالب = استلمنا منها (عمولة الكاش)
  period_from date,
  period_to date,
  method text,
  ref text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sf_admin_log (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target text,
  data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sf_rate_hits (
  id bigserial primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists sf_rate_hits_k on public.sf_rate_hits (key, at);

create table if not exists public.sf_sms_log (
  id bigserial primary key,
  phone text not null,
  kind text not null default 'otp',
  ok boolean,
  info text,
  created_at timestamptz not null default now()
);
create index if not exists sf_sms_log_p on public.sf_sms_log (phone, created_at);

-- ───────── دوال مساعدة للصلاحيات ─────────
create or replace function public.sf_norm_phone(p text) returns text language sql immutable as $$
  select case
    when p is null then null
    when regexp_replace(p, '\D', '', 'g') ~ '^9665\d{8}$' then regexp_replace(p, '\D', '', 'g')
    when regexp_replace(p, '\D', '', 'g') ~ '^05\d{8}$' then '966' || substr(regexp_replace(p, '\D', '', 'g'), 2)
    when regexp_replace(p, '\D', '', 'g') ~ '^5\d{8}$' then '966' || regexp_replace(p, '\D', '', 'g')
    when regexp_replace(p, '\D', '', 'g') ~ '^009665\d{8}$' then substr(regexp_replace(p, '\D', '', 'g'), 3)
    else null end
$$;

create or replace function public.sf_uid_phone() returns text language sql stable security definer set search_path = public as $$
  select public.sf_norm_phone(u.phone) from auth.users u where u.id = auth.uid()
$$;

-- صف الطاقم للمستخدم الحالي: بالمعرّف، أو بالرقم لو ما انربط بعد
create or replace function public.sf_staff_me() returns public.sf_staff language sql stable security definer set search_path = public as $$
  select s.* from public.sf_staff s
   where s.active and (s.user_id = auth.uid() or (s.user_id is null and s.phone = public.sf_uid_phone()))
   order by (s.user_id = auth.uid()) desc nulls last limit 1
$$;

create or replace function public.sf_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.role in ('admin', 'support') from public.sf_staff s
                    where s.active and (s.user_id = auth.uid() or (s.user_id is null and s.phone = public.sf_uid_phone())) limit 1), false)
$$;

create or replace function public.sf_is_owner_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.role = 'admin' from public.sf_staff s
                    where s.active and (s.user_id = auth.uid() or (s.user_id is null and s.phone = public.sf_uid_phone())) limit 1), false)
$$;

create or replace function public.sf_my_family() returns uuid language sql stable security definer set search_path = public as $$
  select s.family_id from public.sf_staff s
   where s.active and s.role in ('family_owner', 'family_staff')
     and (s.user_id = auth.uid() or (s.user_id is null and s.phone = public.sf_uid_phone())) limit 1
$$;

create or replace function public.sf_setting(p_key text, p_default text default '') returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.sf_settings where key = p_key), p_default)
$$;
create or replace function public.sf_setting_num(p_key text, p_default numeric) returns numeric language plpgsql stable security definer set search_path = public as $$
declare v text := (select value from public.sf_settings where key = p_key);
begin
  if v is null or btrim(v) = '' then return p_default; end if;
  return v::numeric;
exception when others then return p_default;
end $$;
create or replace function public.sf_setting_on(p_key text, p_default boolean default false) returns boolean language sql stable security definer set search_path = public as $$
  select case when v is null or btrim(v) = '' then p_default else lower(btrim(v)) not in ('0', 'false', 'off', 'no') end
    from (select (select value from public.sf_settings where key = p_key) v) x
$$;

-- حد معدل بسيط: يرجع true لو مسموح ويسجّل المحاولة
create or replace function public.sf_rate_ok(p_key text, p_max int, p_window interval) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.sf_rate_hits where key = p_key and at > now() - p_window;
  if n >= p_max then return false; end if;
  insert into public.sf_rate_hits (key) values (p_key);
  return true;
end $$;

create or replace function public.sf_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['sf_families', 'sf_dishes', 'sf_profiles', 'sf_orders', 'sf_family_private'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.sf_touch()', t, t);
  end loop;
end $$;

-- ───────── RLS ─────────
alter table public.sf_settings enable row level security;
alter table public.sf_secrets enable row level security;
alter table public.sf_cities enable row level security;
alter table public.sf_categories enable row level security;
alter table public.sf_families enable row level security;
alter table public.sf_family_private enable row level security;
alter table public.sf_family_hours enable row level security;
alter table public.sf_family_timeoff enable row level security;
alter table public.sf_family_docs enable row level security;
alter table public.sf_dishes enable row level security;
alter table public.sf_profiles enable row level security;
alter table public.sf_addresses enable row level security;
alter table public.sf_favorites enable row level security;
alter table public.sf_staff enable row level security;
alter table public.sf_join_requests enable row level security;
alter table public.sf_orders enable row level security;
alter table public.sf_order_events enable row level security;
alter table public.sf_payments enable row level security;
alter table public.sf_promos enable row level security;
alter table public.sf_promo_uses enable row level security;
alter table public.sf_credits enable row level security;
alter table public.sf_referrals enable row level security;
alter table public.sf_complaints enable row level security;
alter table public.sf_notifications enable row level security;
alter table public.sf_devices enable row level security;
alter table public.sf_broadcasts enable row level security;
alter table public.sf_payouts enable row level security;
alter table public.sf_admin_log enable row level security;
alter table public.sf_rate_hits enable row level security;
alter table public.sf_sms_log enable row level security;

-- إعادة إنشاء السياسات بأمان عند إعادة التشغيل
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'sf\_%' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- الإعدادات: العامة للكل، والكتابة للإدارة
create policy sf_settings_read on public.sf_settings for select using (is_public or (select public.sf_is_admin()));
create policy sf_settings_admin on public.sf_settings for all using ((select public.sf_is_owner_admin())) with check ((select public.sf_is_owner_admin()));

create policy sf_cities_read on public.sf_cities for select using (true);
create policy sf_cities_admin on public.sf_cities for all using ((select public.sf_is_owner_admin())) with check ((select public.sf_is_owner_admin()));
create policy sf_categories_read on public.sf_categories for select using (true);
create policy sf_categories_admin on public.sf_categories for all using ((select public.sf_is_owner_admin())) with check ((select public.sf_is_owner_admin()));

-- الأسر: النشطة للكل، والأسرة تشوف نفسها، والإدارة كل شي. تعديل الأسرة لنفسها عبر sf_family_save
create policy sf_families_read on public.sf_families for select using (status = 'active' or id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_families_admin on public.sf_families for all using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));

create policy sf_family_private_rw on public.sf_family_private for select using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_family_private_admin on public.sf_family_private for all using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));

create policy sf_family_hours_read on public.sf_family_hours for select using (true);
create policy sf_family_hours_write on public.sf_family_hours for all using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin())) with check (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_family_timeoff_read on public.sf_family_timeoff for select using (true);
create policy sf_family_timeoff_write on public.sf_family_timeoff for all using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin())) with check (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));

create policy sf_family_docs_rw on public.sf_family_docs for select using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_family_docs_ins on public.sf_family_docs for insert with check (family_id = (select public.sf_my_family()) and status = 'pending');
create policy sf_family_docs_del on public.sf_family_docs for delete using ((family_id = (select public.sf_my_family()) and status <> 'approved') or (select public.sf_is_admin()));
create policy sf_family_docs_admin on public.sf_family_docs for update using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));

-- الأطباق: أطباق الأسر النشطة للكل، والأسرة تدير أطباقها
create policy sf_dishes_read on public.sf_dishes for select using (
  exists (select 1 from public.sf_families f where f.id = family_id and f.status = 'active')
  or family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_dishes_ins on public.sf_dishes for insert with check ((family_id = (select public.sf_my_family()) and not is_demo) or (select public.sf_is_admin()));
create policy sf_dishes_upd on public.sf_dishes for update using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()))
  with check (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_dishes_del on public.sf_dishes for delete using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));

create policy sf_profiles_own on public.sf_profiles for select using (id = auth.uid() or (select public.sf_is_admin()));
create policy sf_profiles_upd on public.sf_profiles for update using (id = auth.uid()) with check (id = auth.uid() and not blocked);

create policy sf_addresses_own on public.sf_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sf_favorites_own on public.sf_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sf_staff_read on public.sf_staff for select using (user_id = auth.uid() or (select public.sf_is_admin())
  or (family_id is not null and family_id = (select public.sf_my_family())));
create policy sf_staff_admin on public.sf_staff for all using ((select public.sf_is_owner_admin())) with check ((select public.sf_is_owner_admin()));

create policy sf_join_admin on public.sf_join_requests for all using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));

-- الطلبات: العميل طلباته، والأسرة طلباتها، والإدارة كل شي. الكتابة كلها عبر الدوال
create policy sf_orders_read on public.sf_orders for select using (
  user_id = auth.uid() or family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_order_events_read on public.sf_order_events for select using (
  exists (select 1 from public.sf_orders o where o.id = order_id
           and (o.user_id = auth.uid() or o.family_id = (select public.sf_my_family()) or (select public.sf_is_admin()))));
create policy sf_payments_read on public.sf_payments for select using (user_id = auth.uid() or (select public.sf_is_admin()));

create policy sf_promos_admin on public.sf_promos for all using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));
create policy sf_promo_uses_admin on public.sf_promo_uses for select using ((select public.sf_is_admin()));
create policy sf_credits_own on public.sf_credits for select using (user_id = auth.uid() or (select public.sf_is_admin()));
create policy sf_referrals_own on public.sf_referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid() or (select public.sf_is_admin()));

create policy sf_complaints_read on public.sf_complaints for select using (
  user_id = auth.uid() or (select public.sf_is_admin()) or (family_id is not null and family_id = (select public.sf_my_family())));
create policy sf_complaints_admin on public.sf_complaints for update using ((select public.sf_is_admin())) with check ((select public.sf_is_admin()));

create policy sf_notifications_own on public.sf_notifications for select using (user_id = auth.uid());
create policy sf_notifications_read on public.sf_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sf_devices_own on public.sf_devices for select using (user_id = auth.uid());
create policy sf_devices_del on public.sf_devices for delete using (user_id = auth.uid());

create policy sf_broadcasts_admin on public.sf_broadcasts for select using ((select public.sf_is_admin()));
create policy sf_payouts_read on public.sf_payouts for select using (family_id = (select public.sf_my_family()) or (select public.sf_is_admin()));
create policy sf_payouts_admin on public.sf_payouts for all using ((select public.sf_is_owner_admin())) with check ((select public.sf_is_owner_admin()));
create policy sf_admin_log_read on public.sf_admin_log for select using ((select public.sf_is_owner_admin()));
-- sf_secrets و sf_rate_hits و sf_sms_log: بدون سياسات = مقفولة على الكل غير الخادم

-- صلاحيات الجداول: القراءة للزوار عبر RLS، والكتابة المباشرة بس للي لهم سياسة (جداول sf_ بس، والقديمة ما تنلمس)
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'sf\_%' loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
grant select on public.sf_settings, public.sf_cities, public.sf_categories, public.sf_families, public.sf_family_hours, public.sf_family_timeoff, public.sf_dishes to anon;
grant select, insert, update, delete on public.sf_settings, public.sf_cities, public.sf_categories, public.sf_families, public.sf_family_private, public.sf_family_hours,
  public.sf_family_timeoff, public.sf_family_docs, public.sf_dishes, public.sf_addresses, public.sf_favorites, public.sf_staff, public.sf_join_requests, public.sf_promos,
  public.sf_payouts to authenticated;
grant select, update on public.sf_profiles, public.sf_notifications, public.sf_complaints to authenticated;
grant select, delete on public.sf_devices to authenticated;
grant select on public.sf_orders, public.sf_order_events, public.sf_payments, public.sf_promo_uses, public.sf_credits, public.sf_referrals, public.sf_broadcasts, public.sf_admin_log to authenticated;
revoke all on public.sf_secrets, public.sf_rate_hits, public.sf_sms_log from anon, authenticated;
grant usage, select on sequence public.sf_family_hours_id_seq, public.sf_family_timeoff_id_seq to authenticated;

-- ───────── التحديث الحي ─────────
do $$ begin
  begin alter publication supabase_realtime add table public.sf_orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sf_order_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sf_notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sf_families; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sf_dishes; exception when duplicate_object then null; end;
end $$;

-- ───────── التخزين: صور عامة، ووثائق خاصة ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('docs', 'docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists sf_media_read on storage.objects;
drop policy if exists sf_media_write on storage.objects;
drop policy if exists sf_media_update on storage.objects;
drop policy if exists sf_media_delete on storage.objects;
drop policy if exists sf_docs_read on storage.objects;
drop policy if exists sf_docs_write on storage.objects;
drop policy if exists sf_docs_delete on storage.objects;
create policy sf_media_read on storage.objects for select using (bucket_id = 'media');
-- families/{family_id}/... للأسرة نفسها، reviews/{uid}/... للعميل، والإدارة أي مكان
create policy sf_media_write on storage.objects for insert to authenticated with check (bucket_id = 'media' and (
  (select public.sf_is_admin())
  or ((storage.foldername(name))[1] = 'families' and (storage.foldername(name))[2] = (select public.sf_my_family())::text)
  or ((storage.foldername(name))[1] = 'reviews' and (storage.foldername(name))[2] = auth.uid()::text)));
create policy sf_media_update on storage.objects for update to authenticated using (bucket_id = 'media' and (
  (select public.sf_is_admin()) or ((storage.foldername(name))[1] = 'families' and (storage.foldername(name))[2] = (select public.sf_my_family())::text)));
create policy sf_media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and (
  (select public.sf_is_admin()) or ((storage.foldername(name))[1] = 'families' and (storage.foldername(name))[2] = (select public.sf_my_family())::text)));
create policy sf_docs_read on storage.objects for select to authenticated using (bucket_id = 'docs' and (
  (select public.sf_is_admin()) or ((storage.foldername(name))[1] = 'families' and (storage.foldername(name))[2] = (select public.sf_my_family())::text)));
create policy sf_docs_write on storage.objects for insert to authenticated with check (bucket_id = 'docs' and (
  (select public.sf_is_admin()) or ((storage.foldername(name))[1] = 'families' and (storage.foldername(name))[2] = (select public.sf_my_family())::text)));
create policy sf_docs_delete on storage.objects for delete to authenticated using (bucket_id = 'docs' and (select public.sf_is_admin()));
