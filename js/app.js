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

  const $ = (s) => document.querySelector(s);
  const categoryChips = $('#categoryChips');
  const cuisineChips = $('#cuisineChips');
  const familiesGrid = $('#familiesGrid');
  const dishesGrid = $('#dishesGrid');
  const dishesCount = $('#dishesCount');
  const emptyState = $('#emptyState');
  const drawer = $('#drawer');
  const overlay = $('#overlay');
  const drawerBody = $('#drawerBody');
  const cartCount = $('#cartCount');
  const toastEl = $('#toast');

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
    const families = SUFRAH.allFamilies();
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

  function renderDishes() {
    const list = getFilteredDishes();
    dishesCount.textContent = `${list.length} طبق متاح`;
    if (list.length === 0) { dishesGrid.innerHTML = ''; emptyState.hidden = false; return; }
    emptyState.hidden = true;

    dishesGrid.innerHTML = list.map((d) => {
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
    }).join('');
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
  function openDrawer() { drawer.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
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

    dishesGrid.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { addToCart(add.dataset.add); return; }
      const fav = e.target.closest('.dish__fav');
      if (fav) fav.textContent = fav.textContent.trim() === '🤍' ? '❤️' : '🤍';
    });

    familiesGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-family]'); if (!card) return;
      const fam = SUFRAH.familyById(card.dataset.family); if (!fam) return;
      activeCategory = 'all'; activeCuisine = 'all'; searchTerm = fam.name;
      syncSearchInputs(fam.name); renderCategories(); renderCuisines(); renderDishes();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
      showToast(`🍽️ أطباق «${fam.name}»`);
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    const onSearch = (val) => { searchTerm = val; renderDishes(); };
    $('#searchInput').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'header'); onSearch(e.target.value); });
    $('#heroSearch').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'hero'); onSearch(e.target.value); });
    $('#heroSearchBtn').addEventListener('click', () => document.getElementById('menu').scrollIntoView({ behavior: 'smooth' }));

    $('#checkoutBtn').addEventListener('click', () => {
      if (cartQtyTotal() === 0) { showToast('سلتك فاضية 🛒'); return; }
      const fee = DELIVERY_TYPES[deliveryMethod].fee;
      const total = priceLabel(cartSubtotal() + fee);
      const method = DELIVERY_TYPES[deliveryMethod].name;
      cart = {}; SUFRAH.saveCart(cart); updateCartUI(); closeDrawer();
      showToast(`🎉 تم استلام طلبك (${method}) — الإجمالي ${total}. بالعافية!`);
    });
  }

  /* ---------- الإقلاع ---------- */
  function init() {
    renderCategories(); renderCuisines(); renderFamilies(); renderDishes();
    updateCartUI(); bindEvents();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
