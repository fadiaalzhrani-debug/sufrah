-- ============================================================
--  سُفرة · 004_seed.sql · الإعدادات والمدن والتصنيفات وبيانات تجريبية (is_demo)
--  البيانات التجريبية تنحذف بزر من لوحة الإدارة قبل الإطلاق
-- ============================================================

insert into public.sf_settings (key, value, is_public, note) values
  ('app_name', 'سُفرة', true, 'اسم التطبيق'),
  ('app_name_en', 'Sufrah', true, null),
  ('tagline_ar', 'أكل بيت من الأسر المنتجة', true, null),
  ('tagline_en', 'Home cooking from local families', true, null),
  ('support_whatsapp', '', true, 'رقم الدعم بالواتساب 9665XXXXXXXX'),
  ('commission_pct', '12', false, 'عمولة المنصة الافتراضية من قيمة الأكل'),
  ('pay_card_enabled', '0', true, 'الدفع بالبطاقة (يحتاج حساب ميسر)'),
  ('pay_cod_enabled', '1', true, 'الدفع عند الاستلام'),
  ('pay_cod_max', '400', true, 'أعلى مبلغ للدفع عند الاستلام'),
  ('pay_timeout_min', '20', true, 'مهلة الدفع بالدقائق'),
  ('accept_timeout_min', '15', true, 'مهلة قبول الأسرة للطلب الفوري'),
  ('accept_timeout_sched_min', '180', true, 'مهلة قبول الطلب المجدول'),
  ('slot_minutes', '60', true, 'طول فترة الموعد'),
  ('delivery_eta_min', '25', true, 'متوسط وقت التوصيل'),
  ('asap_max_lead_min', '150', true, 'أطول تجهيز يسمح بالطلب الفوري'),
  ('road_factor', '1.25', false, 'معامل المسافة بالطريق'),
  ('small_order_threshold', '0', true, 'حد الطلب الصغير (0 = بدون)'),
  ('small_order_fee', '5', true, 'رسوم الطلب الصغير'),
  ('welcome_discount', '0', true, 'خصم أول طلب بالريال (0 = بدون)'),
  ('credits_enabled', '0', true, 'الرصيد'),
  ('referral_enabled', '0', true, 'دعوة صديق'),
  ('referral_friend_credit', '10', true, null),
  ('referral_reward_credit', '10', true, null),
  ('vat_registered', '0', true, 'مسجل بالضريبة'),
  ('vat_pct', '15', true, null),
  ('vat_number', '', true, null),
  ('legal_name', '', true, 'الاسم النظامي للفاتورة'),
  ('cr_number', '', true, 'رقم السجل'),
  ('home_note_ar', 'أكل بيوت طازج من أسر الشرقية، يوصلك لين بابك', true, null),
  ('home_note_en', 'Fresh home cooking from Eastern Province families, delivered to your door', true, null),
  ('maintenance', '0', true, 'إيقاف الطلبات مؤقتًا'),
  ('wa_enabled', '0', false, 'بوت واتساب'),
  ('vapid_public', '', true, 'مفتاح إشعارات المتصفح العام')
on conflict (key) do nothing;

insert into public.sf_cities (id, name_ar, name_en, lat, lng, active, sort) values
  ('khobar', 'الخبر', 'Al Khobar', 26.2794, 50.2083, true, 1),
  ('dammam', 'الدمام', 'Dammam', 26.4207, 50.0888, true, 2),
  ('dhahran', 'الظهران', 'Dhahran', 26.2361, 50.0393, true, 3),
  ('qatif', 'القطيف', 'Qatif', 26.5196, 50.0115, false, 4),
  ('jubail', 'الجبيل', 'Jubail', 27.0046, 49.6460, false, 5),
  ('ahsa', 'الأحساء', 'Al Ahsa', 25.3833, 49.5833, false, 6),
  ('riyadh', 'الرياض', 'Riyadh', 24.7136, 46.6753, false, 7),
  ('jeddah', 'جدة', 'Jeddah', 21.4858, 39.1925, false, 8)
on conflict (id) do nothing;

insert into public.sf_categories (id, name_ar, name_en, sort) values
  ('traditional', 'شعبيات', 'Traditional', 1),
  ('rice', 'رز ومندي', 'Rice & Mandi', 2),
  ('pastries', 'معجنات', 'Pastries', 3),
  ('sweets', 'حلا', 'Sweets', 4),
  ('breakfast', 'فطور', 'Breakfast', 5),
  ('feasts', 'عزايم وولائم', 'Feasts', 6),
  ('frozen', 'مفرزنات', 'Frozen', 7),
  ('healthy', 'صحي', 'Healthy', 8)
on conflict (id) do nothing;

-- ───────── أسر تجريبية ─────────
do $$
declare f1 uuid; f2 uuid; f3 uuid; f4 uuid; d int;
  size_opts jsonb := '[{"id":"size","name_ar":"الحجم","name_en":"Size","type":"single","required":true,"choices":[{"id":"s1","name_ar":"نفر","name_en":"Single","price":0},{"id":"s2","name_ar":"نفرين","name_en":"For two","price":22},{"id":"s4","name_ar":"عائلي (4 أشخاص)","name_en":"Family (4)","price":55}]},{"id":"extra","name_ar":"إضافات","name_en":"Extras","type":"multi","required":false,"max":3,"choices":[{"id":"x1","name_ar":"سلطة خضراء","name_en":"Green salad","price":6},{"id":"x2","name_ar":"دقوس","name_en":"Tomato dakkous","price":3},{"id":"x3","name_ar":"لبن","name_en":"Laban","price":4}]}]';
begin
  if exists (select 1 from public.sf_families where is_demo) then return; end if;

  insert into public.sf_families (slug, name_ar, name_en, bio_ar, bio_en, city_id, district, status, prep_min, min_order, delivery_max_km, cuisines, tags, featured, sort, is_demo, rating_avg, rating_count)
  values ('umfahad', 'مطبخ أم فهد', 'Um Fahad Kitchen', 'أكلات نجدية على أصولها، جريش وقرصان ومرقوق بطبخ البيت وبهارات أم فهد الخاصة.',
          'Najdi home classics: jareesh, qursan and marqooq with Um Fahad''s own spice mix.', 'khobar', 'العقربية', 'active', 60, 30, 12,
          '{سعودي,نجدي}', '{شعبي,طبخ يومي}', true, 1, true, 4.8, 126)
  returning id into f1;
  insert into public.sf_families (slug, name_ar, name_en, bio_ar, bio_en, city_id, district, status, prep_min, min_order, delivery_max_km, cuisines, tags, featured, sort, is_demo, rating_avg, rating_count)
  values ('halabait', 'حلا البيت', 'Hala Al Bait', 'حلويات بيتية طازجة كل يوم: لقيمات مقرمشة، بسبوسة بالقشطة، وكيك التمر بالدبس.',
          'Fresh homemade sweets daily: crispy luqaimat, cream basbousa and date cake.', 'dammam', 'الفيصلية', 'active', 40, 25, 10,
          '{حلويات}', '{حلا,مناسبات}', true, 2, true, 4.9, 214)
  returning id into f2;
  insert into public.sf_families (slug, name_ar, name_en, bio_ar, bio_en, city_id, district, status, prep_min, min_order, delivery_max_km, cuisines, tags, sort, is_demo, rating_avg, rating_count)
  values ('jood', 'معجنات جود', 'Jood Bakes', 'معجنات وفطائر بالعجينة البيتية، وسمبوسة جاهزة للقلي تحفظ بالفريزر لرمضان والعزايم.',
          'Home-dough pastries and freezer-ready sambousa for gatherings.', 'dhahran', 'الدوحة', 'active', 50, 30, 10,
          '{معجنات}', '{فطور,مفرزنات}', 3, true, 4.7, 88)
  returning id into f3;
  insert into public.sf_families (slug, name_ar, name_en, bio_ar, bio_en, city_id, district, status, prep_min, min_order, delivery_max_km, preorder_days, cuisines, tags, sort, is_demo, rating_avg, rating_count)
  values ('walaem', 'سفرة الولائم', 'Walaem Table', 'صواني العزايم والمناسبات: مندي وكبسة لحم ومظبي، بالطلب المسبق وتوصل حارة.',
          'Feast trays for gatherings: mandi, lamb kabsa and mathbi, pre-order and delivered hot.', 'khobar', 'الراكة', 'active', 90, 120, 15, 7,
          '{سعودي,يمني}', '{عزايم,ولائم}', 4, true, 4.6, 57)
  returning id into f4;

  insert into public.sf_family_private (family_id, lat, lng, address_text) values
    (f1, 26.2896, 50.1985, 'الخبر، العقربية'), (f2, 26.4183, 50.0790, 'الدمام، الفيصلية'),
    (f3, 26.2700, 50.1340, 'الظهران، الدوحة'), (f4, 26.3185, 50.2180, 'الخبر، الراكة');

  for d in 0 .. 6 loop
    insert into public.sf_family_hours (family_id, dow, open_min, close_min) values
      (f1, d, 660, 1320), (f2, d, 600, 1380), (f3, d, 420, 1260), (f4, d, 720, 1350);
  end loop;

  insert into public.sf_dishes (family_id, category_id, section, name_ar, name_en, desc_ar, desc_en, price, old_price, serves, prep_min, daily_limit, options, sort, is_demo) values
    (f1, 'traditional', 'الأطباق الرئيسية', 'جريش بالدجاج', 'Jareesh with chicken', 'جريش مطبوخ على نار هادية باللبن والدجاج، ومحمّس بالبصل والسمن البري.', 'Slow-cooked cracked wheat with laban and chicken, topped with fried onion.', 32, null, 'يكفي شخصين', null, 25, '[]', 1, true),
    (f1, 'traditional', 'الأطباق الرئيسية', 'قرصان باللحم', 'Qursan with lamb', 'رقائق القرصان البيتية بمرق اللحم والخضار والكوسا والقرع.', 'Thin home bread in a lamb and vegetable stew.', 45, null, 'يكفي شخصين', 75, 15, '[]', 2, true),
    (f1, 'traditional', 'الأطباق الرئيسية', 'مرقوق', 'Marqooq', 'عجينة المرقوق مع مرق اللحم والطماطم والكوسا.', 'Dough pieces cooked in a rich lamb and tomato stew.', 40, null, 'يكفي شخصين', null, null, '[]', 3, true),
    (f1, 'rice', 'الرز', 'كبسة دجاج', 'Chicken kabsa', 'رز بسمتي ببهارات الكبسة ونص دجاجة محمرة، مع دقوس.', 'Basmati rice in kabsa spices with half a roasted chicken.', 35, 40, null, null, 30, size_opts, 4, true),
    (f1, 'traditional', 'الأطباق الرئيسية', 'سليق طائفي', 'Taifi saleeg', 'رز سليق بالحليب ومرق الدجاج، ودجاج محمّر بالفرن.', 'Creamy rice in milk and chicken broth with roasted chicken.', 38, null, 'يكفي شخص', null, null, '[]', 5, true),
    (f1, 'breakfast', 'الفطور', 'معصوب بالموز', 'Banana masoub', 'خبز البر مهروس بالموز والسمن والعسل، يقدّم بالقشطة.', 'Mashed wholewheat bread with banana, ghee and honey.', 22, null, 'يكفي شخص', 25, null, '[{"id":"top","name_ar":"الإضافة","name_en":"Topping","type":"multi","required":false,"max":2,"choices":[{"id":"t1","name_ar":"قشطة","name_en":"Cream","price":4},{"id":"t2","name_ar":"عسل سدر","name_en":"Sidr honey","price":6}]}]', 6, true),

    (f2, 'sweets', 'الحلا', 'لقيمات بالدبس', 'Luqaimat with date syrup', 'لقيمات مقرمشة من برا وطرية من جوا، بالدبس والسمسم.', 'Crispy dumplings drizzled with date syrup and sesame.', 18, null, '20 حبة', 20, 40, '[{"id":"sauce","name_ar":"الصوص","name_en":"Sauce","type":"single","required":true,"choices":[{"id":"d1","name_ar":"دبس تمر","name_en":"Date syrup","price":0},{"id":"d2","name_ar":"شوكولاتة","name_en":"Chocolate","price":3},{"id":"d3","name_ar":"عسل","name_en":"Honey","price":4}]},{"id":"qty","name_ar":"الكمية","name_en":"Box","type":"single","required":true,"choices":[{"id":"q20","name_ar":"20 حبة","name_en":"20 pcs","price":0},{"id":"q40","name_ar":"40 حبة","name_en":"40 pcs","price":15}]}]', 1, true),
    (f2, 'sweets', 'الحلا', 'بسبوسة بالقشطة', 'Basbousa with cream', 'بسبوسة بالسميد والقشطة وقطر الهيل، صينية صغيرة.', 'Semolina cake with cream and cardamom syrup, small tray.', 45, null, '12 قطعة', null, 12, '[]', 2, true),
    (f2, 'sweets', 'الكيك', 'كيكة التمر بالدبس', 'Date cake', 'كيكة تمر طرية بصوص الدبس والجوز.', 'Soft date cake with date-syrup sauce and walnuts.', 55, null, '8 قطع', 90, 8, '[]', 3, true),
    (f2, 'sweets', 'الكيك', 'تشيز كيك لوتس', 'Lotus cheesecake', 'تشيز كيك بارد بطبقة لوتس، يحتاج طلب قبلها بيوم.', 'Chilled cheesecake with a Lotus layer, order a day ahead.', 85, 95, '10 قطع', null, 5, '[]', 4, true),
    (f2, 'sweets', 'الحلا', 'معمول تمر', 'Date maamoul', 'معمول بالسميد ومحشي تمر بالهيل، علبة نص كيلو.', 'Semolina maamoul filled with cardamom dates, half kilo.', 48, null, 'نص كيلو', null, null, '[]', 5, true),

    (f3, 'pastries', 'المعجنات', 'فطاير مشكلة', 'Mixed fatayer', 'جبن وزعتر وسبانخ ولبنة، علبة 12 حبة طازجة من الفرن.', 'Cheese, zaatar, spinach and labneh pies, box of 12.', 36, null, '12 حبة', null, null, '[]', 1, true),
    (f3, 'frozen', 'جاهزة للقلي', 'سمبوسة لحم مفرزنة', 'Frozen meat sambousa', 'سمبوسة بالعجينة البيتية محشية لحم مفروم، تحفظ بالفريزر.', 'Home-dough sambousa with minced meat, freezer ready.', 30, null, '20 حبة', null, null, '[{"id":"fill","name_ar":"الحشوة","name_en":"Filling","type":"single","required":true,"choices":[{"id":"m","name_ar":"لحم","name_en":"Meat","price":0},{"id":"c","name_ar":"جبن","name_en":"Cheese","price":0},{"id":"v","name_ar":"خضار","name_en":"Veggie","price":-2}]},{"id":"cook","name_ar":"الحالة","name_en":"State","type":"single","required":true,"choices":[{"id":"fz","name_ar":"مفرزنة","name_en":"Frozen","price":0},{"id":"fr","name_ar":"مقلية جاهزة","name_en":"Fried, ready","price":8}]}]', 2, true),
    (f3, 'breakfast', 'الفطور', 'شكشوكة بالجبن', 'Cheese shakshuka', 'بيض وطماطم وفلفل وجبنة، مع خبز صاج.', 'Eggs in tomato and pepper sauce with cheese and saj bread.', 24, null, 'يكفي شخص', 20, null, '[]', 3, true),
    (f3, 'pastries', 'المعجنات', 'كليجا القصيم', 'Kleija', 'كليجا بالتمر والهيل والزنجبيل، علبة 10 حبات.', 'Qassim date cookies with cardamom and ginger, 10 pcs.', 28, null, '10 حبات', null, null, '[]', 4, true),
    (f3, 'frozen', 'جاهزة للقلي', 'ورق عنب', 'Stuffed vine leaves', 'ورق عنب بالرز والدبس والليمون، علبة 40 حبة جاهزة للطبخ.', 'Vine leaves stuffed with rice, ready to cook, 40 pcs.', 42, null, '40 حبة', null, null, '[]', 5, true),

    (f4, 'feasts', 'الولائم', 'مندي لحم (صينية)', 'Lamb mandi tray', 'نص ذبيحة حري مندي على الحطب، رز بسمتي ومكسرات. طلب مسبق قبلها بيوم.', 'Half Hari lamb mandi with basmati and nuts. Order a day ahead.', 650, null, 'يكفي 8 إلى 10', null, 3, '[]', 1, true),
    (f4, 'rice', 'الصواني', 'صينية كبسة لحم', 'Lamb kabsa tray', 'كبسة لحم نعيمي للعزايم، مع سلطة ودقوس.', 'Lamb kabsa feast tray with salad and dakkous.', 280, 310, 'يكفي 5 إلى 6', 180, 6, '[]', 2, true),
    (f4, 'rice', 'الصواني', 'مظبي دجاج', 'Chicken mathbi', 'دجاج مظبي على الحجر مع رز مندي، صينية لأربعة.', 'Stone-grilled chicken with mandi rice, tray for four.', 140, null, 'يكفي 4', 120, 10, '[]', 3, true),
    (f4, 'feasts', 'الولائم', 'حنيذ لحم', 'Haneeth', 'لحم حنيذ مطبوخ ببطء في التنور، كيلو مع رز.', 'Slow-roasted haneeth lamb, one kilo with rice.', 190, null, 'يكفي 3 إلى 4', 240, 4, '[]', 4, true);

  update public.sf_dishes set min_lead_hours = 24 where family_id = f4 and name_ar like 'مندي لحم%';
  update public.sf_dishes set min_lead_hours = 20 where family_id = f2 and name_ar like 'تشيز كيك%';
end $$;

notify pgrst, 'reload schema';
