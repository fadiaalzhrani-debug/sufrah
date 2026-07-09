/* ===================================================
   سُفرة — صفحة العملاء
   =================================================== */
(function () {
  'use strict';

  // الحالة
  let activeCategory = 'all';
  let activeCuisine = 'all';
  let searchTerm = '';
  let sortBy = 'new';
  let coupon = null;
  let deliveryMethod = 'pickup';
  let deliveryDistance = 'near';
  let paymentMethod = 'cash';
  let orderTiming = 'asap';   // asap | schedule
  let schedDay = 0;           // إزاحة الأيام عن اليوم
  let schedSlot = null;       // معرّف الفترة الزمنية
  let myPoints = 0;           // رصيد نقاط العميل
  let redeemPoints = false;   // استخدام النقاط في هذا الطلب
  let cart = SUFRAH.getCart();
  const CITIES = ['كل المدن', 'الرياض', 'جدة', 'مكة', 'المدينة المنورة', 'الدمام', 'الخبر', 'القصيم', 'الطائف', 'الأحساء', 'أبها', 'تبوك', 'حائل', 'جازان'];
  let loc = (function () { try { return { city: (JSON.parse(localStorage.getItem('sufrah_location')) || {}).city || 'كل المدن' }; } catch { return { city: 'كل المدن' }; } })();

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
  const notifOverlay = $('#notifOverlay');
  const notifModal = $('#notifModal');
  const notifBody = $('#notifBody');
  let myUserId = null;
  let notifs = (function () { try { return JSON.parse(localStorage.getItem('sufrah_notifs')) || []; } catch { return []; } })();

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
      <article class="family ${f.isOpen === false ? 'family--closed' : ''}" data-family="${f.id}">
        <div class="family__cover" style="background:${f.grad}">
          <span class="family__badge">⭐ ${(f.rating || 5).toFixed(1)}</span>
          ${f.isNew ? '<span class="family__new">جديدة ✨</span>' : ''}
          ${f.isOpen === false ? '<span class="family__closed">🔴 مغلق</span>' : ''}
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
    const list = (d.delivery && d.delivery.length ? d.delivery : ALL_DELIVERY).filter((k) => DELIVERY_TYPES[k]);
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

  function sortDishes(list) {
    const arr = list.slice();
    if (sortBy === 'price_asc') arr.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') arr.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') arr.sort((a, b) => {
      const ra = (SUFRAH.familyById(a.familyId) || {}).rating || 0;
      const rb = (SUFRAH.familyById(b.familyId) || {}).rating || 0;
      return rb - ra;
    });
    return arr;
  }

  function renderDishes() {
    const list = sortDishes(getFilteredDishes());
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
    const rc = fam.reviewCount ? ` (${fam.reviewCount})` : '';
    kitchenView.innerHTML = `
      <div class="container">
        <button class="kview__back" id="kviewBack">↩ رجوع للرئيسية</button>
        <div class="kview__banner" style="background:${fam.grad || DEFAULT_GRAD}">
          <div class="kview__avatar">${fam.cover || '🍽️'}</div>
          <div class="kview__info">
            <h2 class="kview__name">${fam.name}</h2>
            <p class="kview__spec">${cz.name || ''}${fam.city ? ' · ' + fam.city : ''}</p>
            <div class="kview__meta">
              <span><span class="star">★</span> ${(fam.rating || 5).toFixed(1)}${rc}</span>
              <span>🛵 ${fam.time || '٤٥ د'}</span>
              <span>🏠 أسرة موثّقة</span>
            </div>
          </div>
        </div>
        ${fam.isOpen === false ? '<div class="closed-banner">🔴 هذا المطبخ مغلق حالياً — ما تقدر تطلب منه الآن</div>' : ''}
        <h3 class="kview__dtitle">أطباق المطبخ (${dishes.length})</h3>
        ${dishes.length
          ? `<div class="dishes">${dishes.map(dishCard).join('')}</div>`
          : `<div class="empty"><span>🍳</span><p>هذا المطبخ ما أضاف أطباق بعد</p></div>`}
        <div class="sub-box">
          <h3 class="kview__dtitle">📅 اشترك أسبوعياً</h3>
          <p class="sub-box__hint">اختر أيام الأسبوع اللي تبي «${fam.name}» يجهّز لك فيها — والأسرة تعرف طلبك الثابت وتخطّط له.</p>
          <div class="sub-days" id="subDays">${WEEKDAYS.map((d) => `<label class="dchip"><input type="checkbox" value="${d.id}" />${d.name}</label>`).join('')}</div>
          <input class="sub-note" id="subNote" type="text" placeholder="ملاحظة: نوع الوجبة المفضّلة (اختياري)" />
          <button class="btn btn--primary" id="subSubmit">اشترك الآن</button>
        </div>
        <div class="kview__reviews">
          <h3 class="kview__dtitle">⭐ التقييمات</h3>
          <div id="reviewsArea">جاري التحميل…</div>
        </div>
      </div>`;
    loadKitchenReviews(id);
    return true;
  }
  function fileToReviewImg(file, maxDim = 720, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
          else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
          const c = document.createElement('canvas');
          c.width = width; c.height = height;
          c.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = e.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  async function loadKitchenReviews(kid) {
    const [user, reviews] = await Promise.all([SUFRAH.currentUser(), SUFRAH.getKitchenReviews(kid)]);
    const area = $('#reviewsArea'); if (!area) return;
    const form = user ? `
      <div class="rate-box">
        <div class="rate-stars" id="rateStars">${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}">☆</span>`).join('')}</div>
        <textarea id="rateComment" rows="2" placeholder="اكتب رأيك (اختياري)…"></textarea>
        <label class="rate-photo" id="ratePhotoLabel">
          <input type="file" id="ratePhoto" accept="image/*" hidden />
          <span id="ratePhotoPh">📷 أضف صورة للطبق (اختياري)</span>
          <img id="ratePhotoPrev" alt="معاينة الصورة" hidden />
        </label>
        <button class="btn btn--primary" id="rateSubmit">أضف تقييمك</button>
      </div>` : `<div class="rate-login">سجّل دخولك (زر 👤 فوق) عشان تقيّم المطبخ</div>`;
    const list = reviews.length ? reviews.map((r) => `
      <div class="review">
        <div class="review__stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        ${r.comment ? `<div class="review__text">${escH(r.comment)}</div>` : ''}
        ${r.image_url && /^data:image\//.test(r.image_url) ? `<img class="review__img" src="${r.image_url}" alt="صورة الطبق" loading="lazy" />` : ''}
        <div class="review__time">${new Date(r.created_at).toLocaleDateString('ar')}</div>
      </div>`).join('') : '<div class="aempty">ما فيه تقييمات بعد — كن أول من يقيّم</div>';
    area.innerHTML = form + `<div class="reviews-list">${list}</div>`;
    if (user) {
      let picked = 0;
      let pickedImg = '';
      const starsEl = $('#rateStars');
      starsEl.addEventListener('click', (e) => {
        const s = e.target.closest('[data-star]'); if (!s) return;
        picked = +s.dataset.star;
        [...starsEl.children].forEach((c, i) => { c.textContent = i < picked ? '★' : '☆'; });
      });
      const photoInput = $('#ratePhoto');
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          pickedImg = await fileToReviewImg(file);
          const prev = $('#ratePhotoPrev'); const ph = $('#ratePhotoPh');
          prev.src = pickedImg; prev.hidden = false; if (ph) ph.hidden = true;
        } catch { showToast('تعذّر قراءة الصورة، جرّب صورة ثانية'); }
      });
      $('#rateSubmit').addEventListener('click', async () => {
        if (!picked) { showToast('اختر عدد النجوم ⭐'); return; }
        const res = await SUFRAH.addReview({ kitchen_id: kid, rating: picked, comment: ($('#rateComment').value || '').trim(), image: pickedImg || '' });
        if (!res.ok) { showToast('تعذّر إرسال التقييم'); return; }
        showToast('🌟 شكراً لتقييمك!');
        await SUFRAH.refresh();
        openKitchen(kid);
      });
    }
  }
  async function submitSubscription(kid) {
    const user = await SUFRAH.currentUser();
    if (!user) { showToast('سجّل دخولك أول (زر 👤 فوق) عشان تشترك'); return; }
    const days = [...document.querySelectorAll('#subDays input:checked')].map((c) => c.value);
    if (!days.length) { showToast('اختر يوم واحد على الأقل 📅'); return; }
    const p = await SUFRAH.getProfile();
    const btn = $('#subSubmit'); if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الاشتراك…'; }
    const res = await SUFRAH.createSubscription({ kitchen_id: kid, days, note: ($('#subNote').value || '').trim(), customer_name: p ? p.full_name : '', customer_phone: p ? p.phone : '' });
    if (btn) { btn.disabled = false; btn.textContent = 'اشترك الآن'; }
    if (!res.ok) { showToast('تعذّر الاشتراك، حاول لاحقاً'); return; }
    showToast('✅ تم اشتراكك الأسبوعي! تابعه من 👤 حسابي');
    document.querySelectorAll('#subDays input:checked').forEach((c) => { c.checked = false; const l = c.closest('.dchip'); if (l) l.classList.remove('is-active'); });
    if ($('#subNote')) $('#subNote').value = '';
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

  function pushCloud() { SUFRAH.saveCustomerData({ cart, city: loc.city, notifs }); }
  function saveCartAll() { SUFRAH.saveCart(cart); pushCloud(); }
  async function syncFromCloud() {
    const p = await SUFRAH.getProfile();
    if (!p) return;
    if (p.cart && Object.keys(p.cart).length) { cart = p.cart; SUFRAH.saveCart(cart); updateCartUI(); }
    if (p.city) { loc = { city: p.city }; localStorage.setItem('sufrah_location', JSON.stringify(loc)); updateLocHeader(); renderFamilies(); renderDishes(); }
    if (p.notifs && p.notifs.length) { notifs = p.notifs; localStorage.setItem('sufrah_notifs', JSON.stringify(notifs)); renderNotifBadge(); }
  }

  function addToCart(id) {
    const d = dishById(id); if (!d) return;
    const fam = SUFRAH.familyById(d.familyId);
    if (fam && fam.isOpen === false) { showToast('🔴 هذا المطبخ مغلق حالياً'); return; }
    cart[id] = (cart[id] || 0) + 1;
    saveCartAll(); updateCartUI();
    showToast(`✅ أُضيف «${d.name}» للسلة`);
  }
  function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    saveCartAll(); updateCartUI();
  }
  function removeItem(id) { delete cart[id]; saveCartAll(); updateCartUI(); }

  function deliveryFee() {
    if (deliveryMethod === 'pickup') return 0;
    return (DELIVERY_DISTANCES[deliveryDistance] || DELIVERY_DISTANCES.near).fee;
  }
  function discountAmount(subtotal) {
    if (!coupon) return 0;
    if (coupon.discount_type === 'percent') return Math.round(subtotal * Number(coupon.value) / 100);
    return Math.min(Number(coupon.value), subtotal);
  }
  const pointsWorth = (pts) => Math.floor((pts || 0) / POINTS_PER_SAR_REDEEM); // قيمة النقاط بالريال
  function pointsDiscountAmt(cap) {
    if (!redeemPoints || myPoints < POINTS_PER_SAR_REDEEM) return 0;
    return Math.min(pointsWorth(myPoints), Math.max(0, cap));
  }
  function renderPointsRedeem() {
    if (myPoints < POINTS_PER_SAR_REDEEM) return '';
    return `
      <label class="points-redeem ${redeemPoints ? 'is-active' : ''}">
        <input type="checkbox" id="redeemToggle" ${redeemPoints ? 'checked' : ''} />
        <span class="points-redeem__emoji">🎁</span>
        <span class="points-redeem__info"><strong>استخدم نقاطك</strong><small>لديك ${myPoints} نقطة = ${pointsWorth(myPoints)} ر.س خصم</small></span>
      </label>`;
  }
  function renderDeliveryOptions() {
    const distance = deliveryMethod === 'family' ? `
      <div class="distance-pick">
        <div class="distance-pick__label">المسافة تقريباً:</div>
        ${Object.values(DELIVERY_DISTANCES).map((d) => `
          <label class="dchip ${d.id === deliveryDistance ? 'is-active' : ''}">
            <input type="radio" name="distance" value="${d.id}" ${d.id === deliveryDistance ? 'checked' : ''} />
            ${d.name} · ${d.fee} ر.س
          </label>`).join('')}
      </div>` : '';
    return `
      <div class="delivery-pick">
        <div class="delivery-pick__title">طريقة الاستلام</div>
        ${ALL_DELIVERY.map((k) => {
          const t = DELIVERY_TYPES[k];
          const fl = k === 'pickup' ? 'مجاناً' : 'حسب المسافة';
          return `
          <label class="dopt ${k === deliveryMethod ? 'is-active' : ''}">
            <input type="radio" name="delivery" value="${k}" ${k === deliveryMethod ? 'checked' : ''} />
            <span class="dopt__emoji">${t.emoji}</span>
            <span class="dopt__info"><strong>${t.name}</strong><small>${t.note}</small></span>
            <span class="dopt__fee">${fl}</span>
          </label>`;
        }).join('')}
        ${distance}
      </div>`;
  }

  function renderPaymentOptions() {
    return `
      <div class="delivery-pick">
        <div class="delivery-pick__title">طريقة الدفع</div>
        ${Object.values(PAYMENT_TYPES).map((t) => `
          <label class="dopt ${t.id === paymentMethod ? 'is-active' : ''}">
            <input type="radio" name="payment" value="${t.id}" ${t.id === paymentMethod ? 'checked' : ''} />
            <span class="dopt__emoji">${t.emoji}</span>
            <span class="dopt__info"><strong>${t.name}</strong><small>${t.note}</small></span>
          </label>`).join('')}
      </div>`;
  }

  /* ---------- جدولة الطلب (احجز وقت) ---------- */
  function slotDate(dayOffset, slot) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(slot.h, 0, 0, 0);
    return d;
  }
  function slotAvailable(dayOffset, slot) {
    if (dayOffset > 0) return true; // الأيام القادمة كل فتراتها متاحة
    return slotDate(0, slot).getTime() >= Date.now() + SCHEDULE_LEAD_HOURS * 3600 * 1000;
  }
  function dayLabel(offset) {
    if (offset === 0) return 'اليوم';
    if (offset === 1) return 'غداً';
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'numeric' });
  }
  function fmtSched(s) {
    try { return new Date(s).toLocaleString('ar', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  }
  // الموعد يُخزَّن داخل بيانات الطلب (items) فلا يحتاج عمود جديد بالقاعدة
  function orderSched(o) { return (o.items || []).reduce((v, it) => v || (it && it.sched) || null, null); }
  function schedLabelText() {
    const slot = TIME_SLOT_BY_ID[schedSlot];
    if (!slot) return '';
    return `${dayLabel(schedDay)} · ${slot.label}`;
  }
  function renderTimingOptions() {
    const isSched = orderTiming === 'schedule';
    const asapNote = deliveryMethod === 'pickup' ? 'جاهز بأقرب وقت للاستلام' : 'يوصلك بأقرب وقت';
    let sched = '';
    if (isSched) {
      // الأيام المتاحة (تجاهل اليوم لو ما بقي فيه فترات)
      const days = [];
      for (let i = 0; i <= SCHEDULE_DAYS_AHEAD; i++) {
        if (i === 0 && !TIME_SLOTS.some((s) => slotAvailable(0, s))) continue;
        days.push(i);
      }
      if (!days.includes(schedDay)) schedDay = days[0];
      const dayChips = days.map((i) => `
        <label class="dchip ${i === schedDay ? 'is-active' : ''}">
          <input type="radio" name="schedday" value="${i}" ${i === schedDay ? 'checked' : ''} />
          ${dayLabel(i)}
        </label>`).join('');
      // الفترات المتاحة لليوم المختار
      const slots = TIME_SLOTS.filter((s) => slotAvailable(schedDay, s));
      if (!slots.some((s) => s.id === schedSlot)) schedSlot = slots.length ? slots[0].id : null;
      const slotChips = slots.length
        ? slots.map((s) => `
          <label class="dchip ${s.id === schedSlot ? 'is-active' : ''}">
            <input type="radio" name="schedslot" value="${s.id}" ${s.id === schedSlot ? 'checked' : ''} />
            ${s.label}
          </label>`).join('')
        : '<span class="sched-none">ما فيه مواعيد اليوم — اختر يوم ثاني</span>';
      sched = `
        <div class="sched-box">
          <div class="sched-row"><span class="sched-lbl">📅 اليوم</span><div class="sched-chips">${dayChips}</div></div>
          <div class="sched-row"><span class="sched-lbl">⏰ الوقت</span><div class="sched-chips">${slotChips}</div></div>
        </div>`;
    }
    return `
      <div class="delivery-pick">
        <div class="delivery-pick__title">متى تبي طلبك؟</div>
        <label class="dopt ${!isSched ? 'is-active' : ''}">
          <input type="radio" name="timing" value="asap" ${!isSched ? 'checked' : ''} />
          <span class="dopt__emoji">⚡</span>
          <span class="dopt__info"><strong>في أقرب وقت</strong><small>${asapNote}</small></span>
        </label>
        <label class="dopt ${isSched ? 'is-active' : ''}">
          <input type="radio" name="timing" value="schedule" ${isSched ? 'checked' : ''} />
          <span class="dopt__emoji">📅</span>
          <span class="dopt__info"><strong>احجز وقت لاحق</strong><small>تختار اليوم والساعة — مناسب لأكل يحتاج تحضير</small></span>
        </label>
        ${sched}
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
      drawerBody.innerHTML = items + renderDeliveryOptions() + renderTimingOptions() + renderPaymentOptions() + renderPointsRedeem();
    }

    const subtotal = cartSubtotal();
    const fee = subtotal > 0 ? deliveryFee() : 0;
    const couponDisc = subtotal > 0 ? discountAmount(subtotal) : 0;
    const ptsDisc = subtotal > 0 ? pointsDiscountAmt(subtotal - couponDisc) : 0;
    $('#subtotal').textContent = priceLabel(subtotal);
    $('#delivery').textContent = fee ? priceLabel(fee) : 'مجاناً';
    const dRow = $('#discountRow');
    if (dRow) { if (couponDisc > 0) { dRow.hidden = false; $('#discountVal').textContent = '- ' + priceLabel(couponDisc); } else dRow.hidden = true; }
    const pRow = $('#pointsRow');
    if (pRow) { if (ptsDisc > 0) { pRow.hidden = false; $('#pointsVal').textContent = '- ' + priceLabel(ptsDisc); } else pRow.hidden = true; }
    const sRow = $('#schedRow');
    if (sRow) {
      if (subtotal > 0 && orderTiming === 'schedule') { sRow.hidden = false; $('#schedVal').textContent = schedLabelText() || 'اختر الوقت'; }
      else sRow.hidden = true;
    }
    $('#total').textContent = priceLabel(Math.max(0, subtotal + fee - couponDisc - ptsDisc));
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
    myUserId = u ? u.id : null;
    $('#accountBtn').classList.toggle('is-in', !!u);
  }

  /* ---------- الإشعارات ---------- */
  function saveNotifs() { localStorage.setItem('sufrah_notifs', JSON.stringify(notifs.slice(0, 30))); }
  function renderNotifBadge() {
    const b = $('#notifBadge'); const c = notifs.filter((n) => !n.read).length;
    b.textContent = c; b.hidden = c === 0;
  }
  function addNotif(text) {
    notifs.unshift({ text, time: Date.now(), read: false });
    saveNotifs(); renderNotifBadge(); showToast('🔔 ' + text); pushCloud();
  }
  function renderNotifPanel() {
    notifBody.innerHTML = notifs.length ? notifs.map((n) => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-item__text">🔔 ${escH(n.text)}</div>
        <div class="notif-item__time">${new Date(n.time).toLocaleString('ar', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}</div>
      </div>`).join('') : '<div class="aempty">ما فيه إشعارات بعد</div>';
  }
  function openNotif() {
    renderNotifPanel();
    notifModal.classList.add('is-open'); notifOverlay.classList.add('is-open'); document.body.style.overflow = 'hidden';
    notifs.forEach((n) => { n.read = true; }); saveNotifs(); renderNotifBadge();
  }
  function closeNotif() { notifModal.classList.remove('is-open'); notifOverlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  function openAcct() { acctModal.classList.add('is-open'); acctOverlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; renderAcct(); }
  function closeAcct() { acctModal.classList.remove('is-open'); acctOverlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  let lastOrders = []; // آخر طلبات معروضة في «طلباتي» (لإعادة الطلب)
  function orderCardRO(o) {
    const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
    const items = (o.items || []).map((it) => `${it.qty}× ${escH(it.name)}`).join('، ');
    const sv = o.scheduled_for || orderSched(o);
    const sched = sv ? `<div class="order__sched">📅 موعد الطلب: ${fmtSched(sv)}</div>` : '';
    return `<div class="order order--${o.status}">
      <div class="order__top"><span class="ostatus ostatus--${o.status}">${st.emoji} ${st.label}</span><span class="order__total">${o.total} ر.س</span></div>
      <div class="order__items">${items}</div>${sched}
      <button class="order__reorder" data-reorder="${o.id}">🔁 اطلب مرة ثانية</button></div>`;
  }
  function subCardRO(s) {
    const fam = SUFRAH.familyById(s.kitchen_id);
    const days = (s.days || []).map((d) => (WEEKDAY_BY_ID[d] || {}).name || d).join('، ');
    const paused = s.status === 'paused';
    return `<div class="sub ${paused ? 'sub--paused' : ''}">
      <div class="sub__top"><b>${fam ? escH(fam.name) : 'مطبخ'}</b><span class="sub__status">${paused ? '⏸ موقوف' : '🟢 نشط'}</span></div>
      <div class="sub__days">📅 ${days || '—'}</div>
      ${s.note ? `<div class="sub__note">📝 ${escH(s.note)}</div>` : ''}
      <div class="sub__actions">
        <button class="ghost-btn" data-subtoggle="${s.id}" data-to="${paused ? 'active' : 'paused'}">${paused ? '▶ تفعيل' : '⏸ إيقاف مؤقت'}</button>
        <button class="ghost-btn ghost-btn--danger" data-subcancel="${s.id}">🗑️ إلغاء</button>
      </div>
    </div>`;
  }
  function reorder(orderId) {
    const o = lastOrders.find((x) => x.id === orderId);
    if (!o || !Array.isArray(o.items)) return;
    let added = 0, missing = 0, closed = false;
    o.items.forEach((it) => {
      const d = dishById(it.dish_id);
      if (!d) { missing++; return; }
      const fam = SUFRAH.familyById(d.familyId);
      if (fam && fam.isOpen === false) { closed = true; return; }
      cart[it.dish_id] = (cart[it.dish_id] || 0) + (it.qty || 1);
      added++;
    });
    if (added) {
      saveCartAll(); updateCartUI();
      closeAcct(); openDrawer();
      showToast((missing || closed) ? '✅ أضفنا الأصناف المتوفّرة لسلتك' : '🛒 رجّعنا طلبك للسلة!');
    } else if (closed) {
      showToast('🔴 مطبخ هذا الطلب مغلق حالياً');
    } else {
      showToast('أصناف هذا الطلب غير متوفرة حالياً');
    }
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
        showToast('أهلاً فيك 👋'); await refreshAcctBtn(); await syncFromCloud(); renderAcct();
      });
      $('#custReg').addEventListener('submit', async (e) => {
        e.preventDefault(); const fd = new FormData(e.target); const err = $('#crErr');
        const res = await SUFRAH.registerCustomer({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), password: fd.get('password') });
        if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
        showToast('🎉 تم إنشاء حسابك'); await refreshAcctBtn(); pushCloud(); renderAcct();
      });
    } else {
      const [p, orders, subs] = await Promise.all([SUFRAH.getProfile(), SUFRAH.getMyOrders(), SUFRAH.getMySubscriptions()]);
      lastOrders = orders;
      myPoints = (p && p.points) || 0;
      acctBody.innerHTML = `
        <div class="acct-hello">أهلاً ${escH(p.full_name || 'بك')} 👋</div>
        <div class="acct-email">${escH(p.email)}</div>
        <div class="acct-points">🎁 نقاطك: <b>${myPoints}</b> <small>= ${pointsWorth(myPoints)} ر.س خصم</small></div>
        <button class="ghost-btn" id="custLogout" style="width:100%;margin:12px 0 18px">تسجيل الخروج</button>
        <h4 class="acct-oh">اشتراكاتي الأسبوعية (${subs.length})</h4>
        <div class="subs-list">${subs.length ? subs.map(subCardRO).join('') : '<div class="aempty">ما عندك اشتراكات — اشترك من صفحة أي مطبخ</div>'}</div>
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
      const locAddr = loc.city !== 'كل المدن' ? loc.city : '';
      $('#coAddress').value = (p && p.address) || locAddr;
    }
    myPoints = (p && p.points) || 0;
    updateCartUI(); // لإظهار خيار استخدام النقاط
  }

  /* ---------- الموقع ---------- */
  function saveLoc() { localStorage.setItem('sufrah_location', JSON.stringify(loc)); }
  function updateLocHeader() { $('#locationText').textContent = loc.city; }
  function fillLocCities() { $('#locCity').innerHTML = CITIES.map((c) => `<option value="${c}">${c}</option>`).join(''); }
  function applyCity(city) {
    loc = { city };
    saveLoc(); updateLocHeader(); renderFamilies(); renderDishes(); pushCloud();
  }
  function openLoc() {
    $('#locCity').value = loc.city;
    locModal.classList.add('is-open'); locOverlay.classList.add('is-open'); document.body.style.overflow = 'hidden';
  }
  function closeLoc() { locModal.classList.remove('is-open'); locOverlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  function detectLocation() {
    if (!navigator.geolocation) { showToast('جهازك ما يدعم تحديد الموقع'); return; }
    showToast('📍 نحدد موقعك…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`);
        const data = await res.json();
        const detectedCity = data.city || data.principalSubdivision || data.locality || '';
        const cityMatch = CITIES.find((c) => c !== 'كل المدن' && detectedCity && (detectedCity.includes(c) || c.includes(detectedCity)));
        if (cityMatch) { $('#locCity').value = cityMatch; applyCity(cityMatch); showToast(`📍 مدينتك: ${cityMatch}`); }
        else showToast(detectedCity ? `📍 ${detectedCity} — اختر أقرب مدينة` : '📍 اختر مدينتك يدوياً');
      } catch (e) { showToast('تعذّر تحديد الموقع، اختر يدوياً'); }
    }, () => { showToast('لازم تسمح بالوصول لموقعك من المتصفح'); }, { enableHighAccuracy: true, timeout: 8000 });
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
      if (e.target.closest('#subSubmit')) { submitSubscription(openKitchenId); return; }
      onDishClick(e);
    });
    kitchenView.addEventListener('change', (e) => {
      if (e.target.closest('#subDays')) {
        const lbl = e.target.closest('.dchip');
        if (lbl) lbl.classList.toggle('is-active', e.target.checked);
      }
    });

    drawerBody.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]'); const dec = e.target.closest('[data-dec]'); const rem = e.target.closest('[data-remove]');
      if (inc) changeQty(inc.dataset.inc, +1);
      else if (dec) changeQty(dec.dataset.dec, -1);
      else if (rem) removeItem(rem.dataset.remove);
    });
    drawerBody.addEventListener('change', (e) => {
      if (e.target.name === 'delivery') { deliveryMethod = e.target.value; updateCartUI(); }
      if (e.target.name === 'distance') { deliveryDistance = e.target.value; updateCartUI(); }
      if (e.target.name === 'payment') { paymentMethod = e.target.value; updateCartUI(); }
      if (e.target.name === 'timing') { orderTiming = e.target.value; updateCartUI(); }
      if (e.target.name === 'schedday') { schedDay = +e.target.value; schedSlot = null; updateCartUI(); }
      if (e.target.name === 'schedslot') { schedSlot = e.target.value; updateCartUI(); }
      if (e.target.id === 'redeemToggle') { redeemPoints = e.target.checked; updateCartUI(); }
    });

    $('#cartBtn').addEventListener('click', openDrawer);
    $('#drawerClose').addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    $('#accountBtn').addEventListener('click', openAcct);
    $('#acctClose').addEventListener('click', closeAcct);
    acctOverlay.addEventListener('click', closeAcct);
    acctBody.addEventListener('click', async (e) => {
      const rb = e.target.closest('[data-reorder]');
      if (rb) { reorder(rb.dataset.reorder); return; }
      const stg = e.target.closest('[data-subtoggle]');
      if (stg) { await SUFRAH.updateSubscriptionStatus(stg.dataset.subtoggle, stg.dataset.to); showToast(stg.dataset.to === 'paused' ? '⏸ تم إيقاف الاشتراك' : '🟢 تم تفعيل الاشتراك'); renderAcct(); return; }
      const scl = e.target.closest('[data-subcancel]');
      if (scl) { await SUFRAH.deleteSubscription(scl.dataset.subcancel); showToast('🗑️ تم إلغاء الاشتراك'); renderAcct(); return; }
    });
    $('#locationBtn').addEventListener('click', openLoc);
    $('#locClose').addEventListener('click', closeLoc);
    locOverlay.addEventListener('click', closeLoc);
    $('#locGps').addEventListener('click', detectLocation);
    $('#locSave').addEventListener('click', () => {
      applyCity($('#locCity').value); closeLoc();
      showToast('📍 تم تحديث موقعك');
    });
    $('#notifBtn').addEventListener('click', openNotif);
    $('#notifClose').addEventListener('click', closeNotif);
    notifOverlay.addEventListener('click', closeNotif);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeAcct(); closeLoc(); closeNotif(); } });

    const onSearch = (val) => { closeKitchen(); searchTerm = val; renderDishes(); };
    $('#searchInput').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'header'); onSearch(e.target.value); });
    $('#heroSearch').addEventListener('input', (e) => { syncSearchInputs(e.target.value, 'hero'); onSearch(e.target.value); });
    $('#heroSearchBtn').addEventListener('click', () => document.getElementById('menu').scrollIntoView({ behavior: 'smooth' }));
    $('#sortSelect').addEventListener('change', (e) => { sortBy = e.target.value; renderDishes(); });

    $('#couponApply').addEventListener('click', async () => {
      const code = ($('#couponCode').value || '').trim();
      if (!code) return;
      const c = await SUFRAH.getCoupon(code);
      if (!c) { coupon = null; updateCartUI(); showToast('❌ كود الخصم غير صحيح'); return; }
      coupon = c; updateCartUI();
      const off = c.discount_type === 'percent' ? c.value + '%' : c.value + ' ر.س';
      showToast(`🎁 تم تطبيق الخصم (${off})!`);
    });

    $('#checkoutBtn').addEventListener('click', async () => {
      if (cartQtyTotal() === 0) { showToast('سلتك فاضية 🛒'); return; }
      const name = ($('#coName').value || '').trim();
      const phone = ($('#coPhone').value || '').trim();
      const address = ($('#coAddress').value || '').trim();
      if (!name || !phone) { showToast('اكتب الاسم ورقم الجوال 📞'); return; }
      if (paymentMethod === 'card') { showToast('💳 الدفع بالبطاقة قريباً — اختر «عند الاستلام» حالياً'); return; }
      let scheduledFor = null;
      if (orderTiming === 'schedule') {
        const slot = TIME_SLOT_BY_ID[schedSlot];
        if (!slot || !slotAvailable(schedDay, slot)) { showToast('اختر يوم ووقت الاستلام 📅'); return; }
        scheduledFor = slotDate(schedDay, slot).toISOString();
      }
      const fee = deliveryFee();
      const totalSub = cartSubtotal();
      const couponD = discountAmount(totalSub);
      const ptsD = pointsDiscountAmt(totalSub - couponD);
      const totalDisc = couponD + ptsD;

      // نجمّع الطلب حسب كل مطبخ (طلب مستقل لكل أسرة)
      const groups = {};
      Object.entries(cart).forEach(([id, qty]) => {
        const d = dishById(id); if (!d) return;
        (groups[d.familyId] = groups[d.familyId] || []).push({ dish_id: id, name: d.name, price: d.price, qty });
      });
      const btn = $('#checkoutBtn'); btn.disabled = true; btn.textContent = '⏳ جاري إرسال الطلب…';
      let okCount = 0, paidSum = 0;
      for (const [kid, items] of Object.entries(groups)) {
        const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
        const orderDisc = totalSub > 0 ? Math.round(totalDisc * subtotal / totalSub) : 0;
        const orderTotal = Math.max(0, subtotal + fee - orderDisc);
        const orderObj = {
          kitchen_id: kid, customer_name: name, customer_phone: phone, address,
          delivery_method: deliveryMethod, payment_method: paymentMethod,
          items, subtotal, delivery_fee: fee, total: orderTotal,
        };
        if (scheduledFor) orderObj.scheduled_for = scheduledFor;
        const res = await SUFRAH.createOrder(orderObj);
        if (res.ok) { okCount++; paidSum += orderTotal; }
      }
      btn.disabled = false; btn.textContent = 'إتمام الطلب';
      if (okCount > 0) {
        SUFRAH.saveProfile({ name, phone, address });
        let earned = 0;
        if (myUserId) {
          earned = Math.round(paidSum) * POINTS_PER_SAR;
          const newPts = Math.max(0, myPoints - ptsD * POINTS_PER_SAR_REDEEM + earned);
          SUFRAH.savePoints(newPts); myPoints = newPts;
        }
        cart = {}; coupon = null; $('#couponCode').value = '';
        orderTiming = 'asap'; schedDay = 0; schedSlot = null; redeemPoints = false;
        saveCartAll(); updateCartUI(); closeDrawer();
        let msg = scheduledFor ? '🎉 تم حجز طلبك! بيوصلك بالموعد المحدد.' : '🎉 تم إرسال طلبك للأسرة! بتجهّزه وتتواصل معك.';
        if (earned > 0) msg += ` كسبت ${earned} نقطة 🎁`;
        showToast(msg);
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
    await refreshAcctBtn();
    await syncFromCloud();
    renderNotifBadge();
    SUFRAH.subscribeOrders((payload) => {
      if (payload.eventType === 'UPDATE' && payload.new && myUserId && payload.new.customer_id === myUserId) {
        const st = ORDER_STATUS[payload.new.status] || {};
        addNotif(`طلبك صار «${st.label || ''}» ${st.emoji || ''}`);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
