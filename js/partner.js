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
    // ضبط تصنيف المطبخ الافتراضي في نموذج الطبق
    $('#dishCuisine').value = account.cuisine;
    renderMyDishes(account);
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
    const acc = SUFRAH.currentAccount();
    if (acc) showDash(acc); else showAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
