/* ===================================================
   سُفرة — المتجر المشترك (localStorage)
   يُحمّل بعد data.js ويُستخدم في صفحتي العملاء والأسر.
   =================================================== */
const SUFRAH = (function () {
  'use strict';

  const K = {
    accounts: 'sufrah_accounts_v1',   // حسابات الأسر المنتجة
    session:  'sufrah_session_v1',     // الأسرة المسجّلة حالياً
    dishes:   'sufrah_user_dishes_v1', // الأطباق المضافة من الأسر
    cart:     'sufrah_cart_v1',        // سلة العميل
  };

  const read = (k, def) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; }
    catch { return def; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------- حسابات الأسر ---------- */
  function getAccounts() { return read(K.accounts, []); }

  function register(data) {
    const accounts = getAccounts();
    const uname = (data.username || '').trim();
    if (!uname || !data.password) return { ok: false, error: 'أكمل اسم المستخدم وكلمة المرور' };
    if (accounts.some(a => a.username.toLowerCase() === uname.toLowerCase()))
      return { ok: false, error: 'اسم المستخدم مستخدم من قبل، جرّب غيره' };

    const account = {
      id: 'acc_' + Date.now(),
      kitchenName: data.kitchenName.trim(),
      username: uname,
      password: data.password,
      cuisine: data.cuisine || 'saudi',
      city: (data.city || '').trim(),
      phone: (data.phone || '').trim(),
      emoji: data.emoji || '🍽️',
      grad: data.grad || DEFAULT_GRAD,
      rating: 5.0,
      createdAt: Date.now(),
    };
    accounts.push(account);
    write(K.accounts, accounts);
    write(K.session, account.id);
    return { ok: true, account };
  }

  function login(username, password) {
    const account = getAccounts().find(
      a => a.username.toLowerCase() === (username || '').trim().toLowerCase() && a.password === password
    );
    if (!account) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    write(K.session, account.id);
    return { ok: true, account };
  }

  function logout() { localStorage.removeItem(K.session); }
  function currentAccount() {
    const id = read(K.session, null);
    return getAccounts().find(a => a.id === id) || null;
  }

  /* ---------- أطباق الأسر ---------- */
  function getUserDishes() { return read(K.dishes, []); }

  function addDish(dish) {
    const dishes = getUserDishes();
    const nd = { id: 'ud_' + Date.now(), ...dish };
    dishes.push(nd);
    write(K.dishes, dishes);
    return nd;
  }
  function deleteDish(id) {
    write(K.dishes, getUserDishes().filter(d => d.id !== id));
  }
  function dishesByAccount(accId) {
    return getUserDishes().filter(d => d.familyId === accId);
  }

  /* ---------- الدمج مع البيانات الأساسية ---------- */
  function accountAsFamily(a) {
    return {
      id: a.id, name: a.kitchenName, spec: (CUISINE_BY_ID[a.cuisine] || {}).name || 'أكل بيت',
      cuisine: a.cuisine, rating: a.rating || 5.0, time: '٤٥ د',
      cover: a.emoji || '🍽️', grad: a.grad || DEFAULT_GRAD, city: a.city, isNew: true,
    };
  }
  function allFamilies() {
    return [...getAccounts().map(accountAsFamily), ...FAMILIES];
  }
  function allDishes() {
    return [...getUserDishes(), ...DISHES];
  }
  function familyById(id) {
    return allFamilies().find(f => f.id === id) || null;
  }

  /* ---------- سلة العميل ---------- */
  function getCart() { return read(K.cart, {}); }
  function saveCart(c) { write(K.cart, c); }

  return {
    KEYS: K,
    getAccounts, register, login, logout, currentAccount,
    getUserDishes, addDish, deleteDish, dishesByAccount,
    allFamilies, allDishes, familyById,
    getCart, saveCart,
  };
})();
