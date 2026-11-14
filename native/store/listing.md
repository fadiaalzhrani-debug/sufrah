# نصوص متجر آبل لسُفرة (2026-11-14)

الحساب: حساب فادية نفسه في App Store Connect (مفتاح asc.js يشتغل). التطبيقان منفصلان تمامًا عن خافت: مستودع fadiaalzhrani-debug/sufrah، مشروع Supabase uzwuvzxdjijlbfguhlmc، معرّفات com.sufrah.*.
اسم البائع اللي يظهر تحت التطبيق هو اسم حساب المطوّر (نفس خافت). الفصل الكامل بالاسم يحتاج حساب مطوّر ثاني باسم منشأة سُفرة (99 دولار سنويًا).

## 1) سُفرة (العملاء) · sa.sufrah.app
- الاسم: سُفرة
- العنوان الفرعي: أكل بيت من الأسر المنتجة
- الفئة: Food & Drink
- الكلمات المفتاحية: اكل بيت,أسر منتجة,طبخ بيتي,توصيل اكل,الدمام,الخبر,الظهران,سفرة,home food,saudi
- الخصوصية: https://fadiaalzhrani-debug.github.io/sufrah/privacy.html
- الدعم: https://fadiaalzhrani-debug.github.io/sufrah/
- الوصف (عربي):
سُفرة توصلك أكل البيت من الأسر المنتجة في المنطقة الشرقية.
تتصفح الأسر وأطباقها، تختار الوقت اللي يناسبك، وتطلب توصيلًا أو استلامًا من المطبخ.
تتابع طلبك خطوة بخطوة من القبول إلى الوصول، وتدفع كاش عند الاستلام.
تقيّم الأسرة بعد الطلب، وتكسب خصمًا على أول طلب ورصيدًا عند دعوة أصحابك.
- الوصف (English):
Sufrah brings homemade food from licensed home kitchens in Saudi Arabia's Eastern Province to your door.
Browse kitchens and dishes, pick a time that suits you, and order delivery or pickup.
Track every step from acceptance to arrival, and pay cash on delivery.
Rate the kitchen after your order, get a first-order discount, and earn credit when you invite friends.
- ملاحظات المراجعة (Review notes):
Sign in with phone 0500000001 (Saudi, +966). The SMS code for this test account is fixed: <الرمز من Supabase ← Authentication ← Test OTPs>. No real SMS is sent to it.
Kitchens shown are demo kitchens maintained by us for review; ordering, tracking and rating work end to end. Payment is cash on delivery only.
- جهة الاتصال للمراجعة: اسم فادية ورقمها وبريدها (تُدخل عند الإرسال).

## 2) سُفرة للأسر · sa.sufrah.family
- الاسم: سُفرة للأسر
- العنوان الفرعي: استقبل طلبات مطبخك
- الفئة: Food & Drink (أو Business)
- الوصف (عربي):
تطبيق الأسر المنتجة المشاركة في سُفرة.
استقبل الطلبات بإشعار فوري، اقبل أو اعتذر، وحدّث حالة التجهيز والتوصيل بضغطة.
نظّم المنيو والأسعار والكميات اليومية، وحدّد أيام الإجازة.
تابع مبيعاتك وتقييماتك ومستحقاتك من مكان واحد.
- الوصف (English):
The kitchen app for home cooks on Sufrah.
Get new orders instantly, accept or decline, and update preparation and delivery status with one tap.
Manage your menu, prices and daily quantities, and set days off.
Track your sales, ratings and payouts in one place.
- ملاحظات المراجعة:
Sign in with phone 0500000002 (fixed test code, see above). This account owns the demo kitchen "مطبخ أم فهد". To see a live order, place one from the customer app with 0500000001.

## لقطات الشاشة
تُولَّد بأداة مثل siyanah/_tools/asc/mk-shots.js (6.7 بوصة 1290×2796 و6.5 بوصة 1242×2688) من الصفحات المحلية على المنفذ 5600، بعد ما ينفتح حساب آبل.

## الترتيب عند النشر
1. فادية: قبول الاتفاقية الجديدة في App Store Connect (محجوبة كل الواجهة لين توقّع).
2. إنشاء معرّفي الحزم sa.sufrah.app و sa.sufrah.family مع Push Notifications (بالـAPI).
3. فادية: إنشاء التطبيقين في App Store Connect (My Apps ← + ← New App) بالاسمين فوق، أو عبر كروم لو اشتغل.
4. فادية: إضافة مستودع sufrah في Codemagic وتشغيل «سُفرة iOS» ثم «سُفرة للأسر iOS».
5. البيانات والصور وملاحظات المراجعة بالـAPI (set-meta.js / upload-shots.js) ثم الإرسال.
