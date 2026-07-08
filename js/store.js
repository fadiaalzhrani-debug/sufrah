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
    return {
      id: k.id, name: k.name, cuisine: k.cuisine,
      spec: (CUISINE_BY_ID[k.cuisine] || {}).name || 'أكل بيت',
      rating: Number(k.rating) || 5, time: '٤٥ د',
      cover: k.emoji || '🍽️', grad: gradForCuisine(k.cuisine),
      city: k.city, isNew: true, owner: k.owner,
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
    const [ks, ds] = await Promise.all([
      sb.from('kitchens').select('*').order('created_at', { ascending: false }),
      sb.from('dishes').select('*').order('created_at', { ascending: false }),
    ]);
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
      ? { id: k.id, owner: uid, kitchenName: k.name, cuisine: k.cuisine, city: k.city, emoji: k.emoji, email: session.user.email }
      : { id: null, owner: uid, kitchenName: session.user.email, cuisine: 'saudi', city: '', emoji: '🍽️', email: session.user.email };
  }

  async function init() {
    await loadAccount();
    await refresh();
    try {
      sb.channel('sufrah-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchens' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, refresh)
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

  /* ---------- إعلانات الأدمن ---------- */
  async function getAnnouncements() {
    const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(5);
    return data || [];
  }

  /* ---------- سلة العميل (محلية على جهازه) ---------- */
  const CART_KEY = 'sufrah_cart_v1';
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } };
  const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

  return {
    init, onChange, refresh,
    allFamilies, allDishes, familyById, currentAccount, dishesByAccount,
    register, login, logout, addDish, deleteDish, getAnnouncements,
    getCart, saveCart,
  };
})();
