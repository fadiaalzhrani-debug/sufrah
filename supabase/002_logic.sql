-- ============================================================
--  سُفرة · 002_logic.sql · منطق الطلبات على الخادم
--  التسعير والمواعيد يتحسبون هنا بس (العميل يعرض، والخادم يقرر)
-- ============================================================

-- ───────── أدوات ─────────
create or replace function public.sf_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns numeric language sql immutable as $$
  select round((6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::numeric, 2)
$$;

create or replace function public.sf_local_now() returns timestamp language sql stable as $$
  select (now() at time zone 'Asia/Riyadh')
$$;

-- تحويل يوم محلي + دقائق إلى توقيت مطلق
create or replace function public.sf_at(p_day date, p_min int) returns timestamptz language sql immutable as $$
  select ((p_day::timestamp + make_interval(mins => p_min)) at time zone 'Asia/Riyadh')
$$;

create or replace function public.sf_fmt_time(p timestamptz, p_lang text default 'ar') returns text language sql immutable as $$
  select case when p is null then '' else
    ltrim(to_char(p at time zone 'Asia/Riyadh', 'FMHH12:MI'), '0') || ' ' ||
    case when extract(hour from p at time zone 'Asia/Riyadh') < 12 then case when p_lang = 'en' then 'AM' else 'ص' end
         else case when p_lang = 'en' then 'PM' else 'م' end end end
$$;

create or replace function public.sf_err(p_code text, p_ar text, p_en text) returns jsonb language sql immutable as $$
  select jsonb_build_object('code', p_code, 'ar', p_ar, 'en', p_en)
$$;

-- هل الأسرة شغالة الحين (حالة + زر الفتح + الدوام + الإجازة)
create or replace function public.sf_family_open_now(p_family uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sf_families f
     where f.id = p_family and f.status = 'active' and f.is_open
       and not exists (select 1 from public.sf_family_timeoff t where t.family_id = f.id and public.sf_local_now()::date between t.from_date and t.to_date)
       and exists (select 1 from public.sf_family_hours h where h.family_id = f.id
                    and h.dow = extract(dow from public.sf_local_now())::int
                    and (extract(hour from public.sf_local_now()) * 60 + extract(minute from public.sf_local_now()))::int >= h.open_min
                    and (extract(hour from public.sf_local_now()) * 60 + extract(minute from public.sf_local_now()))::int < h.close_min))
$$;

-- مدة التجهيز اللازمة للسلة: أكبر وقت تجهيز للأسرة أو الأطباق أو مهلة الطلب المسبق
create or replace function public.sf_lead_min(p_family uuid, p_items jsonb) returns int language plpgsql stable security definer set search_path = public as $$
declare v int; d record;
begin
  select prep_min into v from public.sf_families where id = p_family;
  v := coalesce(v, 45);
  if jsonb_typeof(p_items) = 'array' then
    for d in select ds.prep_min, ds.min_lead_hours from public.sf_dishes ds
              where ds.family_id = p_family and ds.id::text in (select it->>'dish_id' from jsonb_array_elements(p_items) it) loop
      v := greatest(v, coalesce(d.prep_min, 0), coalesce(d.min_lead_hours, 0) * 60);
    end loop;
  end if;
  return v;
end $$;

-- عدد الطلبات الحية في فترة (للسعة). الطلب اللي ينتظر الدفع يحجز مكانه لين تنتهي مهلته
create or replace function public.sf_count_orders(p_family uuid, p_from timestamptz, p_to timestamptz) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.sf_orders o
   where o.family_id = p_family and o.status not in ('cancelled', 'rejected')
     and coalesce(o.scheduled_for, o.created_at) >= p_from and coalesce(o.scheduled_for, o.created_at) < p_to
$$;

-- ───────── المواعيد المتاحة ─────────
-- يرجع: الطلب بأسرع وقت متاح أو لا (والوقت المتوقع)، والأيام بفتراتها والأماكن الباقية
create or replace function public.sf_slots(p_family uuid, p_items jsonb default null, p_fulfillment text default 'delivery') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f public.sf_families; lead int; step int := greatest(15, public.sf_setting_num('slot_minutes', 60)::int);
  deliv int := case when p_fulfillment = 'delivery' then public.sf_setting_num('delivery_eta_min', 25)::int else 0 end;
  asap_max int := public.sf_setting_num('asap_max_lead_min', 150)::int;
  now_l timestamp := public.sf_local_now(); now_min int; d date; i int; h record; w int; ws timestamptz; we timestamptz;
  days jsonb := '[]'::jsonb; wins jsonb; left_n int; day_n int; earliest timestamptz; asap jsonb; open_now boolean; today_n int;
begin
  select * into f from public.sf_families where id = p_family;
  if not found or f.status <> 'active' then return jsonb_build_object('asap', jsonb_build_object('ok', false, 'reason', 'closed'), 'days', '[]'::jsonb); end if;
  lead := public.sf_lead_min(p_family, p_items);
  now_min := (extract(hour from now_l) * 60 + extract(minute from now_l))::int;
  earliest := now() + make_interval(mins => lead + deliv);
  open_now := public.sf_family_open_now(p_family);
  today_n := public.sf_count_orders(p_family, public.sf_at(now_l::date, 0), public.sf_at(now_l::date + 1, 0));
  asap := jsonb_build_object(
    'ok', open_now and lead <= asap_max and today_n < f.daily_capacity
          and public.sf_count_orders(p_family, now() - interval '2 hours', now() + interval '2 hours') < f.slot_capacity * 2,
    'eta_min', lead + deliv,
    'eta', earliest);
  asap := asap || jsonb_build_object('reason', case when (asap->>'ok')::boolean then null
                   when not f.is_open then 'paused' when not open_now then 'closed_now' when lead > asap_max then 'needs_schedule'
                   when today_n >= f.daily_capacity then 'full_today' else 'busy' end);
  for i in 0 .. f.preorder_days loop
    d := now_l::date + i;
    continue when exists (select 1 from public.sf_family_timeoff t where t.family_id = p_family and d between t.from_date and t.to_date);
    day_n := public.sf_count_orders(p_family, public.sf_at(d, 0), public.sf_at(d + 1, 0));
    wins := '[]'::jsonb;
    for h in select open_min, close_min from public.sf_family_hours where family_id = p_family and dow = extract(dow from d)::int order by open_min loop
      w := h.open_min;
      while w + step <= h.close_min loop
        ws := public.sf_at(d, w); we := public.sf_at(d, w + step);
        if ws >= earliest then
          left_n := least(f.slot_capacity - public.sf_count_orders(p_family, ws, we), f.daily_capacity - day_n);
          wins := wins || jsonb_build_object('start', ws, 'end', we, 'from_min', w, 'to_min', w + step,
                    'label_ar', public.sf_fmt_time(ws, 'ar') || ' إلى ' || public.sf_fmt_time(we, 'ar'),
                    'label_en', public.sf_fmt_time(ws, 'en') || ' to ' || public.sf_fmt_time(we, 'en'),
                    'left', greatest(left_n, 0));
        end if;
        w := w + step;
      end loop;
    end loop;
    if jsonb_array_length(wins) > 0 then
      days := days || jsonb_build_object('date', d,
        'label_ar', case when i = 0 then 'اليوم' when i = 1 then 'بكرة' else (array['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'])[extract(dow from d)::int + 1] end,
        'label_en', case when i = 0 then 'Today' when i = 1 then 'Tomorrow' else trim(to_char(d, 'Day')) end,
        'day_label', to_char(d, 'FMDD/FMMM'), 'windows', wins);
    end if;
  end loop;
  return jsonb_build_object('asap', asap, 'lead_min', lead, 'days', days);
end $$;

-- ───────── التسعير (الأساس لعرض السعر وتنفيذ الطلب) ─────────
create or replace function public.sf__price(p jsonb, p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f public.sf_families; fp public.sf_family_private; it jsonb; d public.sf_dishes; g jsonb; ch jsonb; picked jsonb; chosen jsonb;
  errs jsonb := '[]'::jsonb; warns jsonb := '[]'::jsonb; lines jsonb := '[]'::jsonb;
  qty int; unit numeric; line_total numeric; opt_list jsonb; n_pick int; sel_ids text[];
  subtotal numeric := 0; delivery_fee numeric := 0; small_fee numeric := 0; discount numeric := 0; credit numeric := 0; vat numeric := 0; total numeric;
  dist numeric; tier jsonb; fee_found boolean; ful text := coalesce(p->>'fulfillment', 'delivery');
  lat double precision := nullif(p->>'lat', '')::double precision; lng double precision := nullif(p->>'lng', '')::double precision;
  sched timestamptz := nullif(p->>'scheduled_for', '')::timestamptz; slots jsonb; win jsonb; found_win jsonb; day_qty int; tgt_day date;
  promo_code text := upper(nullif(btrim(coalesce(p->>'promo', '')), '')); pr public.sf_promos; promo_ok jsonb := null; uses int;
  prev_orders int := 0; pay text := coalesce(p->>'pay_method', 'card'); pct numeric; commission numeric; vat_pct numeric;
  small_thr numeric := public.sf_setting_num('small_order_threshold', 0); welcome numeric := public.sf_setting_num('welcome_discount', 0);
  road numeric := public.sf_setting_num('road_factor', 1.25); bal numeric := 0; eta jsonb := null; lead int; lines_n int := 0;
begin
  select * into f from public.sf_families where id = nullif(p->>'family_id', '')::uuid;
  if not found or f.status <> 'active' then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public.sf_err('family', 'الأسرة غير متاحة', 'This kitchen is not available')));
  end if;
  select * into fp from public.sf_family_private where family_id = f.id;
  if p_uid is not null then
    select count(*) into prev_orders from public.sf_orders where user_id = p_uid and status not in ('cancelled', 'rejected', 'pending_payment');
  end if;

  -- يوم الطلب (لحد الكمية اليومية للطبق)
  tgt_day := coalesce((sched at time zone 'Asia/Riyadh')::date, public.sf_local_now()::date);

  -- الأصناف
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    errs := errs || public.sf_err('empty', 'السلة فاضية', 'Your cart is empty');
  else
    for it in select * from jsonb_array_elements(p->'items') loop
      lines_n := lines_n + 1;
      exit when lines_n > 40;
      select * into d from public.sf_dishes where id = nullif(it->>'dish_id', '')::uuid and family_id = f.id;
      if not found then errs := errs || public.sf_err('dish', 'صنف ما عاد موجود بالمنيو', 'An item is no longer on the menu'); continue; end if;
      qty := greatest(1, least(50, coalesce(nullif(it->>'qty', '')::int, 1)));
      if not d.available then errs := errs || public.sf_err('unavailable', d.name_ar || ' غير متوفر الحين', coalesce(d.name_en, d.name_ar) || ' is unavailable'); end if;
      unit := d.price; chosen := '[]'::jsonb;
      sel_ids := array(select jsonb_array_elements_text(coalesce(it->'options', '[]'::jsonb)));
      for g in select * from jsonb_array_elements(coalesce(d.options, '[]'::jsonb)) loop
        n_pick := 0;
        for ch in select * from jsonb_array_elements(coalesce(g->'choices', '[]'::jsonb)) loop
          if (ch->>'id') = any(sel_ids) then
            n_pick := n_pick + 1;
            unit := unit + greatest(coalesce((ch->>'price')::numeric, 0), 0);
            chosen := chosen || jsonb_build_object('group_ar', g->>'name_ar', 'group_en', g->>'name_en', 'id', ch->>'id',
                        'name_ar', ch->>'name_ar', 'name_en', ch->>'name_en', 'price', coalesce((ch->>'price')::numeric, 0));
          end if;
        end loop;
        if coalesce((g->>'required')::boolean, false) and n_pick = 0 then
          errs := errs || public.sf_err('option', 'اختر ' || coalesce(g->>'name_ar', 'الخيار') || ' لـ ' || d.name_ar, 'Choose ' || coalesce(g->>'name_en', g->>'name_ar', 'an option') || ' for ' || coalesce(d.name_en, d.name_ar));
        end if;
        if coalesce(g->>'type', 'single') = 'single' and n_pick > 1 then
          errs := errs || public.sf_err('option', 'اختيار واحد بس في ' || coalesce(g->>'name_ar', ''), 'Only one choice allowed in ' || coalesce(g->>'name_en', g->>'name_ar', ''));
        end if;
        if coalesce(g->>'type', 'single') = 'multi' and nullif(g->>'max', '') is not null and n_pick > (g->>'max')::int then
          errs := errs || public.sf_err('option', 'تقدر تختار ' || (g->>'max') || ' بالكثير في ' || coalesce(g->>'name_ar', ''), 'Up to ' || (g->>'max') || ' in ' || coalesce(g->>'name_en', g->>'name_ar', ''));
        end if;
      end loop;
      if d.daily_limit is not null then
        select coalesce(sum((x->>'qty')::int), 0) into day_qty
          from public.sf_orders o, jsonb_array_elements(o.items) x
         where o.family_id = f.id and o.status not in ('cancelled', 'rejected')
           and (coalesce(o.scheduled_for, o.created_at) at time zone 'Asia/Riyadh')::date = tgt_day
           and x->>'dish_id' = d.id::text;
        if day_qty + qty > d.daily_limit then
          errs := errs || public.sf_err('daily_limit', 'باقي من ' || d.name_ar || ' ' || greatest(d.daily_limit - day_qty, 0) || ' بس لهذا اليوم',
                                       'Only ' || greatest(d.daily_limit - day_qty, 0) || ' left of ' || coalesce(d.name_en, d.name_ar) || ' for that day');
        end if;
      end if;
      line_total := round(unit * qty, 2);
      subtotal := subtotal + line_total;
      lines := lines || jsonb_build_object('dish_id', d.id, 'name_ar', d.name_ar, 'name_en', d.name_en, 'image_url', d.image_url,
                 'qty', qty, 'unit_price', round(unit, 2), 'options', chosen, 'line_total', line_total,
                 'note', left(nullif(btrim(coalesce(it->>'note', '')), ''), 200));
    end loop;
  end if;

  if subtotal > 0 and subtotal < f.min_order then
    errs := errs || public.sf_err('min_order', 'أقل طلب من ' || f.name_ar || ' ' || trim(to_char(f.min_order, 'FM999990.##')) || ' ريال',
                                 'Minimum order is ' || trim(to_char(f.min_order, 'FM999990.##')) || ' SAR');
  end if;

  -- التوصيل أو الاستلام
  if ful = 'pickup' then
    if not f.pickup_enabled then errs := errs || public.sf_err('pickup', 'الأسرة ما توفر استلام من المطبخ', 'Pickup is not offered'); end if;
  else
    ful := 'delivery';
    if not f.delivery_enabled then
      errs := errs || public.sf_err('delivery', 'الأسرة ما توفر توصيل، اختر الاستلام', 'Delivery is not offered, choose pickup');
    elsif lat is null or lng is null then
      errs := errs || public.sf_err('address', 'حدد موقع التوصيل', 'Set your delivery location');
    elsif fp.lat is null or fp.lng is null then
      errs := errs || public.sf_err('kitchen_loc', 'التوصيل من هذي الأسرة غير متاح الحين', 'Delivery from this kitchen is not available yet');
    else
      dist := round(public.sf_km(fp.lat, fp.lng, lat, lng) * road, 1);
      fee_found := false;
      for tier in select * from jsonb_array_elements(f.delivery_tiers) t order by (t->>'km')::numeric loop
        if dist <= (tier->>'km')::numeric then delivery_fee := (tier->>'fee')::numeric; fee_found := true; exit; end if;
      end loop;
      if not fee_found or dist > f.delivery_max_km then
        errs := errs || public.sf_err('range', 'موقعك أبعد من مسافة توصيل الأسرة (' || trim(to_char(dist, 'FM9990.0')) || ' كم)',
                                     'Your location is outside the delivery range (' || trim(to_char(dist, 'FM9990.0')) || ' km)');
      end if;
    end if;
  end if;

  -- الوقت: بأسرع وقت أو فترة محجوزة
  slots := public.sf_slots(f.id, p->'items', ful);
  lead := (slots->>'lead_min')::int;
  if sched is null then
    if not coalesce((slots->'asap'->>'ok')::boolean, false) then
      errs := errs || case slots->'asap'->>'reason'
        when 'needs_schedule' then public.sf_err('schedule', 'هذا الطلب يحتاج حجز موعد مسبق', 'This order needs a scheduled time')
        when 'full_today' then public.sf_err('full', 'طلبات اليوم اكتملت، اختر يوم ثاني', 'Today is fully booked, pick another day')
        when 'busy' then public.sf_err('busy', 'الأسرة مشغولة الحين، اختر موعد لاحق', 'The kitchen is busy, pick a later time')
        else public.sf_err('closed', 'الأسرة مسكّرة الحين، تقدر تحجز موعد لاحق', 'The kitchen is closed now, you can schedule for later') end;
    else
      eta := jsonb_build_object('asap', true, 'eta_min', (slots->'asap'->>'eta_min')::int, 'eta', slots->'asap'->'eta');
    end if;
  else
    found_win := null;
    for win in select w from jsonb_array_elements(slots->'days') dd, jsonb_array_elements(dd->'windows') w loop
      if (win->>'start')::timestamptz = sched then found_win := win; exit; end if;
    end loop;
    if found_win is null then
      errs := errs || public.sf_err('slot', 'الموعد المختار ما عاد متاح، اختر موعد ثاني', 'That time is no longer available, pick another');
    elsif (found_win->>'left')::int <= 0 then
      errs := errs || public.sf_err('slot_full', 'الموعد المختار اكتمل، اختر موعد ثاني', 'That time is fully booked, pick another');
    else
      eta := jsonb_build_object('asap', false, 'start', found_win->'start', 'end', found_win->'end', 'label_ar', found_win->'label_ar', 'label_en', found_win->'label_en');
    end if;
  end if;

  -- رسوم الطلب الصغير
  if small_thr > 0 and subtotal > 0 and subtotal < small_thr then small_fee := public.sf_setting_num('small_order_fee', 5); end if;

  -- الكوبون أو خصم أول طلب
  if promo_code is not null then
    select * into pr from public.sf_promos where code = promo_code;
    if not found or not pr.active or (pr.starts_at is not null and now() < pr.starts_at) or (pr.ends_at is not null and now() > pr.ends_at) then
      promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'الكود غير صالح', 'en', 'Invalid code');
    elsif pr.family_id is not null and pr.family_id <> f.id then
      promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'الكود لأسرة ثانية', 'en', 'Code is for another kitchen');
    elsif subtotal < pr.min_subtotal then
      promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'الكود يحتاج طلب من ' || trim(to_char(pr.min_subtotal, 'FM999990.##')) || ' ريال', 'en', 'Needs a ' || trim(to_char(pr.min_subtotal, 'FM999990.##')) || ' SAR order');
    elsif pr.first_order_only and prev_orders > 0 then
      promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'الكود لأول طلب بس', 'en', 'First order only');
    else
      select count(*) into uses from public.sf_promo_uses where code = pr.code;
      if pr.max_uses is not null and uses >= pr.max_uses then
        promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'الكود خلص', 'en', 'Code fully used');
      else
        uses := 0;
        if p_uid is not null then select count(*) into uses from public.sf_promo_uses where code = pr.code and user_id = p_uid; end if;
        if uses >= pr.per_user then
          promo_ok := jsonb_build_object('code', promo_code, 'ok', false, 'ar', 'استخدمت الكود قبل', 'en', 'You already used this code');
        else
          discount := case when pr.kind = 'pct' then round(subtotal * pr.value / 100, 2) else pr.value end;
          if pr.max_discount is not null then discount := least(discount, pr.max_discount); end if;
          discount := least(discount, subtotal);
          promo_ok := jsonb_build_object('code', promo_code, 'ok', true, 'amount', discount, 'ar', 'تم تطبيق الكود', 'en', 'Code applied');
        end if;
      end if;
    end if;
  elsif welcome > 0 and p_uid is not null and prev_orders = 0 and subtotal > 0 then
    discount := least(welcome, subtotal);
    warns := warns || public.sf_err('welcome', 'خصم أول طلب ' || trim(to_char(discount, 'FM999990.##')) || ' ريال', 'First order discount ' || trim(to_char(discount, 'FM999990.##')) || ' SAR');
  end if;

  -- الرصيد
  if coalesce((p->>'use_credit')::boolean, false) and p_uid is not null and public.sf_setting_on('credits_enabled', false) then
    select coalesce(sum(amount), 0) into bal from public.sf_credits where user_id = p_uid;
    credit := greatest(least(bal, subtotal + delivery_fee + small_fee - discount), 0);
  end if;

  -- الضريبة (بس لو المنشأة مسجلة)
  if public.sf_setting_on('vat_registered', false) then
    vat_pct := public.sf_setting_num('vat_pct', 15);
    vat := round(greatest(subtotal + delivery_fee + small_fee - discount, 0) * vat_pct / 100, 2);
  end if;

  total := round(greatest(subtotal + delivery_fee + small_fee - discount - credit + vat, 0), 2);

  -- طريقة الدفع
  if total = 0 and subtotal > 0 then pay := 'free';
  elsif pay = 'cod' then
    if not public.sf_setting_on('pay_cod_enabled', true) then errs := errs || public.sf_err('pay', 'الدفع عند الاستلام غير متاح', 'Cash on delivery is not available');
    elsif total > public.sf_setting_num('pay_cod_max', 400) then errs := errs || public.sf_err('pay', 'الدفع عند الاستلام لحد ' || trim(to_char(public.sf_setting_num('pay_cod_max', 400), 'FM999990')) || ' ريال، ادفع بالبطاقة', 'Cash is limited to ' || trim(to_char(public.sf_setting_num('pay_cod_max', 400), 'FM999990')) || ' SAR, pay by card'); end if;
  else
    pay := 'card';
    if not public.sf_setting_on('pay_card_enabled', false) then errs := errs || public.sf_err('pay', 'الدفع بالبطاقة غير متاح الحين', 'Card payment is not available yet'); end if;
  end if;

  pct := coalesce(f.commission_pct, public.sf_setting_num('commission_pct', 12));
  commission := round(subtotal * pct / 100, 2);

  return jsonb_build_object(
    'ok', jsonb_array_length(errs) = 0, 'errors', errs, 'warnings', warns,
    'family', jsonb_build_object('id', f.id, 'name_ar', f.name_ar, 'name_en', f.name_en, 'min_order', f.min_order, 'pickup', f.pickup_enabled, 'delivery', f.delivery_enabled),
    'lines', lines, 'fulfillment', ful, 'distance_km', dist, 'lead_min', lead, 'eta', eta,
    'subtotal', round(subtotal, 2), 'delivery_fee', delivery_fee, 'small_order_fee', small_fee, 'discount', round(discount, 2),
    'promo', promo_ok, 'credit_used', round(credit, 2), 'credit_balance', round(bal, 2), 'vat', vat, 'total', total, 'pay_method', pay,
    'commission_pct', pct, 'commission', commission,
    'family_net', round(subtotal - commission + case when ful = 'delivery' then delivery_fee else 0 end, 2),
    'first_order', p_uid is not null and prev_orders = 0);
end $$;

create or replace function public.sf_quote(p jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select public.sf__price(p, auth.uid())
$$;

-- ───────── الحساب ─────────
create or replace function public.sf_me() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ph text := public.sf_uid_phone(); s public.sf_staff; pr public.sf_profiles; fam jsonb := null; code text;
begin
  if uid is null then return jsonb_build_object('uid', null); end if;
  select * into pr from public.sf_profiles where id = uid;
  if not found then
    loop
      code := 'S' || upper(substr(md5(random()::text || uid::text), 1, 6));
      exit when not exists (select 1 from public.sf_profiles where referral_code = code);
    end loop;
    insert into public.sf_profiles (id, phone, referral_code) values (uid, ph, code) on conflict (id) do nothing;
    select * into pr from public.sf_profiles where id = uid;
  elsif pr.phone is distinct from ph and ph is not null then
    update public.sf_profiles set phone = ph where id = uid;
  end if;
  select * into s from public.sf_staff where active and (user_id = uid or (user_id is null and phone = ph)) order by (user_id = uid) desc nulls last limit 1;
  if found and s.user_id is null then update public.sf_staff set user_id = uid where id = s.id; end if;
  if found and s.family_id is not null then
    select jsonb_build_object('id', f.id, 'name_ar', f.name_ar, 'name_en', f.name_en, 'status', f.status, 'logo_url', f.logo_url, 'slug', f.slug)
      into fam from public.sf_families f where f.id = s.family_id;
  end if;
  return jsonb_build_object('uid', uid, 'phone', ph,
    'profile', jsonb_build_object('name', pr.name, 'lang', pr.lang, 'marketing_ok', pr.marketing_ok, 'referral_code', pr.referral_code, 'blocked', pr.blocked),
    'role', case when s.id is null then 'customer' else s.role end, 'staff_name', s.name, 'family', fam,
    'credit', (select coalesce(sum(amount), 0) from public.sf_credits where user_id = uid));
end $$;

create or replace function public.sf_profile_save(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'SF_LOGIN'; end if;
  perform public.sf_me();
  update public.sf_profiles set
    name = coalesce(left(nullif(btrim(p->>'name'), ''), 60), name),
    lang = case when p->>'lang' in ('ar', 'en') then p->>'lang' else lang end,
    marketing_ok = coalesce((p->>'marketing_ok')::boolean, marketing_ok)
  where id = auth.uid();
  return public.sf_me();
end $$;

-- كود صديق: يُستخدم مرة وحدة قبل أول طلب
create or replace function public.sf_referral_use(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ref uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SF_LOGIN'; end if;
  if not public.sf_setting_on('referral_enabled', false) then return jsonb_build_object('ok', false, 'ar', 'برنامج الدعوة متوقف', 'en', 'Referrals are off'); end if;
  select id into ref from public.sf_profiles where referral_code = upper(btrim(p_code));
  if ref is null or ref = uid then return jsonb_build_object('ok', false, 'ar', 'الكود غير صحيح', 'en', 'Invalid code'); end if;
  if exists (select 1 from public.sf_orders where user_id = uid and status not in ('cancelled', 'rejected', 'pending_payment')) then
    return jsonb_build_object('ok', false, 'ar', 'كود الصديق لأول طلب بس', 'en', 'Only before your first order'); end if;
  insert into public.sf_referrals (referred_id, referrer_id) values (uid, ref) on conflict (referred_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'ar', 'استخدمت كود صديق قبل', 'en', 'Already used a code'); end if;
  insert into public.sf_credits (user_id, amount, reason) values (uid, public.sf_setting_num('referral_friend_credit', 10), 'referral_welcome');
  return jsonb_build_object('ok', true, 'ar', 'انضاف رصيد لحسابك', 'en', 'Credit added');
end $$;

create or replace function public.sf_device_register(p_kind text, p_token text, p_ua text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('webpush', 'fcm', 'apns') or length(coalesce(p_token, '')) < 10 or length(p_token) > 4000 then return false; end if;
  insert into public.sf_devices (user_id, kind, token, keyhash, ua) values (auth.uid(), p_kind, p_token, md5(p_token), left(p_ua, 200))
  on conflict (keyhash) do update set user_id = excluded.user_id, kind = excluded.kind, token = excluded.token, ua = excluded.ua, created_at = now();
  return true;
end $$;

create or replace function public.sf_notif_read(p_ids bigint[] default null) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.sf_notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────── تنفيذ الطلب ─────────
create or replace function public.sf_place_order(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); q jsonb; pr public.sf_profiles; nm text; ph text := public.sf_uid_phone(); o public.sf_orders; st text; ps text;
  addr jsonb := null;
begin
  if uid is null or ph is null then return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public.sf_err('login', 'سجّل دخولك برقم جوالك', 'Sign in with your phone'))); end if;
  perform public.sf_me();
  select * into pr from public.sf_profiles where id = uid;
  if pr.blocked then return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public.sf_err('blocked', 'تعذر تنفيذ الطلب، كلم الدعم', 'Unable to place order, contact support'))); end if;
  if not public.sf_rate_ok('order:' || uid, 12, interval '1 hour') then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public.sf_err('rate', 'طلبات كثير، جرّب بعد شوي', 'Too many orders, try again later'))); end if;
  q := public.sf__price(p, uid);
  if not (q->>'ok')::boolean then return q; end if;
  nm := coalesce(left(nullif(btrim(p->>'name'), ''), 60), pr.name);
  if nm is null then return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public.sf_err('name', 'اكتب اسمك', 'Enter your name'))); end if;
  if pr.name is null or pr.name <> nm then update public.sf_profiles set name = nm where id = uid; end if;
  if q->>'fulfillment' = 'delivery' then
    addr := jsonb_strip_nulls(jsonb_build_object('label', left(p->'address'->>'label', 40), 'city_id', p->'address'->>'city_id',
      'district', left(p->'address'->>'district', 80), 'street', left(p->'address'->>'street', 120), 'details', left(p->'address'->>'details', 200),
      'lat', (p->>'lat')::double precision, 'lng', (p->>'lng')::double precision));
  end if;
  st := case when q->>'pay_method' = 'card' then 'pending_payment' else 'new' end;
  ps := case when q->>'pay_method' = 'free' then 'paid' else 'unpaid' end;
  insert into public.sf_orders (user_id, family_id, customer_name, customer_phone, fulfillment, address, distance_km, scheduled_for, window_end, items,
    subtotal, delivery_fee, small_order_fee, discount, credit_used, promo_code, vat, total, commission_pct, commission, family_net,
    pay_method, pay_status, status, note, source)
  values (uid, (q->'family'->>'id')::uuid, nm, ph, q->>'fulfillment', addr, nullif(q->>'distance_km', '')::numeric,
    case when (q->'eta'->>'asap')::boolean then null else (q->'eta'->>'start')::timestamptz end,
    case when (q->'eta'->>'asap')::boolean then null else (q->'eta'->>'end')::timestamptz end,
    q->'lines', (q->>'subtotal')::numeric, (q->>'delivery_fee')::numeric, (q->>'small_order_fee')::numeric, (q->>'discount')::numeric,
    (q->>'credit_used')::numeric, case when (q->'promo'->>'ok')::boolean then q->'promo'->>'code' end, (q->>'vat')::numeric, (q->>'total')::numeric,
    (q->>'commission_pct')::numeric, (q->>'commission')::numeric, (q->>'family_net')::numeric,
    q->>'pay_method', ps, st, left(nullif(btrim(p->>'note'), ''), 300),
    case when p->>'source' in ('app', 'web', 'wa') then p->>'source' else 'app' end)
  returning * into o;
  if (q->'promo'->>'ok')::boolean then
    insert into public.sf_promo_uses (code, user_id, order_id, amount) values (q->'promo'->>'code', uid, o.id, (q->>'discount')::numeric);
  end if;
  if (q->>'credit_used')::numeric > 0 then
    insert into public.sf_credits (user_id, amount, reason, order_id) values (uid, -(q->>'credit_used')::numeric, 'order', o.id);
  end if;
  return jsonb_build_object('ok', true, 'id', o.id, 'order_no', o.order_no, 'total', o.total, 'status', o.status, 'pay_method', o.pay_method);
end $$;

-- إرجاع الرصيد والكوبون لطلب انلغى
create or replace function public.sf__release(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o public.sf_orders;
begin
  select * into o from public.sf_orders where id = p_order;
  delete from public.sf_promo_uses where order_id = p_order;
  if o.credit_used > 0 and not exists (select 1 from public.sf_credits where order_id = p_order and reason = 'order_refund') then
    insert into public.sf_credits (user_id, amount, reason, order_id) values (o.user_id, o.credit_used, 'order_refund', p_order);
  end if;
end $$;

-- تغيير الحالة الموحّد (كل الأطراف تمر من هنا)
create or replace function public.sf__set_status(p_order uuid, p_status text, p_by text, p_note text default null, p_eta_min int default null) returns public.sf_orders
language plpgsql security definer set search_path = public as $$
declare o public.sf_orders;
begin
  select * into o from public.sf_orders where id = p_order for update;
  if not found then raise exception 'SF_ORDER'; end if;
  update public.sf_orders set
    status = p_status, status_at = now(),
    accepted_at = case when p_status = 'preparing' and accepted_at is null then now() else accepted_at end,
    ready_eta = case when p_status = 'preparing' then
                  case when scheduled_for is not null then greatest(scheduled_for, now() + make_interval(mins => coalesce(p_eta_min, 30)))
                       else now() + make_interval(mins => greatest(5, least(coalesce(p_eta_min, (select prep_min from public.sf_families where id = o.family_id)), 1440))) end
                else ready_eta end,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    done_at = case when p_status in ('delivered', 'picked_up') then now() else done_at end,
    cancelled_at = case when p_status in ('cancelled', 'rejected') then now() else cancelled_at end,
    cancelled_by = case when p_status in ('cancelled', 'rejected') then p_by else cancelled_by end,
    cancel_reason = case when p_status in ('cancelled', 'rejected') then left(p_note, 300) else cancel_reason end,
    pay_status = case
      when p_status in ('cancelled', 'rejected') and pay_status = 'paid' and pay_method = 'card' then 'refund_pending'
      when p_status in ('delivered', 'picked_up') and pay_method = 'cod' then 'paid'
      else pay_status end,
    paid_amount = case when p_status in ('delivered', 'picked_up') and pay_method = 'cod' then total else paid_amount end
  where id = p_order returning * into o;
  insert into public.sf_order_events (order_id, status, by_role, note) values (p_order, p_status, p_by, left(p_note, 300));
  if p_status in ('cancelled', 'rejected') then perform public.sf__release(p_order); end if;
  if p_status in ('delivered', 'picked_up') then update public.sf_families set orders_count = orders_count + 1 where id = o.family_id; end if;
  return o;
end $$;

create or replace function public.sf_order_cancel(p_order uuid, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.sf_orders;
begin
  select * into o from public.sf_orders where id = p_order;
  if not found or o.user_id is distinct from auth.uid() then return jsonb_build_object('ok', false, 'ar', 'الطلب غير موجود', 'en', 'Order not found'); end if;
  if o.status not in ('pending_payment', 'new') then
    return jsonb_build_object('ok', false, 'ar', 'الأسرة بدأت التجهيز، اطلب الإلغاء من الدعم', 'en', 'The kitchen already started, ask support to cancel'); end if;
  o := public.sf__set_status(p_order, 'cancelled', 'customer', coalesce(nullif(btrim(p_reason), ''), 'ألغاه العميل'));
  return jsonb_build_object('ok', true, 'status', o.status, 'pay_status', o.pay_status);
end $$;

create or replace function public.sf_order_rate(p_order uuid, p_rating int, p_review text default null, p_photo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.sf_orders;
begin
  select * into o from public.sf_orders where id = p_order;
  if not found or o.user_id is distinct from auth.uid() then return jsonb_build_object('ok', false, 'ar', 'الطلب غير موجود', 'en', 'Order not found'); end if;
  if o.status not in ('delivered', 'picked_up') then return jsonb_build_object('ok', false, 'ar', 'التقييم بعد استلام الطلب', 'en', 'Rate after receiving your order'); end if;
  if p_rating not between 1 and 5 then return jsonb_build_object('ok', false, 'ar', 'اختر عدد النجوم', 'en', 'Choose a rating'); end if;
  if o.done_at < now() - interval '14 days' then return jsonb_build_object('ok', false, 'ar', 'انتهت مدة التقييم', 'en', 'Rating window has ended'); end if;
  if p_photo is not null and p_photo !~ ('^https://uzwuvzxdjijlbfguhlmc\.supabase\.co/storage/v1/object/public/media/reviews/' || auth.uid()::text || '/') then p_photo := null; end if;
  update public.sf_orders set rating = p_rating, review = left(nullif(btrim(p_review), ''), 500), review_photo = coalesce(p_photo, review_photo), reviewed_at = now()
   where id = p_order;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.sf_complaint_new(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.sf_orders; oid uuid := nullif(p->>'order_id', '')::uuid; c public.sf_complaints;
begin
  if auth.uid() is null then raise exception 'SF_LOGIN'; end if;
  if not public.sf_rate_ok('cmp:' || auth.uid(), 6, interval '1 day') then return jsonb_build_object('ok', false, 'ar', 'وصلنا كلامك، نرد عليك قريب', 'en', 'We have your message already'); end if;
  if oid is not null then
    select * into o from public.sf_orders where id = oid and user_id = auth.uid();
    if not found then return jsonb_build_object('ok', false, 'ar', 'الطلب غير موجود', 'en', 'Order not found'); end if;
  end if;
  if length(btrim(coalesce(p->>'body', ''))) < 3 then return jsonb_build_object('ok', false, 'ar', 'اكتب وش صار', 'en', 'Describe the issue'); end if;
  insert into public.sf_complaints (order_id, user_id, family_id, kind, body, photo_url)
  values (oid, auth.uid(), o.family_id, case when p->>'kind' in ('late', 'quality', 'missing', 'wrong', 'cancel', 'refund', 'payment', 'other') then p->>'kind' else 'other' end,
          left(btrim(p->>'body'), 1000), case when p->>'photo_url' ~ '^https://uzwuvzxdjijlbfguhlmc\.supabase\.co/storage/v1/object/public/media/' then p->>'photo_url' end)
  returning * into c;
  return jsonb_build_object('ok', true, 'id', c.id);
end $$;

-- طلب انضمام أسرة (بدون حساب)
create or replace function public.sf_join_submit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := public.sf_norm_phone(p->>'phone'); r public.sf_join_requests;
begin
  if ph is null then return jsonb_build_object('ok', false, 'ar', 'رقم الجوال غير صحيح', 'en', 'Invalid phone number'); end if;
  if length(btrim(coalesce(p->>'name', ''))) < 2 or length(btrim(coalesce(p->>'kitchen_name', ''))) < 2 then
    return jsonb_build_object('ok', false, 'ar', 'اكتب اسمك واسم مطبخك', 'en', 'Enter your name and kitchen name'); end if;
  if not public.sf_rate_ok('join:' || ph, 3, interval '1 day') or not public.sf_rate_ok('join:all', 300, interval '1 hour') then
    return jsonb_build_object('ok', false, 'ar', 'وصلنا طلبك، نتواصل معك قريب', 'en', 'We have your request already'); end if;
  insert into public.sf_join_requests (phone, name, kitchen_name, city_id, district, cuisines, specialties, has_license, license_kind, instagram, notes)
  values (ph, left(btrim(p->>'name'), 60), left(btrim(p->>'kitchen_name'), 60),
          (select id from public.sf_cities where id = p->>'city_id'), left(p->>'district', 60),
          coalesce(array(select left(x, 30) from jsonb_array_elements_text(coalesce(p->'cuisines', '[]'::jsonb)) x limit 8), '{}'),
          left(p->>'specialties', 500), coalesce((p->>'has_license')::boolean, false), left(p->>'license_kind', 40),
          left(p->>'instagram', 60), left(p->>'notes', 500))
  returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;

-- ───────── تطبيق الأسرة ─────────
create or replace function public.sf_family_set_status(p_order uuid, p_status text, p_eta_min int default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.sf_orders; fam uuid := public.sf_my_family(); adm boolean := public.sf_is_admin(); ok boolean := false;
begin
  select * into o from public.sf_orders where id = p_order;
  if not found or not (o.family_id = fam or adm) then return jsonb_build_object('ok', false, 'ar', 'الطلب غير موجود', 'en', 'Order not found'); end if;
  ok := case
    when o.status = 'new' and p_status in ('preparing', 'rejected') then true
    when o.status = 'preparing' and p_status in ('ready', 'cancelled') then true
    when o.status = 'ready' and o.fulfillment = 'delivery' and p_status in ('on_the_way', 'delivered', 'cancelled') then true
    when o.status = 'ready' and o.fulfillment = 'pickup' and p_status in ('picked_up', 'cancelled') then true
    when o.status = 'on_the_way' and p_status = 'delivered' then true
    else false end;
  if not ok then return jsonb_build_object('ok', false, 'ar', 'ما تقدر تغيّر الطلب لهالحالة الحين', 'en', 'Status change not allowed', 'status', o.status); end if;
  if p_status in ('rejected', 'cancelled') and length(btrim(coalesce(p_reason, ''))) < 2 then
    return jsonb_build_object('ok', false, 'ar', 'اكتب سبب الاعتذار للعميل', 'en', 'Write a reason for the customer'); end if;
  o := public.sf__set_status(p_order, p_status, case when adm and o.family_id is distinct from fam then 'admin' else 'family' end, p_reason, p_eta_min);
  return jsonb_build_object('ok', true, 'status', o.status, 'ready_eta', o.ready_eta);
end $$;

create or replace function public.sf_family_reply(p_order uuid, p_reply text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.sf_orders set family_reply = left(nullif(btrim(p_reply), ''), 300)
   where id = p_order and family_id = public.sf_my_family() and rating is not null;
  return jsonb_build_object('ok', found);
end $$;

-- إعدادات المطبخ من الأسرة نفسها (الحقول المسموحة بس)
create or replace function public.sf_family_save(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid := coalesce(case when public.sf_is_admin() then nullif(p->>'family_id', '')::uuid end, public.sf_my_family()); f public.sf_families;
begin
  if fam is null then raise exception 'SF_FORBIDDEN'; end if;
  update public.sf_families set
    name_ar = coalesce(left(nullif(btrim(p->>'name_ar'), ''), 60), name_ar),
    name_en = case when p ? 'name_en' then left(nullif(btrim(p->>'name_en'), ''), 60) else name_en end,
    bio_ar = case when p ? 'bio_ar' then left(nullif(btrim(p->>'bio_ar'), ''), 400) else bio_ar end,
    bio_en = case when p ? 'bio_en' then left(nullif(btrim(p->>'bio_en'), ''), 400) else bio_en end,
    logo_url = case when p ? 'logo_url' then nullif(p->>'logo_url', '') else logo_url end,
    cover_url = case when p ? 'cover_url' then nullif(p->>'cover_url', '') else cover_url end,
    district = case when p ? 'district' then left(nullif(btrim(p->>'district'), ''), 60) else district end,
    city_id = case when p ? 'city_id' and exists (select 1 from public.sf_cities where id = p->>'city_id') then p->>'city_id' else city_id end,
    is_open = coalesce((p->>'is_open')::boolean, is_open),
    -- الحقل الغايب يبقى على قيمته: greatest/least تتجاهل null، فبدون case كان أي حفظ جزئي يرجّعها للحد الأدنى
    prep_min = case when nullif(p->>'prep_min', '') is null then prep_min else least(greatest((p->>'prep_min')::int, 5), 1440) end,
    min_order = case when nullif(p->>'min_order', '') is null then min_order else greatest((p->>'min_order')::numeric, 0) end,
    pickup_enabled = coalesce((p->>'pickup_enabled')::boolean, pickup_enabled),
    delivery_enabled = coalesce((p->>'delivery_enabled')::boolean, delivery_enabled),
    delivery_max_km = case when nullif(p->>'delivery_max_km', '') is null then delivery_max_km else least(greatest((p->>'delivery_max_km')::numeric, 1), 60) end,
    delivery_tiers = case when jsonb_typeof(p->'delivery_tiers') = 'array' and jsonb_array_length(p->'delivery_tiers') between 1 and 8
                     then (select jsonb_agg(jsonb_build_object('km', least(greatest((t->>'km')::numeric, 0.5), 60), 'fee', least(greatest((t->>'fee')::numeric, 0), 200)) order by (t->>'km')::numeric)
                             from jsonb_array_elements(p->'delivery_tiers') t)
                     else delivery_tiers end,
    slot_capacity = case when nullif(p->>'slot_capacity', '') is null then slot_capacity else least(greatest((p->>'slot_capacity')::int, 1), 200) end,
    daily_capacity = case when nullif(p->>'daily_capacity', '') is null then daily_capacity else least(greatest((p->>'daily_capacity')::int, 1), 2000) end,
    preorder_days = case when nullif(p->>'preorder_days', '') is null then preorder_days else least(greatest((p->>'preorder_days')::int, 0), 30) end,
    cuisines = case when jsonb_typeof(p->'cuisines') = 'array' then array(select left(x, 30) from jsonb_array_elements_text(p->'cuisines') x limit 8) else cuisines end,
    tags = case when jsonb_typeof(p->'tags') = 'array' then array(select left(x, 30) from jsonb_array_elements_text(p->'tags') x limit 8) else tags end
  where id = fam returning * into f;
  if p ? 'private' and jsonb_typeof(p->'private') = 'object' then
    insert into public.sf_family_private (family_id) values (fam) on conflict (family_id) do nothing;
    update public.sf_family_private set
      phone = case when p->'private' ? 'phone' then public.sf_norm_phone(p->'private'->>'phone') else phone end,
      whatsapp = case when p->'private' ? 'whatsapp' then public.sf_norm_phone(p->'private'->>'whatsapp') else whatsapp end,
      lat = case when p->'private' ? 'lat' then nullif(p->'private'->>'lat', '')::double precision else lat end,
      lng = case when p->'private' ? 'lng' then nullif(p->'private'->>'lng', '')::double precision else lng end,
      address_text = case when p->'private' ? 'address_text' then left(p->'private'->>'address_text', 200) else address_text end,
      iban = case when p->'private' ? 'iban' then upper(regexp_replace(coalesce(p->'private'->>'iban', ''), '\s', '', 'g')) else iban end,
      iban_name = case when p->'private' ? 'iban_name' then left(p->'private'->>'iban_name', 80) else iban_name end,
      owner_name = case when p->'private' ? 'owner_name' then left(p->'private'->>'owner_name', 80) else owner_name end
    where family_id = fam;
  end if;
  return to_jsonb(f);
end $$;

create or replace function public.sf_family_hours_save(p jsonb, p_family uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid := coalesce(case when public.sf_is_admin() then p_family end, public.sf_my_family()); h jsonb;
begin
  if fam is null then raise exception 'SF_FORBIDDEN'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 21 then raise exception 'SF_BAD'; end if;
  delete from public.sf_family_hours where family_id = fam;
  for h in select * from jsonb_array_elements(p) loop
    if (h->>'dow')::int between 0 and 6 and (h->>'open_min')::int >= 0 and (h->>'close_min')::int <= 1440 and (h->>'close_min')::int > (h->>'open_min')::int then
      insert into public.sf_family_hours (family_id, dow, open_min, close_min) values (fam, (h->>'dow')::int, (h->>'open_min')::int, (h->>'close_min')::int);
    end if;
  end loop;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by dow, open_min), '[]'::jsonb) from public.sf_family_hours x where family_id = fam);
end $$;

-- حساب الأسرة: المبيعات والعمولة وصافيها، والرصيد التراكمي مع التحويلات
create or replace function public.sf_family_finance(p_from date, p_to date, p_family uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare fam uuid := coalesce(case when public.sf_is_admin() then p_family end, public.sf_my_family()); r jsonb; bal numeric;
begin
  if fam is null then raise exception 'SF_FORBIDDEN'; end if;
  with o as (
    select * from public.sf_orders where family_id = fam and status in ('delivered', 'picked_up') and not is_test
       and (done_at at time zone 'Asia/Riyadh')::date between p_from and p_to)
  select jsonb_build_object(
    'orders', count(*), 'subtotal', coalesce(sum(subtotal), 0), 'delivery_fees', coalesce(sum(case when fulfillment = 'delivery' then delivery_fee else 0 end), 0),
    'commission', coalesce(sum(commission), 0), 'net', coalesce(sum(family_net), 0),
    'card_net', coalesce(sum(case when pay_method in ('card', 'free') then family_net else 0 end), 0),
    'cod_total', coalesce(sum(case when pay_method = 'cod' then total else 0 end), 0),
    'cod_commission', coalesce(sum(case when pay_method = 'cod' then total - family_net else 0 end), 0),
    'avg_rating', (select round(avg(rating)::numeric, 2) from o where rating is not null),
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', dd, 'orders', n, 'net', s) order by dd) from (
       select (done_at at time zone 'Asia/Riyadh')::date dd, count(*) n, sum(family_net) s from o group by 1) z), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', nm, 'qty', q) order by q desc) from (
       select x->>'name_ar' nm, sum((x->>'qty')::int) q from o, jsonb_array_elements(o.items) x group by 1 order by 2 desc limit 5) t), '[]'::jsonb))
  into r from o;
  -- الرصيد: صافي طلبات البطاقة لها، وعمولة طلبات الكاش عليها، ناقص اللي تحولت لها
  select coalesce(sum(case when pay_method in ('card', 'free') then family_net when pay_method = 'cod' then -(total - family_net) else 0 end), 0)
         - coalesce((select sum(amount) from public.sf_payouts where family_id = fam), 0)
    into bal from public.sf_orders where family_id = fam and status in ('delivered', 'picked_up') and not is_test;
  return r || jsonb_build_object('balance', round(bal, 2),
    'payouts', coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from public.sf_payouts where family_id = fam order by created_at desc limit 20) x), '[]'::jsonb));
end $$;

-- ───────── الإدارة ─────────
create or replace function public.sf__log(p_action text, p_target text, p_data jsonb default null) returns void language sql security definer set search_path = public as $$
  insert into public.sf_admin_log (actor, action, target, data) values (auth.uid(), p_action, p_target, p_data)
$$;

create or replace function public.sf_admin_stats(p_from date, p_to date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  with o as (select * from public.sf_orders where not is_test and (created_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
       ok as (select * from o where status in ('delivered', 'picked_up'))
  select jsonb_build_object(
    'orders', (select count(*) from o where status <> 'pending_payment'),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from o group by status) s), '{}'::jsonb),
    'done', (select count(*) from ok),
    'gmv', (select coalesce(sum(total), 0) from ok),
    'subtotal', (select coalesce(sum(subtotal), 0) from ok),
    'commission', (select coalesce(sum(commission), 0) from ok),
    'small_fees', (select coalesce(sum(small_order_fee), 0) from ok),
    'discounts', (select coalesce(sum(discount + credit_used), 0) from ok),
    'platform_net', (select coalesce(sum(commission + small_order_fee - discount - credit_used), 0) from ok),
    'card_paid', (select coalesce(sum(paid_amount), 0) from o where pay_method = 'card' and pay_status in ('paid', 'refund_pending')),
    'cod_total', (select coalesce(sum(total), 0) from ok where pay_method = 'cod'),
    'avg_order', (select round(coalesce(avg(total), 0), 2) from ok),
    'customers', (select count(distinct user_id) from ok),
    'new_customers', (select count(*) from public.sf_profiles where (created_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
    'rejected', (select count(*) from o where status = 'rejected'),
    'cancelled', (select count(*) from o where status = 'cancelled'),
    'avg_rating', (select round(avg(rating)::numeric, 2) from ok where rating is not null),
    'top_families', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name_ar, 'orders', n, 'gmv', g) order by g desc) from (
        select f.id, f.name_ar, count(*) n, sum(ok.total) g from ok join public.sf_families f on f.id = ok.family_id group by 1, 2 order by 4 desc limit 8) t), '[]'::jsonb),
    'top_dishes', coalesce((select jsonb_agg(jsonb_build_object('name', nm, 'qty', q) order by q desc) from (
        select x->>'name_ar' nm, sum((x->>'qty')::int) q from ok, jsonb_array_elements(ok.items) x group by 1 order by 2 desc limit 8) t), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', dd, 'orders', n, 'gmv', g) order by dd) from (
        select (created_at at time zone 'Asia/Riyadh')::date dd, count(*) n, sum(total) g from ok group by 1) z), '[]'::jsonb),
    'open_complaints', (select count(*) from public.sf_complaints where status in ('open', 'in_progress')),
    'join_new', (select count(*) from public.sf_join_requests where status = 'new'),
    'live', (select count(*) from public.sf_orders where status in ('new', 'preparing', 'ready', 'on_the_way') and not is_test))
  into r;
  return r;
end $$;

-- كشف حساب كل الأسر: لها (بطاقة) وعليها (عمولة الكاش) والتحويلات والرصيد
create or replace function public.sf_admin_finance(p_from date, p_to date) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.balance desc) from (
    select f.id, f.name_ar, f.status,
      count(o.id) filter (where (o.done_at at time zone 'Asia/Riyadh')::date between p_from and p_to) as orders,
      coalesce(sum(o.subtotal) filter (where (o.done_at at time zone 'Asia/Riyadh')::date between p_from and p_to), 0) as subtotal,
      coalesce(sum(o.commission) filter (where (o.done_at at time zone 'Asia/Riyadh')::date between p_from and p_to), 0) as commission,
      coalesce(sum(o.family_net) filter (where (o.done_at at time zone 'Asia/Riyadh')::date between p_from and p_to), 0) as net,
      coalesce(sum(case when o.pay_method in ('card', 'free') then o.family_net when o.pay_method = 'cod' then -(o.total - o.family_net) else 0 end), 0)
        - coalesce((select sum(amount) from public.sf_payouts po where po.family_id = f.id), 0) as balance,
      coalesce((select sum(amount) from public.sf_payouts po where po.family_id = f.id), 0) as paid_out,
      (select p.iban from public.sf_family_private p where p.family_id = f.id) as iban
    from public.sf_families f
    left join public.sf_orders o on o.family_id = f.id and o.status in ('delivered', 'picked_up') and not o.is_test
    group by f.id) x), '[]'::jsonb);
end $$;

create or replace function public.sf_admin_family_create(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.sf_families; ph text := public.sf_norm_phone(p->>'owner_phone'); slug text; d int;
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if ph is null then return jsonb_build_object('ok', false, 'ar', 'رقم جوال الأسرة غير صحيح', 'en', 'Invalid owner phone'); end if;
  if exists (select 1 from public.sf_staff where phone = ph) then return jsonb_build_object('ok', false, 'ar', 'الرقم مسجل في حساب ثاني', 'en', 'Phone already linked to an account'); end if;
  if length(btrim(coalesce(p->>'name_ar', ''))) < 2 then return jsonb_build_object('ok', false, 'ar', 'اكتب اسم المطبخ', 'en', 'Enter the kitchen name'); end if;
  slug := lower(regexp_replace(coalesce(nullif(p->>'slug', ''), 'k' || substr(md5(random()::text), 1, 6)), '[^a-zA-Z0-9-]', '', 'g'));
  insert into public.sf_families (slug, name_ar, name_en, bio_ar, city_id, district, status, cuisines, commission_pct)
  values (slug, left(btrim(p->>'name_ar'), 60), left(nullif(btrim(p->>'name_en'), ''), 60), left(p->>'bio_ar', 400),
          (select id from public.sf_cities where id = p->>'city_id'), left(p->>'district', 60),
          case when p->>'status' in ('pending', 'active') then p->>'status' else 'active' end,
          coalesce(array(select jsonb_array_elements_text(coalesce(p->'cuisines', '[]'::jsonb))), '{}'),
          nullif(p->>'commission_pct', '')::numeric)
  returning * into f;
  insert into public.sf_family_private (family_id, phone, owner_name) values (f.id, ph, left(p->>'owner_name', 80));
  insert into public.sf_staff (phone, name, role, family_id) values (ph, left(coalesce(p->>'owner_name', f.name_ar), 60), 'family_owner', f.id);
  -- دوام افتراضي: كل الأيام 11 الصباح إلى 10 الليل
  for d in 0 .. 6 loop insert into public.sf_family_hours (family_id, dow, open_min, close_min) values (f.id, d, 660, 1320); end loop;
  perform public.sf__log('family_create', f.id::text, p - 'owner_phone');
  return jsonb_build_object('ok', true, 'id', f.id, 'slug', f.slug);
end $$;

create or replace function public.sf_admin_join_decide(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.sf_join_requests; res jsonb;
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  select * into r from public.sf_join_requests where id = p_id for update;
  if not found or r.status <> 'new' then return jsonb_build_object('ok', false, 'ar', 'الطلب انقرر قبل', 'en', 'Already decided'); end if;
  if p_approve then
    res := public.sf_admin_family_create(jsonb_build_object('name_ar', r.kitchen_name, 'owner_phone', r.phone, 'owner_name', r.name,
             'city_id', r.city_id, 'district', r.district, 'cuisines', to_jsonb(r.cuisines), 'bio_ar', r.specialties, 'status', 'pending'));
    if not (res->>'ok')::boolean then return res; end if;
    update public.sf_join_requests set status = 'approved', admin_note = p_note, decided_at = now(), family_id = (res->>'id')::uuid where id = p_id;
  else
    update public.sf_join_requests set status = 'rejected', admin_note = p_note, decided_at = now() where id = p_id;
    res := jsonb_build_object('ok', true);
  end if;
  perform public.sf__log(case when p_approve then 'join_approve' else 'join_reject' end, p_id::text, jsonb_build_object('note', p_note));
  return res;
end $$;

create or replace function public.sf_admin_order_action(p_order uuid, p_action text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.sf_orders;
begin
  if not public.sf_is_admin() then raise exception 'SF_FORBIDDEN'; end if;
  select * into o from public.sf_orders where id = p_order;
  if not found then return jsonb_build_object('ok', false, 'ar', 'الطلب غير موجود', 'en', 'Order not found'); end if;
  if p_action = 'cancel' then
    if o.status in ('cancelled', 'rejected', 'delivered', 'picked_up') then return jsonb_build_object('ok', false, 'ar', 'الطلب منتهي', 'en', 'Order is closed'); end if;
    o := public.sf__set_status(p_order, 'cancelled', 'admin', coalesce(nullif(btrim(p_note), ''), 'ألغته الإدارة'));
  elsif p_action like 'status:%' then
    o := public.sf__set_status(p_order, substr(p_action, 8), 'admin', p_note);
  elsif p_action = 'refund' then
    if o.pay_method <> 'card' or o.pay_status <> 'paid' then return jsonb_build_object('ok', false, 'ar', 'الطلب ما فيه دفعة بطاقة للاسترجاع', 'en', 'No card payment to refund'); end if;
    update public.sf_orders set pay_status = 'refund_pending' where id = p_order returning * into o;
    insert into public.sf_order_events (order_id, status, by_role, note) values (p_order, 'refund_requested', 'admin', p_note);
  elsif p_action = 'mark_paid' then
    update public.sf_orders set pay_status = 'paid', paid_amount = total where id = p_order returning * into o;
    insert into public.sf_order_events (order_id, status, by_role, note) values (p_order, 'marked_paid', 'admin', p_note);
  elsif p_action = 'hide_review' or p_action = 'show_review' then
    update public.sf_orders set review_hidden = (p_action = 'hide_review') where id = p_order returning * into o;
  elsif p_action = 'test' then
    update public.sf_orders set is_test = not is_test where id = p_order returning * into o;
  elsif p_action = 'note' then
    insert into public.sf_order_events (order_id, status, by_role, note) values (p_order, 'note', 'admin', left(p_note, 300));
  else
    return jsonb_build_object('ok', false, 'ar', 'إجراء غير معروف', 'en', 'Unknown action');
  end if;
  perform public.sf__log('order_' || split_part(p_action, ':', 1), p_order::text, jsonb_build_object('action', p_action, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', o.status, 'pay_status', o.pay_status);
end $$;

create or replace function public.sf_admin_settings_save(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  for k, v in select key, value from jsonb_each_text(p) loop
    insert into public.sf_settings (key, value) values (left(k, 60), left(v, 4000))
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end loop;
  perform public.sf__log('settings', null, p);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.sf_admin_staff_save(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := public.sf_norm_phone(p->>'phone'); s public.sf_staff;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if ph is null then return jsonb_build_object('ok', false, 'ar', 'رقم الجوال غير صحيح', 'en', 'Invalid phone'); end if;
  if p->>'role' not in ('admin', 'support', 'family_owner', 'family_staff', 'driver') then return jsonb_build_object('ok', false, 'ar', 'الدور غير صحيح', 'en', 'Invalid role'); end if;
  insert into public.sf_staff (phone, name, role, family_id, active)
  values (ph, left(p->>'name', 60), p->>'role', nullif(p->>'family_id', '')::uuid, coalesce((p->>'active')::boolean, true))
  on conflict (phone) do update set name = excluded.name, role = excluded.role, family_id = excluded.family_id, active = excluded.active
  returning * into s;
  perform public.sf__log('staff_save', s.id::text, p);
  return jsonb_build_object('ok', true, 'id', s.id);
end $$;

create or replace function public.sf_admin_payout(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare po public.sf_payouts;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if nullif(p->>'amount', '')::numeric is null or (p->>'amount')::numeric = 0 then return jsonb_build_object('ok', false, 'ar', 'اكتب المبلغ', 'en', 'Enter the amount'); end if;
  insert into public.sf_payouts (family_id, amount, period_from, period_to, method, ref, note, created_by)
  values ((p->>'family_id')::uuid, round((p->>'amount')::numeric, 2), nullif(p->>'period_from', '')::date, nullif(p->>'period_to', '')::date,
          left(p->>'method', 30), left(p->>'ref', 60), left(p->>'note', 200), auth.uid())
  returning * into po;
  perform public.sf__log('payout', po.family_id::text, to_jsonb(po));
  return jsonb_build_object('ok', true, 'id', po.id);
end $$;

-- إشعار جماعي: صفوف إشعار داخل التطبيق لكل المستلمين، والإرسال للجوالات يكمل من دالة notify
create or replace function public.sf_admin_broadcast(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.sf_broadcasts; n int := 0;
begin
  if not public.sf_is_owner_admin() then raise exception 'SF_FORBIDDEN'; end if;
  if length(btrim(coalesce(p->>'title', ''))) < 2 or p->>'audience' not in ('customers', 'families', 'all') then
    return jsonb_build_object('ok', false, 'ar', 'اكتب العنوان واختر المستلمين', 'en', 'Enter a title and audience'); end if;
  insert into public.sf_broadcasts (audience, title, body, link, created_by)
  values (p->>'audience', left(btrim(p->>'title'), 80), left(p->>'body', 300), left(p->>'link', 300), auth.uid()) returning * into b;
  insert into public.sf_notifications (user_id, title, body, link, kind)
  select u, b.title, b.body, b.link, 'broadcast' from (
    select pr.id u from public.sf_profiles pr where b.audience in ('customers', 'all') and pr.marketing_ok and not pr.blocked
      and not exists (select 1 from public.sf_staff s where s.user_id = pr.id)
    union
    select s.user_id from public.sf_staff s where b.audience in ('families', 'all') and s.active and s.user_id is not null and s.family_id is not null) t;
  get diagnostics n = row_count;
  update public.sf_broadcasts set recipients = n where id = b.id;
  perform public.sf__log('broadcast', b.id::text, p);
  return jsonb_build_object('ok', true, 'id', b.id, 'recipients', n);
end $$;

-- ───────── تحقق من خيارات الطبق ─────────
create or replace function public.sf_dishes_check() returns trigger language plpgsql as $$
declare g jsonb; ch jsonb; out_g jsonb := '[]'::jsonb; out_c jsonb; gi int := 0; ci int;
begin
  if jsonb_typeof(new.options) <> 'array' then new.options := '[]'::jsonb; end if;
  for g in select * from jsonb_array_elements(new.options) loop
    gi := gi + 1; exit when gi > 8;
    out_c := '[]'::jsonb; ci := 0;
    for ch in select * from jsonb_array_elements(coalesce(g->'choices', '[]'::jsonb)) loop
      ci := ci + 1; exit when ci > 20;
      continue when length(btrim(coalesce(ch->>'name_ar', ''))) = 0;
      out_c := out_c || jsonb_build_object('id', coalesce(nullif(ch->>'id', ''), 'c' || substr(md5(random()::text), 1, 6)),
        'name_ar', left(btrim(ch->>'name_ar'), 40), 'name_en', left(nullif(btrim(coalesce(ch->>'name_en', '')), ''), 40),
        'price', round(greatest(coalesce(nullif(ch->>'price', '')::numeric, 0), 0), 2));
    end loop;
    continue when jsonb_array_length(out_c) = 0;
    out_g := out_g || jsonb_build_object('id', coalesce(nullif(g->>'id', ''), 'g' || substr(md5(random()::text), 1, 6)),
      'name_ar', left(btrim(coalesce(g->>'name_ar', 'خيار')), 40), 'name_en', left(nullif(btrim(coalesce(g->>'name_en', '')), ''), 40),
      'type', case when g->>'type' = 'multi' then 'multi' else 'single' end,
      'required', coalesce((g->>'required')::boolean, false),
      'max', case when g->>'type' = 'multi' and nullif(g->>'max', '') is not null then least(greatest((g->>'max')::int, 1), 20) end,
      'choices', out_c);
  end loop;
  new.options := out_g;
  -- علامة التجريبي ما تتغير إلا من الإدارة أو الخادم
  if auth.uid() is not null and not public.sf_is_admin() then new.is_demo := coalesce(old.is_demo, false); end if;
  return new;
end $$;
drop trigger if exists sf_dishes_check on public.sf_dishes;
create trigger sf_dishes_check before insert or update on public.sf_dishes for each row execute function public.sf_dishes_check();
