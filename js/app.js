/* ===================================================
   سُفرة — صفحة العملاء
   =================================================== */
(function () {
  'use strict';

  // الحالة
  let activeCategory = 'all';
  let activeCuisine = 'all';
  let searchTerm = '';
  let deliveryMethod = 'pickup';
  let cart = SUFRAH.getCart();
  const CITIES = ['كل المدن', 'الرياض', 'جدة', 'مكة', 'المدينة المنورة', 'الدمام', 'الخبر', 'القصيم', 'الطائف', 'الأحساء', 'أبها', 'تبوك', 'حائل', 'جازان'];
  let loc = (function () { try { return JSON.parse(localStorage.getItem('sufrah_location')) || { city: 'كل المدن', district: '' }; } catch { return { city: 'كل المدن', district: '' }; } })();

  const $ = (s) => document.querySelector(s);
  const categoryChips = $('#categoryChips');
  const cuisineChips = $('#cuisineChips');
  const familiesGrid = $('#familiesGrid');
  const dishesGrid = $('#dishesGrid');
  const dishesCount = $('#dishesCount');
  const emptyState = $('#emptyState');
  const homeView = $('#homeView');
  const kitchenView = $('#kitchenView');
  const drawer = $('#drawer');
  const overlay = $('#overlay');
  const drawerBody = $('#drawerBody');
  const cartCount = $('#cartCount');
  const toastEl = $('#toast');
  const acctOverlay = $('#acctOverlay');
  const acctModal = $('#acctModal');
  const acctBody = $('#acctBody');
  const locOverlay = $('#locOverlay');
  const locModal = $('#locModal');

  const priceLabel = (n) => `${n} ر.س`;
  const dishById = (id) => SUFRAH.allDishes().find((d) => d.id === id);

  /* ---------- شرائح التصنيف والمطبخ ---------- */
  function renderCategories() {
    categoryChips.innerHTML = CATEGORIES.map((c) => `
      <button class="chip ${c.id === activeCategory ? 'is-active' : ''}" data-cat="${c.id}">
        <span class="chip__emoji">${c.emoji}</span>${c.name}
      </button>`).join('');
  }
  function renderCuisines() {
    cuisineChips.innerHTML = CUISINES.map((c) => `
      <button class="chip chip--soft ${c.id === activeCuisine ? 'is-active' : ''}" data-cuisine="${c.id}">
        ${c.emoji ? `<span class="chip__emoji">${c.emoji}</span>` : ''}${c.name}
      </button>`).join('');
  }

  /* ---------- الأسر ---------- */
  function renderFamilies() {
    let families = SUFRAH.allFamilies();
    if (loc.city !== 'كل المدن') families = families.filter((f) => f.city === loc.city);
    familiesGrid.innerHTML = families.map((f) => `
      <article class="family" data-family="${f.id}">
        <div class="family__cover" style="background:${f.grad}">
          <span class="family__badge">⭐ ${(f.rating || 5).toFixed(1)}</span>
          ${f.isNew ? '<span class="family__new">جديدة ✨</span>' : ''}
          ${f.cover || '🍽️'}
        </div>
        <div class="family__body">
          <h3 class="family__name">${f.name}</h3>
          <p class="family__spec">${(CUISINE_BY_ID[f.cuisine] || {}).emoji || ''} ${f.spec || ''}${f.city ? ' · ' + f.city : ''}</p>
          <div class="family__meta">
            <span><span class="star">★</span> ${(f.rating || 5).toFixed(1)}</span>
            <span>🛵 ${f.time || '٤٥ د'}</span>
            <span>🏠 موثّقة</span>
          </div>
        </div>
      </article>`).join('');
  }

  /* ---------- تصفية الأطباق ---------- */
  function getFilteredDishes() {
    const term = searchTerm.trim();
    return SUFRAH.allDishes().filter((d) => {
      if (activeCategory !== 'all' && d.cat !== activeCategory) return false;
      if (activeCuisine !== 'all' && d.cuisine !== activeCuisine) return false;
      if (loc.city !== 'كل المدن') { const fam = SUFRAH.familyById(d.familyId); if (!fam || fam.city !== loc.city) return false; }
      if (term) {
        const fam = SUFRAH.familyById(d.familyId);
        const hay = `${d.name} ${d.desc || ''} ${fam ? fam.name : ''}`;
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  function deliveryBadges(d) {
    const list = d.delivery && d.delivery.length ? d.delivery : ALL_DELIVERY;
    return list.map((k) => `<span class="dbadge" title="${DELIVERY_TYPES[k].name}">${DELIVERY_TYPES[k].emoji}</span>`).join('');
  }
  function dishThumb(d) {
    if (d.img) return `<div class="dish__thumb dish__thumb--img" style="background-image:url('${d.img}')">`;
    return `<div class="dish__thumb" style="background:${d.grad || DEFAULT_GRAD}">${''}`;
  }

  function dishCard(d) {
    const fam = SUFRAH.familyById(d.familyId);
    const thumbInner = d.img ? '' : (d.emoji || '🍽️');
    return `
      <article class="dish">
        ${dishThumb(d)}
          ${d.tag ? `<span class="dish__tag">${d.tag}</span>` : ''}
          <button class="dish__fav" aria-label="مفضلة">🤍</button>
          ${thumbInner}
        </div>
        <div class="dish__body">
          <h3 class="dish__name">${d.name}</h3>
          <p class="dish__family">👩‍🍳 ${fam ? fam.name : 'أسرة منتجة'} ${(CUISINE_BY_ID[d.cuisine] || {}).emoji || ''}</p>
          <p class="dish__desc">${d.desc || ''}</p>
          <div class="dish__delivery">${deliveryBadges(d)}</div>
          <div class="dish__foot">
            <span class="dish__price">${d.price} <small>ر.س</small></span>
            <button class="dish__add" data-add="${d.id}" aria-label="أضف للسلة">+</button>
          </div>
        </div>
      </article>`;
  }

  function renderDishes() {
    const list = getFilteredDishes();
    dishesCount.textContent = `${list.length} طبق متاح`;
    if (list.length === 0) {
      dishesGrid.innerHTML = '';
      emptyState.querySelector('p').textContent = (loc.city !== 'كل المدن')
        ? `ما فيه مطابخ في ${loc.city} بعد — جرّب «كل المدن»`
        : 'ما لقينا نتيجة… جرّب كلمة ثانية';
      emptyState.hidden = false; return;
    }
    emptyState.hidden = true;
    dishesGrid.innerHTML = list.map(dishCard).join('');
  }

  /* ---------- صفحة المطبخ ---------- */
  let openKitchenId = null;
  function renderKitchen(id) {
    const fam = SUFRAH.familyById(id); if (!fam) return false;
    const dishes = SUFRAH.allDishes().filter((d) => d.familyId === id);
    const cz = (CUISINE_BY_ID[fam.cuisine] || {});
    kitchenView.innerHTML = `
      <div class="container">
        <button class="kview__back" id="kviewBack">↩ رجوع للرئيسية</button>
        <div class="kview__banner" style="background:${fam.grad || DEFAULT_GRAD}">
          <div class="kview__avatar">${fam.cover || '🍽️'}</div>
          <div class="kview__info">
            <h2 class="kview__name">${fam.name}</h2>
            <p class="kview__spec">${cz.name || ''}${fam.city ? ' · ' + fam.city : ''}</p>
            <div class="kview__meta">
              <span><span class="star">★</span> ${(fam.rating || 5).toFixed(1)}</span>
              <span>🛵 ${fam.time || '٤٥ د'}</span>
              <span>🏠 أسرة موثّقة</span>
            </div>
          </div>
        </div>
        <h3 class="kview__dtitle">أطباق المطبخ (${dishes.length})</h3>
        ${dishes.length
          ? `<div class="dishes">${dishes.map(dishCard).join('')}</div>`
          : `<div class="empty"><span>🍳</span><p>هذا المطبخ ما أضاف أطباق بعد</p></div>`}
      </div>`;
    return true;
  }
  function openKitchen(id) {
    if (!renderKitchen(id)) return;
    openKitchenId = id;
    homeView.hidden = true;
    kitchenView.hidden = false;
    window.scrollTo(0, 0);
  }
  function closeKitchen() {
    openKitchenId = null;
    kitchenView.hidden = true;
    homeView.hidden = false;
  }

  /* ---------- السلة ---------- */
  const cartQtyTotal = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartSubtotal = () => Object.entries(cart).reduce((s, [id, q]) => {
    const d = dishById(id); return s + (d ? d.price * q : 0);
  }, 0);

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    SUFRAH.saveCart(cart); updateCartUI();
    const d = dishById(id);
    showToast(`✅ أُضيف «${d.name}» للسلة`);
  }
  function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    SUFRAH.saveCart(cart); updateCartUI();
  }
  function removeItem(id) { delete cart[id]; SUFRAH.saveCart(cart); updateCartUI(); }

  function renderDeliveryOptions() {
    return `
      <div class="delivery-pick">
        <div class="delivery-pick__title">طريقة الاستلام</div>
        ${ALL_DELIVERY.map((k) => {
          const t = DELIVERY_TYPES[k];
          return `
          <label class="dopt ${k === deliveryMethod ? 'is-active' : ''}">
            <input type="radio" name="delivery" value="${k}" ${k === deliveryMethod ? 'checked' : ''} />
            <span class="dopt__emoji">${t.emoji}</span>
            <span class="dopt__info"><strong>${t.name}</strong><small>${t.note}</small></span>
            <span class="dopt__fee">${t.fee ? priceLabel(t.fee) : 'مجاناً'}</span>
          </label>`;
        }).join('')}
      </div>`;
  }

  function updateCartUI() {
    const count = cartQtyTotal();
    cartCount.textContent = count;
    cartCount.style.display = count ? 'grid' : 'none';

    const ids = Object.keys(cart);
    if (ids.length === 0) {
      drawerBody.innerHTML = `
        <div class="cart-empty">
          <span>🛒</span>
          <p>سلتك فاضية… أضِف أطباق شهية من الأسر المنتجة!</p>
        </div>`;
    } else {
      const items = ids.map((id) => {
        const d = dishById(id); if (!d) return '';
        const fam = SUFRAH.familyById(d.familyId);
        const qty = cart[id];
        const thumb = d.img
          ? `<div class="cart-item__thumb cart-item__thumb--img" style="background-image:url('${d.img}')"></div>`
          : `<div class="cart-item__thumb" style="background:${d.grad || DEFAULT_GRAD}">${d.emoji || '🍽️'}</div>`;
        return `
        <div class="cart-item">
          ${thumb}
          <div class="cart-item__info">
            <div class="cart-item__name">${d.name}</div>
            <div class="cart-item__family">👩‍🍳 ${fam ? fam.name : ''}</div>
            <div class="cart-item__price">${priceLabel(d.price * qty)}</div>
            <div class="qty" style="margin-top:8px;width:max-content">
              <button data-dec="${id}">−</button><span>${qty}</span><button data-inc="${id}">+</button>
            </div>
          </div>
          <button class="cart-item__remove" data-remove="${id}" aria-label="حذف">🗑️</button>
        </div>`;
      }).join('');
      drawerBody.innerHTML = items + renderDeliveryOptions();
    }

    const subtotal = cartSubtotal();
    const fee = subtotal > 0 ? DELIVERY_TYPES[deliveryMethod].fee : 0;
    $('#subtotal').textContent = priceLabel(subtotal);
    $('#delivery').textContent = fee ? priceLabel(fee) : 'مجاناً';
    $('#total').textContent = priceLabel(subtotal + fee);
  }

  /* ---------- فتح/إغلاق ---------- */
  function openDrawer() { drawer.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; prefillCheckout(); }
  function closeDrawer() { drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }

  /* ---------- تنبيه ---------- */
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2200);
  }

  function syncSearchInputs(val, except) {
    const h = $('#searchInput'), hero = $('#heroSearch');
    if (except !== 'header' && h) h.value = val;
    if (except !== 'hero' && hero) hero.value = val;
  }

  /* ---------- حساب العميل ---------- */
  const escH = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  async function refreshAcctBtn() {
    const u = await SUFRAH.currentUser();
    $('#accountBtn').classList.toggle('is-in', !!u);
  }
  function openAcct() { acctModal.classList.add('is-open'); acctOverlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; renderAcct(); }
  function closeAcct() { acctModal.classList.remove('is-open'); acctOverlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  function orderCardRO(o) {
    const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
    const items = (o.items || []).map((it) => `${it.qty}× ${escH(it.name)}`).join('، ');
    return `<div class="order order--${o.status}">
      <div class="order__top"><span class="ostatus ostatus--${o.status}">${st.emoji} ${st.label}</span><span class="order__total">${o.total} ر.س</span></div>
      <div class="order__items">${items}</div></div>`;
  }
  async function renderAcct() {
    const user = await SUFRAH.currentUser();
    if (!user) {
      acctBody.innerHTML = `
        <div class="tabs">
          <button class="tab is-active" data-atab="login">دخول</button>
          <button class="tab" data-atab="register">حساب جديد</button>
        </div>
        <form id="custLogin">
          <div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" required placeholder="name@example.com" /></div>
          <div class="field"><label>كلمة المرور</label><input type="password" name="password" required placeholder="••••••••" /></div>
          <p class="form__error" id="clErr" hidden></p>
          <button class="btn btn--primary btn--block" type="submit">دخول</button>
        </form>
        <form id="custReg" hidden>
          <div class="field"><label>الاسم</label><input type="text" name="name" required placeholder="اسمك" /></div>
          <div class="field"><label>رقم الجوال</label><input type="tel" name="phone" placeholder="05xxxxxxxx" /></div>
          <div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" required placeholder="name@example.com" /></div>
          <div class="field"><label>كلمة المرور</label><input type="password" name="password" required placeholder="••••••••" /></div>
          <p class="form__error" id="crErr" hidden></p>
          <button class="btn btn--primary btn--block" type="submit">إنشاء الحساب</button>
        </form>`;
      acctBody.querySelectorAll('[data-atab]').forEach((t) => t.addEventListener('click', () => {
        acctBody.querySelectorAll('.tab').forEach((x) => x.classList.remove('is-active')); t.classList.add('is-active');
        const isLogin = t.dataset.atab === 'login';
        $('#custLogin').hidden = !isLogin; $('#custReg').hidden = isLogin;
      }));
      $('#custLogin').addEventListener('submit', async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const err = $('#clErr');
        const res = await SUFRAH.loginCustomer(fd.get('email'), fd.get('password'));
        if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
        showToast('أهلاً فيك 👋'); refreshAcctBtn(); renderAcct();
      });
      $('#custReg').addEventListener('submit', async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const err = $('#crErr');
        const res = await SUFRAH.registerCustomer({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), password: fd.get('password') });
        if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
        showToast('🎉 تم إنشاء حسابك'); refreshAcctBtn(); renderAcct();
      });
    } else {
      const p = await SUFRAH.getProfile();
      const orders = await SUFRAH.getMyOrders();
      acctBody.innerHTML = `
        <div class="acct-hello">أهلاً ${escH(p.full_name || 'بك')} 👋</div>
        <div class="acct-email">${escH(p.email)}</div>
        <button class="ghost-btn" id="custLogout" style="width:100%;margin:12px 0 20px">تسجيل الخروج</button>
        <h4 class="acct-oh">طلباتي (${orders.length})</h4>
        <div class="orders-list">${orders.length ? orders.map(orderCardRO).join('') : '<div class="aempty">ما عندك طلبات بعد</div>'}</div>`;
      $('#custLogout').addEventListener('click', async () => { await SUFRAH.logout(); showToast('تم تسجيل الخروج'); refreshAcctBtn(); renderAcct(); });
    }
  }
  async function prefillCheckout() {
    const p = await SUFRAH.getProfile();
    if (p && !$('#coName').value) $('#coName').value = p.full_name || '';
    if (p && !$('#coPhone').value) $('#coPhone').value = p.phone || '';
    if (!$('#coAddress').value) {
      const locAddr = loc.city !== 'كل المدن' ? (loc.district ? loc.district + '، ' + loc.city : loc.city) : '';
      $('#coAddress').value = (p && p.address) || locAddr;
    }
  }

  /* ---------- الموقع ---------- */
  const DISTRICTS = {
    'الرياض': ['النرجس', 'الياسمين', 'العليا', 'الملقا', 'الربيع', 'النخيل', 'غرناطة', 'قرطبة', 'الحمراء', 'الروضة', 'المروج', 'النزهة', 'الملز', 'حطين', 'الصحافة', 'السويدي', 'العزيزية'],
    'جدة': ['الروضة', 'الحمراء', 'السلامة', 'النعيم', 'الشاطئ', 'الصفا', 'المرجان', 'أبحر الشمالية', 'النزهة', 'البوادي', 'الفيصلية', 'الربوة'],
    'مكة': ['العزيزية', 'الشوقية', 'النسيم', 'الزاهر', 'الرصيفة', 'العوالي', 'الكعكية', 'الشرائع'],
    'المدينة المنورة': ['قباء', 'العوالي', 'الحرة الشرقية', 'العزيزية', 'الدفاع', 'الخالدية', 'شوران'],
    'الدمام': ['الشاطئ', 'الفيصلية', 'النور', 'الجلوية', 'الأمانة', 'البادية', 'الروضة', 'الأنوار'],
    'الخبر': ['العقربية', 'الراكة', 'الثقبة', 'الحزام الذهبي', 'اليرموك', 'الخزامى', 'الجسر'],
    'القصيم': ['الصفراء', 'الروضة', 'النهضة', 'الريان', 'الملك فهد', 'الإسكان'],
    'الطائف': ['شهار', 'الحوية', 'الشفا', 'قروى', 'الفيصلية', 'معشي'],
    'الأحساء': ['المبرز', 'الهفوف', 'الطرف', 'العيون', 'المزروعية'],
    'أبها': ['المنسك', 'الموظفين', 'النميص', 'الخالدية', 'المفتاحة'],
    'تبوك': ['العزيزية', 'المروج', 'الورود', 'الفيصلية', 'السلطانة'],
    'حائل': ['النقرة', 'المطار', 'الخزامى', 'الوسيطاء', 'برزان'],
    'جازان': ['الروضة', 'الصفا', 'المطار', 'الشاطئ', 'المحمدية'],
  };
  function saveLoc() { localStorage.setItem('sufrah_location', JSON.stringify(loc)); }
  function updateLocHeader() { $('#locationText').textContent = loc.city + (loc.district ? ' — ' + loc.district : ''); }
  function fillLocCities() { $('#locCity').innerHTML = CITIES.map((c) => `<option value="${c}">${c}</option>`).join(''); }
  function fillDistricts(city) {
    const list = DISTRICTS[city] || [];
    $('#locDistrict').innerHTML = '<option value="">كل الأحياء</option>' + list.map((d) => `<option value="${d}">${d}</option>`).join('');
  }
  function openLoc() {
    $('#locCity').value = loc.city;
    fillDistricts(loc.city);
    $('#locDistrict').value = loc.district || '';
    locModal.classList.add('is-open'); locOverlay.classList.add('is-open'); document.body.style.overflow = 'hidden';
  }
  function closeLoc() { locModal.classList.remove('is-open'); locOverlay.classList.remove('is-open'); document.body.style.overflow = ''; }

  /* ---------- الأحداث ---------- */
  function bindEvents() {
    categoryChips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]'); if (!btn) return;
      activeCategory = btn.dataset.cat; renderCategories(); renderDishes();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    cuisineChips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cuisine]'); if (!btn) return;
      activeCuisine = btn.dataset.cuisine; renderCuisines(); renderDishes();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const onDishClick = (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { addToCart(add.dataset.add); return; }
      const fav = e.target.closest('.dish__fav');
      if (fav) fav.textContent = fav.textContent.trim() === '🤍' ? '❤️' : '🤍';
    };
    dishesGrid.addEventListener('click', onDishClick);

    // الضغط على مطبخ يفتح صفحته الخاصة
    familiesGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-family]'); if (!card) return;
      openKitchen(card.dataset.family);
    });
    kitchenView.addEventListener('click', (e) => {
      if (e.target.closest('#kviewBack')) { closeKitchen(); return; }
      onDishClick(e);
    });

    drawerBody.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]'); const dec = e.target.closest('[data-dec]'); const rem = e.target.closest('[data-remove]');
      if (inc) changeQty(inc.dataset.inc, +1);
      else if (dec) changeQty(dec.dataset.dec, -1);
      else if (rem) removeItem(rem.dataset.remove);
    });
    drawerBody.addEventListener('change', (e) => {
      if (e.target.name === 'delivery') { deliveryMethod = e.target.value; updateCartUI(); }
    });

    $('#cartBtn').addEventListener('click', openDrawer);
    $('#drawerClose').addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    $('#accountBtn').addEventListener('click', openAcct);
    $('#acctClose').addEventListener('click', closeAcct);
    acctOverlay.addEventListener('click', closeAcct);
    $('#locationBtn').addEventListener('click', openLoc);
    $('#locClose').addEventListener('click', closeLoc);
    locOverlay.addEventListener('click', closeLoc);
    $('#locCity').addEventListener('change', (e) => fillDistricts(e.target.value));
    $('#locSave').addEventListener('click', () => {
      loc = { city: $('#locCity').value, district: ($('#locDistrict').value || '').trim() };
      saveLoc(); updateLocHeader(); renderFamilies(); renderDishes(); closeLoc();
      showToast('📍 تم تحديث موقعك');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeAcct(); closeLoc(); } });

    const onSearch = (val) => { closeKitchen(); searchTerm = val; renderDishes(); };
    $('#searchInput').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'header'); onSearch(e.target.value); });
    $('#heroSearch').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'hero'); onSearch(e.target.value); });
    $('#heroSearchBtn').addEventListener('click', () => document.getElementById('menu').scrollIntoView({ behavior: 'smooth' }));

    $('#checkoutBtn').addEventListener('click', async () => {
      if (cartQtyTotal() === 0) { showToast('سلتك فاضية 🛒'); return; }
      const name = ($('#coName').value || '').trim();
      const phone = ($('#coPhone').value || '').trim();
      const address = ($('#coAddress').value || '').trim();
      if (!name || !phone) { showToast('اكتب الاسم ورقم الجوال 📞'); return; }

      // نجمّع الطلب حسب كل مطبخ (طلب مستقل لكل أسرة)
      const groups = {};
      Object.entries(cart).forEach(([id, qty]) => {
        const d = dishById(id); if (!d) return;
        (groups[d.familyId] = groups[d.familyId] || []).push({ dish_id: id, name: d.name, price: d.price, qty });
      });
      const fee = DELIVERY_TYPES[deliveryMethod].fee;
      const btn = $('#checkoutBtn'); btn.disabled = true; btn.textContent = '⏳ جاري إرسال الطلب…';
      let okCount = 0;
      for (const [kid, items] of Object.entries(groups)) {
        const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
        const res = await SUFRAH.createOrder({
          kitchen_id: kid, customer_name: name, customer_phone: phone, address,
          delivery_method: deliveryMethod, items, subtotal, delivery_fee: fee, total: subtotal + fee,
        });
        if (res.ok) okCount++;
      }
      btn.disabled = false; btn.textContent = 'إتمام الطلب';
      if (okCount > 0) {
        SUFRAH.saveProfile({ name, phone, address });
        cart = {}; SUFRAH.saveCart(cart); updateCartUI(); closeDrawer();
        showToast('🎉 تم إرسال طلبك للأسرة! بتجهّزه وتتواصل معك.');
      } else {
        showToast('تعذّر إرسال الطلب، حاول مرة ثانية');
      }
    });
  }

  /* ---------- الإقلاع ---------- */
  function renderAll() {
    renderFamilies();
    if (openKitchenId) renderKitchen(openKitchenId); else renderDishes();
  }
  async function init() {
    fillLocCities(); updateLocHeader();
    renderCategories(); renderCuisines(); renderFamilies(); renderDishes();
    updateCartUI(); bindEvents();
    SUFRAH.onChange(renderAll);
    try { await SUFRAH.init(); } catch (e) { console.warn('SUFRAH.init', e); }
    refreshAcctBtn();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
