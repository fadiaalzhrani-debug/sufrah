# خطة سُفرة: نفس عمق خافت من كل النواحي

التاريخ: 2026-10-29. الطلب: «سو التطبيق حقه بالكامل وخله زي خافت كامل من كل النواحي».
الحالة الآن: الواجهات الأربع (العميل، الأسرة، الإدارة، الانضمام) مبنية ومجرّبة محليًا ببيانات تجريبية، وما انرفعت للنت.

## أولًا: اللي سُفرة فيها أصلًا ومطابق لخافت
- دخول برمز SMS، والأسعار كلها من الخادم، ومواعيد وسعات، وتتبع حي للطلب.
- تطبيق الأسرة (قبول، تجهيز، توصيل، المنيو، المالية، الوثائق، الإجازات).
- لوحة الإدارة (اليوم، الطلبات، الأسر، الانضمام، العملاء، المالية، الشكاوى، العروض، الإشعارات، الإعدادات، الفريق، السجل).
- الشكاوى، التقييم ورد الأسرة، الرصيد والإحالة وخصم أول طلب، الكوبونات.
- الإشعارات (داخل التطبيق، وعلى الجوال والويب)، عربي وإنجليزي، فاتورة بالـQR الضريبي، حذف الحساب، صفحات الشروط والخصوصية.
- التنبيهات الآلية (مهلة الدفع، مهلة القبول، تذكير الأسرة، طلب التقييم)، ملخص يومي للإدارة، عزل الطلبات التجريبية.
- تطبيقات الجوال جاهزة للبناء (Capacitor + Codemagic، تطبيق للعملاء وتطبيق للأسر).

## ثانيًا: الناقص عن خافت، مرتب على دفعات بناء

### الدفعة 1: الخادم (أبنيها الآن بدون ما أحتاج شي منك)
1. إصلاحات الفحص الأمني (التقرير قيد التنفيذ).
2. حذف البيانات القديمة تلقائيًا (نظام حماية البيانات): إخفاء هوية الطلبات بعد 60 يومًا مثل خافت.
3. تنبيه الإدارة فورًا على الجوال عند كل شكوى وكل تقييم ضعيف (مثل admin_alert في خافت).
4. تذكير الأسرة قبل انتهاء وثائقها (رخصة العمل الحر، الشهادة الصحية).
5. صندوق «اقتراح أو شكر» بجانب الشكاوى.
6. نقاط ولاء: خصم بعد كل 6 طلبات (نفس فكرة خافت، لكن للأكل).
7. ملف PDF للفاتورة (دالة invoice-pdf مثل خافت) يفتحه العميل ويوصله على الواتساب لاحقًا.
8. تنبيه رصيد رسائل SMS قبل ما يخلص.
9. مسار دخول لمراجعي آبل وقوقل (حساب تجريبي موثق) مثل اللي أنقذ خافت من الرفض.

### الدفعة 2: تطبيق العميل
1. زر «حفظ الفاتورة PDF» من الدالة الجديدة.
2. شاشة الولاء وشريط التقدم (الطلب السابع بخصم).
3. «اقتراح أو شكر» في الحساب.
4. تعديل الطلب قبل ما تقبله الأسرة (إضافة أو حذف طبق).
5. مقالات ووصفات من الأسر (مثل مقالات السلامة في خافت)، تُنشر من الإدارة بدون تحديث التطبيق.
6. تلميع حركة البداية وثبات الأداء على الجوال الضعيف.

### الدفعة 3: تطبيق الأسرة
1. جولة تعريفية أول مرة (مثل tour.js في خافت) ودليل مصوّر للأسرة.
2. صوت حقيقي للطلب الجديد بدل النغمة المولّدة (نفس صوت العملات اللي اخترتيه لخافت).
3. تنبيه داخل التطبيق لما تقرب وثيقة تنتهي.
4. المديرة تقدر تفتح لوحة الإدارة من نفس تطبيق الأسر (تطبيق واحد للطاقم مثل شركاء خافت).
5. أزرار الاتصال والواتساب والخريطة تفتح صح داخل التطبيق.

### الدفعة 4: لوحة الإدارة
1. مركز تنبيهات (شكاوى جديدة، تقييمات ضعيفة، وثائق تنتهي، أسر ما ردت).
2. تقرير PDF «عمولات الكاش المستحقة على الأسر» مثل تقرير الفواتير اللي ما اندفعت.
3. محتوى الملخص اليومي بنفس تفاصيل خافت (طلبات، مبيعات، ملغي، شكاوى، أسر جديدة).
4. صفحة المقالات والوصفات.

### الدفعة 5: بوت الواتساب (يُبنى الآن ويشتغل لما يصير فيه رقم)
المطلوب حتى يصير مثل بوت خافت (38 فرقًا تم حصرها):
- الترحيب وقائمة البداية بصورة وأزرار، فهم الكلام باللهجة، تصفح الأسر والمنيو داخل الواتساب.
- «طلباتي»: الحالة والموعد والإلغاء والدفع. رسائل حالة الطلب (قبلت الأسرة، جاهز، في الطريق، وصل، وصلنا دفعك) بقوالب معتمدة.
- الفاتورة بملف PDF وزر دفع، رابط دفع ثابت يرجّع للمحادثة.
- التقييم بخمس نجوم من الواتساب، الشكاوى وطلب موظف.
- الأسرة تقبل أو تعتذر وتحدّث الحالة بأزرار من الواتساب، وتذكير لو ما ردت.
- ملخص اليوم على واتسابك، تنبيهات الدفعات، اختصارات من جوال العمل («/طلب»، «/تطبيق»).
- السرعة والموثوقية: قفل الرقم، منع التكرار، طابور إعادة الإرسال، سلسلة البدائل، سجل كامل، ساعات هدوء، مفتاح إيقاف، عزل أرقام الاختبار، محاكي للتجربة بدون إرسال.

### الدفعة 6: الدفع (يحتاج حساب ميسر باسم سُفرة)
1. الدفع بالبطاقة داخل التطبيق مع حفظ البطاقات (مثل خافت).
2. أبل باي الأصلي داخل التطبيق (يحتاج معرّف تاجر في حساب آبل).
3. تمارا: مو مناسبة لطلبات الأكل الصغيرة، نتركها.

### الدفعة 7: النشر والتشغيل
1. نصوص المتاجر بالعربي والإنجليزي، لقطات الشاشة، إجابات الخصوصية (آبل) وأمان البيانات (قوقل).
2. سكربتات الإصدار (مثل partners-release.sh وأدوات asc في خافت) لسُفرة.
3. النسخ الاحتياطي اليومي لقاعدة سُفرة مع خافت.
4. ملف تشغيل CLAUDE.md لسُفرة (وين كل شي، والأوامر، والقواعد).
5. الرفع على GitHub Pages (بعد كلمة «ارفع») ودومين لو تبين.

## ثالثًا: اللي ما يصير إلا بيدك
1. حساب ميسر باسم سُفرة (حساب خافت باسم مؤسسة سباكة ما يصلح للأكل). يوقف: الدفع بالبطاقة، أبل باي، روابط الدفع في الواتساب.
2. رقم واتساب لسُفرة وربطه بـDualhook (أو ميتا) وبطاقة دفع على حساب الواتساب للقوالب. يوقف: البوت كله.
3. تسجيل تطبيقين في App Store Connect: com.sufrah.app و com.sufrah.family (من الموقع، آبل ما تسمح لي أسويها من الـAPI).
4. تسجيل التطبيقين في Google Play Console وتوليد مفتاحي توقيع في Codemagic باسم sufrah_upload و sufrah_family_upload.
5. مشروع Firebase للتطبيقين (إشعارات أندرويد) ووضع ملفات google-services في Codemagic.
6. ترقية مشروع Supabase لسُفرة إلى Pro قبل الإطلاق: المجاني يتوقف بعد أسبوع بدون استخدام ويضيع العملاء.
7. رصيد عند مزود الرسائل (Authentica) وإلغاء قائمة الأرقام المسموحة للتجربة.
8. السجل التجاري ورقم الضريبة (لو مسجلة) عشان الفاتورة تصير رسمية.
9. دومين لو تبين (مثل khafet.com).

## رابعًا: الترتيب
الآن: الدفعة 1، ثم 2 و3 و4 (ما تحتاج شي منك)، ثم 5 و7 جاهزة تنتظر الرقم والحسابات، والدفعة 6 أول ما يجي حساب ميسر.

---

## Technical appendix (English)

### Batch 1: backend (new SQL file `supabase/140_parity_2026-10-29.sql`, idempotent; new functions under `supabase/functions/`)
- Retention: cron `sf-retention` daily 04:00 Riyadh → anonymize `sf_orders` older than `retention_days` (default 60, setting `retention_days`): customer_name → 'عميل', customer_phone → null, address → jsonb with district/city only, note/review_photo null, keep totals for finance; delete `sf_notifications` > 90 days, `sf_admin_log` > 365 days, `sf_devices` not seen 180 days. Mirror Khafet `retention` function semantics.
- Admin alerts: trigger on `sf_complaints` insert and on `sf_orders.rating <= 2` → `sf_notifications` rows for all active admin/support staff + push via `notify` (kind `admin_alert`). Setting `admin_alert_enabled`.
- Docs expiry: cron weekly → `sf_notifications` to family staff for `sf_family_docs.expires_on` within 30 days, and admin summary. Family app banner (batch 3).
- Suggestions: extend `sf_complaints.kind` check with `suggestion|thanks`; RPC `sf_complaint_new` accepts them; admin tab filter.
- Loyalty: settings `loyalty_enabled`, `loyalty_every` (6), `loyalty_pct` (10), `loyalty_max` (50); `sf_quote`/`sf_place_order` apply `loyalty_disc` on the (every+1)th delivered/picked_up non-test order; column `sf_orders.loyalty_disc`; RPC `sf_me` returns `loyalty: {count, next, pct}`.
- invoice-pdf: Deno function `invoice-pdf?t=<signed token>` rendering the same layout as `#/invoice/<id>` (reuse Khafet `siyanah/supabase/functions/invoice-pdf` approach for Arabic shaping/fonts); token = order id + expiry + HMAC(SERVICE_KEY). Customer app button (batch 2); WhatsApp document later (batch 5).
- SMS balance: function `sms-balance` (port of Khafet) + cron daily → admin notification when Authentica balance < threshold `sms_min_balance`.
- Review account: setting `review_phone` (test OTP number documented for App Review), demo family visible to that account only if `maintenance`/closed hours (same idea as Khafet demo path).

### Batch 2: customer (`index.html`, `js/customer.js`, `css/customer.css`)
- Invoice page: «حفظ PDF» → invoice-pdf URL. Account: loyalty card + progress (from `sf_me().loyalty`); «اقتراح أو شكر» sheet (kinds suggestion/thanks). Order page: «عدّل الطلب» while status `new` → RPC `sf_order_edit(p_order, items)` (re-quote, same rules) (batch 1 adds the RPC). Articles: table `sf_articles` (admin CRUD) + `#/articles` list/detail.

### Batch 3: family (`family.html`, `js/family.js`, `css/family.css`)
- First-run tour (3–5 steps, localStorage flag), `guide.html` for families (AR/EN). New-order sound file `img/snd/new-order.mp3` (Mixkit «Coins handling», same license as Khafet) with WebAudio fallback. Docs-expiry banner. If `role in (admin, support)` show «لوحة الإدارة» entry that opens `admin.html` inside the app shell. Capacitor: `tel:`/`https://wa.me`/maps via `@capacitor/browser`/`App.openUrl`.

### Batch 4: admin (`admin.html`, `js/admin.js`, `css/admin.css`)
- Alerts center (unread admin_alert notifications), COD-commission-owed report (HTML → print/PDF via the invoice-pdf renderer), digest content parity (`010_digest.sql` fields), articles CRUD, suggestions filter.

### Batch 5: WhatsApp bot (`supabase/functions/wa/**`, `supabase/150_wa_parity.sql`)
- Port Khafet wa-bot architecture: inbound lock per phone, dedupe by message id, outbox retry, fallback chain, full log table with delivery statuses, quiet hours, kill switch + test-phone isolation, simulator route. Intents (match.ts style) for Sufrah vocabulary. Flows: welcome image+buttons; browse families → menu cards; «طلباتي» (status/slot/cancel/pay); status notifications on `sf_order_events` via templates (`sufrah_order_status`, `sufrah_pay_pending`, `sufrah_rate`, `sufrah_family_new_order` with quick replies accept/reject, `sufrah_digest`); rating 5 quick replies → `sf_order_rate`; complaints → `sf_complaint_new`; owner shortcuts. All gated by `wa_enabled`.

### Batch 6: payments (needs Moyasar account): in-app card form + token save (`sf_cards`), Apple Pay plugin port from `siyanah/khafet-app/plugins`, pay function routes.

### Batch 7: publishing & ops
- `native/store/` listing texts AR/EN, screenshot generator (port `_tools/play-screens`), privacy labels & data safety JSON; `_tools/release.sh` + ASC status script; add Sufrah to `siyanah/_tools/backup`; `sufrah-app/CLAUDE.md` runbook; `deploy.js --push` only after «ارفع».
