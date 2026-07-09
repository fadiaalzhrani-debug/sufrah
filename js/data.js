/* ===================================================
   سُفرة — البيانات الأساسية (Seed)
   تصنيفات · مطابخ · أنواع التوصيل · أسر · أطباق
   =================================================== */

// تدرّجات لونية جاهزة (تُستخدم كخلفيات للأطباق بدون صور)
const G = {
  orange:     'linear-gradient(135deg,#FFEAD1,#FFCF9E)',
  deepOrange: 'linear-gradient(135deg,#FFE0C7,#FFBE9A)',
  pink:       'linear-gradient(135deg,#FFD9E7,#FFB3C9)',
  gold:       'linear-gradient(135deg,#FFF1C2,#FFD98B)',
  green:      'linear-gradient(135deg,#DFF3D8,#B6E3A7)',
  brown:      'linear-gradient(135deg,#EADBC8,#D5B99A)',
  cream:      'linear-gradient(135deg,#F6E6CA,#E7CB9E)',
  red:        'linear-gradient(135deg,#FFD7CC,#FFB09B)',
};
const DEFAULT_GRAD = G.orange;

// تصنيفات الطبق (النوع)
const CATEGORIES = [
  { id: 'all',      name: 'الكل',          emoji: '🍽️' },
  { id: 'main',     name: 'أطباق رئيسية',  emoji: '🍛' },
  { id: 'grill',    name: 'مشويات',        emoji: '🍖' },
  { id: 'pastry',   name: 'معجنات',        emoji: '🥟' },
  { id: 'sweets',   name: 'حلويات',        emoji: '🍰' },
  { id: 'bakery',   name: 'مخبوزات',       emoji: '🍞' },
  { id: 'starter',  name: 'مقبلات',        emoji: '🥗' },
  { id: 'drinks',   name: 'مشروبات',       emoji: '☕' },
  { id: 'pantry',   name: 'مؤونة',         emoji: '🫙' },
];
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// المطابخ (نوع الأكل)
const CUISINES = [
  { id: 'all',    name: 'كل المطابخ', emoji: '🌍' },
  { id: 'saudi',  name: 'سعودي',      emoji: '' },
  { id: 'shami',  name: 'شامي',       emoji: '🥙' },
  { id: 'egypt',  name: 'مصري',       emoji: '🍚' },
  { id: 'yemeni', name: 'يمني',       emoji: '🫓' },
  { id: 'gulf',   name: 'خليجي',      emoji: '☕' },
];
const CUISINE_BY_ID = Object.fromEntries(CUISINES.map(c => [c.id, c]));

// أنواع التوصيل الثلاثة
const DELIVERY_TYPES = {
  pickup: { id: 'pickup', name: 'استلام من المنزل', emoji: '🏠', fee: 0,  note: 'بدون رسوم — تستلمه بنفسك' },
  family: { id: 'family', name: 'توصيل الأسرة',      emoji: '🛵', fee: 10, note: 'الأسرة توصّله حسب المسافة' },
};
const ALL_DELIVERY = ['pickup', 'family'];

// رسوم توصيل الأسرة حسب المسافة
const DELIVERY_DISTANCES = {
  near:   { id: 'near',   name: 'قريب',  fee: 10 },
  medium: { id: 'medium', name: 'متوسط', fee: 15 },
  far:    { id: 'far',    name: 'بعيد',  fee: 20 },
};

// طرق الدفع
const PAYMENT_TYPES = {
  cash: { id: 'cash', name: 'عند الاستلام (كاش)', emoji: '💵', note: 'ادفع نقداً عند وصول الطلب' },
  card: { id: 'card', name: 'بطاقة مدى/ائتمان',    emoji: '💳', note: 'قريباً — عند ربط بوابة الدفع' },
};

// حالات الطلب
const ORDER_STATUS = {
  new:        { label: 'جديد',         emoji: '🆕' },
  preparing:  { label: 'قيد التحضير',  emoji: '👩‍🍳' },
  on_the_way: { label: 'في الطريق',    emoji: '🛵' },
  delivered:  { label: 'تم التسليم',   emoji: '✅' },
  cancelled:  { label: 'ملغي',         emoji: '❌' },
};

// جدولة الطلب — العميل يحجز يوم ووقت الاستلام/التوصيل
const SCHEDULE_LEAD_HOURS = 2;   // أقل مهلة تحضير قبل الموعد (اليوم نفسه)
const SCHEDULE_DAYS_AHEAD = 4;   // كم يوم قدّام يقدر يحجز
const TIME_SLOTS = [
  { id: 's8',  label: '٨:٠٠ ص',  h: 8 },
  { id: 's10', label: '١٠:٠٠ ص', h: 10 },
  { id: 's12', label: '١٢:٠٠ ظ', h: 12 },
  { id: 's14', label: '٢:٠٠ م',  h: 14 },
  { id: 's16', label: '٤:٠٠ م',  h: 16 },
  { id: 's18', label: '٦:٠٠ م',  h: 18 },
  { id: 's20', label: '٨:٠٠ م',  h: 20 },
];
const TIME_SLOT_BY_ID = Object.fromEntries(TIME_SLOTS.map((s) => [s.id, s]));

// أيام الأسبوع (للاشتراكات الأسبوعية)
const WEEKDAYS = [
  { id: 'sat', name: 'السبت' },
  { id: 'sun', name: 'الأحد' },
  { id: 'mon', name: 'الاثنين' },
  { id: 'tue', name: 'الثلاثاء' },
  { id: 'wed', name: 'الأربعاء' },
  { id: 'thu', name: 'الخميس' },
  { id: 'fri', name: 'الجمعة' },
];
const WEEKDAY_BY_ID = Object.fromEntries(WEEKDAYS.map((d) => [d.id, d]));

// نقاط الولاء: تكسب نقطة على كل ريال، وكل ١٠ نقاط = ١ ريال خصم (يعني ١٠٪ ترجع لك)
const POINTS_PER_SAR = 1;         // نقاط مكتسبة لكل ريال
const POINTS_PER_SAR_REDEEM = 10; // كم نقطة تعادل ريال عند الاستبدال
const REFERRAL_BONUS = 50;        // نقاط الإحالة لكل طرف (٥ ر.س)

// الأسر المنتجة (Seed)
const FAMILIES = [
  { id: 'f1', name: 'مطبخ أم سعود', spec: 'أكلات شعبية سعودية', cuisine: 'saudi',  rating: 4.9, time: '٤٥ د', cover: '🍛', grad: G.orange,     city: 'الرياض' },
  { id: 'f2', name: 'حلويات لمسة',  spec: 'حلويات ومعمول',       cuisine: 'shami',  rating: 4.8, time: '٣٥ د', cover: '🍰', grad: G.pink,       city: 'جدة' },
  { id: 'f3', name: 'فرن البيت',    spec: 'معجنات ومخبوزات',     cuisine: 'saudi',  rating: 4.7, time: '٣٠ د', cover: '🥐', grad: G.gold,       city: 'الرياض' },
  { id: 'f4', name: 'مؤونة الدار',  spec: 'مخللات ومربّى بلدي',  cuisine: 'saudi',  rating: 4.9, time: '٦٠ د', cover: '🫙', grad: G.green,      city: 'القصيم' },
  { id: 'f5', name: 'سفرة الشام',   spec: 'مقبلات ومقلوبة',       cuisine: 'shami',  rating: 4.8, time: '٤٠ د', cover: '🥙', grad: G.deepOrange, city: 'الدمام' },
  { id: 'f6', name: 'ركن القهوة',   spec: 'قهوة عربية ومشروبات', cuisine: 'saudi',  rating: 4.6, time: '٢٥ د', cover: '☕', grad: G.brown,      city: 'الرياض' },
  { id: 'f7', name: 'مطبخ الشام',   spec: 'منسف ومقلوبة وكبة',   cuisine: 'shami',  rating: 4.9, time: '٥٠ د', cover: '🍚', grad: G.deepOrange, city: 'جدة' },
  { id: 'f8', name: 'نكهة مصر',     spec: 'كشري وملوخية ومحشي',  cuisine: 'egypt',  rating: 4.7, time: '٤٥ د', cover: '🍚', grad: G.gold,       city: 'الرياض' },
  { id: 'f9', name: 'بيت المندي',   spec: 'مندي وزربيان يمني',   cuisine: 'yemeni', rating: 4.8, time: '٥٥ د', cover: '🍖', grad: G.deepOrange, city: 'مكة' },
];

// الأطباق (Seed) — سعودي وعربي متنوّع
const DISHES = [
  // ---- سعودي ----
  { id: 'd1',  name: 'كبسة دجاج',       cat: 'main',    cuisine: 'saudi',  familyId: 'f1', price: 35,  emoji: '🍛', tag: 'الأكثر طلباً', grad: G.orange,     desc: 'رز بسمتي بحشوة دجاج بلدي وبهارات كبسة أصلية.',      delivery: ALL_DELIVERY },
  { id: 'd2',  name: 'كبسة لحم',        cat: 'main',    cuisine: 'saudi',  familyId: 'f1', price: 48,  emoji: '🍖', tag: '',           grad: G.deepOrange, desc: 'لحم غنم طري مع رز الكبسة المتبّل.',                delivery: ['pickup','family'] },
  { id: 'd3',  name: 'مضغوط دجاج',      cat: 'main',    cuisine: 'saudi',  familyId: 'f1', price: 40,  emoji: '🍲', tag: '',           grad: G.orange,     desc: 'رز مضغوط بنكهة غنية ودجاج متبّل على الفحم.',       delivery: ALL_DELIVERY },
  { id: 'd4',  name: 'جريش',           cat: 'main',    cuisine: 'saudi',  familyId: 'f1', price: 30,  emoji: '🥣', tag: 'شعبي',       grad: G.cream,      desc: 'جريش سعودي كريمي مع البصل المحمّر والسمن.',        delivery: ['pickup','family'] },
  { id: 'd5',  name: 'قرصان بلدي',      cat: 'main',    cuisine: 'saudi',  familyId: 'f1', price: 32,  emoji: '🫓', tag: '',           grad: G.cream,      desc: 'قرصان بالخضار والمرق على الطريقة النجدية.',        delivery: ALL_DELIVERY },
  { id: 'd6',  name: 'مفطّح (نصف)',     cat: 'grill',   cuisine: 'saudi',  familyId: 'f1', price: 130, emoji: '🐑', tag: 'مناسبات',    grad: G.red,        desc: 'خروف مفطّح كامل للولائم، يُطلب قبل يوم.',          delivery: ['pickup','family'] },
  { id: 'd7',  name: 'سمبوسة (١٢ حبة)', cat: 'pastry',  cuisine: 'saudi',  familyId: 'f3', price: 15,  emoji: '🥟', tag: 'رمضاني',     grad: G.gold,       desc: 'سمبوسة مقرمشة بحشوة خضار أو لحم، تُقلى طازجة.',     delivery: ALL_DELIVERY },
  { id: 'd8',  name: 'مطبّق لحم',       cat: 'pastry',  cuisine: 'saudi',  familyId: 'f3', price: 20,  emoji: '🫓', tag: '',           grad: G.gold,       desc: 'مطبّق محشو باللحم والبيض والبقدونس.',              delivery: ALL_DELIVERY },
  { id: 'd9',  name: 'لقيمات',         cat: 'sweets',  cuisine: 'saudi',  familyId: 'f2', price: 15,  emoji: '🍩', tag: '',           grad: G.pink,       desc: 'كرات ذهبية مقرمشة مغموسة بالدبس أو القطر.',        delivery: ALL_DELIVERY },
  { id: 'd10', name: 'كليجا',          cat: 'sweets',  cuisine: 'saudi',  familyId: 'f2', price: 28,  emoji: '🍪', tag: 'قصيمي',      grad: G.gold,       desc: 'كليجا التمر والهيل على الطريقة القصيمية.',         delivery: ['pickup','family'] },
  { id: 'd11', name: 'معصوب',          cat: 'sweets',  cuisine: 'saudi',  familyId: 'f2', price: 24,  emoji: '🍌', tag: '',           grad: G.gold,       desc: 'معصوب موز بالعسل والقشطة والمكسّرات.',             delivery: ALL_DELIVERY },
  { id: 'd12', name: 'خبز بر بلدي',     cat: 'bakery',  cuisine: 'saudi',  familyId: 'f3', price: 10,  emoji: '🍞', tag: 'صحي',        grad: G.cream,      desc: 'خبز بلدي بدقيق البر الكامل، يُخبز يومياً.',        delivery: ALL_DELIVERY },
  { id: 'd13', name: 'قهوة عربية (ترمس)', cat: 'drinks', cuisine: 'saudi', familyId: 'f6', price: 25,  emoji: '☕', tag: '',           grad: G.brown,      desc: 'قهوة عربية بالهيل والزعفران، ترمس كامل مع التمر.', delivery: ALL_DELIVERY },
  { id: 'd14', name: 'مخلل مشكّل',       cat: 'pantry',  cuisine: 'saudi',  familyId: 'f4', price: 18,  emoji: '🥒', tag: '',           grad: G.green,      desc: 'خضار مخلّلة بيتية بوصفة تقليدية.',                delivery: ['pickup','family'] },
  { id: 'd15', name: 'مربّى تين بلدي',   cat: 'pantry',  cuisine: 'saudi',  familyId: 'f4', price: 28,  emoji: '🍯', tag: 'بلدي',       grad: G.gold,       desc: 'مربّى تين طبيعي من مزارع محلية، برطمان كبير.',     delivery: ALL_DELIVERY },

  // ---- شامي ----
  { id: 'd16', name: 'منسف لحم',        cat: 'main',    cuisine: 'shami',  familyId: 'f7', price: 55,  emoji: '🍚', tag: 'شهير',       grad: G.deepOrange, desc: 'منسف أردني بلحم الغنم واللبن الجميد والصنوبر.',    delivery: ALL_DELIVERY },
  { id: 'd17', name: 'مقلوبة دجاج',     cat: 'main',    cuisine: 'shami',  familyId: 'f7', price: 38,  emoji: '🍲', tag: '',           grad: G.deepOrange, desc: 'مقلوبة بالباذنجان والدجاج والرز المتبّل.',         delivery: ALL_DELIVERY },
  { id: 'd18', name: 'ورق عنب',         cat: 'main',    cuisine: 'shami',  familyId: 'f7', price: 42,  emoji: '🍃', tag: '',           grad: G.green,      desc: 'ورق عنب محشي بالرز واللحم، ملفوف بعناية.',         delivery: ['pickup','family'] },
  { id: 'd19', name: 'كبة مقلية (١٠)',  cat: 'starter', cuisine: 'shami',  familyId: 'f7', price: 28,  emoji: '🧆', tag: '',           grad: G.brown,      desc: 'كبة برغل مقرمشة بحشوة لحم وصنوبر.',                delivery: ALL_DELIVERY },
  { id: 'd20', name: 'تبولة',           cat: 'starter', cuisine: 'shami',  familyId: 'f5', price: 16,  emoji: '🥗', tag: 'طازج',       grad: G.green,      desc: 'بقدونس وبرغل وطماطم وليمون طازج.',                 delivery: ALL_DELIVERY },
  { id: 'd21', name: 'فتوش',            cat: 'starter', cuisine: 'shami',  familyId: 'f5', price: 15,  emoji: '🥗', tag: '',           grad: G.green,      desc: 'خضار مقرمشة مع خبز محمّص ودبس الرمان.',            delivery: ALL_DELIVERY },
  { id: 'd22', name: 'حمص بطحينة',      cat: 'starter', cuisine: 'shami',  familyId: 'f5', price: 14,  emoji: '🥣', tag: '',           grad: G.cream,      desc: 'حمص كريمي بالطحينة وزيت الزيتون.',                delivery: ALL_DELIVERY },
  { id: 'd23', name: 'كنافة نابلسية',   cat: 'sweets',  cuisine: 'shami',  familyId: 'f2', price: 30,  emoji: '🍰', tag: 'الأكثر طلباً', grad: G.deepOrange, desc: 'كنافة بالجبن والقطر، تُحضّر بعد الطلب.',          delivery: ALL_DELIVERY },
  { id: 'd24', name: 'بقلاوة',          cat: 'sweets',  cuisine: 'shami',  familyId: 'f2', price: 35,  emoji: '🥮', tag: '',           grad: G.gold,       desc: 'بقلاوة بالفستق الحلبي وطبقات رقيقة مقرمشة.',       delivery: ['pickup','courier'] },

  // ---- مصري ----
  { id: 'd25', name: 'كشري مصري',       cat: 'main',    cuisine: 'egypt',  familyId: 'f8', price: 25,  emoji: '🍜', tag: 'شعبي',       grad: G.gold,       desc: 'رز وعدس ومكرونة وحمص مع الدقة والصلصة.',           delivery: ALL_DELIVERY },
  { id: 'd26', name: 'ملوخية بالدجاج',  cat: 'main',    cuisine: 'egypt',  familyId: 'f8', price: 30,  emoji: '🥬', tag: '',           grad: G.green,      desc: 'ملوخية خضراء بالثوم والكزبرة مع دجاج مشوي.',       delivery: ['pickup','family'] },
  { id: 'd27', name: 'محشي كرنب',       cat: 'main',    cuisine: 'egypt',  familyId: 'f8', price: 32,  emoji: '🥬', tag: '',           grad: G.green,      desc: 'ورق كرنب محشي بالرز المتبّل على الطريقة المصرية.', delivery: ['pickup','family'] },
  { id: 'd28', name: 'فطير مشلتت',      cat: 'pastry',  cuisine: 'egypt',  familyId: 'f8', price: 22,  emoji: '🥧', tag: '',           grad: G.gold,       desc: 'فطير مصري بطبقات هشة، حلو أو حادق.',               delivery: ALL_DELIVERY },

  // ---- يمني / خليجي ----
  { id: 'd29', name: 'مندي لحم',        cat: 'main',    cuisine: 'yemeni', familyId: 'f9', price: 58,  emoji: '🍖', tag: 'مميّز',      grad: G.deepOrange, desc: 'لحم غنم مدخّن في التنور مع رز المندي.',            delivery: ALL_DELIVERY },
  { id: 'd30', name: 'زربيان دجاج',     cat: 'main',    cuisine: 'yemeni', familyId: 'f9', price: 42,  emoji: '🍛', tag: '',           grad: G.orange,     desc: 'زربيان يمني بالبهارات والدجاج والبطاطس.',          delivery: ALL_DELIVERY },
  { id: 'd31', name: 'مطبّق يمني',       cat: 'pastry',  cuisine: 'yemeni', familyId: 'f9', price: 20,  emoji: '🫓', tag: '',           grad: G.gold,       desc: 'مطبّق يمني بالموز والعسل أو باللحم.',              delivery: ['pickup','family'] },
  { id: 'd32', name: 'شاي كرك',         cat: 'drinks',  cuisine: 'gulf',   familyId: 'f6', price: 8,   emoji: '🍵', tag: '',           grad: G.brown,      desc: 'شاي كرك بالحليب والهيل، دافئ ومنعش.',              delivery: ALL_DELIVERY },
  { id: 'd33', name: 'عصير طبيعي',      cat: 'drinks',  cuisine: 'saudi',  familyId: 'f6', price: 12,  emoji: '🧃', tag: '',           grad: G.gold,       desc: 'عصير موسمي طبيعي بدون سكر مضاف.',                 delivery: ALL_DELIVERY },
];
