/* ===================================================
   سُفرة — لوحة الأسر المنتجة
   =================================================== */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const authView = $('#authView');
  const dashView = $('#dashView');
  const toastEl = $('#toast');
  const EMOJIS = ['🍽️', '🍛', '🥘', '🍲', '🍰', '🧁', '🥐', '🫓', '🍖', '☕', '🥙', '🍚'];
  let pickedEmoji = '🍽️';
  let pickedImg = ''; // dataURL للصورة المرفوعة
  const escHtml = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  /* ---------- تنبيه ---------- */
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2400);
  }

  /* ---------- تعبئة القوائم ---------- */
  function fillSelect(el, items, exclude) {
    el.innerHTML = items
      .filter((i) => i.id !== exclude)
      .map((i) => `<option value="${i.id}">${i.emoji ? i.emoji + ' ' : ''}${i.name}</option>`).join('');
  }
  function fillEmojiPick() {
    $('#emojiPick').innerHTML = EMOJIS
      .map((e, i) => `<button type="button" class="emoji-opt ${i === 0 ? 'is-active' : ''}" data-emoji="${e}">${e}</button>`).join('');
  }
  function fillDeliveryChecks() {
    $('#deliveryChecks').innerHTML = ALL_DELIVERY.map((k) => {
      const t = DELIVERY_TYPES[k];
      return `
      <label class="dcheck">
        <input type="checkbox" value="${k}" checked />
        <span class="dcheck__box"></span>
        <span class="dcheck__label">${t.emoji} ${t.name}<small>${t.fee ? t.fee + ' ر.س' : 'مجاناً'}</small></span>
      </label>`;
    }).join('');
  }

  /* ---------- ضغط الصورة إلى dataURL ---------- */
  function fileToCompressedDataURL(file, maxDim = 640, quality = 0.72) {
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

  /* ---------- التبديل بين الشاشات ---------- */
  function showAuth() { authView.hidden = false; dashView.hidden = true; $('#logoutBtn').hidden = true; }
  function showDash(account) {
    authView.hidden = true; dashView.hidden = false; $('#logoutBtn').hidden = false;
    $('#dashAvatar').textContent = account.emoji || '🍽️';
    $('#dashAvatar').style.background = account.grad || DEFAULT_GRAD;
    $('#dashName').textContent = account.kitchenName;
    const cz = (CUISINE_BY_ID[account.cuisine] || {});
    const cePrefix = cz.emoji ? cz.emoji + ' ' : '';
    $('#dashMeta').textContent = `${cePrefix}${cz.name || ''}${account.city ? ' · ' + account.city : ''} · ${account.email || ''}`;
    $('#openToggle').checked = account.isOpen !== false;
    $('#openLabel').textContent = account.isOpen !== false ? 'مفتوح' : 'مغلق';
    // ضبط تصنيف المطبخ الافتراضي في نموذج الطبق
    $('#dishCuisine').value = account.cuisine;
    renderMyDishes(account);
    renderOrders(account);
    renderSubscribers(account);
    renderAnalytics(account);
    // إعلانات الأدمن
    SUFRAH.getAnnouncements().then((list) => {
      const b = $('#annBanner');
      if (list && list.length) {
        b.innerHTML = list.map((a) => `<div class="ann-item">📣 ${escHtml(a.message)}</div>`).join('');
        b.hidden = false;
      } else { b.hidden = true; }
    });
  }

  /* ---------- أطباق مطبخي ---------- */
  function renderMyDishes(account) {
    const dishes = SUFRAH.dishesByAccount(account.id);
    $('#statDishes').textContent = dishes.length;
    const avg = dishes.length ? Math.round(dishes.reduce((s, d) => s + Number(d.price), 0) / dishes.length) : 0;
    $('#statAvg').textContent = `${avg} ر.س`;
    $('#myEmpty').hidden = dishes.length > 0;

    $('#myDishes').innerHTML = dishes.map((d) => {
      const thumb = d.img
        ? `<div class="dish__thumb dish__thumb--img" style="background-image:url('${d.img}')">`
        : `<div class="dish__thumb" style="background:${d.grad || DEFAULT_GRAD}">${d.emoji || '🍽️'}`;
      const delivery = (d.delivery || ALL_DELIVERY).map((k) => DELIVERY_TYPES[k].emoji).join(' ');
      return `
      <article class="dish">
        ${thumb}
          <button class="dish__del" data-del="${d.id}" title="حذف">🗑️</button>
        </div>
        <div class="dish__body">
          <h3 class="dish__name">${d.name}</h3>
          <p class="dish__family">${(CATEGORY_BY_ID[d.cat] || {}).name || ''} · ${delivery}</p>
          <p class="dish__desc">${d.desc || ''}</p>
          <div class="dish__foot">
            <span class="dish__price">${d.price} <small>ر.س</small></span>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- الطلبات الواردة ---------- */
  const fmtT = (s) => { try { return new Date(s).toLocaleString('ar', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }); } catch { return ''; } };
  const fmtSched = (s) => { try { return new Date(s).toLocaleString('ar', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const orderSched = (o) => (o.items || []).reduce((v, it) => v || (it && it.sched) || null, null);
  function orderActions(o) {
    const b = (to, label, cls) => `<button class="abtn ${cls}" data-order="${o.id}" data-to="${to}">${label}</button>`;
    if (o.status === 'new') return b('preparing', 'قبول ✅', 'abtn--go') + ' ' + b('cancelled', 'رفض', 'abtn--danger');
    if (o.status === 'preparing') return b('on_the_way', 'بالطريق 🛵', 'abtn--go');
    if (o.status === 'on_the_way') return b('delivered', 'تم التسليم ✅', 'abtn--go');
    return '';
  }
  function renderOrders(account) {
    SUFRAH.getKitchenOrders(account.id).then((orders) => {
      const active = orders.filter((o) => o.status === 'new').length;
      const badge = $('#ordersBadge');
      badge.textContent = active; badge.hidden = active === 0;
      $('#ordersEmpty').hidden = orders.length > 0;
      $('#ordersList').innerHTML = orders.map((o) => {
        const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
        const items = (o.items || []).map((it) => `${it.qty}× ${escHtml(it.name)}`).join('، ');
        const dm = (DELIVERY_TYPES[o.delivery_method] || {}).name || '';
        const pm = (PAYMENT_TYPES[o.payment_method] || PAYMENT_TYPES.cash);
        const sv = o.scheduled_for || orderSched(o);
        const schedLine = sv
          ? `<div class="order__sched">📅 موعد التسليم: <b>${fmtSched(sv)}</b></div>`
          : '';
        return `
        <div class="order order--${o.status}">
          <div class="order__top">
            <span class="ostatus ostatus--${o.status}">${st.emoji} ${st.label}</span>
            <span class="order__time">${fmtT(o.created_at)}</span>
          </div>
          ${schedLine}
          <div class="order__cust">👤 ${escHtml(o.customer_name || '')} · 📞 ${escHtml(o.customer_phone || '')}</div>
          ${o.address ? `<div class="order__addr">📍 ${escHtml(o.address)}</div>` : ''}
          <div class="order__items">${items}</div>
          <div class="order__foot">
            <span class="order__total">${o.total} ر.س · ${dm} · ${pm.emoji} ${pm.name}</span>
            <div class="order__actions">${orderActions(o)}</div>
          </div>
        </div>`;
      }).join('');
    });
  }

  /* ---------- تحليلات المطبخ ---------- */
  function renderAnalytics(account) {
    Promise.all([SUFRAH.getKitchenOrders(account.id), SUFRAH.getKitchenReviews(account.id)]).then(([orders, reviews]) => {
      const active = orders.filter((o) => o.status !== 'cancelled');
      const revenue = active.reduce((s, o) => s + Number(o.total || 0), 0);
      const weekAgo = Date.now() - 7 * 864e5;
      const weekCount = orders.filter((o) => { try { return new Date(o.created_at).getTime() >= weekAgo; } catch { return false; } }).length;
      const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
      // الطبق الأكثر طلباً (بمجموع الكميات)
      const tally = {};
      active.forEach((o) => (o.items || []).forEach((it) => { const n = it.name || ''; tally[n] = (tally[n] || 0) + (it.qty || 1); }));
      const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      $('#anOrders').textContent = orders.length;
      $('#anRevenue').textContent = `${revenue} ر.س`;
      $('#anWeek').textContent = weekCount;
      $('#anRating').textContent = reviews.length ? `⭐ ${avg.toFixed(1)}` : '—';
      $('#anBest').textContent = best ? `${best[0]} (${best[1]}×)` : 'لا يوجد بعد';
    }).catch(() => {});
  }

  /* ---------- المشتركون أسبوعياً ---------- */
  function renderSubscribers(account) {
    SUFRAH.getKitchenSubscriptions(account.id).then((subs) => {
      const badge = $('#subsCount');
      badge.textContent = subs.length; badge.hidden = subs.length === 0;
      $('#subsEmpty').hidden = subs.length > 0;
      $('#subsList').innerHTML = subs.map((s) => {
        const days = (s.days || []).map((d) => (WEEKDAY_BY_ID[d] || {}).name || d).join('، ');
        return `
        <div class="order">
          <div class="order__cust">👤 ${escHtml(s.customer_name || 'عميل')} · 📞 ${escHtml(s.customer_phone || '')}</div>
          <div class="order__items">📅 ${days}</div>
          ${s.note ? `<div class="order__addr">📝 ${escHtml(s.note)}</div>` : ''}
        </div>`;
      }).join('');
    }).catch(() => {});
  }

  /* ---------- نافذة الإضافة ---------- */
  function openAdd() { $('#addOverlay').classList.add('is-open'); $('#addModal').classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function closeAdd() { $('#addOverlay').classList.remove('is-open'); $('#addModal').classList.remove('is-open'); document.body.style.overflow = ''; }
  function resetDishForm() {
    $('#dishForm').reset();
    pickedImg = '';
    $('#imgPreview').hidden = true; $('#uploaderPh').hidden = false;
    const acc = SUFRAH.currentAccount();
    if (acc) $('#dishCuisine').value = acc.cuisine;
  }

  /* ---------- الأحداث ---------- */
  function bindEvents() {
    // إظهار/إخفاء كلمة المرور
    document.querySelectorAll('.pw-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁️';
        btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      });
    });

    // تبويبات الدخول/التسجيل
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const isReg = tab.dataset.tab === 'register';
        $('#registerForm').hidden = !isReg;
        $('#loginForm').hidden = isReg;
      });
    });

    // اختيار الأيقونة
    $('#emojiPick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-emoji]'); if (!b) return;
      document.querySelectorAll('.emoji-opt').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active'); pickedEmoji = b.dataset.emoji;
    });

    // الإقرارات النظامية: زر التسجيل لا يعمل إلا بعد الموافقة على الكل
    const agreeChecks = [...document.querySelectorAll('.agree-check')];
    const regSubmit = $('#registerSubmit');
    const syncAgree = () => { regSubmit.disabled = !agreeChecks.every((c) => c.checked); };
    agreeChecks.forEach((c) => c.addEventListener('change', syncAgree));
    syncAgree();

    // تسجيل جديد
    $('#registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#regError');
      if (!agreeChecks.every((c) => c.checked)) {
        err.textContent = 'يرجى الموافقة على جميع الإقرارات النظامية قبل المتابعة';
        err.hidden = false; return;
      }
      const fd = new FormData(e.target);
      regSubmit.disabled = true; regSubmit.textContent = '⏳ جاري الإنشاء…';
      const res = await SUFRAH.register({
        kitchenName: fd.get('kitchenName'),
        cuisine: fd.get('cuisine'),
        city: fd.get('city'),
        email: fd.get('email'),
        password: fd.get('password'),
        emoji: pickedEmoji,
      });
      regSubmit.disabled = false; regSubmit.textContent = '🚀 افتح مطبخك';
      if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
      err.hidden = true;
      showToast(`🎉 تم فتح «${res.account.kitchenName}» بنجاح!`);
      showDash(res.account);
    });

    // دخول
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#loginError');
      const fd = new FormData(e.target);
      const res = await SUFRAH.login(fd.get('email'), fd.get('password'));
      if (!res.ok) { err.textContent = res.error; err.hidden = false; return; }
      err.hidden = true;
      showToast(`أهلاً من جديد يا «${res.account.kitchenName}» 👋`);
      showDash(res.account);
    });

    // خروج
    $('#logoutBtn').addEventListener('click', async () => { await SUFRAH.logout(); showAuth(); showToast('تم تسجيل الخروج'); });

    // حالة المطبخ مفتوح/مغلق
    $('#openToggle').addEventListener('change', async (e) => {
      const open = e.target.checked;
      $('#openLabel').textContent = open ? 'مفتوح' : 'مغلق';
      await SUFRAH.setKitchenOpen(open);
      showToast(open ? '🟢 مطبخك مفتوح للطلبات' : '🔴 مطبخك مغلق مؤقتاً');
    });

    // فتح/إغلاق نافذة الإضافة
    $('#openAddBtn').addEventListener('click', () => { resetDishForm(); openAdd(); });
    $('#addClose').addEventListener('click', closeAdd);
    $('#addOverlay').addEventListener('click', closeAdd);

    // رفع الصورة + معاينة
    $('#dishImage').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        pickedImg = await fileToCompressedDataURL(file);
        const prev = $('#imgPreview');
        prev.src = pickedImg; prev.hidden = false; $('#uploaderPh').hidden = true;
      } catch { showToast('تعذّر قراءة الصورة، جرّب صورة ثانية'); }
    });

    // حفظ الطبق
    $('#dishForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const account = SUFRAH.currentAccount();
      if (!account) { showAuth(); return; }
      const fd = new FormData(e.target);
      const delivery = [...document.querySelectorAll('#deliveryChecks input:checked')].map((c) => c.value);
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = '⏳ جاري الحفظ…';
      const res = await SUFRAH.addDish({
        name: (fd.get('name') || '').trim(),
        price: Number(fd.get('price')),
        cat: fd.get('cat'),
        cuisine: fd.get('cuisine'),
        desc: (fd.get('desc') || '').trim(),
        img: pickedImg || '',
        delivery: delivery.length ? delivery : ALL_DELIVERY,
        tag: 'جديد',
      });
      btn.disabled = false; btn.textContent = '💾 حفظ الطبق';
      if (!res.ok) { showToast('تعذّر الحفظ: ' + (res.error || '')); return; }
      closeAdd();
      showToast('✅ أُضيف الطبق! صار ظاهر للعملاء الآن');
      renderMyDishes(account);
    });

    // حذف طبق
    $('#myDishes').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      await SUFRAH.deleteDish(b.dataset.del);
      renderMyDishes(SUFRAH.currentAccount());
      showToast('🗑️ تم حذف الطبق');
    });

    // تحديث حالة الطلب
    $('#ordersList').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-order]'); if (!btn) return;
      await SUFRAH.updateOrderStatus(btn.dataset.order, btn.dataset.to);
      const a = SUFRAH.currentAccount(); if (a) renderOrders(a);
      showToast('تم تحديث حالة الطلب');
    });
  }

  /* ---------- الإقلاع ---------- */
  async function init() {
    fillSelect($('#regCuisine'), CUISINES, 'all');
    fillSelect($('#dishCat'), CATEGORIES, 'all');
    fillSelect($('#dishCuisine'), CUISINES, 'all');
    fillEmojiPick();
    fillDeliveryChecks();
    bindEvents();
    // تحديث أطباق مطبخي لحظياً إذا كان مسجّلاً دخول
    SUFRAH.onChange(() => { const a = SUFRAH.currentAccount(); if (a && !dashView.hidden) renderMyDishes(a); });
    try { await SUFRAH.init(); } catch (e) { console.warn('SUFRAH.init', e); }
    SUFRAH.subscribeOrders((payload) => {
      const a = SUFRAH.currentAccount();
      if (a && !dashView.hidden) renderOrders(a);
      if (payload.eventType === 'INSERT' && a && payload.new && payload.new.kitchen_id === a.id) showToast('🔔 طلب جديد وصلك!');
    });
    const acc = SUFRAH.currentAccount();
    if (acc) showDash(acc); else showAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
