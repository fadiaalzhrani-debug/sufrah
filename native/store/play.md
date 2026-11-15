# نصوص قوقل بلاي لسُفرة (2026-11-14)

الحساب: Google Play Console «Rezq» (developer 8056681554712621330)، بقرار فادية 2026-11-14. الصور في `_shots/play/` (تُولَّد بـ `node _tools/play-assets.js`): أيقونة `icon-512.png`، الصورة المميزة `feature-app.png` و`feature-family.png`، لقطات الهاتف 1242×2208 `app-*.png` و`family-*.png`.
مفتاحا التوقيع في `Downloads/codemagic-sufrah/` (المرجعان في Codemagic: `sufrah_upload` و`sufrah_family_upload`، كلمات المرور في keystores.txt هناك، لا تُنسخ هنا).

## 1) سُفرة (العملاء) · sa.sufrah.app
- الاسم: سفرة بيتنا (كان: سُفرة للأكل البيتي، غيّرته فادية 2026-11-15)
- الوصف القصير (80 حرفًا): أكل بيت طازج من الأسر المنتجة في الشرقية، توصيل أو استلام
- الوصف الكامل: نفس وصف آبل في listing.md (عربي، ثم السطر الإنجليزي)
- الفئة: الطعام والشراب · مجاني · بدون إعلانات
- الخصوصية: https://fadiaalzhrani-debug.github.io/sufrah/privacy.html
- البريد: fadiaalzhrani@gmail.com
- الوصول للتطبيق (App access): دخول برقم 0500000001 ورمز ثابت (يُقرأ من Supabase ← Test OTPs)، كل الميزات بعد الدخول.
- الإعلانات: لا. الجمهور المستهدف: 18+. تطبيق إخباري: لا. كوفيد: لا. حكومي: لا. ميزات مالية: لا (دفع كاش عند الاستلام فقط). صحة: لا.
- تصنيف المحتوى (IARC): فئة «أداة/خدمة»، كل الإجابات لا، فيه تواصل بين المستخدمين (رسائل مع المطبخ عبر واتساب خارج التطبيق: لا)، مشاركة الموقع: نعم (عنوان التوصيل).
- أمان البيانات: يجمع رقم الجوال (حساب)، الاسم، العنوان والموقع التقريبي/الدقيق (التوصيل)، سجل الطلبات، صور يرفعها المستخدم (تقييم/شكوى)، معرّف الجهاز للإشعارات. مشفّر أثناء النقل، يمكن طلب حذفه (delete-account.html)، لا يُشارك مع أطراف ثالثة إلا المطبخ المنفّذ للطلب (الاسم والعنوان والجوال).

## 2) سُفرة للأسر · sa.sufrah.family
- الاسم: سُفرة للأسر
- الوصف القصير: استقبل طلبات مطبخك، نظّم المنيو، وتابع مبيعاتك
- الوصف الكامل: نفس وصف آبل في listing.md
- الفئة: الأعمال · مجاني · بدون إعلانات
- الوصول للتطبيق: 0500000002 بالرمز الثابت (مالكة «مطبخ أم فهد»).
- أمان البيانات: زيادة على ما فوق: وثائق المطبخ (رخصة الأسرة المنتجة)، بيانات الحساب البنكي للمستحقات (IBAN) نصيًا، صور الأطباق.

## الترتيب
1. فادية: Codemagic ← Teams ← Code signing identities ← Android keystores: رفع الملفين من Downloads/codemagic-sufrah بالمرجعين وكلمات المرور من keystores.txt.
2. Firebase: مشروع جديد «Sufrah» (منفصل عن خافت) فيه تطبيقا أندرويد sa.sufrah.app وsa.sufrah.family ← google-services.json لكل واحد (Base64 في مجموعة `firebase` بـCodemagic: GOOGLE_SERVICES_CUSTOMER_B64 وGOOGLE_SERVICES_FAMILY_B64) + مفتاح حساب خدمة ← سر Supabase `FCM_SERVICE_ACCOUNT`.
3. بناية «سُفرة Android» ثم «سُفرة للأسر Android» ← تنزيل AAB.
4. Play Console: إنشاء التطبيقين، البيانات والصور، الإصدار على الإنتاج (السعودية)، إرسال للمراجعة.

## الحالة 2026-11-14 (مساءً)
- Firebase: مشروع جديد منفصل `sufrah-d820d` (حساب فادية) فيه sa.sufrah.app وsa.sufrah.family؛ google-services.json مشترك للاثنين في Downloads/codemagic-sufrah/google-services-sufrah.json (وB64 جاهز)، وحساب الخدمة سر Supabase FCM_SERVICE_ACCOUNT (health: fcm=true).
- Play Console: التطبيقان أُنشئا: العملاء app id 4975475009785262903، الأسر 4976260840536723513. كل بيانات الإعداد (11/11) مكتملة للاثنين: خصوصية، وصول للمراجعة، إعلانات، جمهور 18+، تصنيف IARC (3+/للجميع)، أمان البيانات، حكومي/مالي/صحة/معرّف إعلاني، الفئة (مطاعم ومقاهي / أعمال)، جهة الاتصال، وبطاقة المتجر بالصور.
- الباقي: مفاتيح التوقيع ومتغيّرات firebase في Codemagic (فادية)، ثم بناية Android لكل تطبيق، ثم إصدار الإنتاج (السعودية) والإرسال للمراجعة.

## 2026-11-15 صباحًا
- آبل: الإصدار 1.0 للتطبيقين REJECTED (reviewSubmission = UNRESOLVED_ISSUES، submitted 2026-11-14). السبب غير متاح عبر API؛ يُقرأ من App Store Connect (يحتاج دخول فادية في كروم) أو من بريد الرفض.
- سوبابيس: دخلت المنظمة Fadia Free (pnmisvsbdveddfbuwxlj)، نافذة Upgrade to Pro مفتوحة في كروم وتطلب بطاقة (ما فيه وسيلة دفع). اليوم 25$، التقدير الشهري 35$ لأن المنظمة فيها 3 مشاريع.
- Codemagic: ما زال ينتظر رفع keystores + متغيرات firebase من فادية.
- (لاحقًا 2026-11-15) سبب رفض آبل للاثنين: Guideline 2.1 Information Needed (تسجيل شاشة من جهاز حقيقي + وصف الغرض والخدمات والمناطق في Notes). كتبت Notes كاملة بالإنجليزي عبر API للتطبيقين (reviewDetail d74151af للعميل، 27e82d17 للأسر) وبقي سطر VIDEO LINK. أنشأت مجموعة TestFlight داخلية «Internal» لكل تطبيق (da91969c عميل، 5fa58ddf أسر) وفادية مدعوّة مختبرًا. بعد وصول الفيديوهات: إرفاقها كـ appStoreReviewAttachments أو رابط، ثم resubmit (الإصدار 1.0 نفسه، البناء 1).
- الاسم الجديد لتطبيق العملاء «سفرة بيتنا» (en: Sufrah Baytna): مطبّق في App Store (appInfoLocalization) وفي بطاقة Play (الاسم + الصورة المميزة الجديدة) وفي codemagic.yaml DISPLAY_NAME وindex.html (محليًا، يحتاج بناء iOS/Android جديد ليتغيّر اسم الأيقونة). الأسر باقٍ «سُفرة للأسر».
- سوبابيس: Fadia Free صارت Pro، وSufrah على Micro.

## 2026-11-15 مساءً
- Codemagic: أضفت مجموعة `firebase` بالمتغيرين GOOGLE_SERVICES_CUSTOMER_B64 وGOOGLE_SERVICES_FAMILY_B64 (نفس القيمة، ملف واحد فيه التطبيقين) في إعدادات تطبيق sufrah. ما زال ينقص رفع مفتاحي التوقيع (sufrah_upload وsufrah_family_upload) من فادية: Settings ← Code signing identities ← Android keystores؛ ملفات الرفع لا تُرفع تلقائيًا من Claude.
- صفحة انضمام الأسر حيّة: https://fadiaalzhrani-debug.github.io/sufrah/join.html ، ورسالة الدعوة في `_tools/families-invite.md`.
