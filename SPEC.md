# سُفرة (Sufrah) — Product & Build Spec

A marketplace where **home-based productive families (الأسر المنتجة)** in Saudi Arabia sell home-cooked food, and customers order it for **delivery by the family** or **pickup**. The owner (Fadia, non-technical, Arabic) adds families, sets fees, and runs everything from an admin panel. It is the food-world twin of her home-maintenance platform **خافِت (Khafet)**: same depth of features (OTP login, server-side pricing, live order tracking, family/provider app, admin panel with settings + finance, payments, invoices, ratings, complaints, notifications, i18n), but a **completely different look**.

Folder: `J:\videos\t-claudyy\sufrah-app` (static HTML/CSS/JS, no build step). Backend: Supabase project `uzwuvzxdjijlbfguhlmc` (already built and tested, see "Backend").

---

## 0. Hard rules (read first)

1. **Arabic first, RTL**, with a full English mode. Every visible string goes through `SF.t('عربي', 'English')`. Data fields have `_ar` / `_en`; render with `SF.nm(row, 'name')`, `SF.nm(row, 'desc')`, `SF.nm(row, 'bio')`.
2. **Arabic copy style**: short, warm Saudi-neutral wording, generic/masculine-default address (e.g. «اختر»، «أضف»، «طلبك»). Never feminine-only address. **Never use the em dash (—) or en dash (–) in UI text**; use commas, «·» or separate sentences. No emojis in the UI (use the SVG icons from `SF.icon(name)`). No legal disclaimers or "this is a demo" notes in customer screens.
3. **Use the shared design system** `css/sufrah.css` + `js/core.js`. Don't edit those two files (other agents depend on them); put app-specific CSS/JS in your own files. If something is missing from core, implement it locally in your app file.
4. **Clear fonts**: Alexandria (headings, `var(--f-head)`) + IBM Plex Sans Arabic (body). Already imported by sufrah.css.
5. **Mobile-first** (360px wide must look great), then a proper desktop layout (≥900px). No horizontal page scroll. Tap targets ≥ 44px.
6. **Both themes**: the tokens already switch with `prefers-color-scheme`; only use CSS variables for colors (never hard-coded hex in components, except photos/overlays).
7. **Security**: the browser only has the public key. All writes go through RPCs or RLS-protected tables listed below. Never trust client prices; always show prices from `sf_quote`.
8. **Keep it simple for the owner**: big clear numbers, few cards per screen, short helper text.
9. Keep files reasonable: one HTML + one JS + one CSS per app. Vanilla JS (ES2020), no frameworks. supabase-js from CDN: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>` then `js/config.js` then `js/core.js` then your app JS.
10. Leaflet for maps: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` + `.js`, OSM tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with attribution. Pin = fixed center pin (`.map-box .pin`) and read `map.getCenter()`.

---

## 1. Design system (already in `css/sufrah.css`)

Palette: deep **pomegranate** brand (`--brand`), saffron accent (`--saffron`, use sparingly: highlights only), plum-tinted neutrals. Signature element: the **Sadu band** (`<div class="sadu"></div>`) — Najdi weaving pattern; use it once per screen at most (top of home hero, splash, family page header bottom edge, invoice header). Don't scatter it.

Key classes (see the CSS for all):
- Layout: `.app`, `.topbar > .topbar-in`, `.brand` (img `img/mark.svg` + text «سُفرة»), `.page` (`.narrow`), `.section`, `.section-head`, `.bottomnav > .bottomnav-in > button(.is-active)` with `.count`.
- Buttons: `.btn` + `.btn-primary | .btn-soft | .btn-ghost | .btn-danger | .btn-ok`, sizes `.btn-sm | .btn-lg`, `.btn-block`, `.icon-btn(.solid)` with `.badge-dot`, `button.link`.
- Forms: `.field > span + .input|.select|.textarea`, `.input-group > .addon + .input` (phone +966), `.otp > input×6`, `.seg > button.is-active` (segmented), `.switch > input + span`, `.choice` (radio/checkbox card, `.is-active`, `.is-off`).
- Chips: `.chips > .chip(.is-active)`, category tiles `.cat > .ph > img + span`.
- Badges: `.badge` + `.b-ok | .b-warn | .b-bad | .b-info | .b-brand | .b-dark`; order status badge = `SF.statusBadge(status, fulfillment)` (classes `.st-<status>`).
- Rating: `.stars` (+ `SF.icon('star')`), picker `.rate-pick > button(.on)`.
- Cards: `.card(.pad)`, family card `.fam-card` (`.cover > img + .badges + .logo` / `.body > h3 + .meta`), `.fam-grid`, dish row `.dish` (`.txt` + `.ph > img + .add + .incart`), `.dish-grid > .dish-tile`, `.price` / `.price-old`, `.qty(.lg) > button + span + button`.
- Overlays: `SF.openSheet(html, {onClose, sticky})` returns `{close, sh}`; inside use `.sheet-head`, `.sheet-foot` (sticky footer), `.hero-img`, `[data-close]` closes. `SF.confirm({title, body, ok, danger, input:{placeholder, required}})` → Promise.
- Feedback: `SF.toast(msg, 'ok'|'bad')`, `.empty > .art + h3 + p`, `.skel`, `.notice(.info|.bad|.ok)`.
- Order UI: `.timeline > .tl-step(.done|.now|.todo) > .tl-dot + div`, `.sum > .r(.disc|.total)`.
- Data UI: `.stats > .stat(.hl) > small + b`, `.table-wrap > table.t`.
- Splash: `<div class="splash"><div class="in"><img src="img/mark.svg"><div class="word">سُفرة</div><div class="band"></div></div></div>` then `SF.splash(1500)` after first data load (only first visit per session shows full length).
- Icons: `SF.icon(name, 's'|'l')` → inline SVG. Names: home search bag receipt user bell heart star clock pin bike store plus minus x check chevL chevR chevD arrowL arrowR globe phone chat edit trash camera image menu settings chart wallet users dish filter info alert logout power calendar refresh send copy share eye truck gift tag shield file download upload nav list sun moon flame leaf sparkle whatsapp lock box door. In RTL, add class `flip` to directional arrows/chevrons when needed.

Photos: food photos are real photos. Demo items use relative paths `img/demo/*.webp` stored in `image_url`/`cover_url`/`logo_url`; family uploads are absolute Supabase Storage URLs. Always `loading="lazy"` and give a graceful fallback (a soft brand-tinted block with `SF.icon('dish')`) when the URL is empty or fails (`onerror`).

---

## 2. Shared JS API (`js/core.js` → `window.SF`)

- `SF.sb` supabase client. `SF.rpc(name, args)` → data, throws Error with `.text` (localized message).
- `SF.msgOf(result)` → localized first error from `{errors:[{ar,en}]}` or `{ar,en}`.
- `SF.auth.sendCode(phone)` (Saudi 05…; throws `.text`), `SF.auth.verify(phone, code)`, `SF.auth.session()`, `SF.auth.user()`, `SF.auth.signOut()`, `SF.auth.onChange(cb)`.
- `SF.me(force)` → `sf_me()` result: `{uid, phone, role: guest|customer|admin|support|family_owner|family_staff|driver, profile:{name,lang,marketing_ok,referral_code,blocked}, family:{id,name_ar,...}|null, credit}`.
- `SF.loadSettings()` → map of public settings; `SF.setOn(key, default)`, `SF.setNum(key, default)`, `SF.settings`.
- `SF.t(ar,en)`, `SF.nm(row, base)`, `SF.lang`, `SF.setLang('ar'|'en')`, `SF.onLang(cb)`.
- Format: `SF.money(n)`, `SF.moneyHtml(n)`, `SF.fmtTime(iso)`, `SF.fmtDate(iso)`, `SF.fmtShort(iso)`, `SF.fmtDT(iso)`, `SF.ago(iso)`, `SF.todayISO()`, `SF.dayISO(offset)`, `SF.normPhone(p)` → `9665XXXXXXXX`, `SF.showPhone(p)` → `05…`, `SF.esc(s)` (ALWAYS escape user/DB text inserted as HTML).
- Status: `SF.statusLabel(status, fulfillment)`, `SF.statusBadge(...)`, `SF.isLive(status)`.
- UI: `SF.toast`, `SF.openSheet`, `SF.closeSheet`, `SF.confirm`, `SF.busy(button, asyncFn)` (spinner + double-click guard).
- Upload: `SF.uploadImage(folder, file, {maxDim})` → public URL in bucket `media` (folders allowed: `families/<family_id>/…` for family staff, `reviews/<uid>/…` for customers, anything for admin). `SF.uploadDoc('families/<family_id>', file)` → storage path in private bucket `docs`.
- `SF.live(table, filter, cb)` realtime (postgres_changes; RLS applies). `SF.enablePush()` web push (works once VAPID is configured). `SF.registerSW('sw.js')`. `SF.splash(ms)`. `SF.waLink(phone, text)`.

---

## 3. Backend (live, tested) — Supabase `uzwuvzxdjijlbfguhlmc`

SQL lives in `supabase/001_core.sql … 005_more.sql` (read them for exact columns). All tables are prefixed `sf_`.

### Tables (client-visible)
- `sf_settings(key, value, is_public)` public read (public rows).
- `sf_cities(id, name_ar, name_en, lat, lng, active, sort)` — active now: khobar, dammam, dhahran.
- `sf_categories(id, name_ar, name_en, image_url, sort, active)` — traditional, rice, pastries, sweets, breakfast, feasts, frozen, healthy.
- `sf_families` public columns: `id, slug, name_ar/en, bio_ar/en, logo_url, cover_url, city_id, district, status(pending|active|suspended|closed), is_open, prep_min, min_order, pickup_enabled, delivery_enabled, delivery_max_km, delivery_tiers [{km,fee}], slot_capacity, daily_capacity, preorder_days, commission_pct(admin), cuisines[], tags[], featured, sort, rating_avg, rating_count, orders_count, is_demo`. Public sees only `status='active'`; family staff see their own; admin all. Families update themselves ONLY via `sf_family_save`. Admin can update directly.
- `sf_family_private(family_id, phone, whatsapp, lat, lng, address_text, iban, iban_name, owner_name, national_id, admin_note)` — family + admin only.
- `sf_family_hours(family_id, dow 0=Sun…6=Sat, open_min, close_min)` public read; family writes via `sf_family_hours_save`.
- `sf_family_timeoff(id, family_id, from_date, to_date, note)` public read; family/admin insert/delete directly.
- `sf_family_docs(id, family_id, kind freelance|family_cert|health_cert|municipal|iban_cert|id|other, file_path, expires_on, status pending|approved|rejected, note)` family insert/select/delete(own, not approved); admin update.
- `sf_dishes(id, family_id, category_id, section, name_ar/en, desc_ar/en, image_url, price, old_price, serves, prep_min, min_lead_hours, daily_limit, options jsonb, available, sort, is_demo)` public read for active families; family staff insert/update/delete own; options are normalized by a trigger: `[{id, name_ar, name_en, type:'single'|'multi', required, max, choices:[{id, name_ar, name_en, price}]}]` (send choices without ids for new ones; the trigger fills ids).
- `sf_profiles(id, phone, name, lang, marketing_ok, referral_code, blocked)` own row (update name/lang/marketing via `sf_profile_save`).
- `sf_addresses(id, user_id, label, city_id, district, street, details, lat, lng, is_default)` own rows CRUD directly.
- `sf_favorites(user_id, family_id)` own rows CRUD directly.
- `sf_orders` (read: customer own, family own, admin all; **no direct writes**). Columns: `id, order_no, user_id, family_id, customer_name, customer_phone, fulfillment delivery|pickup, address {label,city_id,district,street,details,lat,lng}, distance_km, scheduled_for (null = asap), window_end, items [{dish_id,name_ar,name_en,image_url,qty,unit_price,options:[{group_ar,group_en,id,name_ar,name_en,price}],line_total,note}], subtotal, delivery_fee, small_order_fee, discount, credit_used, promo_code, vat, total, commission_pct, commission, family_net, pay_method card|cod|free, pay_status unpaid|pending|paid|refund_pending|refunded|failed, paid_amount, status pending_payment|new|preparing|ready|on_the_way|delivered|picked_up|cancelled|rejected, status_at, accepted_at, ready_eta, ready_at, done_at, cancelled_at, cancelled_by, cancel_reason, note, rating, review, review_photo, reviewed_at, review_hidden, family_reply, source, is_test, created_at`. Embedding works: `.select('*, family:sf_families(name_ar,name_en,slug,logo_url)')`.
- `sf_order_events(order_id, status, by_role, note, created_at)` timeline (same visibility as orders).
- `sf_payments(order_id, provider, amount, status, method, paid_at)` own/admin read.
- `sf_complaints(id, order_id, user_id, family_id, kind late|quality|missing|wrong|cancel|refund|payment|other, body, photo_url, status open|in_progress|resolved|rejected, admin_note, created_at, resolved_at)` customer own read, family read for its orders, admin read/update.
- `sf_notifications(id, user_id, title, body, link, kind, order_id, read_at, created_at)` own read; mark read via `sf_notif_read(p_ids bigint[] | null)`. Realtime enabled.
- `sf_credits(user_id, amount, reason, order_id)` own read. `sf_referrals` own read.
- `sf_staff(id, user_id, phone, name, role admin|support|family_owner|family_staff|driver, family_id, active)` admin manage; family sees its own staff.
- `sf_join_requests` admin only (public submits via `sf_join_submit`).
- `sf_promos(code, kind fixed|pct, value, max_discount, min_subtotal, starts_at, ends_at, max_uses, per_user, first_order_only, family_id, active, note)` admin CRUD directly.
- `sf_payouts(family_id, amount (+ we paid family, − family paid us), period_from, period_to, method, ref, note)` family read own, admin write via `sf_admin_payout`.
- `sf_broadcasts` admin read; `sf_admin_log` owner-admin read.
- Storage buckets: `media` (public read), `docs` (private; family own folder + admin; use `SF.sb.storage.from('docs').createSignedUrl(path, 600)` to view).
- Realtime publication: `sf_orders`, `sf_order_events`, `sf_notifications`, `sf_families`, `sf_dishes`.

### RPCs
Public / customer:
- `sf_home(p_city text|null)` → `{families:[{…public family cols, open_now, fee_from, fee_to, categories[], opens_today_min}], popular:[{id,family_id,name_ar,name_en,image_url,price,old_price,category_id,family_ar,family_en,slug,sold}]}`.
- `sf_family_reviews(p_family uuid, p_limit int)` → `[{rating, review, photo, reply, at, name(first name), items}]`.
- `sf_slots(p_family uuid, p_items jsonb, p_fulfillment text)` → `{asap:{ok, eta_min, eta, reason: paused|closed_now|needs_schedule|full_today|busy|null}, lead_min, days:[{date, label_ar, label_en, day_label, windows:[{start, end, from_min, to_min, label_ar, label_en, left}]}]}`.
- `sf_quote(p jsonb)` → the authoritative price. Input: `{family_id, items:[{dish_id, qty, options:[choiceId…], note}], fulfillment:'delivery'|'pickup', lat, lng, scheduled_for: iso|null, promo, pay_method:'card'|'cod', use_credit}`. Output: `{ok, errors:[{code,ar,en}], warnings:[…], family:{…}, lines:[…], fulfillment, distance_km, lead_min, eta:{asap:true, eta_min, eta}|{asap:false, start, end, label_ar, label_en}, subtotal, delivery_fee, small_order_fee, discount, promo:{code, ok, amount, ar, en}|null, credit_used, credit_balance, vat, total, pay_method, commission_pct, commission, family_net, first_order}`. Error codes: family, empty, dish, unavailable, option, daily_limit, min_order, pickup, delivery, address, kitchen_loc, range, schedule, full, busy, closed, slot, slot_full, pay.
- `sf_place_order(p jsonb)` (signed in) → same input as quote + `name, note, address:{label, city_id, district, street, details}, source:'app'|'web'` → `{ok, id, order_no, total, status, pay_method}` or `{ok:false, errors}`. `cod` → status `new` (sent to family). `card` → `pending_payment` (then call the `pay` function, see below). Login required error code: `login`.
- `sf_order_cancel(p_order uuid, p_reason text)` → `{ok}`; allowed only while `pending_payment|new`.
- `sf_order_rate(p_order, p_rating 1-5, p_review, p_photo url)` (after delivered/picked_up, within 14 days; photo must be in `media/reviews/<uid>/`).
- `sf_order_contact(p_order)` → `{ok, phone, whatsapp, pickup:{lat,lng,address}|null}` after the family accepted.
- `sf_complaint_new({order_id, kind, body, photo_url})`.
- `sf_me()`, `sf_profile_save({name, lang, marketing_ok})`, `sf_referral_use(code)`, `sf_device_register(p_kind, p_token, p_ua)`, `sf_notif_read(p_ids)`.
- `sf_join_submit({phone, name, kitchen_name, city_id, district, cuisines[], specialties, has_license, license_kind, instagram, notes})` (no login).

Family (staff of the family):
- `sf_family_set_status(p_order, p_status, p_eta_min, p_reason)` transitions: `new→preparing` (accept; `p_eta_min` = minutes until ready) or `new→rejected` (reason required); `preparing→ready|cancelled`; `ready→on_the_way|delivered|cancelled` (delivery) or `ready→picked_up|cancelled` (pickup); `on_the_way→delivered`. Returns `{ok, status, ready_eta}` or `{ok:false, ar, en}`.
- `sf_family_save(p jsonb)` → editable: `name_ar, name_en, bio_ar, bio_en, logo_url, cover_url, district, city_id, is_open, prep_min, min_order, pickup_enabled, delivery_enabled, delivery_max_km, delivery_tiers, slot_capacity, daily_capacity, preorder_days, cuisines[], tags[]` and `private:{phone, whatsapp, lat, lng, address_text, iban, iban_name, owner_name}`.
- `sf_family_hours_save(p jsonb array [{dow, open_min, close_min}])`.
- `sf_family_finance(p_from date, p_to date)` → `{orders, subtotal, delivery_fees, commission, net, card_net, cod_total, cod_commission, avg_rating, days:[{date,orders,net}], top:[{name,qty}], balance (+ = platform owes family, − = family owes platform), payouts:[…]}`.
- `sf_family_reply(p_order, p_reply)`, `sf_family_slug_set(p_slug)`.

Admin (role admin/support; some owner-admin only):
- `sf_admin_stats(p_from, p_to)` → `{orders, by_status, done, gmv, subtotal, commission, small_fees, discounts, platform_net, card_paid, cod_total, avg_order, customers, new_customers, rejected, cancelled, avg_rating, top_families[], top_dishes[], days[], open_complaints, join_new, live}`.
- `sf_admin_finance(p_from, p_to)` → `[{id, name_ar, status, orders, subtotal, commission, net, balance, paid_out, iban}]`.
- `sf_admin_family_create({name_ar, name_en, owner_name, owner_phone, city_id, district, bio_ar, cuisines[], commission_pct, status})` → `{ok, id, slug}` (creates owner staff + default hours 11:00–22:00).
- `sf_admin_join_decide(p_id, p_approve, p_note)`.
- `sf_admin_order_action(p_order, p_action, p_note)` actions: `cancel`, `status:<status>`, `refund`, `mark_paid`, `hide_review`, `show_review`, `test` (toggle test flag), `note`.
- `sf_admin_settings_save(p jsonb {key: value})` (owner admin).
- `sf_admin_staff_save({phone, name, role, family_id, active})` (owner admin).
- `sf_admin_payout({family_id, amount, period_from, period_to, method, ref, note})`.
- `sf_admin_broadcast({audience customers|families|all, title, body, link})` → `{ok, recipients}`.
- `sf_admin_customers(p_q, p_limit)` → `[{id, name, phone, blocked, created_at, orders, spent, last_order, credit}]`; `sf_admin_customer_set(p_user, {blocked, credit, reason})`.
- `sf_admin_delete_demo()` → deletes all `is_demo` families with their dishes and orders.
- Admin may also directly `select/update` `sf_families`, `sf_family_private`, `sf_dishes`, `sf_categories`, `sf_cities`, `sf_promos`, `sf_complaints`, `sf_family_docs`, `sf_join_requests`, `sf_staff` (owner), `sf_settings` (owner).

### Settings keys (public unless noted)
`app_name, app_name_en, tagline_ar/en, home_note_ar/en, support_whatsapp, commission_pct (admin), pay_card_enabled, pay_cod_enabled, pay_cod_max, pay_timeout_min, accept_timeout_min, accept_timeout_sched_min, slot_minutes, delivery_eta_min, asap_max_lead_min, road_factor (admin), small_order_threshold, small_order_fee, welcome_discount, credits_enabled, referral_enabled, referral_friend_credit, referral_reward_credit, vat_registered, vat_pct, vat_number, legal_name, cr_number, maintenance, wa_enabled (admin), vapid_public`.

### Server functions (Edge, built by the lead)
- `POST {url}/functions/v1/pay/create {order_id}` with the user's JWT → `{url}` hosted payment page (Moyasar) or `{mode:'off'}` when card payments are not configured. Return URL brings the user back to `index.html?order=<id>&paid=1`; then poll the order (`pay_status`) and/or call `GET pay/status?order=<id>`.
- `POST {url}/functions/v1/delete-account` with the user's JWT → deletes the account (anonymizes orders).
- Notifications are created by DB triggers (rows in `sf_notifications`); the `notify` function pushes them. Apps should show them via realtime on `sf_notifications`.

### Test accounts (test OTP, no SMS is sent)
Read the 6-digit code from `_tools/.test-otp` (never print it in reports). Phones: customer `0500000001`, family (owner of demo «مطبخ أم فهد», slug `umfahad`) `0500000002`, admin `0500000003`. Sign in programmatically in tests with `SF.auth.sendCode('0500000001')` then `SF.auth.verify('0500000001', code)`.
Demo data: 4 families (`umfahad`, `halabait`, `jood`, `walaem`, all `is_demo=true`) with 20 dishes. Card payments are OFF (`pay_card_enabled=0`), cash on delivery is ON. The current kitchen hours are 11:00–22:00 etc. (Riyadh time), so ASAP may be closed at night; scheduling must still work.
Orders you create while testing: mark them as tests afterwards (admin `sf_admin_order_action(id,'test')`) or cancel them; never leave live test orders in `new` state (the family test account would be pinged).

---

## 4. Apps

### 4.1 Customer app — `index.html`, `js/customer.js`, `css/customer.css` (+ `manifest.json`)
Hash router: `#/` home, `#/f/<slug>` family, `#/search`, `#/checkout`, `#/orders`, `#/order/<id>`, `#/account`, `#/addresses`, `#/favorites`, `#/invoice/<id>`. Also handle `?order=<id>` (from notifications / payment return) and `?f=<slug>` deep links. Bottom nav: الرئيسية، البحث، طلباتي (live count), حسابي. Desktop: same nav in the top bar, content max 1120px, family page shows a sticky cart panel on the side.

**Home**: top bar (brand, location chip showing city or «حدد موقعك» → location sheet with city list + «استخدم موقعي» (GPS → nearest active city by distance to `sf_cities` lat/lng), notifications bell with unread count → notifications sheet, language toggle (globe icon) ). Hero: greeting line + `home_note` + Sadu band; search field (opens search). Categories row (`.cat` tiles with category photos). Filter chips: «مفتوح الحين»، «توصيل»، «استلام»، «الأعلى تقييمًا». «مختارات لك» (featured families, horizontal scroll), «كل الأسر» (`.fam-grid`, open first; closed ones show «تفتح الساعة …» or «مسكّر الحين» badge and stay clickable for scheduling), «الأكثر طلبًا» (`.dish-grid`, tap opens the family with that dish sheet). Data: `sf_home(city)`, `sf_categories`. Skeletons while loading. Empty city → friendly empty state.

**Family page**: cover photo header (back, share via Web Share API/copy link, favorite heart (needs login)), logo, name, bio, stars + count, open badge / next opening, prep time «يجهز خلال 60 دقيقة», delivery fee range + min order, pickup/delivery badges, district. Sticky section tabs (from dish `section`, fallback category name). Dish rows; unavailable dishes greyed with «غير متوفر الحين». Tap a dish → dish sheet: hero photo, name, desc, serves, «يحتاج طلب قبلها بـ X ساعة» when `min_lead_hours`, options groups (single = radios, multi = checkboxes with max, required marked «مطلوب»), note field, qty stepper, sticky footer button «أضف للسلة · 70 ر.س» (client-side estimate for the button only). Reviews section from `sf_family_reviews` (stars, first name, text, photo, family reply). Cart is per family: adding from another family asks to replace the cart (`SF.confirm`). Floating cart bar (mobile) / side panel (desktop): item count, subtotal estimate, «إتمام الطلب».

Cart storage: localStorage `sf_cart_v1 = {family_id, family_slug, items:[{key, dish_id, qty, options:[choiceIds], note, name_ar, name_en, image_url, unit_est}]}` (key = dish_id + sorted options + note so identical lines merge).

**Checkout** (`#/checkout`, full page): sections in one scroll:
1. Items (qty stepper, remove, note per line).
2. «طريقة الاستلام» segmented: توصيل / استلام من المطبخ (disable the ones the family doesn't offer).
3. Delivery address: saved addresses as `.choice` cards (signed in) or a locally kept address (guest); «عنوان جديد» → address sheet: Leaflet map with center pin, «موقعي الحالي» button, city select, district, street, details (building/floor), label chips (البيت، الشغل، غيره), save (to `sf_addresses` when signed in). Pickup: show «تستلم من مطبخ الأسرة في حي X، والموقع يوصلك بعد ما تقبل الأسرة الطلب».
4. «وقت الطلب»: «بأسرع وقت · حوالي N دقيقة» (only if `slots.asap.ok`) or «حدد موعد»: day chips then window chips with remaining spots («باقي 2»); full windows disabled. Default to ASAP when available, otherwise first window. Show the reason when ASAP is unavailable (closed_now → «الأسرة مسكّرة الحين، اختر موعد»).
5. «الدفع»: cash on delivery card (when `pay_cod_enabled`), card (mada / Visa / Apple Pay) only when `pay_card_enabled=1`; promo code input with apply → re-quote; credit toggle when `credits_enabled` and balance > 0.
6. Note to family (optional).
7. Summary `.sum` from `sf_quote` (subtotal, delivery, small order fee, discount (green), credit, VAT, total) + `warnings` (e.g. first order discount) + all `errors` shown as a `.notice.bad` list near the button. Re-quote (debounced 300ms) on every change.
8. Sticky footer: «أرسل الطلب · 168 ر.س». If not signed in → login sheet (phone → OTP → name) then continue automatically. On success: COD → navigate to `#/order/<id>` with a success toast; card → `POST pay/create` and redirect to the returned URL; if `{mode:'off'}` show a toast and keep the order page with a «ادفع» retry button.

**Login sheet** (reused everywhere): step 1 phone (`.input-group` with addon «+966», placeholder «05XXXXXXXX», numeric keyboard, `autocomplete="tel"`), «أرسل الرمز»; step 2 OTP `.otp` 6 boxes (auto-advance, paste fills all, `autocomplete="one-time-code"`, resend timer 60s, «تغيير الرقم»); step 3 name (only if profile name empty) with marketing opt-in checkbox (checked by default, label «أبي توصلني العروض»). Then `sf_profile_save`.

**Order tracking** (`#/order/<id>`): status hero (big status label + icon, ETA: ready_eta for preparing «متوقع يجهز 7:40 م», scheduled window for future orders), timeline from `sf_order_events` (steps depend on fulfillment: delivery = new → preparing → ready → on_the_way → delivered; pickup = new → preparing → ready → picked_up), realtime updates on that order row. Family card with «اتصل» / «واتساب» (from `sf_order_contact` once accepted) and pickup map link (`https://maps.google.com/?q=lat,lng`). Items, summary, payment line («كاش عند الاستلام» / «مدفوع بالبطاقة» / «بانتظار الدفع» + «ادفع الحين»), «إلغاء الطلب» (while pending_payment/new, confirm with optional reason), «قيّم طلبك» (after done → rating sheet: stars, comment, optional photo uploaded to `reviews/<uid>/`), «عندك مشكلة؟» → complaint sheet (kind chips, text, optional photo), «اطلب نفسه مرة ثانية» (reorder → cart), «الفاتورة» → `#/invoice/<id>`.

**Invoice** (`#/invoice/<id>`): printable A4/receipt layout: Sadu band header, app/legal name (`legal_name`, `cr_number`, `vat_number` when set), order no, dates, family, customer, lines, totals, payment method; when `vat_registered=1` add a ZATCA TLV QR (seller name, VAT number, timestamp ISO, total, VAT) rendered with `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js`; buttons «طباعة» / «حفظ PDF» (window.print with print CSS).

**Orders list** (`#/orders`): live orders first (status badge, family, ETA), then history (date, total, rating stars or «قيّم»), reorder button. Empty state with CTA to home.

**Account** (`#/account`): guest → login CTA. Signed in: name (editable), phone, «عناويني», «المفضلة», «شكاويّ» (my complaints with status + admin note), credit balance + referral code/share (only if enabled), notifications toggle (`SF.enablePush()`), language (العربية / English), «انضم كأسرة منتجة» → `join.html`, support WhatsApp (if `support_whatsapp`), «الشروط» / «الخصوصية» (`terms.html`, `privacy.html`), «تسجيل الخروج», «حذف الحساب» (double confirm, then `POST delete-account`).

**Notifications**: bell sheet lists `sf_notifications` (newest first), tap → follow `link` (e.g. `?order=<id>`) and mark read; «تحديد الكل كمقروء». Realtime: new notification → toast + count update; order status change on the open order page → re-render.

**Maintenance**: if `maintenance=1` show a friendly full-page notice and disable ordering.

Performance: first paint < 1.5s on 4G; cache `sf_home` result in localStorage for instant repeat visits; lazy images; no layout shift (fixed aspect ratios).

### 4.2 Family app — `family.html`, `js/family.js`, `css/family.css` (+ `family.webmanifest`, start_url `family.html`)
For the kitchen owner on her phone (very simple, big buttons, Arabic first). Login: phone → OTP (same flow; reuse code style). If `sf_me().role` isn't `family_owner|family_staff` → screen «هذا الرقم مو مسجل كأسرة في سُفرة» + button to `join.html`. If family `status` is `pending` → banner «حسابك تحت المراجعة، كمّل بيانات مطبخك ومنيوك».

Top: kitchen name + big open/closed switch («استقبال الطلبات» on/off → `sf_family_save({is_open})`), today summary (new / preparing / done today / today's net). Bottom nav: الطلبات، المنيو، الحساب، مطبخي.

**الطلبات**: segments «جديدة (n)» / «قيد التجهيز» / «جاهزة» / «المنتهية» (today + yesterday). Realtime on `sf_orders` filtered by `family_id=eq.<id>`; a NEW order plays a repeating alert sound (WebAudio generated chime, not a file) until acknowledged, vibrates, flashes the title, shows a toast and switches to «جديدة». Order card: «#10023», created time (ago), ASAP or scheduled window (prominent when scheduled), countdown until auto-cancel for `new` ASAP orders (`accept_timeout_min` from `status_at`), customer first name, fulfillment (توصيل · district · distance km / استلام), items with options and notes (large readable), customer note, payment («كاش عند الاستلام · اجمع X ر.س» or «مدفوع»), totals (total + «صافي لك» = family_net). Actions by status: new → «قبول» (sheet with ETA chips 15/30/45/60/90/120 min, default = prep_min) and «اعتذار» (reason chips: «خلصت الكمية»، «المطبخ مشغول»، «خارج نطاق التوصيل»، غيره); preparing → «جاهز»; ready → «طلع للتوصيل» / «تم التسليم» (delivery) or «استلمه العميل» (pickup); on_the_way → «تم التوصيل»; plus «إلغاء» with reason for preparing/ready. Contact buttons: call/WhatsApp customer (`customer_phone`), «الموقع على الخريطة» (address lat/lng). Print ticket (simple kitchen ticket print).

**المنيو**: dishes grouped by section with availability switch on each row (instant `update available`). «أضف طبق» / edit sheet: photo (camera/gallery, `SF.uploadImage('families/<family_id>/dishes', file)`), name ar (required) / en, description ar/en, category select, section (text with datalist of existing sections), price, old price (optional strike-through), serves, prep minutes, «يحتاج طلب مسبق (ساعات)» = min_lead_hours, daily limit, options editor (add group: name, single/multi, required, max; add choices: name + extra price), available. Delete with confirm. Reorder (move up/down → `sort`). Show a gentle checklist if the menu has no photos/prices.

**الحساب** (finance): period chips (اليوم، هالأسبوع، هالشهر، الشهر الماضي) → `sf_family_finance`; big numbers: orders, sales, platform commission, «صافي لك»; balance card («لك عند سُفرة X ر.س» if positive / «عليك لسُفرة X ر.س» if negative, with a one-line explanation: card payments are collected by Sufrah, cash orders' commission is owed); simple bar chart of daily net (CSS bars), top dishes, payouts list. IBAN form (iban, iban name) via `sf_family_save({private:{…}})`.

**مطبخي** (settings): profile (logo + cover upload, name ar/en, bio ar/en, city, district, share link `index.html?f=<slug>` + copy), kitchen location (map pin + address text; explain it's used for delivery distance and shown to pickup customers only after accepting), phone/WhatsApp, working hours editor (each day: closed or one/two ranges with time pickers) → `sf_family_hours_save`, vacations (date range add/remove in `sf_family_timeoff`), prep time, min order, pickup/delivery switches, delivery tiers editor (rows km → fee, max km), capacity per hour window and per day, how many days ahead customers can book, documents (upload freelance certificate / health certificate etc. to `docs`, with expiry date; list with status), reviews list with reply box (`sf_family_reply`), notifications toggle (`SF.enablePush()`), language, logout.

### 4.3 Admin panel — `admin.html`, `js/admin.js`, `css/admin.css`
Desktop-first but usable on phone (sidebar collapses to a top menu/drawer). Login with phone OTP; only `admin|support` roles (others see «ما عندك صلاحية»). Sections:
1. **اليوم** (dashboard): date presets (اليوم، أمس، 7 أيام، هالشهر، مخصص) → `sf_admin_stats`; stat cards (طلبات، المبيعات GMV، عمولة المنصة، صافي المنصة، متوسط الطلب، عملاء، ملغي/معتذر), live orders count with link, alerts (orders waiting > 5 min, open complaints, new join requests), daily bars, top families, top dishes.
2. **الطلبات**: filters (status, family, date range, search by order no/phone/name), table (no, time, customer, family, fulfillment, total, pay, status badge), realtime refresh; row → order sheet: everything about the order + events timeline + actions (`sf_admin_order_action`: cancel with reason, force status, refund (card), mark paid, toggle test, add note, hide/show review).
3. **الأسر**: list (status chips: نشطة، تحت المراجعة، موقوفة), search; «أسرة جديدة» form → `sf_admin_family_create`; family detail sheet with tabs: البيانات (all public fields incl. featured/sort/commission_pct/status/is_demo), الخاص (phone, whatsapp, iban, location, admin note), المنيو (list dishes with availability toggle and quick edit of price), الوثائق (view via signed URL, approve/reject with note), الطاقم (staff phones for this family, add via `sf_admin_staff_save` role family_staff), المالية (`sf_family_finance` with `p_family`). A clearly separated danger action «حذف البيانات التجريبية» (`sf_admin_delete_demo`, double confirm).
4. **طلبات الانضمام**: list (new first) with details; approve (creates a pending family + owner staff) / reject with note; after approving show «فعّل الأسرة» shortcut.
5. **العملاء**: search (`sf_admin_customers`), row → customer sheet: orders list, block/unblock, add credit with reason.
6. **المالية**: date range; per-family table from `sf_admin_finance` (orders, sales, commission, net, balance with color: positive = we owe the family, negative = family owes us), «سجّل تحويل» (amount, method, ref, note → `sf_admin_payout`), export CSV of the table.
7. **الشكاوى**: tabs by status; detail with order link, customer, family; change status + admin note.
8. **العروض**: promo codes table + create/edit sheet (code, fixed/pct, value, max discount, min order, dates, max uses, per user, first order only, family-specific, active).
9. **الإشعارات**: compose (audience, title, body, link) → `sf_admin_broadcast`, history.
10. **الإعدادات**: grouped form for all settings keys with Arabic labels + helper text: الدفع (card on/off, cash on/off, cash max, pay timeout), الطلبات (accept timeouts, slot minutes, delivery ETA, ASAP max lead), الرسوم (commission %, small order threshold/fee, road factor), العروض (welcome discount, credits, referral amounts), الضريبة والفاتورة (vat_registered, vat_pct, vat_number, legal_name, cr_number), الواجهة (app names, taglines, home notes, support WhatsApp, maintenance). Save → `sf_admin_settings_save`. Plus: المدن (activate/deactivate, order) and التصنيفات (names, image upload to `media/categories/`, order, active).
11. **الفريق**: staff list (admins/support/family staff), add/edit/deactivate (owner admin).
12. **السجل**: last 200 `sf_admin_log` rows.

### 4.4 Join page — `join.html`, `js/join.js`
Public, warm landing for families: hero («بيع أكلك من بيتك»), 3 benefits, how it works (3 steps), commission line from settings is NOT shown (keep generic: «عمولة بسيطة على كل طلب»), then the form (name, phone, kitchen name, city, district, cuisines chips, specialties, has license toggle + kind (وثيقة عمل حر / شهادة أسرة منتجة / غيره), Instagram, notes, agree to `terms.html`) → `sf_join_submit` → success screen («وصلنا طلبك، بنكلمك على الواتساب خلال يومين») with link to download/open `family.html`.

### 4.5 Legal pages (lead builds): `terms.html`, `privacy.html`, `credits.html`.

---

## 5. Testing (required before you report done)
- Start the local preview server if needed: `node _tools/serve.js 5600` (or reuse if already running) → `http://localhost:5600/`.
- Headless screenshots with Edge via `J:/videos/t-claudyy/siyanah/_tools/browser/cdp.js` (`const {open} = require(...); const b = await open(url, {width, height, scale}); await b.ev(js); await b.shot(file); await b.close()`). `b.ev` evaluates JS in the page (await supported). Use widths 390 (phone) and 1280 (desktop), both light and dark (`await b.cmd('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme', value:'dark'}]})`). Look at your screenshots with the Read tool and fix what looks off.
- Exercise the real flows against the live backend with the test accounts (sign in inside the page via `SF.auth.verify`). Check the browser console for errors (`b.cmd('Runtime.enable')` + collect `Runtime.exceptionThrown`, or wrap with try/catch and `window.__errs`).
- Save screenshots under `sufrah-app/_shots/<app>/` (gitignored).
- Clean up: cancel or mark as test any order you created.
