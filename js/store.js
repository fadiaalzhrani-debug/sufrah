/* ===================================================
   سُفرة — الربط بقاعدة البيانات السحابية (Supabase)
   يحلّ محل التخزين المحلي: بيانات مشتركة + لحظية للجميع.
   يُحمّل بعد data.js ومكتبة supabase-js.
   =================================================== */
const SUPABASE_URL = 'https://uzwuvzxdjijlbfguhlmc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_dgzFVD18hU5_s6k3p4Ubgg_5SJ-k3zp';

const SUFRAH = (function () {
  'use strict';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  const cache = { kitchens: [], dishes: [], account: null };
  let reviewAgg = {}; // kitchenId -> { sum, count }
  let onChangeCb = null;
  const emit = () => { if (typeof onChangeCb === 'function') onChangeCb(); };
  function onChange(cb) { onChangeCb = cb; }

  /* ---------- تدرّجات افتراضية (القاعدة ما تخزّن ألوان) ---------- */
  const CUISINE_GRAD = { saudi: G.orange, shami: G.deepOrange, egypt: G.gold, yemeni: G.deepOrange, gulf: G.brown };
  const CAT_GRAD = { main: G.orange, grill: G.red, pastry: G.gold, sweets: G.pink, bakery: G.cream, starter: G.green, drinks: G.brown, pantry: G.green };
  const gradForCuisine = (c) => CUISINE_GRAD[c] || DEFAULT_GRAD;
  const gradForCat = (c) => CAT_GRAD[c] || DEFAULT_GRAD;

  /* ---------- تحويل صفوف القاعدة لشكل الواجهة ---------- */
  function mapKitchen(k) {
    const agg = reviewAgg[k.id];
    return {
      id: k.id, name: k.name, cuisine: k.cuisine,
      spec: (CUISINE_BY_ID[k.cuisine] || {}).name || 'أكل بيت',
      rating: agg ? (agg.sum / agg.count) : (Number(k.rating) || 5),
      reviewCount: agg ? agg.count : 0,
      time: '٤٥ د',
      cover: k.emoji || '🍽️', grad: gradForCuisine(k.cuisine),
      city: k.city, isNew: true, owner: k.owner, isOpen: k.is_open !== false,
    };
  }
  function mapDish(d) {
    return {
      id: d.id, name: d.name, cat: d.category, cuisine: d.cuisine,
      familyId: d.kitchen_id, price: Number(d.price),
      img: d.image_url || '',
      emoji: d.image_url ? '' : ((CATEGORY_BY_ID[d.category] || {}).emoji || '🍽️'),
      grad: gradForCat(d.category), tag: d.tag || '', desc: d.description || '',
      delivery: (d.delivery && d.delivery.length) ? d.delivery : ALL_DELIVERY,
    };
  }

  /* ---------- تحميل البيانات المشتركة ---------- */
  async function refresh() {
    const [ks, ds, rv] = await Promise.all([
      sb.from('kitchens').select('*').order('created_at', { ascending: false }),
      sb.from('dishes').select('*').order('created_at', { ascending: false }),
      sb.from('reviews').select('kitchen_id,rating'),
    ]);
    reviewAgg = {};
    (rv.data || []).forEach((r) => {
      const a = reviewAgg[r.kitchen_id] || { sum: 0, count: 0 };
      a.sum += r.rating; a.count += 1; reviewAgg[r.kitchen_id] = a;
    });
    cache.kitchens = (ks.data || []).map(mapKitchen);
    cache.dishes = (ds.data || []).map(mapDish);
    emit();
  }

  async function loadAccount() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { cache.account = null; return; }
    const uid = session.user.id;
    const { data: k } = await sb.from('kitchens').select('*').eq('owner', uid).limit(1).maybeSingle();
    cache.account = k
      ? { id: k.id, owner: uid, kitchenName: k.name, cuisine: k.cuisine, city: k.city, emoji: k.emoji, email: session.user.email, isOpen: k.is_open !== false }
      : { id: null, owner: uid, kitchenName: session.user.email, cuisine: 'saudi', city: '', emoji: '🍽️', email: session.user.email, isOpen: true };
  }

  async function init() {
    await loadAccount();
    await refresh();
    try {
      sb.channel('sufrah-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchens' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refresh)
        .subscribe();
    } catch (e) { /* اللحظي اختياري */ }
    sb.auth.onAuthStateChange(() => { loadAccount().then(emit); });
  }

  /* ---------- القراءة (متزامنة من الكاش، مدموجة مع بيانات العرض) ---------- */
  const allFamilies = () => [...cache.kitchens, ...FAMILIES];
  const allDishes = () => [...cache.dishes, ...DISHES];
  const familyById = (id) => allFamilies().find((f) => f.id === id) || null;
  const currentAccount = () => cache.account;
  const dishesByAccount = (kid) => cache.dishes.filter((d) => d.familyId === kid);

  /* ---------- تسجيل الأسرة (حساب حقيقي عبر الأجهزة) ---------- */
  async function register(data) {
    const email = (data.email || '').trim();
    if (!email || !data.password) return { ok: false, error: 'أكمل البريد وكلمة المرور' };
    const { data: su, error: e1 } = await sb.auth.signUp({ email, password: data.password });
    if (e1) return { ok: false, error: /already|registered/i.test(e1.message) ? 'هذا البريد مسجّل من قبل' : e1.message };
    if (!su.session) return { ok: false, error: 'تأكيد الإيميل مفعّل — عطّله من إعدادات Supabase ثم أعد المحاولة.' };
    const uid = su.user.id;
    const { data: k, error: e2 } = await sb.from('kitchens').insert({
      owner: uid, name: (data.kitchenName || '').trim(), cuisine: data.cuisine || 'saudi',
      city: (data.city || '').trim(), emoji: data.emoji || '🍽️',
    }).select().single();
    if (e2) return { ok: false, error: 'تعذّر إنشاء المطبخ: ' + e2.message };
    cache.account = { id: k.id, owner: uid, kitchenName: k.name, cuisine: k.cuisine, city: k.city, emoji: k.emoji, email };
    await refresh();
    return { ok: true, account: cache.account };
  }

  async function login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email: (email || '').trim(), password });
    if (error) return { ok: false, error: 'البريد أو كلمة المرور غير صحيحة' };
    await loadAccount();
    return cache.account ? { ok: true, account: cache.account } : { ok: false, error: 'لا يوجد مطبخ مرتبط بهذا الحساب' };
  }

  async function logout() { await sb.auth.signOut(); cache.account = null; }

  /* ---------- الأطباق ---------- */
  async function addDish(dish) {
    const acc = cache.account; if (!acc || !acc.id) return { ok: false, error: 'سجّل دخولك أولاً' };
    const { error } = await sb.from('dishes').insert({
      kitchen_id: acc.id, name: dish.name, category: dish.cat, cuisine: dish.cuisine,
      price: dish.price, description: dish.desc, image_url: dish.img || null,
      delivery: dish.delivery, tag: dish.tag || 'جديد',
    });
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }
  async function deleteDish(id) { await sb.from('dishes').delete().eq('id', id); await refresh(); }
  async function setKitchenOpen(open) {
    const acc = cache.account; if (!acc || !acc.id) return { ok: false };
    const { error } = await sb.from('kitchens').update({ is_open: open }).eq('id', acc.id);
    if (!error) { acc.isOpen = open; await refresh(); }
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  /* ---------- إعلانات الأدمن ---------- */
  async function getAnnouncements() {
    const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(5);
    return data || [];
  }

  /* ---------- الطلبات ---------- */
  async function createOrder(order) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) order.customer_id = session.user.id;
    let { error } = await sb.from('orders').insert(order);
    // إن لم يوجد عمود الموعد بعد (لم تُشغّل schedule.sql) نحفظ الموعد داخل بيانات الطلب حتى لا يضيع
    if (error && order.scheduled_for && /scheduled_for|column|schema cache/i.test(error.message || '')) {
      const fb = { ...order };
      delete fb.scheduled_for;
      if (Array.isArray(fb.items) && fb.items[0]) {
        fb.items = fb.items.map((it, i) => (i === 0 ? { ...it, sched: order.scheduled_for } : it));
      }
      ({ error } = await sb.from('orders').insert(fb));
    }
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  /* ---------- حسابات العملاء ---------- */
  async function currentUser() {
    const { data: { session } } = await sb.auth.getSession();
    return session ? session.user : null;
  }
  async function registerCustomer(data) {
    const email = (data.email || '').trim();
    if (!email || !data.password) return { ok: false, error: 'أكمل البريد وكلمة المرور' };
    const { data: su, error } = await sb.auth.signUp({ email, password: data.password });
    if (error) return { ok: false, error: /registered|already/i.test(error.message) ? 'هذا البريد مسجّل من قبل' : error.message };
    if (!su.session) return { ok: false, error: 'تأكيد الإيميل مفعّل — عطّله من إعدادات Supabase.' };
    await sb.from('profiles').upsert({ id: su.user.id, full_name: (data.name || '').trim(), phone: (data.phone || '').trim() });
    return { ok: true, user: su.user };
  }
  async function loginCustomer(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email: (email || '').trim(), password });
    return error ? { ok: false, error: 'البريد أو كلمة المرور غير صحيحة' } : { ok: true };
  }

  /* ---------- الدخول برقم الجوال + رمز SMS (بدون بريد ولا كلمة مرور) ---------- */
  function normPhone(v) {
    let d = String(v || '').replace(/[^0-9]/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = '966' + d.slice(1);
    if (!d.startsWith('966')) d = '966' + d;
    return d;
  }
  async function sendPhoneCode(phone) {
    const d = normPhone(phone);
    if (d.length < 12) return { ok: false, error: 'رقم الجوال غير صحيح' };
    const { error } = await sb.auth.signInWithOtp({ phone: '+' + d, options: { channel: 'sms' } });
    if (error) return { ok: false, error: 'تعذّر إرسال الرمز — تأكد من الرقم وحاول مرة ثانية' };
    return { ok: true, phone: '+' + d, local: d };
  }
  async function verifyPhoneCode(phone, code, name) {
    const d = normPhone(phone);
    const { data, error } = await sb.auth.verifyOtp({ phone: '+' + d, token: String(code || '').trim(), type: 'sms' });
    if (error) return { ok: false, error: 'الرمز غير صحيح أو انتهت صلاحيته' };
    try {
      const u = data && data.user;
      if (u) {
        const patch = { id: u.id, phone: d };
        if (name && String(name).trim()) patch.full_name = String(name).trim();
        await sb.from('profiles').upsert(patch);
      }
    } catch (e) { /* الملف الشخصي اختياري */ }
    return { ok: true, user: data && data.user };
  }
  async function getProfile() {
    const u = await currentUser(); if (!u) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    return {
      id: u.id, email: u.email,
      full_name: (data && data.full_name) || '', phone: (data && data.phone) || '', address: (data && data.address) || '',
      cart: (data && data.cart) || null, city: (data && data.city) || null, notifs: (data && data.notifs) || null,
      points: (data && data.points) || 0,
    };
  }
  // حفظ رصيد النقاط (يفشل بصمت إن لم يوجد عمود points بعد — الميزة تتفعّل بعد تشغيل level3.sql)
  async function savePoints(n) {
    const u = await currentUser(); if (!u) return;
    await sb.from('profiles').upsert({ id: u.id, points: Math.max(0, Math.round(n)) });
  }
  async function saveProfile(p) {
    const u = await currentUser(); if (!u) return { ok: false };
    const { error } = await sb.from('profiles').upsert({ id: u.id, full_name: p.name, phone: p.phone, address: p.address });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  async function saveCustomerData(d) {
    const u = await currentUser(); if (!u) return;
    await sb.from('profiles').upsert({ id: u.id, ...d });
  }
  async function getMyOrders() {
    const u = await currentUser(); if (!u) return [];
    const { data } = await sb.from('orders').select('*').eq('customer_id', u.id).order('created_at', { ascending: false });
    return data || [];
  }

  /* ---------- التقييمات ---------- */
  async function addReview(r) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { ok: false, error: 'سجّل دخولك أولاً' };
    const row = { kitchen_id: r.kitchen_id, customer_id: session.user.id, rating: r.rating, comment: r.comment };
    if (r.image) row.image_url = r.image;
    let { error } = await sb.from('reviews').insert(row);
    // إن لم يوجد عمود الصورة بعد (لم تُشغّل reviews_image.sql) ننشر التقييم بدون صورة بدل أن يفشل
    if (error && r.image && /image_url|column|schema cache/i.test(error.message || '')) {
      const fb = { ...row }; delete fb.image_url;
      ({ error } = await sb.from('reviews').insert(fb));
    }
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  async function getKitchenReviews(kid) {
    const { data } = await sb.from('reviews').select('*').eq('kitchen_id', kid).order('created_at', { ascending: false });
    return data || [];
  }

  /* ---------- برنامج الإحالة (كود صديق) ---------- */
  async function getReferralInfo() {
    const u = await currentUser(); if (!u) return null;
    const { data: prof, error } = await sb.from('profiles').select('referral_code').eq('id', u.id).maybeSingle();
    if (error) return null; // العمود غير موجود بعد (لم تُشغّل level4.sql)
    let code = prof && prof.referral_code;
    if (!code) {
      code = ('SF' + u.id.replace(/-/g, '').slice(0, 6)).toUpperCase();
      await sb.from('profiles').upsert({ id: u.id, referral_code: code });
    }
    let count = 0, used = false;
    const c = await sb.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', u.id);
    if (!c.error) count = c.count || 0;
    const us = await sb.from('referrals').select('id').eq('referred_id', u.id).maybeSingle();
    if (!us.error) used = !!us.data;
    return { code, count, used };
  }
  async function redeemReferral(code) {
    const { data, error } = await sb.rpc('redeem_referral', { code: (code || '').trim() });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false, error: 'unknown' };
  }

  /* ---------- الاشتراكات الأسبوعية ---------- */
  async function createSubscription(s) {
    const u = await currentUser(); if (!u) return { ok: false, error: 'سجّل دخولك أولاً' };
    const { error } = await sb.from('subscriptions').insert({
      customer_id: u.id, customer_name: s.customer_name || null, customer_phone: s.customer_phone || null,
      kitchen_id: s.kitchen_id, days: s.days || [], note: s.note || null,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  async function getMySubscriptions() {
    const u = await currentUser(); if (!u) return [];
    const { data } = await sb.from('subscriptions').select('*').eq('customer_id', u.id).order('created_at', { ascending: false });
    return data || [];
  }
  async function updateSubscriptionStatus(id, status) {
    const { error } = await sb.from('subscriptions').update({ status }).eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  async function deleteSubscription(id) { await sb.from('subscriptions').delete().eq('id', id); }
  async function getKitchenSubscriptions(kid) {
    const { data } = await sb.from('subscriptions').select('*').eq('kitchen_id', kid).eq('status', 'active').order('created_at', { ascending: false });
    return data || [];
  }

  /* ---------- الكوبونات ---------- */
  async function getCoupon(code) {
    // التحقق يتم في الخادم بالكود المُدخل فقط — قائمة الكوبونات غير قابلة للسرد
    const { data } = await sb.rpc('check_coupon', { p_code: (code || '').trim() });
    return (data && data.ok) ? { code: data.code, discount_type: data.discount_type, value: data.value } : null;
  }
  async function getKitchenOrders(kitchenId) {
    const { data } = await sb.from('orders').select('*').eq('kitchen_id', kitchenId).order('created_at', { ascending: false });
    return data || [];
  }
  async function getAllOrders() {
    const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    return data || [];
  }
  async function updateOrderStatus(id, status) {
    const { error } = await sb.from('orders').update({ status }).eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  function subscribeOrders(cb) {
    return sb.channel('orders-rt-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb)
      .subscribe();
  }

  /* ---------- سلة العميل (محلية على جهازه) ---------- */
  const CART_KEY = 'sufrah_cart_v1';
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } };
  const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

  return {
    init, onChange, refresh,
    allFamilies, allDishes, familyById, currentAccount, dishesByAccount,
    register, login, logout, addDish, deleteDish, setKitchenOpen, getAnnouncements,
    createOrder, getKitchenOrders, getAllOrders, updateOrderStatus, subscribeOrders,
    currentUser, registerCustomer, loginCustomer, sendPhoneCode, verifyPhoneCode, normPhone,
    getProfile, saveProfile, saveCustomerData, getMyOrders,
    savePoints, getReferralInfo, redeemReferral,
    createSubscription, getMySubscriptions, updateSubscriptionStatus, deleteSubscription, getKitchenSubscriptions,
    addReview, getKitchenReviews, getCoupon,
    getCart, saveCart,
  };
})();
