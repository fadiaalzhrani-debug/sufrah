# تطبيقات سُفرة على الجوال

فيه تطبيقين مبنيين من نفس ملفات الموقع (Capacitor)، والبناء على Codemagic زي خافت:

| التطبيق | المعرّف | الصفحة الأولى |
|---|---|---|
| سُفرة (العملاء) | `sa.sufrah.app` | `index.html` |
| سُفرة للأسر (المطابخ) | `sa.sufrah.family` | `family.html` |

ملف البناء: `codemagic.yaml` في جذر المشروع، فيه 4 بنايات يدوية: `ios-customer`، `ios-family`، `android-customer`، `android-family`.

## اللي يحتاج حسابك (مرة وحدة)
1. **آبل:** في App Store Connect سوّي تطبيقين بالمعرّفين فوق. مفتاح API نفسه حق خافت يشتغل (مجموعة `appstore` في Codemagic).
2. **قوقل بلاي:** سوّي تطبيقين بنفس المعرّفين، ومفتاحي توقيع في Codemagic باسم `sufrah_upload` و `sufrah_family_upload`.
3. **إشعارات أندرويد:** مشروع Firebase فيه التطبيقين، وتحطين ملفات `google-services.json` بصيغة Base64 في مجموعة `firebase` باسم `GOOGLE_SERVICES_CUSTOMER_B64` و `GOOGLE_SERVICES_FAMILY_B64`، وحساب الخدمة في Supabase سر باسم `FCM_SERVICE_ACCOUNT`.
4. **Codemagic:** أضيفي مستودع سُفرة كتطبيق جديد، وشغّلي البناية اللي تبينها.

## كيف تمشي البناية
- `npm run sync` ينسخ ملفات الموقع إلى `www` (تطبيق الأسر يفتح على صفحة الأسرة).
- الأيقونة وشاشة البداية من `native/assets` (رمّاني سُفرة مع السدو).
- الإشعارات داخل التطبيق تتسجل تلقائيًا (`SF.enablePush` يعرف إنه داخل تطبيق).
