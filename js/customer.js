/* ============================================================
   سُفرة · تطبيق العميل (index.html)
   الرئيسية، البحث، صفحة الأسرة، السلة وإتمام الطلب، التتبع الحي،
   الفاتورة، الطلبات، الحساب، العناوين، المفضلة، الإشعارات.
   يعتمد على js/core.js (window.SF) بدون أي تعديل عليه.
   ============================================================ */
(function () {
  'use strict';

  /* ───────── اختصارات وأدوات ───────── */
  const t = (ar, en) => SF.t(ar, en);
  const esc = SF.esc;
  const ic = (n, c = '') => SF.icon(n, c);
  const nm = (row, base = 'name') => SF.nm(row, base);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LS = SF.LS;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms) => { let h; const d = (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(h); return d; };
  const mqDesk = window.matchMedia('(min-width: 900px)');
  const isDesk = () => mqDesk.matches;
  const LIVE = ['pending_payment', 'new', 'preparing', 'ready', 'on_the_way'];
  const DONE = ['delivered', 'picked_up'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const num1 = (n) => (Math.round((+n || 0) * 10) / 10).toFixed(1);
  const ono = (n) => `<span class="ono" dir="ltr">#${esc(n)}</span>`;
  const isoNo = (n) => `\u2066#${n}\u2069`;
  const hashOf = (s) => { let h = 7; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const ARN = (s) => String(s || '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ').trim();
  const errText = (e) => (e && e.text) || SF.errText(e);
  const isNative = () => !!(SF.isNative && SF.isNative());
  const isStandalone = () => isNative() || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const fwd = (cls = 's') => (SF.lang === 'ar' ? ic('chevL', cls) : ic('chevR', cls));
  const backIc = (cls = 's') => (SF.lang === 'ar' ? ic('arrowR', cls) : ic('arrowL', cls));

  /* ───────── الحالة ───────── */
  const S = {
    uid: null, me: { role: 'guest' },
    cities: LS.get('sf_cities_v1', []), cats: LS.get('sf_cats_v1', []),
    city: LS.get('sf_city_v1', null), geo: LS.get('sf_geo_v1', null),
    home: null, filters: { open: false, delivery: false, pickup: false, top: false, cat: null },
    cart: null, favs: new Set(), addrs: [], unread: 0, live: 0, notifCh: null,
    chrome: { mode: 'main', nav: true }, acts: {}, cleanup: [], routeKey: null, scroll: {}, depth: 0,
    F: null, co: null, sq: '', sdish: { q: '', list: [] }, payReturn: null, rateReturn: null, splashed: false,
    onCart: null, onNotif: null, booted: false,
  };

  /* ───────── أيقونات إضافية (نفس أسلوب core) ───────── */
  const GLYPH = {
    traditional: 'M4 10.5h16V13a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7zM2.5 11.5H4M20 11.5h1.5M9 7.5c0-1.3 1.2-1.5 1.2-2.8M13.2 7.5c0-1.3 1.2-1.5 1.2-2.8',
    rice: 'M3.5 12.5h17a8.5 8.5 0 0 1-17 0zM6.5 12.5a5.5 5.5 0 0 1 11 0M10 9.4h.01M13.2 8.9h.01M11.7 11h.01',
    pastries: 'M3.5 18.5 12 4.5l8.5 14zM8 12.2l8 6.3M12 4.5v6.3',
    sweets: 'M6.5 13h11l-1.4 7.5H7.9zM5.4 13c-.5-3.4 2.5-6 6.6-6s7.1 2.6 6.6 6zM12 7V4.5M10 16.3v2.2M14 16.3v2.2',
    breakfast: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1.2-1 1.4-1 2.6M12 3.5c0 1.2-1 1.4-1 2.6',
    feasts: 'M3 16.5h18M4.5 16.5a7.5 7.5 0 0 1 15 0M12 9V7M10 7h4M2.5 19.5h19',
    frozen: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5',
    healthy: 'M5 19c0-8 5-13.5 15-14-.3 10-5.8 15-14 15M5 19c2.5-3.5 5.5-6.2 9-8',
    card: 'M3 6.5h18v11H3zM3 10h18M6.5 14.5h4',
    cash: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v4M18 10v4',
  };
  const glyph = (id, cls = '') => (GLYPH[id] ? `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${GLYPH[id]}"/></svg>` : ic('dish', cls));
  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 22.5s-7.6-6.7-7.6-12.6a7.6 7.6 0 0 1 15.2 0c0 5.9-7.6 12.6-7.6 12.6zm0-9.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>';
  const STAR = 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';

  /* ───────── الصور: كتلة بديلة دايمًا تحت الصورة ───────── */
  function pic(url, { seed = '', icon = 'dish', g = null, alt = '' } = {}) {
    return `<span class="fb t${hashOf(seed) % 4}" aria-hidden="true">${g ? glyph(g) : ic(icon)}</span>` +
      (url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-fb>` : '');
  }
  function initial(name) {
    const s = String(name || '').replace(/^(مطبخ|مطابخ|معجنات|حلويات|سفرة|سُفرة|بيت|kitchen|the)\s+/i, '').replace(/^ال(?=\S{2,})/, '').trim();
    return (s || String(name || '?')).charAt(0).toUpperCase();
  }
  function logoHtml(f) {
    f = f || {};
    return `<span class="fb-logo t${hashOf(f.id || f.slug) % 4}" aria-hidden="true">${esc(initial(nm(f)))}</span>` +
      (f.logo_url ? `<img src="${esc(f.logo_url)}" alt="" loading="lazy" decoding="async" data-fb>` : '');
  }
  function settle(root = document) {
    $$('img[data-fb]', root).forEach((i) => { if (i.complete) { if (i.naturalWidth) i.classList.add('ok'); else i.remove(); } });
  }
  document.addEventListener('load', (e) => { const el = e.target; if (el && el.tagName === 'IMG' && el.hasAttribute('data-fb')) el.classList.add('ok'); }, true);
  document.addEventListener('error', (e) => { const el = e.target; if (el && el.tagName === 'IMG' && el.hasAttribute('data-fb')) el.remove(); }, true);

  /* ───────── الوقت (توقيت الرياض) ───────── */
  function riyadhNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { dow: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], min: (+p.hour % 24) * 60 + +p.minute, date: SF.todayISO() };
  }
  function fmtMin(m) {
    if (m == null) return '';
    const h = Math.floor(m / 60) % 24, mi = m % 60, h12 = h % 12 || 12;
    return `${h12}:${String(mi).padStart(2, '0')} ${h < 12 ? t('ص', 'AM') : t('م', 'PM')}`;
  }
  const dayOf = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  function dayWord(iso) {
    const d = dayOf(iso);
    if (d === SF.todayISO()) return t('اليوم', 'Today');
    if (d === SF.dayISO(1)) return t('بكرة', 'Tomorrow');
    return SF.fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'short' });
  }
  const winText = (s, e) => `${dayWord(s)} ${SF.fmtTime(s)}${e ? ` ${t('إلى', 'to')} ${SF.fmtTime(e)}` : ''}`;
  const DOW_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const DOW_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ───────── تحميل البيانات ───────── */
  async function loadCities() {
    try { const { data } = await SF.sb.from('sf_cities').select('id,name_ar,name_en,lat,lng,sort').eq('active', true).order('sort'); if (data) { S.cities = data; LS.set('sf_cities_v1', data); } } catch { /* */ }
  }
  async function loadCats() {
    try { const { data } = await SF.sb.from('sf_categories').select('id,name_ar,name_en,image_url,sort').eq('active', true).order('sort'); if (data) { S.cats = data; LS.set('sf_cats_v1', data); } } catch { /* */ }
  }
  const homeKey = () => 'sf_home_v1:' + (S.city || 'all');
  async function loadHome() {
    const h = await SF.rpc('sf_home', { p_city: S.city || null });
    S.home = { families: (h && h.families) || [], popular: (h && h.popular) || [], city: S.city || null };
    LS.set(homeKey(), S.home);
    return S.home;
  }
  const cityObj = (id) => S.cities.find((c) => c.id === id);
  async function refreshMe(force) { S.me = await SF.me(force); S.uid = S.me.uid || null; return S.me; }
  async function loadFavs() {
    if (!S.uid) { S.favs = new Set(); return; }
    try { const { data } = await SF.sb.from('sf_favorites').select('family_id').eq('user_id', S.uid); S.favs = new Set((data || []).map((r) => r.family_id)); } catch { /* */ }
  }
  async function refreshLive() {
    if (!S.uid) { S.live = 0; renderNav(); return; }
    try {
      const { count } = await SF.sb.from('sf_orders').select('id', { count: 'exact', head: true }).eq('user_id', S.uid).in('status', LIVE);
      S.live = count || 0;
    } catch { /* */ }
    renderNav(); renderTop();
  }
  async function refreshUnread() {
    if (!S.uid) { S.unread = 0; renderTop(); return; }
    try {
      const { count } = await SF.sb.from('sf_notifications').select('id', { count: 'exact', head: true }).eq('user_id', S.uid).is('read_at', null);
      S.unread = count || 0;
    } catch { /* */ }
    renderTop();
  }
  async function loadAddresses() {
    if (S.uid) {
      const { data } = await SF.sb.from('sf_addresses').select('*').eq('user_id', S.uid).order('is_default', { ascending: false }).order('created_at', { ascending: false });
      S.addrs = data || [];
    } else {
      const a = LS.get('sf_addr_v1', null);
      S.addrs = a ? [Object.assign({}, a, { id: 'local' })] : [];
    }
    return S.addrs;
  }

  /* ───────── السلة (لأسرة وحدة) ───────── */
  const emptyCart = () => ({ family_id: null, family_slug: null, family_ar: null, family_en: null, items: [] });
  function loadCart() { const c = LS.get('sf_cart_v1', null); return c && Array.isArray(c.items) ? c : emptyCart(); }
  S.cart = loadCart();
  const lineKey = (dishId, options, note) => `${dishId}|${[...(options || [])].map(String).sort().join(',')}|${String(note || '').trim()}`;
  const cartCount = () => S.cart.items.reduce((a, i) => a + (+i.qty || 0), 0);
  const cartSub = () => S.cart.items.reduce((a, i) => a + (+i.qty || 0) * (+i.unit_est || 0), 0);
  const cartFam = () => SF.t(S.cart.family_ar || '', S.cart.family_en || S.cart.family_ar || '');
  const itemName = (i) => SF.t(i.name_ar, i.name_en || i.name_ar);
  const itemOpts = (i) => SF.t(i.opts_ar || '', i.opts_en || i.opts_ar || '');
  function saveCart() {
    if (!S.cart.items.length) S.cart = emptyCart();
    LS.set('sf_cart_v1', S.cart);
    renderCartBar(); renderTop();
    if (S.onCart) S.onCart();
  }
  async function addToCart(fam, item) {
    if (S.cart.items.length && S.cart.family_id && S.cart.family_id !== fam.id) {
      const ok = await SF.confirm({
        title: t('تبدأ سلة جديدة؟', 'Start a new cart?'),
        body: t(`سلتك فيها أطباق من ${cartFam()}. إذا كمّلت بنفضيها ونبدأ سلة من ${nm(fam)}.`,
          `Your cart has dishes from ${cartFam()}. Continuing clears it and starts a new cart from ${nm(fam)}.`),
        ok: t('ابدأ سلة جديدة', 'Start a new cart'),
      });
      if (!ok) return false;
      S.cart = emptyCart();
    }
    Object.assign(S.cart, { family_id: fam.id, family_slug: fam.slug, family_ar: fam.name_ar, family_en: fam.name_en });
    const ex = S.cart.items.find((i) => i.key === item.key);
    if (ex) ex.qty = Math.min(50, ex.qty + item.qty); else S.cart.items.push(item);
    saveCart();
    return true;
  }
  function setQty(key, delta) {
    const it = S.cart.items.find((i) => i.key === key);
    if (!it) return;
    it.qty = Math.max(0, Math.min(50, it.qty + delta));
    if (!it.qty) S.cart.items = S.cart.items.filter((i) => i !== it);
    saveCart();
  }
  function bumpCart() {
    const el = $('#cartbar .cartbar') || $('#sideCart');
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  // حركة «انضاف للسلة»: نقطة تطير من الزر لين السلة
  function flyFrom(rect) {
    const target = $('#cartbar .cb-n') || (isDesk() && $('#sideCart .sc-head')) || $('.tb-cart');
    if (!rect || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) { bumpCart(); return; }
    const b = target.getBoundingClientRect();
    const dot = document.createElement('div');
    dot.className = 'fly-dot'; dot.innerHTML = ic('plus', 's');
    const x0 = rect.left + rect.width / 2 - 17, y0 = rect.top + rect.height / 2 - 17;
    dot.style.left = x0 + 'px'; dot.style.top = y0 + 'px';
    document.body.appendChild(dot);
    const dx = b.left + b.width / 2 - 17 - x0, dy = b.top + b.height / 2 - 17 - y0;
    const an = dot.animate([
      { transform: 'translate(0,0) scale(.6)', opacity: 0 },
      { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.35, 0) - 70}px) scale(1.1)`, opacity: 1, offset: 0.42 },
      { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.4 },
    ], { duration: 640, easing: 'cubic-bezier(.45,0,.25,1)' });
    an.onfinish = () => { dot.remove(); bumpCart(); };
  }

  /* ───────── الإطار: الشريط العلوي، التنقل السفلي، شريط السلة ───────── */
  const NAV = () => [
    ['home', '#/', 'home', t('الرئيسية', 'Home')],
    ['search', '#/search', 'search', t('البحث', 'Search')],
    ['orders', '#/orders', 'receipt', t('طلباتي', 'Orders')],
    ['account', '#/account', 'user', t('حسابي', 'Account')],
  ];
  function chrome(o) {
    S.chrome = Object.assign({ mode: 'main', tab: null, nav: true, cartbar: false, title: '', acts: '', back: '#/' }, o);
    document.body.classList.toggle('no-bnav', !S.chrome.nav);
    document.body.dataset.mode = S.chrome.mode;
    renderTop(); renderNav(); renderCartBar(); dock('');
  }
  function renderTop() {
    const c = S.chrome || { mode: 'main' };
    const el = $('#top');
    if (!el) return;
    el.className = `topbar mode-${c.mode}${el.classList.contains('solid') ? ' solid' : ''}`;
    const city = cityObj(S.city);
    const n = cartCount();
    $('#topIn').innerHTML = `
      <div class="tb-sub">
        <button class="icon-btn tb-back" data-act="back" aria-label="${t('رجوع', 'Back')}">${backIc('')}</button>
        <div class="tb-title ellipsis">${esc(c.title || '')}</div>
      </div>
      <div class="tb-main">
        <a class="brand" href="#/" aria-label="${t('سُفرة', 'Sufrah')}"><img src="img/mark.svg" alt="" width="30" height="30"><span>${t('سُفرة', 'Sufrah')}</span></a>
        <button class="loc-chip ${city ? '' : 'is-empty'}" data-act="loc" aria-label="${t('موقع التوصيل', 'Delivery location')}">${ic('pin', 's')}<span class="ellipsis">${city ? esc(nm(city)) : t('حدد موقعك', 'Set location')}</span>${ic('chevD', 's')}</button>
      </div>
      <div class="grow"></div>
      <nav class="topnav" aria-label="${t('التنقل', 'Navigation')}">${NAV().map(([k, h, i, l]) => `<a href="${h}" class="${c.tab === k ? 'is-active' : ''}">${ic(i, 's')}<span>${l}</span>${k === 'orders' && S.live ? `<b class="tn-count" dir="ltr">${S.live}</b>` : ''}</a>`).join('')}</nav>
      <div class="tb-acts">${c.acts || ''}</div>
      <div class="tb-sys">
        ${n ? `<button class="icon-btn tb-cart" data-act="cart" aria-label="${t('السلة', 'Cart')}">${ic('bag')}<span class="badge-dot" dir="ltr">${n}</span></button>` : ''}
        <button class="icon-btn" data-act="bell" aria-label="${t('الإشعارات', 'Notifications')}">${ic('bell')}${S.unread ? `<span class="badge-dot" dir="ltr">${S.unread > 9 ? '9+' : S.unread}</span>` : ''}</button>
        <button class="icon-btn lang-btn" data-act="lang" aria-label="${SF.lang === 'ar' ? 'English' : 'العربية'}" title="${SF.lang === 'ar' ? 'English' : 'العربية'}">${ic('globe')}</button>
      </div>`;
  }
  function renderNav() {
    const c = S.chrome || {};
    $('#nav').classList.toggle('hide', !c.nav);
    $('#nav').setAttribute('aria-label', t('التنقل', 'Navigation'));
    $('#navIn').innerHTML = NAV().map(([k, h, i, l]) =>
      `<button data-href="${h}" class="${c.tab === k ? 'is-active' : ''}" aria-current="${c.tab === k ? 'page' : 'false'}">${ic(i)}<span>${l}</span>${k === 'orders' && S.live ? `<span class="count" dir="ltr">${S.live}</span>` : ''}</button>`).join('');
  }
  function renderCartBar() {
    const c = S.chrome || {};
    const el = $('#cartbar');
    const n = cartCount();
    const show = !!c.cartbar && n > 0 && !(c.mode === 'overlay' && isDesk());
    document.body.classList.toggle('has-cartbar', show);
    if (!show) { el.innerHTML = ''; return; }
    const enter = !el.firstElementChild;
    el.innerHTML = `<div class="cartbar ${c.nav ? 'over-nav' : ''} ${enter ? 'enter' : ''}">
      <button class="cb" data-act="checkout">
        <span class="cb-n">${n}</span>
        <span class="cb-t"><b>${t('إتمام الطلب', 'Checkout')}</b><small>${esc(cartFam())}</small></span>
        <span class="cb-p">${SF.moneyHtml(cartSub())}</span>
        ${fwd('s')}
      </button></div>`;
  }
  function dock(html) {
    const el = $('#dock');
    el.innerHTML = html || '';
    document.body.classList.toggle('has-dock', !!html);
  }

  /* ───────── التوجيه (hash router) ───────── */
  const ROUTES = [
    [/^$/, viewHome],
    [/^f\/([^/?]+)$/, viewFamily],
    [/^search$/, viewSearch],
    [/^checkout$/, viewCheckout],
    [/^orders$/, viewOrders],
    [/^order\/([0-9a-f-]{36})$/i, viewOrder],
    [/^account$/, viewAccount],
    [/^addresses$/, viewAddresses],
    [/^favorites$/, viewFavorites],
    [/^invoice\/([0-9a-f-]{36})$/i, viewInvoice],
  ];
  let navTok = 0, pushNav = false;
  function parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    let q = {};
    const i = h.indexOf('?');
    if (i >= 0) { q = Object.fromEntries(new URLSearchParams(h.slice(i + 1))); h = h.slice(0, i); }
    try { h = decodeURIComponent(h); } catch { /* */ }
    return { path: h.replace(/\/+$/, ''), q };
  }
  function go(hash, opts = {}) {
    if (opts.replace) { history.replaceState(null, '', hash); pushNav = true; route(); return; }
    pushNav = true;
    if (location.hash === hash) { route(); return; }
    S.depth++;
    location.hash = hash;
  }
  // رجوع داخل التطبيق: التاريخ لو فيه صفحات قبل، وإلا الصفحة الأم
  function back() {
    const fb = (S.chrome && S.chrome.back) || '#/';
    if (S.depth > 0) history.back(); else go(fb, { replace: true });
  }
  async function route(keepScroll) {
    const tok = ++navTok;
    S.cleanup.splice(0).forEach((f) => { try { f(); } catch { /* */ } });
    S.acts = {}; S.onCart = null; S.onNotif = null;
    if (S.routeKey) S.scroll[S.routeKey] = window.scrollY;
    const forward = pushNav && !keepScroll;
    if (!pushNav && !keepScroll && S.depth > 0 && S.booted) S.depth -= 1;
    pushNav = false;
    const key = location.hash || '#/';
    S.routeKey = key;
    const { path, q } = parseHash();
    let hit = null;
    for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { hit = [fn, m.slice(1)]; break; } }
    if (!hit) { history.replaceState(null, '', '#/'); hit = [viewHome, []]; S.routeKey = '#/'; }
    const view = $('#view');
    if (!keepScroll) { view.classList.remove('view-in'); void view.offsetWidth; view.classList.add('view-in'); }
    $('#top').classList.remove('solid');
    document.title = t('سُفرة', 'Sufrah');
    const ctx = { tok, isCur: () => tok === navTok };
    try { await hit[0](hit[1], q, ctx); } catch (e) { console.error(e); if (ctx.isCur()) renderErr(e); }
    if (!ctx.isCur()) return;
    settle(view);
    const y = forward ? 0 : (S.scroll[S.routeKey] || 0);
    requestAnimationFrame(() => window.scrollTo(0, y));
    if (!S.splashed) { S.splashed = true; SF.splash(1500); }
  }
  window.addEventListener('hashchange', () => route());

  /* ───────── نقرات عامة ───────── */
  const ACTS = {
    back: () => back(),
    loc: () => openLocation(),
    bell: () => openNotifs(),
    lang: () => SF.setLang(SF.lang === 'ar' ? 'en' : 'ar'),
    cart: () => go('#/checkout'),
    checkout: () => go('#/checkout'),
    cq: (el) => setQty(el.dataset.key, +el.dataset.d),
    login: async () => { await ensureLogin(); route(true); },
    photo: (el) => openPhoto(el.dataset.src),
    retry: () => route(true),
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.target.closest('.sheet')) return;
    const a = e.target.closest('[data-act]');
    if (a && !a.disabled && a.getAttribute('aria-disabled') !== 'true') {
      const fn = S.acts[a.dataset.act] || ACTS[a.dataset.act];
      if (fn) { e.preventDefault(); fn(a, e); return; }
    }
    const h = e.target.closest('[data-href]');
    if (h && !h.disabled) { e.preventDefault(); go(h.dataset.href); return; }
    const l = e.target.closest('a[href^="#/"]');
    if (l && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(l.getAttribute('href')); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act], [role="link"][data-href]')) { e.preventDefault(); e.target.click(); }
  });
  function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); S.cleanup.push(() => el.removeEventListener(ev, fn, opts)); }

  /* ───────── قطع واجهة مشتركة ───────── */
  const art = (inner) => `<div class="art">${inner}</div>`;
  const emptyBox = (icn, title, body = '', cta = '') =>
    `<div class="empty">${art(String(icn).startsWith('<') ? icn : ic(icn))}<h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${cta}</div>`;
  const starsRow = (v, sm) => `<span class="srow ${sm ? 'sm' : ''}" role="img" aria-label="${num1(v)} / 5">${[1, 2, 3, 4, 5].map((i) => `<svg class="ic ${(+v || 0) >= i - 0.25 ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg>`).join('')}</span>`;
  const ratingPill = (f) => (+f.rating_count > 0
    ? `<span class="stars">${ic('star')}${num1(f.rating_avg)} <span class="cnt">(${+f.rating_count})</span></span>`
    : `<span class="badge b-brand">${t('جديد', 'New')}</span>`);
  const sk = (w, h, r) => `<div class="skel" style="width:${w};height:${h}px${r ? ';border-radius:' + r : ''}"></div>`;
  const maint = () => SF.setOn('maintenance', false);
  function feeRange(tiers) {
    const fees = (Array.isArray(tiers) ? tiers : []).map((x) => +x.fee).filter((x) => Number.isFinite(x));
    return fees.length ? [Math.min(...fees), Math.max(...fees)] : null;
  }
  function feeText(f) {
    if (!f.delivery_enabled) return t('استلام فقط', 'Pickup only');
    const r = f.fee_from != null ? [+f.fee_from, +(f.fee_to ?? f.fee_from)] : feeRange(f.delivery_tiers);
    if (!r) return t('توصيل', 'Delivery');
    return r[0] === r[1] ? SF.money(r[0]) : `${t('من', 'From')} ${SF.money(r[0])}`;
  }
  function famBadge(f) {
    if (f.open_now) return `<span class="badge b-ok"><span class="dot"></span>${t('مفتوح الحين', 'Open now')}</span>`;
    if (f.is_open && f.opens_today_min != null) return `<span class="badge">${ic('clock', 's')}${t('تفتح الساعة', 'Opens at')} ${fmtMin(f.opens_today_min)}</span>`;
    return `<span class="badge b-bad">${t('مسكّر الحين', 'Closed now')}</span>`;
  }
  function openInfo(f, hours, off) {
    const n = riyadhNow();
    const isOff = (iso) => (off || []).some((x) => iso >= x.from_date && iso <= x.to_date);
    const day = (d) => (hours || []).filter((h) => h.dow === d).sort((a, b) => a.open_min - b.open_min);
    const today = day(n.dow);
    const cur = today.find((h) => n.min >= h.open_min && n.min < h.close_min);
    if (f.is_open && !isOff(n.date) && cur) return { open: true, close: cur.close_min };
    if (!f.is_open) return { open: false, paused: true };
    if (!isOff(n.date)) { const later = today.find((h) => h.open_min > n.min); if (later) return { open: false, at: later.open_min, inDays: 0 }; }
    for (let i = 1; i <= 7; i++) {
      const d = (n.dow + i) % 7;
      if (isOff(SF.dayISO(i))) continue;
      const hs = day(d);
      if (hs.length) return { open: false, at: hs[0].open_min, inDays: i, dow: d };
    }
    return { open: false };
  }
  function openBadge(oi) {
    if (oi.open) return `<span class="badge b-ok"><span class="dot"></span>${t('مفتوح الحين', 'Open now')} · ${t('يسكّر', 'closes')} ${fmtMin(oi.close)}</span>`;
    if (oi.at != null) {
      const txt = oi.inDays === 0 ? t(`تفتح الساعة ${fmtMin(oi.at)}`, `Opens at ${fmtMin(oi.at)}`)
        : oi.inDays === 1 ? t(`تفتح بكرة ${fmtMin(oi.at)}`, `Opens tomorrow ${fmtMin(oi.at)}`)
          : t(`تفتح ${DOW_AR[oi.dow]} ${fmtMin(oi.at)}`, `Opens ${DOW_EN[oi.dow]} ${fmtMin(oi.at)}`);
      return `<span class="badge b-warn">${ic('clock', 's')}${txt}</span>`;
    }
    return `<span class="badge b-bad">${t('مسكّر الحين', 'Closed now')}</span>`;
  }
  function renderErr(e) {
    $('#view').innerHTML = `<div class="page narrow">${emptyBox('alert', t('ما قدرنا نحمّل الصفحة', 'Could not load this page'), errText(e),
      `<button class="btn btn-primary" data-act="retry">${ic('refresh', 's')} ${t('جرّب مرة ثانية', 'Try again')}</button>`)}</div>`;
  }
  function needLogin(title, body) {
    $('#view').innerHTML = `<div class="page narrow ${S.chrome.nav ? '' : 'no-nav'}">${emptyBox('user', title, body,
      `<button class="btn btn-primary btn-lg" data-act="login">${ic('phone', 's')} ${t('سجّل دخولك', 'Sign in')}</button>`)}</div>`;
  }
  const famLink = (slug, dishId) => `#/f/${encodeURIComponent(slug)}${dishId ? `?d=${dishId}` : ''}`;
  function shareUrl(params) {
    const base = (SF.settings.app_url && (isNative() || location.protocol === 'file:')) ? SF.settings.app_url.replace(/\/?$/, '/') : location.origin + location.pathname;
    return base + (params ? '?' + params : '');
  }
  async function shareLink(title, text, url) {
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); SF.toast(t('انسخ الرابط', 'Link copied'), 'ok'); }
    catch {
      const s = SF.openSheet(`<div class="sheet-head"><h2>${t('انسخ الرابط', 'Copy the link')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
        <input class="input" dir="ltr" readonly value="${esc(url)}">`);
      const inp = $('input', s.sh); inp.focus(); inp.select();
    }
  }

  /* ═════════════════════ الرئيسية ═════════════════════ */
  async function viewHome(_, q, ctx) {
    if (maint()) return viewMaint();
    chrome({ mode: 'main', tab: 'home', nav: true, cartbar: true });
    const cached = (S.home && S.home.city === (S.city || null)) ? S.home : LS.get(homeKey(), null);
    if (cached) { S.home = cached; renderHome(); } else $('#view').innerHTML = homeSkel();
    S.acts = homeActs();
    try {
      await Promise.all([loadHome(), S.cats.length ? null : loadCats()]);
      if (ctx.isCur()) { renderHome(); settle($('#view')); }
    } catch (e) {
      if (!ctx.isCur()) return;
      if (!cached) renderErr(e); else SF.toast(errText(e), 'bad');
    }
  }
  function homeActs() {
    return {
      cat: (el) => { const id = el.dataset.id; S.filters.cat = S.filters.cat === id ? null : id; renderHome(); },
      filter: (el) => { const k = el.dataset.k; S.filters[k] = !S.filters[k]; renderHome(); },
      'clear-f': () => { S.filters = { open: false, delivery: false, pickup: false, top: false, cat: null }; renderHome(); },
    };
  }
  function heroHtml() {
    const hr = Math.floor(riyadhNow().min / 60);
    const greet = hr >= 4 && hr < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', hr >= 12 && hr < 17 ? 'Good afternoon' : 'Good evening');
    const first = String((S.me.profile && S.me.profile.name) || '').trim().split(/\s+/)[0];
    const note = t(SF.settings.home_note_ar || 'أكل بيوت طازج من أسر منطقتك، يوصلك لين بابك', SF.settings.home_note_en || 'Fresh home cooking from local families, delivered to your door');
    return `<section class="hero">
      <div class="hero-in">
        <h1 class="hello">${esc(greet)}${first ? `${t('، ', ', ')}${esc(first)}` : ''}</h1>
        <p class="note">${esc(note)}</p>
        <button class="hero-search" data-href="#/search">${ic('search')}<span>${t('ابحث عن طبق أو أسرة', 'Search dishes or kitchens')}</span></button>
      </div>
      <div class="sadu"></div>
    </section>`;
  }
  function homeSkel() {
    return `<div class="page home">${heroHtml()}
      <section class="section"><div class="cats-row">${Array.from({ length: 7 }, () => `<div class="cat-sk">${sk('70px', 70, '22px')}${sk('48px', 11)}</div>`).join('')}</div></section>
      <section class="section">${sk('150px', 22)}<div class="fam-grid">${Array.from({ length: 3 }, famSkelCard).join('')}</div></section></div>`;
  }
  const famSkelCard = () => `<div class="fam-card is-sk"><div class="cover skel" style="border-radius:0"></div><div class="body">${sk('62%', 18)}${sk('88%', 13)}${sk('40%', 13)}</div></div>`;
  function renderHome() {
    const h = S.home || { families: [], popular: [] };
    const F = S.filters;
    let fams = h.families.slice();
    const anyF = F.open || F.delivery || F.pickup || F.top || !!F.cat;
    if (F.open) fams = fams.filter((f) => f.open_now);
    if (F.delivery) fams = fams.filter((f) => f.delivery_enabled);
    if (F.pickup) fams = fams.filter((f) => f.pickup_enabled);
    if (F.cat) fams = fams.filter((f) => (f.categories || []).includes(F.cat));
    if (F.top) fams.sort((a, b) => (+b.rating_avg - +a.rating_avg) || (+b.rating_count - +a.rating_count));
    const featured = h.families.filter((f) => f.featured);
    const pop = h.popular.filter((d) => !F.cat || d.category_id === F.cat);
    const city = cityObj(S.city);
    const catName = F.cat ? nm(S.cats.find((c) => c.id === F.cat)) : '';
    const fl = [['open', 'clock', t('مفتوح الحين', 'Open now')], ['delivery', 'bike', t('توصيل', 'Delivery')], ['pickup', 'store', t('استلام', 'Pickup')], ['top', 'star', t('الأعلى تقييمًا', 'Top rated')]];
    $('#view').innerHTML = `<div class="page home">
      ${heroHtml()}
      ${S.cats.length ? `<section class="section cats-sec" aria-label="${t('التصنيفات', 'Categories')}"><div class="chips cats">${S.cats.map((c) => `
        <button class="cat ${F.cat === c.id ? 'is-active' : ''}" data-act="cat" data-id="${esc(c.id)}" aria-pressed="${F.cat === c.id}">
          <span class="ph">${pic(c.image_url, { seed: c.id, g: c.id })}</span><span>${esc(nm(c))}</span></button>`).join('')}</div></section>` : ''}
      <div class="chips filters" role="group" aria-label="${t('فلترة', 'Filters')}">${fl.map(([k, i, l]) => `<button class="chip ${F[k] ? 'is-active' : ''}" data-act="filter" data-k="${k}" aria-pressed="${!!F[k]}">${ic(i, 's')}${l}</button>`).join('')}</div>
      ${!h.families.length ? `<section class="section">${emptyBox(glyph('feasts'), city ? t(`ما فيه أسر في ${nm(city)} للحين`, `No kitchens in ${nm(city)} yet`) : t('ما فيه أسر للحين', 'No kitchens yet'),
        t('نضيف أسر جديدة كل أسبوع، جرّب مدينة ثانية', 'New kitchens join every week, try another city'),
        `<button class="btn btn-primary" data-act="loc">${ic('pin', 's')} ${t('غيّر المدينة', 'Change city')}</button>`)}</section>` : `
        ${!anyF && featured.length >= 2 ? `<section class="section"><div class="section-head"><h2>${t('مختارات لك', 'Picked for you')}</h2></div>
          <div class="hscroll">${featured.map(featCard).join('')}</div></section>` : ''}
        <section class="section">
          <div class="section-head"><h2>${anyF ? (catName ? esc(catName) : t('النتائج', 'Results')) : t('كل الأسر', 'All kitchens')} <span class="cnt">${fams.length}</span></h2>
            ${anyF ? `<button class="link" data-act="clear-f">${t('مسح الفلاتر', 'Clear filters')}</button>` : ''}</div>
          ${fams.length ? `<div class="fam-grid">${fams.map(famCard).join('')}</div>`
            : emptyBox('filter', t('ما لقينا أسر بهالفلاتر', 'No kitchens match these filters'), t('جرّب تشيل فلتر أو تختار تصنيف ثاني', 'Try removing a filter or another category'), `<button class="btn btn-soft" data-act="clear-f">${t('مسح الفلاتر', 'Clear filters')}</button>`)}
        </section>
        ${pop.length ? `<section class="section"><div class="section-head"><h2>${t('الأكثر طلبًا', 'Most ordered')}</h2></div>
          <div class="dish-grid">${pop.map(dishTile).join('')}</div></section>` : ''}`}
    </div>`;
  }
  function famCard(f) {
    const closed = !f.open_now;
    const cz = (f.cuisines || []).slice(0, 2).join(' · ');
    return `<a class="fam-card ${closed ? 'is-closed' : ''}" href="${famLink(f.slug)}">
      <div class="cover">${pic(f.cover_url, { seed: f.id, alt: nm(f) })}
        <div class="badges">${famBadge(f)}</div>
        <div class="logo">${logoHtml(f)}</div>
      </div>
      <div class="body">
        <h3 class="ellipsis">${esc(nm(f))}</h3>
        <div class="meta">${ratingPill(f)}<span>${ic('clock')}${+f.prep_min} ${t('دقيقة', 'min')}</span><span>${ic('bike')}${esc(feeText(f))}</span></div>
        <div class="meta sub">${f.district ? `<span>${ic('pin')}${esc(f.district)}</span>` : ''}${cz ? `<span class="ellipsis">${esc(cz)}</span>` : ''}${closed ? `<span class="sched">${ic('calendar')}${t('اطلب بموعد', 'Order ahead')}</span>` : ''}</div>
      </div>
    </a>`;
  }
  function featCard(f) {
    const sub = [(f.cuisines || []).slice(0, 2).join(' · '), f.district].filter(Boolean).join(' · ');
    return `<a class="feat" href="${famLink(f.slug)}">
      <div class="fp">${pic(f.cover_url, { seed: f.id, alt: nm(f) })}<span class="shade"></span>
        <div class="ftop">${famBadge(f)}</div>
        <div class="fcap"><span class="flogo">${logoHtml(f)}</span><div class="grow"><h3 class="ellipsis">${esc(nm(f))}</h3>${sub ? `<p class="ellipsis">${esc(sub)}</p>` : ''}</div></div>
      </div>
      <div class="fmeta">${ratingPill(f)}<span>${ic('clock', 's')}${+f.prep_min} ${t('دقيقة', 'min')}</span><span>${ic('bike', 's')}${esc(feeText(f))}</span></div>
    </a>`;
  }
  function dishTile(d) {
    const sale = +d.old_price > +d.price;
    return `<a class="dish-tile" href="${famLink(d.slug, d.id)}">
      <div class="ph">${pic(d.image_url, { seed: d.id, g: d.category_id, alt: nm(d) })}${sale ? `<span class="off-tag">${t('خصم', 'Sale')}</span>` : ''}</div>
      <h3 class="ellipsis">${esc(nm(d))}</h3>
      <div class="sub ellipsis">${esc(SF.t(d.family_ar, d.family_en || d.family_ar))}</div>
      <div class="tile-foot"><span class="price">${SF.moneyHtml(d.price)}</span>${sale ? `<span class="price-old">${SF.n2(d.old_price)}</span>` : ''}<span class="tile-add" aria-hidden="true">${ic('plus', 's')}</span></div>
    </a>`;
  }

  /* ═════════════════════ البحث ═════════════════════ */
  async function viewSearch(_, q, ctx) {
    if (maint()) return viewMaint();
    chrome({ mode: 'main', tab: 'search', nav: true, cartbar: true });
    if (!S.home) S.home = LS.get(homeKey(), null);
    $('#view').innerHTML = `<div class="page search-page">
      <div class="search-head">
        <label class="search-box">${ic('search')}<input id="sq" type="search" enterkeyhint="search" autocomplete="off" placeholder="${t('ابحث عن طبق أو أسرة', 'Search dishes or kitchens')}" value="${esc(S.sq)}" aria-label="${t('بحث', 'Search')}">
          <button class="icon-btn clear-q ${S.sq ? '' : 'hide'}" data-act="sclear" aria-label="${t('مسح', 'Clear')}">${ic('x', 's')}</button></label>
      </div>
      <div id="sres"></div>
    </div>`;
    const inp = $('#sq');
    const doServer = debounce(serverSearch, 260);
    on(inp, 'input', () => { S.sq = inp.value; $('.clear-q').classList.toggle('hide', !S.sq); renderSearch(); doServer(ctx); });
    on(inp, 'keydown', (e) => { if (e.key === 'Enter') { addRecent(inp.value); inp.blur(); } });
    S.acts = {
      sclear: () => { S.sq = ''; inp.value = ''; $('.clear-q').classList.add('hide'); renderSearch(); inp.focus(); },
      recent: (el) => { S.sq = el.dataset.q; inp.value = S.sq; $('.clear-q').classList.remove('hide'); renderSearch(); serverSearch(ctx); },
      'recent-clear': () => { LS.del('sf_recent_v1'); renderSearch(); },
      scat: (el) => { S.filters = { open: false, delivery: false, pickup: false, top: false, cat: el.dataset.id }; go('#/'); },
      hit: (el) => { addRecent(S.sq); go(el.dataset.to); },
      scity: (el) => { setCity(el.dataset.id); },
    };
    renderSearch();
    if (S.sq) serverSearch(ctx);
    if (!isNative()) setTimeout(() => { if (ctx.isCur()) inp.focus({ preventScroll: true }); }, 120);
    if (!S.home || S.home.city !== (S.city || null)) { try { await loadHome(); if (ctx.isCur()) renderSearch(); } catch { /* */ } }
  }
  function addRecent(v) {
    v = String(v || '').trim();
    if (v.length < 2) return;
    const r = LS.get('sf_recent_v1', []).filter((x) => x !== v);
    r.unshift(v); LS.set('sf_recent_v1', r.slice(0, 6));
  }
  async function serverSearch(ctx) {
    const raw = (S.sq || '').trim();
    if (raw.length < 2) { S.sdish = { q: raw, list: [] }; return; }
    const safe = raw.replace(/[%,().:*"'\\_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!safe) return;
    const pat = safe.replace(/[اأإآ]/g, '_').replace(/[هة]/g, '_').replace(/[يى]/g, '_');
    try {
      const { data } = await SF.sb.from('sf_dishes')
        .select('id,family_id,name_ar,name_en,image_url,price,old_price,category_id,available,family:sf_families!inner(id,slug,name_ar,name_en,city_id,status)')
        .or(`name_ar.ilike.%${pat}%,name_en.ilike.%${safe}%,desc_ar.ilike.%${pat}%`).eq('available', true).limit(40);
      if ((S.sq || '').trim() !== raw) return;
      const all = (data || []).filter((d) => d.family);
      const here = (d) => !S.city || !d.family.city_id || d.family.city_id === S.city;
      S.sdish = { q: raw, list: all.filter(here), other: all.filter((d) => !here(d)) };
      if ((!ctx || ctx.isCur()) && $('#sres')) renderSearch();
    } catch { /* البحث المحلي يكفي */ }
  }
  // لا لقينا شي بمدينته ولقيناه بمدينة ثانية: نقترح التبديل
  function otherCities(raw) {
    const ids = [...new Set(((S.sdish.q === raw && S.sdish.other) || []).map((d) => d.family.city_id).filter(Boolean))];
    const cs = ids.map(cityObj).filter(Boolean);
    if (!cs.length) return emptyBox('search', t(`ما لقينا «${raw}»`, `No results for “${raw}”`), t('جرّب كلمة ثانية أو تصفح التصنيفات', 'Try another word or browse the categories'));
    return emptyBox('pin', t(`«${raw}» متوفر في مدينة ثانية`, `“${raw}” is available in another city`), t('غيّر مدينتك وشوف الأسر اللي تقدمه', 'Switch your city to see the kitchens that offer it'),
      `<div class="row wrap other-cities">${cs.map((c) => `<button class="btn btn-soft" data-act="scity" data-id="${esc(c.id)}">${ic('pin', 's')}${esc(nm(c))}</button>`).join('')}</div>`);
  }
  function renderSearch() {
    const box = $('#sres');
    if (!box) return;
    const raw = (S.sq || '').trim();
    const h = S.home || { families: [], popular: [] };
    if (!raw) {
      const rec = LS.get('sf_recent_v1', []);
      box.innerHTML = `
        ${rec.length ? `<section class="section"><div class="section-head"><h2>${t('بحثت قبل', 'Recent searches')}</h2><button class="link small" data-act="recent-clear">${t('مسح', 'Clear')}</button></div>
          <div class="chips wrap-chips">${rec.map((r) => `<button class="chip" data-act="recent" data-q="${esc(r)}">${ic('clock', 's')}${esc(r)}</button>`).join('')}</div></section>` : ''}
        ${S.cats.length ? `<section class="section"><div class="section-head"><h2>${t('تصفح بالتصنيف', 'Browse by category')}</h2></div>
          <div class="scat-grid">${S.cats.map((c) => `<button class="scat" data-act="scat" data-id="${esc(c.id)}"><span class="ph">${pic(c.image_url, { seed: c.id, g: c.id })}</span><b>${esc(nm(c))}</b></button>`).join('')}</div></section>` : ''}
        ${h.popular.length ? `<section class="section"><div class="section-head"><h2>${t('الأكثر طلبًا', 'Most ordered')}</h2></div><div class="dish-grid">${h.popular.slice(0, 6).map(dishTile).join('')}</div></section>` : ''}`;
      settle(box);
      return;
    }
    const nq = ARN(raw);
    const fams = h.families.filter((f) => [f.name_ar, f.name_en, f.bio_ar, f.bio_en, f.district, ...(f.cuisines || []), ...(f.tags || [])].some((s) => ARN(s).includes(nq)));
    const seen = new Set();
    const dishes = [];
    h.popular.forEach((d) => { if ([d.name_ar, d.name_en].some((s) => ARN(s).includes(nq)) && !seen.has(d.id)) { seen.add(d.id); dishes.push({ ...d, fslug: d.slug, fname: SF.t(d.family_ar, d.family_en || d.family_ar) }); } });
    if (S.sdish.q === raw) S.sdish.list.forEach((d) => { if (!seen.has(d.id)) { seen.add(d.id); dishes.push({ ...d, fslug: d.family.slug, fname: nm(d.family) }); } });
    const pending = raw.length >= 2 && S.sdish.q !== raw;
    if (!fams.length && !dishes.length) {
      box.innerHTML = pending ? `<div class="res-list">${Array.from({ length: 3 }, () => `<div class="res-row">${sk('56px', 56, '16px')}<div class="grow stack s">${sk('60%', 15)}${sk('35%', 12)}</div></div>`).join('')}</div>`
        : otherCities(raw);
      return;
    }
    box.innerHTML = `
      ${fams.length ? `<section class="section"><div class="section-head"><h2>${t('الأسر', 'Kitchens')} <span class="cnt">${fams.length}</span></h2></div>
        <div class="res-list">${fams.map((f) => `<button class="res-row" data-act="hit" data-to="${famLink(f.slug)}">
          <span class="res-logo">${logoHtml(f)}</span>
          <span class="grow"><b class="ellipsis">${esc(nm(f))}</b><small>${ratingPill(f)} · ${f.open_now ? `<span class="okc">${t('مفتوح الحين', 'Open now')}</span>` : t('اطلب بموعد', 'Order ahead')}${f.district ? ` · ${esc(f.district)}` : ''}</small></span>${fwd('s')}</button>`).join('')}</div></section>` : ''}
      ${dishes.length ? `<section class="section"><div class="section-head"><h2>${t('الأطباق', 'Dishes')} <span class="cnt">${dishes.length}</span></h2></div>
        <div class="res-list">${dishes.map((d) => `<button class="res-row" data-act="hit" data-to="${famLink(d.fslug, d.id)}">
          <span class="res-ph">${pic(d.image_url, { seed: d.id, g: d.category_id })}</span>
          <span class="grow"><b class="ellipsis">${esc(nm(d))}</b><small class="ellipsis">${esc(d.fname)}</small></span>
          <span class="price">${SF.moneyHtml(d.price)}</span></button>`).join('')}</div></section>` : ''}`;
    settle(box);
  }

  /* ═════════════════════ صفحة الأسرة ═════════════════════ */
  const FAM_COLS = 'id,slug,name_ar,name_en,bio_ar,bio_en,logo_url,cover_url,city_id,district,status,is_open,prep_min,min_order,pickup_enabled,delivery_enabled,delivery_max_km,delivery_tiers,cuisines,tags,featured,rating_avg,rating_count,orders_count,preorder_days';
  const DISH_COLS = 'id,family_id,category_id,section,name_ar,name_en,desc_ar,desc_en,image_url,price,old_price,serves,prep_min,min_lead_hours,daily_limit,options,available,sort';
  const famActs = (f) => `<button class="icon-btn" data-act="share" aria-label="${t('مشاركة', 'Share')}">${ic('share')}</button>
    <button class="icon-btn fav-btn ${S.favs.has(f.id) ? 'on' : ''}" data-act="fav" aria-label="${t('المفضلة', 'Favorite')}" aria-pressed="${S.favs.has(f.id)}">${ic('heart')}</button>`;
  function famPageSkel() {
    return `<div class="fam-top"><div class="fam-cover skel"></div></div>
      <div class="page fam-page no-nav"><div class="fam-layout"><div class="fam-main">
        <section class="fam-info"><div class="fam-logo skel"></div><div class="fam-card-in">${sk('55%', 26)}${sk('90%', 14)}${sk('70%', 14)}<div class="fam-facts">${sk('100%', 54)}</div></div></section>
        <div class="dish-list" style="margin-top:22px">${Array.from({ length: 4 }, () => `<div class="dish is-sk"><div class="txt">${sk('60%', 17)}${sk('90%', 13)}${sk('30%', 16)}</div><div class="ph skel"></div></div>`).join('')}</div>
      </div></div></div>`;
  }
  async function viewFamily([slug], q, ctx) {
    if (maint()) return viewMaint();
    chrome({ mode: 'overlay', nav: false, cartbar: true, back: '#/' });
    $('#view').innerHTML = famPageSkel();
    const { data: fam, error } = await SF.sb.from('sf_families').select(FAM_COLS).eq('slug', slug).maybeSingle();
    if (!ctx.isCur()) return;
    if (error) throw Object.assign(new Error(error.message), { text: SF.errText(error) });
    if (!fam || fam.status !== 'active') {
      chrome({ mode: 'sub', nav: false, title: t('الأسرة', 'Kitchen'), back: '#/' });
      $('#view').innerHTML = `<div class="page narrow no-nav">${emptyBox('store', t('الأسرة غير متاحة الحين', 'This kitchen is not available'),
        t('يمكن الرابط قديم أو الأسرة موقفة مؤقتًا', 'The link may be old or the kitchen is paused for now'),
        `<button class="btn btn-primary" data-href="#/">${t('تصفح الأسر', 'Browse kitchens')}</button>`)}</div>`;
      return;
    }
    const [dR, hR, oR, rv] = await Promise.all([
      SF.sb.from('sf_dishes').select(DISH_COLS).eq('family_id', fam.id).order('sort').order('created_at'),
      SF.sb.from('sf_family_hours').select('dow,open_min,close_min').eq('family_id', fam.id),
      SF.sb.from('sf_family_timeoff').select('from_date,to_date').eq('family_id', fam.id).gte('to_date', SF.todayISO()),
      SF.rpc('sf_family_reviews', { p_family: fam.id, p_limit: 20 }).catch(() => []),
    ]);
    if (!ctx.isCur()) return;
    const F = { fam, dishes: dR.data || [], hours: hR.data || [], off: oR.data || [], reviews: Array.isArray(rv) ? rv : [] };
    S.F = F;
    S.cleanup.push(() => { if (S.F === F) S.F = null; });
    document.title = `${nm(fam)} · ${t('سُفرة', 'Sufrah')}`;
    chrome({ mode: 'overlay', nav: false, cartbar: true, back: '#/', title: nm(fam), acts: famActs(fam) });
    mountFamily(F);
    S.onCart = () => { refreshDishBadges(); renderSideCart(); };
    S.acts = {
      share: () => shareLink(nm(fam), t(`${nm(fam)} على سُفرة`, `${nm(fam)} on Sufrah`), shareUrl('f=' + encodeURIComponent(fam.slug))),
      fav: (el) => toggleFav(fam, el),
      dish: (el) => { const d = F.dishes.find((x) => x.id === el.dataset.id); if (d) openDish(fam, d); },
      quick: (el) => {
        const d = F.dishes.find((x) => x.id === el.dataset.id);
        if (!d) return;
        if ((d.options || []).length) { openDish(fam, d); return; }
        const rect = el.getBoundingClientRect();
        addToCart(fam, { key: lineKey(d.id, [], ''), dish_id: d.id, qty: 1, options: [], note: '', name_ar: d.name_ar, name_en: d.name_en, image_url: d.image_url, cat: d.category_id, unit_est: +d.price, opts_ar: '', opts_en: '' })
          .then((ok) => { if (ok) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 400); flyFrom(rect); } });
      },
      tab: (el) => F.goTab && F.goTab(+el.dataset.i),
    };
    // الشريط العلوي يصير صلب بعد الغلاف
    const onScroll = () => { const solid = window.scrollY > 150; const top = $('#top'); if (top.classList.contains('solid') !== solid) top.classList.toggle('solid', solid); };
    on(window, 'scroll', onScroll, { passive: true });
    onScroll();
    // تحديث حي: توفر الأطباق وفتح المطبخ
    const reDishes = debounce(async () => {
      const { data } = await SF.sb.from('sf_dishes').select(DISH_COLS).eq('family_id', fam.id).order('sort').order('created_at');
      if (S.F !== F || !data) return; F.dishes = data; mountFamily(F, true);
    }, 700);
    const c1 = SF.live('sf_dishes', 'family_id=eq.' + fam.id, reDishes);
    const c2 = SF.live('sf_families', 'id=eq.' + fam.id, (p) => {
      if (S.F !== F || !p.new) return;
      ['is_open', 'prep_min', 'min_order', 'pickup_enabled', 'delivery_enabled', 'delivery_tiers', 'rating_avg', 'rating_count', 'status'].forEach((k) => { if (k in p.new) F.fam[k] = p.new[k]; });
      mountFamily(F, true);
    });
    S.cleanup.push(() => { SF.sb.removeChannel(c1); SF.sb.removeChannel(c2); });
    if (q.d) {
      history.replaceState(null, '', famLink(slug));
      S.routeKey = location.hash;
      const d = F.dishes.find((x) => x.id === q.d);
      if (d) setTimeout(() => { if (ctx.isCur()) openDish(fam, d); }, 260);
    }
  }
  function groupDishes(dishes) {
    const map = new Map();
    dishes.forEach((d) => {
      const cat = S.cats.find((c) => c.id === d.category_id);
      const arOnly = d.section && !/[A-Za-z]/.test(d.section);
      const name = (d.section && !(SF.lang === 'en' && arOnly && cat)) ? d.section : (cat ? nm(cat) : t('المنيو', 'Menu'));
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(d);
    });
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }
  function mountFamily(F, keep) {
    const f = F.fam;
    const oi = openInfo(f, F.hours, F.off);
    const groups = groupDishes(F.dishes);
    const bio = nm(f, 'bio');
    const fr = feeRange(f.delivery_tiers);
    const feeV = !f.delivery_enabled ? t('استلام فقط', 'Pickup only') : fr ? (fr[0] === fr[1] ? SF.money(fr[0]) : t(`${SF.n2(fr[0])} إلى ${SF.money(fr[1])}`, `SAR ${SF.n2(fr[0])} to ${SF.n2(fr[1])}`)) : '';
    const sy = window.scrollY;
    $('#view').innerHTML = `
      <div class="fam-top"><div class="fam-cover">${pic(f.cover_url, { seed: f.id, alt: nm(f) })}<span class="shade"></span></div></div>
      <div class="page fam-page no-nav">
        <div class="fam-layout">
          <div class="fam-main">
            <section class="fam-info">
              <div class="fam-logo">${logoHtml(f)}</div>
              <div class="fam-card-in">
                <div class="fam-desk-acts">${famActs(f)}</div>
                <h1>${esc(nm(f))}</h1>
                ${bio ? `<p class="fam-bio">${esc(bio)}</p>` : ''}
                <div class="fam-line">${ratingPill(f)}${openBadge(oi)}${f.district ? `<span class="fam-dist">${ic('pin', 's')}${esc(f.district)}</span>` : ''}</div>
                <div class="fam-facts">
                  <div>${ic('clock')}<small>${t('يجهز خلال', 'Ready in')}</small><b>${+f.prep_min} ${t('دقيقة', 'min')}</b></div>
                  <div>${ic('bike')}<small>${t('التوصيل', 'Delivery')}</small><b>${esc(feeV)}</b></div>
                  <div>${ic('bag')}<small>${t('أقل طلب', 'Min. order')}</small><b>${+f.min_order ? SF.money(f.min_order) : t('بدون حد', 'No minimum')}</b></div>
                </div>
                <div class="fam-modes">
                  ${f.delivery_enabled ? `<span class="badge b-info">${ic('bike', 's')}${t('توصيل من الأسرة', 'Delivery by the kitchen')}</span>` : ''}
                  ${f.pickup_enabled ? `<span class="badge b-brand">${ic('store', 's')}${t('استلام من المطبخ', 'Pickup from the kitchen')}</span>` : ''}
                  ${(f.cuisines || []).slice(0, 3).map((c) => `<span class="badge">${esc(c)}</span>`).join('')}
                </div>
                ${!oi.open ? `<div class="notice fam-closed">${ic('calendar')}<span>${t('تقدر تطلب الحين وتختار موعد يناسبك', 'You can order now and pick a time that suits you')}</span></div>` : ''}
              </div>
              <div class="sadu"></div>
            </section>
            ${groups.length ? `<div class="tabs" id="famTabs"><div class="chips">${groups.map((g, i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-act="tab" data-i="${i}">${esc(g.name)} <small>${g.items.length}</small></button>`).join('')}</div></div>
              ${groups.map((g, i) => `<section class="menu-sec" id="sec-${i}" data-i="${i}"><h2>${esc(g.name)}</h2><div class="dish-list">${g.items.map(dishRow).join('')}</div></section>`).join('')}`
            : `<section class="section">${emptyBox(glyph('feasts'), t('المنيو قيد التجهيز', 'The menu is being prepared'), t('الأسرة تضيف أطباقها قريب', 'The kitchen is adding its dishes soon'))}</section>`}
            ${reviewsHtml(F)}
          </div>
          <aside class="side-cart" id="sideCart" aria-label="${t('السلة', 'Cart')}">${sideCartHtml()}</aside>
        </div>
      </div>`;
    if (keep) window.scrollTo(0, sy);
    settle($('#view'));
    wireTabs(F);
  }
  function wireTabs(F) {
    if (F.io) F.io.disconnect();
    const secs = $$('.menu-sec');
    const chips = $$('#famTabs .chip');
    if (!secs.length) return;
    let lock = 0;
    const setTab = (i) => {
      chips.forEach((c, k) => c.classList.toggle('is-active', k === i));
      const c = chips[i];
      if (c) { const box = c.parentElement; const br = box.getBoundingClientRect(), cr = c.getBoundingClientRect(); box.scrollBy({ left: (cr.left + cr.width / 2) - (br.left + br.width / 2), behavior: 'smooth' }); }
    };
    F.io = new IntersectionObserver((ents) => {
      if (Date.now() < lock) return;
      ents.forEach((en) => { if (en.isIntersecting) setTab(+en.target.dataset.i); });
    }, { rootMargin: '-140px 0px -55% 0px' });
    secs.forEach((s) => F.io.observe(s));
    S.cleanup.push(() => F.io && F.io.disconnect());
    F.goTab = (i) => {
      const sec = $('#sec-' + i);
      if (!sec) return;
      lock = Date.now() + 900;
      setTab(i);
      window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 128, behavior: 'smooth' });
    };
  }
  function dishRow(d) {
    const n = S.cart.family_id === d.family_id ? S.cart.items.filter((i) => i.dish_id === d.id).reduce((a, i) => a + i.qty, 0) : 0;
    const desc = nm(d, 'desc');
    const sale = +d.old_price > +d.price;
    return `<div class="dish ${d.available ? '' : 'is-off'}" role="button" tabindex="0" data-act="dish" data-id="${d.id}" aria-label="${esc(nm(d))}">
      <div class="txt">
        <h3>${esc(nm(d))}</h3>
        ${desc ? `<p class="clamp2">${esc(desc)}</p>` : ''}
        <div class="foot">
          <span class="price">${SF.moneyHtml(d.price)}</span>${sale ? `<span class="price-old">${SF.n2(d.old_price)}</span>` : ''}
          ${d.serves ? `<span class="tag">${ic('users', 's')}${esc(d.serves)}</span>` : ''}
          ${+d.min_lead_hours ? `<span class="tag warn">${ic('calendar', 's')}${t(`قبلها بـ ${+d.min_lead_hours} ساعة`, `${+d.min_lead_hours} h ahead`)}</span>` : ''}
        </div>
        ${d.available ? '' : `<span class="badge b-bad off-badge">${t('غير متوفر الحين', 'Unavailable now')}</span>`}
      </div>
      <div class="ph">${pic(d.image_url, { seed: d.id, g: d.category_id, alt: nm(d) })}
        ${d.available ? `<button class="add" data-act="quick" data-id="${d.id}" aria-label="${t('أضف', 'Add')} ${esc(nm(d))}">${ic('plus')}</button>` : ''}
        ${n ? `<span class="incart">${n}</span>` : ''}
      </div>
    </div>`;
  }
  function refreshDishBadges() {
    if (!S.F) return;
    $$('.dish[data-id]').forEach((el) => {
      const id = el.dataset.id;
      const n = S.cart.family_id === S.F.fam.id ? S.cart.items.filter((i) => i.dish_id === id).reduce((a, i) => a + i.qty, 0) : 0;
      let b = $('.incart', el);
      if (n) { if (!b) { b = document.createElement('span'); b.className = 'incart'; $('.ph', el).appendChild(b); } b.textContent = n; } else if (b) b.remove();
    });
  }
  function cartLine(it, price) {
    const opts = itemOpts(it);
    return `<div class="cl">
      <div class="cl-ph">${pic(it.image_url, { seed: it.dish_id, g: it.cat })}</div>
      <div class="cl-body"><b class="clamp2">${esc(itemName(it))}</b>${opts ? `<small>${esc(opts)}</small>` : ''}${it.note ? `<small class="cl-note">${ic('edit', 's')}${esc(it.note)}</small>` : ''}
        <span class="price">${SF.moneyHtml(price != null ? price : (+it.unit_est || 0) * it.qty)}</span></div>
      <div class="qty">
        <button data-act="cq" data-d="-1" data-key="${esc(it.key)}" aria-label="${it.qty > 1 ? t('أنقص', 'Decrease') : t('شيل', 'Remove')}">${it.qty > 1 ? ic('minus', 's') : ic('trash', 's')}</button>
        <span>${it.qty}</span>
        <button data-act="cq" data-d="1" data-key="${esc(it.key)}" aria-label="${t('زيد', 'Increase')}">${ic('plus', 's')}</button>
      </div>
    </div>`;
  }
  function sideCartHtml() {
    if (!cartCount()) {
      return `<div class="sc-head"><h3>${t('سلتك', 'Your cart')}</h3></div>
        <div class="sc-empty">${art(ic('bag'))}<b>${t('سلتك فاضية', 'Your cart is empty')}</b><p>${t('أضف أطباق من المنيو وبتظهر هنا', 'Add dishes from the menu and they will show here')}</p></div>`;
    }
    const other = S.F && S.cart.family_id !== S.F.fam.id;
    return `<div class="sc-head"><h3>${t('سلتك', 'Your cart')}</h3><span class="muted small ellipsis">${esc(cartFam())}</span></div>
      ${other ? `<p class="notice info small">${ic('info', 's')}<span>${t('سلتك من أسرة ثانية، وإذا أضفت من هنا بنسألك تبدأ سلة جديدة.', 'Your cart is from another kitchen. Adding here asks to start a new cart.')}</span></p>` : ''}
      <div class="sc-list">${S.cart.items.map((i) => cartLine(i)).join('')}</div>
      <div class="sum"><div class="r total"><span>${t('المجموع', 'Subtotal')}</span><b>${SF.moneyHtml(cartSub())}</b></div></div>
      <p class="tiny muted">${t('رسوم التوصيل تتحسب في الخطوة الجاية', 'Delivery is calculated at checkout')}</p>
      <button class="btn btn-primary btn-lg btn-block" data-act="checkout">${t('إتمام الطلب', 'Checkout')} ${fwd('s')}</button>`;
  }
  function renderSideCart() { const el = $('#sideCart'); if (el) { el.innerHTML = sideCartHtml(); settle(el); } }
  function reviewsHtml(F) {
    const f = F.fam, list = F.reviews || [];
    if (!+f.rating_count && !list.length) return '';
    return `<section class="section fam-reviews" id="reviews">
      <div class="section-head"><h2>${t('التقييمات', 'Reviews')}</h2></div>
      <div class="rv-sum">
        <b class="rv-num">${num1(f.rating_avg)}</b>
        <div>${starsRow(f.rating_avg)}<small>${t(`من ${+f.rating_count} تقييم`, `from ${+f.rating_count} ratings`)}</small></div>
      </div>
      ${list.length ? `<div class="rv-list">${list.map((rv) => `
        <article class="rv">
          <div class="rv-head"><span class="rv-av">${esc(initial(rv.name || 'ع'))}</span>
            <div class="grow"><b>${esc(rv.name || t('عميل', 'Customer'))}</b><small>${rv.at ? esc(SF.ago(rv.at)) : ''}</small></div>${starsRow(rv.rating, true)}</div>
          ${rv.review ? `<p>${esc(rv.review)}</p>` : ''}
          ${rv.photo ? `<button class="rv-photo" data-act="photo" data-src="${esc(rv.photo)}" aria-label="${t('الصورة', 'Photo')}">${pic(rv.photo, { seed: rv.at })}</button>` : ''}
          ${rv.items ? `<small class="rv-items">${ic('dish', 's')}${esc(rv.items)}</small>` : ''}
          ${rv.reply ? `<div class="rv-reply"><b>${t('رد الأسرة', 'Kitchen reply')}</b><p>${esc(rv.reply)}</p></div>` : ''}
        </article>`).join('')}</div>`
        : `<p class="muted small">${t('ما فيه تعليقات مكتوبة للحين', 'No written reviews yet')}</p>`}
    </section>`;
  }
  async function toggleFav(fam, btn) {
    if (!(await ensureLogin({ noName: true, title: t('سجّل دخولك عشان تحفظ أسرك المفضلة', 'Sign in to save your favorite kitchens') }))) return;
    const was = S.favs.has(fam.id);
    if (was) S.favs.delete(fam.id); else S.favs.add(fam.id);
    const paint = () => $$('.fav-btn').forEach((b) => { b.classList.toggle('on', S.favs.has(fam.id)); b.setAttribute('aria-pressed', S.favs.has(fam.id)); });
    paint();
    if (btn && !was) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    const q = was ? SF.sb.from('sf_favorites').delete().eq('user_id', S.uid).eq('family_id', fam.id)
      : SF.sb.from('sf_favorites').upsert({ user_id: S.uid, family_id: fam.id }, { onConflict: 'user_id,family_id', ignoreDuplicates: true });
    const { error } = await q;
    if (error) { if (was) S.favs.add(fam.id); else S.favs.delete(fam.id); paint(); SF.toast(SF.errText(error), 'bad'); return; }
    SF.toast(was ? t('انشالت من المفضلة', 'Removed from favorites') : t('انضافت للمفضلة', 'Added to favorites'), was ? '' : 'ok');
  }

  /* ───────── لوح الطبق: الخيارات والكمية والملاحظة ───────── */
  function openDish(fam, d) {
    const groups = Array.isArray(d.options) ? d.options.filter((g) => g && Array.isArray(g.choices) && g.choices.length) : [];
    const st = { qty: 1, picks: {} };
    groups.forEach((g) => { st.picks[g.id] = []; });
    const name = nm(d), desc = nm(d, 'desc');
    const sale = +d.old_price > +d.price;
    const priceOf = (g, id) => { const c = (g.choices || []).find((x) => String(x.id) === String(id)); return Math.max(0, +(c && c.price) || 0); };
    const unit = () => +d.price + groups.reduce((a, g) => a + (st.picks[g.id] || []).reduce((b, id) => b + priceOf(g, id), 0), 0);
    const groupHtml = (g) => {
      const multi = g.type === 'multi';
      const max = multi && +g.max ? +g.max : 0;
      return `<fieldset class="og" data-g="${esc(g.id)}">
        <legend><b>${esc(nm(g))}</b>${g.required ? `<span class="req">${t('مطلوب', 'Required')}</span>` : `<span class="opt">${t('اختياري', 'Optional')}</span>`}${max ? `<small>${t(`لين ${max}`, `up to ${max}`)}</small>` : ''}</legend>
        ${(g.choices || []).map((c) => `<label class="oc"><input type="${multi ? 'checkbox' : 'radio'}" name="og-${esc(g.id)}" value="${esc(c.id)}"><span class="oc-box" aria-hidden="true"></span><span class="oc-n">${esc(nm(c))}</span>${+c.price > 0 ? `<span class="oc-p">+${SF.money(c.price)}</span>` : ''}</label>`).join('')}
      </fieldset>`;
    };
    const s = SF.openSheet(`
      <div class="hero-img dish-hero">${pic(d.image_url, { seed: d.id, g: d.category_id, alt: name })}</div>
      <button class="icon-btn dsh-x" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button>
      <div class="dsh">
        <div class="dsh-top"><h2>${esc(name)}</h2><div class="dsh-price"><span class="price">${SF.moneyHtml(d.price)}</span>${sale ? `<span class="price-old">${SF.n2(d.old_price)}</span>` : ''}</div></div>
        ${desc ? `<p class="dsh-desc">${esc(desc)}</p>` : ''}
        <div class="dsh-tags">
          ${d.serves ? `<span class="tag">${ic('users', 's')}${esc(d.serves)}</span>` : ''}
          ${+d.prep_min ? `<span class="tag">${ic('clock', 's')}${t(`يجهز خلال ${+d.prep_min} دقيقة`, `Ready in ${+d.prep_min} min`)}</span>` : ''}
          ${+d.min_lead_hours ? `<span class="tag warn">${ic('calendar', 's')}${t(`يحتاج طلب قبلها بـ ${+d.min_lead_hours} ساعة`, `Order ${+d.min_lead_hours} hours ahead`)}</span>` : ''}
        </div>
        ${d.available ? '' : `<div class="notice bad">${ic('alert')}<span>${t('هذا الطبق غير متوفر الحين', 'This dish is unavailable right now')}</span></div>`}
        ${groups.map(groupHtml).join('')}
        <label class="field dsh-note"><span>${t('ملاحظة للأسرة', 'Note for the kitchen')} <small class="muted">${t('(اختياري)', '(optional)')}</small></span>
          <textarea class="textarea" rows="2" maxlength="200" placeholder="${t('مثال: بدون بصل، الصوص على جنب', 'e.g. no onion, sauce on the side')}"></textarea></label>
      </div>
      <div class="sheet-foot dsh-foot">
        <div class="qty lg"><button type="button" data-q="-1" aria-label="${t('أنقص', 'Decrease')}">${ic('minus')}</button><span aria-live="polite">1</span><button type="button" data-q="1" aria-label="${t('زيد', 'Increase')}">${ic('plus')}</button></div>
        <button class="btn btn-primary btn-lg grow dsh-add" type="button" ${d.available ? '' : 'disabled'}></button>
      </div>`, { noFocus: true });
    s.sh.classList.add('dish-sheet');
    settle(s.sh);
    const qtyEl = $('.qty span', s.sh), addBtn = $('.dsh-add', s.sh), noteEl = $('.dsh-note textarea', s.sh);
    const upd = () => {
      qtyEl.textContent = st.qty;
      addBtn.innerHTML = d.available ? `<span>${t('أضف للسلة', 'Add to cart')}</span><span class="sep">·</span><span>${SF.money(unit() * st.qty)}</span>` : t('غير متوفر الحين', 'Unavailable now');
      $('[data-q="-1"]', s.sh).disabled = st.qty <= 1;
    };
    upd();
    s.sh.addEventListener('click', (e) => {
      const qb = e.target.closest('[data-q]');
      if (qb) { st.qty = Math.max(1, Math.min(50, st.qty + +qb.dataset.q)); upd(); }
    });
    s.sh.addEventListener('change', (e) => {
      const fs = e.target.closest('.og');
      if (!fs) return;
      const g = groups.find((x) => String(x.id) === fs.dataset.g);
      if (!g) return;
      let vals = $$('input:checked', fs).map((x) => x.value);
      const max = g.type === 'multi' && +g.max ? +g.max : 0;
      if (max && vals.length > max) { e.target.checked = false; vals = vals.filter((v) => v !== e.target.value); SF.toast(t(`تقدر تختار ${max} بالكثير`, `You can pick up to ${max}`), 'bad'); }
      st.picks[g.id] = vals;
      if (max) $$('.oc', fs).forEach((l) => { const i = $('input', l); l.classList.toggle('is-off', !i.checked && vals.length >= max); });
      fs.classList.remove('need');
      upd();
    });
    addBtn.addEventListener('click', async () => {
      const miss = groups.find((g) => g.required && !(st.picks[g.id] || []).length);
      if (miss) {
        const fs = $(`.og[data-g="${CSS.escape(String(miss.id))}"]`, s.sh);
        fs.classList.remove('need'); void fs.offsetWidth; fs.classList.add('need');
        fs.scrollIntoView({ behavior: 'smooth', block: 'center' });
        SF.toast(t(`اختر ${nm(miss)}`, `Choose ${nm(miss)}`), 'bad');
        return;
      }
      const options = groups.flatMap((g) => st.picks[g.id] || []);
      const chosen = groups.flatMap((g) => (st.picks[g.id] || []).map((id) => (g.choices || []).find((c) => String(c.id) === String(id))).filter(Boolean));
      const note = noteEl.value.trim().slice(0, 200);
      const item = {
        key: lineKey(d.id, options, note), dish_id: d.id, qty: st.qty, options, note,
        name_ar: d.name_ar, name_en: d.name_en, image_url: d.image_url, cat: d.category_id, unit_est: unit(),
        opts_ar: chosen.map((c) => c.name_ar).join('، '), opts_en: chosen.map((c) => c.name_en || c.name_ar).join(', '),
      };
      const rect = addBtn.getBoundingClientRect();
      const ok = await addToCart(fam, item);
      if (!ok) return;
      s.close();
      setTimeout(() => flyFrom(rect), 60);
    });
  }

  /* ═════════════════════ إتمام الطلب ═════════════════════ */
  let coTimer = null, coNeedSlots = false;
  const newCo = () => ({ family_id: S.cart.family_id, ful: null, addrId: null, time: null, day: null, win: null, pay: null, promo: '', promoIn: '', useCredit: false, note: '', slots: null, quote: null, quoting: false, seq: 0, fam: null, dishes: null, qErr: '' });
  async function viewCheckout(_, q, ctx) {
    if (maint()) return viewMaint();
    const backTo = S.cart.family_slug ? famLink(S.cart.family_slug) : '#/';
    chrome({ mode: 'sub', nav: false, cartbar: false, title: t('إتمام الطلب', 'Checkout'), back: backTo });
    if (!S.cart.items.length) {
      $('#view').innerHTML = `<div class="page narrow no-nav">${emptyBox(glyph('feasts'), t('سلتك فاضية', 'Your cart is empty'), t('اختر أسرة وأضف أطباقك، وبنكمل الطلب من هنا', 'Pick a kitchen and add dishes, then finish here'),
        `<button class="btn btn-primary btn-lg" data-href="#/">${t('تصفح الأسر', 'Browse kitchens')}</button>`)}</div>`;
      return;
    }
    if (!S.co || S.co.family_id !== S.cart.family_id) S.co = newCo();
    const co = S.co;
    $('#view').innerHTML = coSkel();
    const [fR, dR] = await Promise.all([
      SF.sb.from('sf_families').select('id,slug,name_ar,name_en,logo_url,district,city_id,pickup_enabled,delivery_enabled,min_order,status').eq('id', S.cart.family_id).maybeSingle(),
      SF.sb.from('sf_dishes').select('id,name_ar,name_en,available').eq('family_id', S.cart.family_id),
      loadAddresses().catch(() => []),
    ]);
    if (!ctx.isCur()) return;
    if (!fR.data || fR.data.status !== 'active') {
      $('#view').innerHTML = `<div class="page narrow no-nav">${emptyBox('store', t('الأسرة غير متاحة الحين', 'This kitchen is not available now'), t('تقدر تفضي السلة وتطلب من أسرة ثانية', 'You can clear the cart and order from another kitchen'),
        `<button class="btn btn-primary" data-act="clear-cart">${ic('trash', 's')} ${t('فضّ السلة', 'Clear cart')}</button>`)}</div>`;
      S.acts['clear-cart'] = () => { S.cart = emptyCart(); saveCart(); go('#/', { replace: true }); };
      return;
    }
    co.fam = fR.data; co.dishes = dR.data || [];
    if (!co.ful || (co.ful === 'delivery' && !co.fam.delivery_enabled) || (co.ful === 'pickup' && !co.fam.pickup_enabled)) co.ful = co.fam.delivery_enabled ? 'delivery' : 'pickup';
    pickAddr();
    renderCheckout();
    coChanged(true, 0);
    S.onCart = () => { if (!S.cart.items.length) { route(true); return; } renderCoItems(); coChanged(true); };
    S.cleanup.push(() => clearTimeout(coTimer));
    S.acts = coActs();
    on($('#view'), 'change', onCoChange);
    on($('#view'), 'input', (e) => {
      if (e.target.id === 'coNote') co.note = e.target.value.slice(0, 300);
      if (e.target.id === 'coPromoIn') co.promoIn = e.target.value;
    });
  }
  function pickAddr() {
    const co = S.co;
    if (co.addrId && S.addrs.some((a) => a.id === co.addrId)) return;
    const def = S.addrs.find((a) => a.is_default) || S.addrs[0];
    co.addrId = def ? def.id : null;
  }
  const selAddr = () => S.addrs.find((a) => a.id === S.co.addrId) || null;
  const labelText = (l) => (l === 'البيت' ? t('البيت', 'Home') : l === 'الشغل' ? t('الشغل', 'Work') : (l || t('عنوان', 'Address')));
  const labelIcon = (l) => (l === 'البيت' ? 'home' : l === 'الشغل' ? 'store' : 'pin');
  const addrLine = (a) => [a.district, a.street, a.details].filter(Boolean).join('، ') + (cityObj(a.city_id) ? `، ${nm(cityObj(a.city_id))}` : '');
  function coSkel() {
    return `<div class="page co-page no-nav"><div class="co"><div class="co-main">${Array.from({ length: 3 }, () => `<section class="card pad co-sec">${sk('40%', 20)}${sk('100%', 56, '16px')}${sk('100%', 56, '16px')}</section>`).join('')}</div>
      <aside class="co-side"><section class="card pad co-sec">${sk('50%', 20)}${sk('100%', 14)}${sk('100%', 14)}${sk('100%', 24)}</section></aside></div></div>`;
  }
  function renderCheckout() {
    const co = S.co, f = co.fam;
    const credOk = SF.setOn('credits_enabled', false) && +S.me.credit > 0;
    $('#view').innerHTML = `<div class="page co-page no-nav">
      <div class="page-h desk-only"><button class="link back-link" data-act="back">${backIc('s')} ${t('رجوع للمنيو', 'Back to menu')}</button><h1>${t('إتمام الطلب', 'Checkout')}</h1></div>
      <div class="co">
        <div class="co-main">
          <section class="card pad co-sec">
            <div class="co-fam"><span class="co-logo">${logoHtml(f)}</span><div class="grow"><small>${t('طلبك من', 'Your order from')}</small><b>${esc(nm(f))}</b></div>
              <a class="btn btn-ghost btn-sm" href="${famLink(f.slug)}">${ic('plus', 's')} ${t('أضف أطباق', 'Add dishes')}</a></div>
            <div id="coItems" class="co-items"></div>
          </section>
          <section class="card pad co-sec"><h2><span class="step">1</span>${t('طريقة الاستلام', 'How to receive it')}</h2><div id="coFul"></div><div id="coAddr"></div></section>
          <section class="card pad co-sec"><h2><span class="step">2</span>${t('وقت الطلب', 'When')}</h2><div id="coTime"></div></section>
          <section class="card pad co-sec"><h2><span class="step">3</span>${t('الدفع', 'Payment')}</h2><div id="coPay"></div>
            <div id="coPromo"></div>
            ${credOk ? `<label class="credit-row"><span class="pay-ic">${ic('wallet')}</span><span class="grow"><b>${t('استخدم رصيدك', 'Use your credit')}</b><small>${t('رصيدك', 'Balance')} ${SF.money(S.me.credit)}</small></span><span class="switch"><input type="checkbox" id="coCredit" ${co.useCredit ? 'checked' : ''}><span></span></span></label>` : ''}
          </section>
          <section class="card pad co-sec"><h2><span class="step">4</span>${t('ملاحظة للأسرة', 'Note for the kitchen')} <small class="muted">${t('(اختياري)', '(optional)')}</small></h2>
            <textarea class="textarea" id="coNote" maxlength="300" rows="2" placeholder="${t('مثال: الأكل حار شوي، أو اتصل قبل توصل', 'e.g. a bit spicy, or call before arriving')}">${esc(co.note)}</textarea></section>
        </div>
        <aside class="co-side">
          <section class="card pad co-sec co-sum-card"><h2>${t('ملخص الطلب', 'Order summary')}</h2><div id="coSum"></div><div id="coErr"></div><div id="coBtnDesk" class="desk-only"></div></section>
        </aside>
      </div>
    </div>`;
    renderCoItems(); renderCoFul(); renderCoAddr(); renderCoTime(); renderCoPay(); renderCoPromo(); renderCoSum();
  }
  function renderCoItems() {
    const co = S.co; const box = $('#coItems');
    if (!co || !box) return;
    const lines = (co.quote && co.quote.lines) || [];
    let li = 0;
    const priced = S.cart.items.map((it) => { const l = lines[li]; if (l && l.dish_id === it.dish_id && +l.qty === +it.qty) { li++; return l; } if (l && l.dish_id === it.dish_id) { li++; return null; } return null; });
    const dm = new Map((co.dishes || []).map((d) => [d.id, d]));
    box.innerHTML = S.cart.items.map((it, k) => {
      const d = dm.get(it.dish_id); const gone = co.dishes && !d; const off = d && !d.available;
      const opts = itemOpts(it);
      return `<div class="cl co-line ${gone || off ? 'is-off' : ''}">
        <div class="cl-ph">${pic(it.image_url, { seed: it.dish_id, g: it.cat })}</div>
        <div class="cl-body">
          <b>${esc(itemName(it))}</b>
          ${opts ? `<small>${esc(opts)}</small>` : ''}
          ${gone ? `<small class="bad-t">${t('ما عاد موجود بالمنيو، شيله من السلة', 'No longer on the menu, remove it')}</small>` : off ? `<small class="bad-t">${t('غير متوفر الحين', 'Unavailable now')}</small>` : ''}
          <button class="link note-link" data-act="lnote" data-key="${esc(it.key)}">${ic('edit', 's')}${it.note ? esc(it.note) : t('أضف ملاحظة', 'Add a note')}</button>
        </div>
        <div class="cl-end"><span class="price">${SF.moneyHtml(priced[k] ? priced[k].line_total : (+it.unit_est || 0) * it.qty)}</span>
          <div class="qty">
            <button data-act="cq" data-d="-1" data-key="${esc(it.key)}" aria-label="${it.qty > 1 ? t('أنقص', 'Decrease') : t('شيل', 'Remove')}">${it.qty > 1 ? ic('minus', 's') : ic('trash', 's')}</button>
            <span>${it.qty}</span>
            <button data-act="cq" data-d="1" data-key="${esc(it.key)}" aria-label="${t('زيد', 'Increase')}">${ic('plus', 's')}</button>
          </div></div>
      </div>`;
    }).join('');
    settle(box);
  }
  function renderCoFul() {
    const co = S.co, f = co.fam;
    $('#coFul').innerHTML = `<div class="seg" role="radiogroup" aria-label="${t('طريقة الاستلام', 'How to receive it')}">
      <button class="${co.ful === 'delivery' ? 'is-active' : ''}" data-act="ful" data-v="delivery" role="radio" aria-checked="${co.ful === 'delivery'}" ${f.delivery_enabled ? '' : 'disabled'}>${ic('bike', 's')}${t('توصيل', 'Delivery')}</button>
      <button class="${co.ful === 'pickup' ? 'is-active' : ''}" data-act="ful" data-v="pickup" role="radio" aria-checked="${co.ful === 'pickup'}" ${f.pickup_enabled ? '' : 'disabled'}>${ic('store', 's')}${t('استلام من المطبخ', 'Pickup')}</button>
    </div>`;
  }
  function renderCoAddr() {
    const co = S.co, box = $('#coAddr');
    if (!box) return;
    if (co.ful === 'pickup') {
      box.innerHTML = `<div class="notice info pickup-note">${ic('store')}<span>${f2(co.fam.district)}</span></div>`;
      return;
    }
    box.innerHTML = `<div class="addr-list">
      ${S.addrs.map((a) => `<label class="choice addr ${a.id === co.addrId ? 'is-active' : ''}">
        <input type="radio" name="coAddr" value="${esc(a.id)}" ${a.id === co.addrId ? 'checked' : ''}>
        <span class="addr-ic">${ic(labelIcon(a.label), 's')}</span>
        <span class="grow"><b>${esc(labelText(a.label))}</b><small>${esc(addrLine(a))}</small></span>
        <button type="button" class="icon-btn addr-edit" data-act="addr-edit" data-id="${esc(a.id)}" aria-label="${t('تعديل العنوان', 'Edit address')}">${ic('edit', 's')}</button>
      </label>`).join('')}
      <button class="addr-new" data-act="addr-new">${ic('plus', 's')}${S.addrs.length ? t('عنوان جديد', 'New address') : t('حدد عنوان التوصيل على الخريطة', 'Set your delivery address on the map')}</button>
    </div>`;
  }
  function f2(district) {
    return district
      ? t(`تستلم من مطبخ الأسرة في حي ${district}، والموقع يوصلك بعد ما تقبل الأسرة الطلب.`, `You pick it up from the kitchen in ${district}. The exact location is shared once the kitchen accepts.`)
      : t('تستلم من مطبخ الأسرة، والموقع يوصلك بعد ما تقبل الأسرة الطلب.', 'You pick it up from the kitchen. The exact location is shared once the kitchen accepts.');
  }
  const ASAP_WHY = () => ({
    closed_now: t('الأسرة مسكّرة الحين، اختر موعد', 'The kitchen is closed now, pick a time'),
    paused: t('الأسرة موقفة الطلبات الحين، اختر موعد', 'The kitchen paused orders for now, pick a time'),
    needs_schedule: t('طلبك يحتاج تجهيز مسبق، اختر موعد', 'Your order needs advance preparation, pick a time'),
    full_today: t('طلبات اليوم اكتملت، اختر يوم ثاني', 'Today is fully booked, pick another day'),
    busy: t('الأسرة مشغولة الحين، اختر موعد لاحق', 'The kitchen is busy, pick a later time'),
    closed: t('الأسرة مسكّرة الحين، اختر موعد', 'The kitchen is closed now, pick a time'),
  });
  function allWins() { return ((S.co.slots && S.co.slots.days) || []).flatMap((d) => (d.windows || []).map((w) => Object.assign({ date: d.date }, w))); }
  function reconcileTime() {
    const co = S.co, sl = co.slots || {};
    const asapOk = !!(sl.asap && sl.asap.ok);
    const wins = allWins();
    const first = wins.find((w) => w.left > 0);
    if (co.time === 'asap' && !asapOk) co.time = null;
    if (co.time === 'sched' && co.win && !wins.some((w) => w.start === co.win && w.left > 0)) co.win = null;
    if (!co.time) co.time = asapOk ? 'asap' : 'sched';
    if (co.time === 'sched' && !co.win && first) { co.win = first.start; co.day = first.date; }
    if (co.win) { const w = wins.find((x) => x.start === co.win); if (w) co.day = w.date; }
    if (!co.day || !(sl.days || []).some((d) => d.date === co.day)) co.day = ((sl.days || [])[0] || {}).date || null;
  }
  function renderCoTime() {
    const co = S.co, box = $('#coTime');
    if (!box) return;
    const sl = co.slots;
    if (!sl) { box.innerHTML = `<div class="time-opts">${sk('100%', 64, '16px')}${sk('100%', 64, '16px')}</div>`; return; }
    const asap = sl.asap || {};
    const days = sl.days || [];
    const day = days.find((d) => d.date === co.day) || days[0];
    const selW = allWins().find((w) => w.start === co.win);
    box.innerHTML = `<div class="time-opts">
        <button class="topt ${co.time === 'asap' ? 'is-active' : ''}" data-act="time" data-v="asap" ${asap.ok ? '' : 'disabled'}>
          <span class="topt-ic">${ic('flame')}</span><span class="grow"><b>${t('بأسرع وقت', 'As soon as possible')}</b><small>${asap.ok ? t(`حوالي ${+asap.eta_min} دقيقة`, `About ${+asap.eta_min} min`) : t('غير متاح الحين', 'Not available now')}</small></span></button>
        <button class="topt ${co.time === 'sched' ? 'is-active' : ''}" data-act="time" data-v="sched">
          <span class="topt-ic">${ic('calendar')}</span><span class="grow"><b>${t('حدد موعد', 'Schedule')}</b><small>${co.time === 'sched' && selW ? esc(`${SF.t(days.find((d) => d.date === selW.date).label_ar, days.find((d) => d.date === selW.date).label_en)} · ${SF.t(selW.label_ar, selW.label_en)}`) : t('اختر اليوم والوقت', 'Pick a day and time')}</small></span></button>
      </div>
      ${!asap.ok && ASAP_WHY()[asap.reason] ? `<div class="notice">${ic('clock')}<span>${ASAP_WHY()[asap.reason]}</span></div>` : ''}
      ${co.time === 'sched' ? (day ? `
        <div class="chips days" role="group" aria-label="${t('اليوم', 'Day')}">${days.map((d) => `<button class="chip day ${d.date === day.date ? 'is-active' : ''}" data-act="day" data-v="${esc(d.date)}"><b>${esc(SF.t(d.label_ar, d.label_en))}</b><small dir="ltr">${esc(d.day_label)}</small></button>`).join('')}</div>
        <div class="win-grid" role="group" aria-label="${t('الوقت', 'Time')}">${(day.windows || []).map((w) => `<button class="win ${w.start === co.win ? 'is-active' : ''}" data-act="win" data-v="${esc(w.start)}" ${w.left > 0 ? '' : 'disabled'}>
          <b>${esc(SF.t(w.label_ar, w.label_en))}</b><small>${w.left > 0 ? (w.left <= 3 ? t(`باقي ${w.left}`, `${w.left} left`) : t('متاح', 'Available')) : t('مكتمل', 'Full')}</small></button>`).join('')}</div>`
        : `<div class="notice bad">${ic('alert')}<span>${t('ما فيه مواعيد متاحة الحين، جرّب بعدين', 'No times available right now, try again later')}</span></div>`) : ''}`;
  }
  function renderCoPay() {
    const co = S.co, box = $('#coPay');
    if (!box) return;
    const codOn = SF.setOn('pay_cod_enabled', true), cardOn = SF.setOn('pay_card_enabled', false);
    if (!co.pay || (co.pay === 'cod' && !codOn) || (co.pay === 'card' && !cardOn)) co.pay = codOn ? 'cod' : cardOn ? 'card' : 'cod';
    if (!codOn && !cardOn) { box.innerHTML = `<div class="notice bad">${ic('alert')}<span>${t('الدفع غير متاح الحين', 'Payment is not available right now')}</span></div>`; return; }
    box.innerHTML = `<div class="pay-list">
      ${codOn ? `<label class="choice ${co.pay === 'cod' ? 'is-active' : ''}"><input type="radio" name="coPay" value="cod" ${co.pay === 'cod' ? 'checked' : ''}>
        <span class="pay-ic">${glyph('cash')}</span><span class="grow"><b>${co.ful === 'pickup' ? t('كاش عند الاستلام', 'Cash at pickup') : t('كاش عند الاستلام', 'Cash on delivery')}</b><small>${t('تدفع للأسرة لما يوصلك طلبك', 'Pay the kitchen when you get your order')}</small></span></label>` : ''}
      ${cardOn ? `<label class="choice ${co.pay === 'card' ? 'is-active' : ''}"><input type="radio" name="coPay" value="card" ${co.pay === 'card' ? 'checked' : ''}>
        <span class="pay-ic">${glyph('card')}</span><span class="grow"><b>${t('بطاقة', 'Card')}</b><small>${t('مدى، فيزا، ماستركارد، Apple Pay', 'mada, Visa, Mastercard, Apple Pay')}</small></span></label>` : ''}
    </div>`;
  }
  function renderCoPromo() {
    const co = S.co, box = $('#coPromo');
    if (!box) return;
    const pr = co.quote && co.quote.promo;
    if (co.promo) {
      const ok = pr && pr.ok;
      box.innerHTML = `<div class="promo-on ${pr ? (ok ? 'ok' : 'bad') : ''}">${ic('tag', 's')}<b dir="ltr">${esc(co.promo)}</b>
        <span class="grow small">${pr ? esc(SF.t(pr.ar, pr.en)) + (ok && +pr.amount ? ` · ${t('وفرت', 'You save')} ${SF.money(pr.amount)}` : '') : t('نتأكد من الكود...', 'Checking the code...')}</span>
        <button class="link small" data-act="promo-off">${t('شيل', 'Remove')}</button></div>`;
      return;
    }
    box.innerHTML = `<div class="promo-row"><span class="promo-ic">${ic('tag', 's')}</span><input class="input" id="coPromoIn" dir="auto" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="${t('عندك كود خصم؟', 'Have a promo code?')}" value="${esc(co.promoIn)}"><button class="btn btn-soft btn-sm" data-act="promo">${t('طبّق', 'Apply')}</button></div>`;
  }
  function renderCoSum() {
    const co = S.co, box = $('#coSum'), eb = $('#coErr');
    if (!box) return;
    const q = co.quote;
    if (!q) {
      box.innerHTML = co.qErr ? '' : `<div class="sum">${sk('100%', 14)}${sk('100%', 14)}${sk('100%', 22)}</div>`;
      eb.innerHTML = co.qErr ? `<div class="notice bad">${ic('alert')}<span>${esc(co.qErr)}</span><button class="link" data-act="requote">${t('جرّب مرة ثانية', 'Try again')}</button></div>` : '';
      renderCoBtn();
      return;
    }
    const rows = [];
    rows.push(`<div class="r"><span>${t('المجموع', 'Subtotal')}</span><b>${SF.moneyHtml(q.subtotal)}</b></div>`);
    if (q.fulfillment === 'delivery') rows.push(`<div class="r"><span>${t('التوصيل', 'Delivery')}${q.distance_km != null ? ` <small class="muted">(${num1(q.distance_km)} ${t('كم', 'km')})</small>` : ''}</span><b>${+q.delivery_fee ? SF.moneyHtml(q.delivery_fee) : (q.distance_km != null ? t('مجاني', 'Free') : `<span class="muted small">${t('حسب العنوان', 'Set address')}</span>`)}</b></div>`);
    else rows.push(`<div class="r"><span>${t('الاستلام من المطبخ', 'Pickup')}</span><b>${t('بدون رسوم', 'No fee')}</b></div>`);
    if (+q.small_order_fee) rows.push(`<div class="r"><span>${t('رسوم الطلب الصغير', 'Small order fee')}</span><b>${SF.moneyHtml(q.small_order_fee)}</b></div>`);
    if (+q.discount) rows.push(`<div class="r disc"><span>${t('الخصم', 'Discount')}</span><b>−${SF.moneyHtml(q.discount)}</b></div>`);
    if (+q.credit_used) rows.push(`<div class="r disc"><span>${t('من رصيدك', 'Credit')}</span><b>−${SF.moneyHtml(q.credit_used)}</b></div>`);
    if (+q.vat) rows.push(`<div class="r"><span>${t('ضريبة القيمة المضافة', 'VAT')}</span><b>${SF.moneyHtml(q.vat)}</b></div>`);
    rows.push(`<div class="r total"><span>${t('الإجمالي', 'Total')}</span><b>${SF.moneyHtml(q.total)}</b></div>`);
    const eta = q.eta ? (q.eta.asap ? t(`يوصلك بعد حوالي ${+q.eta.eta_min} دقيقة`, `Arrives in about ${+q.eta.eta_min} min`) : `${t('موعدك', 'Your time')}: ${winText(q.eta.start, q.eta.end)}`) : '';
    box.innerHTML = `<div class="sum ${co.quoting ? 'is-loading' : ''}">${rows.join('')}</div>
      ${eta ? `<p class="co-eta">${ic('clock', 's')}${esc(eta)}</p>` : ''}
      ${(q.warnings || []).map((w) => `<div class="notice ok">${ic('gift')}<span>${esc(SF.t(w.ar, w.en))}</span></div>`).join('')}`;
    const errs = (q.errors || []);
    eb.innerHTML = errs.length ? `<div class="notice bad co-errs">${ic('alert')}<ul>${errs.map((e) => `<li>${esc(SF.t(e.ar, e.en))}</li>`).join('')}</ul></div>` : '';
    renderCoBtn();
  }
  function renderCoBtn() {
    const co = S.co;
    if (!co) return;
    const q = co.quote;
    const ok = !!(q && q.ok);
    const label = `${t('أرسل الطلب', 'Place order')}${q ? ` · ${SF.money(q.total)}` : ''}`;
    const btn = (cls) => `<button class="btn btn-primary btn-lg btn-block co-submit ${co.quoting ? 'is-busy' : ''} ${cls}" data-act="submit" ${ok ? '' : 'aria-disabled="true"'}>${co.quoting ? '<span class="spin sm"></span>' : ''}<span>${label}</span></button>`;
    const firstErr = q && !q.ok && q.errors && q.errors[0] ? SF.t(q.errors[0].ar, q.errors[0].en) : '';
    dock(`<div class="co-foot mob-only">${firstErr ? `<p class="co-foot-err">${ic('alert', 's')}<span class="ellipsis">${esc(firstErr)}</span></p>` : ''}${btn('')}</div>`);
    const d = $('#coBtnDesk');
    if (d) d.innerHTML = btn('');
  }
  function quoteInput() {
    const co = S.co;
    const a = co.ful === 'delivery' ? selAddr() : null;
    return {
      family_id: co.fam.id,
      items: S.cart.items.map((i) => ({ dish_id: i.dish_id, qty: i.qty, options: i.options || [], note: i.note || null })),
      fulfillment: co.ful,
      lat: a ? +a.lat : null, lng: a ? +a.lng : null,
      scheduled_for: co.time === 'sched' ? (co.win || null) : null,
      promo: co.promo || null,
      pay_method: co.pay || 'cod',
      use_credit: !!co.useCredit,
    };
  }
  function coChanged(needSlots, delay = 300) {
    const co = S.co;
    if (!co || !co.fam) return;
    if (needSlots) coNeedSlots = true;
    co.quoting = true; co.seq++;
    const sumEl = $('#coSum .sum'); if (sumEl) sumEl.classList.add('is-loading');
    renderCoBtn();
    clearTimeout(coTimer);
    coTimer = setTimeout(runCo, delay);
  }
  async function runCo() {
    const co = S.co;
    if (!co || !co.fam || !S.cart.items.length) return;
    const seq = co.seq;
    const items = S.cart.items.map((i) => ({ dish_id: i.dish_id, qty: i.qty, options: i.options || [], note: i.note || null }));
    try {
      if (coNeedSlots || !co.slots) {
        const sl = await SF.rpc('sf_slots', { p_family: co.fam.id, p_items: items, p_fulfillment: co.ful });
        if (seq !== co.seq || S.co !== co) return;
        coNeedSlots = false;
        co.slots = sl || { asap: { ok: false }, days: [] };
        reconcileTime();
        renderCoTime();
      }
      const q = await SF.rpc('sf_quote', { p: quoteInput() });
      if (seq !== co.seq || S.co !== co) return;
      co.quote = q; co.qErr = ''; co.quoting = false;
      renderCoItems(); renderCoSum(); renderCoPromo();
    } catch (e) {
      if (seq !== co.seq || S.co !== co) return;
      co.quoting = false; co.quote = null; co.qErr = errText(e);
      renderCoSum();
    }
  }
  function onCoChange(e) {
    const co = S.co;
    if (!co) return;
    const el = e.target;
    if (el.name === 'coAddr') { co.addrId = el.value; $$('.addr').forEach((l) => l.classList.toggle('is-active', $('input', l).checked)); coChanged(false); }
    else if (el.name === 'coPay') { co.pay = el.value; renderCoPay(); coChanged(false); }
    else if (el.id === 'coCredit') { co.useCredit = el.checked; coChanged(false); }
  }
  function coActs() {
    const co = S.co;
    return {
      ful: (el) => { if (co.ful === el.dataset.v) return; co.ful = el.dataset.v; renderCoFul(); renderCoAddr(); renderCoPay(); co.slots = null; renderCoTime(); coChanged(true); },
      'addr-new': async () => { const a = await openAddress(null); if (a) { await loadAddresses(); if (!S.addrs.some((x) => x.id === a.id)) S.addrs.unshift(a); co.addrId = a.id; renderCoAddr(); coChanged(false); } },
      'addr-edit': async (el) => { const cur = S.addrs.find((x) => x.id === el.dataset.id); if (!cur) return; const a = await openAddress(cur); if (a) { await loadAddresses(); co.addrId = a.id; renderCoAddr(); coChanged(false); } },
      time: (el) => { if (el.disabled) return; co.time = el.dataset.v; if (co.time === 'sched') reconcileTime(); renderCoTime(); coChanged(false); },
      day: (el) => { co.day = el.dataset.v; const d = ((co.slots && co.slots.days) || []).find((x) => x.date === co.day); const w = d && d.windows.find((x) => x.left > 0); co.win = w ? w.start : null; renderCoTime(); coChanged(false); },
      win: (el) => { if (el.disabled) return; co.win = el.dataset.v; renderCoTime(); coChanged(false); },
      promo: () => { const v = String(co.promoIn || ($('#coPromoIn') || {}).value || '').trim().toUpperCase(); if (!v) { SF.toast(t('اكتب الكود', 'Enter the code'), 'bad'); return; } co.promo = v; renderCoPromo(); coChanged(false, 0); },
      'promo-off': () => { co.promo = ''; co.promoIn = ''; renderCoPromo(); coChanged(false, 0); },
      lnote: (el) => editLineNote(el.dataset.key),
      requote: () => coChanged(true, 0),
      submit: (el) => submitOrder(el),
    };
  }
  function editLineNote(key) {
    const it = S.cart.items.find((i) => i.key === key);
    if (!it) return;
    const s = SF.openSheet(`<div class="sheet-head"><h2>${t('ملاحظة على الطبق', 'Note for this dish')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
      <p class="muted small">${esc(itemName(it))}</p>
      <textarea class="textarea" id="lnote" maxlength="200" placeholder="${t('مثال: بدون بصل', 'e.g. no onion')}">${esc(it.note || '')}</textarea>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="lsave">${t('احفظ', 'Save')}</button></div>`);
    $('#lsave', s.sh).onclick = () => {
      const note = $('#lnote', s.sh).value.trim().slice(0, 200);
      it.note = note;
      const nk = lineKey(it.dish_id, it.options, note);
      const dup = S.cart.items.find((x) => x !== it && x.key === nk);
      if (dup) { dup.qty = Math.min(50, dup.qty + it.qty); S.cart.items = S.cart.items.filter((x) => x !== it); } else it.key = nk;
      saveCart(); s.close();
    };
  }
  async function submitOrder(btn) {
    const co = S.co;
    if (!co || co.placing) return;
    if (co.quoting) { SF.toast(t('لحظة، نحدّث السعر', 'One moment, updating the price'), ''); return; }
    if (!co.quote || !co.quote.ok) {
      const eb = $('#coErr');
      if (eb && eb.firstElementChild) { eb.scrollIntoView({ behavior: 'smooth', block: 'center' }); eb.firstElementChild.classList.remove('shake'); void eb.offsetWidth; eb.firstElementChild.classList.add('shake'); }
      else SF.toast(t('كمّل بيانات الطلب أول', 'Complete the order details first'), 'bad');
      return;
    }
    if (!S.uid || !(S.me.profile && S.me.profile.name)) {
      const ok = await ensureLogin({ title: t('سجّل دخولك عشان نرسل طلبك', 'Sign in to send your order'), sub: t('رقم جوالك يوصل للأسرة عشان تتواصل معك عن الطلب', 'Your number lets the kitchen reach you about the order') });
      if (!ok || S.co !== co) return;
      await adoptGuestAddress();
      renderCoAddr();
      co.seq++; coNeedSlots = true;
      await runCo();
      if (!co.quote || !co.quote.ok) { SF.toast(SF.msgOf(co.quote) || t('راجع بيانات الطلب', 'Please review your order'), 'bad'); return; }
    }
    co.placing = true;
    const b = $('#dock .co-submit') && isDesk() === false ? $('#dock .co-submit') : (btn || $('.co-submit'));
    try {
      await SF.busy(b, async () => {
        const a = co.ful === 'delivery' ? selAddr() : null;
        const p = Object.assign(quoteInput(), {
          name: (S.me.profile && S.me.profile.name) || null,
          note: (co.note || '').trim() || null,
          address: a ? { label: a.label || null, city_id: a.city_id || null, district: a.district || null, street: a.street || null, details: a.details || null } : null,
          source: isStandalone() ? 'app' : 'web',
        });
        let r;
        try { r = await SF.rpc('sf_place_order', { p }); } catch (e) { SF.toast(errText(e), 'bad'); return; }
        if (!r || !r.ok) {
          const codes = ((r && r.errors) || []).map((x) => x.code);
          if (codes.includes('login') || codes.includes('name')) { await ensureLogin({ title: t('كمّل تسجيل دخولك', 'Finish signing in') }); }
          co.quote = Object.assign({}, co.quote || {}, { ok: false, errors: (r && r.errors) || [] });
          renderCoSum();
          SF.toast(SF.msgOf(r) || t('ما قدرنا نرسل الطلب، جرّب مرة ثانية', 'Could not place the order, try again'), 'bad');
          coChanged(true, 600);
          return;
        }
        S.onCart = null;
        S.justPlaced = { id: r.id, at: Date.now() };
        S.cart = emptyCart(); S.co = null; saveCart();
        refreshLive();
        if (r.pay_method === 'card') { await startPayment(r.id, true); return; }
        SF.toast(r.status === 'new' ? t('وصل طلبك للأسرة', 'Your order was sent to the kitchen') : t('تم إرسال طلبك', 'Order placed'), 'ok');
        go('#/order/' + r.id, { replace: true });
      });
    } finally { co.placing = false; }
  }
  async function adoptGuestAddress() {
    const g = LS.get('sf_addr_v1', null);
    await loadAddresses();
    if (g && S.uid) {
      const same = S.addrs.find((a) => Math.abs(a.lat - g.lat) < 1e-5 && Math.abs(a.lng - g.lng) < 1e-5);
      if (same) { if (S.co) S.co.addrId = same.id; }
      else {
        const { data } = await SF.sb.from('sf_addresses').insert(Object.assign({ user_id: S.uid, is_default: !S.addrs.length }, g)).select().single();
        if (data) { S.addrs.unshift(data); if (S.co) S.co.addrId = data.id; }
      }
      LS.del('sf_addr_v1');
    }
    if (S.co) pickAddr();
  }

  /* ───────── الدفع بالبطاقة ───────── */
  async function startPayment(orderId, fromCheckout) {
    const s = await SF.auth.session();
    if (!s) { SF.toast(t('سجّل دخولك أول', 'Please sign in first'), 'bad'); return false; }
    let j = {};
    try {
      const res = await fetch(`${SF.cfg.url}/functions/v1/pay/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: SF.cfg.key },
        body: JSON.stringify({ order_id: orderId }),
      });
      j = await res.json().catch(() => ({}));
    } catch { SF.toast(t('تأكد من الإنترنت وجرب مرة ثانية', 'Check your connection and try again'), 'bad'); }
    if (j && j.url) {
      const Br = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
      if (isNative() && Br) {
        try {
          const h = await Br.addListener('browserFinished', () => { try { h.remove(); } catch { /* */ } S.payReturn = orderId; go('#/order/' + orderId, { replace: true }); });
          await Br.open({ url: j.url, presentationStyle: 'popover' });
          if (fromCheckout) go('#/order/' + orderId, { replace: true });
          return true;
        } catch { /* نكمل بالطريقة العادية */ }
      }
      location.href = j.url;
      return true;
    }
    if (j && j.paid) { SF.toast(t('الطلب مدفوع', 'This order is paid'), 'ok'); }
    else if (j && j.mode === 'off') SF.toast(t('الدفع بالبطاقة غير متاح الحين', 'Card payment is not available right now'), 'bad');
    else if (j && j.error === 'state') SF.toast(t('الطلب ما يحتاج دفع الحين', 'This order does not need payment now'), '');
    else if (j && j.error) SF.toast(t('ما قدرنا نفتح صفحة الدفع، جرّب بعد شوي', 'Could not open the payment page, try again shortly'), 'bad');
    if (fromCheckout) go('#/order/' + orderId, { replace: true });
    else route(true);
    return false;
  }
  async function payStatus(orderId) {
    const s = await SF.auth.session();
    if (!s) return null;
    try {
      const r = await fetch(`${SF.cfg.url}/functions/v1/pay/status?order=${encodeURIComponent(orderId)}`, { headers: { Authorization: 'Bearer ' + s.access_token, apikey: SF.cfg.key } });
      return await r.json().catch(() => null);
    } catch { return null; }
  }

  /* ═════════════════════ طلباتي ═════════════════════ */
  const ORDER_LIST_COLS = 'id,order_no,status,fulfillment,total,created_at,scheduled_for,window_end,ready_eta,done_at,status_at,rating,items,family_id,pay_method,pay_status,cancel_reason,family:sf_families(id,slug,name_ar,name_en,logo_url)';
  async function viewOrders(_, q, ctx) {
    chrome({ mode: 'main', tab: 'orders', nav: true, cartbar: true });
    if (!S.uid) { needLogin(t('طلباتك هنا', 'Your orders live here'), t('سجّل دخولك برقم جوالك عشان تتابع طلباتك', 'Sign in with your phone to track your orders')); return; }
    $('#view').innerHTML = `<div class="page narrow orders-page"><div class="page-h"><h1>${t('طلباتي', 'My orders')}</h1></div>
      <div class="stack">${Array.from({ length: 3 }, () => `<div class="card pad stack s">${sk('55%', 18)}${sk('80%', 13)}${sk('35%', 16)}</div>`).join('')}</div></div>`;
    const load = async () => {
      const { data, error } = await SF.sb.from('sf_orders').select(ORDER_LIST_COLS).eq('user_id', S.uid).order('created_at', { ascending: false }).limit(60);
      if (error) throw Object.assign(new Error(error.message), { text: SF.errText(error) });
      return data || [];
    };
    let list = await load();
    if (!ctx.isCur()) return;
    const render = () => {
      const live = list.filter((o) => LIVE.includes(o.status));
      const past = list.filter((o) => !LIVE.includes(o.status));
      $('#view').innerHTML = `<div class="page narrow orders-page"><div class="page-h"><h1>${t('طلباتي', 'My orders')}</h1></div>
        ${!list.length ? emptyBox('receipt', t('ما عندك طلبات للحين', 'No orders yet'), t('أول طلب من أكل البيت يبدأ من هنا', 'Your first home-cooked order starts here'), `<button class="btn btn-primary btn-lg" data-href="#/">${t('تصفح الأسر', 'Browse kitchens')}</button>`) : ''}
        ${live.length ? `<section class="section"><div class="section-head"><h2>${t('طلبات شغالة', 'Active orders')} <span class="cnt">${live.length}</span></h2></div><div class="stack">${live.map(orderCard).join('')}</div></section>` : ''}
        ${past.length ? `<section class="section"><div class="section-head"><h2>${t('الطلبات السابقة', 'Past orders')}</h2></div><div class="stack">${past.map(orderCard).join('')}</div></section>` : ''}
      </div>`;
      settle($('#view'));
    };
    render();
    S.acts = {
      rate: (el) => { const o = list.find((x) => x.id === el.dataset.id); if (o) openRate(o, async () => { list = await load(); if (ctx.isCur()) render(); }); },
      reorder: (el) => { const o = list.find((x) => x.id === el.dataset.id); if (o) reorder(o); },
    };
    const reload = debounce(async () => { try { list = await load(); if (ctx.isCur()) render(); } catch { /* */ } }, 500);
    const ch = SF.live('sf_orders', 'user_id=eq.' + S.uid, reload);
    S.cleanup.push(() => SF.sb.removeChannel(ch));
  }
  function itemsSummary(items) {
    return (items || []).map((i) => `${esc(SF.t(i.name_ar, i.name_en || i.name_ar))}${+i.qty > 1 ? ` <bdi dir="ltr">×${+i.qty}</bdi>` : ''}`).join(t('، ', ', '));
  }
  const PROG = { pending_payment: 8, new: 18, preparing: 48, ready: 74, on_the_way: 88 };
  function orderCard(o) {
    const live = LIVE.includes(o.status), done = DONE.includes(o.status);
    const f = o.family || {};
    const canRate = done && !o.rating && o.done_at && Date.now() - new Date(o.done_at).getTime() < 14 * 86400000;
    return `<div class="oc-card card ${live ? 'is-live' : ''}" role="link" tabindex="0" data-href="#/order/${o.id}">
      <div class="oc-top"><span class="oc-logo">${logoHtml(f)}</span>
        <div class="grow"><b class="ellipsis">${esc(nm(f) || t('أسرة', 'Kitchen'))}</b><small>${ono(o.order_no)} · ${esc(SF.fmtDT(o.created_at))}</small></div>
        ${SF.statusBadge(o.status, o.fulfillment)}</div>
      ${live ? `<div class="oc-eta">${ic('clock', 's')}<span>${esc(etaLine(o))}</span></div><div class="oc-prog" aria-hidden="true"><span style="width:${PROG[o.status] || 10}%"></span></div>` : ''}
      <p class="oc-items clamp2">${itemsSummary(o.items)}</p>
      <div class="oc-foot"><span class="price">${SF.moneyHtml(o.total)}</span><span class="grow"></span>
        ${canRate ? `<button class="btn btn-soft btn-sm" data-act="rate" data-id="${o.id}">${ic('star', 's')}${t('قيّم', 'Rate')}</button>` : ''}
        ${o.rating ? starsRow(o.rating, true) : ''}
        ${!live ? `<button class="btn btn-ghost btn-sm" data-act="reorder" data-id="${o.id}">${ic('refresh', 's')}${t('اطلب نفسه', 'Reorder')}</button>` : ''}
      </div>
    </div>`;
  }
  const REASONS = { 'ألغاه العميل': 'Cancelled by you', 'ما اكتمل الدفع': 'Payment was not completed', 'الأسرة ما ردت على الطلب': 'The kitchen did not respond' };
  const reasonText = (r) => (SF.lang === 'en' && REASONS[r] ? REASONS[r] : r);
  function etaLine(o) {
    switch (o.status) {
      case 'pending_payment': return t('بانتظار الدفع عشان يوصل طلبك للأسرة', 'Waiting for payment before it reaches the kitchen');
      case 'new': return o.scheduled_for ? `${t('موعدك', 'Scheduled')} ${winText(o.scheduled_for, o.window_end)}` : t('بانتظار قبول الأسرة، عادة خلال دقايق', 'Waiting for the kitchen to accept, usually within minutes');
      case 'preparing': return o.ready_eta ? `${t('متوقع يجهز', 'Expected ready')} ${dayOf(o.ready_eta) === SF.todayISO() ? SF.fmtTime(o.ready_eta) : winText(o.ready_eta)}` : t('الأسرة تجهز طلبك', 'The kitchen is preparing your order');
      case 'ready': return o.fulfillment === 'pickup' ? t('طلبك جاهز، تقدر تستلمه الحين', 'Your order is ready for pickup') : t('طلبك جاهز وبيطلع لك قريب', 'Your order is ready and leaving soon');
      case 'on_the_way': return t('طلبك في الطريق لك', 'Your order is on the way');
      case 'delivered': case 'picked_up': return `${t('بالعافية عليك', 'Enjoy your meal')} · ${SF.fmtDT(o.done_at || o.status_at)}`;
      case 'cancelled': return o.cancel_reason ? reasonText(o.cancel_reason) : t('انلغى الطلب', 'The order was cancelled');
      case 'rejected': return o.cancel_reason ? reasonText(o.cancel_reason) : t('اعتذرت الأسرة عن الطلب', 'The kitchen declined the order');
      default: return '';
    }
  }
  async function reorder(o) {
    let f = o.family;
    if (!f || !f.slug) { const { data } = await SF.sb.from('sf_families').select('id,slug,name_ar,name_en').eq('id', o.family_id).maybeSingle(); f = data; }
    if (!f) { SF.toast(t('الأسرة غير متاحة الحين', 'This kitchen is not available now'), 'bad'); return; }
    if (S.cart.items.length && S.cart.family_id !== o.family_id) {
      const ok = await SF.confirm({ title: t('تبدأ سلة جديدة؟', 'Start a new cart?'), body: t(`سلتك فيها أطباق من ${cartFam()}، وبنبدلها بطلبك من ${nm(f)}.`, `Your cart has dishes from ${cartFam()}; we will replace it with your order from ${nm(f)}.`), ok: t('ابدأ سلة جديدة', 'Start a new cart') });
      if (!ok) return;
      S.cart = emptyCart();
    }
    Object.assign(S.cart, { family_id: o.family_id, family_slug: f.slug, family_ar: f.name_ar, family_en: f.name_en });
    (o.items || []).forEach((i) => {
      const options = (i.options || []).map((x) => x.id).filter((x) => x != null).map(String);
      const key = lineKey(i.dish_id, options, i.note || '');
      const ex = S.cart.items.find((x) => x.key === key);
      if (ex) ex.qty = Math.min(50, ex.qty + (+i.qty || 1));
      else S.cart.items.push({ key, dish_id: i.dish_id, qty: +i.qty || 1, options, note: i.note || '', name_ar: i.name_ar, name_en: i.name_en, image_url: i.image_url, unit_est: +i.unit_price || 0,
        opts_ar: (i.options || []).map((x) => x.name_ar).join('، '), opts_en: (i.options || []).map((x) => x.name_en || x.name_ar).join(', ') });
    });
    saveCart();
    SF.toast(t('انضاف طلبك للسلة', 'Added to your cart'), 'ok');
    go('#/checkout');
  }

  /* ═════════════════════ تتبع الطلب ═════════════════════ */
  const ORDER_COLS = '*, family:sf_families(id,slug,name_ar,name_en,logo_url,district)';
  const ST_ICON = { pending_payment: 'wallet', new: 'clock', preparing: 'flame', ready: 'bag', on_the_way: 'bike', delivered: 'check', picked_up: 'check', cancelled: 'x', rejected: 'x' };
  async function viewOrder([id], q, ctx) {
    chrome({ mode: 'sub', nav: false, cartbar: false, title: t('تفاصيل الطلب', 'Order details'), back: '#/orders' });
    if (!S.uid) { needLogin(t('سجّل دخولك عشان تشوف طلبك', 'Sign in to see your order'), t('نفس الرقم اللي طلبت فيه', 'Use the same number you ordered with')); return; }
    $('#view').innerHTML = `<div class="page order-page no-nav"><div class="o-grid"><div class="o-col"><div class="o-hero is-sk">${sk('64px', 64, '22px')}<div class="grow stack s">${sk('40%', 13)}${sk('65%', 26)}${sk('80%', 14)}</div></div>
      <div class="card pad stack">${sk('70%', 16)}${sk('60%', 16)}${sk('75%', 16)}</div></div><div class="o-col"><div class="card pad stack">${sk('50%', 16)}${sk('100%', 44)}</div></div></div></div>`;
    const O = { id, o: null, ev: [], contact: null, paying: false };
    const load = async () => {
      const [oR, eR] = await Promise.all([
        SF.sb.from('sf_orders').select(ORDER_COLS).eq('id', id).maybeSingle(),
        SF.sb.from('sf_order_events').select('status,by_role,note,created_at').eq('order_id', id).order('id'),
      ]);
      if (oR.error) throw Object.assign(new Error(oR.error.message), { text: SF.errText(oR.error) });
      O.o = oR.data; O.ev = eR.data || [];
      if (O.o && ['preparing', 'ready', 'on_the_way', 'delivered', 'picked_up'].includes(O.o.status) && !(O.contact && O.contact.ok)) {
        try { const c = await SF.rpc('sf_order_contact', { p_order: id }); O.contact = c && c.ok ? c : null; } catch { /* */ }
      }
    };
    await load();
    if (!ctx.isCur()) return;
    if (!O.o) {
      $('#view').innerHTML = `<div class="page narrow no-nav">${emptyBox('receipt', t('الطلب غير موجود', 'Order not found'), t('تأكد إنك داخل بنفس الرقم اللي طلبت فيه', 'Make sure you are signed in with the number you ordered with'), `<button class="btn btn-primary" data-href="#/orders">${t('طلباتي', 'My orders')}</button>`)}</div>`;
      return;
    }
    chrome({ mode: 'sub', nav: false, cartbar: false, title: `${t('طلب', 'Order')} ${isoNo(O.o.order_no)}`, back: '#/orders' });
    const render = () => { if (ctx.isCur() && O.o) { renderOrder(O); settle($('#view')); } };
    render();
    const reload = debounce(async () => { try { await load(); render(); } catch { /* */ } }, 350);
    const c1 = SF.live('sf_orders', 'id=eq.' + id, reload);
    const c2 = SF.live('sf_order_events', 'order_id=eq.' + id, reload);
    S.onNotif = (n) => { if (n && n.order_id === id) { reload(); return true; } return false; };
    S.cleanup.push(() => { SF.sb.removeChannel(c1); SF.sb.removeChannel(c2); });
    S.acts = {
      pay: () => startPayment(id, false),
      cancel: () => cancelOrder(O.o, reload),
      rate: () => openRate(O.o, reload),
      complaint: () => openComplaint(O.o),
      reorder: () => reorder(O.o),
      'pay-check': async (el) => { await SF.busy(el, async () => { await payStatus(id); await load(); }); render(); },
    };
    if (S.payReturn === id) { S.payReturn = null; pollPay(O, ctx, load, render); }
    if ((q.rate === '1' || S.rateReturn === id) && DONE.includes(O.o.status) && !O.o.rating) { S.rateReturn = null; setTimeout(() => ctx.isCur() && openRate(O.o, reload), 300); }
  }
  async function pollPay(O, ctx, load, render) {
    O.paying = true; render();
    await payStatus(O.id);
    for (let i = 0; i < 8; i++) {
      try { await load(); } catch { /* */ }
      if (!ctx.isCur()) return;
      if (O.o.pay_status === 'paid' || O.o.status !== 'pending_payment') break;
      await sleep(2500);
      if (i === 3) await payStatus(O.id);
    }
    O.paying = false;
    if (!ctx.isCur()) return;
    if (O.o.pay_status === 'paid') SF.toast(t('تم الدفع، وطلبك وصل للأسرة', 'Payment received, your order reached the kitchen'), 'ok');
    else if (O.o.status === 'pending_payment') SF.toast(t('ما تأكد الدفع للحين، تقدر تحاول مرة ثانية', 'Payment is not confirmed yet, you can try again'), 'bad');
    render();
  }
  function timelineHtml(o, events) {
    const steps = o.fulfillment === 'pickup' ? ['new', 'preparing', 'ready', 'picked_up'] : ['new', 'preparing', 'ready', 'on_the_way', 'delivered'];
    if (o.pay_method === 'card') steps.unshift('pending_payment');
    const label = {
      pending_payment: t('الدفع', 'Payment'), new: t('وصل طلبك للأسرة', 'Sent to the kitchen'), preparing: t('الأسرة تجهز طلبك', 'Being prepared'),
      ready: o.fulfillment === 'pickup' ? t('جاهز للاستلام', 'Ready for pickup') : t('الطلب جاهز', 'Order ready'),
      on_the_way: t('في الطريق لك', 'On the way'), delivered: t('تم التوصيل', 'Delivered'), picked_up: t('تم الاستلام', 'Picked up'),
    };
    const at = {};
    (events || []).forEach((e) => { at[e.status] = e.created_at; });
    if (at.paid && !at.new) at.new = at.paid;
    if (o.pay_method === 'card' && at.paid) at.pending_payment = at.paid;
    const bad = ['cancelled', 'rejected'].includes(o.status);
    const fin = DONE.includes(o.status);
    let cur = steps.indexOf(o.status);
    if (bad) { const reached = steps.filter((s) => at[s]); cur = reached.length ? steps.indexOf(reached[reached.length - 1]) : 0; }
    if (cur < 0) cur = 0;
    let html = steps.map((s, i) => {
      if (bad && i > cur) return '';
      if (fin && s === 'on_the_way' && !at.on_the_way) return '';
      const cls = bad || i < cur || (fin && i === cur) ? 'done' : i === cur ? 'now' : 'todo';
      return `<div class="tl-step ${cls}"><div class="tl-dot">${cls === 'done' ? ic('check') : cls === 'now' ? ic(ST_ICON[s] || 'clock') : ''}</div>
        <div><b>${label[s]}</b>${at[s] && cls !== 'todo' ? `<small>${esc(SF.fmtTime(at[s]))}${dayOf(at[s]) !== SF.todayISO() ? ` · ${esc(SF.fmtShort(at[s]))}` : ''}</small>` : ''}</div></div>`;
    }).join('');
    if (bad) {
      html += `<div class="tl-step bad"><div class="tl-dot">${ic('x')}</div><div><b>${o.status === 'rejected' ? t('اعتذرت الأسرة', 'Declined by the kitchen') : t('انلغى الطلب', 'Order cancelled')}</b>
        <small>${esc(SF.fmtTime(o.cancelled_at || o.status_at))}${o.cancel_reason ? ` · ${esc(reasonText(o.cancel_reason))}` : ''}</small></div></div>`;
    }
    return `<div class="timeline">${html}</div>`;
  }
  function payLine(o) {
    if (o.pay_method === 'cod') return o.pay_status === 'paid' ? t('كاش عند الاستلام · تم الدفع', 'Cash on delivery · paid') : o.fulfillment === 'pickup' ? t('كاش عند الاستلام', 'Cash at pickup') : t('كاش عند الاستلام', 'Cash on delivery');
    if (o.pay_method === 'free') return t('مدفوع بالرصيد', 'Paid with credit');
    switch (o.pay_status) {
      case 'paid': return t('مدفوع بالبطاقة', 'Paid by card');
      case 'refund_pending': return t('المبلغ بيرجع لبطاقتك', 'Refund is on its way');
      case 'refunded': return t('رجع المبلغ لبطاقتك', 'Refunded to your card');
      case 'failed': return t('ما تم الدفع', 'Payment failed');
      default: return t('بانتظار الدفع', 'Awaiting payment');
    }
  }
  function sumRows(o) {
    const r = [`<div class="r"><span>${t('المجموع', 'Subtotal')}</span><b>${SF.moneyHtml(o.subtotal)}</b></div>`];
    if (o.fulfillment === 'delivery') r.push(`<div class="r"><span>${t('التوصيل', 'Delivery')}${o.distance_km != null ? ` <small class="muted">(${num1(o.distance_km)} ${t('كم', 'km')})</small>` : ''}</span><b>${+o.delivery_fee ? SF.moneyHtml(o.delivery_fee) : t('مجاني', 'Free')}</b></div>`);
    if (+o.small_order_fee) r.push(`<div class="r"><span>${t('رسوم الطلب الصغير', 'Small order fee')}</span><b>${SF.moneyHtml(o.small_order_fee)}</b></div>`);
    if (+o.discount) r.push(`<div class="r disc"><span>${t('الخصم', 'Discount')}${o.promo_code ? ` <small dir="ltr">${esc(o.promo_code)}</small>` : ''}</span><b>−${SF.moneyHtml(o.discount)}</b></div>`);
    if (+o.credit_used) r.push(`<div class="r disc"><span>${t('من رصيدك', 'Credit')}</span><b>−${SF.moneyHtml(o.credit_used)}</b></div>`);
    if (+o.vat) r.push(`<div class="r"><span>${t('ضريبة القيمة المضافة', 'VAT')}</span><b>${SF.moneyHtml(o.vat)}</b></div>`);
    r.push(`<div class="r total"><span>${t('الإجمالي', 'Total')}</span><b>${SF.moneyHtml(o.total)}</b></div>`);
    return r.join('');
  }
  function itemsList(o) {
    return (o.items || []).map((i) => {
      const opts = (i.options || []).map((x) => SF.t(x.name_ar, x.name_en || x.name_ar)).join(t('، ', ', '));
      return `<div class="oi"><span class="oi-q" dir="ltr">${+i.qty}×</span><div class="grow"><b>${esc(SF.t(i.name_ar, i.name_en || i.name_ar))}</b>${opts ? `<small>${esc(opts)}</small>` : ''}${i.note ? `<small class="cl-note">${ic('edit', 's')}${esc(i.note)}</small>` : ''}</div><span class="price">${SF.moneyHtml(i.line_total)}</span></div>`;
    }).join('');
  }
  function renderOrder(O) {
    const o = O.o, f = o.family || {};
    const live = LIVE.includes(o.status), done = DONE.includes(o.status), bad = ['cancelled', 'rejected'].includes(o.status);
    const tone = done ? 'ok' : bad ? 'bad' : o.status === 'pending_payment' ? 'warn' : o.status === 'new' ? 'info' : 'live';
    const canRate = done && !o.rating && o.done_at && Date.now() - new Date(o.done_at).getTime() < 14 * 86400000;
    const c = O.contact;
    const ph = c && (c.phone || c.whatsapp);
    const pk = c && c.pickup && c.pickup.lat != null ? c.pickup : null;
    const a = o.address || {};
    const contactHtml = c && c.ok ? `<div class="o-contact">
        ${ph ? `<a class="btn btn-soft" href="tel:+${esc(SF.normPhone(ph) || ph)}">${ic('phone', 's')}${t('اتصل', 'Call')}</a>
        <a class="btn btn-soft" href="${esc(SF.waLink(c.whatsapp || ph, t(`السلام عليكم، بخصوص طلب رقم ${o.order_no} من سُفرة`, `Hello, about Sufrah order #${o.order_no}`)))}" target="_blank" rel="noopener">${ic('whatsapp', 's')}${t('واتساب', 'WhatsApp')}</a>` : ''}
        ${pk ? `<a class="btn btn-soft" href="https://maps.google.com/?q=${+pk.lat},${+pk.lng}" target="_blank" rel="noopener">${ic('nav', 's')}${t('موقع المطبخ', 'Kitchen location')}</a>` : ''}
      </div>${pk && pk.address ? `<p class="small muted">${ic('pin', 's')} ${esc(pk.address)}</p>` : ''}`
      : live && !bad ? `<p class="small muted o-wait">${ic('lock', 's')}${t('رقم الأسرة يظهر لك بعد ما تقبل الطلب', 'The kitchen contact shows once it accepts your order')}</p>` : '';
    $('#view').innerHTML = `<div class="page order-page no-nav">
      <div class="page-h desk-only"><button class="link back-link" data-act="back">${backIc('s')} ${t('طلباتي', 'My orders')}</button></div>
      <div class="o-grid">
        <div class="o-col">
          <section class="o-hero tone-${tone} ${live ? 'is-live' : ''}">
            <div class="o-ic">${ic(ST_ICON[o.status] || 'receipt', 'l')}</div>
            <div class="o-ht">
              <small>${t('طلب', 'Order')} ${ono(o.order_no)} · ${esc(SF.fmtDT(o.created_at))}</small>
              <h1>${esc(SF.statusLabel(o.status, o.fulfillment))}</h1>
              <p>${esc(etaLine(o))}</p>
              ${live ? `<span class="live-pill"><span class="live-dot"></span>${t('يتحدث مباشرة', 'Live updates')}</span>` : ''}
            </div>
          </section>
          ${O.paying ? `<div class="notice info"><span class="spin sm"></span><span>${t('نتأكد من الدفع...', 'Confirming your payment...')}</span></div>` : ''}
          ${o.status === 'pending_payment' && !O.paying ? `<section class="card pad pay-box"><p>${t('طلبك يوصل للأسرة بعد الدفع.', 'Your order reaches the kitchen after payment.')}</p>
            <button class="btn btn-primary btn-lg btn-block" data-act="pay">${glyph('card', 's')}${t('ادفع الحين', 'Pay now')} · ${SF.money(o.total)}</button>
            <button class="link small" data-act="pay-check">${ic('refresh', 's')} ${t('دفعت؟ تحقق من الدفع', 'Already paid? Check status')}</button></section>` : ''}
          <section class="card pad o-tl"><h2>${t('مراحل الطلب', 'Order progress')}</h2>${timelineHtml(o, O.ev)}</section>
          ${canRate ? `<button class="btn btn-primary btn-lg btn-block rate-cta" data-act="rate">${ic('star', 's')}${t('قيّم طلبك', 'Rate your order')}</button>` : ''}
          ${o.rating ? `<section class="card pad my-rate"><div class="row between"><h2>${t('تقييمك', 'Your rating')}</h2>${starsRow(o.rating)}</div>${o.review ? `<p>${esc(o.review)}</p>` : ''}
            ${o.review_photo ? `<button class="rv-photo" data-act="photo" data-src="${esc(o.review_photo)}">${pic(o.review_photo, { seed: o.id })}</button>` : ''}
            ${o.family_reply ? `<div class="rv-reply"><b>${t('رد الأسرة', 'Kitchen reply')}</b><p>${esc(o.family_reply)}</p></div>` : ''}</section>` : ''}
          <div class="o-acts">
            ${!live ? `<button class="btn btn-soft" data-act="reorder">${ic('refresh', 's')}${t('اطلب نفسه مرة ثانية', 'Order again')}</button>` : ''}
            ${!bad && o.status !== 'pending_payment' ? `<button class="btn btn-soft" data-href="#/invoice/${o.id}">${ic('file', 's')}${t('الفاتورة', 'Invoice')}</button>` : ''}
            ${o.status !== 'pending_payment' ? `<button class="btn btn-ghost" data-act="complaint">${ic('chat', 's')}${t('عندك مشكلة؟', 'Having an issue?')}</button>` : ''}
            ${['pending_payment', 'new'].includes(o.status) ? `<button class="btn btn-danger" data-act="cancel">${ic('x', 's')}${t('إلغاء الطلب', 'Cancel order')}</button>` : ''}
          </div>
        </div>
        <div class="o-col">
          <section class="card pad o-fam">
            <div class="o-fam-h"><span class="oc-logo">${logoHtml(f)}</span><div class="grow"><b>${esc(nm(f) || t('أسرة', 'Kitchen'))}</b><small>${f.district ? esc(f.district) + ' · ' : ''}${o.fulfillment === 'pickup' ? t('استلام من المطبخ', 'Pickup') : t('توصيل', 'Delivery')}</small></div>
              ${f.slug ? `<a class="btn btn-ghost btn-sm" href="${famLink(f.slug)}">${t('المنيو', 'Menu')}</a>` : ''}</div>
            ${contactHtml}
          </section>
          ${o.fulfillment === 'delivery' && (a.district || a.street || a.label) ? `<section class="card pad o-addr"><h2>${t('يوصل إلى', 'Delivering to')}</h2>
            <div class="addr-show"><span class="addr-ic">${ic(labelIcon(a.label), 's')}</span><div class="grow"><b>${esc(labelText(a.label))}</b><small>${esc(addrLine(a))}</small></div></div></section>` : ''}
          ${o.scheduled_for ? `<section class="card pad o-when"><h2>${t('الموعد', 'Scheduled for')}</h2><p class="when">${ic('calendar', 's')}${esc(winText(o.scheduled_for, o.window_end))}</p></section>` : ''}
          <section class="card pad o-items"><h2>${t('الأطباق', 'Items')}</h2>${itemsList(o)}${o.note ? `<p class="o-note">${ic('chat', 's')}${esc(o.note)}</p>` : ''}</section>
          <section class="card pad o-sum"><h2>${t('الحساب', 'Payment')}</h2><div class="sum">${sumRows(o)}</div><p class="pay-line">${glyph(o.pay_method === 'cod' ? 'cash' : 'card', 's')}${esc(payLine(o))}</p></section>
        </div>
      </div>
    </div>`;
  }
  async function cancelOrder(o, after) {
    const r = await SF.confirm({
      title: t('تلغي الطلب؟', 'Cancel this order?'),
      body: t('بنبلغ الأسرة إنك ألغيت الطلب.', 'We will let the kitchen know you cancelled.'),
      ok: t('إلغاء الطلب', 'Cancel order'), cancel: t('رجوع', 'Back'), danger: true,
      input: { placeholder: t('السبب (اختياري)', 'Reason (optional)') },
    });
    if (r === null || r === false) return;
    try {
      const res = await SF.rpc('sf_order_cancel', { p_order: o.id, p_reason: r || null });
      if (res && res.ok) { SF.toast(t('انلغى الطلب', 'Order cancelled'), 'ok'); refreshLive(); if (after) after(); }
      else SF.toast(SF.msgOf(res) || t('ما قدرنا نلغي الطلب', 'Could not cancel the order'), 'bad');
    } catch (e) { SF.toast(errText(e), 'bad'); }
  }

  /* ───────── التقييم والشكوى (مع صورة اختيارية) ───────── */
  function photoPicker(box) {
    const st = { file: null };
    const paint = () => {
      box.innerHTML = st.file
        ? `<div class="pp-prev"><img alt="" src="${URL.createObjectURL(st.file)}"><button type="button" class="icon-btn pp-x" aria-label="${t('شيل الصورة', 'Remove photo')}">${ic('x', 's')}</button></div>`
        : `<label class="pp-btn">${ic('camera')}<span>${t('أضف صورة', 'Add a photo')} <small class="muted">${t('(اختياري)', '(optional)')}</small></span><input type="file" accept="image/*" hidden></label>`;
      const inp = $('input', box);
      if (inp) inp.onchange = () => { const f = inp.files && inp.files[0]; if (f && /^image\//.test(f.type)) { st.file = f; paint(); } };
      const x = $('.pp-x', box);
      if (x) x.onclick = () => { st.file = null; paint(); };
    };
    paint();
    return st;
  }
  function openRate(o, after) {
    let rating = 0;
    const fname = o.family ? nm(o.family) : t('الأسرة', 'the kitchen');
    const WORDS = [t('ما عجبني', 'Not good'), t('مقبول', 'Okay'), t('زين', 'Good'), t('لذيذ', 'Tasty'), t('ممتاز، بطلبه مرة ثانية', 'Excellent, I will order again')];
    const s = SF.openSheet(`
      <div class="sheet-head"><h2>${t('قيّم طلبك', 'Rate your order')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
      <p class="muted center">${t('كيف كان طلبك من', 'How was your order from')} <b>${esc(fname)}</b>${t('؟', '?')}</p>
      <div class="rate-pick" role="radiogroup" aria-label="${t('عدد النجوم', 'Stars')}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n}">${ic('star')}</button>`).join('')}</div>
      <p class="rate-word center" aria-live="polite">&nbsp;</p>
      <label class="field"><span>${t('تعليقك', 'Your comment')} <small class="muted">${t('(اختياري)', '(optional)')}</small></span>
        <textarea class="textarea" id="rt" maxlength="500" placeholder="${t('وش عجبك؟ وش نقدر نحسّن؟', 'What did you like? What could be better?')}"></textarea></label>
      <div class="pp" id="rph"></div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="rs">${t('أرسل التقييم', 'Submit rating')}</button></div>`, { noFocus: true });
    const pp = photoPicker($('#rph', s.sh));
    const paint = () => { $$('.rate-pick button', s.sh).forEach((b) => b.classList.toggle('on', +b.dataset.n <= rating)); $('.rate-word', s.sh).textContent = rating ? WORDS[rating - 1] : '\u00a0'; };
    $('.rate-pick', s.sh).addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { rating = +b.dataset.n; paint(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } });
    $('#rs', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      if (!rating) { SF.toast(t('اختر عدد النجوم', 'Choose a rating'), 'bad'); return; }
      try {
        let url = null;
        if (pp.file) url = await SF.uploadImage('reviews/' + S.uid, pp.file, { maxDim: 1280 });
        const r = await SF.rpc('sf_order_rate', { p_order: o.id, p_rating: rating, p_review: $('#rt', s.sh).value.trim() || null, p_photo: url });
        if (!r || !r.ok) { SF.toast(SF.msgOf(r) || t('ما انحفظ التقييم', 'Rating was not saved'), 'bad'); return; }
        SF.toast(t('شكرًا على تقييمك', 'Thanks for your rating'), 'ok');
        s.close();
        if (after) after();
      } catch (err) { SF.toast(errText(err), 'bad'); }
    });
  }
  const KINDS = () => [['late', t('تأخر الطلب', 'Late order')], ['quality', t('جودة الأكل', 'Food quality')], ['missing', t('ناقص شي', 'Something missing')], ['wrong', t('طلب غلط', 'Wrong order')],
    ['cancel', t('إلغاء', 'Cancellation')], ['refund', t('استرجاع مبلغ', 'Refund')], ['payment', t('الدفع', 'Payment')], ['other', t('غيره', 'Other')]];
  function openComplaint(o) {
    let kind = '';
    const s = SF.openSheet(`
      <div class="sheet-head"><h2>${t('عندك مشكلة؟', 'Having an issue?')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
      <p class="muted small">${t('قول لنا وش صار في طلب', 'Tell us what happened with order')} ${ono(o.order_no)}${t('، وفريق سُفرة يتابع معك.', ', and the Sufrah team will follow up.')}</p>
      <div class="field"><span>${t('نوع المشكلة', 'Issue type')}</span><div class="chips wrap-chips kinds">${KINDS().map(([k, l]) => `<button type="button" class="chip" data-k="${k}">${l}</button>`).join('')}</div></div>
      <label class="field"><span>${t('وش صار؟', 'What happened?')}</span><textarea class="textarea" id="cb" maxlength="1000" placeholder="${t('اكتب التفاصيل عشان نقدر نساعدك', 'Write the details so we can help')}"></textarea></label>
      <div class="pp" id="cph"></div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="cs">${t('أرسل', 'Send')}</button></div>`, { noFocus: true });
    const pp = photoPicker($('#cph', s.sh));
    $('.kinds', s.sh).addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $$('.kinds .chip', s.sh).forEach((x) => x.classList.toggle('is-active', x === b)); });
    $('#cs', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const body = $('#cb', s.sh).value.trim();
      if (!kind) { SF.toast(t('اختر نوع المشكلة', 'Choose the issue type'), 'bad'); return; }
      if (body.length < 3) { SF.toast(t('اكتب وش صار', 'Describe what happened'), 'bad'); $('#cb', s.sh).focus(); return; }
      try {
        let url = null;
        if (pp.file) url = await SF.uploadImage('reviews/' + S.uid, pp.file, { maxDim: 1280 });
        const r = await SF.rpc('sf_complaint_new', { p: { order_id: o.id, kind, body, photo_url: url } });
        if (!r || !r.ok) { SF.toast(SF.msgOf(r) || t('ما وصلت رسالتك، جرّب مرة ثانية', 'Not sent, try again'), 'bad'); return; }
        SF.toast(t('وصلتنا ملاحظتك، بنرد عليك قريب', 'We got it and will get back to you soon'), 'ok');
        s.close();
      } catch (err) { SF.toast(errText(err), 'bad'); }
    });
  }
  function openPhoto(src) {
    if (!src) return;
    SF.openSheet(`<div class="viewer"><img src="${esc(src)}" alt=""></div><button class="icon-btn dsh-x" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button>`, { noFocus: true }).sh.classList.add('photo-sheet');
  }

  /* ═════════════════════ الفاتورة ═════════════════════ */
  let qrP = null;
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrP) qrP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'; s.onload = () => res(window.qrcode); s.onerror = () => { qrP = null; rej(new Error('qr')); }; document.head.appendChild(s); });
    return qrP;
  }
  function zatcaTLV(fields) {
    const enc = new TextEncoder(); const bytes = [];
    fields.forEach(([tag, val]) => { const b = enc.encode(String(val)); bytes.push(tag, b.length, ...b); });
    let bin = ''; bytes.forEach((x) => { bin += String.fromCharCode(x); });
    return btoa(bin);
  }
  function doPrint() {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    const restore = () => { if (prev) root.setAttribute('data-theme', prev); else root.removeAttribute('data-theme'); window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => { window.print(); setTimeout(restore, 1500); }, 60);
  }
  async function viewInvoice([id], q, ctx) {
    chrome({ mode: 'sub', nav: false, cartbar: false, title: t('الفاتورة', 'Invoice'), back: '#/order/' + id });
    if (!S.uid) { needLogin(t('سجّل دخولك عشان تشوف الفاتورة', 'Sign in to view the invoice'), ''); return; }
    $('#view').innerHTML = `<div class="page inv-page no-nav"><div class="inv">${sk('100%', 10, '0')}<div class="inv-body stack">${sk('40%', 24)}${sk('70%', 14)}${sk('100%', 120, '12px')}${sk('50%', 20)}</div></div></div>`;
    const [{ data: o, error }] = await Promise.all([SF.sb.from('sf_orders').select(ORDER_COLS).eq('id', id).maybeSingle(), SF.loadSettings()]);
    if (!ctx.isCur()) return;
    if (error) throw Object.assign(new Error(error.message), { text: SF.errText(error) });
    if (!o) { $('#view').innerHTML = `<div class="page narrow no-nav">${emptyBox('file', t('الفاتورة غير موجودة', 'Invoice not found'), '')}</div>`; return; }
    const st = SF.settings;
    const vatOn = SF.setOn('vat_registered', false);
    const seller = st.legal_name || SF.t(st.app_name || 'سُفرة', st.app_name_en || 'Sufrah');
    const f = o.family || {};
    const cancelled = ['cancelled', 'rejected'].includes(o.status);
    const meta = [
      [t('رقم الفاتورة', 'Invoice no.'), `<span dir="ltr">INV-${esc(o.order_no)}</span>`],
      [t('تاريخ الطلب', 'Order date'), esc(SF.fmtDate(o.created_at, { year: 'numeric', month: 'short' })) + ' · ' + esc(SF.fmtTime(o.created_at))],
      o.done_at ? [t('تاريخ التسليم', 'Completed'), esc(SF.fmtDT(o.done_at))] : null,
      [t('الأسرة', 'Kitchen'), esc(nm(f))],
      [t('العميل', 'Customer'), esc(o.customer_name || '') + (o.customer_phone ? ` <span dir="ltr">${esc(SF.showPhone(o.customer_phone))}</span>` : '')],
      [t('الاستلام', 'Fulfillment'), o.fulfillment === 'pickup' ? t('استلام من المطبخ', 'Pickup') : t('توصيل', 'Delivery') + (o.address && o.address.district ? ` · ${esc(o.address.district)}` : '')],
      [t('الدفع', 'Payment'), esc(payLine(o))],
    ].filter(Boolean);
    $('#view').innerHTML = `<div class="page inv-page no-nav">
      <div class="inv-acts no-print">
        <button class="btn btn-primary" data-act="print">${ic('download', 's')}${t('طباعة', 'Print')}</button>
        <button class="btn btn-soft" data-act="print">${ic('file', 's')}${t('حفظ PDF', 'Save PDF')}</button>
      </div>
      <article class="inv ${cancelled ? 'is-void' : ''}">
        <div class="sadu"></div>
        <div class="inv-body">
          <header class="inv-h">
            <div class="inv-brand"><img src="img/mark.svg" alt="" width="44" height="44"><div><b>${esc(SF.t(st.app_name || 'سُفرة', st.app_name_en || 'Sufrah'))}</b>
              ${st.legal_name ? `<small>${esc(st.legal_name)}</small>` : ''}
              ${st.cr_number ? `<small>${t('السجل التجاري', 'CR')} <span dir="ltr">${esc(st.cr_number)}</span></small>` : ''}
              ${st.vat_number ? `<small>${t('الرقم الضريبي', 'VAT no.')} <span dir="ltr">${esc(st.vat_number)}</span></small>` : ''}</div></div>
            <div class="inv-title"><h1>${vatOn ? t('فاتورة ضريبية مبسطة', 'Simplified tax invoice') : t('فاتورة', 'Invoice')}</h1><span>${t('طلب', 'Order')} ${ono(o.order_no)}</span>
              ${cancelled ? `<span class="badge b-bad">${t('ملغي', 'Void')}</span>` : ''}</div>
          </header>
          <dl class="inv-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
          <table class="inv-t">
            <thead><tr><th>${t('الصنف', 'Item')}</th><th class="num">${t('الكمية', 'Qty')}</th><th class="num">${t('السعر', 'Price')}</th><th class="num">${t('المجموع', 'Total')}</th></tr></thead>
            <tbody>${(o.items || []).map((i) => {
              const opts = (i.options || []).map((x) => SF.t(x.name_ar, x.name_en || x.name_ar)).join(t('، ', ', '));
              return `<tr><td><b>${esc(SF.t(i.name_ar, i.name_en || i.name_ar))}</b>${opts ? `<small>${esc(opts)}</small>` : ''}</td><td class="num">${+i.qty}</td><td class="num">${SF.n2(i.unit_price)}</td><td class="num">${SF.n2(i.line_total)}</td></tr>`;
            }).join('')}</tbody>
          </table>
          <div class="inv-foot">
            ${vatOn ? `<div class="inv-qr"><div id="qr" class="qr-box" aria-label="${t('رمز الفاتورة', 'Invoice QR')}"></div><small>${t('رمز الفاتورة الإلكترونية', 'E-invoice QR code')}</small></div>` : ''}
            <div class="sum inv-sum">${sumRows(o)}</div>
          </div>
          <p class="inv-thanks">${t('شكرًا لطلبك من سُفرة، وبالعافية عليك', 'Thank you for ordering with Sufrah. Enjoy your meal')}</p>
        </div>
      </article>
    </div>`;
    S.acts = { print: () => doPrint() };
    if (vatOn) {
      try {
        const qrcode = await loadQR();
        if (!ctx.isCur()) return;
        const b64 = zatcaTLV([[1, seller], [2, st.vat_number || ''], [3, new Date(o.created_at).toISOString()], [4, (+o.total).toFixed(2)], [5, (+o.vat).toFixed(2)]]);
        const qr = qrcode(0, 'M'); qr.addData(b64); qr.make();
        const box = $('#qr'); if (box) box.innerHTML = qr.createSvgTag(4, 2);
      } catch { const box = $('#qr'); if (box) box.closest('.inv-qr').remove(); }
    }
  }

  /* ═════════════════════ حسابي ═════════════════════ */
  async function viewAccount(_, q, ctx) {
    chrome({ mode: 'main', tab: 'account', nav: true, cartbar: true });
    const st = SF.settings;
    const sup = st.support_whatsapp;
    const credOn = SF.setOn('credits_enabled', false), refOn = SF.setOn('referral_enabled', false);
    const pushOn = await pushState();
    if (!ctx.isCur()) return;
    const me = S.me, pr = me.profile || {};
    const row = (icn, label, attrs, extra = '', cls = '') => `<button class="acc-row ${cls}" ${attrs}><span class="ri">${icn.startsWith('<') ? icn : ic(icn, 's')}</span><span class="grow">${label}</span>${extra || fwd('s chev')}</button>`;
    const linkRow = (icn, label, href, ext) => `<a class="acc-row" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''}><span class="ri">${ic(icn, 's')}</span><span class="grow">${label}</span>${fwd('s chev')}</a>`;
    $('#view').innerHTML = `<div class="page narrow acc-page">
      <div class="page-h"><h1>${t('حسابي', 'My account')}</h1></div>
      ${S.uid ? `<section class="acc-head card">
          <span class="avatar">${esc(initial(pr.name || '?'))}</span>
          <div class="grow"><h2 class="ellipsis">${esc(pr.name || t('بدون اسم', 'No name yet'))}</h2><p class="muted"><span dir="ltr">${esc(SF.showPhone(me.phone))}</span></p></div>
          <button class="btn btn-soft btn-sm" data-act="edit-name">${ic('edit', 's')}${t('تعديل', 'Edit')}</button>
        </section>`
        : `<section class="acc-guest card"><span class="avatar">${ic('user')}</span><div class="grow"><h2>${t('حيّاك في سُفرة', 'Welcome to Sufrah')}</h2><p class="muted">${t('سجّل دخولك عشان تتابع طلباتك وتحفظ عناوينك', 'Sign in to track orders and save addresses')}</p></div>
          <button class="btn btn-primary" data-act="login">${t('سجّل دخولك', 'Sign in')}</button></section>`}
      ${S.uid ? `<div class="acc-group card">
          ${row('pin', t('عناويني', 'My addresses'), 'data-href="#/addresses"')}
          ${row('heart', t('المفضلة', 'Favorites'), 'data-href="#/favorites"')}
          ${row('chat', t('شكاويّ', 'My complaints'), 'data-act="complaints"')}
        </div>` : ''}
      ${S.uid && (credOn || refOn) ? `<section class="card pad credit-card">
          ${credOn ? `<div class="cc-bal"><small>${t('رصيدك', 'Your credit')}</small><b>${SF.moneyHtml(me.credit || 0)}</b></div>` : ''}
          ${refOn && pr.referral_code ? `<div class="cc-ref"><b>${t('ادعُ صديق', 'Invite a friend')}</b>
            <p class="small muted">${t(`صديقك ياخذ ${SF.money(SF.setNum('referral_friend_credit', 10))} وأنت تاخذ ${SF.money(SF.setNum('referral_reward_credit', 10))} بعد أول طلب له`, `Your friend gets ${SF.money(SF.setNum('referral_friend_credit', 10))} and you get ${SF.money(SF.setNum('referral_reward_credit', 10))} after their first order`)}</p>
            <div class="ref-code"><b dir="ltr">${esc(pr.referral_code)}</b><button class="btn btn-soft btn-sm" data-act="ref-share">${ic('share', 's')}${t('شارك', 'Share')}</button></div>
            <div class="promo-row"><span class="promo-ic">${ic('gift', 's')}</span><input class="input" id="refIn" dir="ltr" maxlength="12" placeholder="${t('عندك كود صديق؟', 'Have a friend code?')}"><button class="btn btn-soft btn-sm" data-act="ref-use">${t('استخدم', 'Use')}</button></div></div>` : ''}
        </section>` : ''}
      <div class="acc-group card">
        ${S.uid ? `<label class="acc-row" for="pushSw"><span class="ri">${ic('bell', 's')}</span><span class="grow">${t('الإشعارات', 'Notifications')}</span><span class="switch"><input type="checkbox" id="pushSw" ${pushOn ? 'checked' : ''}><span></span></span></label>` : ''}
        <div class="acc-row lang-row"><span class="ri">${ic('globe', 's')}</span><span class="grow">${t('اللغة', 'Language')}</span>
          <div class="seg mini"><button class="${SF.lang === 'ar' ? 'is-active' : ''}" data-act="set-lang" data-v="ar">العربية</button><button class="${SF.lang === 'en' ? 'is-active' : ''}" data-act="set-lang" data-v="en">English</button></div></div>
      </div>
      <div class="acc-group card">
        ${linkRow('store', t('انضم كأسرة منتجة', 'Join as a home kitchen'), 'join.html')}
        ${sup ? `<a class="acc-row" href="${esc(SF.waLink(sup, t('السلام عليكم، عندي استفسار عن سُفرة', 'Hello, I have a question about Sufrah')))}" target="_blank" rel="noopener"><span class="ri">${ic('whatsapp', 's')}</span><span class="grow">${t('الدعم على الواتساب', 'WhatsApp support')}</span>${fwd('s chev')}</a>` : ''}
        ${linkRow('file', t('الشروط', 'Terms'), 'terms.html')}
        ${linkRow('shield', t('الخصوصية', 'Privacy'), 'privacy.html')}
        ${linkRow('image', t('مصادر الصور', 'Photo credits'), 'credits.html')}
      </div>
      ${S.uid ? `<div class="acc-group card">
          ${row('logout', t('تسجيل الخروج', 'Sign out'), 'data-act="logout"', ' ')}
          ${row('trash', t('حذف الحساب', 'Delete account'), 'data-act="delete"', ' ', 'danger')}
        </div>` : ''}
      <p class="acc-foot"><img src="img/mark.svg" alt="" width="22" height="22">${t('سُفرة · أكل بيت من الأسر المنتجة', 'Sufrah · home cooking from local families')}</p>
    </div>`;
    S.acts = {
      'edit-name': () => openNameEdit(),
      complaints: () => openComplaints(),
      'set-lang': (el) => SF.setLang(el.dataset.v),
      'ref-share': () => shareLink(t('سُفرة', 'Sufrah'), t(`جرّب سُفرة لأكل البيوت، واستخدم كودي ${pr.referral_code} وياصلك رصيد`, `Try Sufrah for home cooking and use my code ${pr.referral_code} for credit`), shareUrl()),
      'ref-use': async (el) => {
        const v = ($('#refIn').value || '').trim();
        if (!v) { SF.toast(t('اكتب الكود', 'Enter the code'), 'bad'); return; }
        await SF.busy(el, async () => { try { const r = await SF.rpc('sf_referral_use', { p_code: v }); SF.toast(SF.msgOf(r) || '', r && r.ok ? 'ok' : 'bad'); if (r && r.ok) { await refreshMe(true); route(true); } } catch (e) { SF.toast(errText(e), 'bad'); } });
      },
      logout: async () => {
        const ok = await SF.confirm({ title: t('تسجيل الخروج؟', 'Sign out?'), ok: t('سجّل خروج', 'Sign out') });
        if (!ok) return;
        await SF.auth.signOut();
        await afterAuth(true);
        SF.toast(t('سجّلت خروجك', 'You are signed out'), '');
        go('#/', { replace: true });
      },
      delete: () => deleteAccount(),
    };
    const sw = $('#pushSw');
    if (sw) on(sw, 'change', async () => {
      if (sw.checked) {
        const r = await Promise.race([SF.enablePush().catch(() => ({ ok: false })), sleep(15000).then(() => ({ ok: false, why: 'timeout' }))]);
        if (r && r.ok) SF.toast(t('تفعّلت الإشعارات', 'Notifications are on'), 'ok');
        else {
          sw.checked = false;
          SF.toast(r && r.why === 'denied' ? t('اسمح بالإشعارات من إعدادات جهازك', 'Allow notifications in your device settings')
            : r && r.why === 'unsupported' ? t('جهازك ما يدعم الإشعارات من المتصفح', 'This browser does not support notifications')
              : t('الإشعارات غير متاحة الحين', 'Notifications are not available right now'), 'bad');
        }
      } else {
        await disablePush();
        SF.toast(t('وقفنا الإشعارات على هالجهاز', 'Notifications are off on this device'), '');
      }
    });
  }
  async function pushState() {
    try {
      if (isNative()) { const PN = window.Capacitor.Plugins.PushNotifications; if (!PN) return false; const p = await PN.checkPermissions(); return p.receive === 'granted'; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false;
      const reg = await Promise.race([navigator.serviceWorker.getRegistration(), sleep(800)]);
      const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
      return !!sub;
    } catch { return false; }
  }
  async function disablePush() {
    try {
      if (isNative()) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) { const tok = JSON.stringify(sub); await sub.unsubscribe(); await SF.sb.from('sf_devices').delete().eq('user_id', S.uid).eq('token', tok); }
    } catch { /* */ }
  }
  function openNameEdit() {
    const pr = S.me.profile || {};
    const s = SF.openSheet(`<div class="sheet-head"><h2>${t('بياناتك', 'Your details')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
      <label class="field"><span>${t('الاسم', 'Name')}</span><input class="input" id="pn" maxlength="60" autocomplete="name" value="${esc(pr.name || '')}"></label>
      <label class="check-row"><input type="checkbox" id="pm" ${pr.marketing_ok !== false ? 'checked' : ''}><span>${t('أبي توصلني العروض', 'Send me offers')}</span></label>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="ps">${t('احفظ', 'Save')}</button></div>`);
    $('#ps', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const name = $('#pn', s.sh).value.trim();
      if (name.length < 2) { SF.toast(t('اكتب اسمك', 'Enter your name'), 'bad'); return; }
      try { S.me = await SF.rpc('sf_profile_save', { p: { name, marketing_ok: $('#pm', s.sh).checked } }); S.uid = S.me.uid; await SF.me(true); SF.toast(t('انحفظت بياناتك', 'Saved'), 'ok'); s.close(); route(true); }
      catch (err) { SF.toast(errText(err), 'bad'); }
    });
  }
  async function openComplaints() {
    const s = SF.openSheet(`<div class="sheet-head"><h2>${t('شكاويّ', 'My complaints')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div><div id="cl" class="stack">${sk('100%', 70, '16px')}${sk('100%', 70, '16px')}</div>`);
    const { data } = await SF.sb.from('sf_complaints').select('id,kind,body,status,admin_note,created_at,order_id').eq('user_id', S.uid).order('created_at', { ascending: false }).limit(30);
    const box = $('#cl', s.sh);
    if (!box) return;
    const ST = { open: ['b-info', t('مفتوحة', 'Open')], in_progress: ['b-warn', t('قيد المتابعة', 'In progress')], resolved: ['b-ok', t('انحلت', 'Resolved')], rejected: ['b-bad', t('مرفوضة', 'Closed')] };
    const kinds = Object.fromEntries(KINDS());
    box.innerHTML = (data || []).length ? data.map((c) => `<div class="cmp">
        <div class="row between"><b>${esc(kinds[c.kind] || c.kind)}</b><span class="badge ${(ST[c.status] || ST.open)[0]}">${(ST[c.status] || ST.open)[1]}</span></div>
        <p>${esc(c.body)}</p><small class="muted">${esc(SF.fmtDT(c.created_at))}</small>
        ${c.admin_note ? `<div class="rv-reply"><b>${t('رد فريق سُفرة', 'Sufrah team reply')}</b><p>${esc(c.admin_note)}</p></div>` : ''}
        ${c.order_id ? `<button class="link small" data-o="${c.order_id}">${t('افتح الطلب', 'Open order')}</button>` : ''}</div>`).join('')
      : emptyBox('chat', t('ما عندك شكاوى', 'No complaints'), t('نتمنى تكون كل طلباتك تمام', 'We hope all your orders went well'));
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-o]'); if (b) { s.close(); go('#/order/' + b.dataset.o); } });
  }
  async function deleteAccount() {
    const a = await SF.confirm({ title: t('تحذف حسابك؟', 'Delete your account?'), body: t('بتنحذف عناوينك ومفضلتك وإشعاراتك، وطلباتك السابقة تبقى بدون اسمك ورقمك.', 'Your addresses, favorites and notifications will be deleted. Past orders stay without your name or number.'), ok: t('كمّل', 'Continue'), danger: true });
    if (!a) return;
    const b = await SF.confirm({ title: t('متأكد؟', 'Are you sure?'), body: t('ما نقدر نرجع الحساب بعد الحذف.', 'This cannot be undone.'), ok: t('احذف حسابي نهائيًا', 'Delete my account'), danger: true });
    if (!b) return;
    const s = await SF.auth.session();
    if (!s) return;
    try {
      const res = await fetch(`${SF.cfg.url}/functions/v1/delete-account`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: SF.cfg.key }, body: '{}' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { SF.toast(SF.msgOf(j) || t('ما قدرنا نحذف الحساب، كلم الدعم', 'Could not delete the account, contact support'), 'bad'); return; }
      try { await SF.auth.signOut(); } catch { /* */ }
      ['sf_addr_v1', 'sf_recent_v1', 'sf_cart_v1'].forEach((k) => LS.del(k));
      S.cart = emptyCart();
      await afterAuth(true);
      SF.toast(t('انحذف حسابك', 'Your account was deleted'), 'ok');
      go('#/', { replace: true });
    } catch (e) { SF.toast(errText(e), 'bad'); }
  }

  /* ═════════════════════ عناويني ═════════════════════ */
  async function viewAddresses(_, q, ctx) {
    chrome({ mode: 'sub', nav: false, cartbar: false, title: t('عناويني', 'My addresses'), back: '#/account' });
    if (!S.uid) { needLogin(t('سجّل دخولك عشان تحفظ عناوينك', 'Sign in to save your addresses'), ''); return; }
    $('#view').innerHTML = `<div class="page narrow no-nav">${sk('100%', 72, '16px')}</div>`;
    await loadAddresses();
    if (!ctx.isCur()) return;
    const render = () => {
      $('#view').innerHTML = `<div class="page narrow no-nav addr-page">
        <div class="page-h desk-only"><button class="link back-link" data-act="back">${backIc('s')} ${t('حسابي', 'My account')}</button><h1>${t('عناويني', 'My addresses')}</h1></div>
        ${S.addrs.length ? `<div class="stack">${S.addrs.map((a) => `<div class="card pad addr-card">
            <div class="addr-show"><span class="addr-ic">${ic(labelIcon(a.label), 's')}</span><div class="grow"><b>${esc(labelText(a.label))} ${a.is_default ? `<span class="badge b-brand">${t('الافتراضي', 'Default')}</span>` : ''}</b><small>${esc(addrLine(a))}</small></div></div>
            <div class="addr-acts">${!a.is_default ? `<button class="btn btn-ghost btn-sm" data-act="a-def" data-id="${a.id}">${ic('check', 's')}${t('اجعله الافتراضي', 'Make default')}</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-act="a-edit" data-id="${a.id}">${ic('edit', 's')}${t('تعديل', 'Edit')}</button>
              <button class="btn btn-ghost btn-sm danger-t" data-act="a-del" data-id="${a.id}">${ic('trash', 's')}${t('حذف', 'Delete')}</button></div>
          </div>`).join('')}</div>`
          : emptyBox('pin', t('ما عندك عناوين محفوظة', 'No saved addresses'), t('أضف عنوانك مرة وحدة وبنستخدمه في طلباتك', 'Add your address once and use it for every order'))}
        <button class="btn btn-primary btn-lg btn-block add-addr" data-act="a-new">${ic('plus', 's')}${t('أضف عنوان', 'Add address')}</button>
      </div>`;
    };
    render();
    const refresh = async () => { await loadAddresses(); if (ctx.isCur()) render(); };
    S.acts = {
      'a-new': async () => { if (await openAddress(null)) refresh(); },
      'a-edit': async (el) => { const a = S.addrs.find((x) => x.id === el.dataset.id); if (a && await openAddress(a)) refresh(); },
      'a-del': async (el) => {
        const ok = await SF.confirm({ title: t('تحذف العنوان؟', 'Delete this address?'), ok: t('احذف', 'Delete'), danger: true });
        if (!ok) return;
        const { error } = await SF.sb.from('sf_addresses').delete().eq('id', el.dataset.id).eq('user_id', S.uid);
        if (error) SF.toast(SF.errText(error), 'bad'); else { SF.toast(t('انحذف العنوان', 'Address deleted'), ''); refresh(); }
      },
      'a-def': async (el) => {
        await SF.sb.from('sf_addresses').update({ is_default: false }).eq('user_id', S.uid).neq('id', el.dataset.id);
        const { error } = await SF.sb.from('sf_addresses').update({ is_default: true }).eq('id', el.dataset.id).eq('user_id', S.uid);
        if (error) SF.toast(SF.errText(error), 'bad'); else refresh();
      },
    };
  }

  /* ───────── لوح العنوان بالخريطة ───────── */
  let leafP = null;
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (!leafP) {
      leafP = new Promise((res, rej) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
        const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.onload = () => res(window.L); s.onerror = () => { leafP = null; rej(new Error('leaflet')); };
        document.head.appendChild(s);
      });
    }
    return leafP;
  }
  const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180; const dLa = (b.lat - a.lat) * r, dLn = (b.lng - a.lng) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const nearestCity = (p) => S.cities.filter((c) => c.lat != null).map((c) => ({ c, d: kmBetween(p, { lat: +c.lat, lng: +c.lng }) })).sort((a, b) => a.d - b.d)[0] || null;
  function getPos() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej({ code: 0 }); return; }
      navigator.geolocation.getCurrentPosition((p) => { const v = { lat: p.coords.latitude, lng: p.coords.longitude }; S.geo = v; LS.set('sf_geo_v1', v); res(v); }, rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }
  const geoErr = (e) => (e && e.code === 1 ? t('اسمح بالموقع من إعدادات المتصفح', 'Allow location access in your browser settings') : t('ما قدرنا نحدد موقعك', 'Could not get your location'));
  function openAddress(existing) {
    return new Promise((resolve) => {
      let done = false, map = null, cityTouched = !!existing;
      const a = existing || {};
      const c0 = cityObj(a.city_id || S.city) || S.cities[0] || { lat: 26.2794, lng: 50.2083 };
      const lat0 = a.lat != null ? +a.lat : S.geo ? S.geo.lat : +c0.lat;
      const lng0 = a.lng != null ? +a.lng : S.geo ? S.geo.lng : +c0.lng;
      const preset = ['البيت', 'الشغل'];
      let label = a.label || 'البيت';
      const other = !preset.includes(label);
      const s = SF.openSheet(`
        <div class="sheet-head"><h2>${existing ? t('تعديل العنوان', 'Edit address') : t('عنوان جديد', 'New address')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
        <div class="map-box addr-map"><div class="amap" dir="ltr"></div><div class="pin">${PIN_SVG}</div><span class="pin-shadow"></span>
          <button type="button" class="btn btn-sm map-me" data-me>${ic('nav', 's')}<span>${t('موقعي الحالي', 'My location')}</span></button></div>
        <p class="hint-line">${ic('info', 's')}<span>${t('حرّك الخريطة لين يصير الدبوس على بابك', 'Move the map until the pin is on your door')}</span></p>
        <div class="form-grid">
          <label class="field"><span>${t('المدينة', 'City')}</span><select class="select" id="aCity">${S.cities.map((c) => `<option value="${esc(c.id)}">${esc(nm(c))}</option>`).join('')}</select></label>
          <label class="field"><span>${t('الحي', 'District')}</span><input class="input" id="aDist" maxlength="80" value="${esc(a.district || '')}" placeholder="${t('مثال: العقربية', 'e.g. Al Aqrabiyah')}"></label>
        </div>
        <label class="field"><span>${t('الشارع', 'Street')} <small class="muted">${t('(اختياري)', '(optional)')}</small></span><input class="input" id="aStreet" maxlength="120" value="${esc(a.street || '')}"></label>
        <label class="field"><span>${t('تفاصيل العنوان', 'Address details')} <small class="muted">${t('(العمارة، الدور، الشقة)', '(building, floor, apartment)')}</small></span><input class="input" id="aDet" maxlength="200" value="${esc(a.details || '')}"></label>
        <div class="field"><span>${t('اسم العنوان', 'Label')}</span>
          <div class="chips lbl-chips">
            <button type="button" class="chip ${label === 'البيت' ? 'is-active' : ''}" data-lbl="البيت">${ic('home', 's')}${t('البيت', 'Home')}</button>
            <button type="button" class="chip ${label === 'الشغل' ? 'is-active' : ''}" data-lbl="الشغل">${ic('store', 's')}${t('الشغل', 'Work')}</button>
            <button type="button" class="chip ${other ? 'is-active' : ''}" data-lbl="other">${ic('pin', 's')}${t('غيره', 'Other')}</button>
          </div>
          <input class="input ${other ? '' : 'hide'}" id="aLblO" maxlength="30" value="${other ? esc(label) : ''}" placeholder="${t('مثال: بيت أهلي', 'e.g. Family house')}">
        </div>
        <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="aSave">${t('احفظ العنوان', 'Save address')}</button></div>`,
        { noFocus: true, onClose: () => { if (map) { try { map.remove(); } catch { /* */ } map = null; } if (!done) resolve(null); } });
      s.sh.classList.add('addr-sheet');
      const box = $('.addr-map', s.sh), citySel = $('#aCity', s.sh), distEl = $('#aDist', s.sh), lblO = $('#aLblO', s.sh);
      citySel.value = (cityObj(a.city_id) || cityObj(S.city) || S.cities[0] || {}).id || '';
      citySel.addEventListener('change', () => { cityTouched = true; });
      // سحب الخريطة ما يقفل اللوح
      ['touchstart', 'touchmove'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
      $('.lbl-chips', s.sh).addEventListener('click', (e) => {
        const b = e.target.closest('[data-lbl]'); if (!b) return;
        $$('.lbl-chips .chip', s.sh).forEach((x) => x.classList.toggle('is-active', x === b));
        lblO.classList.toggle('hide', b.dataset.lbl !== 'other');
        if (b.dataset.lbl === 'other') lblO.focus();
        label = b.dataset.lbl;
      });
      const curLabel = () => (label === 'other' || !preset.includes(label) ? (lblO.value.trim() || t('غيره', 'Other')) : label);
      loadLeaflet().then((L) => {
        if (!s.sh.isConnected) return;
        map = L.map($('.amap', s.sh), { zoomControl: false, attributionControl: true }).setView([lat0, lng0], existing ? 17 : 15);
        map.attributionControl.setPrefix(false);
        s.sh._map = map;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
        setTimeout(() => map && map.invalidateSize(), 360);
        map.on('movestart', () => box.classList.add('moving'));
        map.on('moveend', () => {
          box.classList.remove('moving');
          if (cityTouched) return;
          const c = map.getCenter(); const n = nearestCity({ lat: c.lat, lng: c.lng });
          if (n && n.d < 60) citySel.value = n.c.id;
        });
      }).catch(() => { box.classList.add('failed'); $('.amap', s.sh).innerHTML = `<div class="map-fail">${ic('alert')}<span>${t('ما قدرنا نحمّل الخريطة، تأكد من الإنترنت', 'Could not load the map, check your connection')}</span></div>`; });
      $('[data-me]', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
        try { const p = await getPos(); if (map) map.setView([p.lat, p.lng], 17); } catch (err) { SF.toast(geoErr(err), 'bad'); }
      });
      $('#aSave', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
        if (!map) { SF.toast(t('انتظر لين تحمل الخريطة', 'Wait for the map to load'), 'bad'); return; }
        const c = map.getCenter();
        const district = distEl.value.trim();
        if (!district) { distEl.classList.add('is-bad'); distEl.focus(); SF.toast(t('اكتب اسم الحي', 'Enter the district'), 'bad'); return; }
        const row = { label: curLabel(), city_id: citySel.value || null, district, street: $('#aStreet', s.sh).value.trim() || null, details: $('#aDet', s.sh).value.trim() || null, lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) };
        let saved = null;
        if (S.uid) {
          if (existing && existing.id !== 'local') {
            const { data, error } = await SF.sb.from('sf_addresses').update(row).eq('id', existing.id).eq('user_id', S.uid).select().single();
            if (error) { SF.toast(SF.errText(error), 'bad'); return; }
            saved = data;
          } else {
            const first = !S.addrs.some((x) => x.id !== 'local');
            const { data, error } = await SF.sb.from('sf_addresses').insert(Object.assign({ user_id: S.uid, is_default: first }, row)).select().single();
            if (error) { SF.toast(SF.errText(error), 'bad'); return; }
            saved = data;
          }
        } else { LS.set('sf_addr_v1', row); saved = Object.assign({ id: 'local' }, row); }
        done = true; s.close(); resolve(saved);
        SF.toast(t('انحفظ العنوان', 'Address saved'), 'ok');
      });
    });
  }

  /* ═════════════════════ المفضلة ═════════════════════ */
  async function viewFavorites(_, q, ctx) {
    chrome({ mode: 'sub', nav: false, cartbar: true, title: t('المفضلة', 'Favorites'), back: '#/account' });
    if (!S.uid) { needLogin(t('سجّل دخولك عشان تشوف مفضلتك', 'Sign in to see your favorites'), ''); return; }
    $('#view').innerHTML = `<div class="page no-nav"><div class="fam-grid">${Array.from({ length: 2 }, famSkelCard).join('')}</div></div>`;
    const { data, error } = await SF.sb.from('sf_favorites').select('family_id, created_at, family:sf_families(id,slug,name_ar,name_en,logo_url,cover_url,district,rating_avg,rating_count,prep_min,is_open,delivery_enabled,pickup_enabled,delivery_tiers,min_order,cuisines,status)').eq('user_id', S.uid).order('created_at', { ascending: false });
    if (!ctx.isCur()) return;
    if (error) throw Object.assign(new Error(error.message), { text: SF.errText(error) });
    const homeF = new Map(((S.home && S.home.families) || []).map((f) => [f.id, f]));
    const fams = (data || []).map((r) => r.family).filter((f) => f && f.status === 'active').map((f) => Object.assign({}, f, homeF.get(f.id) || { open_now: null }));
    $('#view').innerHTML = `<div class="page no-nav fav-page">
      <div class="page-h desk-only"><button class="link back-link" data-act="back">${backIc('s')} ${t('حسابي', 'My account')}</button><h1>${t('المفضلة', 'Favorites')}</h1></div>
      ${fams.length ? `<div class="fam-grid">${fams.map(famCard).join('')}</div>`
        : emptyBox('heart', t('ما عندك مفضلة للحين', 'No favorites yet'), t('اضغط القلب في صفحة أي أسرة وبتلقاها هنا', 'Tap the heart on any kitchen page to keep it here'), `<button class="btn btn-primary" data-href="#/">${t('تصفح الأسر', 'Browse kitchens')}</button>`)}
    </div>`;
  }

  /* ═════════════════════ الصيانة ═════════════════════ */
  function viewMaint() {
    chrome({ mode: 'main', tab: 'home', nav: true, cartbar: false });
    $('#view').innerHTML = `<div class="page narrow maint">
      <div class="maint-art">${ic('dish', 'l')}</div>
      <h1>${t('نرجع لكم قريب', 'We will be back soon')}</h1>
      <p>${t('نجهّز سُفرة بحلة أحسن، والطلبات متوقفة مؤقتًا. طلباتك الحالية تقدر تتابعها من طلباتي.', 'We are preparing something better and ordering is paused for now. You can still follow your current orders.')}</p>
      <button class="btn btn-soft btn-lg" data-href="#/orders">${ic('receipt', 's')}${t('طلباتي', 'My orders')}</button>
      <div class="sadu"></div>
    </div>`;
  }

  /* ───────── لوح الموقع (المدينة) ───────── */
  function openLocation() {
    const s = SF.openSheet(`
      <div class="sheet-head"><h2>${t('وين نوصل لك؟', 'Where should we deliver?')}</h2><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div>
      <button class="btn btn-soft btn-lg btn-block" data-gps>${ic('nav', 's')}${t('استخدم موقعي', 'Use my location')}</button>
      <p class="sheet-sub">${t('أو اختر مدينتك', 'Or choose your city')}</p>
      <div class="stack s city-list">${S.cities.map((c) => `<button class="choice city ${c.id === S.city ? 'is-active' : ''}" data-city="${esc(c.id)}"><span class="ci">${ic('pin', 's')}</span><span class="grow"><b>${esc(nm(c))}</b></span>${c.id === S.city ? ic('check', 's') : ''}</button>`).join('')}</div>`, { noFocus: true });
    s.sh.addEventListener('click', (e) => {
      const cb = e.target.closest('[data-city]');
      if (cb) { setCity(cb.dataset.city); s.close(); return; }
      const g = e.target.closest('[data-gps]');
      if (g) {
        SF.busy(g, async () => {
          try {
            const p = await getPos();
            const n = nearestCity(p);
            if (!n) return;
            setCity(n.c.id);
            SF.toast(n.d < 60 ? t(`حددنا مدينتك: ${n.c.name_ar}`, `Your city: ${n.c.name_en || n.c.name_ar}`) : t(`أقرب مدينة نخدمها: ${n.c.name_ar}`, `Nearest city we serve: ${n.c.name_en || n.c.name_ar}`), 'ok');
            s.close();
          } catch (err) { SF.toast(geoErr(err), 'bad'); }
        });
      }
    });
  }
  function setCity(id) {
    if (S.city === id) return;
    S.city = id; LS.set('sf_city_v1', id);
    S.filters.cat = null; S.sdish = { q: '', list: [] };
    S.home = LS.get(homeKey(), null);
    renderTop();
    const p = parseHash().path;
    if (p === '' || p === 'search') route(true);
  }

  /* ───────── لوح الإشعارات ───────── */
  async function openNotifs() {
    if (!S.uid) { if (await ensureLogin({ noName: true, title: t('سجّل دخولك عشان توصلك تحديثات طلباتك', 'Sign in to get your order updates') })) openNotifs(); return; }
    const s = SF.openSheet(`<div class="sheet-head"><h2>${t('الإشعارات', 'Notifications')}</h2><div class="row"><button class="link small" data-readall>${t('تحديد الكل كمقروء', 'Mark all as read')}</button><button class="icon-btn" data-close aria-label="${t('إغلاق', 'Close')}">${ic('x')}</button></div></div>
      <div class="nlist" id="nl">${Array.from({ length: 3 }, () => `<div class="nrow">${sk('40px', 40, '14px')}<div class="grow stack s">${sk('70%', 14)}${sk('90%', 12)}</div></div>`).join('')}</div>`, { noFocus: true });
    s.sh.classList.add('notif-sheet');
    let list = [];
    const paint = () => {
      const box = $('#nl', s.sh); if (!box) return;
      box.innerHTML = list.length ? list.map((n) => `<button class="nrow ${n.read_at ? '' : 'unread'}" data-nid="${n.id}">
          <span class="n-ic">${ic(n.kind === 'broadcast' ? 'sparkle' : n.kind === 'review' ? 'star' : 'receipt', 's')}</span>
          <span class="grow"><b>${esc(n.title)}</b>${n.body ? `<span class="n-body">${esc(n.body)}</span>` : ''}<small>${esc(SF.ago(n.created_at))}</small></span>
          ${n.read_at ? '' : '<span class="n-dot" aria-hidden="true"></span>'}</button>`).join('')
        : emptyBox('bell', t('ما فيه إشعارات', 'No notifications'), t('تحديثات طلباتك والعروض بتوصلك هنا', 'Order updates and offers will show up here'));
    };
    try {
      const { data } = await SF.sb.from('sf_notifications').select('id,title,body,link,kind,order_id,read_at,created_at').eq('user_id', S.uid).order('id', { ascending: false }).limit(60);
      list = data || [];
    } catch { /* */ }
    paint();
    s.sh.addEventListener('click', async (e) => {
      if (e.target.closest('[data-readall]')) {
        try { await SF.rpc('sf_notif_read', { p_ids: null }); } catch { /* */ }
        list.forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); }); paint(); S.unread = 0; renderTop();
        return;
      }
      const it = e.target.closest('[data-nid]');
      if (!it) return;
      const n = list.find((x) => String(x.id) === it.dataset.nid);
      if (!n) return;
      if (!n.read_at) { SF.rpc('sf_notif_read', { p_ids: [n.id] }).then(refreshUnread).catch(() => {}); }
      s.close();
      followLink(n);
    });
  }
  function followLink(n) {
    const l = String(n.link || '');
    let m = l.match(/[?&]order=([0-9a-f-]{36})/i);
    if (m) { if (/[?&]rate=1/.test(l)) S.rateReturn = m[1]; go('#/order/' + m[1]); return; }
    if (n.order_id) { go('#/order/' + n.order_id); return; }
    m = l.match(/[?&]f=([\w-]+)/);
    if (m) { go(famLink(m[1])); return; }
    if (l.startsWith('#/')) { go(l); return; }
    if (/^https:\/\//i.test(l)) window.open(l, '_blank', 'noopener');
  }

  /* ───────── تسجيل الدخول (جوال ← رمز ← اسم) ───────── */
  let loginP = null;
  function ensureLogin(opts = {}) {
    if (S.uid && ((S.me.profile && S.me.profile.name) || opts.noName)) return Promise.resolve(true);
    if (loginP) return loginP;
    loginP = new Promise((resolve) => {
      let done = false, phone = '', timer = null, ac = null, verifying = false;
      const s = SF.openSheet(`<div class="login" id="lg"></div>`, { noFocus: true, onClose: () => { clearInterval(timer); if (ac) ac.abort(); loginP = null; if (!done) resolve(false); } });
      s.sh.classList.add('login-sheet');
      const box = $('#lg', s.sh);
      const finish = () => { done = true; resolve(true); s.close(); };
      const focusLater = (el) => setTimeout(() => { if (el && el.isConnected) el.focus(); }, 320);
      const stepPhone = () => {
        clearInterval(timer);
        box.innerHTML = `
          <div class="lg-art"><img src="img/mark.svg" alt="" width="56" height="56"></div>
          <h2>${esc(opts.title || t('سجّل دخولك برقم جوالك', 'Sign in with your phone'))}</h2>
          <p class="muted">${esc(opts.sub || t('بنرسل لك رمز تحقق برسالة نصية', 'We will text you a verification code'))}</p>
          <label class="field"><span>${t('رقم الجوال', 'Mobile number')}</span>
            <div class="input-group" dir="ltr"><span class="addon">+966</span><input class="input" id="lgPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="05XXXXXXXX" maxlength="14" value="${esc(phone)}" aria-label="${t('رقم الجوال', 'Mobile number')}"></div></label>
          <button class="btn btn-primary btn-lg btn-block" id="lgSend">${t('أرسل الرمز', 'Send code')}</button>`;
        const inp = $('#lgPhone', box);
        const send = () => SF.busy($('#lgSend', box), async () => {
          try { await SF.auth.sendCode(inp.value); phone = inp.value; stepOtp(); } catch (e) { SF.toast(errText(e), 'bad'); inp.focus(); }
        });
        $('#lgSend', box).onclick = send;
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
        focusLater(inp);
      };
      const stepOtp = () => {
        box.innerHTML = `
          <button class="link back-link" id="lgChange">${backIc('s')} ${t('تغيير الرقم', 'Change number')}</button>
          <h2>${t('اكتب رمز التحقق', 'Enter the code')}</h2>
          <p class="muted">${t('أرسلنا الرمز إلى', 'We sent it to')} <b dir="ltr">${esc(SF.showPhone(phone))}</b></p>
          <div class="otp" id="lgOtp">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" pattern="[0-9]*" ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off" maxlength="1"'} aria-label="${t('الرقم', 'Digit')} ${i + 1}">`).join('')}</div>
          <button class="btn btn-primary btn-lg btn-block" id="lgVerify">${t('تأكيد', 'Verify')}</button>
          <div class="center"><button class="link small" id="lgResend" disabled></button></div>`;
        const ins = $$('#lgOtp input', box);
        const digits = (v) => String(v || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/\D/g, '');
        const code = () => ins.map((x) => x.value).join('');
        const fill = (d) => { d = d.slice(0, 6); ins.forEach((x, k) => { x.value = d[k] || ''; }); ins[Math.min(d.length, 5)].focus(); if (d.length === 6) verify(); };
        ins.forEach((inp, i) => {
          inp.addEventListener('input', () => {
            const d = digits(inp.value);
            if (d.length > 1) { fill(d); return; }
            inp.value = d;
            if (d && i < 5) ins[i + 1].focus();
            if (code().length === 6) verify();
          });
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !inp.value && i > 0) { ins[i - 1].focus(); ins[i - 1].value = ''; e.preventDefault(); }
            if (e.key === 'Enter') verify();
          });
          inp.addEventListener('paste', (e) => { const d = digits((e.clipboardData || window.clipboardData).getData('text')); if (d) { e.preventDefault(); fill(d); } });
        });
        $('#lgChange', box).onclick = () => { if (ac) ac.abort(); stepPhone(); };
        $('#lgVerify', box).onclick = () => verify();
        const rs = $('#lgResend', box);
        let left = 60;
        const tick = () => {
          if (!rs.isConnected) { clearInterval(timer); return; }
          if (left > 0) { rs.disabled = true; rs.textContent = t(`تقدر تعيد الإرسال بعد ${left} ثانية`, `Resend in ${left}s`); left--; }
          else { rs.disabled = false; rs.textContent = t('أرسل الرمز مرة ثانية', 'Resend the code'); clearInterval(timer); }
        };
        clearInterval(timer); tick(); timer = setInterval(tick, 1000);
        rs.onclick = () => SF.busy(rs, async () => { try { await SF.auth.sendCode(phone); SF.toast(t('أرسلنا رمز جديد', 'A new code was sent'), 'ok'); left = 60; clearInterval(timer); tick(); timer = setInterval(tick, 1000); } catch (e) { SF.toast(errText(e), 'bad'); } });
        if ('OTPCredential' in window) {
          ac = new AbortController();
          navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal }).then((o) => { if (o && o.code) fill(digits(o.code)); }).catch(() => {});
        }
        focusLater(ins[0]);
        async function verify() {
          if (verifying) return;
          const c = code();
          if (c.length < 6) { SF.toast(t('اكتب الرمز كامل', 'Enter the full code'), 'bad'); return; }
          verifying = true;
          await SF.busy($('#lgVerify', box), async () => {
            try {
              await SF.auth.verify(phone, c);
              if (ac) ac.abort();
              await afterAuth(true);
              if (!(S.me.profile && S.me.profile.name) && !opts.noName) stepName();
              else { syncLang(); finish(); SF.toast(t('حيّاك الله', 'Welcome'), 'ok'); }
            } catch (e) {
              SF.toast(errText(e), 'bad');
              ins.forEach((x) => { x.value = ''; });
              const o = $('#lgOtp', box); if (o) { o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); }
              ins[0].focus();
            }
          });
          verifying = false;
        }
      };
      const stepName = () => {
        clearInterval(timer);
        box.innerHTML = `
          <div class="lg-art">${ic('user', 'l')}</div>
          <h2>${t('حيّاك! وش نسميك؟', 'Welcome! What should we call you?')}</h2>
          <p class="muted">${t('الاسم يظهر للأسرة مع طلبك', 'Your name is shown to the kitchen with your order')}</p>
          <label class="field"><span>${t('الاسم', 'Name')}</span><input class="input" id="lgName" autocomplete="name" maxlength="60"></label>
          <label class="check-row"><input type="checkbox" id="lgMk" checked><span>${t('أبي توصلني العروض', 'Send me offers')}</span></label>
          <button class="btn btn-primary btn-lg btn-block" id="lgSave">${t('يلا نبدأ', 'Continue')}</button>`;
        const inp = $('#lgName', box);
        const save = () => SF.busy($('#lgSave', box), async () => {
          const name = inp.value.trim();
          if (name.length < 2) { SF.toast(t('اكتب اسمك', 'Enter your name'), 'bad'); inp.focus(); return; }
          try {
            S.me = await SF.rpc('sf_profile_save', { p: { name, marketing_ok: $('#lgMk', box).checked, lang: SF.lang } });
            S.uid = S.me.uid || S.uid;
            await SF.me(true);
            finish();
            SF.toast(t(`حيّاك الله يا ${name.split(/\s+/)[0]}`, `Welcome, ${name.split(/\s+/)[0]}`), 'ok');
            if (S.chrome.tab === 'home') route(true);
          } catch (e) { SF.toast(errText(e), 'bad'); }
        });
        $('#lgSave', box).onclick = save;
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
        focusLater(inp);
      };
      if (S.uid) stepName(); else stepPhone();
    });
    return loginP;
  }
  function syncLang() {
    if (S.uid && S.me.profile && S.me.profile.lang !== SF.lang) SF.rpc('sf_profile_save', { p: { lang: SF.lang } }).then((m) => { if (m && m.uid) S.me = m; }).catch(() => {});
  }

  /* ───────── بعد الدخول والخروج ───────── */
  async function afterAuth(force) {
    const prev = S.uid;
    try { await refreshMe(true); } catch { /* */ }
    if (!force && prev === S.uid) return;
    setupUserChannel();
    if (S.uid) { await Promise.all([loadFavs(), refreshLive(), refreshUnread()]); }
    else { S.favs = new Set(); S.live = 0; S.unread = 0; S.addrs = []; }
    renderTop(); renderNav();
  }
  function setupUserChannel() {
    if (S.notifCh) { try { SF.sb.removeChannel(S.notifCh); } catch { /* */ } S.notifCh = null; }
    if (!S.uid) return;
    S.notifCh = SF.live('sf_notifications', 'user_id=eq.' + S.uid, (p) => {
      if (p.eventType === 'INSERT' && p.new) {
        S.unread++; renderTop();
        const fresh = S.justPlaced && p.new.order_id === S.justPlaced.id && Date.now() - S.justPlaced.at < 20000;
        const mine = (S.onNotif ? S.onNotif(p.new) : false) || fresh;
        if (!mine) SF.toast(p.new.title || t('إشعار جديد', 'New notification'), '');
        refreshLive();
      } else if (p.eventType === 'UPDATE') refreshUnread();
    });
  }

  /* ───────── روابط الدخول المباشر (?order= و ?f=) ───────── */
  function takeDeepLinks() {
    let u;
    try { u = new URL(location.href); } catch { return; }
    const p = u.searchParams;
    let target = null;
    const oid = p.get('order'), fs = p.get('f');
    if (oid && UUID.test(oid)) { target = '#/order/' + oid; if (p.get('paid')) S.payReturn = oid; if (p.get('rate')) S.rateReturn = oid; }
    else if (fs && /^[\w-]{2,60}$/.test(fs)) target = famLink(fs);
    if (!target && !['order', 'f', 'paid', 'rate'].some((k) => p.has(k))) return;
    ['order', 'f', 'paid', 'rate'].forEach((k) => p.delete(k));
    const qs = p.toString();
    history.replaceState(null, '', u.pathname + (qs ? '?' + qs : '') + (target || location.hash || '#/'));
  }

  /* ───────── التشغيل ───────── */
  async function boot() {
    takeDeepLinks();
    SF.registerSW('sw.js');
    if (!S.cities.length) await loadCities(); else loadCities();
    if (!S.cats.length) loadCats().then(() => { if (S.chrome.tab === 'home' && S.booted) renderHome(); }); else loadCats();
    try { await Promise.all([SF.loadSettings(), refreshMe()]); } catch { /* نكمل بالمحفوظ */ }
    renderTop(); renderNav();
    await route();
    S.booted = true;
    if (S.uid) { setupUserChannel(); loadFavs().then(() => { if (S.F) renderTop(); }); refreshLive(); refreshUnread(); }
    SF.auth.onChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => afterAuth(), 0); });
    SF.onLang(() => { syncLang(); renderTop(); renderNav(); renderCartBar(); route(true); });
    mqDesk.addEventListener('change', () => { renderCartBar(); if (S.F) renderSideCart(); if (S.co) renderCoBtn(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.uid) { refreshLive(); refreshUnread(); } });
  }
  window.SFApp = { S, go, route, afterAuth, ensureLogin, openDish, openAddress };
  boot();
})();
