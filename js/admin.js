/* ============================================================
   سُفرة · لوحة الإدارة · js/admin.js
   يحتاج قبله: supabase-js و js/config.js و js/core.js
   الأقسام: اليوم، الطلبات، الشكاوى، الأسر، طلبات الانضمام، العملاء،
            المالية، العروض، الإشعارات، الإعدادات، الفريق، السجل
   ============================================================ */
(function () {
  'use strict';

  // ───────── أدوات قصيرة ─────────
  const t = (ar, en) => SF.t(ar, en);
  const esc = (s) => SF.esc(s);
  const ic = (n, c = '') => SF.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const db = () => SF.sb;
  const app = () => document.getElementById('app');
  const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
  const latin = (s) => String(s ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  const numOf = (v) => { const s = latin(v).replace(/[^\d.-]/g, ''); if (!s || s === '-' || s === '.') return null; const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
  const need = (r) => { if (r && r.error) { const e = new Error(r.error.message || 'db'); e.raw = r.error; e.text = SF.errText(r.error); throw e; } return r ? r.data : null; };
  // كتابة مباشرة لازم ترجع صف: لو صفر صفوف (صلاحية أو صف محذوف) نعتبرها ما انحفظت
  const must = (r) => { const d = need(r); if (d == null || (Array.isArray(d) && !d.length)) { const e = new Error('no rows'); e.text = SF.t('ما انحفظ، يمكن ما عندك صلاحية لهذا', 'Not saved, you may not have permission for this'); throw e; } return d; };
  const errMsg = (e) => (e && (e.text || SF.errText(e))) || t('صار خطأ، جرّب مرة ثانية', 'Something went wrong, try again');
  const failed = (r, ar, en) => { if (r && r.ok) return false; SF.toast(SF.msgOf(r) || t(ar || 'ما تم الحفظ، جرّب مرة ثانية', en || 'Not saved, try again'), 'bad'); return true; };
  const LIVE = ['new', 'preparing', 'ready', 'on_the_way'];
  const DONE = ['delivered', 'picked_up'];

  // ───────── تنسيق ─────────
  const fmtN = (n, max = 2) => (+n || 0).toLocaleString('en-US', { maximumFractionDigits: max });
  const sar = (n) => (SF.lang === 'en' ? `SAR ${fmtN(n)}` : `${fmtN(n)} ر.س`);
  const sarH = (n) => (SF.lang === 'en' ? `<small class="cur">SAR</small> ${fmtN(n)}` : `${fmtN(n)} <small class="cur">ر.س</small>`);
  const kShort = (n) => { const v = +n || 0; return Math.abs(v) >= 10000 ? fmtN(v / 1000, 1) + (SF.lang === 'en' ? 'k' : ' ألف') : fmtN(v, 0); };
  const today = () => SF.todayISO();
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayStart = (iso) => `${iso}T00:00:00+03:00`;
  const locale = () => (SF.lang === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn');
  const dShort = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
  const dLong = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
  const PRESET = {
    today: () => [today(), today()],
    yesterday: () => [addDays(today(), -1), addDays(today(), -1)],
    d7: () => [addDays(today(), -6), today()],
    d30: () => [addDays(today(), -29), today()],
    d90: () => [addDays(today(), -89), today()],
    month: () => [today().slice(0, 8) + '01', today()],
    last_month: () => { const end = addDays(today().slice(0, 8) + '01', -1); return [end.slice(0, 8) + '01', end]; },
    all: () => ['2024-01-01', today()],
  };
  const NOUN = {
    order: [['طلب واحد', 'طلبين', 'طلبات', 'طلب'], ['order', 'orders']],
    family: [['أسرة وحدة', 'أسرتين', 'أسر', 'أسرة'], ['kitchen', 'kitchens']],
    customer: [['عميل واحد', 'عميلين', 'عملاء', 'عميل'], ['customer', 'customers']],
    dish: [['طبق واحد', 'طبقين', 'أطباق', 'طبق'], ['dish', 'dishes']],
    person: [['شخص واحد', 'شخصين', 'أشخاص', 'شخص'], ['person', 'people']],
    item: [['صنف واحد', 'صنفين', 'أصناف', 'صنف'], ['item', 'items']],
  };
  function cnt(n, noun) {
    const [ar, en] = NOUN[noun]; n = +n || 0;
    if (SF.lang === 'en') return `${fmtN(n)} ${n === 1 ? en[0] : en[1]}`;
    if (n === 1) return ar[0];
    if (n === 2) return ar[1];
    if (n >= 3 && n <= 10) return `${n} ${ar[2]}`;
    return `${fmtN(n)} ${ar[3]}`;
  }

  // ───────── التسميات ─────────
  const L = {
    famSt: { active: ['نشطة', 'Active', 'b-ok'], pending: ['تحت المراجعة', 'Under review', 'b-warn'], suspended: ['موقوفة', 'Suspended', 'b-bad'], closed: ['مسكّرة', 'Closed', ''] },
    pay: { cod: ['كاش', 'Cash'], card: ['بطاقة', 'Card'], free: ['مجاني', 'Free'] },
    paySt: { unpaid: ['غير مدفوع', 'Unpaid', 'b-warn'], pending: ['جاري الدفع', 'Paying', 'b-info'], paid: ['مدفوع', 'Paid', 'b-ok'], refund_pending: ['بانتظار الاسترجاع', 'Refund pending', 'b-bad'], refunded: ['مسترجع', 'Refunded', ''], failed: ['فشل الدفع', 'Failed', 'b-bad'] },
    ful: { delivery: ['توصيل', 'Delivery'], pickup: ['استلام', 'Pickup'] },
    by: { customer: ['العميل', 'Customer'], family: ['الأسرة', 'Kitchen'], admin: ['الإدارة', 'Admin'], system: ['النظام', 'System'] },
    ev: { refund_requested: ['طلب استرجاع المبلغ', 'Refund requested'], marked_paid: ['انسجل كمدفوع', 'Marked as paid'], note: ['ملاحظة الإدارة', 'Admin note'], reminded: ['تذكير الأسرة بالطلب', 'Kitchen reminded'] },
    cmpKind: { late: ['تأخير', 'Late'], quality: ['جودة الأكل', 'Food quality'], missing: ['صنف ناقص', 'Missing item'], wrong: ['طلب غلط', 'Wrong order'], cancel: ['إلغاء', 'Cancellation'], refund: ['استرجاع', 'Refund'], payment: ['الدفع', 'Payment'], other: ['غيره', 'Other'] },
    cmpSt: { open: ['مفتوحة', 'Open', 'b-bad'], in_progress: ['قيد المعالجة', 'In progress', 'b-warn'], resolved: ['محلولة', 'Resolved', 'b-ok'], rejected: ['مرفوضة', 'Rejected', ''] },
    doc: { freelance: ['وثيقة العمل الحر', 'Freelance permit'], family_cert: ['شهادة أسرة منتجة', 'Productive family certificate'], health_cert: ['شهادة صحية', 'Health certificate'], municipal: ['رخصة البلدية', 'Municipal licence'], iban_cert: ['شهادة الآيبان', 'IBAN certificate'], id: ['الهوية', 'ID'], other: ['وثيقة أخرى', 'Other document'] },
    docSt: { pending: ['بانتظار المراجعة', 'Pending review', 'b-warn'], approved: ['معتمدة', 'Approved', 'b-ok'], rejected: ['مرفوضة', 'Rejected', 'b-bad'] },
    role: { admin: ['مدير', 'Owner admin', 'b-brand'], support: ['دعم', 'Support', 'b-info'], family_owner: ['صاحب المطبخ', 'Kitchen owner', 'b-ok'], family_staff: ['موظف أسرة', 'Kitchen staff', ''], driver: ['مندوب توصيل', 'Driver', ''] },
    joinSt: { new: ['جديد', 'New', 'b-info'], approved: ['مقبول', 'Approved', 'b-ok'], rejected: ['مرفوض', 'Rejected', ''] },
    aud: { customers: ['العملاء', 'Customers'], families: ['الأسر', 'Kitchens'], all: ['الكل', 'Everyone'] },
    log: {
      family_create: ['إضافة أسرة', 'Kitchen created'], family_edit: ['تعديل بيانات أسرة', 'Kitchen edited'], family_private: ['تعديل البيانات الخاصة لأسرة', 'Kitchen private data edited'],
      family_status: ['تغيير حالة أسرة', 'Kitchen status changed'], family_delete: ['حذف أسرة', 'Kitchen deleted'], family_image: ['تغيير صورة أسرة', 'Kitchen image changed'],
      dish_edit: ['تعديل طبق', 'Dish edited'], doc_review: ['مراجعة وثيقة', 'Document reviewed'],
      join_approve: ['قبول طلب انضمام', 'Join request approved'], join_reject: ['رفض طلب انضمام', 'Join request rejected'],
      order_cancel: ['إلغاء طلب', 'Order cancelled'], order_status: ['تغيير حالة طلب يدويًا', 'Order status forced'], order_refund: ['طلب استرجاع مبلغ', 'Refund requested'],
      order_mark_paid: ['تسجيل طلب كمدفوع', 'Order marked paid'], order_hide_review: ['إخفاء تقييم', 'Review hidden'], order_show_review: ['إظهار تقييم', 'Review shown'],
      order_test: ['تبديل علامة التجريبي', 'Test flag toggled'], order_note: ['ملاحظة على طلب', 'Order note'],
      settings: ['تعديل الإعدادات', 'Settings changed'], city_edit: ['تعديل مدينة', 'City edited'], category_edit: ['تعديل تصنيف', 'Category edited'], category_add: ['إضافة تصنيف', 'Category added'],
      staff_save: ['تعديل الفريق', 'Team updated'], payout: ['تسجيل تحويل', 'Payout recorded'], broadcast: ['إشعار جماعي', 'Broadcast sent'], customer_set: ['تعديل عميل', 'Customer updated'],
      promo_save: ['حفظ كود خصم', 'Promo saved'], promo_delete: ['حذف كود خصم', 'Promo deleted'], complaint_update: ['تحديث شكوى', 'Complaint updated'], delete_demo: ['حذف البيانات التجريبية', 'Demo data deleted'],
    },
  };
  const lb = (map, k) => { const v = map[k]; return v ? t(v[0], v[1]) : String(k ?? ''); };
  const badge = (map, k, extra = '') => { const v = map[k]; return `<span class="badge ${(v && v[2]) || ''} ${extra}">${esc(lb(map, k))}</span>`; };
  const none = () => `<span class="muted">${esc(t('غير محدد', 'Not set'))}</span>`;
  const testBadge = () => `<span class="badge b-dark">${esc(t('تجريبي', 'Test'))}</span>`;

  // ───────── الحالة ─────────
  const A = { me: null, owner: false, fams: [], famById: {}, cities: [], cats: [], staff: [], counts: { live: 0, joins: 0, complaints: 0, waiting: 0 }, sec: '', tok: 0, live: [], orderCtx: null };
  const indexFams = () => { A.famById = Object.fromEntries(A.fams.map((f) => [f.id, f])); };
  const famName = (id) => { const f = A.famById[id]; return f ? SF.nm(f, 'name') : t('أسرة محذوفة', 'Removed kitchen'); };
  const cityName = (id) => { const c = A.cities.find((x) => x.id === id); return c ? SF.nm(c, 'name') : (id || ''); };
  const staffByUid = (uid) => A.staff.find((s) => s.user_id === uid);
  const famOptions = (sel = '', all = true) => (all ? `<option value="">${esc(t('كل الأسر', 'All kitchens'))}</option>` : '') +
    A.fams.slice().sort((a, b) => SF.nm(a, 'name').localeCompare(SF.nm(b, 'name'), 'ar')).map((f) => `<option value="${esc(f.id)}" ${f.id === sel ? 'selected' : ''}>${esc(SF.nm(f, 'name'))}${f.status !== 'active' ? ' · ' + esc(lb(L.famSt, f.status)) : ''}</option>`).join('');
  const cityOptions = (sel = '', placeholder = true) => (placeholder ? `<option value="">${esc(t('اختر المدينة', 'Choose a city'))}</option>` : '') +
    A.cities.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(SF.nm(c, 'name'))}${c.active ? '' : ' · ' + esc(t('غير مفعلة', 'inactive'))}</option>`).join('');

  // سجل الإدارة للتعديلات المباشرة على الجداول (دالة sf_a_log الإضافية)، وما يوقف شي لو فشل
  const logUi = (action, target, data) => { SF.rpc('sf_a_log', { p_action: action, p_target: target == null ? null : String(target), p_data: data || null }).catch(() => {}); };

  // ───────── عناصر واجهة مشتركة ─────────
  const head = (title, sub = '', actions = '') => `<header class="ph"><div class="ph-t"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${actions ? `<div class="ph-a">${actions}</div>` : ''}</header>`;
  const empty = (icon, title, body = '', extra = '') => `<div class="empty"><div class="art">${ic(icon)}</div><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${extra}</div>`;
  const thumb = (url, cls = '') => `<span class="thumb ${cls}">${ic('dish')}${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  const skel = (n = 3) => `<div class="v-load">${Array.from({ length: n }, () => '<div class="skel skl"></div>').join('')}</div>`;
  const lockNote = () => `<div class="notice info">${ic('lock')}<span>${esc(t('التعديل هنا للمدير بس، وتقدر تشوف البيانات', 'Only the owner admin can change this, you can still view it'))}</span></div>`;
  const errBox = (e) => `<div class="empty"><div class="art">${ic('alert')}</div><h3>${esc(t('ما قدرنا نحمّل الصفحة', 'Could not load this page'))}</h3><p>${esc(errMsg(e))}</p><button class="btn btn-soft" data-act="reload">${ic('refresh', 's')}${esc(t('حاول مرة ثانية', 'Try again'))}</button></div>`;
  function phoneCell(p, waText = '') {
    const n = SF.normPhone(p);
    if (!n) return p ? `<span class="ltr">${esc(p)}</span>` : none();
    return `<span class="ph-links"><a class="ltr" href="tel:+${n}">${esc(SF.showPhone(n))}</a><a class="mini wa" href="${esc(SF.waLink(n, waText))}" target="_blank" rel="noopener" aria-label="${esc(t('واتساب', 'WhatsApp'))}">${ic('whatsapp', 's')}</a></span>`;
  }
  function drawer(html, opts = {}) {
    const s = SF.openSheet(`<div class="dr">${html}</div>`, { noFocus: true, onClose: opts.onClose, sticky: opts.sticky });
    s.sh.classList.add('drawer');
    if (opts.wide) s.sh.classList.add('wide');
    s.body = s.sh.querySelector('.dr');
    return s;
  }
  const drHead = (titleHtml, subHtml = '', extra = '', tabs = '') => `<div class="dr-head"><div class="dr-top"><div class="grow dr-ttl"><h2>${titleHtml}</h2>${subHtml ? `<small>${subHtml}</small>` : ''}</div>${extra}<button class="icon-btn" data-close aria-label="${esc(t('إغلاق', 'Close'))}">${ic('x')}</button></div>${tabs}</div>`;
  const drLoading = () => `${drHead(`<span class="skel" style="display:inline-block;width:160px;height:22px"></span>`)}<div class="dr-body">${skel(4)}</div>`;
  function formSheet(html, opts = {}) {
    const s = SF.openSheet(`<div class="fs">${html}</div>`, { noFocus: !!opts.noFocus, sticky: opts.sticky, onClose: opts.onClose });
    s.sh.classList.add('fsheet');
    return s;
  }
  const fsHead = (title, sub = '') => `<div class="sheet-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}</div><button class="icon-btn" data-close aria-label="${esc(t('إغلاق', 'Close'))}">${ic('x')}</button></div>`;
  const field = (label, inner, hint = '', cls = '') => `<label class="field ${cls}"><span>${esc(label)}</span>${inner}${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</label>`;
  const sw = (name, on, attrs = '') => `<span class="switch"><input type="checkbox" ${name ? `name="${esc(name)}"` : ''} ${on ? 'checked' : ''} ${attrs}><span></span></span>`;
  const srow = (title, help, ctl) => `<div class="srow"><div class="grow"><b>${esc(title)}</b>${help ? `<small>${esc(help)}</small>` : ''}</div>${ctl}</div>`;
  const kv = (pairs) => `<dl class="kv">${pairs.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

  // شريط الفترة: شرائح سريعة + تاريخين للمخصص
  function rangeBar(st, presets, key) {
    return `<div class="rangebar" data-range="${key}">
      <div class="chips">${presets.map(([id, ar, en]) => `<button class="chip ${st.preset === id ? 'is-active' : ''}" data-preset="${id}">${esc(t(ar, en))}</button>`).join('')}</div>
      <div class="range-custom ${st.preset === 'custom' ? '' : 'hide'}">
        <label><span>${esc(t('من', 'From'))}</span><input type="date" class="input" data-rf="from" value="${esc(st.from)}" max="${today()}"></label>
        <label><span>${esc(t('إلى', 'To'))}</span><input type="date" class="input" data-rf="to" value="${esc(st.to)}" max="${today()}"></label>
      </div></div>`;
  }
  function bindRange(root, key, st, onChange) {
    const box = root.querySelector(`[data-range="${key}"]`);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      st.preset = b.dataset.preset;
      if (st.preset !== 'custom') [st.from, st.to] = PRESET[st.preset]();
      $$('[data-preset]', box).forEach((x) => x.classList.toggle('is-active', x === b));
      box.querySelector('.range-custom').classList.toggle('hide', st.preset !== 'custom');
      $$('[data-rf]', box).forEach((i) => { i.value = st[i.dataset.rf]; });
      if (st.preset !== 'custom') onChange();
    });
    box.addEventListener('change', (e) => {
      const i = e.target.closest('[data-rf]'); if (!i) return;
      st[i.dataset.rf] = i.value;
      if (st.from && st.to) { if (st.from > st.to) [st.from, st.to] = [st.to, st.from]; onChange(); }
    });
  }
  const rangeLabel = (st) => (st.from === st.to ? dLong(st.from) : `${dShort(st.from)} ${t('إلى', 'to')} ${dShort(st.to)}`);

  // ───────── الوضع الليلي ─────────
  const THEME_KEY = 'sf_admin_theme';
  const root = document.documentElement;
  function applyTheme() { const v = SF.LS.get(THEME_KEY, null); if (v === 'dark' || v === 'light') root.dataset.theme = v; else delete root.dataset.theme; }
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const themeIcon = () => ic(isDark() ? 'sun' : 'moon', 's');
  function toggleTheme() { SF.LS.set(THEME_KEY, isDark() ? 'light' : 'dark'); applyTheme(); $$('[data-act="theme"]').forEach((b) => { b.innerHTML = themeIcon(); }); }

  // ───────── الدخول ─────────
  const bootHtml = () => `<div class="adm-boot-in"><img src="img/mark.svg" alt=""><span class="spin"></span></div>`;
  function renderLogin(msg) {
    stopLive();
    A.me = null;
    document.title = t('سُفرة · لوحة الإدارة', 'Sufrah · Admin');
    app().className = 'adm-login';
    app().innerHTML = `
      <div class="lg-card">
        <div class="lg-brand"><img src="img/mark.svg" alt=""><div><b>${esc(t('سُفرة', 'Sufrah'))}</b><small>${esc(t('لوحة الإدارة', 'Admin panel'))}</small></div></div>
        <div class="sadu thin"></div>
        <div id="lgStep" class="lg-step"></div>
        <div class="lg-foot"><button class="btn btn-ghost btn-sm" data-act="lang">${ic('globe', 's')}${SF.lang === 'en' ? 'العربية' : 'English'}</button><button class="icon-btn" data-act="theme" aria-label="${esc(t('تبديل الوضع', 'Toggle theme'))}">${themeIcon()}</button></div>
      </div>`;
    loginPhone(msg);
  }
  function loginPhone(msg) {
    const box = $('#lgStep');
    box.innerHTML = `
      <div><h1>${esc(t('أهلًا بك', 'Welcome back'))}</h1><p class="ink2">${esc(t('ادخل برقم جوالك المسجل في فريق سُفرة', 'Sign in with your Sufrah team number'))}</p></div>
      ${msg ? `<div class="notice bad">${ic('alert')}<span>${esc(msg)}</span></div>` : ''}
      <label class="field"><span>${esc(t('رقم الجوال', 'Mobile number'))}</span>
        <div class="input-group"><span class="addon">+966</span><input class="input" id="lgPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="05XXXXXXXX" dir="ltr" maxlength="14" value="${esc(A.lgPhone || '')}"></div>
      </label>
      <button class="btn btn-primary btn-lg btn-block" id="lgSend">${esc(t('أرسل الرمز', 'Send code'))}</button>`;
    const inp = $('#lgPhone'), btn = $('#lgSend');
    const go = () => SF.busy(btn, async () => {
      try { await SF.auth.sendCode(inp.value); A.lgPhone = inp.value; loginCode(); }
      catch (e) { SF.toast(e.text || SF.errText(e), 'bad'); inp.classList.add('is-bad'); }
    });
    btn.onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    inp.oninput = () => inp.classList.remove('is-bad');
    if (window.innerWidth > 760) setTimeout(() => inp.focus(), 60);
  }
  function loginCode() {
    const box = $('#lgStep');
    box.innerHTML = `
      <div><h1>${esc(t('اكتب الرمز', 'Enter the code'))}</h1><p class="ink2">${esc(t('أرسلنا رمز من 6 أرقام إلى', 'We sent a 6 digit code to'))} <b class="ltr">${esc(SF.showPhone(A.lgPhone))}</b></p></div>
      <div class="otp" id="lgOtp">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="6" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="${esc(t('رقم', 'Digit'))} ${i + 1}">`).join('')}</div>
      <button class="btn btn-primary btn-lg btn-block" id="lgVerify">${esc(t('دخول', 'Sign in'))}</button>
      <div class="row between lg-links"><button class="link" id="lgBack">${esc(t('تغيير الرقم', 'Change number'))}</button><button class="link" id="lgResend"></button></div>`;
    const ins = $$('#lgOtp input');
    const code = () => ins.map((i) => latin(i.value).replace(/\D/g, '')).join('');
    let busyV = false;
    const btn = $('#lgVerify');
    async function verify() {
      if (busyV) return;
      const c = code();
      if (c.length !== 6) { SF.toast(t('اكتب الرمز كامل', 'Enter the full code'), 'bad'); return; }
      busyV = true;
      await SF.busy(btn, async () => {
        try { await SF.auth.verify(A.lgPhone, c); await enter(); }
        catch (e) { SF.toast(e.text || SF.errText(e), 'bad'); ins.forEach((i) => { i.value = ''; }); ins[0].focus(); }
      });
      busyV = false;
    }
    const fill = (s, from) => {
      const d = latin(s).replace(/\D/g, '').slice(0, 6 - from);
      d.split('').forEach((c, k) => { ins[from + k].value = c; });
      ins[Math.min(from + d.length, 5)].focus();
      if (code().length === 6) verify();
    };
    ins.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const v = latin(inp.value).replace(/\D/g, '');
        if (v.length > 1) { inp.value = ''; fill(v, v.length >= 6 ? 0 : i); return; }
        inp.value = v;
        if (v && i < 5) ins[i + 1].focus();
        if (code().length === 6) verify();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && i > 0) { ins[i - 1].value = ''; ins[i - 1].focus(); }
        if (e.key === 'Enter') verify();
      });
      inp.addEventListener('paste', (e) => { const s = (e.clipboardData || window.clipboardData).getData('text'); if (s) { e.preventDefault(); fill(s, 0); } });
    });
    btn.onclick = verify;
    $('#lgBack').onclick = () => loginPhone();
    let left = 60;
    const rs = $('#lgResend');
    const tick = () => {
      if (!rs.isConnected) { clearInterval(tm); return; }
      if (left > 0) { rs.disabled = true; rs.textContent = t(`إعادة الإرسال بعد ${left} ث`, `Resend in ${left}s`); left -= 1; }
      else { rs.disabled = false; rs.textContent = t('أرسل الرمز مرة ثانية', 'Resend the code'); }
    };
    const tm = setInterval(tick, 1000);
    tick();
    rs.onclick = () => { if (left > 0) return; SF.busy(rs, async () => { try { await SF.auth.sendCode(A.lgPhone); left = 60; SF.toast(t('أرسلنا رمز جديد', 'A new code is on its way'), 'ok'); } catch (e) { SF.toast(e.text || SF.errText(e), 'bad'); } }); };
    setTimeout(() => ins[0].focus(), 60);
  }
  function renderNoAccess(me) {
    stopLive();
    app().className = 'adm-login';
    app().innerHTML = `
      <div class="lg-card">
        <div class="lg-brand"><img src="img/mark.svg" alt=""><div><b>${esc(t('سُفرة', 'Sufrah'))}</b><small>${esc(t('لوحة الإدارة', 'Admin panel'))}</small></div></div>
        <div class="sadu thin"></div>
        <div class="empty"><div class="art">${ic('lock')}</div><h3>${esc(t('ما عندك صلاحية', 'You do not have access'))}</h3>
          <p>${esc(me && me.error ? t('ما قدرنا نتأكد من حسابك، تأكد من الإنترنت وجرب مرة ثانية', 'We could not check your account, check your connection and try again') : t('هذا الرقم مو مسجل في فريق إدارة سُفرة', 'This number is not on the Sufrah admin team'))}</p>
          ${me && me.phone ? `<p class="ltr small muted">${esc(SF.showPhone(me.phone))}</p>` : ''}</div>
        <div class="row">${me && me.error ? `<button class="btn btn-primary grow" data-act="retry">${esc(t('حاول مرة ثانية', 'Try again'))}</button>` : ''}<button class="btn btn-soft grow" data-act="signout">${ic('logout', 's')}${esc(t('ادخل برقم ثاني', 'Use another number'))}</button></div>
      </div>`;
  }
  async function enter() {
    app().className = 'adm-boot';
    app().innerHTML = bootHtml();
    const me = await SF.me(true);
    if (!me || !me.uid) return renderLogin();
    if (me.error || !['admin', 'support'].includes(me.role)) return renderNoAccess(me);
    A.me = me;
    A.owner = me.role === 'admin';
    try { await loadBase(); } catch (e) { SF.toast(errMsg(e), 'bad'); }
    renderShell();
    route();
    startLive();
    refreshCounts();
    loadNotifs();
    const m = location.search.match(/[?&]order=([0-9a-f-]{36})/i);
    if (m) setTimeout(() => openOrder(m[1]), 300);
  }
  async function loadBase() {
    const [f, c, k, s] = await Promise.all([
      db().from('sf_families').select('*').order('sort').order('created_at'),
      db().from('sf_cities').select('*').order('sort'),
      db().from('sf_categories').select('*').order('sort'),
      db().from('sf_staff').select('*').order('created_at'),
      SF.loadSettings(true).catch(() => ({})),
    ]);
    A.fams = need(f) || []; indexFams();
    A.cities = need(c) || [];
    A.cats = need(k) || [];
    A.staff = need(s) || [];
  }
  async function reloadFams() { A.fams = need(await db().from('sf_families').select('*').order('sort').order('created_at')) || []; indexFams(); }
  async function reloadStaff() { A.staff = need(await db().from('sf_staff').select('*').order('created_at')) || []; }

  // ───────── الهيكل: القائمة الجانبية والشريط العلوي ─────────
  const NAV = [
    { id: 'today', icon: 'chart', ar: 'اليوم', en: 'Today', grp: 'ops' },
    { id: 'orders', icon: 'receipt', ar: 'الطلبات', en: 'Orders', grp: 'ops', cnt: 'live' },
    { id: 'complaints', icon: 'chat', ar: 'الشكاوى', en: 'Complaints', grp: 'ops', cnt: 'complaints' },
    { id: 'families', icon: 'store', ar: 'الأسر', en: 'Kitchens', grp: 'people' },
    { id: 'joins', icon: 'door', ar: 'طلبات الانضمام', en: 'Join requests', grp: 'people', cnt: 'joins' },
    { id: 'customers', icon: 'users', ar: 'العملاء', en: 'Customers', grp: 'people' },
    { id: 'finance', icon: 'wallet', ar: 'المالية', en: 'Finance', grp: 'money' },
    { id: 'promos', icon: 'tag', ar: 'العروض', en: 'Promo codes', grp: 'money' },
    { id: 'broadcasts', icon: 'bell', ar: 'الإشعارات', en: 'Notifications', grp: 'money', owner: true },
    { id: 'settings', icon: 'settings', ar: 'الإعدادات', en: 'Settings', grp: 'sys' },
    { id: 'team', icon: 'shield', ar: 'الفريق', en: 'Team', grp: 'sys' },
    { id: 'log', icon: 'list', ar: 'السجل', en: 'Activity log', grp: 'sys', owner: true },
  ];
  const GRP = { ops: ['التشغيل', 'Operations'], people: ['الأسر والعملاء', 'Kitchens and customers'], money: ['المال والتسويق', 'Money and marketing'], sys: ['النظام', 'System'] };
  function navHtml() {
    let out = '', g = '';
    for (const n of NAV) {
      if (n.grp !== g) { g = n.grp; out += `<div class="grp">${esc(t(GRP[g][0], GRP[g][1]))}</div>`; }
      out += `<a href="#/${n.id}" data-nav="${n.id}" class="${A.sec === n.id ? 'is-active' : ''}">${ic(n.icon)}<span>${esc(t(n.ar, n.en))}</span>${n.cnt ? `<span class="cnt" data-cnt="${n.cnt}" hidden></span>` : ''}${n.owner && !A.owner ? ic('lock', 's lockic') : ''}</a>`;
    }
    return out;
  }
  function renderShell() {
    const me = A.me;
    const who = me.staff_name || (me.profile && me.profile.name) || SF.showPhone(me.phone);
    app().className = 'adm-shell';
    app().innerHTML = `
      <aside class="adm-side" id="side" aria-label="${esc(t('القائمة', 'Menu'))}">
        <div class="adm-brand"><img src="img/mark.svg" alt=""><div><b>${esc(t('سُفرة', 'Sufrah'))}</b><small>${esc(t('لوحة الإدارة', 'Admin panel'))}</small></div>
          <button class="icon-btn side-x" data-act="nav-close" aria-label="${esc(t('إغلاق القائمة', 'Close menu'))}">${ic('x')}</button></div>
        <div class="sadu thin"></div>
        <nav class="adm-nav">${navHtml()}</nav>
        <div class="adm-me">
          <div class="me-row"><span class="av">${ic('user')}</span><div class="grow"><b class="ellipsis">${esc(who)}</b><small>${esc(A.owner ? t('مدير', 'Owner admin') : t('دعم', 'Support'))} · <span class="ltr">${esc(SF.showPhone(me.phone))}</span></small></div></div>
          <div class="me-act">
            <button class="side-btn" data-act="lang">${ic('globe', 's')}<span>${SF.lang === 'en' ? 'العربية' : 'English'}</span></button>
            <button class="side-btn sq" data-act="theme" aria-label="${esc(t('تبديل الوضع', 'Toggle theme'))}">${themeIcon()}</button>
            <button class="side-btn sq" data-act="logout" aria-label="${esc(t('تسجيل الخروج', 'Sign out'))}">${ic('logout', 's')}</button>
          </div>
        </div>
      </aside>
      <div class="adm-scrim" data-act="nav-close"></div>
      <div class="adm-main">
        <header class="adm-top">
          <button class="icon-btn menu-btn" data-act="nav-open" aria-label="${esc(t('القائمة', 'Menu'))}">${ic('menu')}</button>
          <div class="top-title" id="topTitle"></div>
          <form class="top-search" id="topSearch" role="search" autocomplete="off"><span>${ic('search', 's')}</span><input class="input" name="q" placeholder="${esc(t('ابحث برقم طلب أو جوال أو اسم', 'Search order no, phone or name'))}" aria-label="${esc(t('بحث في الطلبات', 'Search orders'))}"></form>
          <a class="live-pill" href="#/orders/live" id="livePill" title="${esc(t('الطلبات الحية الحين', 'Live orders now'))}"><span class="dot"></span><span class="lp-t">${esc(t('الحية', 'Live'))}</span><b id="liveN">0</b></a>
          <button class="icon-btn bell" data-act="notifs" aria-label="${esc(t('الإشعارات', 'Notifications'))}">${ic('bell')}<span class="badge-dot" data-bell hidden></span></button>
          <button class="icon-btn hide-m" data-act="reload" aria-label="${esc(t('تحديث', 'Refresh'))}">${ic('refresh')}</button>
        </header>
        <main class="adm-content" id="view" tabindex="-1"></main>
      </div>`;
    $('#topSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim(); if (!q) return;
      A.of = Object.assign(ordDefaults(), { q });
      e.target.q.value = '';
      if (location.hash.startsWith('#/orders')) route(); else location.hash = '#/orders';
    });
    paintCounts();
  }
  function closeNav() { const s = $('.adm-shell'); if (s) s.classList.remove('nav-open'); }

  // ───────── التنقل ─────────
  const V = {};
  async function route() {
    if (!A.me || !$('#view')) return;
    const h = location.hash.replace(/^#\/?/, '');
    const [raw0, ...rest] = h.split('/');
    // روابط الإشعارات القديمة: #join و #dashboard و #orders و #complaints
    const sec0 = { join: 'joins', dashboard: 'today', home: 'today' }[raw0] || raw0;
    if (sec0 !== raw0 || (raw0 && !location.hash.startsWith('#/'))) { try { history.replaceState(null, '', '#/' + [sec0, ...rest].join('/')); } catch (e) { /* */ } }
    const arg = rest.join('/');
    const sec = V[sec0] ? sec0 : 'today';
    A.sec = sec;
    A.tok += 1;
    $$('.adm-nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === sec));
    closeNav();
    const n = NAV.find((x) => x.id === sec);
    $('#topTitle').innerHTML = `${ic(n.icon, 's')}<span class="ellipsis">${esc(t(n.ar, n.en))}</span>`;
    document.title = `${t(n.ar, n.en)} · ${t('سُفرة', 'Sufrah')}`;
    const el = $('#view');
    el.dataset.ready = '';
    el.dataset.sec = sec;
    el.innerHTML = skel(3);
    window.scrollTo(0, 0);
    const tok = A.tok;
    try { await V[sec](el, arg ? decodeURIComponent(arg) : ''); }
    catch (e) { console.error(e); if (tok === A.tok) el.innerHTML = errBox(e); }
    if (tok === A.tok) el.dataset.ready = '1';
  }
  window.addEventListener('hashchange', route);

  // ───────── أزرار عامة ─────────
  const ACT = {
    lang: () => SF.setLang(SF.lang === 'en' ? 'ar' : 'en'),
    theme: toggleTheme,
    logout: async () => { if (await SF.confirm({ title: t('تسجيل الخروج؟', 'Sign out?'), body: t('تقدر ترجع تدخل برقمك في أي وقت', 'You can sign back in any time'), ok: t('خروج', 'Sign out') })) { await SF.auth.signOut(); renderLogin(); } },
    signout: async () => { await SF.auth.signOut(); renderLogin(); },
    retry: () => enter(),
    'nav-open': () => { const s = $('.adm-shell'); if (s) s.classList.add('nav-open'); },
    'nav-close': closeNav,
    reload: () => { refreshCounts(); route(); },
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    const fn = ACT[b.dataset.act];
    if (fn) { e.preventDefault(); fn(b, e); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  // ───────── العدادات والتحديث الحي ─────────
  async function refreshCounts() {
    if (!A.me) return;
    const H = { count: 'exact', head: true };
    const cutoff = new Date(Date.now() - 5 * 60000).toISOString();
    try {
      const [a, b, c, w] = await Promise.all([
        db().from('sf_orders').select('id', H).in('status', LIVE).eq('is_test', false),
        db().from('sf_join_requests').select('id', H).eq('status', 'new'),
        db().from('sf_complaints').select('id', H).in('status', ['open', 'in_progress']),
        db().from('sf_orders').select('id', H).eq('status', 'new').eq('is_test', false).lt('status_at', cutoff),
      ]);
      A.counts = { live: a.count || 0, joins: b.count || 0, complaints: c.count || 0, waiting: w.count || 0 };
      paintCounts();
    } catch (e) { /* العدادات ثانوية */ }
  }
  const countsSoon = debounce(refreshCounts, 900);
  function paintCounts() {
    const c = A.counts;
    $$('[data-cnt]').forEach((el) => {
      const n = c[el.dataset.cnt] || 0;
      el.hidden = !n;
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hot', el.dataset.cnt === 'live' ? c.waiting > 0 : n > 0);
    });
    const pill = $('#livePill');
    if (pill) { pill.classList.toggle('on', c.live > 0); $('#liveN').textContent = String(c.live); }
  }
  setInterval(() => { if (A.me && !document.hidden) refreshCounts(); }, 60000);

  function startLive() {
    stopLive();
    const k = Date.now().toString(36);
    A.live = [SF.live('sf_orders', null, onOrderRT, 'adm-orders-' + k), SF.live('sf_families', null, onFamRT, 'adm-fams-' + k)];
    if (A.me && A.me.uid) A.live.push(SF.live('sf_notifications', 'user_id=eq.' + A.me.uid, onNotifRT, 'adm-nt-' + k));
  }
  function stopLive() { (A.live || []).forEach((ch) => { try { db().removeChannel(ch); } catch (e) { /* */ } }); A.live = []; }
  function onOrderRT(p) {
    const o = p.new || {};
    if (p.eventType === 'INSERT' && !o.is_test && o.status === 'new') SF.toast(t(`طلب جديد #${o.order_no} من ${famName(o.family_id)}`, `New order #${o.order_no} from ${famName(o.family_id)}`));
    countsSoon();
    if (A.sec === 'orders') ordersSoon(o.id);
    if (A.sec === 'today') dashSoon();
    if (A.orderCtx && A.orderCtx.id === o.id) A.orderCtx.soon();
  }
  function onFamRT(p) {
    if (p.eventType === 'DELETE') { const id = p.old && p.old.id; A.fams = A.fams.filter((x) => x.id !== id); }
    else if (p.new && p.new.id) { const i = A.fams.findIndex((x) => x.id === p.new.id); if (i >= 0) A.fams[i] = Object.assign({}, A.fams[i], p.new); else A.fams.push(p.new); }
    indexFams();
    if (A.sec === 'families') famsSoon();
  }

  // ============================================================
  //  1) اليوم
  // ============================================================
  const DASH_PRESETS = [['today', 'اليوم', 'Today'], ['yesterday', 'أمس', 'Yesterday'], ['d7', '7 أيام', '7 days'], ['month', 'هالشهر', 'This month'], ['custom', 'مخصص', 'Custom']];
  V.today = async (el) => {
    const st = A.dash || (A.dash = { preset: 'today', from: today(), to: today() });
    if (st.preset !== 'custom') [st.from, st.to] = PRESET[st.preset]();
    el.innerHTML = head(t('اليوم', 'Today'), t('نظرة سريعة على الطلبات والمبيعات', 'A quick look at orders and sales')) + rangeBar(st, DASH_PRESETS, 'dash') + `<div id="dash">${skel(3)}</div>`;
    bindRange(el, 'dash', st, () => loadDash());
    await loadDash();
  };
  const dashSoon = debounce(() => loadDash(true), 1500);
  async function loadDash(quiet) {
    const box = $('#dash'); if (!box) return;
    const tok = A.tok, st = A.dash;
    if (!quiet) box.classList.add('dim');
    const cutoff = new Date(Date.now() - 5 * 60000).toISOString();
    try {
      const [s, w] = await Promise.all([
        SF.rpc('sf_admin_stats', { p_from: st.from, p_to: st.to }),
        db().from('sf_orders').select('id,order_no,family_id,status_at,customer_name,scheduled_for').eq('status', 'new').eq('is_test', false).lt('status_at', cutoff).order('status_at').limit(6),
      ]);
      if (tok !== A.tok || !box.isConnected) return;
      box.innerHTML = dashHtml(s || {}, need(w) || [], st);
    } catch (e) { if (tok === A.tok && box.isConnected) box.innerHTML = errBox(e); }
    box.classList.remove('dim');
  }
  function dashHtml(s, waiting, st) {
    const cancelled = +s.cancelled || 0, rejected = +s.rejected || 0;
    const alerts = [];
    if (waiting.length) {
      alerts.push(`<a class="alert-i bad" href="#/orders/new"><span class="a-ic">${ic('clock')}</span><div class="grow"><b>${esc(waiting.length === 1 ? t('طلب ينتظر قبول الأسرة من أكثر من 5 دقايق', 'An order is waiting over 5 minutes') : t(`${cnt(waiting.length, 'order')} ${waiting.length === 2 ? 'ينتظرون' : 'تنتظر'} قبول الأسر من أكثر من 5 دقايق`, `${waiting.length} orders waiting over 5 minutes`))}</b>
        <small>${waiting.slice(0, 3).map((o) => `#${o.order_no} · ${esc(famName(o.family_id))} · ${esc(SF.ago(o.status_at))}`).join('<br>')}</small></div>${ic('chevR', 's flip')}</a>`);
    }
    if (+s.open_complaints) alerts.push(`<a class="alert-i warn" href="#/complaints"><span class="a-ic">${ic('chat')}</span><div class="grow"><b>${esc(t(`شكاوى مفتوحة: ${s.open_complaints}`, `Open complaints: ${s.open_complaints}`))}</b><small>${esc(t('رد عليها من صفحة الشكاوى', 'Reply from the complaints page'))}</small></div>${ic('chevR', 's flip')}</a>`);
    if (+s.join_new) alerts.push(`<a class="alert-i info" href="#/joins"><span class="a-ic">${ic('door')}</span><div class="grow"><b>${esc(t(`طلبات انضمام جديدة: ${s.join_new}`, `New join requests: ${s.join_new}`))}</b><small>${esc(t('أسر تبي تبيع في سُفرة', 'Kitchens that want to sell on Sufrah'))}</small></div>${ic('chevR', 's flip')}</a>`);
    const live = +s.live || 0;
    const kpi = (icon, label, value, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="k-l">${ic(icon)}<span>${esc(label)}</span></div><div class="k-v">${value}</div>${sub ? `<div class="k-s">${sub}</div>` : ''}</div>`;
    const days = fillDays(s.days || [], st.from, st.to);
    const statusRow = Object.entries(s.by_status || {}).sort((a, b) => b[1] - a[1]);
    const topF = s.top_families || [], topD = s.top_dishes || [];
    const maxF = Math.max(1, ...topF.map((x) => +x.gmv || 0)), maxD = Math.max(1, ...topD.map((x) => +x.qty || 0));
    return `
      <div class="pulse-row">
        <a class="live-card ${live ? 'on' : ''}" href="#/orders/live">
          <span class="lc-dot"></span>
          <div class="grow"><small>${esc(t('الطلبات الحية الحين', 'Live orders now'))}</small><b class="n">${fmtN(live, 0)}</b></div>
          <span class="lc-go">${esc(t('افتحها', 'Open'))}${ic('chevR', 's flip')}</span>
        </a>
        <div class="alerts">${alerts.length ? alerts.join('') : `<div class="alert-i ok"><span class="a-ic">${ic('check')}</span><div class="grow"><b>${esc(t('كل شي تمام', 'All clear'))}</b><small>${esc(t('ما فيه طلبات متأخرة ولا شكاوى ولا طلبات انضمام تنتظرك', 'No late orders, complaints or join requests waiting'))}</small></div></div>`}</div>
      </div>
      <p class="range-note">${ic('calendar', 's')}<span>${esc(rangeLabel(st))}</span></p>
      <div class="kpis">
        ${kpi('wallet', t('المبيعات', 'Sales (GMV)'), sarH(s.gmv), esc(t(`من ${cnt(s.done, 'order')} مكتمل`, `from ${cnt(s.done, 'order')} completed`)), 'hero')}
        ${kpi('receipt', t('الطلبات', 'Orders'), fmtN(s.orders, 0), esc(t(`مكتمل ${fmtN(s.done, 0)}`, `${fmtN(s.done, 0)} completed`)))}
        ${kpi('users', t('العملاء', 'Customers'), fmtN(s.customers, 0), esc(t(`جدد ${fmtN(s.new_customers, 0)}`, `${fmtN(s.new_customers, 0)} new`)))}
        ${kpi('tag', t('عمولة المنصة', 'Platform commission'), sarH(s.commission))}
        ${kpi('chart', t('صافي المنصة', 'Platform net'), sarH(s.platform_net), esc(t('بعد الخصومات والرصيد', 'after discounts and credit')))}
        ${kpi('bag', t('متوسط الطلب', 'Average order'), sarH(s.avg_order), s.avg_rating ? `${ic('star', 's')} ${esc(fmtN(s.avg_rating, 1))}` : '')}
        ${kpi('x', t('ملغي أو معتذر', 'Cancelled or declined'), fmtN(cancelled + rejected, 0), esc(t(`ملغي ${cancelled} · اعتذار ${rejected}`, `${cancelled} cancelled · ${rejected} declined`)))}
      </div>
      <div class="grid2">
        <section class="box"><div class="box-h"><h3>${ic('chart')}${esc(t('المبيعات بالأيام', 'Sales by day'))}</h3><span class="muted small">${esc(t('الطلبات المكتملة', 'Completed orders'))}</span></div>${barsHtml(days)}</section>
        <section class="box"><div class="box-h"><h3>${ic('store')}${esc(t('أكثر الأسر مبيعًا', 'Top kitchens'))}</h3><a href="#/families">${esc(t('كل الأسر', 'All kitchens'))}</a></div>
          ${topF.length ? `<ol class="rank">${topF.map((f, i) => `<li><span class="rn">${i + 1}</span><button class="nm link-plain" data-open-fam="${esc(f.id)}">${esc(A.famById[f.id] ? SF.nm(A.famById[f.id], 'name') : f.name)}</button><span class="vl">${sarH(f.gmv)}</span><span class="meter"><i style="width:${Math.max(4, Math.round((+f.gmv / maxF) * 100))}%"></i></span><span class="rs muted tiny">${esc(cnt(f.orders, 'order'))}</span></li>`).join('')}</ol>` : `<p class="muted small empty-line">${esc(t('ما فيه طلبات مكتملة في هالفترة', 'No completed orders in this period'))}</p>`}
        </section>
      </div>
      <div class="grid2 even">
        <section class="box"><div class="box-h"><h3>${ic('dish')}${esc(t('أكثر الأطباق طلبًا', 'Top dishes'))}</h3></div>
          ${topD.length ? `<ol class="rank">${topD.map((d, i) => `<li><span class="rn">${i + 1}</span><span class="nm">${esc(d.name)}</span><span class="vl">${fmtN(d.qty, 0)}</span><span class="meter"><i style="width:${Math.max(4, Math.round((+d.qty / maxD) * 100))}%"></i></span></li>`).join('')}</ol>` : `<p class="muted small empty-line">${esc(t('تطلع هنا الأطباق لما تكتمل الطلبات', 'Dishes show up here once orders are completed'))}</p>`}
        </section>
        <section class="box"><div class="box-h"><h3>${ic('list')}${esc(t('الطلبات حسب الحالة', 'Orders by status'))}</h3><a href="#/orders">${esc(t('كل الطلبات', 'All orders'))}</a></div>
          ${statusRow.length ? `<div class="st-grid">${statusRow.map(([k, v]) => `<div class="st-cell">${SF.statusBadge(k)}<b>${fmtN(v, 0)}</b></div>`).join('')}</div>` : `<p class="muted small empty-line">${esc(t('ما فيه طلبات في هالفترة', 'No orders in this period'))}</p>`}
        </section>
      </div>`;
  }
  // يعبّي الأيام الفاضية بصفر، ولو الفترة طويلة يجمعها بالشهر
  function fillDays(rows, from, to) {
    const map = Object.fromEntries(rows.map((r) => [String(r.date).slice(0, 10), r]));
    const out = [];
    let d = from, guard = 0;
    while (d <= to && guard < 800) { const r = map[d]; out.push({ date: d, gmv: r ? +r.gmv : 0, orders: r ? +r.orders : 0 }); d = addDays(d, 1); guard += 1; }
    if (out.length <= 62) return out.map((x) => ({ ...x, label: dShort(x.date) }));
    const byM = {};
    out.forEach((x) => { const k = x.date.slice(0, 7); byM[k] = byM[k] || { date: k + '-01', gmv: 0, orders: 0 }; byM[k].gmv += x.gmv; byM[k].orders += x.orders; });
    return Object.values(byM).map((x) => ({ ...x, label: new Date(x.date + 'T12:00:00Z').toLocaleDateString(locale(), { month: 'short', timeZone: 'UTC' }) }));
  }
  function barsHtml(days) {
    if (!days.length || days.every((d) => !d.gmv)) return `<div class="bars-empty">${ic('chart', 'l')}<p>${esc(t('ما فيه مبيعات مكتملة في هالفترة', 'No completed sales in this period'))}</p></div>`;
    const max = Math.max(...days.map((d) => d.gmv));
    const every = days.length <= 8 ? 1 : days.length <= 16 ? 2 : days.length <= 31 ? 5 : 7;
    const topI = days.findIndex((d) => d.gmv === max);
    return `<div class="bars" role="img" aria-label="${esc(t('رسم المبيعات بالأيام', 'Sales by day chart'))}">${days.map((d, i) => {
      const h = d.gmv ? Math.max(3, Math.round((d.gmv / max) * 100)) : 0;
      const tip = `${d.label}: ${sar(d.gmv)} · ${cnt(d.orders, 'order')}`;
      return `<div class="bar ${d.gmv ? '' : 'zero'} ${i === topI ? 'top' : ''}" title="${esc(tip)}">${i === topI ? `<b class="v">${esc(kShort(d.gmv))}</b>` : ''}<i style="height:${h}%"></i><em>${i % every === 0 || i === days.length - 1 ? esc(d.label) : '&nbsp;'}</em></div>`;
    }).join('')}</div>`;
  }

  // ============================================================
  //  2) الطلبات
  // ============================================================
  const ORDER_COLS = 'id,order_no,created_at,status_at,customer_name,customer_phone,family_id,fulfillment,total,pay_method,pay_status,status,scheduled_for,window_end,is_test,rating,address';
  const ST_CHIPS = [['live', 'الحية', 'Live'], ['all', 'الكل', 'All'], ['new', 'جديدة', 'New'], ['preparing', 'يتجهز', 'Preparing'], ['ready', 'جاهزة', 'Ready'], ['on_the_way', 'في الطريق', 'On the way'], ['done', 'مكتملة', 'Completed'], ['closed', 'ملغية ومعتذرة', 'Cancelled or declined'], ['pending_payment', 'بانتظار الدفع', 'Awaiting payment']];
  const ordDefaults = () => ({ status: 'all', fam: '', preset: 'all', from: '', to: '', q: '', test: false, rows: [], total: 0, shown: 50 });
  V.orders = async (el, arg) => {
    const f = A.of || (A.of = ordDefaults());
    if (arg && ST_CHIPS.some((c) => c[0] === arg)) f.status = arg;
    el.innerHTML = head(t('الطلبات', 'Orders'), t('كل الطلبات والأحدث أول، وتتحدث لحالها', 'All orders, newest first, updating live'), `<button class="btn btn-soft btn-sm" data-act="reload">${ic('refresh', 's')}${esc(t('تحديث', 'Refresh'))}</button>`) + `
      <div class="fbar">
        <div class="fb-search"><span>${ic('search', 's')}</span><input class="input" id="oq" type="search" placeholder="${esc(t('رقم الطلب أو جوال العميل أو اسمه', 'Order no, customer phone or name'))}" value="${esc(f.q)}"></div>
        <select class="select" id="ofam" aria-label="${esc(t('الأسرة', 'Kitchen'))}">${famOptions(f.fam)}</select>
        <select class="select" id="odate" aria-label="${esc(t('الفترة', 'Period'))}">
          ${[['all', 'كل الأوقات', 'Any time'], ['today', 'اليوم', 'Today'], ['yesterday', 'أمس', 'Yesterday'], ['d7', 'آخر 7 أيام', 'Last 7 days'], ['d30', 'آخر 30 يوم', 'Last 30 days'], ['custom', 'فترة مخصصة', 'Custom range']].map(([v, a, e]) => `<option value="${v}" ${f.preset === v ? 'selected' : ''}>${esc(t(a, e))}</option>`).join('')}
        </select>
        <span class="fb-dates ${f.preset === 'custom' ? '' : 'hide'}"><input type="date" class="input" id="ofrom" value="${esc(f.from)}" max="${today()}" aria-label="${esc(t('من', 'From'))}"><input type="date" class="input" id="oto" value="${esc(f.to)}" max="${today()}" aria-label="${esc(t('إلى', 'To'))}"></span>
        <label class="fb-test">${sw('', f.test, 'id="otest"')}<span>${esc(t('التجريبية', 'Test orders'))}</span></label>
      </div>
      <div class="chips st-chips" id="ochips">${ST_CHIPS.map(([v, a, e]) => `<button class="chip ${f.status === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))}${v === 'live' && A.counts.live ? ` <span class="n">${A.counts.live}</span>` : ''}</button>`).join('')}</div>
      <div id="olist">${skel(2)}</div>`;
    const reload = () => { f.shown = 50; loadOrders(); };
    $('#oq').addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); reload(); }, 350));
    $('#ofam').onchange = (e) => { f.fam = e.target.value; reload(); };
    $('#odate').onchange = (e) => {
      f.preset = e.target.value;
      $('.fb-dates', el).classList.toggle('hide', f.preset !== 'custom');
      if (f.preset === 'custom') { if (!f.from) { f.from = addDays(today(), -6); f.to = today(); $('#ofrom').value = f.from; $('#oto').value = f.to; } }
      reload();
    };
    $('#ofrom').onchange = (e) => { f.from = e.target.value; reload(); };
    $('#oto').onchange = (e) => { f.to = e.target.value; reload(); };
    $('#otest').onchange = (e) => { f.test = e.target.checked; reload(); };
    $('#ochips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.status = b.dataset.st; $$('#ochips .chip').forEach((c) => c.classList.toggle('is-active', c === b)); reload(); });
    $('#olist').addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (more) { f.shown += 50; SF.busy(more, () => loadOrders()); return; }
      const tr = e.target.closest('[data-order]');
      if (tr && !e.target.closest('a')) openOrder(tr.dataset.order);
    });
    await loadOrders();
    if (arg && /^[0-9a-f-]{36}$/i.test(arg)) openOrder(arg);
  };
  function orderQuery(f, cols, opts) {
    let q = db().from('sf_orders').select(cols, opts);
    const s0 = latin(f.q || '').replace(/[\s#]/g, '');
    const byNo = /^\d{1,7}$/.test(s0);
    // البحث برقم طلب يطلع الطلب حتى لو تجريبي
    if (!f.test && !byNo) q = q.eq('is_test', false);
    if (f.status === 'live') q = q.in('status', LIVE);
    else if (f.status === 'done') q = q.in('status', DONE);
    else if (f.status === 'closed') q = q.in('status', ['cancelled', 'rejected']);
    else if (f.status && f.status !== 'all') q = q.eq('status', f.status);
    if (f.fam) q = q.eq('family_id', f.fam);
    let range = null;
    if (f.preset === 'custom' && f.from && f.to) range = [f.from, f.to];
    else if (f.preset && f.preset !== 'all' && PRESET[f.preset]) range = PRESET[f.preset]();
    if (range) q = q.gte('created_at', dayStart(range[0])).lt('created_at', dayStart(addDays(range[1], 1)));
    const s = (f.q || '').trim();
    if (s) {
      const d = latin(s).replace(/\D/g, '');
      const plain = latin(s).replace(/[\s#]/g, '');
      if (d && d === plain && d.length <= 7) q = q.eq('order_no', +d);
      else if (d.length >= 4 && d.length >= plain.replace(/\+/g, '').length - 1) q = q.ilike('customer_phone', `%${d.replace(/^(00966|966|0)/, '')}%`);
      else q = q.ilike('customer_name', `%${s.replace(/[%_]/g, '')}%`);
    }
    return q;
  }
  const ordersSoon = (() => { const run = debounce(() => loadOrders(true), 700); return (id) => { if (id) (A.flash = A.flash || new Set()).add(id); run(); }; })();
  async function loadOrders(quiet) {
    const box = $('#olist'); if (!box) return;
    const f = A.of, tok = A.tok;
    if (!quiet) box.classList.add('dim');
    try {
      const r = await orderQuery(f, ORDER_COLS, { count: 'exact' }).order('created_at', { ascending: false }).range(0, f.shown - 1);
      if (tok !== A.tok || !box.isConnected) return;
      f.rows = need(r) || [];
      f.total = r.count || f.rows.length;
      box.innerHTML = ordersTable(f.rows, f.total);
      if (A.flash) { A.flash.forEach((id) => { const tr = box.querySelector(`[data-order="${CSS.escape(id)}"]`); if (tr) tr.classList.add('flash'); }); A.flash.clear(); }
    } catch (e) { if (tok === A.tok && box.isConnected) box.innerHTML = errBox(e); }
    box.classList.remove('dim');
  }
  function whenCell(o) {
    if (o.scheduled_for) return `<span class="when sched">${ic('calendar', 's')}${esc(SF.fmtDT(o.scheduled_for))}</span>`;
    return `<span class="when">${esc(t('بأسرع وقت', 'ASAP'))}</span>`;
  }
  const payCell = (o) => `<span class="pay">${esc(lb(L.pay, o.pay_method))}</span> ${badge(L.paySt, o.pay_status, 'sm')}`;
  function ordersTable(rows, total) {
    if (!rows.length) return `<div class="box">${empty('receipt', t('ما فيه طلبات', 'No orders'), t('غيّر الفلاتر أو ارجع بعدين', 'Try other filters or check back later'))}</div>`;
    return `<div class="table-wrap"><table class="t cards orders-t">
      <thead><tr><th>${esc(t('الطلب', 'Order'))}</th><th>${esc(t('الوقت', 'Time'))}</th><th>${esc(t('العميل', 'Customer'))}</th><th>${esc(t('الأسرة', 'Kitchen'))}</th><th>${esc(t('الاستلام', 'Fulfilment'))}</th><th class="num">${esc(t('المبلغ', 'Total'))}</th><th>${esc(t('الدفع', 'Payment'))}</th><th>${esc(t('الحالة', 'Status'))}</th></tr></thead>
      <tbody>${rows.map((o) => `<tr class="click ${o.is_test ? 'is-test' : ''}" data-order="${esc(o.id)}" tabindex="0">
        <td class="c-no"><b class="ono">#${esc(o.order_no)}</b>${o.is_test ? ' ' + testBadge() : ''}</td>
        <td class="c-time"><span>${esc(SF.fmtDT(o.created_at))}</span><small>${esc(SF.ago(o.created_at))}</small></td>
        <td class="c-cust"><span class="strong">${esc(o.customer_name || t('عميل', 'Customer'))}</span><small class="ltr">${esc(SF.showPhone(o.customer_phone))}</small></td>
        <td class="c-fam"><span>${esc(famName(o.family_id))}</span><small class="only-m">${esc(lb(L.ful, o.fulfillment))}${o.scheduled_for ? ' · ' + esc(SF.fmtDT(o.scheduled_for)) : ''}</small></td>
        <td class="c-ful"><span>${esc(lb(L.ful, o.fulfillment))}</span><small>${whenCell(o)}</small></td>
        <td class="num c-total"><b>${sarH(o.total)}</b></td>
        <td class="c-pay">${payCell(o)}</td>
        <td class="c-st">${SF.statusBadge(o.status, o.fulfillment)}</td>
      </tr>`).join('')}</tbody></table></div>
      <div class="pager"><span>${esc(t(`يعرض ${rows.length} من ${total}`, `Showing ${rows.length} of ${total}`))}</span>${rows.length < total ? `<button class="btn btn-soft btn-sm" data-more>${esc(t('عرض المزيد', 'Show more'))}</button>` : ''}</div>`;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-order]')) openOrder(e.target.dataset.order); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-open-fam]'); if (b) { e.preventDefault(); openFamily(b.dataset.openFam); } const o = e.target.closest('[data-open-order]'); if (o) { e.preventDefault(); openOrder(o.dataset.openOrder); } });

  // ───────── لوح الطلب ─────────
  async function openOrder(id) {
    const ctx = { id };
    const s = drawer(drLoading(), { onClose: () => { if (A.orderCtx === ctx) A.orderCtx = null; } });
    ctx.s = s;
    A.orderCtx = ctx;
    ctx.load = async () => {
      try {
        const [o, ev, pay, cmp] = await Promise.all([
          db().from('sf_orders').select('*').eq('id', id).maybeSingle(),
          db().from('sf_order_events').select('*').eq('order_id', id).order('id'),
          db().from('sf_payments').select('*').eq('order_id', id).order('created_at'),
          db().from('sf_complaints').select('id,kind,status,created_at').eq('order_id', id).order('created_at'),
        ]);
        ctx.o = need(o);
        if (!ctx.o) { s.body.innerHTML = drHead(esc(t('الطلب', 'Order'))) + `<div class="dr-body">${empty('receipt', t('الطلب غير موجود', 'Order not found'))}</div>`; return; }
        ctx.ev = need(ev) || []; ctx.pay = need(pay) || []; ctx.cmp = need(cmp) || [];
        const fp = await db().from('sf_family_private').select('phone,whatsapp,address_text').eq('family_id', ctx.o.family_id).maybeSingle();
        ctx.fp = fp.data || {};
        renderOrder(ctx);
      } catch (e) { s.body.innerHTML = drHead(esc(t('الطلب', 'Order'))) + `<div class="dr-body">${errBox(e)}</div>`; }
    };
    ctx.soon = debounce(() => { if (s.sh.isConnected) ctx.load(); }, 600);
    s.sh.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) orderAction(ctx, b.dataset.x, b); });
    await ctx.load();
  }
  function renderOrder(ctx) {
    const o = ctx.o, live = SF.isLive(o.status), ad = o.address || {};
    const items = Array.isArray(o.items) ? o.items : [];
    const mapUrl = ad.lat && ad.lng ? `https://maps.google.com/?q=${ad.lat},${ad.lng}` : '';
    const evRows = ctx.ev.map((e) => {
      const label = SF.STATUS[e.status] ? SF.statusLabel(e.status, o.fulfillment) : lb(L.ev, e.status);
      const cls = e.status === 'cancelled' || e.status === 'rejected' ? 'bad' : DONE.includes(e.status) ? 'ok' : e.status === 'note' ? 'note' : '';
      return `<li class="${cls}"><span class="e-dot"></span><div><b>${esc(label)}</b><small>${esc(SF.fmtDT(e.created_at))} · ${esc(lb(L.by, e.by_role))}</small>${e.note ? `<p>${esc(e.note)}</p>` : ''}</div></li>`;
    }).join('');
    const sumRow = (k, v, cls = '') => `<div class="r ${cls}"><span>${esc(k)}</span><b>${v}</b></div>`;
    const timing = o.scheduled_for ? `${esc(SF.fmtDate(o.scheduled_for))} · ${esc(SF.fmtTime(o.scheduled_for))}${o.window_end ? ' ' + esc(t('إلى', 'to')) + ' ' + esc(SF.fmtTime(o.window_end)) : ''}` : esc(t('بأسرع وقت', 'As soon as possible'));
    const acts = [];
    if (live) acts.push(`<button class="btn btn-danger" data-x="cancel">${ic('x', 's')}${esc(t('إلغاء الطلب', 'Cancel order'))}</button>`);
    acts.push(`<button class="btn btn-soft" data-x="force">${ic('refresh', 's')}${esc(t('تغيير الحالة', 'Change status'))}</button>`);
    if (o.pay_method === 'card' && o.pay_status === 'paid') acts.push(`<button class="btn btn-soft" data-x="refund">${ic('wallet', 's')}${esc(t('استرجاع المبلغ', 'Refund'))}</button>`);
    if (!['paid', 'refunded', 'refund_pending'].includes(o.pay_status)) acts.push(`<button class="btn btn-soft" data-x="mark_paid">${ic('check', 's')}${esc(t('تسجيل كمدفوع', 'Mark as paid'))}</button>`);
    acts.push(`<button class="btn btn-soft" data-x="note">${ic('edit', 's')}${esc(t('أضف ملاحظة', 'Add a note'))}</button>`);
    if (o.rating) acts.push(`<button class="btn btn-soft" data-x="${o.review_hidden ? 'show_review' : 'hide_review'}">${ic('eye', 's')}${esc(o.review_hidden ? t('إظهار التقييم', 'Show review') : t('إخفاء التقييم', 'Hide review'))}</button>`);
    acts.push(`<button class="btn btn-ghost" data-x="test">${ic('box', 's')}${esc(o.is_test ? t('شيل علامة التجريبي', 'Unmark as test') : t('علّمه تجريبي', 'Mark as test'))}</button>`);
    ctx.s.body.innerHTML = drHead(
      `${esc(t('طلب', 'Order'))} <span class="ltr">#${esc(o.order_no)}</span>`,
      `${esc(SF.fmtDT(o.created_at))} · ${esc(SF.ago(o.created_at))}`,
      `<span class="dr-badges">${SF.statusBadge(o.status, o.fulfillment)}${o.is_test ? testBadge() : ''}</span>`) + `
      <div class="dr-body">
        ${o.status === 'new' && Date.now() - new Date(o.status_at).getTime() > 5 * 60000 ? `<div class="notice bad">${ic('clock')}<span>${esc(t(`الطلب ينتظر قبول الأسرة ${SF.ago(o.status_at)}`, `Waiting for the kitchen since ${SF.ago(o.status_at)}`))}</span></div>` : ''}
        ${o.cancel_reason && ['cancelled', 'rejected'].includes(o.status) ? `<div class="notice bad">${ic('info')}<span>${esc(t('السبب:', 'Reason:'))} ${esc(o.cancel_reason)} · ${esc(lb(L.by, o.cancelled_by))}</span></div>` : ''}
        <div class="o-grid">
          <section class="dr-sec"><h3>${ic('user')}${esc(t('العميل', 'Customer'))}</h3>
            ${kv([[t('الاسم', 'Name'), esc(o.customer_name || t('عميل', 'Customer'))], [t('الجوال', 'Phone'), phoneCell(o.customer_phone, t(`أهلًا، معك سُفرة بخصوص طلبك رقم ${o.order_no}`, `Hi, this is Sufrah about your order #${o.order_no}`))],
              o.fulfillment === 'delivery' ? [t('العنوان', 'Address'), `${esc([cityName(ad.city_id), ad.district, ad.street, ad.details].filter(Boolean).join('، ') || t('على الخريطة', 'On the map'))}${mapUrl ? ` <a href="${esc(mapUrl)}" target="_blank" rel="noopener" class="mini-link">${ic('pin', 's')}${esc(t('الخريطة', 'Map'))}</a>` : ''}`] : null,
              o.user_id ? [t('حسابه', 'Account'), `<button class="link" data-x="customer">${esc(t('افتح ملف العميل', 'Open customer'))}</button>`] : null])}
          </section>
          <section class="dr-sec"><h3>${ic('store')}${esc(t('الأسرة', 'Kitchen'))}</h3>
            ${kv([[t('المطبخ', 'Kitchen'), `<button class="link" data-open-fam="${esc(o.family_id)}">${esc(famName(o.family_id))}</button>`], [t('الجوال', 'Phone'), phoneCell(ctx.fp.whatsapp || ctx.fp.phone, t(`أهلًا، معك سُفرة بخصوص طلب رقم ${o.order_no}`, `Hi, this is Sufrah about order #${o.order_no}`))],
              [t('الاستلام', 'Fulfilment'), `${esc(lb(L.ful, o.fulfillment))}${o.distance_km ? ` · ${esc(fmtN(o.distance_km, 1))} ${esc(t('كم', 'km'))}` : ''}`], [t('الموعد', 'When'), timing],
              o.ready_eta ? [t('متوقع يجهز', 'Ready by'), esc(SF.fmtTime(o.ready_eta))] : null])}
          </section>
        </div>
        <section class="dr-sec"><h3>${ic('bag')}${esc(t('الأصناف', 'Items'))} <span class="muted small">${esc(cnt(items.reduce((a, x) => a + (+x.qty || 0), 0), 'item'))}</span></h3>
          <ul class="o-items">${items.map((it) => `<li><span class="q">${esc(it.qty)}×</span><div class="grow"><b>${esc(SF.nm(it, 'name'))}</b>${(it.options || []).length ? `<small>${(it.options || []).map((op) => esc(SF.nm(op, 'name'))).join('، ')}</small>` : ''}${it.note ? `<small class="nt">${ic('edit', 's')}${esc(it.note)}</small>` : ''}</div><span class="p">${sarH(it.line_total)}</span></li>`).join('')}</ul>
          ${o.note ? `<div class="notice info">${ic('chat')}<span>${esc(t('ملاحظة العميل:', 'Customer note:'))} ${esc(o.note)}</span></div>` : ''}
        </section>
        <div class="o-grid">
          <section class="dr-sec"><h3>${ic('receipt')}${esc(t('الحساب', 'Totals'))}</h3>
            <div class="sum">
              ${sumRow(t('الأكل', 'Food'), sarH(o.subtotal))}
              ${+o.delivery_fee ? sumRow(t('التوصيل', 'Delivery'), sarH(o.delivery_fee)) : ''}
              ${+o.small_order_fee ? sumRow(t('رسوم الطلب الصغير', 'Small order fee'), sarH(o.small_order_fee)) : ''}
              ${+o.discount ? sumRow(t('الخصم', 'Discount') + (o.promo_code ? ` (${o.promo_code})` : ''), '-' + sarH(o.discount), 'disc') : ''}
              ${+o.credit_used ? sumRow(t('من الرصيد', 'Credit used'), '-' + sarH(o.credit_used), 'disc') : ''}
              ${+o.vat ? sumRow(t('الضريبة', 'VAT'), sarH(o.vat)) : ''}
              ${sumRow(t('الإجمالي', 'Total'), sarH(o.total), 'total')}
            </div>
            <div class="o-split"><div><small>${esc(t('عمولة المنصة', 'Commission'))} · ${esc(fmtN(o.commission_pct))}%</small><b>${sarH(o.commission)}</b></div><div><small>${esc(t('صافي الأسرة', 'Kitchen net'))}</small><b>${sarH(o.family_net)}</b></div></div>
          </section>
          <section class="dr-sec"><h3>${ic('wallet')}${esc(t('الدفع', 'Payment'))}</h3>
            ${kv([[t('الطريقة', 'Method'), esc(o.pay_method === 'cod' ? t('كاش عند الاستلام', 'Cash on delivery') : lb(L.pay, o.pay_method))], [t('الحالة', 'Status'), badge(L.paySt, o.pay_status)],
              +o.paid_amount ? [t('المدفوع', 'Paid'), sarH(o.paid_amount)] : null, +o.refunded_amount ? [t('المسترجع', 'Refunded'), sarH(o.refunded_amount)] : null])}
            ${ctx.pay.length ? `<ul class="o-pays">${ctx.pay.map((p) => `<li><span>${esc(p.provider)}${p.method ? ' · ' + esc(p.method) : ''}</span><span>${sarH(p.amount)}</span><span class="muted small">${esc(p.status)} · ${esc(SF.fmtDT(p.paid_at || p.created_at))}</span></li>`).join('')}</ul>` : ''}
          </section>
        </div>
        ${o.rating ? `<section class="dr-sec"><h3>${ic('star')}${esc(t('التقييم', 'Review'))} ${o.review_hidden ? `<span class="badge b-warn">${esc(t('مخفي', 'Hidden'))}</span>` : ''}</h3>
          <div class="o-review"><span class="stars">${ic('star')}${esc(o.rating)}</span>${o.review ? `<p>${esc(o.review)}</p>` : ''}${o.review_photo ? `<a href="${esc(o.review_photo)}" target="_blank" rel="noopener">${thumb(o.review_photo, 'l')}</a>` : ''}${o.family_reply ? `<p class="muted small">${esc(t('رد الأسرة:', 'Kitchen reply:'))} ${esc(o.family_reply)}</p>` : ''}</div></section>` : ''}
        ${ctx.cmp.length ? `<section class="dr-sec"><h3>${ic('chat')}${esc(t('شكاوى على الطلب', 'Complaints on this order'))}</h3>${ctx.cmp.map((c) => `<button class="o-cmp" data-x="complaint" data-id="${esc(c.id)}">${badge(L.cmpSt, c.status)}<span>${esc(lb(L.cmpKind, c.kind))}</span><small class="muted">${esc(SF.ago(c.created_at))}</small></button>`).join('')}</section>` : ''}
        <section class="dr-sec"><h3>${ic('clock')}${esc(t('سجل الطلب', 'Timeline'))}</h3><ol class="evs">${evRows || `<li><div><small class="muted">${esc(t('ما فيه أحداث', 'No events'))}</small></div></li>`}</ol></section>
      </div>
      <div class="dr-foot o-acts">${acts.join('')}</div>`;
  }
  async function orderAction(ctx, x, btn) {
    const o = ctx.o; if (!o) return;
    const run = (action, note) => SF.busy(btn, async () => {
      try {
        const r = await SF.rpc('sf_admin_order_action', { p_order: o.id, p_action: action, p_note: note || null });
        if (failed(r, 'ما تم الإجراء', 'Action failed')) return;
        SF.toast(t('تم', 'Done'), 'ok');
        await ctx.load();
        if (A.sec === 'orders') loadOrders(true);
        countsSoon();
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
    });
    if (x === 'customer') { if (o.user_id) openCustomer(o.user_id); return; }
    if (x === 'complaint') { openComplaint(btn.dataset.id); return; }
    if (x === 'cancel') {
      const why = await SF.confirm({ title: t(`إلغاء الطلب #${o.order_no}؟`, `Cancel order #${o.order_no}?`), body: t('يوصل العميل والأسرة إشعار بالإلغاء ومعه السبب', 'The customer and the kitchen are notified with the reason'), ok: t('ألغِ الطلب', 'Cancel order'), cancel: t('رجوع', 'Back'), danger: true, input: { placeholder: t('سبب الإلغاء', 'Reason for cancelling'), required: true } });
      if (why) run('cancel', why);
      return;
    }
    if (x === 'force') return forceStatus(ctx, run);
    if (x === 'refund') { if (await SF.confirm({ title: t('استرجاع المبلغ للعميل؟', 'Refund the customer?'), body: t(`يرجع ${sar(o.paid_amount || o.total)} لبطاقة العميل عن طريق بوابة الدفع`, `${sar(o.paid_amount || o.total)} goes back to the card via the payment gateway`), ok: t('استرجع المبلغ', 'Refund'), danger: true })) run('refund'); return; }
    if (x === 'mark_paid') { const note = await SF.confirm({ title: t('تسجيل الطلب كمدفوع؟', 'Mark this order as paid?'), body: t('استخدمه لما يوصلك المبلغ بطريقة ثانية، مثل تحويل', 'Use it when the money arrived another way, like a transfer'), ok: t('سجّل كمدفوع', 'Mark paid'), input: { placeholder: t('ملاحظة (اختياري)', 'Note (optional)') } }); if (note !== null) run('mark_paid', note); return; }
    if (x === 'note') { const note = await SF.confirm({ title: t('ملاحظة على الطلب', 'Note on this order'), body: t('تطلع في سجل الطلب للإدارة', 'Shows in the order timeline for the team'), ok: t('أضف الملاحظة', 'Add note'), input: { placeholder: t('اكتب الملاحظة', 'Write the note'), required: true, requiredMsg: t('اكتب الملاحظة', 'Write the note') } }); if (note) run('note', note); return; }
    if (x === 'hide_review' || x === 'show_review') { run(x); return; }
    if (x === 'test') { if (await SF.confirm({ title: o.is_test ? t('شيل علامة التجريبي؟', 'Unmark as test?') : t('تعليم الطلب كتجريبي؟', 'Mark as a test order?'), body: t('الطلبات التجريبية ما تدخل في المبيعات ولا حساب الأسرة', 'Test orders are left out of sales and kitchen balances'), ok: t('تأكيد', 'Confirm') })) run('test'); }
  }
  function forceStatus(ctx, run) {
    const o = ctx.o;
    const opts = Object.keys(SF.STATUS).filter((k) => k !== o.status && !(o.fulfillment === 'pickup' && (k === 'on_the_way' || k === 'delivered')) && !(o.fulfillment === 'delivery' && k === 'picked_up'));
    const s = formSheet(`${fsHead(t('تغيير حالة الطلب', 'Change order status'), t('للحالات الخاصة بس، والأسرة تغيّر الحالة عادة من تطبيقها', 'For special cases only, kitchens normally do this from their app'))}
      <div class="st-pick">${opts.map((k, i) => `<label class="choice"><input type="radio" name="st" value="${k}" ${i === 0 ? 'checked' : ''}><span class="grow">${SF.statusBadge(k, o.fulfillment)}</span></label>`).join('')}</div>
      <label class="field"><span>${esc(t('ملاحظة (تطلع في سجل الطلب)', 'Note (shows in the timeline)'))}</span><textarea class="textarea" id="fsNote" maxlength="300"></textarea></label>
      <div class="row"><button class="btn btn-primary grow" id="fsGo">${esc(t('غيّر الحالة', 'Change status'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>`);
    s.sh.querySelector('#fsGo').onclick = async () => {
      const st = s.sh.querySelector('input[name="st"]:checked').value;
      const note = s.sh.querySelector('#fsNote').value.trim();
      if (['cancelled', 'rejected'].includes(st) && note.length < 2) { SF.toast(t('اكتب السبب في الملاحظة', 'Write the reason in the note'), 'bad'); return; }
      s.close();
      run('status:' + st, note);
    };
  }

  // ============================================================
  //  3) الأسر
  // ============================================================
  const CUISINES = ['سعودي', 'نجدي', 'حجازي', 'جنوبي', 'شمالي', 'شرقاوي', 'يمني', 'شامي', 'مصري', 'هندي', 'حلويات', 'معجنات', 'مشويات', 'صحي', 'مفرزنات', 'فطور'];
  const FAM_CHIPS = [['all', 'الكل', 'All'], ['active', 'نشطة', 'Active'], ['pending', 'تحت المراجعة', 'Under review'], ['suspended', 'موقوفة', 'Suspended'], ['closed', 'مسكّرة', 'Closed']];
  const settingNum = (k, d) => { const v = parseFloat((A.settingsAll && A.settingsAll[k]) ?? SF.settings[k]); return Number.isFinite(v) ? v : d; };
  const famsSoon = debounce(() => { if (A.sec === 'families') renderFamList(); }, 400);
  function updateFamCache(f) { const i = A.fams.findIndex((x) => x.id === f.id); if (i >= 0) A.fams[i] = f; else A.fams.push(f); indexFams(); }

  V.families = async (el, arg) => {
    const f = A.ff || (A.ff = { st: 'all', q: '' });
    await reloadFams();
    el.innerHTML = head(t('الأسر', 'Kitchens'), t('كل المطابخ في سُفرة، وتقدر تضيف أسرة بنفسك', 'Every kitchen on Sufrah, you can add one yourself'), `<button class="btn btn-primary" data-act="fam-new">${ic('plus', 's')}${esc(t('أسرة جديدة', 'New kitchen'))}</button>`) + `
      <div class="fbar"><div class="fb-search"><span>${ic('search', 's')}</span><input class="input" id="fq" type="search" placeholder="${esc(t('ابحث باسم المطبخ أو الحي أو الرابط', 'Search by name, district or link'))}" value="${esc(f.q)}"></div></div>
      <div class="chips st-chips" id="fchips"></div>
      <div id="flist"></div>
      <div id="fdz"></div>`;
    $('#fq').addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); renderFamList(); }, 250));
    $('#fchips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.st = b.dataset.st; renderFamList(); });
    $('#flist').addEventListener('click', (e) => { const tr = e.target.closest('[data-fam]'); if (tr && !e.target.closest('a')) openFamily(tr.dataset.fam); });
    $('#flist').addEventListener('keydown', (e) => { const tr = e.target.closest('[data-fam]'); if (tr && e.key === 'Enter') openFamily(tr.dataset.fam); });
    renderFamList();
    if (arg && A.famById[arg]) openFamily(arg);
  };
  function renderFamList() {
    const f = A.ff, box = $('#flist'); if (!box || !f) return;
    const counts = { all: A.fams.length };
    A.fams.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    $('#fchips').innerHTML = FAM_CHIPS.map(([v, a, e]) => `<button class="chip ${f.st === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))} <span class="n">${counts[v] || 0}</span></button>`).join('');
    const q = f.q.toLowerCase();
    const defC = settingNum('commission_pct', 12);
    const rows = A.fams.filter((x) => (f.st === 'all' || x.status === f.st) && (!q || [x.name_ar, x.name_en, x.slug, x.district].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || (a.sort - b.sort) || SF.nm(a, 'name').localeCompare(SF.nm(b, 'name'), 'ar'));
    box.innerHTML = rows.length ? `<div class="table-wrap"><table class="t cards fams-t">
      <thead><tr><th>${esc(t('الأسرة', 'Kitchen'))}</th><th>${esc(t('المكان', 'Location'))}</th><th>${esc(t('الحالة', 'Status'))}</th><th>${esc(t('الاستقبال', 'Orders'))}</th><th>${esc(t('التقييم', 'Rating'))}</th><th class="num">${esc(t('طلبات مكتملة', 'Completed'))}</th><th class="num">${esc(t('العمولة', 'Commission'))}</th></tr></thead>
      <tbody>${rows.map((x) => `<tr class="click" data-fam="${esc(x.id)}" tabindex="0">
        <td class="c-nm"><div class="cell-fam">${thumb(x.logo_url)}<div class="grow"><b>${esc(SF.nm(x, 'name'))}</b><small><span class="ltr">${esc(x.slug || '')}</span>${x.featured ? ` <span class="badge b-brand sm">${esc(t('مميزة', 'Featured'))}</span>` : ''}${x.is_demo ? ` <span class="badge sm">${esc(t('تجريبية', 'Demo'))}</span>` : ''}</small></div></div></td>
        <td class="c-city">${esc(cityName(x.city_id))}<small>${esc(x.district || '')}</small></td>
        <td class="c-st">${badge(L.famSt, x.status)}</td>
        <td class="c-open"><span class="open-dot ${x.is_open ? 'on' : ''}">${esc(x.is_open ? t('يستقبل', 'Open') : t('موقف الاستقبال', 'Paused'))}</span></td>
        <td class="c-rt">${+x.rating_count ? `<span class="stars">${ic('star')}${esc(fmtN(x.rating_avg, 1))} <span class="cnt">(${esc(x.rating_count)})</span></span>` : `<span class="muted small">${esc(t('بدون تقييم', 'No ratings'))}</span>`}</td>
        <td class="num c-ord">${fmtN(x.orders_count, 0)}</td>
        <td class="num c-com">${x.commission_pct != null ? `<b>${esc(fmtN(x.commission_pct))}%</b>` : `<span class="muted">${esc(fmtN(defC))}%</span>`}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="box">${empty('store', f.q || f.st !== 'all' ? t('ما فيه أسر بهالفلتر', 'No kitchens match') : t('ما فيه أسر للحين', 'No kitchens yet'), t('أضف أسرة من زر «أسرة جديدة» أو اقبل طلب انضمام', 'Add one with «New kitchen» or approve a join request'))}</div>`;
    const dz = $('#fdz'); if (dz) dz.innerHTML = famDangerZone();
  }
  function famDangerZone() {
    if (!A.owner) return '';
    const n = A.fams.filter((x) => x.is_demo).length;
    return `<section class="dz"><div class="grow"><h3>${ic('alert')}${esc(t('حذف البيانات التجريبية', 'Delete demo data'))}</h3>
      <p>${esc(n ? t(`يمسح ${cnt(n, 'family')} تجريبية مع أطباقها وطلباتها نهائيًا. استخدمه مرة وحدة قبل الإطلاق.`, `Permanently removes ${cnt(n, 'family')} marked as demo, with their dishes and orders. Use it once before launch.`) : t('ما فيه أسر تجريبية', 'There are no demo kitchens'))}</p></div>
      <button class="btn btn-danger" data-act="del-demo" ${n ? '' : 'disabled'}>${ic('trash', 's')}${esc(t('حذف البيانات التجريبية', 'Delete demo data'))}</button></section>`;
  }
  ACT['del-demo'] = async () => {
    if (!A.owner) return;
    const demo = A.fams.filter((x) => x.is_demo);
    if (!demo.length) return;
    const ok1 = await SF.confirm({
      title: t('حذف البيانات التجريبية؟', 'Delete the demo data?'),
      body: t(`بينحذف نهائيًا: ${demo.map((x) => SF.nm(x, 'name')).join('، ')}، مع كل أطباقها وطلباتها. هالخطوة ما ترجع.`, `This permanently deletes ${demo.map((x) => SF.nm(x, 'name')).join(', ')}, with all their dishes and orders. It cannot be undone.`),
      ok: t('كمّل', 'Continue'), danger: true,
    });
    if (!ok1) return;
    const word = t('حذف', 'DELETE');
    const s = formSheet(`${fsHead(t('تأكيد أخير', 'Final confirmation'))}
      <div class="stack">
        <div class="notice bad">${ic('alert')}<span>${esc(t(`اكتب كلمة «${word}» عشان نتأكد إنك تبي تحذف البيانات التجريبية`, `Type ${word} to confirm deleting the demo data`))}</span></div>
        <input class="input" id="dzWord" autocomplete="off" placeholder="${esc(word)}">
        <div class="row"><button class="btn btn-danger grow" id="dzGo" disabled>${ic('trash', 's')}${esc(t('احذف نهائيًا', 'Delete permanently'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>
      </div>`, { sticky: true });
    const inp = s.sh.querySelector('#dzWord'), go = s.sh.querySelector('#dzGo');
    inp.addEventListener('input', () => { go.disabled = inp.value.trim().toUpperCase() !== word.toUpperCase(); });
    go.onclick = () => SF.busy(go, async () => {
      try {
        const r = await SF.rpc('sf_admin_delete_demo');
        if (failed(r, 'ما انحذفت البيانات', 'Nothing was deleted')) return;
        s.close();
        SF.toast(t(`انحذفت ${r.families} أسر و${r.orders} طلب`, `Deleted ${r.families} kitchens and ${r.orders} orders`), 'ok');
        await reloadFams();
        route();
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
    });
  };

  // ───────── إدخال الوسوم (المطبخ، الوسوم) ─────────
  const tagChip = (v) => `<span class="tg" data-v="${esc(v)}">${esc(v)}<button type="button" aria-label="${esc(t('شيل', 'Remove'))}">${ic('x', 's')}</button></span>`;
  const tagInput = (id, values = [], sugg = []) => `<div class="tagin" data-tagin="${id}">${(values || []).map(tagChip).join('')}<input type="text" enterkeyhint="done" placeholder="${esc(t('اكتب واضغط إدخال', 'Type and press Enter'))}" aria-label="${esc(t('أضف', 'Add'))}"></div>${sugg.length ? `<div class="sugg" data-sugg="${id}">${sugg.map((s) => `<button type="button" data-add="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}`;
  const tagVals = (box) => (box ? $$('.tg', box).map((x) => x.dataset.v) : []);
  function addTag(box, v) {
    v = String(v || '').replace(/[,،]/g, ' ').trim().slice(0, 30);
    if (!box || !v) return false;
    const have = tagVals(box);
    if (have.includes(v)) return false;
    if (have.length >= 8) { SF.toast(t('8 بالكثير', 'Up to 8'), 'bad'); return false; }
    box.querySelector('input').insertAdjacentHTML('beforebegin', tagChip(v));
    return true;
  }
  function bindTags(root, onChange) {
    const ch = () => { if (onChange) onChange(); };
    root.addEventListener('click', (e) => {
      const rm = e.target.closest('.tg button'); if (rm) { e.preventDefault(); rm.parentElement.remove(); ch(); return; }
      const add = e.target.closest('[data-add]');
      if (add) { e.preventDefault(); const box = root.querySelector(`[data-tagin="${add.closest('[data-sugg]').dataset.sugg}"]`); if (addTag(box, add.dataset.add)) ch(); }
    });
    root.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.tagin input'); if (!inp) return;
      if (e.key === 'Enter' || e.key === ',' || e.key === '،') { e.preventDefault(); if (addTag(inp.parentElement, inp.value)) ch(); inp.value = ''; }
      else if (e.key === 'Backspace' && !inp.value) { const all = $$('.tg', inp.parentElement); if (all.length) { all[all.length - 1].remove(); ch(); } }
    });
    root.addEventListener('focusout', (e) => { const inp = e.target.closest && e.target.closest('.tagin input'); if (inp && inp.value.trim()) { if (addTag(inp.parentElement, inp.value)) ch(); inp.value = ''; } });
  }
  const phoneInput = (id, val = '', name = '') => `<div class="input-group"><span class="addon">+966</span><input class="input" ${id ? `id="${id}"` : ''} ${name ? `name="${name}" data-t="phone"` : ''} type="tel" inputmode="numeric" autocomplete="off" placeholder="05XXXXXXXX" dir="ltr" maxlength="14" value="${esc(val ? SF.showPhone(val) : '')}"></div>`;
  const sfx = (inner, unit) => `<div class="input-sfx">${inner}<span class="sfx">${esc(unit)}</span></div>`;
  const U = { sar: () => t('ر.س', 'SAR'), min: () => t('دقيقة', 'min'), km: () => t('كم', 'km'), pct: () => '%', h: () => t('ساعة', 'hours'), d: () => t('يوم', 'days') };

  // ───────── أسرة جديدة ─────────
  ACT['fam-new'] = () => famCreate();
  function famCreate() {
    const defC = settingNum('commission_pct', 12);
    let status = 'active';
    const s = formSheet(`${fsHead(t('أسرة جديدة', 'New kitchen'), t('تنضاف الأسرة مع صاحبها، ويقدر يدخل تطبيق الأسرة برقمه', 'The owner can sign in to the kitchen app with this number'))}
      <form class="stack" id="fcForm" autocomplete="off" novalidate>
        <div class="fgrid">
          ${field(t('اسم المطبخ بالعربي', 'Kitchen name in Arabic'), `<input class="input" name="name_ar" maxlength="60" required dir="rtl">`)}
          ${field(t('اسم المطبخ بالإنجليزي', 'Kitchen name in English'), `<input class="input" name="name_en" maxlength="60" dir="ltr">`, t('اختياري', 'Optional'))}
          ${field(t('اسم صاحب المطبخ', 'Owner name'), `<input class="input" name="owner_name" maxlength="60" required>`)}
          ${field(t('جوال صاحب المطبخ', 'Owner mobile'), phoneInput('fcPhone'))}
          ${field(t('المدينة', 'City'), `<select class="select" name="city_id">${cityOptions('', true)}</select>`)}
          ${field(t('الحي', 'District'), `<input class="input" name="district" maxlength="60">`)}
          ${field(t('نبذة عن المطبخ', 'About the kitchen'), `<textarea class="textarea" name="bio_ar" maxlength="400" dir="rtl" placeholder="${esc(t('وش يميز أكلهم؟', 'What makes their food special?'))}"></textarea>`, '', 'full')}
          ${field(t('نوع الأكل', 'Cuisine'), tagInput('fc_cuisines', [], CUISINES), '', 'full')}
          ${field(t('عمولة خاصة', 'Custom commission'), sfx(`<input class="input" name="commission_pct" inputmode="decimal" placeholder="${esc(fmtN(defC))}">`, '%'), t(`فاضي = العمولة العامة ${fmtN(defC)}%`, `Empty = default ${fmtN(defC)}%`))}
          ${field(t('رابط مختصر', 'Short link'), `<div class="input-group"><span class="addon">?f=</span><input class="input" name="slug" maxlength="30" dir="ltr" placeholder="umfahad"></div>`, t('اختياري، حروف إنجليزية صغيرة وأرقام', 'Optional, lowercase letters and numbers'))}
        </div>
        <div class="field"><span>${esc(t('الحالة', 'Status'))}</span>
          <div class="seg" id="fcSt"><button type="button" class="is-active" data-v="active">${esc(t('نشطة الحين', 'Active now'))}</button><button type="button" data-v="pending">${esc(t('تحت المراجعة', 'Under review'))}</button></div>
          <small class="hint">${esc(t('النشطة تطلع للعملاء على طول، واللي تحت المراجعة تجهز منيوها أول', 'Active kitchens show to customers right away, kitchens under review set up their menu first'))}</small></div>
        <div class="row"><button class="btn btn-primary btn-lg grow" id="fcGo" type="submit">${ic('plus', 's')}${esc(t('أضف الأسرة', 'Add kitchen'))}</button><button class="btn btn-ghost" type="button" data-close>${esc(t('رجوع', 'Back'))}</button></div>
      </form>`);
    const form = s.sh.querySelector('#fcForm');
    bindTags(form);
    s.sh.querySelector('#fcSt').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; status = b.dataset.v; $$('#fcSt button', s.sh).forEach((x) => x.classList.toggle('is-active', x === b)); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = (k) => String(fd.get(k) || '').trim();
      const phone = SF.normPhone(s.sh.querySelector('#fcPhone').value);
      const slug = v('slug').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const comm = numOf(v('commission_pct'));
      const bad = (msg, sel) => { SF.toast(msg, 'bad'); const el = sel && form.querySelector(sel); if (el) { el.classList.add('is-bad'); el.focus(); } };
      $$('.is-bad', form).forEach((x) => x.classList.remove('is-bad'));
      if (v('name_ar').length < 2) return bad(t('اكتب اسم المطبخ', 'Enter the kitchen name'), '[name="name_ar"]');
      if (v('owner_name').length < 2) return bad(t('اكتب اسم صاحب المطبخ', 'Enter the owner name'), '[name="owner_name"]');
      if (!phone) return bad(t('اكتب جوال سعودي صحيح يبدأ بـ 05', 'Enter a valid Saudi mobile starting with 05'), '#fcPhone');
      if (A.staff.some((x) => x.phone === phone)) return bad(t('الرقم مسجل في حساب ثاني في سُفرة', 'This number already belongs to another Sufrah account'), '#fcPhone');
      if (!v('city_id')) return bad(t('اختر المدينة', 'Choose a city'), '[name="city_id"]');
      if (slug && (slug.length < 3 || A.fams.some((x) => x.slug === slug))) return bad(slug.length < 3 ? t('الرابط قصير، 3 حروف بالقليل', 'The link needs at least 3 characters') : t('الرابط مستخدم لأسرة ثانية', 'This link is taken'), '[name="slug"]');
      if (comm != null && (comm < 0 || comm > 100)) return bad(t('العمولة بين 0 و 100', 'Commission must be between 0 and 100'), '[name="commission_pct"]');
      const p = { name_ar: v('name_ar'), name_en: v('name_en') || null, owner_name: v('owner_name'), owner_phone: phone, city_id: v('city_id'), district: v('district') || null,
        bio_ar: v('bio_ar') || null, cuisines: tagVals(form.querySelector('[data-tagin="fc_cuisines"]')), commission_pct: comm, status };
      if (slug) p.slug = slug;
      SF.busy(s.sh.querySelector('#fcGo'), async () => {
        try {
          const r = await SF.rpc('sf_admin_family_create', { p });
          if (failed(r, 'ما انضافت الأسرة', 'The kitchen was not added')) return;
          s.close();
          SF.toast(t('انضافت الأسرة', 'Kitchen added'), 'ok');
          await Promise.all([reloadFams(), reloadStaff()]);
          if (A.sec === 'families') renderFamList();
          openFamily(r.id);
        } catch (e2) { SF.toast(e2.raw && e2.raw.code === '23505' ? t('الرابط مستخدم، اختر رابط ثاني', 'That link is taken, pick another') : errMsg(e2), 'bad'); }
      });
    });
  }

  // ───────── لوح الأسرة بتبويباته ─────────
  const FAM_TABS = [['info', 'البيانات', 'Details'], ['private', 'الخاص', 'Private'], ['menu', 'المنيو', 'Menu'], ['docs', 'الوثائق', 'Documents'], ['staff', 'الطاقم', 'Staff'], ['money', 'المالية', 'Finance']];
  const DOW = [['الأحد', 'Sun'], ['الاثنين', 'Mon'], ['الثلاثاء', 'Tue'], ['الأربعاء', 'Wed'], ['الخميس', 'Thu'], ['الجمعة', 'Fri'], ['السبت', 'Sat']];
  const minTxt = (m) => { const h = Math.floor(m / 60) % 24, mm = m % 60; const am = h < 12; const h12 = h % 12 || 12; return `${h12}:${String(mm).padStart(2, '0')} ${am ? t('ص', 'AM') : t('م', 'PM')}`; };
  function hoursSummary(hours) {
    if (!hours.length) return t('ما فيه دوام محدد', 'No working hours set');
    const byDay = DOW.map((_, d) => hours.filter((h) => h.dow === d).map((h) => `${minTxt(h.open_min)} ${t('إلى', 'to')} ${minTxt(h.close_min)}`).join('، '));
    if (byDay.every((x) => x && x === byDay[0])) return `${t('كل يوم', 'Every day')}: ${byDay[0]}`;
    return byDay.map((x, d) => `${t(DOW[d][0], DOW[d][1])}: ${x || t('مسكّر', 'closed')}`).join(' · ');
  }
  async function openFamily(id, tab = 'info') {
    const ctx = { id, tab };
    const s = drawer(drLoading(), { wide: true, onClose: () => { if (ctx.map) { try { ctx.map.remove(); } catch (e) { /* */ } ctx.map = null; } } });
    ctx.s = s;
    s.sh.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) famAction(ctx, b.dataset.x, b, e); });
    s.sh.addEventListener('change', (e) => famChange(ctx, e));
    s.sh.addEventListener('input', (e) => { if (e.target.closest('#famForm,#privForm')) famDirty(ctx); });
    try {
      const [f, p, h] = await Promise.all([
        db().from('sf_families').select('*').eq('id', id).maybeSingle(),
        db().from('sf_family_private').select('*').eq('family_id', id).maybeSingle(),
        db().from('sf_family_hours').select('dow,open_min,close_min').eq('family_id', id).order('dow').order('open_min'),
      ]);
      ctx.f = need(f); ctx.p = need(p) || { family_id: id }; ctx.hours = need(h) || [];
      if (!ctx.f) { s.body.innerHTML = drHead(esc(t('الأسرة', 'Kitchen'))) + `<div class="dr-body">${empty('store', t('الأسرة غير موجودة', 'Kitchen not found'))}</div>`; return; }
      renderFam(ctx);
    } catch (e) { s.body.innerHTML = drHead(esc(t('الأسرة', 'Kitchen'))) + `<div class="dr-body">${errBox(e)}</div>`; }
  }
  function renderFam(ctx) {
    const f = ctx.f;
    const quick = f.status === 'active' ? '' : `<button class="btn ${f.status === 'pending' ? 'btn-ok' : 'btn-soft'} btn-sm" data-x="activate">${ic('check', 's')}${esc(f.status === 'pending' ? t('فعّل الأسرة', 'Activate') : t('إعادة التفعيل', 'Reactivate'))}</button>`;
    const pub = f.status === 'active' && f.slug ? `<a class="btn btn-ghost btn-sm" href="index.html?f=${encodeURIComponent(f.slug)}" target="_blank" rel="noopener">${ic('eye', 's')}<span class="hide-s">${esc(t('صفحتها', 'Public page'))}</span></a>` : '';
    ctx.s.body.innerHTML = drHead(
      `<span class="fam-ttl">${thumb(f.logo_url, 'sm')}<span class="ellipsis">${esc(SF.nm(f, 'name'))}</span></span>`,
      `${badge(L.famSt, f.status)}${f.is_demo ? ` <span class="badge">${esc(t('تجريبية', 'Demo'))}</span>` : ''}${f.featured ? ` <span class="badge b-brand">${esc(t('مميزة', 'Featured'))}</span>` : ''} <span>${esc(cityName(f.city_id))}${f.district ? ' · ' + esc(f.district) : ''}</span>`,
      `<span class="dr-quick">${quick}${pub}</span>`,
      `<div class="dr-tabs" role="tablist">${FAM_TABS.map(([k, a, e]) => `<button type="button" role="tab" data-x="tab" data-tab="${k}" class="${ctx.tab === k ? 'is-active' : ''}">${esc(t(a, e))}</button>`).join('')}</div>`) + `<div class="dr-body" id="famBody"></div>`;
    famTab(ctx);
  }
  async function famTab(ctx) {
    if (ctx.map) { try { ctx.map.remove(); } catch (e) { /* */ } ctx.map = null; }
    const body = ctx.s.body.querySelector('#famBody'); if (!body) return;
    $$('.dr-tabs [data-tab]', ctx.s.body).forEach((b) => b.classList.toggle('is-active', b.dataset.tab === ctx.tab));
    body.innerHTML = skel(2);
    ctx.s.sh.scrollTop = 0;
    const fn = { info: famInfo, private: famPrivate, menu: famMenu, docs: famDocs, staff: famStaff, money: famMoney }[ctx.tab] || famInfo;
    try { await fn(ctx, body); } catch (e) { console.error(e); body.innerHTML = errBox(e); }
  }
  const coverBox = (url) => `<span class="cover-pv">${ic('image', 'l')}${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  const tierRow = (km = '', fee = '') => `<div class="tier"><span>${esc(t('لحد', 'Up to'))}</span>${sfx(`<input class="input" data-tier="km" inputmode="decimal" value="${esc(km)}" aria-label="${esc(t('المسافة', 'Distance'))}">`, U.km())}<span>${esc(t('الرسوم', 'Fee'))}</span>${sfx(`<input class="input" data-tier="fee" inputmode="decimal" value="${esc(fee)}" aria-label="${esc(t('الرسوم', 'Fee'))}">`, U.sar())}<button type="button" class="icon-btn" data-x="tier-del" aria-label="${esc(t('شيل', 'Remove'))}">${ic('trash', 's')}</button></div>`;
  function famInfo(ctx, body) {
    const f = ctx.f, defC = settingNum('commission_pct', 12);
    body.innerHTML = `
      <form class="stack l" id="famForm" autocomplete="off" novalidate>
        <section class="fsec"><h4>${ic('image')}${esc(t('الصور', 'Photos'))}</h4>
          <div class="img-row">
            <div class="img-pick">${thumb(f.logo_url, 'xl')}<label class="btn btn-soft btn-sm">${ic('camera', 's')}${esc(t('الشعار', 'Logo'))}<input type="file" accept="image/*" data-img="logo_url" hidden></label></div>
            <div class="img-pick wide">${coverBox(f.cover_url)}<label class="btn btn-soft btn-sm">${ic('camera', 's')}${esc(t('صورة الغلاف', 'Cover photo'))}<input type="file" accept="image/*" data-img="cover_url" hidden></label></div>
          </div>
        </section>
        <section class="fsec"><h4>${ic('store')}${esc(t('الاسم والنبذة', 'Name and bio'))}</h4>
          <div class="fgrid">
            ${field(t('الاسم بالعربي', 'Name in Arabic'), `<input class="input" name="name_ar" data-t="text" value="${esc(f.name_ar)}" maxlength="60" dir="rtl">`)}
            ${field(t('الاسم بالإنجليزي', 'Name in English'), `<input class="input" name="name_en" data-t="text" value="${esc(f.name_en || '')}" maxlength="60" dir="ltr">`)}
            ${field(t('النبذة بالعربي', 'Bio in Arabic'), `<textarea class="textarea" name="bio_ar" data-t="text" maxlength="400" dir="rtl">${esc(f.bio_ar || '')}</textarea>`, '', 'full')}
            ${field(t('النبذة بالإنجليزي', 'Bio in English'), `<textarea class="textarea" name="bio_en" data-t="text" maxlength="400" dir="ltr">${esc(f.bio_en || '')}</textarea>`, '', 'full')}
            ${field(t('رابط الأسرة', 'Kitchen link'), `<div class="input-group"><span class="addon">?f=</span><input class="input" name="slug" data-t="slug" value="${esc(f.slug || '')}" dir="ltr" maxlength="30"></div>`, t('حروف إنجليزية صغيرة وأرقام، ولو تغيّر يتغير رابط مشاركتها', 'Lowercase letters and numbers, changing it changes her share link'), 'full')}
          </div>
        </section>
        <section class="fsec"><h4>${ic('eye')}${esc(t('الحالة والظهور', 'Status and visibility'))}</h4>
          <div class="seg seg-wrap" data-seg="status">${['active', 'pending', 'suspended', 'closed'].map((k) => `<button type="button" data-x="seg" data-v="${k}" class="${f.status === k ? 'is-active' : ''}">${esc(lb(L.famSt, k))}</button>`).join('')}</div>
          <input type="hidden" name="status" data-t="text" value="${esc(f.status)}">
          ${srow(t('تستقبل طلبات الحين', 'Taking orders now'), t('نفس زر الاستقبال اللي في تطبيق الأسرة', 'Same as the switch in the kitchen app'), sw('is_open', f.is_open, 'data-t="bool"'))}
          ${srow(t('مميزة في الرئيسية', 'Featured on home'), t('تطلع في «مختارات لك»', 'Shows in the featured row'), sw('featured', f.featured, 'data-t="bool"'))}
          ${srow(t('أسرة تجريبية', 'Demo kitchen'), t('تنحذف مع زر حذف البيانات التجريبية', 'Removed by the delete demo data button'), sw('is_demo', f.is_demo, 'data-t="bool"'))}
          <div class="fgrid">
            ${field(t('الترتيب', 'Sort order'), `<input class="input" name="sort" data-t="int" inputmode="numeric" value="${esc(f.sort)}">`, t('الرقم الأصغر يطلع أول', 'Smaller numbers show first'))}
            ${field(t('عمولة خاصة', 'Custom commission'), sfx(`<input class="input" name="commission_pct" data-t="numnull" inputmode="decimal" value="${esc(f.commission_pct ?? '')}" placeholder="${esc(fmtN(defC))}">`, '%'), t(`فاضي = العمولة العامة ${fmtN(defC)}%`, `Empty = default ${fmtN(defC)}%`))}
          </div>
        </section>
        <section class="fsec"><h4>${ic('pin')}${esc(t('المكان', 'Location'))}</h4>
          <div class="fgrid">
            ${field(t('المدينة', 'City'), `<select class="select" name="city_id" data-t="text">${cityOptions(f.city_id, false)}</select>`)}
            ${field(t('الحي', 'District'), `<input class="input" name="district" data-t="text" value="${esc(f.district || '')}" maxlength="60">`)}
          </div>
        </section>
        <section class="fsec"><h4>${ic('clock')}${esc(t('التجهيز والسعة', 'Prep and capacity'))}</h4>
          <div class="fgrid">
            ${field(t('وقت التجهيز', 'Prep time'), sfx(`<input class="input" name="prep_min" data-t="int" inputmode="numeric" value="${esc(f.prep_min)}">`, U.min()))}
            ${field(t('أقل طلب', 'Minimum order'), sfx(`<input class="input" name="min_order" data-t="num" inputmode="decimal" value="${esc(f.min_order)}">`, U.sar()))}
            ${field(t('طلبات بكل فترة', 'Orders per time slot'), `<input class="input" name="slot_capacity" data-t="int" inputmode="numeric" value="${esc(f.slot_capacity)}">`, t('كم طلب تقدر تجهز في الفترة الوحدة', 'How many orders fit in one time slot'))}
            ${field(t('طلبات باليوم', 'Orders per day'), `<input class="input" name="daily_capacity" data-t="int" inputmode="numeric" value="${esc(f.daily_capacity)}">`)}
            ${field(t('الحجز المسبق', 'Booking ahead'), sfx(`<input class="input" name="preorder_days" data-t="int" inputmode="numeric" value="${esc(f.preorder_days)}">`, U.d()), t('كم يوم قدام يقدر العميل يحجز', 'How many days ahead customers can book'))}
          </div>
          <p class="hours-line">${ic('calendar', 's')}<span><b>${esc(t('الدوام', 'Hours'))}:</b> ${esc(hoursSummary(ctx.hours))}</span></p>
        </section>
        <section class="fsec"><h4>${ic('bike')}${esc(t('الاستلام والتوصيل', 'Pickup and delivery'))}</h4>
          ${srow(t('استلام من المطبخ', 'Pickup from the kitchen'), '', sw('pickup_enabled', f.pickup_enabled, 'data-t="bool"'))}
          ${srow(t('توصيل من الأسرة', 'Delivery by the kitchen'), '', sw('delivery_enabled', f.delivery_enabled, 'data-t="bool"'))}
          <div class="fgrid">${field(t('أبعد مسافة توصيل', 'Max delivery distance'), sfx(`<input class="input" name="delivery_max_km" data-t="num" inputmode="decimal" value="${esc(f.delivery_max_km)}">`, U.km()))}</div>
          <div class="tiers" id="tiers"><div class="tiers-h"><b>${esc(t('رسوم التوصيل حسب المسافة', 'Delivery fee by distance'))}</b><button type="button" class="btn btn-ghost btn-sm" data-x="tier-add">${ic('plus', 's')}${esc(t('أضف', 'Add'))}</button></div>
            ${(f.delivery_tiers || []).map((x) => tierRow(x.km, x.fee)).join('')}</div>
        </section>
        <section class="fsec"><h4>${ic('tag')}${esc(t('المطبخ والوسوم', 'Cuisine and tags'))}</h4>
          ${field(t('نوع الأكل', 'Cuisine'), tagInput('cuisines', f.cuisines, CUISINES))}
          ${field(t('وسوم', 'Tags'), tagInput('tags', f.tags), t('كلمات قصيرة مثل: عزايم، طبخ يومي', 'Short words, for example: feasts, daily cooking'))}
        </section>
        <section class="fsec"><h4>${ic('chart')}${esc(t('أرقامها', 'Her numbers'))}</h4>
          <div class="mini-stats">
            <div><small>${esc(t('التقييم', 'Rating'))}</small><b>${+f.rating_count ? `${ic('star', 's')} ${esc(fmtN(f.rating_avg, 1))}` : '0'}</b><small>${esc(t(`${fmtN(f.rating_count, 0)} تقييم`, `${fmtN(f.rating_count, 0)} ratings`))}</small></div>
            <div><small>${esc(t('طلبات مكتملة', 'Completed orders'))}</small><b>${fmtN(f.orders_count, 0)}</b></div>
            <div><small>${esc(t('انضمت', 'Joined'))}</small><b class="sm">${esc(dShort(f.created_at))}</b><small>${esc(new Date(f.created_at).getFullYear())}</small></div>
          </div>
        </section>
        ${A.owner ? `<section class="dz sm"><div class="grow"><h3>${ic('trash')}${esc(t('حذف الأسرة', 'Delete kitchen'))}</h3><p>${esc(t('يمسح الأسرة وأطباقها وطاقمها نهائيًا، وينفع بس لو ما عليها أي طلب. لو عليها طلبات خلها «مسكّرة».', 'Permanently removes the kitchen, its dishes and staff. Only possible with no orders, otherwise set it to Closed.'))}</p></div><button type="button" class="btn btn-danger btn-sm" data-x="fam-delete">${esc(t('حذف', 'Delete'))}</button></section>` : ''}
        <div class="dr-foot"><span class="dirty-note" id="famDirtyNote">${esc(t('ما فيه تعديلات', 'No changes'))}</span><button type="button" class="btn btn-ghost" data-x="info-reset" hidden id="famReset">${esc(t('تراجع', 'Undo'))}</button><button type="button" class="btn btn-primary" data-x="save-info" id="famSave" disabled>${ic('check', 's')}${esc(t('حفظ التعديلات', 'Save changes'))}</button></div>
      </form>`;
    bindTags(body.querySelector('#famForm'), () => famDirty(ctx));
  }
  function readFamForm(form) {
    const out = {};
    $$('[name][data-t]', form).forEach((el) => {
      const ty = el.dataset.t;
      let v;
      if (ty === 'bool') v = el.checked;
      else if (ty === 'int') { const n = numOf(el.value); v = n == null ? null : Math.round(n); }
      else if (ty === 'num' || ty === 'numnull') v = numOf(el.value);
      else if (ty === 'slug') v = el.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null;
      else if (ty === 'phone') v = el.value.trim() ? SF.normPhone(el.value) || '!bad' : null;
      else v = el.value.trim() || null;
      out[el.name] = v;
    });
    if (form.querySelector('[data-tagin="cuisines"]')) {
      out.cuisines = tagVals(form.querySelector('[data-tagin="cuisines"]'));
      out.tags = tagVals(form.querySelector('[data-tagin="tags"]'));
      out.delivery_tiers = $$('.tier', form).map((r) => ({ km: numOf(r.querySelector('[data-tier="km"]').value), fee: numOf(r.querySelector('[data-tier="fee"]').value) }))
        .filter((x) => x.km != null || x.fee != null).sort((a, b) => (a.km || 0) - (b.km || 0));
    }
    return out;
  }
  function diffOf(cur, next) {
    const patch = {};
    const norm = (v) => (v === undefined || v === '' ? null : v);
    for (const [k, v] of Object.entries(next)) {
      const c = cur[k];
      let same;
      if (k === 'delivery_tiers') same = JSON.stringify((v || []).map((x) => [+x.km, +x.fee])) === JSON.stringify((c || []).map((x) => [+x.km, +x.fee]));
      else if (Array.isArray(v)) same = JSON.stringify(v) === JSON.stringify(c || []);
      else if (typeof v === 'number') same = c != null && c !== '' && +c === v;
      else if (typeof v === 'boolean') same = !!c === v;
      else same = norm(v) === norm(c);
      if (!same) patch[k] = v;
    }
    return patch;
  }
  function famDirty(ctx) {
    const form = ctx.s.sh.querySelector('#famForm') || ctx.s.sh.querySelector('#privForm');
    if (!form) return;
    let patch;
    if (form.id === 'famForm') patch = diffOf(ctx.f, readFamForm(form));
    else { patch = diffOf(ctx.p, readFamForm(form)); if (ctx.llNew) { patch.lat = ctx.llNew[0]; patch.lng = ctx.llNew[1]; } }
    const n = Object.keys(patch).length;
    const save = form.querySelector('[data-x^="save-"]'), note = form.querySelector('.dirty-note'), reset = form.querySelector('[data-x$="-reset"]');
    if (save) save.disabled = !n;
    if (reset) reset.hidden = !n;
    if (note) { note.textContent = n ? t(`عندك ${n === 1 ? 'تعديل واحد' : n === 2 ? 'تعديلين' : n + ' تعديلات'} ما انحفظت`, `${n} unsaved change${n === 1 ? '' : 's'}`) : t('ما فيه تعديلات', 'No changes'); note.classList.toggle('on', !!n); }
    return patch;
  }
  function validFam(p, ctx) {
    const rng = (k, lo, hi, ar, en) => (p[k] !== undefined && (p[k] == null || p[k] < lo || p[k] > hi) ? t(ar, en) : null);
    return (p.name_ar !== undefined && String(p.name_ar || '').length < 2 && t('اكتب اسم المطبخ بالعربي', 'Enter the Arabic name'))
      || (p.slug !== undefined && p.slug && (p.slug.length < 3 || A.fams.some((x) => x.slug === p.slug && x.id !== ctx.id)) && (p.slug.length < 3 ? t('الرابط قصير، 3 حروف بالقليل', 'The link needs at least 3 characters') : t('الرابط مستخدم لأسرة ثانية', 'This link is taken')))
      || (p.slug !== undefined && !p.slug && t('الرابط ما يصير فاضي', 'The link cannot be empty'))
      || rng('prep_min', 5, 1440, 'وقت التجهيز من 5 إلى 1440 دقيقة', 'Prep time must be 5 to 1440 minutes')
      || rng('min_order', 0, 100000, 'أقل طلب لازم يكون رقم', 'Minimum order must be a number')
      || rng('slot_capacity', 1, 200, 'طلبات الفترة من 1 إلى 200', 'Orders per slot must be 1 to 200')
      || rng('daily_capacity', 1, 2000, 'طلبات اليوم من 1 إلى 2000', 'Orders per day must be 1 to 2000')
      || rng('preorder_days', 0, 30, 'الحجز المسبق من 0 إلى 30 يوم', 'Booking ahead must be 0 to 30 days')
      || rng('delivery_max_km', 0.5, 100, 'المسافة لازم تكون رقم', 'Distance must be a number')
      || (p.sort !== undefined && p.sort == null && t('الترتيب لازم يكون رقم', 'Sort order must be a number'))
      || (p.commission_pct != null && (p.commission_pct < 0 || p.commission_pct > 100) && t('العمولة بين 0 و 100', 'Commission must be between 0 and 100'))
      || (p.delivery_tiers && p.delivery_tiers.some((x) => x.km == null || x.fee == null || x.km <= 0 || x.fee < 0) && t('كمّل رسوم التوصيل: المسافة والرسوم أرقام', 'Complete the delivery fees: distance and fee must be numbers'))
      || null;
  }
  async function saveFamInfo(ctx, btn) {
    const patch = famDirty(ctx) || {};
    if (!Object.keys(patch).length) return;
    const err = validFam(patch, ctx);
    if (err) { SF.toast(err, 'bad'); return; }
    await SF.busy(btn, async () => {
      try {
        const r = await db().from('sf_families').update(patch).eq('id', ctx.id).select('*').maybeSingle();
        const f = need(r);
        if (!f) throw new Error('not saved');
        ctx.f = f; updateFamCache(f);
        logUi(patch.status ? 'family_status' : 'family_edit', ctx.id, { fields: Object.keys(patch), status: patch.status || undefined });
        SF.toast(t('انحفظت التعديلات', 'Changes saved'), 'ok');
        renderFam(ctx);
        if (A.sec === 'families') renderFamList();
      } catch (e) { SF.toast(e.raw && e.raw.code === '23505' ? t('الرابط مستخدم لأسرة ثانية', 'This link is taken') : errMsg(e), 'bad'); }
    });
  }

  // البيانات الخاصة: الجوال والآيبان والموقع
  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6" fill="#fff" stroke="none"/></svg>';
  function famPrivate(ctx, body) {
    const p = ctx.p;
    ctx.llNew = null;
    const has = p.lat != null && p.lng != null;
    body.innerHTML = `
      <form class="stack l" id="privForm" autocomplete="off" novalidate>
        <div class="notice info">${ic('lock')}<span>${esc(t('هذي البيانات ما تطلع للعملاء. الجوال والموقع يوصلون للعميل بس بعد ما تقبل الأسرة طلبه.', 'Customers never see this. Phone and location reach a customer only after the kitchen accepts the order.'))}</span></div>
        <section class="fsec"><h4>${ic('user')}${esc(t('صاحب المطبخ', 'Owner'))}</h4>
          <div class="fgrid">
            ${field(t('الاسم', 'Name'), `<input class="input" name="owner_name" data-t="text" value="${esc(p.owner_name || '')}" maxlength="80">`)}
            ${field(t('رقم الهوية', 'National ID'), `<input class="input" name="national_id" data-t="text" value="${esc(p.national_id || '')}" maxlength="20" dir="ltr" inputmode="numeric">`)}
            ${field(t('جوال المطبخ', 'Kitchen phone'), phoneInput('', p.phone, 'phone'))}
            ${field(t('واتساب', 'WhatsApp'), phoneInput('', p.whatsapp, 'whatsapp'), t('فاضي = نفس الجوال', 'Empty = same as phone'))}
          </div>
        </section>
        <section class="fsec"><h4>${ic('wallet')}${esc(t('الحساب البنكي', 'Bank account'))}</h4>
          <div class="fgrid">
            ${field(t('الآيبان', 'IBAN'), `<input class="input mono" name="iban" data-t="text" value="${esc(p.iban || '')}" maxlength="34" dir="ltr" placeholder="SA0000000000000000000000">`)}
            ${field(t('اسم صاحب الحساب', 'Account holder'), `<input class="input" name="iban_name" data-t="text" value="${esc(p.iban_name || '')}" maxlength="80">`)}
          </div>
        </section>
        <section class="fsec"><h4>${ic('pin')}${esc(t('موقع المطبخ', 'Kitchen location'))}</h4>
          <p class="muted small">${esc(t('حرّك الخريطة لين يصير الدبوس على المطبخ. يستخدم لحساب مسافة التوصيل.', 'Move the map until the pin sits on the kitchen. It is used for delivery distance.'))}</p>
          <div class="map-box" id="famMap"><div class="pin">${PIN_SVG}</div><div class="map-wait">${ic('pin', 'l')}</div></div>
          <div class="row wrap map-meta"><span class="ltr small muted" id="llTxt">${has ? `${(+p.lat).toFixed(5)}, ${(+p.lng).toFixed(5)}` : esc(t('ما تحدد الموقع للحين', 'Location not set yet'))}</span>${has ? `<a class="mini-link" href="https://maps.google.com/?q=${+p.lat},${+p.lng}" target="_blank" rel="noopener">${ic('nav', 's')}${esc(t('افتح في الخرائط', 'Open in Maps'))}</a>` : ''}</div>
          ${field(t('العنوان المكتوب', 'Written address'), `<input class="input" name="address_text" data-t="text" value="${esc(p.address_text || '')}" maxlength="200">`)}
        </section>
        <section class="fsec"><h4>${ic('edit')}${esc(t('ملاحظة الإدارة', 'Team note'))}</h4>
          ${field(t('ملاحظة', 'Note'), `<textarea class="textarea" name="admin_note" data-t="text" maxlength="1000">${esc(p.admin_note || '')}</textarea>`, t('تنحفظ مع بيانات الأسرة الخاصة', 'Saved with the private kitchen data'))}
        </section>
        <div class="dr-foot"><span class="dirty-note">${esc(t('ما فيه تعديلات', 'No changes'))}</span><button type="button" class="btn btn-ghost" data-x="priv-reset" hidden>${esc(t('تراجع', 'Undo'))}</button><button type="button" class="btn btn-primary" data-x="save-priv" disabled>${ic('check', 's')}${esc(t('حفظ', 'Save'))}</button></div>
      </form>`;
    initFamMap(ctx);
  }
  async function loadLeaflet() {
    if (window.L && window.L.map) return window.L;
    if (!document.querySelector('link[data-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; l.dataset.leaflet = '1'; document.head.appendChild(l); }
    if (!loadLeaflet.p) loadLeaflet.p = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s); });
    return loadLeaflet.p;
  }
  async function initFamMap(ctx) {
    const el = ctx.s.sh.querySelector('#famMap'); if (!el) return;
    try {
      const Lf = await loadLeaflet();
      if (!el.isConnected) return;
      const p = ctx.p, c = A.cities.find((x) => x.id === ctx.f.city_id);
      const has = p.lat != null && p.lng != null;
      const center = has ? [+p.lat, +p.lng] : c && c.lat ? [+c.lat, +c.lng] : [26.2794, 50.2083];
      const map = Lf.map(el, { zoomControl: true, attributionControl: true }).setView(center, has ? 16 : 12);
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      ctx.map = map;
      el.classList.add('ready');
      map.on('moveend', () => {
        if (!ctx.mapArmed) return;
        const m = map.getCenter();
        ctx.llNew = [Math.round(m.lat * 1e6) / 1e6, Math.round(m.lng * 1e6) / 1e6];
        const tx = ctx.s.sh.querySelector('#llTxt'); if (tx) tx.textContent = `${ctx.llNew[0].toFixed(5)}, ${ctx.llNew[1].toFixed(5)}`;
        famDirty(ctx);
      });
      setTimeout(() => { map.invalidateSize(); ctx.mapArmed = true; }, 350);
    } catch (e) { el.innerHTML = `<div class="map-wait">${esc(t('ما قدرنا نحمّل الخريطة', 'Could not load the map'))}</div>`; }
  }
  async function saveFamPrivate(ctx, btn) {
    const patch = famDirty(ctx) || {};
    if (!Object.keys(patch).length) return;
    if (patch.phone === '!bad' || patch.whatsapp === '!bad') { SF.toast(t('اكتب جوال سعودي صحيح يبدأ بـ 05', 'Enter a valid Saudi mobile starting with 05'), 'bad'); return; }
    if (patch.iban) { patch.iban = patch.iban.toUpperCase().replace(/\s/g, ''); if (!/^SA\d{22}$/.test(patch.iban)) { SF.toast(t('الآيبان السعودي يبدأ بـ SA وبعده 22 رقم', 'A Saudi IBAN is SA followed by 22 digits'), 'bad'); return; } }
    await SF.busy(btn, async () => {
      try {
        const r = await db().from('sf_family_private').upsert(Object.assign({ family_id: ctx.id }, patch), { onConflict: 'family_id' }).select('*').maybeSingle();
        ctx.p = must(r);
        ctx.llNew = null;
        logUi('family_private', ctx.id, { fields: Object.keys(patch) });
        SF.toast(t('انحفظت البيانات الخاصة', 'Private data saved'), 'ok');
        famTab(ctx);
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
    });
  }

  // المنيو: توفر الطبق وتعديل السعر بسرعة
  async function famMenu(ctx, body) {
    const r = await db().from('sf_dishes').select('id,name_ar,name_en,section,category_id,price,old_price,available,image_url,sort,daily_limit,min_lead_hours,serves').eq('family_id', ctx.id).order('sort').order('created_at');
    const ds = need(r) || [];
    ctx.dishes = ds;
    if (!ds.length) { body.innerHTML = `<div class="box">${empty('dish', t('ما فيه أطباق للحين', 'No dishes yet'), t('الأسرة تضيف أطباقها من تطبيق الأسرة', 'Kitchens add dishes from the kitchen app'))}</div>`; return; }
    const catName = (id) => { const c = A.cats.find((x) => x.id === id); return c ? SF.nm(c, 'name') : ''; };
    const groups = [];
    ds.forEach((d) => { const k = d.section || catName(d.category_id) || t('بدون قسم', 'No section'); let g = groups.find((x) => x[0] === k); if (!g) { g = [k, []]; groups.push(g); } g[1].push(d); });
    const on = ds.filter((d) => d.available).length;
    body.innerHTML = `<div class="menu-sum"><span><b>${fmtN(ds.length, 0)}</b> ${esc(t('طبق', 'dishes'))}</span><span class="ok"><b>${fmtN(on, 0)}</b> ${esc(t('متوفر', 'available'))}</span>${ds.length - on ? `<span class="off"><b>${fmtN(ds.length - on, 0)}</b> ${esc(t('غير متوفر', 'unavailable'))}</span>` : ''}<span class="muted small">${esc(t('السعر ينحفظ لحاله بعد ما تطلع من الخانة', 'Prices save as soon as you leave the box'))}</span></div>` +
      groups.map(([g, list]) => `<section class="fsec"><h4>${esc(g)} <span class="muted small">${list.length}</span></h4><div class="dlist">${list.map((d) => `
        <div class="drow ${d.available ? '' : 'off'}" data-dish="${esc(d.id)}">${thumb(d.image_url)}
          <div class="grow"><b>${esc(SF.nm(d, 'name'))}</b><small>${[catName(d.category_id), d.serves, d.old_price ? t(`قبل ${fmtN(d.old_price)}`, `was ${fmtN(d.old_price)}`) : '', d.daily_limit ? t(`حد يومي ${d.daily_limit}`, `daily limit ${d.daily_limit}`) : '', d.min_lead_hours ? t(`طلب قبلها بـ ${d.min_lead_hours} ساعة`, `${d.min_lead_hours}h lead`) : ''].filter(Boolean).map(esc).join(' · ')}</small></div>
          <label class="price-in">${sfx(`<input class="input" inputmode="decimal" data-price value="${esc(d.price)}" aria-label="${esc(t('السعر', 'Price'))}">`, U.sar())}</label>
          <label class="avail" title="${esc(t('متوفر', 'Available'))}">${sw('', d.available, 'data-avail')}</label>
        </div>`).join('')}</div></section>`).join('');
  }

  // الوثائق: عرض برابط مؤقت واعتماد أو رفض
  async function famDocs(ctx, body) {
    const r = await db().from('sf_family_docs').select('*').eq('family_id', ctx.id).order('created_at', { ascending: false });
    const docs = need(r) || [];
    ctx.docs = docs;
    if (!docs.length) { body.innerHTML = `<div class="box">${empty('file', t('ما فيه وثائق', 'No documents'), t('الأسرة ترفع وثائقها من تطبيق الأسرة، مثل وثيقة العمل الحر أو شهادة الأسرة المنتجة والشهادة الصحية', 'Kitchens upload documents from their app, like a freelance permit or a health certificate'))}</div>`; return; }
    const td = today();
    body.innerHTML = `<div class="doclist">${docs.map((d) => {
      const exp = d.expires_on ? (d.expires_on < td ? `<span class="badge b-bad">${esc(t('منتهية', 'Expired'))}</span>` : d.expires_on <= addDays(td, 30) ? `<span class="badge b-warn">${esc(t('تنتهي قريب', 'Expires soon'))}</span>` : '') : '';
      return `<div class="docrow">
        <span class="doc-ic">${ic('file')}</span>
        <div class="grow"><b>${esc(lb(L.doc, d.kind))}</b><small>${esc(t('انرفعت', 'Uploaded'))} ${esc(dShort(d.created_at))}${d.expires_on ? ` · ${esc(t('تنتهي', 'Expires'))} ${esc(dLong(d.expires_on))}` : ''}</small>${d.note ? `<small class="nt">${esc(d.note)}</small>` : ''}</div>
        <span class="doc-st">${badge(L.docSt, d.status)} ${exp}</span>
        <div class="doc-act"><button type="button" class="btn btn-soft btn-sm" data-x="doc-view" data-id="${esc(d.id)}">${ic('eye', 's')}${esc(t('عرض', 'View'))}</button>
          ${d.status !== 'approved' ? `<button type="button" class="btn btn-ok btn-sm" data-x="doc-ok" data-id="${esc(d.id)}">${ic('check', 's')}${esc(t('اعتماد', 'Approve'))}</button>` : ''}
          ${d.status !== 'rejected' ? `<button type="button" class="btn btn-danger btn-sm" data-x="doc-no" data-id="${esc(d.id)}">${ic('x', 's')}${esc(t('رفض', 'Reject'))}</button>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }
  async function viewDoc(doc, ctx) {
    const s = formSheet(`${fsHead(lb(L.doc, doc.kind), doc.expires_on ? `${t('تنتهي', 'Expires')} ${dLong(doc.expires_on)}` : '')}<div id="dv" class="doc-view">${skel(1)}</div>`);
    s.sh.classList.add('wide');
    const box = s.sh.querySelector('#dv');
    try {
      const { data, error } = await db().storage.from('docs').createSignedUrl(doc.file_path, 600);
      if (error || !data) throw error || new Error('sign');
      const url = data.signedUrl;
      const pdf = /\.pdf($|\?)/i.test(doc.file_path);
      box.innerHTML = `${pdf ? `<iframe src="${esc(url)}" title="${esc(lb(L.doc, doc.kind))}"></iframe>` : `<img src="${esc(url)}" alt="${esc(lb(L.doc, doc.kind))}">`}
        <div class="row wrap"><a class="btn btn-soft" href="${esc(url)}" target="_blank" rel="noopener">${ic('eye', 's')}${esc(t('افتح في صفحة جديدة', 'Open in a new tab'))}</a>
        ${doc.status !== 'approved' ? `<button class="btn btn-ok" id="dvOk">${ic('check', 's')}${esc(t('اعتماد', 'Approve'))}</button>` : ''}
        ${doc.status !== 'rejected' ? `<button class="btn btn-danger" id="dvNo">${ic('x', 's')}${esc(t('رفض', 'Reject'))}</button>` : ''}</div>
        <p class="muted tiny">${esc(t('الرابط مؤقت ويشتغل 10 دقايق', 'This link works for 10 minutes'))}</p>`;
      const ok = box.querySelector('#dvOk'), no = box.querySelector('#dvNo');
      if (ok) ok.onclick = async () => { s.close(); await reviewDoc(ctx, doc, true); };
      if (no) no.onclick = async () => { s.close(); await reviewDoc(ctx, doc, false); };
    } catch (e) { box.innerHTML = errBox(e); }
  }
  async function reviewDoc(ctx, doc, approve) {
    let note = doc.note || null;
    if (!approve) {
      note = await SF.confirm({ title: t('رفض الوثيقة؟', 'Reject this document?'), body: t('اكتب السبب عشان الأسرة تعرف وش تعدل', 'Write the reason so the kitchen knows what to fix'), ok: t('ارفض', 'Reject'), danger: true, input: { placeholder: t('مثل: الصورة مو واضحة', 'For example: the photo is not clear'), required: true } });
      if (!note) return;
    }
    try {
      const r = await db().from('sf_family_docs').update({ status: approve ? 'approved' : 'rejected', note }).eq('id', doc.id).select('id').maybeSingle();
      must(r);
      logUi('doc_review', doc.id, { family: ctx.id, status: approve ? 'approved' : 'rejected' });
      SF.toast(approve ? t('اعتمدت الوثيقة', 'Document approved') : t('رفضت الوثيقة', 'Document rejected'), 'ok');
      famTab(ctx);
    } catch (e) { SF.toast(errMsg(e), 'bad'); }
  }

  // الطاقم
  async function famStaff(ctx, body) {
    await reloadStaff();
    const list = A.staff.filter((x) => x.family_id === ctx.id).sort((a, b) => (a.role === 'family_owner' ? -1 : 1) - (b.role === 'family_owner' ? -1 : 1));
    body.innerHTML = `${A.owner ? '' : lockNote()}
      <section class="fsec"><h4>${ic('users')}${esc(t('طاقم المطبخ', 'Kitchen staff'))} <span class="muted small">${list.length}</span></h4>
        ${list.length ? `<div class="slist">${list.map((x) => `<div class="srow2 ${x.active ? '' : 'off'}">
          <span class="av">${esc(String(x.name || '؟').trim().slice(0, 1))}</span>
          <div class="grow"><b>${esc(x.name || t('بدون اسم', 'No name'))}</b><small class="ltr">${esc(SF.showPhone(x.phone))}</small></div>
          <span class="s-badges">${badge(L.role, x.role)}${x.active ? '' : ` <span class="badge b-bad">${esc(t('موقوف', 'Inactive'))}</span>`}${x.user_id ? '' : ` <span class="badge">${esc(t('ما دخل للحين', 'Not signed in yet'))}</span>`}</span>
          ${A.owner ? `<button type="button" class="btn btn-ghost btn-sm" data-x="staff-toggle" data-id="${esc(x.id)}">${esc(x.active ? t('إيقاف', 'Deactivate') : t('تفعيل', 'Activate'))}</button>` : ''}
        </div>`).join('')}</div>` : `<p class="muted small">${esc(t('ما فيه طاقم مسجل', 'No staff yet'))}</p>`}
      </section>
      ${A.owner ? `<section class="fsec"><h4>${ic('plus')}${esc(t('أضف موظف', 'Add a staff member'))}</h4>
        <p class="muted small">${esc(t('الموظف يدخل تطبيق الأسرة برقمه ويشوف طلبات هذي الأسرة ويغيّر حالاتها', 'They sign in to the kitchen app with their number and handle this kitchen\'s orders'))}</p>
        <div class="fgrid">${field(t('الجوال', 'Mobile'), phoneInput('stPhone'))}${field(t('الاسم', 'Name'), `<input class="input" id="stName" maxlength="60">`)}</div>
        <div><button type="button" class="btn btn-primary" data-x="staff-add">${ic('plus', 's')}${esc(t('أضف للطاقم', 'Add to staff'))}</button></div>
      </section>` : ''}`;
  }

  // المالية لأسرة وحدة
  const FIN_PRESETS = [['month', 'هالشهر', 'This month'], ['last_month', 'الشهر الماضي', 'Last month'], ['d90', 'آخر 3 شهور', 'Last 3 months'], ['all', 'من البداية', 'All time'], ['custom', 'مخصص', 'Custom']];
  async function famMoney(ctx, body) {
    const st = ctx.money || (ctx.money = { preset: 'month', from: PRESET.month()[0], to: today() });
    body.innerHTML = rangeBar(st, FIN_PRESETS, 'fm') + `<div id="fmBody">${skel(2)}</div>`;
    bindRange(body, 'fm', st, () => loadFamMoney(ctx));
    await loadFamMoney(ctx);
  }
  function balCard(bal, name) {
    const b = +bal || 0;
    if (Math.abs(b) < 0.005) return `<div class="bal-card zero">${ic('check', 'l')}<div><small>${esc(t('الرصيد', 'Balance'))}</small><b>${esc(t('الحساب مصفّى', 'All settled'))}</b><p>${esc(t('ما لها ولا عليها شي', 'Nothing owed either way'))}</p></div></div>`;
    return b > 0
      ? `<div class="bal-card pos">${ic('arrowL', 'l flip')}<div><small>${esc(t(`لـ${name || 'الأسرة'} عند سُفرة`, `Sufrah owes ${name || 'the kitchen'}`))}</small><b>${sarH(b)}</b><p>${esc(t('صافي طلبات البطاقة بعد العمولة، ناقص اللي تحول لها', 'Card orders net of commission, minus what was paid out'))}</p></div></div>`
      : `<div class="bal-card neg">${ic('arrowR', 'l flip')}<div><small>${esc(t(`على ${name || 'الأسرة'} لسُفرة`, `${name || 'The kitchen'} owes Sufrah`))}</small><b>${sarH(-b)}</b><p>${esc(t('عمولة طلبات الكاش اللي استلمت الأسرة مبلغها', 'Commission on cash orders the kitchen collected'))}</p></div></div>`;
  }
  async function loadFamMoney(ctx) {
    const st = ctx.money, box = ctx.s.sh.querySelector('#fmBody'); if (!box) return;
    box.classList.add('dim');
    try {
      const r = await SF.rpc('sf_family_finance', { p_from: st.from, p_to: st.to, p_family: ctx.id });
      if (!box.isConnected) return;
      ctx.fin = r;
      const k = (label, v, sub = '') => `<div class="kpi"><div class="k-l"><span>${esc(label)}</span></div><div class="k-v">${v}</div>${sub ? `<div class="k-s">${sub}</div>` : ''}</div>`;
      box.innerHTML = `
        <p class="range-note">${ic('calendar', 's')}<span>${esc(rangeLabel(st))}</span></p>
        <div class="kpis k4">${k(t('الطلبات', 'Orders'), fmtN(r.orders, 0))}${k(t('المبيعات', 'Sales'), sarH(r.subtotal), esc(t('قيمة الأكل', 'food value')))}${k(t('عمولة سُفرة', 'Sufrah commission'), sarH(r.commission))}${k(t('صافي لها', 'Her net'), sarH(r.net), esc(t('مع رسوم التوصيل', 'incl. delivery fees')))}</div>
        <div class="fin-split"><div><small>${esc(t('صافي طلبات البطاقة', 'Card orders net'))}</small><b>${sarH(r.card_net)}</b></div><div><small>${esc(t('كاش استلمته الأسرة', 'Cash collected by kitchen'))}</small><b>${sarH(r.cod_total)}</b></div><div><small>${esc(t('عمولة الكاش عليها', 'Commission on cash'))}</small><b>${sarH(r.cod_commission)}</b></div></div>
        ${balCard(r.balance, SF.nm(ctx.f, 'name'))}
        ${A.owner ? `<div class="row wrap"><button type="button" class="btn btn-primary" data-x="payout">${ic('wallet', 's')}${esc(t('سجّل تحويل', 'Record payout'))}</button></div>` : ''}
        <section class="fsec"><h4>${ic('list')}${esc(t('التحويلات', 'Payouts'))}</h4>${payoutsList(r.payouts || [], false)}</section>
        ${(r.top || []).length ? `<section class="fsec"><h4>${ic('dish')}${esc(t('أكثر أطباقها طلبًا', 'Her top dishes'))}</h4><ol class="rank">${r.top.map((d, i) => `<li><span class="rn">${i + 1}</span><span class="nm">${esc(d.name)}</span><span class="vl">${fmtN(d.qty, 0)}</span></li>`).join('')}</ol></section>` : ''}`;
    } catch (e) { box.innerHTML = errBox(e); }
    box.classList.remove('dim');
  }
  const PAY_METHODS = [['تحويل بنكي', 'Bank transfer'], ['كاش', 'Cash'], ['STC Pay', 'STC Pay'], ['غيره', 'Other']];
  const methodLabel = (m) => { const x = PAY_METHODS.find((p) => p[0] === m); return x ? t(x[0], x[1]) : (m || ''); };
  function payoutsList(rows, withFam) {
    if (!rows.length) return `<p class="muted small">${esc(t('ما فيه تحويلات مسجلة', 'No payouts recorded'))}</p>`;
    return `<ul class="po-list">${rows.map((p) => { const out = +p.amount > 0; return `<li class="${out ? 'out' : 'in'}">
      <span class="po-ic">${ic(out ? 'arrowL' : 'arrowR', 's flip')}</span>
      <div class="grow"><b>${esc(out ? t('دفعنا للأسرة', 'Paid to kitchen') : t('استلمنا من الأسرة', 'Received from kitchen'))}${withFam ? ` · ${esc(famName(p.family_id))}` : ''}</b>
        <small>${esc(SF.fmtDT(p.created_at))}${p.method ? ' · ' + esc(methodLabel(p.method)) : ''}${p.ref ? ' · ' : ''}${p.ref ? `<span class="ltr">${esc(p.ref)}</span>` : ''}${p.period_from ? ' · ' + esc(dShort(p.period_from)) + ' ' + esc(t('إلى', 'to')) + ' ' + esc(dShort(p.period_to)) : ''}</small>${p.note ? `<small class="nt">${esc(p.note)}</small>` : ''}</div>
      <b class="po-amt">${sarH(Math.abs(+p.amount))}</b></li>`; }).join('')}</ul>`;
  }
  function payoutSheet(pre, onDone) {
    if (!A.owner) { SF.toast(t('تسجيل التحويلات للمدير بس', 'Only the owner admin can record payouts'), 'bad'); return; }
    pre = pre || {};
    let dir = (+pre.amount || 0) < 0 ? 'in' : 'out';
    const s = formSheet(`${fsHead(t('تسجيل تحويل', 'Record a payout'), t('سجّل أي مبلغ دفعته للأسرة أو استلمته منها، ويتعدل رصيدها على طول', 'Record money paid to or received from a kitchen, her balance updates right away'))}
      <div class="stack">
        ${field(t('الأسرة', 'Kitchen'), `<select class="select" id="poFam">${famOptions(pre.family_id || '', false)}</select>`)}
        <div class="seg" id="poDir"><button type="button" data-v="out" class="${dir === 'out' ? 'is-active' : ''}">${esc(t('دفعنا للأسرة', 'We paid the kitchen'))}</button><button type="button" data-v="in" class="${dir === 'in' ? 'is-active' : ''}">${esc(t('استلمنا من الأسرة', 'Kitchen paid us'))}</button></div>
        ${field(t('المبلغ', 'Amount'), sfx(`<input class="input big-num" id="poAmt" inputmode="decimal" placeholder="0" value="${pre.amount ? esc(fmtN(Math.abs(pre.amount), 2).replace(/,/g, '')) : ''}">`, U.sar()), pre.hint || '')}
        <div class="fgrid">${field(t('من تاريخ', 'Period from'), `<input type="date" class="input" id="poFrom" value="${esc(pre.from || '')}">`)}${field(t('إلى تاريخ', 'Period to'), `<input type="date" class="input" id="poTo" value="${esc(pre.to || '')}">`)}</div>
        <div class="fgrid">${field(t('الطريقة', 'Method'), `<select class="select" id="poMethod">${PAY_METHODS.map(([a, e], i) => `<option value="${esc(a)}" ${i === 0 ? 'selected' : ''}>${esc(t(a, e))}</option>`).join('')}</select>`)}${field(t('رقم العملية', 'Reference'), `<input class="input" id="poRef" maxlength="60" dir="ltr">`)}</div>
        ${field(t('ملاحظة', 'Note'), `<textarea class="textarea" id="poNote" maxlength="200"></textarea>`)}
        <div class="row"><button class="btn btn-primary btn-lg grow" id="poGo">${ic('check', 's')}${esc(t('سجّل التحويل', 'Record payout'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>
      </div>`, { noFocus: true });
    const q = (sel) => s.sh.querySelector(sel);
    q('#poDir').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; dir = b.dataset.v; $$('#poDir button', s.sh).forEach((x) => x.classList.toggle('is-active', x === b)); });
    q('#poGo').onclick = () => {
      const fam = q('#poFam').value, amt = numOf(q('#poAmt').value);
      if (!fam) { SF.toast(t('اختر الأسرة', 'Choose the kitchen'), 'bad'); return; }
      if (!amt || amt <= 0) { SF.toast(t('اكتب المبلغ', 'Enter the amount'), 'bad'); q('#poAmt').classList.add('is-bad'); q('#poAmt').focus(); return; }
      const p = { family_id: fam, amount: dir === 'out' ? amt : -amt, period_from: q('#poFrom').value || null, period_to: q('#poTo').value || null,
        method: q('#poMethod').value, ref: q('#poRef').value.trim() || null, note: q('#poNote').value.trim() || null };
      SF.busy(q('#poGo'), async () => {
        try {
          const r = await SF.rpc('sf_admin_payout', { p });
          if (failed(r, 'ما انسجل التحويل', 'Payout not recorded')) return;
          s.close();
          SF.toast(t('انسجل التحويل', 'Payout recorded'), 'ok');
          if (onDone) onDone();
        } catch (e) { SF.toast(errMsg(e), 'bad'); }
      });
    };
    return s;
  }

  // أزرار لوح الأسرة
  async function famAction(ctx, x, b, e) {
    const form = b.closest('form');
    if (x === 'tab') { ctx.tab = b.dataset.tab; famTab(ctx); return; }
    if (x === 'seg') { const seg = b.closest('[data-seg]'); $$('button', seg).forEach((y) => y.classList.toggle('is-active', y === b)); const h = form && form.querySelector(`[name="${seg.dataset.seg}"]`); if (h) h.value = b.dataset.v; famDirty(ctx); return; }
    if (x === 'save-info') { saveFamInfo(ctx, b); return; }
    if (x === 'save-priv') { saveFamPrivate(ctx, b); return; }
    if (x === 'info-reset' || x === 'priv-reset') { famTab(ctx); return; }
    if (x === 'tier-add') { const box = ctx.s.sh.querySelector('#tiers'); const rows = $$('.tier', box); if (rows.length >= 8) return; const last = rows.length ? numOf(rows[rows.length - 1].querySelector('[data-tier="km"]').value) || 0 : 0; box.insertAdjacentHTML('beforeend', tierRow(last + 3, '')); famDirty(ctx); return; }
    if (x === 'tier-del') { b.closest('.tier').remove(); famDirty(ctx); return; }
    if (x === 'activate') {
      const ok = await SF.confirm({ title: t('تفعيل الأسرة؟', 'Activate this kitchen?'), body: t('تطلع للعملاء في التطبيق وتقدر تستقبل طلبات', 'It becomes visible to customers and can take orders'), ok: t('فعّلها', 'Activate') });
      if (!ok) return;
      await SF.busy(b, async () => {
        try {
          const r = await db().from('sf_families').update({ status: 'active' }).eq('id', ctx.id).select('*').maybeSingle();
          ctx.f = must(r); updateFamCache(ctx.f);
          logUi('family_status', ctx.id, { status: 'active' });
          SF.toast(t('تفعّلت الأسرة', 'Kitchen activated'), 'ok');
          renderFam(ctx);
          if (A.sec === 'families') renderFamList();
          if (A.sec === 'joins') renderJoins();
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
      return;
    }
    if (x === 'fam-delete') {
      const n = await db().from('sf_orders').select('id', { count: 'exact', head: true }).eq('family_id', ctx.id);
      if (n.count) { SF.toast(t(`ما تنحذف، عليها ${cnt(n.count, 'order')}. خلها «مسكّرة» بدال الحذف.`, `It has ${cnt(n.count, 'order')}, set it to Closed instead.`), 'bad'); return; }
      const ok = await SF.confirm({ title: t(`حذف «${SF.nm(ctx.f, 'name')}»؟`, `Delete «${SF.nm(ctx.f, 'name')}»?`), body: t('تنحذف الأسرة وأطباقها وطاقمها نهائيًا', 'The kitchen, its dishes and staff are removed permanently'), ok: t('احذف', 'Delete'), danger: true });
      if (!ok) return;
      try {
        const r = await db().from('sf_families').delete().eq('id', ctx.id).select('id');
        if (!(need(r) || []).length) throw new Error('not deleted');
        logUi('family_delete', ctx.id, { name: ctx.f.name_ar });
        A.fams = A.fams.filter((y) => y.id !== ctx.id); indexFams();
        ctx.s.close();
        SF.toast(t('انحذفت الأسرة', 'Kitchen deleted'), 'ok');
        if (A.sec === 'families') renderFamList();
      } catch (er) { SF.toast(er.raw && er.raw.code === '23503' ? t('ما تنحذف لأن عليها طلبات', 'It has orders and cannot be deleted') : errMsg(er), 'bad'); }
      return;
    }
    if (x === 'doc-view') { const d = (ctx.docs || []).find((y) => y.id === b.dataset.id); if (d) viewDoc(d, ctx); return; }
    if (x === 'doc-ok' || x === 'doc-no') { const d = (ctx.docs || []).find((y) => y.id === b.dataset.id); if (d) reviewDoc(ctx, d, x === 'doc-ok'); return; }
    if (x === 'staff-add') {
      const phone = SF.normPhone(ctx.s.sh.querySelector('#stPhone').value), name = ctx.s.sh.querySelector('#stName').value.trim();
      if (!phone) { SF.toast(t('اكتب جوال سعودي صحيح يبدأ بـ 05', 'Enter a valid Saudi mobile starting with 05'), 'bad'); return; }
      const ex = A.staff.find((y) => y.phone === phone);
      if (ex && ex.family_id === ctx.id) { SF.toast(t('الرقم موجود في الطاقم', 'Already on the staff'), 'bad'); return; }
      if (ex) { SF.toast(t('الرقم مسجل في حساب ثاني في سُفرة', 'This number belongs to another Sufrah account'), 'bad'); return; }
      await SF.busy(b, async () => {
        try {
          const r = await SF.rpc('sf_admin_staff_save', { p: { phone, name: name || null, role: 'family_staff', family_id: ctx.id, active: true } });
          if (failed(r)) return;
          SF.toast(t('انضاف للطاقم', 'Added to staff'), 'ok');
          famTab(ctx);
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
      return;
    }
    if (x === 'staff-toggle') {
      const st = A.staff.find((y) => y.id === b.dataset.id); if (!st) return;
      const ok = await SF.confirm({ title: st.active ? t('إيقاف هذا الحساب؟', 'Deactivate this account?') : t('تفعيل هذا الحساب؟', 'Activate this account?'), body: st.active ? t('ما يقدر يدخل تطبيق الأسرة لين ترجع تفعّله', 'They cannot sign in to the kitchen app until reactivated') : '', ok: st.active ? t('أوقفه', 'Deactivate') : t('فعّله', 'Activate'), danger: st.active });
      if (!ok) return;
      try {
        const r = await SF.rpc('sf_admin_staff_save', { p: { phone: st.phone, name: st.name, role: st.role, family_id: st.family_id, active: !st.active } });
        if (failed(r)) return;
        SF.toast(t('تم', 'Done'), 'ok');
        famTab(ctx);
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
      return;
    }
    if (x === 'payout') {
      const bal = ctx.fin ? +ctx.fin.balance || 0 : 0;
      payoutSheet({ family_id: ctx.id, amount: bal, from: ctx.money && ctx.money.preset !== 'all' ? ctx.money.from : '', to: ctx.money && ctx.money.preset !== 'all' ? ctx.money.to : '',
        hint: bal ? (bal > 0 ? t(`رصيدها الحين ${sar(bal)} لها`, `Current balance ${sar(bal)} owed to her`) : t(`رصيدها الحين ${sar(-bal)} عليها`, `Current balance ${sar(-bal)} owed by her`)) : '' }, () => loadFamMoney(ctx));
    }
  }
  async function famChange(ctx, e) {
    const el = e.target;
    if (el.matches('input[type="file"][data-img]')) {
      const file = el.files && el.files[0]; if (!file) return;
      const key = el.dataset.img;
      const lbl = el.closest('label');
      if (lbl) lbl.classList.add('is-loading');
      try {
        const url = await SF.uploadImage(`families/${ctx.id}`, file, { maxDim: key === 'logo_url' ? 512 : 1600 });
        const r = await db().from('sf_families').update({ [key]: url }).eq('id', ctx.id).select('*').maybeSingle();
        ctx.f = must(r); updateFamCache(ctx.f);
        logUi('family_image', ctx.id, { field: key });
        SF.toast(t('انحفظت الصورة', 'Photo saved'), 'ok');
        renderFam(ctx);
      } catch (er) { SF.toast(errMsg(er), 'bad'); if (lbl) lbl.classList.remove('is-loading'); }
      return;
    }
    if (el.matches('[data-price]')) {
      const row = el.closest('[data-dish]'), id = row.dataset.dish, d = (ctx.dishes || []).find((y) => y.id === id);
      const v = numOf(el.value);
      if (v == null || v < 0) { SF.toast(t('اكتب سعر صحيح', 'Enter a valid price'), 'bad'); el.value = d ? d.price : ''; return; }
      if (d && +d.price === v) return;
      try {
        const r = await db().from('sf_dishes').update({ price: v }).eq('id', id).select('id,price').maybeSingle();
        const nd = must(r); if (d && nd) d.price = nd.price;
        logUi('dish_edit', id, { family: ctx.id, price: v });
        SF.toast(t('انحفظ السعر', 'Price saved'), 'ok');
        row.classList.add('saved'); setTimeout(() => row.classList.remove('saved'), 1200);
      } catch (er) { SF.toast(errMsg(er), 'bad'); if (d) el.value = d.price; }
      return;
    }
    if (el.matches('[data-avail]')) {
      const row = el.closest('[data-dish]'), id = row.dataset.dish, d = (ctx.dishes || []).find((y) => y.id === id);
      try {
        const r = await db().from('sf_dishes').update({ available: el.checked }).eq('id', id).select('id,available').maybeSingle();
        const nd = must(r); if (d && nd) d.available = nd.available;
        row.classList.toggle('off', !el.checked);
        logUi('dish_edit', id, { family: ctx.id, available: el.checked });
        SF.toast(el.checked ? t('صار متوفر', 'Now available') : t('صار غير متوفر', 'Now unavailable'), 'ok');
      } catch (er) { SF.toast(errMsg(er), 'bad'); el.checked = !el.checked; }
      return;
    }
    if (el.closest('#famForm,#privForm')) famDirty(ctx);
  }

  // ============================================================
  //  4) طلبات الانضمام
  // ============================================================
  const JOIN_CHIPS = [['new', 'جديدة', 'New'], ['approved', 'مقبولة', 'Approved'], ['rejected', 'معتذر عنها', 'Declined'], ['all', 'الكل', 'All']];
  V.joins = async (el) => {
    const f = A.jf || (A.jf = { st: 'new' });
    el.innerHTML = head(t('طلبات الانضمام', 'Join requests'), t('أسر تبي تبيع في سُفرة. كلمهم على الواتساب، ثم اقبل أو اعتذر', 'Kitchens asking to join. Message them on WhatsApp, then approve or decline'),
      `<button class="btn btn-soft btn-sm" data-act="join-copy">${ic('copy', 's')}${esc(t('انسخ رابط الانضمام', 'Copy join link'))}</button><a class="btn btn-ghost btn-sm" href="join.html" target="_blank" rel="noopener">${ic('eye', 's')}${esc(t('افتح الصفحة', 'Open page'))}</a>`) + `<div class="chips st-chips" id="jchips"></div><div id="jlist">${skel(2)}</div>`;
    $('#jchips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.st = b.dataset.st; renderJoins(); });
    $('#jlist').addEventListener('click', (e) => { const b = e.target.closest('[data-j]'); if (b && !b.disabled) joinAction(b.dataset.j, b.dataset.id, b); });
    await Promise.all([loadJoins(), reloadFams()]);
    renderJoins();
  };
  async function loadJoins() { A.joins = need(await db().from('sf_join_requests').select('*').order('created_at', { ascending: false }).limit(300)) || []; }
  function renderJoins() {
    const f = A.jf, box = $('#jlist'); if (!box || !f) return;
    const counts = { all: A.joins.length };
    A.joins.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    $('#jchips').innerHTML = JOIN_CHIPS.map(([v, a, e]) => `<button class="chip ${f.st === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))} <span class="n">${counts[v] || 0}</span></button>`).join('');
    const rows = A.joins.filter((x) => f.st === 'all' || x.status === f.st);
    if (!rows.length) { box.innerHTML = `<div class="box">${empty('door', f.st === 'new' ? t('ما فيه طلبات جديدة', 'No new requests') : t('ما فيه طلبات هنا', 'Nothing here'), t('شارك رابط صفحة الانضمام مع الأسر في الواتساب، وطلباتهم توصلك هنا', 'Share the join page link with kitchens on WhatsApp, their requests land here'), `<button class="btn btn-soft" data-act="join-copy">${ic('copy', 's')}${esc(t('انسخ رابط الانضمام', 'Copy join link'))}</button>`)}</div>`; return; }
    const licTxt = (r) => (r.has_license ? (r.license_kind ? licLabel(r.license_kind) : t('عندها ترخيص', 'Has a licence')) : t('ما عندها ترخيص للحين', 'No licence yet'));
    box.innerHTML = `<div class="jlist">${rows.map((r) => {
      const fam = r.family_id ? A.famById[r.family_id] : null;
      const wa = t(`أهلًا ${r.name}، معك فريق سُفرة بخصوص طلب انضمام «${r.kitchen_name}». حاب نتعرف على مطبخك أكثر.`, `Hi ${r.name}, this is the Sufrah team about the join request for «${r.kitchen_name}».`);
      const ig = String(r.instagram || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');
      return `<article class="jcard ${r.status}">
        <div class="jc-head"><span class="jc-av">${esc(String(r.kitchen_name || '؟').trim().slice(0, 1))}</span>
          <div class="grow"><h3>${esc(r.kitchen_name)}</h3><p>${esc(r.name)} · ${esc(cityName(r.city_id) || t('مدينة غير محددة', 'No city'))}${r.district ? ' · ' + esc(r.district) : ''}</p></div>
          <div class="jc-meta">${badge(L.joinSt, r.status)}<small>${esc(SF.ago(r.created_at))}</small></div></div>
        ${(r.cuisines || []).length ? `<div class="jc-tags">${r.cuisines.map((c) => `<span class="badge">${esc(c)}</span>`).join('')}</div>` : ''}
        ${kv([[t('الجوال', 'Mobile'), phoneCell(r.phone, wa)], r.specialties ? [t('أشهر أكلاتها', 'Specialities'), esc(r.specialties)] : null, [t('الترخيص', 'Licence'), esc(licTxt(r))],
          ig ? [t('انستقرام', 'Instagram'), `<a class="ltr" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>`] : null, r.notes ? [t('ملاحظات', 'Notes'), esc(r.notes)] : null,
          r.admin_note ? [t('ملاحظة الإدارة', 'Team note'), esc(r.admin_note)] : null, r.decided_at ? [t('القرار', 'Decided'), esc(SF.fmtDT(r.decided_at))] : null])}
        <div class="jc-act">
          ${r.status === 'new' ? `<a class="btn btn-soft btn-sm" href="${esc(SF.waLink(r.phone, wa))}" target="_blank" rel="noopener">${ic('whatsapp', 's')}${esc(t('واتساب', 'WhatsApp'))}</a>
            <span class="grow"></span><button class="btn btn-danger btn-sm" data-j="reject" data-id="${esc(r.id)}">${esc(t('اعتذار', 'Decline'))}</button><button class="btn btn-ok btn-sm" data-j="approve" data-id="${esc(r.id)}">${ic('check', 's')}${esc(t('قبول', 'Approve'))}</button>` : ''}
          ${r.status === 'approved' && fam ? `<span class="muted small grow">${esc(t('انضافت كأسرة', 'Added as a kitchen'))} · ${badge(L.famSt, fam.status)}</span>
            <button class="btn btn-soft btn-sm" data-j="open" data-id="${esc(fam.id)}">${ic('store', 's')}${esc(t('افتح الأسرة', 'Open kitchen'))}</button>
            ${fam.status === 'pending' ? `<button class="btn btn-ok btn-sm" data-j="activate" data-id="${esc(fam.id)}">${ic('check', 's')}${esc(t('فعّل الأسرة', 'Activate kitchen'))}</button>` : ''}` : ''}
          ${r.status === 'approved' && !fam ? `<span class="muted small">${esc(t('الأسرة انحذفت', 'The kitchen was removed'))}</span>` : ''}
        </div>
      </article>`;
    }).join('')}</div>`;
  }
  ACT['join-copy'] = async () => {
    const base = String((A.settingsAll && A.settingsAll.app_url) || SF.settings.app_url || '').trim();
    const url = /^https?:\/\//.test(base) && !/localhost|127\.0\.0\.1/.test(location.hostname) ? new URL('join.html', base.endsWith('/') ? base : base + '/').href : new URL('join.html', location.href).href;
    try { await navigator.clipboard.writeText(url); SF.toast(t('تم نسخ الرابط، أرسله للأسر في الواتساب', 'Link copied, send it to kitchens on WhatsApp'), 'ok'); }
    catch (e) { window.prompt(t('انسخ الرابط', 'Copy the link'), url); }
  };
  const LIC = [['وثيقة عمل حر', 'Freelance permit'], ['شهادة أسرة منتجة', 'Productive family certificate'], ['غيره', 'Other']];
  const licLabel = (v) => { const x = LIC.find((l) => l[0] === v || l[1] === v); return x ? t(x[0], x[1]) : v; };
  async function joinAction(x, id, b) {
    const r = A.joins.find((y) => y.id === id);
    if (x === 'open') { openFamily(id); return; }
    if (x === 'activate') {
      const ok = await SF.confirm({ title: t('تفعيل الأسرة؟', 'Activate this kitchen?'), body: t('تطلع للعملاء وتقدر تستقبل طلبات. تأكد إن منيوها جاهز.', 'It becomes visible to customers. Make sure the menu is ready.'), ok: t('فعّلها', 'Activate') });
      if (!ok) return;
      await SF.busy(b, async () => {
        try {
          const res = await db().from('sf_families').update({ status: 'active' }).eq('id', id).select('*').maybeSingle();
          updateFamCache(must(res));
          logUi('family_status', id, { status: 'active', from: 'join' });
          SF.toast(t('تفعّلت الأسرة', 'Kitchen activated'), 'ok');
          renderJoins();
        } catch (e) { SF.toast(errMsg(e), 'bad'); }
      });
      return;
    }
    if (!r) return;
    if (x === 'approve') {
      const note = await SF.confirm({ title: t(`قبول «${r.kitchen_name}»؟`, `Approve «${r.kitchen_name}»?`), body: t('تنضاف كأسرة «تحت المراجعة»، وصاحبها يدخل تطبيق الأسرة برقمه ويجهز منيوه. تفعّلها لما يكون جاهز.', 'It is added as a kitchen under review. The owner signs in to the kitchen app to set up the menu, then you activate it.'), ok: t('اقبل', 'Approve'), input: { placeholder: t('ملاحظة للفريق (اختياري)', 'Team note (optional)') } });
      if (note === null) return;
      await SF.busy(b, async () => {
        try {
          const res = await SF.rpc('sf_admin_join_decide', { p_id: id, p_approve: true, p_note: note || null });
          if (failed(res, 'ما انقبل الطلب', 'Not approved')) return;
          SF.toast(t('انقبل الطلب وانضافت الأسرة', 'Approved, the kitchen was added'), 'ok');
          await Promise.all([loadJoins(), reloadFams(), reloadStaff()]);
          A.jf.st = 'approved';
          renderJoins();
          countsSoon();
        } catch (e) { SF.toast(errMsg(e), 'bad'); }
      });
      return;
    }
    if (x === 'reject') {
      const note = await SF.confirm({ title: t('الاعتذار عن الطلب؟', 'Decline this request?'), body: t('اكتب السبب عشان يكون مرجع للفريق', 'Write the reason for the team record'), ok: t('اعتذر', 'Decline'), danger: true, input: { placeholder: t('السبب', 'Reason'), required: true } });
      if (!note) return;
      await SF.busy(b, async () => {
        try {
          const res = await SF.rpc('sf_admin_join_decide', { p_id: id, p_approve: false, p_note: note });
          if (failed(res, 'ما تم', 'Not done')) return;
          SF.toast(t('تم الاعتذار عن الطلب', 'Request declined'), 'ok');
          await loadJoins();
          renderJoins();
          countsSoon();
        } catch (e) { SF.toast(errMsg(e), 'bad'); }
      });
    }
  }

  // ============================================================
  //  5) العملاء
  // ============================================================
  V.customers = async (el) => {
    const f = A.cf || (A.cf = { q: '' });
    el.innerHTML = head(t('العملاء', 'Customers'), t('ابحث بالاسم أو الجوال، واضغط على العميل لطلباته ورصيده', 'Search by name or phone, tap a customer for orders and credit')) + `
      <div class="fbar"><div class="fb-search"><span>${ic('search', 's')}</span><input class="input" id="cq" type="search" placeholder="${esc(t('اسم العميل أو جواله', 'Customer name or phone'))}" value="${esc(f.q)}"></div></div>
      <div id="clist">${skel(2)}</div>`;
    $('#cq').addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); loadCustomers(); }, 350));
    $('#clist').addEventListener('click', (e) => { const tr = e.target.closest('[data-cust]'); if (tr && !e.target.closest('a')) openCustomer(tr.dataset.cust); });
    await loadCustomers();
  };
  async function loadCustomers() {
    const box = $('#clist'); if (!box) return;
    const tok = A.tok;
    box.classList.add('dim');
    try {
      // الجوال محفوظ 9665XXXXXXXX، فنشيل الصفر أو 966 من البحث عشان يطابق 05 أو 5 أو +966
      const raw = A.cf.q || '', dg = latin(raw).replace(/\D/g, '');
      const qq = dg.length >= 4 && dg.length >= raw.replace(/[\s+-]/g, '').length - 1 ? dg.replace(/^(00966|966|0)/, '') : raw;
      const rows = (await SF.rpc('sf_admin_customers', { p_q: qq || null, p_limit: 100 })) || [];
      if (tok !== A.tok || !box.isConnected) return;
      A.custRows = rows;
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="t cards cust-t">
        <thead><tr><th>${esc(t('العميل', 'Customer'))}</th><th class="num">${esc(t('طلبات مكتملة', 'Completed'))}</th><th class="num">${esc(t('صرف', 'Spent'))}</th><th>${esc(t('آخر طلب', 'Last order'))}</th><th class="num">${esc(t('الرصيد', 'Credit'))}</th><th>${esc(t('الحالة', 'Status'))}</th></tr></thead>
        <tbody>${rows.map((c) => `<tr class="click" data-cust="${esc(c.id)}" tabindex="0">
          <td class="c-nm"><b>${esc(c.name || t('بدون اسم', 'No name'))}</b>${A.staff.some((x) => x.user_id === c.id) ? ` <span class="badge b-info sm">${esc(t('من الفريق', 'Team'))}</span>` : ''}<small class="ltr">${esc(SF.showPhone(c.phone) || '')}</small></td>
          <td class="num c-ord">${fmtN(c.orders, 0)} <small class="only-m">${esc(t('مكتمل', 'completed'))}</small></td>
          <td class="num c-spent"><b>${sarH(c.spent)}</b></td>
          <td class="c-last">${c.last_order ? esc(SF.ago(c.last_order)) : `<span class="muted">${esc(t('ما طلب للحين', 'No orders yet'))}</span>`}</td>
          <td class="num c-cr"><small class="only-m">${esc(t('رصيد', 'Credit'))}</small> ${+c.credit ? sarH(c.credit) : '<span class="muted">0</span>'}</td>
          <td class="c-st">${c.blocked ? `<span class="badge b-bad">${esc(t('موقوف', 'Blocked'))}</span>` : `<span class="badge b-ok">${esc(t('نشط', 'Active'))}</span>`}</td>
        </tr>`).join('')}</tbody></table></div><div class="pager"><span>${esc(rows.length >= 100 ? t('يعرض أول 100، دقّق البحث', 'Showing the first 100, refine your search') : t(`${rows.length} عميل`, `${rows.length} customers`))}</span></div>`
        : `<div class="box">${empty('users', A.cf.q ? t('ما لقينا عميل بهالبحث', 'No customer matches') : t('ما فيه عملاء للحين', 'No customers yet'))}</div>`;
    } catch (e) { if (box.isConnected) box.innerHTML = errBox(e); }
    box.classList.remove('dim');
  }
  async function openCustomer(uid) {
    const ctx = { uid };
    const s = drawer(drLoading());
    ctx.s = s;
    s.sh.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) custAction(ctx, b.dataset.x, b); });
    ctx.load = async () => {
      try {
        const [p, o, c, k] = await Promise.all([
          db().from('sf_profiles').select('*').eq('id', uid).maybeSingle(),
          db().from('sf_orders').select('id,order_no,created_at,family_id,total,status,fulfillment,is_test,rating').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
          db().from('sf_credits').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
          db().from('sf_complaints').select('id,kind,status,created_at,order_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
        ]);
        ctx.p = need(p); ctx.o = need(o) || []; ctx.c = need(c) || []; ctx.k = need(k) || [];
        if (!ctx.p) { s.body.innerHTML = drHead(esc(t('العميل', 'Customer'))) + `<div class="dr-body">${empty('user', t('العميل غير موجود', 'Customer not found'))}</div>`; return; }
        renderCustomer(ctx);
      } catch (e) { s.body.innerHTML = drHead(esc(t('العميل', 'Customer'))) + `<div class="dr-body">${errBox(e)}</div>`; }
    };
    await ctx.load();
  }
  function renderCustomer(ctx) {
    const p = ctx.p;
    const done = ctx.o.filter((o) => DONE.includes(o.status) && !o.is_test);
    const spent = done.reduce((a, o) => a + (+o.total || 0), 0);
    const credit = ctx.c.reduce((a, x) => a + (+x.amount || 0), 0);
    const isStaff = A.staff.some((x) => x.user_id === ctx.uid);
    ctx.s.body.innerHTML = drHead(esc(p.name || t('بدون اسم', 'No name')), `<span class="ltr">${esc(SF.showPhone(p.phone) || '')}</span> · ${esc(t('سجّل', 'Joined'))} ${esc(dShort(p.created_at))}`,
      `<span class="dr-badges">${p.blocked ? `<span class="badge b-bad">${esc(t('موقوف', 'Blocked'))}</span>` : ''}${isStaff ? `<span class="badge b-info">${esc(t('من الفريق', 'Team member'))}</span>` : ''}</span>`) + `
      <div class="dr-body">
        <div class="kpis k3">
          <div class="kpi"><div class="k-l"><span>${esc(t('طلبات مكتملة', 'Completed orders'))}</span></div><div class="k-v">${fmtN(done.length, 0)}</div></div>
          <div class="kpi"><div class="k-l"><span>${esc(t('صرف', 'Spent'))}</span></div><div class="k-v">${sarH(spent)}</div></div>
          <div class="kpi"><div class="k-l"><span>${esc(t('الرصيد', 'Credit'))}</span></div><div class="k-v">${sarH(credit)}</div></div>
        </div>
        <section class="dr-sec"><h3>${ic('user')}${esc(t('الملف', 'Profile'))}</h3>
          ${kv([[t('الجوال', 'Phone'), phoneCell(p.phone)], [t('العروض', 'Marketing'), esc(p.marketing_ok ? t('يبي توصله العروض', 'Opted in') : t('ما يبي عروض', 'Opted out'))], p.referral_code ? [t('كود الدعوة', 'Referral code'), `<span class="ltr mono">${esc(p.referral_code)}</span>`] : null, [t('اللغة', 'Language'), esc(p.lang === 'en' ? 'English' : 'العربية')]])}
        </section>
        <section class="dr-sec"><h3>${ic('receipt')}${esc(t('الطلبات', 'Orders'))} <span class="muted small">${ctx.o.length}</span></h3>
          ${ctx.o.length ? `<ul class="mini-orders">${ctx.o.map((o) => `<li><button class="mo" data-open-order="${esc(o.id)}"><b class="ltr">#${esc(o.order_no)}</b><span class="grow">${esc(famName(o.family_id))}<small>${esc(SF.fmtDT(o.created_at))}</small></span>${o.is_test ? testBadge() : ''}${SF.statusBadge(o.status, o.fulfillment)}<b>${sarH(o.total)}</b></button></li>`).join('')}</ul>` : `<p class="muted small">${esc(t('ما طلب للحين', 'No orders yet'))}</p>`}
        </section>
        <section class="dr-sec"><h3>${ic('gift')}${esc(t('حركة الرصيد', 'Credit history'))}</h3>
          ${ctx.c.length ? `<ul class="cr-list">${ctx.c.map((x) => `<li><span class="${+x.amount >= 0 ? 'pos' : 'neg'}">${+x.amount >= 0 ? '+' : '-'}${sarH(Math.abs(+x.amount))}</span><span class="grow">${esc(creditReason(x.reason))}</span><small class="muted">${esc(SF.fmtDT(x.created_at))}</small></li>`).join('')}</ul>` : `<p class="muted small">${esc(t('ما فيه حركة رصيد', 'No credit activity'))}</p>`}
        </section>
        ${ctx.k.length ? `<section class="dr-sec"><h3>${ic('chat')}${esc(t('شكاويه', 'Complaints'))}</h3>${ctx.k.map((c) => `<button class="o-cmp" data-x="complaint" data-id="${esc(c.id)}">${badge(L.cmpSt, c.status)}<span>${esc(lb(L.cmpKind, c.kind))}</span><small class="muted">${esc(SF.ago(c.created_at))}</small></button>`).join('')}</section>` : ''}
      </div>
      <div class="dr-foot">
        <button class="btn btn-soft" data-x="credit">${ic('gift', 's')}${esc(t('أضف رصيد', 'Add credit'))}</button>
        ${p.blocked ? `<button class="btn btn-ok" data-x="unblock">${ic('check', 's')}${esc(t('فك الإيقاف', 'Unblock'))}</button>` : `<button class="btn btn-danger" data-x="block">${ic('lock', 's')}${esc(t('إيقاف العميل', 'Block customer'))}</button>`}
      </div>`;
  }
  const CREDIT_REASON = { order: ['استخدام في طلب', 'Used on an order'], order_refund: ['رجوع رصيد طلب ملغي', 'Returned from a cancelled order'], referral_welcome: ['هدية كود صديق', 'Friend code gift'], referral_reward: ['مكافأة دعوة صديق', 'Referral reward'], admin: ['من الإدارة', 'From the team'] };
  const creditReason = (r) => (CREDIT_REASON[r] ? t(CREDIT_REASON[r][0], CREDIT_REASON[r][1]) : r || '');
  async function custAction(ctx, x, b) {
    const p = ctx.p;
    if (x === 'complaint') { openComplaint(b.dataset.id); return; }
    const set = (payload, msg) => SF.busy(b, async () => {
      try {
        const r = await SF.rpc('sf_admin_customer_set', { p_user: ctx.uid, p: payload });
        if (failed(r)) return;
        SF.toast(msg, 'ok');
        await ctx.load();
        if (A.sec === 'customers') loadCustomers();
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
    });
    if (x === 'block') {
      const ok = await SF.confirm({ title: t(`إيقاف ${p.name || 'العميل'}؟`, `Block ${p.name || 'this customer'}?`), body: t('ما يقدر يرسل طلبات جديدة لين تفك الإيقاف', 'They cannot place new orders until unblocked'), ok: t('أوقفه', 'Block'), danger: true });
      if (ok) set({ blocked: true }, t('انوقف العميل', 'Customer blocked'));
      return;
    }
    if (x === 'unblock') { const ok = await SF.confirm({ title: t('فك الإيقاف؟', 'Unblock?'), body: t('يقدر يطلب من جديد', 'They can order again'), ok: t('فك الإيقاف', 'Unblock') }); if (ok) set({ blocked: false }, t('انفك الإيقاف', 'Customer unblocked')); return; }
    if (x === 'credit') {
      let sign = 1;
      const s = formSheet(`${fsHead(t('رصيد للعميل', 'Customer credit'), t('ينخصم من طلباته الجاية لما يكون الرصيد مفعل في الإعدادات', 'Used on future orders when credit is on in settings'))}
        <div class="stack">
          <div class="seg" id="crDir"><button type="button" class="is-active" data-v="1">${esc(t('إضافة رصيد', 'Add credit'))}</button><button type="button" data-v="-1">${esc(t('خصم رصيد', 'Deduct credit'))}</button></div>
          ${field(t('المبلغ', 'Amount'), sfx(`<input class="input big-num" id="crAmt" inputmode="decimal" placeholder="0">`, U.sar()))}
          ${field(t('السبب', 'Reason'), `<input class="input" id="crWhy" maxlength="60" placeholder="${esc(t('مثل: تعويض عن تأخير', 'For example: compensation for a delay'))}">`)}
          <div class="row"><button class="btn btn-primary btn-lg grow" id="crGo">${esc(t('حفظ', 'Save'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>
        </div>`, { noFocus: true });
      s.sh.querySelector('#crDir').addEventListener('click', (e) => { const bb = e.target.closest('[data-v]'); if (!bb) return; sign = +bb.dataset.v; $$('#crDir button', s.sh).forEach((y) => y.classList.toggle('is-active', y === bb)); });
      s.sh.querySelector('#crGo').onclick = () => {
        const amt = numOf(s.sh.querySelector('#crAmt').value), why = s.sh.querySelector('#crWhy').value.trim();
        if (!amt || amt <= 0) { SF.toast(t('اكتب المبلغ', 'Enter the amount'), 'bad'); return; }
        if (why.length < 2) { SF.toast(t('اكتب السبب', 'Write the reason'), 'bad'); return; }
        s.close();
        set({ credit: sign * amt, reason: why }, sign > 0 ? t('انضاف الرصيد', 'Credit added') : t('انخصم الرصيد', 'Credit deducted'));
      };
    }
  }

  // ============================================================
  //  6) المالية
  // ============================================================
  const balCell = (b) => { b = +b || 0; if (Math.abs(b) < 0.005) return `<span class="bal zero">${esc(t('مصفّى', 'Settled'))}</span>`; return b > 0 ? `<span class="bal pos">${esc(t('لها', 'Owed to her'))} ${sarH(b)}</span>` : `<span class="bal neg">${esc(t('عليها', 'She owes'))} ${sarH(-b)}</span>`; };
  V.finance = async (el) => {
    const st = A.fin || (A.fin = { preset: 'month', from: PRESET.month()[0], to: today() });
    if (st.preset !== 'custom') [st.from, st.to] = PRESET[st.preset]();
    el.innerHTML = head(t('المالية', 'Finance'), t('حساب كل أسرة: مبيعاتها وعمولتها ورصيدها', 'Each kitchen: sales, commission and balance'),
      `<button class="btn btn-soft btn-sm" data-act="fin-csv">${ic('download', 's')}${esc(t('تصدير CSV', 'Export CSV'))}</button>${A.owner ? `<button class="btn btn-primary btn-sm" data-act="fin-payout">${ic('wallet', 's')}${esc(t('سجّل تحويل', 'Record payout'))}</button>` : ''}`) +
      rangeBar(st, FIN_PRESETS, 'fin') + `<div id="finBody">${skel(3)}</div>`;
    bindRange(el, 'fin', st, () => loadFinance());
    $('#finBody').addEventListener('click', (e) => {
      const po = e.target.closest('[data-po]');
      if (po) { const r = (A.finRows || []).find((x) => x.id === po.dataset.po); const bal = r ? +r.balance || 0 : 0; payoutSheet({ family_id: po.dataset.po, amount: bal, from: st.from, to: st.to, hint: bal ? (bal > 0 ? t(`رصيدها الحين ${sar(bal)} لها`, `Current balance ${sar(bal)} owed to her`) : t(`رصيدها الحين ${sar(-bal)} عليها`, `Current balance ${sar(-bal)} owed by her`)) : '' }, () => loadFinance()); return; }
      const row = e.target.closest('[data-famrow]');
      if (row && !e.target.closest('a,button')) openFamily(row.dataset.famrow, 'money');
    });
    await loadFinance();
  };
  async function loadFinance() {
    const box = $('#finBody'); if (!box) return;
    const st = A.fin, tok = A.tok;
    box.classList.add('dim');
    try {
      const [rows, pos] = await Promise.all([SF.rpc('sf_admin_finance', { p_from: st.from, p_to: st.to }), db().from('sf_payouts').select('*').order('created_at', { ascending: false }).limit(30)]);
      if (tok !== A.tok || !box.isConnected) return;
      A.finRows = rows || [];
      const tot = A.finRows.reduce((a, r) => { a.sub += +r.subtotal || 0; a.com += +r.commission || 0; a.ord += +r.orders || 0; const b = +r.balance || 0; if (b > 0) a.owe += b; else a.due -= b; return a; }, { sub: 0, com: 0, ord: 0, owe: 0, due: 0 });
      const k = (icon, label, v, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="k-l">${ic(icon)}<span>${esc(label)}</span></div><div class="k-v">${v}</div>${sub ? `<div class="k-s">${esc(sub)}</div>` : ''}</div>`;
      box.innerHTML = `
        <p class="range-note">${ic('calendar', 's')}<span>${esc(rangeLabel(st))}</span></p>
        <div class="kpis">
          ${k('wallet', t('المبيعات', 'Sales'), sarH(tot.sub), t(`قيمة الأكل من ${cnt(tot.ord, 'order')} مكتمل`, `food value from ${cnt(tot.ord, 'order')} completed`))}
          ${k('tag', t('عمولة المنصة', 'Platform commission'), sarH(tot.com), t('في الفترة', 'in this period'))}
          ${k('arrowL', t('علينا للأسر', 'We owe kitchens'), sarH(tot.owe), t('رصيد حالي من طلبات البطاقة', 'current balance from card orders'), 'k-pos')}
          ${k('arrowR', t('لنا عند الأسر', 'Kitchens owe us'), sarH(tot.due), t('رصيد حالي من عمولة الكاش', 'current balance from cash commission'), 'k-neg')}
        </div>
        ${A.finRows.length ? `<div class="table-wrap mt"><table class="t fin-t">
          <thead><tr><th>${esc(t('الأسرة', 'Kitchen'))}</th><th class="num">${esc(t('الطلبات', 'Orders'))}</th><th class="num">${esc(t('المبيعات', 'Sales'))}</th><th class="num">${esc(t('العمولة', 'Commission'))}</th><th class="num">${esc(t('صافي الأسرة', 'Kitchen net'))}</th><th>${esc(t('الرصيد الحالي', 'Current balance'))}</th><th class="num">${esc(t('المحوّل', 'Paid out'))}</th><th>${esc(t('الآيبان', 'IBAN'))}</th>${A.owner ? '<th></th>' : ''}</tr></thead>
          <tbody>${A.finRows.map((r) => `<tr class="click" data-famrow="${esc(r.id)}">
            <td><b>${esc(A.famById[r.id] ? SF.nm(A.famById[r.id], 'name') : r.name_ar)}</b><small>${esc(lb(L.famSt, r.status))}</small></td>
            <td class="num">${fmtN(r.orders, 0)}</td><td class="num">${sarH(r.subtotal)}</td><td class="num">${sarH(r.commission)}</td><td class="num">${sarH(r.net)}</td>
            <td>${balCell(r.balance)}</td><td class="num">${+r.paid_out ? sarH(r.paid_out) : '<span class="muted">0</span>'}</td>
            <td>${r.iban ? `<span class="mono ltr small">${esc(r.iban)}</span>` : `<span class="muted small">${esc(t('ما سجلت آيبان', 'No IBAN'))}</span>`}</td>
            ${A.owner ? `<td><button class="btn btn-ghost btn-sm" data-po="${esc(r.id)}">${ic('wallet', 's')}${esc(t('تحويل', 'Payout'))}</button></td>` : ''}
          </tr>`).join('')}</tbody></table></div>
          <p class="muted small fin-note">${esc(t('المبيعات والعمولة للفترة المختارة. الرصيد من البداية لين اليوم: «لها» يعني ندفع لها، و«عليها» يعني تحوّل لنا عمولة الكاش.', 'Sales and commission are for the chosen period. Balance is all time: «owed to her» means we pay her, «she owes» means she sends us the cash commission.'))}</p>`
          : `<div class="box mt">${empty('wallet', t('ما فيه أسر للحين', 'No kitchens yet'))}</div>`}
        <section class="box mt"><div class="box-h"><h3>${ic('list')}${esc(t('آخر التحويلات', 'Latest payouts'))}</h3></div>${payoutsList(need(pos) || [], true)}</section>`;
    } catch (e) { if (box.isConnected) box.innerHTML = errBox(e); }
    box.classList.remove('dim');
  }
  function downloadCSV(name, rows) {
    const csv = '﻿' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
    A.lastCSV = csv;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  ACT['fin-csv'] = () => {
    const rows = A.finRows || [];
    if (!rows.length) { SF.toast(t('ما فيه بيانات للتصدير', 'Nothing to export'), 'bad'); return; }
    const st = A.fin;
    downloadCSV(`sufrah-finance-${st.from}-${st.to}.csv`, [
      [t('الأسرة', 'Kitchen'), t('الحالة', 'Status'), t('الطلبات', 'Orders'), t('المبيعات', 'Sales'), t('العمولة', 'Commission'), t('صافي الأسرة', 'Kitchen net'), t('الرصيد الحالي (موجب لها، سالب عليها)', 'Current balance (+ owed to kitchen, - owed by kitchen)'), t('المحوّل', 'Paid out'), t('الآيبان', 'IBAN')],
      ...rows.map((r) => [A.famById[r.id] ? SF.nm(A.famById[r.id], 'name') : r.name_ar, lb(L.famSt, r.status), r.orders, r.subtotal, r.commission, r.net, r.balance, r.paid_out, r.iban || '']),
    ]);
    SF.toast(t('نزل ملف CSV', 'CSV downloaded'), 'ok');
  };
  ACT['fin-payout'] = () => payoutSheet({ from: A.fin ? A.fin.from : '', to: A.fin ? A.fin.to : '' }, () => { if (A.sec === 'finance') loadFinance(); });

  // ============================================================
  //  7) الشكاوى
  // ============================================================
  const CMP_CHIPS = [['open', 'مفتوحة', 'Open'], ['in_progress', 'قيد المعالجة', 'In progress'], ['resolved', 'محلولة', 'Resolved'], ['rejected', 'مرفوضة', 'Rejected'], ['all', 'الكل', 'All']];
  V.complaints = async (el) => {
    const f = A.cpf || (A.cpf = { st: 'open' });
    el.innerHTML = head(t('الشكاوى', 'Complaints'), t('اقرأ الشكوى، كلم العميل أو الأسرة، وسجّل ردك والحالة', 'Read it, contact the customer or kitchen, then record your reply and the status')) + `<div class="chips st-chips" id="cpchips"></div><div id="cplist">${skel(2)}</div>`;
    $('#cpchips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.st = b.dataset.st; renderComplaints(); });
    $('#cplist').addEventListener('click', (e) => { const b = e.target.closest('[data-cmp]'); if (b) openComplaint(b.dataset.cmp); });
    await loadComplaints();
    renderComplaints();
  };
  async function loadComplaints() { A.cmps = need(await db().from('sf_complaints').select('*').order('created_at', { ascending: false }).limit(300)) || []; await hydrateCmp(A.cmps); }
  async function hydrateCmp(list) {
    A.cmpO = A.cmpO || {}; A.cmpU = A.cmpU || {};
    const oids = [...new Set(list.map((c) => c.order_id).filter((x) => x && !A.cmpO[x]))];
    const uids = [...new Set(list.map((c) => c.user_id).filter((x) => x && !A.cmpU[x]))];
    const [o, p] = await Promise.all([
      oids.length ? db().from('sf_orders').select('id,order_no,customer_name,customer_phone,family_id,status,fulfillment,total').in('id', oids) : Promise.resolve({ data: [] }),
      uids.length ? db().from('sf_profiles').select('id,name,phone').in('id', uids) : Promise.resolve({ data: [] }),
    ]);
    (o.data || []).forEach((x) => { A.cmpO[x.id] = x; });
    (p.data || []).forEach((x) => { A.cmpU[x.id] = x; });
  }
  const cmpWho = (c) => { const u = A.cmpU && A.cmpU[c.user_id], o = A.cmpO && A.cmpO[c.order_id]; return (u && u.name) || (o && o.customer_name) || t('عميل', 'Customer'); };
  function renderComplaints() {
    const f = A.cpf, box = $('#cplist'); if (!box || !f) return;
    const counts = { all: A.cmps.length };
    A.cmps.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    $('#cpchips').innerHTML = CMP_CHIPS.map(([v, a, e]) => `<button class="chip ${f.st === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))} <span class="n">${counts[v] || 0}</span></button>`).join('');
    const rows = A.cmps.filter((x) => f.st === 'all' || x.status === f.st);
    box.innerHTML = rows.length ? `<div class="cmp-list">${rows.map((c) => { const o = A.cmpO[c.order_id]; return `<button class="cmp-row" data-cmp="${esc(c.id)}">
        <span class="cmp-ic s-${esc(c.status)}">${ic('chat')}</span>
        <div class="grow"><div class="cr-top"><b>${esc(lb(L.cmpKind, c.kind))}</b>${badge(L.cmpSt, c.status)}<small class="muted">${esc(SF.ago(c.created_at))}</small></div>
          <p class="clamp2">${esc(c.body)}</p>
          <small class="muted">${esc(cmpWho(c))}${c.family_id ? ' · ' + esc(famName(c.family_id)) : ''}${o ? ` · <span class="ltr">#${esc(o.order_no)}</span>` : ''}</small></div>
        ${ic('chevR', 's flip')}</button>`; }).join('')}</div>`
      : `<div class="box">${empty('chat', f.st === 'open' ? t('ما فيه شكاوى مفتوحة', 'No open complaints') : t('ما فيه شكاوى هنا', 'Nothing here'), f.st === 'open' ? t('كل شي تمام', 'All good') : '')}</div>`;
  }
  async function openComplaint(id) {
    const s = drawer(drLoading());
    let c;
    const render = () => {
      const o = A.cmpO[c.order_id], u = A.cmpU[c.user_id];
      let st = c.status;
      s.body.innerHTML = drHead(esc(lb(L.cmpKind, c.kind)), `${esc(SF.fmtDT(c.created_at))} · ${esc(SF.ago(c.created_at))}`, `<span class="dr-badges">${badge(L.cmpSt, c.status)}</span>`) + `
        <div class="dr-body">
          <section class="dr-sec"><h3>${ic('chat')}${esc(t('الشكوى', 'Complaint'))}</h3><p class="cmp-body">${esc(c.body)}</p>${c.photo_url ? `<a href="${esc(c.photo_url)}" target="_blank" rel="noopener" class="cmp-photo">${thumb(c.photo_url, 'xl')}</a>` : ''}</section>
          <section class="dr-sec"><h3>${ic('user')}${esc(t('الأطراف', 'People'))}</h3>
            ${kv([[t('العميل', 'Customer'), `${esc(cmpWho(c))}${c.user_id ? ` <button class="link" data-open-cust="${esc(c.user_id)}">${esc(t('ملفه', 'Profile'))}</button>` : ''}`],
              [t('جواله', 'Phone'), phoneCell((u && u.phone) || (o && o.customer_phone), t('أهلًا، معك فريق سُفرة بخصوص شكواك', 'Hi, this is the Sufrah team about your complaint'))],
              c.family_id ? [t('الأسرة', 'Kitchen'), `<button class="link" data-open-fam="${esc(c.family_id)}">${esc(famName(c.family_id))}</button>`] : null,
              o ? [t('الطلب', 'Order'), `<button class="link ltr" data-open-order="${esc(o.id)}">#${esc(o.order_no)}</button> ${SF.statusBadge(o.status, o.fulfillment)} ${sarH(o.total)}`] : null,
              c.resolved_at ? [t('انقفلت', 'Closed'), esc(SF.fmtDT(c.resolved_at))] : null])}
          </section>
          <section class="dr-sec"><h3>${ic('edit')}${esc(t('ردك والحالة', 'Your reply and status'))}</h3>
            <div class="seg seg-wrap" id="cmpSt">${['open', 'in_progress', 'resolved', 'rejected'].map((k) => `<button type="button" data-v="${k}" class="${st === k ? 'is-active' : ''}">${esc(lb(L.cmpSt, k))}</button>`).join('')}</div>
            ${field(t('رد الإدارة', 'Team reply'), `<textarea class="textarea" id="cmpNote" maxlength="1000" placeholder="${esc(t('وش سويتوا؟ مثل: رجعنا لك المبلغ كرصيد', 'What did you do? For example: we refunded you as credit'))}">${esc(c.admin_note || '')}</textarea>`, t('يشوفه العميل في صفحة شكاويه', 'The customer sees this on their complaints page'))}
          </section>
        </div>
        <div class="dr-foot"><button class="btn btn-primary grow" id="cmpSave">${ic('check', 's')}${esc(t('حفظ', 'Save'))}</button></div>`;
      s.sh.querySelector('#cmpSt').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st = b.dataset.v; $$('#cmpSt button', s.sh).forEach((x) => x.classList.toggle('is-active', x === b)); });
      s.sh.querySelector('#cmpSave').onclick = (e) => SF.busy(e.currentTarget, async () => {
        const note = s.sh.querySelector('#cmpNote').value.trim();
        const closed = st === 'resolved' || st === 'rejected';
        try {
          const r = await db().from('sf_complaints').update({ status: st, admin_note: note || null, resolved_at: closed ? (c.resolved_at || new Date().toISOString()) : null }).eq('id', c.id).select('*').maybeSingle();
          c = must(r);
          logUi('complaint_update', c.id, { status: st });
          SF.toast(t('انحفظت الشكوى', 'Complaint saved'), 'ok');
          const i = (A.cmps || []).findIndex((x) => x.id === c.id); if (i >= 0) A.cmps[i] = c;
          if (A.sec === 'complaints') renderComplaints();
          countsSoon();
          render();
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    };
    try {
      c = need(await db().from('sf_complaints').select('*').eq('id', id).maybeSingle());
      if (!c) { s.body.innerHTML = drHead(esc(t('الشكوى', 'Complaint'))) + `<div class="dr-body">${empty('chat', t('الشكوى غير موجودة', 'Complaint not found'))}</div>`; return; }
      await hydrateCmp([c]);
      render();
    } catch (e) { s.body.innerHTML = drHead(esc(t('الشكوى', 'Complaint'))) + `<div class="dr-body">${errBox(e)}</div>`; }
  }

  // ============================================================
  //  8) العروض (أكواد الخصم)
  // ============================================================
  const toLocalDT = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' }).replace(' ', 'T').slice(0, 16) : '');
  const fromLocalDT = (v) => (v ? new Date(v + ':00+03:00').toISOString() : null);
  const promoValue = (p) => (p.kind === 'pct' ? `${fmtN(p.value)}%${p.max_discount ? ' · ' + t(`بحد ${fmtN(p.max_discount)} ر.س`, `max SAR ${fmtN(p.max_discount)}`) : ''}` : sar(p.value));
  function promoState(p) {
    const now = Date.now(), used = A.promoUses[p.code] || 0;
    if (!p.active) return ['', t('موقف', 'Off')];
    if (p.ends_at && new Date(p.ends_at).getTime() < now) return ['', t('انتهى', 'Ended')];
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return ['b-info', t('يبدأ قريب', 'Starts later')];
    if (p.max_uses && used >= p.max_uses) return ['b-warn', t('خلص', 'Used up')];
    return ['b-ok', t('شغّال', 'Live')];
  }
  V.promos = async (el) => {
    el.innerHTML = head(t('العروض', 'Promo codes'), t('أكواد خصم يكتبها العميل وقت الطلب', 'Discount codes customers type at checkout'), `<button class="btn btn-primary" data-act="promo-new">${ic('plus', 's')}${esc(t('كود جديد', 'New code'))}</button>`) + `<div id="plist">${skel(2)}</div>`;
    $('#plist').addEventListener('click', (e) => { if (e.target.closest('.switch')) return; const b = e.target.closest('[data-promo]'); if (b) promoSheet(A.promos.find((p) => p.code === b.dataset.promo)); });
    $('#plist').addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-pactive]'); if (!inp) return;
      const code = inp.dataset.pactive;
      try {
        must(await db().from('sf_promos').update({ active: inp.checked }).eq('code', code).select('code'));
        const p = A.promos.find((x) => x.code === code); if (p) p.active = inp.checked;
        logUi('promo_save', code, { active: inp.checked });
        SF.toast(inp.checked ? t('الكود شغّال', 'Code is on') : t('الكود موقف', 'Code is off'), 'ok');
        renderPromos();
      } catch (er) { inp.checked = !inp.checked; SF.toast(errMsg(er), 'bad'); }
    });
    await loadPromos();
  };
  ACT['promo-new'] = () => promoSheet(null);
  async function loadPromos() {
    const [p, u] = await Promise.all([db().from('sf_promos').select('*').order('created_at', { ascending: false }), db().from('sf_promo_uses').select('code').limit(10000)]);
    A.promos = need(p) || [];
    A.promoUses = {};
    (need(u) || []).forEach((x) => { A.promoUses[x.code] = (A.promoUses[x.code] || 0) + 1; });
    renderPromos();
  }
  function renderPromos() {
    const box = $('#plist'); if (!box) return;
    if (!A.promos.length) { box.innerHTML = `<div class="box">${empty('tag', t('ما فيه أكواد خصم', 'No promo codes'), t('سو كود وشاركه مع عملائك في الواتساب أو انستقرام', 'Create a code and share it on WhatsApp or Instagram'), `<button class="btn btn-primary" data-act="promo-new">${ic('plus', 's')}${esc(t('كود جديد', 'New code'))}</button>`)}</div>`; return; }
    box.innerHTML = `<div class="table-wrap"><table class="t cards promos-t">
      <thead><tr><th>${esc(t('الكود', 'Code'))}</th><th>${esc(t('الخصم', 'Discount'))}</th><th class="num">${esc(t('أقل طلب', 'Min order'))}</th><th class="num">${esc(t('الاستخدام', 'Uses'))}</th><th>${esc(t('المدة', 'Dates'))}</th><th>${esc(t('الأسرة', 'Kitchen'))}</th><th>${esc(t('الحالة', 'Status'))}</th><th>${esc(t('مفعّل', 'On'))}</th></tr></thead>
      <tbody>${A.promos.map((p) => { const [cls, lbl] = promoState(p); const used = A.promoUses[p.code] || 0; return `<tr class="click" data-promo="${esc(p.code)}">
        <td class="c-code"><b class="mono code-chip">${esc(p.code)}</b>${p.first_order_only ? `<small>${esc(t('لأول طلب', 'First order'))}</small>` : ''}</td>
        <td class="c-disc"><b>${esc(promoValue(p))}</b></td>
        <td class="num c-min"><small class="only-m">${esc(t('أقل طلب', 'Min order'))}</small>${+p.min_subtotal ? sarH(p.min_subtotal) : '<span class="muted">0</span>'}</td>
        <td class="num c-uses"><b>${fmtN(used, 0)}</b>${p.max_uses ? ` / ${fmtN(p.max_uses, 0)}` : ''}<small>${esc(t(`${p.per_user} لكل عميل`, `${p.per_user} per customer`))}</small></td>
        <td class="small c-dates">${p.starts_at || p.ends_at ? `${p.starts_at ? esc(SF.fmtShort(p.starts_at)) : esc(t('من الحين', 'now'))} ${esc(t('إلى', 'to'))} ${p.ends_at ? esc(SF.fmtShort(p.ends_at)) : esc(t('بدون نهاية', 'no end'))}` : `<span class="muted">${esc(t('دايم', 'Always'))}</span>`}</td>
        <td class="small c-fam">${p.family_id ? esc(famName(p.family_id)) : `<span class="muted">${esc(t('كل الأسر', 'All'))}</span>`}</td>
        <td class="c-st"><span class="badge ${cls}">${esc(lbl)}</span></td>
        <td class="c-on">${sw('', p.active, `data-pactive="${esc(p.code)}" aria-label="${esc(t('مفعّل', 'On'))}"`)}</td>
      </tr>`; }).join('')}</tbody></table></div>`;
  }
  function promoSheet(p0) {
    const isNew = !p0;
    const p = p0 || { kind: 'fixed', per_user: 1, active: true, first_order_only: false, min_subtotal: 0 };
    const used = isNew ? 0 : A.promoUses[p.code] || 0;
    let kind = p.kind;
    const s = formSheet(`${fsHead(isNew ? t('كود خصم جديد', 'New promo code') : t('تعديل الكود', 'Edit code'), isNew ? t('العميل يكتب الكود وقت الطلب ويطلع له الخصم على طول', 'Customers type it at checkout and see the discount right away') : t(`انستخدم ${used} مرة`, `Used ${used} times`))}
      <form class="stack" id="pf" novalidate autocomplete="off">
        ${field(t('الكود', 'Code'), `<input class="input mono big-code" name="code" dir="ltr" maxlength="20" value="${esc(p.code || '')}" ${isNew ? '' : 'readonly'} placeholder="SUFRAH10" autocapitalize="characters" spellcheck="false">`, isNew ? t('حروف إنجليزية وأرقام بدون مسافات', 'Letters and numbers, no spaces') : '')}
        <div class="field"><span>${esc(t('نوع الخصم', 'Discount type'))}</span><div class="seg" id="pKind"><button type="button" data-v="fixed" class="${kind === 'fixed' ? 'is-active' : ''}">${esc(t('مبلغ ثابت', 'Fixed amount'))}</button><button type="button" data-v="pct" class="${kind === 'pct' ? 'is-active' : ''}">${esc(t('نسبة', 'Percentage'))}</button></div></div>
        <div class="fgrid">
          ${field(t('قيمة الخصم', 'Discount'), `<div class="input-sfx"><input class="input" name="value" inputmode="decimal" value="${esc(p.value ?? '')}"><span class="sfx" id="pUnit">${esc(kind === 'pct' ? '%' : U.sar())}</span></div>`)}
          ${field(t('أقصى خصم', 'Max discount'), sfx(`<input class="input" name="max_discount" inputmode="decimal" value="${esc(p.max_discount ?? '')}">`, U.sar()), t('للنسبة، فاضي = بدون حد', 'For percentages, empty = no cap'), 'pmax')}
          ${field(t('أقل طلب', 'Minimum order'), sfx(`<input class="input" name="min_subtotal" inputmode="decimal" value="${esc(p.min_subtotal ?? 0)}">`, U.sar()))}
          ${field(t('لكل عميل', 'Per customer'), `<input class="input" name="per_user" inputmode="numeric" value="${esc(p.per_user ?? 1)}">`, t('كم مرة يقدر العميل يستخدمه', 'Times one customer can use it'))}
          ${field(t('عدد الاستخدامات الكلي', 'Total uses'), `<input class="input" name="max_uses" inputmode="numeric" value="${esc(p.max_uses ?? '')}">`, t('فاضي = بدون حد', 'Empty = unlimited'))}
          ${field(t('لأسرة معينة', 'For one kitchen'), `<select class="select" name="family_id"><option value="">${esc(t('كل الأسر', 'All kitchens'))}</option>${famOptions(p.family_id || '', false)}</select>`)}
          ${field(t('يبدأ', 'Starts'), `<input type="datetime-local" class="input" name="starts_at" value="${esc(toLocalDT(p.starts_at))}">`, t('فاضي = من الحين', 'Empty = now'))}
          ${field(t('ينتهي', 'Ends'), `<input type="datetime-local" class="input" name="ends_at" value="${esc(toLocalDT(p.ends_at))}">`, t('فاضي = بدون نهاية', 'Empty = no end'))}
        </div>
        ${srow(t('لأول طلب بس', 'First order only'), t('للعملاء الجدد', 'For new customers'), sw('first_order_only', p.first_order_only))}
        ${srow(t('مفعّل', 'Active'), t('توقفه وقت ما تبي بدون ما تحذفه', 'Pause it any time without deleting'), sw('active', p.active))}
        ${field(t('ملاحظة للفريق', 'Team note'), `<input class="input" name="note" maxlength="120" value="${esc(p.note || '')}">`)}
        <div class="row">${!isNew && !used ? `<button type="button" class="btn btn-danger" id="pDel" aria-label="${esc(t('حذف الكود', 'Delete code'))}">${ic('trash', 's')}</button>` : ''}<button class="btn btn-primary btn-lg grow" type="submit" id="pGo">${ic('check', 's')}${esc(t('حفظ الكود', 'Save code'))}</button><button class="btn btn-ghost" type="button" data-close>${esc(t('رجوع', 'Back'))}</button></div>
      </form>`, { noFocus: !isNew });
    const form = s.sh.querySelector('#pf');
    const syncKind = () => { s.sh.querySelector('#pUnit').textContent = kind === 'pct' ? '%' : U.sar(); s.sh.querySelector('.pmax').classList.toggle('dim', kind !== 'pct'); };
    syncKind();
    s.sh.querySelector('#pKind').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; kind = b.dataset.v; $$('#pKind button', s.sh).forEach((x) => x.classList.toggle('is-active', x === b)); syncKind(); });
    form.code.addEventListener('input', () => { const c = form.code.selectionStart; form.code.value = form.code.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); form.code.setSelectionRange(c, c); });
    const del = s.sh.querySelector('#pDel');
    if (del) del.onclick = async () => {
      if (!(await SF.confirm({ title: t(`حذف الكود ${p.code}؟`, `Delete code ${p.code}?`), ok: t('احذف', 'Delete'), danger: true }))) return;
      try { must(await db().from('sf_promos').delete().eq('code', p.code).select('code')); logUi('promo_delete', p.code, null); s.close(); SF.toast(t('انحذف الكود', 'Code deleted'), 'ok'); loadPromos(); }
      catch (er) { SF.toast(errMsg(er), 'bad'); }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (k) => String(form[k].value || '').trim();
      const code = g('code').toUpperCase();
      const value = numOf(g('value')), maxD = numOf(g('max_discount')), minS = numOf(g('min_subtotal')) || 0, perU = numOf(g('per_user')), maxU = numOf(g('max_uses'));
      const starts = fromLocalDT(g('starts_at')), ends = fromLocalDT(g('ends_at'));
      const bad = (m) => SF.toast(m, 'bad');
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return bad(t('الكود من 3 إلى 20 حرف إنجليزي أو رقم', 'Code must be 3 to 20 letters or numbers'));
      if (isNew && A.promos.some((x) => x.code === code)) return bad(t('الكود موجود، اختر كود ثاني', 'This code exists, pick another'));
      if (!value || value <= 0 || (kind === 'pct' && value > 100)) return bad(kind === 'pct' ? t('النسبة من 1 إلى 100', 'Percentage must be 1 to 100') : t('اكتب قيمة الخصم', 'Enter the discount'));
      if (!perU || perU < 1) return bad(t('لكل عميل: مرة وحدة بالقليل', 'Per customer must be at least 1'));
      if (maxU != null && maxU < 1) return bad(t('عدد الاستخدامات لازم يكون 1 أو أكثر', 'Total uses must be 1 or more'));
      if (starts && ends && ends <= starts) return bad(t('النهاية لازم تكون بعد البداية', 'The end must be after the start'));
      const row = { kind, value, max_discount: kind === 'pct' ? maxD : null, min_subtotal: minS, per_user: Math.round(perU), max_uses: maxU != null ? Math.round(maxU) : null,
        starts_at: starts, ends_at: ends, first_order_only: form.first_order_only.checked, active: form.active.checked, family_id: g('family_id') || null, note: g('note') || null };
      SF.busy(s.sh.querySelector('#pGo'), async () => {
        try {
          if (isNew) must(await db().from('sf_promos').insert(Object.assign({ code }, row)).select('code'));
          else must(await db().from('sf_promos').update(row).eq('code', p.code).select('code'));
          logUi('promo_save', code, { kind, value, active: row.active });
          s.close();
          SF.toast(t('انحفظ الكود', 'Code saved'), 'ok');
          loadPromos();
        } catch (er) { SF.toast(er.raw && er.raw.code === '23505' ? t('الكود موجود، اختر كود ثاني', 'This code exists, pick another') : errMsg(er), 'bad'); }
      });
    });
  }

  // ============================================================
  //  9) الإشعارات الجماعية
  // ============================================================
  V.broadcasts = async (el) => {
    el.innerHTML = head(t('الإشعارات', 'Notifications'), t('أرسل إشعار للعملاء أو الأسر، يوصلهم في التطبيق وعلى جوالاتهم', 'Send a notification to customers or kitchens, in the app and on their phones')) + `
      ${A.owner ? '' : lockNote()}
      <div class="grid2 bc-grid"><section class="box" id="bcBox"></section><section class="box"><div class="box-h"><h3>${ic('eye')}${esc(t('كذا بيطلع', 'Preview'))}</h3></div><div id="bcPrev"></div></section></div>
      <section class="box mt"><div class="box-h"><h3>${ic('list')}${esc(t('الإشعارات المرسلة', 'Sent notifications'))}</h3></div><div id="bcHist">${skel(1)}</div></section>`;
    const st = { aud: 'customers', counts: null };
    const box = $('#bcBox');
    box.innerHTML = `
      <div class="box-h"><h3>${ic('send')}${esc(t('إشعار جديد', 'New notification'))}</h3></div>
      <form class="stack" id="bcForm" novalidate autocomplete="off">
        <div class="field"><span>${esc(t('لمين؟', 'Send to'))}</span><div class="seg" id="bcAud">${['customers', 'families', 'all'].map((k) => `<button type="button" data-v="${k}" class="${k === st.aud ? 'is-active' : ''}">${esc(lb(L.aud, k))} <span class="n" data-n="${k}"></span></button>`).join('')}</div>
          <small class="hint" id="bcHint">${esc(t('العملاء اللي وافقوا على العروض بس', 'Only customers who opted in to offers'))}</small></div>
        ${field(t('العنوان', 'Title'), `<input class="input" name="title" maxlength="80" placeholder="${esc(t('مثل: عزايم الويكند وصلت', 'For example: weekend feasts are here'))}" ${A.owner ? '' : 'disabled'}>`)}
        ${field(t('النص', 'Message'), `<textarea class="textarea" name="body" maxlength="300" ${A.owner ? '' : 'disabled'}></textarea>`)}
        ${field(t('رابط يفتح بالضغط', 'Link on tap'), `<input class="input" name="link" maxlength="300" dir="ltr" placeholder="?f=umfahad" ${A.owner ? '' : 'disabled'}>`, t('اختياري، مثل ⁦?f=umfahad⁩ يفتح صفحة الأسرة', 'Optional, for example ?f=umfahad opens a kitchen page'))}
        <button class="btn btn-primary btn-lg" type="submit" id="bcGo" ${A.owner ? '' : 'disabled'}>${ic('send', 's flip')}${esc(t('أرسل الإشعار', 'Send notification'))}</button>
      </form>`;
    const form = $('#bcForm');
    const prev = () => {
      const tt = form.title.value.trim(), bd = form.body.value.trim();
      $('#bcPrev').innerHTML = `<div class="np"><img src="img/mark.svg" alt=""><div class="grow"><div class="np-top"><b>${esc(t('سُفرة', 'Sufrah'))}</b><small>${esc(t('الحين', 'now'))}</small></div><b class="np-t">${esc(tt || t('عنوان الإشعار', 'Notification title'))}</b><p>${esc(bd || t('نص الإشعار يطلع هنا', 'The message shows here'))}</p></div></div>
        <p class="muted small np-n">${st.counts ? esc(t(`بيوصل لـ ${fmtN(st.counts[st.aud], 0)} شخص`, `Reaches ${fmtN(st.counts[st.aud], 0)} people`)) : ''}</p>`;
    };
    form.addEventListener('input', prev);
    const hints = { customers: t('العملاء اللي وافقوا على العروض بس', 'Only customers who opted in to offers'), families: t('حسابات الأسر وطاقمها اللي دخلوا التطبيق', 'Kitchen accounts and staff who signed in'), all: t('العملاء الموافقين والأسر', 'Opted in customers and kitchens') };
    $('#bcAud').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st.aud = b.dataset.v; $$('#bcAud button').forEach((x) => x.classList.toggle('is-active', x === b)); $('#bcHint').textContent = hints[st.aud]; prev(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!A.owner) return;
      const title = form.title.value.trim(), body = form.body.value.trim(), link = form.link.value.trim();
      if (title.length < 2) { SF.toast(t('اكتب عنوان الإشعار', 'Write a title'), 'bad'); form.title.focus(); return; }
      const n = st.counts ? st.counts[st.aud] : null;
      if (n === 0) { SF.toast(t('ما فيه أحد يوصله الإشعار في هالفئة', 'Nobody in this group would receive it'), 'bad'); return; }
      const ok = await SF.confirm({ title: t('إرسال الإشعار؟', 'Send this notification?'), body: n != null ? t(`بيوصل لـ ${fmtN(n, 0)} شخص من ${lb(L.aud, st.aud)}، وما ينسحب بعد الإرسال`, `It reaches ${fmtN(n, 0)} people in ${lb(L.aud, st.aud)} and cannot be recalled`) : t('ما ينسحب بعد الإرسال', 'It cannot be recalled'), ok: t('أرسل', 'Send') });
      if (!ok) return;
      SF.busy($('#bcGo'), async () => {
        try {
          const r = await SF.rpc('sf_admin_broadcast', { p: { audience: st.aud, title, body: body || null, link: link || null } });
          if (failed(r, 'ما انرسل الإشعار', 'Not sent')) return;
          SF.toast(t(`انرسل لـ ${fmtN(r.recipients, 0)} شخص`, `Sent to ${fmtN(r.recipients, 0)} people`), 'ok');
          form.reset(); prev(); loadBroadcasts();
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    });
    prev();
    audienceCounts().then((c) => { st.counts = c; $$('[data-n]').forEach((x) => { x.textContent = fmtN(c[x.dataset.n], 0); }); prev(); }).catch(() => {});
    await loadBroadcasts();
  };
  async function audienceCounts() {
    const staff = need(await db().from('sf_staff').select('user_id,active,family_id')) || [];
    const ids = staff.filter((s) => s.user_id).map((s) => s.user_id);
    let q = db().from('sf_profiles').select('id', { count: 'exact', head: true }).eq('marketing_ok', true).eq('blocked', false);
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
    const r = await q;
    const customers = r.count || 0;
    const families = new Set(staff.filter((s) => s.active && s.user_id && s.family_id).map((s) => s.user_id)).size;
    return { customers, families, all: customers + families };
  }
  async function loadBroadcasts() {
    const box = $('#bcHist'); if (!box) return;
    try {
      const rows = need(await db().from('sf_broadcasts').select('*').order('created_at', { ascending: false }).limit(50)) || [];
      box.innerHTML = rows.length ? `<div class="table-wrap flat"><table class="t">
        <thead><tr><th>${esc(t('الوقت', 'Time'))}</th><th>${esc(t('لمين', 'To'))}</th><th>${esc(t('الإشعار', 'Notification'))}</th><th class="num">${esc(t('وصل لـ', 'Recipients'))}</th></tr></thead>
        <tbody>${rows.map((b) => `<tr><td class="small">${esc(SF.fmtDT(b.created_at))}</td><td>${esc(lb(L.aud, b.audience))}</td><td class="wrap"><b>${esc(b.title)}</b>${b.body ? `<small>${esc(b.body)}</small>` : ''}${b.link ? `<small class="ltr">${esc(b.link)}</small>` : ''}</td><td class="num"><b>${fmtN(b.recipients, 0)}</b></td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted small">${esc(t('ما أرسلت إشعارات للحين', 'No notifications sent yet'))}</p>`;
    } catch (e) { box.innerHTML = errBox(e); }
  }

  // ============================================================
  //  10) الإعدادات
  // ============================================================
  const SETTINGS = [
    { id: 'pay', icon: 'wallet', ar: 'الدفع', en: 'Payments', items: [
      { k: 'pay_cod_enabled', ty: 'bool', ar: 'الدفع عند الاستلام', en: 'Cash on delivery', h: ['العميل يدفع كاش للأسرة وقت الاستلام', 'The customer pays the kitchen in cash on delivery'] },
      { k: 'pay_cod_max', ty: 'num', u: 'sar', ar: 'أعلى مبلغ للكاش', en: 'Cash limit', h: ['الطلب الأعلى منه يحتاج دفع بالبطاقة', 'Orders above this need card payment'] },
      { k: 'pay_card_enabled', ty: 'bool', ar: 'الدفع بالبطاقة', en: 'Card payments', h: ['مدى وفيزا وأبل باي عن طريق ميسر، شغّله بعد ربط الحساب', 'mada, Visa and Apple Pay via Moyasar, turn on once the account is linked'] },
      { k: 'pay_timeout_min', ty: 'num', u: 'min', ar: 'مهلة الدفع', en: 'Payment timeout', h: ['طلب البطاقة اللي ما اندفع خلالها ينلغي لحاله', 'Unpaid card orders are cancelled after this'] },
    ] },
    { id: 'orders', icon: 'receipt', ar: 'الطلبات', en: 'Orders', items: [
      { k: 'accept_timeout_min', ty: 'num', u: 'min', ar: 'مهلة قبول الطلب الفوري', en: 'Accept time, ASAP orders', h: ['لو الأسرة ما قبلت خلالها ينلغي الطلب ويوصل العميل إشعار', 'If the kitchen does not accept in time the order is cancelled'] },
      { k: 'accept_timeout_sched_min', ty: 'num', u: 'min', ar: 'مهلة قبول الطلب المجدول', en: 'Accept time, scheduled orders', h: ['للطلبات اللي لها موعد لاحق', 'For orders booked for later'] },
      { k: 'slot_minutes', ty: 'num', u: 'min', ar: 'طول فترة الموعد', en: 'Time slot length', h: ['60 تعني فترات ساعة، مثل 1 إلى 2', '60 means one hour slots, like 1 to 2'] },
      { k: 'delivery_eta_min', ty: 'num', u: 'min', ar: 'متوسط وقت التوصيل', en: 'Average delivery time', h: ['ينضاف لوقت التجهيز في الوقت المتوقع للعميل', 'Added to prep time in the customer ETA'] },
      { k: 'asap_max_lead_min', ty: 'num', u: 'min', ar: 'أطول تجهيز للطلب الفوري', en: 'Longest prep for ASAP', h: ['الأطباق اللي تحتاج وقت أطول تنطلب بموعد بس', 'Dishes that take longer can only be scheduled'] },
    ] },
    { id: 'fees', icon: 'tag', ar: 'الرسوم', en: 'Fees', items: [
      { k: 'commission_pct', ty: 'num', u: 'pct', max: 100, ar: 'عمولة المنصة', en: 'Platform commission', h: ['نسبة من قيمة الأكل، وتقدر تحدد نسبة خاصة لكل أسرة من صفحتها', 'A share of the food value, you can set a custom rate per kitchen'] },
      { k: 'small_order_threshold', ty: 'num', u: 'sar', ar: 'حد الطلب الصغير', en: 'Small order threshold', h: ['الطلب الأقل منه تنضاف عليه رسوم، 0 يعني بدون', 'Orders below this get a fee, 0 means off'] },
      { k: 'small_order_fee', ty: 'num', u: 'sar', ar: 'رسوم الطلب الصغير', en: 'Small order fee' },
      { k: 'road_factor', ty: 'num', step: '0.05', ar: 'معامل مسافة الطريق', en: 'Road distance factor', h: ['المسافة المباشرة ضرب المعامل تعطي مسافة الطريق التقريبية لرسوم التوصيل', 'Straight distance times this gives the approximate road distance'] },
    ] },
    { id: 'promo', icon: 'gift', ar: 'العروض والرصيد', en: 'Offers and credit', items: [
      { k: 'welcome_discount', ty: 'num', u: 'sar', ar: 'خصم أول طلب', en: 'First order discount', h: ['ينخصم من أول طلب للعميل، 0 يعني بدون', 'Taken off a customer\'s first order, 0 means off'] },
      { k: 'credits_enabled', ty: 'bool', ar: 'رصيد العملاء', en: 'Customer credit', h: ['العميل يقدر يستخدم رصيده وقت الطلب', 'Customers can spend their credit at checkout'] },
      { k: 'referral_enabled', ty: 'bool', ar: 'دعوة صديق', en: 'Invite a friend', h: ['كل عميل له كود يشاركه مع أصحابه', 'Every customer gets a code to share'] },
      { k: 'referral_friend_credit', ty: 'num', u: 'sar', ar: 'هدية الصديق الجديد', en: 'New friend gift', h: ['رصيد ياخذه الصديق أول ما يستخدم الكود', 'Credit the friend gets on using the code'] },
      { k: 'referral_reward_credit', ty: 'num', u: 'sar', ar: 'مكافأة اللي دعاه', en: 'Referrer reward', h: ['بعد أول طلب مكتمل للصديق', 'After the friend\'s first completed order'] },
    ] },
    { id: 'vat', icon: 'file', ar: 'الضريبة والفاتورة', en: 'VAT and invoice', items: [
      { k: 'vat_registered', ty: 'bool', ar: 'مسجل في ضريبة القيمة المضافة', en: 'VAT registered', h: ['لو شغّلته تنضاف الضريبة للطلبات ويطلع رمز الفاتورة', 'When on, VAT is added and the invoice QR shows'] },
      { k: 'vat_pct', ty: 'num', u: 'pct', max: 100, ar: 'نسبة الضريبة', en: 'VAT rate' },
      { k: 'vat_number', ty: 'text', ltr: true, ar: 'الرقم الضريبي', en: 'VAT number' },
      { k: 'legal_name', ty: 'text', ar: 'الاسم النظامي', en: 'Legal name', h: ['يطلع في رأس الفاتورة', 'Shown on the invoice header'] },
      { k: 'cr_number', ty: 'text', ltr: true, ar: 'رقم السجل التجاري', en: 'CR number' },
    ] },
    { id: 'ui', icon: 'home', ar: 'الواجهة', en: 'App front', items: [
      { k: 'app_name', ty: 'text', ar: 'اسم التطبيق بالعربي', en: 'App name, Arabic' },
      { k: 'app_name_en', ty: 'text', ltr: true, ar: 'اسم التطبيق بالإنجليزي', en: 'App name, English' },
      { k: 'tagline_ar', ty: 'text', ar: 'الشعار بالعربي', en: 'Tagline, Arabic' },
      { k: 'tagline_en', ty: 'text', ltr: true, ar: 'الشعار بالإنجليزي', en: 'Tagline, English' },
      { k: 'home_note_ar', ty: 'area', ar: 'جملة الرئيسية بالعربي', en: 'Home line, Arabic', h: ['تطلع تحت الترحيب في أول صفحة', 'Shown under the greeting on the home page'] },
      { k: 'home_note_en', ty: 'area', ltr: true, ar: 'جملة الرئيسية بالإنجليزي', en: 'Home line, English' },
      { k: 'support_whatsapp', ty: 'phone', ar: 'واتساب الدعم', en: 'Support WhatsApp', h: ['يطلع للعملاء في حسابهم، وفاضي يعني يختفي', 'Shown to customers in their account, empty hides it'] },
      { k: 'app_url', ty: 'text', ltr: true, wide: true, ar: 'رابط التطبيق', en: 'App link', h: ['يستخدم في الروابط والرسائل', 'Used in links and messages'] },
      { k: 'maintenance', ty: 'bool', danger: true, ar: 'إيقاف الطلبات مؤقتًا', en: 'Pause ordering', h: ['العملاء يشوفون رسالة صيانة وما يقدرون يطلبون', 'Customers see a maintenance notice and cannot order'] },
    ] },
    { id: 'wa', icon: 'whatsapp', ar: 'بوت الواتساب', en: 'WhatsApp bot', items: [
      { k: 'wa_enabled', ty: 'bool', ar: 'تشغيل البوت', en: 'Bot on', h: ['يرد على العملاء وينبه الأسر بالطلبات، ويحتاج ربط رقم واتساب', 'Answers customers and alerts kitchens, needs a linked WhatsApp number'] },
      { k: 'wa_welcome_days', ty: 'num', u: 'd', ar: 'تكرار الترحيب', en: 'Welcome repeat', h: ['كل كم يوم ينعاد الترحيب لنفس الرقم', 'Days before the same number is welcomed again'] },
      { k: 'wa_pause_hours', ty: 'num', u: 'h', ar: 'سكوت البوت بعد ردك', en: 'Bot pause after your reply', h: ['لما ترد بنفسك يسكت البوت هالمدة', 'The bot stays quiet this long after you reply yourself'] },
      { k: 'wa_tpl_family_order', ty: 'text', ltr: true, ar: 'قالب تنبيه الأسرة بطلب جديد', en: 'Kitchen new order template', h: ['اسم القالب المعتمد في واتساب للأعمال', 'The approved template name in WhatsApp Business'] },
      { k: 'wa_tpl_lang', ty: 'select', opts: [['ar', 'العربية', 'Arabic'], ['en', 'الإنجليزية', 'English']], ar: 'لغة القوالب', en: 'Template language' },
    ] },
    { id: 'adv', icon: 'settings', ar: 'متقدم', en: 'Advanced', items: [
      { k: 'vapid_public', ty: 'text', ltr: true, mono: true, wide: true, ar: 'مفتاح إشعارات المتصفح', en: 'Web push key', h: ['ينضبط مع إعداد الخادم، لا تغيّره إلا لو طلبه منك المطور', 'Set with the server setup, change it only if the developer asks'] },
    ] },
  ];
  const isOn = (v) => !(v == null || v === '' || /^(0|false|off|no)$/i.test(String(v).trim()));
  function setField(it, val) {
    const dis = A.owner ? '' : 'disabled';
    const a = `data-k="${esc(it.k)}" data-ty="${it.ty}" ${dis}`;
    let ctl;
    if (it.ty === 'bool') ctl = sw('', isOn(val), a);
    else if (it.ty === 'num') { const inp = `<input class="input" ${a} inputmode="decimal" value="${esc(val ?? '')}">`; ctl = it.u ? sfx(inp, U[it.u]()) : inp; }
    else if (it.ty === 'area') ctl = `<textarea class="textarea" ${a} maxlength="400" ${it.ltr ? 'dir="ltr"' : /_ar$/.test(it.k) ? 'dir="rtl"' : ''}>${esc(val ?? '')}</textarea>`;
    else if (it.ty === 'phone') ctl = `<div class="input-group"><span class="addon">+966</span><input class="input" ${a} type="tel" inputmode="numeric" dir="ltr" placeholder="05XXXXXXXX" value="${esc(val ? SF.showPhone(val) : '')}"></div>`;
    else if (it.ty === 'select') ctl = `<select class="select" ${a}>${it.opts.map(([v, ar, en]) => `<option value="${esc(v)}" ${String(val) === v ? 'selected' : ''}>${esc(t(ar, en))}</option>`).join('')}</select>`;
    else ctl = `<input class="input ${it.mono ? 'mono' : ''}" ${a} ${it.ltr ? 'dir="ltr"' : /_ar$|^app_name$/.test(it.k) ? 'dir="rtl"' : ''} value="${esc(val ?? '')}" maxlength="400">`;
    const wide = it.ty === 'area' || it.wide;
    return `<div class="sfield ${it.ty === 'bool' ? 'is-bool' : ''} ${wide ? 'wide' : ''} ${it.danger ? 'danger' : ''}" data-row="${esc(it.k)}"><div class="sl"><b>${esc(t(it.ar, it.en))}</b>${it.h ? `<small>${esc(t(it.h[0], it.h[1]))}</small>` : ''}</div><div class="ctl">${ctl}</div></div>`;
  }
  function readSet(el) {
    const ty = el.dataset.ty;
    if (ty === 'bool') return el.checked ? '1' : '0';
    if (ty === 'num') { const n = numOf(el.value); return n == null ? '' : String(n); }
    if (ty === 'phone') { const v = el.value.trim(); if (!v) return ''; return SF.normPhone(v) || '!bad'; }
    return el.value.trim();
  }
  function setSame(ty, orig, now) {
    if (ty === 'bool') return isOn(orig) === (now === '1');
    if (ty === 'num') return (orig == null || orig === '' ? '' : String(numOf(orig))) === now;
    if (ty === 'phone') return (SF.normPhone(orig) || '') === now;
    return String(orig ?? '').trim() === now;
  }
  V.settings = async (el) => {
    const [s, c, k] = await Promise.all([db().from('sf_settings').select('key,value,is_public,note,updated_at').order('key'), db().from('sf_cities').select('*').order('sort'), db().from('sf_categories').select('*').order('sort')]);
    const rows = need(s) || [];
    A.cities = need(c) || A.cities; A.cats = need(k) || A.cats;
    A.settingsAll = Object.fromEntries(rows.map((x) => [x.key, x.value]));
    const known = new Set(SETTINGS.flatMap((g) => g.items.map((i) => i.k)));
    const extra = rows.filter((x) => !known.has(x.key)).map((x) => ({ k: x.key, ty: 'text', ltr: true, ar: x.note || x.key, en: x.key, h: [x.key, x.note || ''] }));
    const groups = SETTINGS.map((g) => (g.id === 'adv' ? Object.assign({}, g, { items: g.items.concat(extra) }) : g)).map((g) => Object.assign({}, g, { items: g.items.filter((i) => i.k in A.settingsAll) })).filter((g) => g.items.length);
    el.innerHTML = `<div id="setRoot">${head(t('الإعدادات', 'Settings'), t('كل أرقام التشغيل في مكان واحد. غيّر اللي تبي واضغط حفظ', 'Every operating number in one place. Change what you need, then save'))}
      ${A.owner ? '' : lockNote()}
      <nav class="chips set-jump">${groups.map((g) => `<a class="chip" href="#set-${g.id}" data-jump="${g.id}">${ic(g.icon, 's')}${esc(t(g.ar, g.en))}</a>`).join('')}<a class="chip" href="#set-cities" data-jump="cities">${ic('pin', 's')}${esc(t('المدن', 'Cities'))}</a><a class="chip" href="#set-cats" data-jump="cats">${ic('list', 's')}${esc(t('التصنيفات', 'Categories'))}</a></nav>
      <div class="sgrid">${groups.map((g) => `<section class="box sbox" id="set-${g.id}"><div class="box-h"><h3>${ic(g.icon)}${esc(t(g.ar, g.en))}</h3></div>${g.items.map((it) => setField(it, A.settingsAll[it.k])).join('')}</section>`).join('')}</div>
      <div class="sgrid mt"><section class="box" id="set-cities"></section><section class="box" id="set-cats"></section></div>
      <div class="savebar" id="saveBar" role="region" aria-live="polite"><span id="sbTxt"></span><span class="grow"></span><button class="btn btn-ghost btn-sm sb-undo" id="sbUndo">${esc(t('تراجع', 'Undo'))}</button><button class="btn btn-primary" id="sbSave">${ic('check', 's')}${esc(t('حفظ الإعدادات', 'Save settings'))}</button></div></div>`;
    const sroot = $('#setRoot');
    const items = groups.flatMap((g) => g.items);
    const changes = () => {
      const out = {};
      $$('[data-k]', sroot).forEach((inp) => { const it = items.find((x) => x.k === inp.dataset.k); const v = readSet(inp); const same = setSame(inp.dataset.ty, A.settingsAll[inp.dataset.k], v); inp.closest('.sfield').classList.toggle('changed', !same); if (!same) out[inp.dataset.k] = v; if (it && it.max && numOf(v) > it.max) out[inp.dataset.k] = '!max'; });
      return out;
    };
    const paint = () => { const ch = changes(); const n = Object.keys(ch).length; $('#saveBar').classList.toggle('on', n > 0); $('#sbTxt').textContent = t(`عندك ${n === 1 ? 'تعديل واحد' : n === 2 ? 'تعديلين' : n + ' تعديلات'} ما انحفظت`, `${n} unsaved change${n === 1 ? '' : 's'}`); };
    sroot.addEventListener('input', (e) => { if (e.target.closest('.sbox')) paint(); });
    sroot.addEventListener('change', (e) => { if (e.target.closest('.sbox')) paint(); });
    sroot.querySelector('.set-jump').addEventListener('click', (e) => { const a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault(); const tgt = $('#set-' + a.dataset.jump); if (tgt) window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' }); });
    $('#sbUndo').onclick = () => route();
    $('#sbSave').onclick = (e) => {
      const ch = changes();
      const keys = Object.keys(ch); if (!keys.length) return;
      if (keys.some((x) => ch[x] === '!bad')) { SF.toast(t('رقم الواتساب لازم يكون جوال سعودي يبدأ بـ 05', 'The WhatsApp number must be a Saudi mobile starting with 05'), 'bad'); return; }
      if (keys.some((x) => ch[x] === '!max')) { SF.toast(t('النسبة ما تزيد عن 100', 'Percentages cannot exceed 100'), 'bad'); return; }
      const neg = keys.find((x) => { const it = items.find((i) => i.k === x); return it && it.ty === 'num' && ch[x] !== '' && +ch[x] < 0; });
      if (neg) { SF.toast(t('الأرقام ما تكون بالسالب', 'Numbers cannot be negative'), 'bad'); return; }
      SF.busy(e.currentTarget, async () => {
        try {
          const r = await SF.rpc('sf_admin_settings_save', { p: ch });
          if (failed(r)) return;
          SF.toast(t('انحفظت الإعدادات', 'Settings saved'), 'ok');
          SF.loadSettings(true).catch(() => {});
          const y = window.scrollY;
          await route();
          window.scrollTo(0, y);
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    };
    renderCities();
    renderCats();
    $('#set-cities').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) cityAction(b.dataset.x, b.closest('[data-city]').dataset.city, b); });
    $('#set-cities').addEventListener('change', (e) => { const i = e.target.closest('[data-city-active]'); if (i) cityActive(i); });
    $('#set-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) catAction(b.dataset.x, b.closest('[data-cat]') ? b.closest('[data-cat]').dataset.cat : null, b); });
    $('#set-cats').addEventListener('change', (e) => catChange(e));
  };
  function renderCities() {
    const box = $('#set-cities'); if (!box) return;
    const dis = A.owner ? '' : 'disabled';
    const nFam = (id) => A.fams.filter((f) => f.city_id === id && f.status === 'active').length;
    box.innerHTML = `<div class="box-h"><h3>${ic('pin')}${esc(t('المدن', 'Cities'))}</h3><span class="muted small">${esc(t('المفعلة تطلع للعملاء', 'Active cities show to customers'))}</span></div>
      <div class="mlist">${A.cities.map((c, i) => `<div class="mrow ${c.active ? '' : 'off'}" data-city="${esc(c.id)}">
        <div class="ord"><button type="button" class="icon-btn sm" data-x="up" ${i === 0 || dis ? 'disabled' : ''} aria-label="${esc(t('لفوق', 'Move up'))}">${ic('chevD', 's rot')}</button><button type="button" class="icon-btn sm" data-x="down" ${i === A.cities.length - 1 || dis ? 'disabled' : ''} aria-label="${esc(t('لتحت', 'Move down'))}">${ic('chevD', 's')}</button></div>
        <div class="grow"><b>${esc(SF.nm(c, 'name'))}</b><small>${esc(SF.lang === 'en' ? c.name_ar : c.name_en || '')} · ${esc(t(`${nFam(c.id)} أسرة نشطة`, `${nFam(c.id)} active kitchens`))}</small></div>
        ${sw('', c.active, `data-city-active="${esc(c.id)}" ${dis} aria-label="${esc(t('مفعلة', 'Active'))}"`)}
      </div>`).join('')}</div>`;
  }
  async function cityActive(inp) {
    const id = inp.dataset.cityActive;
    try {
      must(await db().from('sf_cities').update({ active: inp.checked }).eq('id', id).select('id'));
      const c = A.cities.find((x) => x.id === id); if (c) c.active = inp.checked;
      logUi('city_edit', id, { active: inp.checked });
      SF.toast(inp.checked ? t('تفعّلت المدينة', 'City activated') : t('توقفت المدينة', 'City deactivated'), 'ok');
      renderCities();
    } catch (er) { inp.checked = !inp.checked; SF.toast(errMsg(er), 'bad'); }
  }
  async function reorder(table, list, id, dir, key) {
    const i = list.findIndex((x) => x[key] === id), j = i + (dir === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return false;
    const next = list.slice(); [next[i], next[j]] = [next[j], next[i]];
    const ups = next.map((x, k) => ({ x, sort: k + 1 })).filter((o) => o.x.sort !== o.sort);
    for (const o of ups) must(await db().from(table).update({ sort: o.sort }).eq(key, o.x[key]).select(key));
    ups.forEach((o) => { o.x.sort = o.sort; });
    list.sort((a, b) => a.sort - b.sort);
    return true;
  }
  async function cityAction(x, id, b) {
    await SF.busy(b, async () => {
      try { if (await reorder('sf_cities', A.cities, id, x, 'id')) { logUi('city_edit', id, { move: x }); renderCities(); } }
      catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function renderCats() {
    const box = $('#set-cats'); if (!box) return;
    const dis = A.owner ? '' : 'disabled';
    box.innerHTML = `<div class="box-h"><h3>${ic('list')}${esc(t('التصنيفات', 'Categories'))}</h3>${A.owner ? `<button type="button" class="btn btn-soft btn-sm" data-x="add">${ic('plus', 's')}${esc(t('تصنيف', 'Category'))}</button>` : ''}</div>
      <p class="muted small">${esc(t('الصورة تطلع في صف التصنيفات بالرئيسية، والاسم ينحفظ لما تطلع من الخانة', 'The photo shows in the home categories row, names save when you leave the box'))}</p>
      <div class="mlist">${A.cats.map((c, i) => `<div class="mrow cat-row ${c.active ? '' : 'off'}" data-cat="${esc(c.id)}">
        <div class="ord"><button type="button" class="icon-btn sm" data-x="up" ${i === 0 || dis ? 'disabled' : ''} aria-label="${esc(t('لفوق', 'Move up'))}">${ic('chevD', 's rot')}</button><button type="button" class="icon-btn sm" data-x="down" ${i === A.cats.length - 1 || dis ? 'disabled' : ''} aria-label="${esc(t('لتحت', 'Move down'))}">${ic('chevD', 's')}</button></div>
        <label class="cat-img ${dis ? 'dis' : ''}" title="${esc(t('غيّر الصورة', 'Change photo'))}">${thumb(c.image_url, 'l')}<span class="cam">${ic('camera', 's')}</span>${dis ? '' : `<input type="file" accept="image/*" data-cat-img="${esc(c.id)}" hidden>`}</label>
        <div class="grow cat-names"><input class="input" data-cat-f="name_ar" value="${esc(c.name_ar)}" maxlength="40" dir="rtl" ${dis} aria-label="${esc(t('الاسم بالعربي', 'Arabic name'))}"><input class="input" data-cat-f="name_en" value="${esc(c.name_en || '')}" maxlength="40" dir="ltr" ${dis} aria-label="${esc(t('الاسم بالإنجليزي', 'English name'))}"></div>
        ${sw('', c.active, `data-cat-active="${esc(c.id)}" ${dis} aria-label="${esc(t('مفعل', 'Active'))}"`)}
      </div>`).join('')}</div>`;
  }
  async function catChange(e) {
    const el = e.target;
    const row = el.closest('[data-cat]'); if (!row) return;
    const id = row.dataset.cat, c = A.cats.find((x) => x.id === id); if (!c) return;
    const save = async (patch, msg) => {
      try { must(await db().from('sf_categories').update(patch).eq('id', id).select('id')); Object.assign(c, patch); logUi('category_edit', id, patch); SF.toast(msg || t('انحفظ', 'Saved'), 'ok'); return true; }
      catch (er) { SF.toast(errMsg(er), 'bad'); return false; }
    };
    if (el.matches('[data-cat-active]')) { if (!(await save({ active: el.checked }, el.checked ? t('التصنيف ظاهر', 'Category shown') : t('التصنيف مخفي', 'Category hidden')))) el.checked = !el.checked; renderCats(); return; }
    if (el.matches('[data-cat-f]')) {
      const f = el.dataset.catF, v = el.value.trim();
      if (f === 'name_ar' && v.length < 2) { SF.toast(t('اكتب اسم التصنيف', 'Enter the category name'), 'bad'); el.value = c.name_ar; return; }
      if ((c[f] || '') === v) return;
      if (!(await save({ [f]: v || null }))) el.value = c[f] || '';
      return;
    }
    if (el.matches('[data-cat-img]')) {
      const file = el.files && el.files[0]; if (!file) return;
      row.classList.add('busy');
      try {
        const url = await SF.uploadImage('categories', file, { maxDim: 600 });
        await save({ image_url: url }, t('انحفظت الصورة', 'Photo saved'));
        renderCats();
      } catch (er) { SF.toast(errMsg(er), 'bad'); row.classList.remove('busy'); }
    }
  }
  async function catAction(x, id, b) {
    if (x === 'up' || x === 'down') {
      await SF.busy(b, async () => { try { if (await reorder('sf_categories', A.cats, id, x, 'id')) { logUi('category_edit', id, { move: x }); renderCats(); } } catch (er) { SF.toast(errMsg(er), 'bad'); } });
      return;
    }
    if (x === 'add') {
      const s = formSheet(`${fsHead(t('تصنيف جديد', 'New category'))}
        <div class="stack">
          ${field(t('الاسم بالعربي', 'Arabic name'), `<input class="input" id="ncAr" maxlength="40" dir="rtl">`)}
          ${field(t('الاسم بالإنجليزي', 'English name'), `<input class="input" id="ncEn" maxlength="40" dir="ltr">`)}
          ${field(t('رمز التصنيف', 'Category id'), `<input class="input mono" id="ncId" maxlength="30" dir="ltr" placeholder="soups">`, t('حروف إنجليزية صغيرة، ما يتغير بعدين', 'Lowercase letters, cannot change later'))}
          <div class="row"><button class="btn btn-primary btn-lg grow" id="ncGo">${ic('plus', 's')}${esc(t('أضف', 'Add'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>
        </div>`);
      const q = (sel) => s.sh.querySelector(sel);
      q('#ncEn').addEventListener('input', () => { if (!q('#ncId').dataset.touched) q('#ncId').value = q('#ncEn').value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30); });
      q('#ncId').addEventListener('input', () => { q('#ncId').dataset.touched = '1'; });
      q('#ncGo').onclick = () => {
        const ar = q('#ncAr').value.trim(), en = q('#ncEn').value.trim(), cid = q('#ncId').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (ar.length < 2) { SF.toast(t('اكتب الاسم بالعربي', 'Enter the Arabic name'), 'bad'); return; }
        if (cid.length < 2) { SF.toast(t('اكتب رمز التصنيف بالإنجليزي', 'Enter the category id'), 'bad'); return; }
        if (A.cats.some((y) => y.id === cid)) { SF.toast(t('الرمز مستخدم', 'This id is taken'), 'bad'); return; }
        SF.busy(q('#ncGo'), async () => {
          try {
            const r = await db().from('sf_categories').insert({ id: cid, name_ar: ar, name_en: en || null, sort: A.cats.reduce((m, y) => Math.max(m, y.sort || 0), 0) + 1, active: true }).select('*').maybeSingle();
            A.cats.push(must(r));
            logUi('category_add', cid, { name_ar: ar });
            s.close();
            SF.toast(t('انضاف التصنيف، أضف له صورة', 'Category added, now add a photo'), 'ok');
            renderCats();
          } catch (er) { SF.toast(errMsg(er), 'bad'); }
        });
      };
    }
  }

  // ============================================================
  //  11) الفريق
  // ============================================================
  const TEAM_CHIPS = [['admin', 'الإدارة', 'Admin team'], ['family', 'طاقم الأسر', 'Kitchen staff'], ['all', 'الكل', 'All']];
  V.team = async (el) => {
    await Promise.all([reloadStaff(), reloadFams()]);
    const f = A.tf || (A.tf = { st: 'admin' });
    el.innerHTML = head(t('الفريق', 'Team'), t('اللي يدخلون لوحة الإدارة وتطبيق الأسر بأرقامهم', 'Everyone who signs in to the admin panel or the kitchen app'), A.owner ? `<button class="btn btn-primary" data-act="staff-new">${ic('plus', 's')}${esc(t('أضف شخص', 'Add person'))}</button>` : '') +
      (A.owner ? '' : lockNote()) + `<div class="chips st-chips" id="tchips"></div><div id="tlist"></div>`;
    $('#tchips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.st = b.dataset.st; renderTeam(); });
    $('#tlist').addEventListener('click', (e) => { const b = e.target.closest('[data-staff]'); if (b && A.owner) staffSheet(A.staff.find((x) => x.id === b.dataset.staff)); });
    renderTeam();
  };
  ACT['staff-new'] = () => staffSheet(null);
  function renderTeam() {
    const f = A.tf, box = $('#tlist'); if (!box || !f) return;
    const isAdm = (x) => x.role === 'admin' || x.role === 'support';
    const counts = { all: A.staff.length, admin: A.staff.filter(isAdm).length, family: A.staff.filter((x) => !isAdm(x)).length };
    $('#tchips').innerHTML = TEAM_CHIPS.map(([v, a, e]) => `<button class="chip ${f.st === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))} <span class="n">${counts[v] || 0}</span></button>`).join('');
    const rows = A.staff.filter((x) => f.st === 'all' || (f.st === 'admin' ? isAdm(x) : !isAdm(x)));
    box.innerHTML = rows.length ? `<div class="table-wrap"><table class="t cards team-t">
      <thead><tr><th>${esc(t('الاسم', 'Name'))}</th><th>${esc(t('الجوال', 'Mobile'))}</th><th>${esc(t('الدور', 'Role'))}</th><th>${esc(t('الأسرة', 'Kitchen'))}</th><th>${esc(t('الحالة', 'Status'))}</th><th>${esc(t('الدخول', 'Sign in'))}</th>${A.owner ? '<th></th>' : ''}</tr></thead>
      <tbody>${rows.map((x) => `<tr class="${x.active ? '' : 'is-off'}"><td class="c-nm"><b>${esc(x.name || t('بدون اسم', 'No name'))}</b>${x.user_id === A.me.uid ? ` <span class="badge b-brand sm">${esc(t('أنت', 'You'))}</span>` : ''}</td>
        <td class="c-ph"><span class="ltr">${esc(SF.showPhone(x.phone))}</span></td><td class="c-role">${badge(L.role, x.role)}</td>
        <td class="c-fam">${x.family_id ? `<button class="link" data-open-fam="${esc(x.family_id)}">${esc(famName(x.family_id))}</button>` : '<span class="muted">·</span>'}</td>
        <td class="c-st">${x.active ? `<span class="badge b-ok">${esc(t('مفعّل', 'Active'))}</span>` : `<span class="badge b-bad">${esc(t('موقوف', 'Inactive'))}</span>`}</td>
        <td class="small c-in">${x.user_id ? esc(t('دخل قبل', 'Has signed in')) : `<span class="muted">${esc(t('ما دخل للحين', 'Not yet'))}</span>`}</td>
        ${A.owner ? `<td class="c-act"><button class="btn btn-ghost btn-sm" data-staff="${esc(x.id)}">${ic('edit', 's')}${esc(t('تعديل', 'Edit'))}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`
      : `<div class="box">${empty('shield', t('ما فيه أحد هنا', 'Nobody here'))}</div>`;
  }
  function staffSheet(st) {
    if (!A.owner) return;
    const isNew = !st, self = !!(st && st.user_id === A.me.uid);
    st = st || { role: 'support', active: true };
    const roles = ['admin', 'support', 'family_owner', 'family_staff', 'driver'];
    const s = formSheet(`${fsHead(isNew ? t('أضف شخص للفريق', 'Add a team member') : t('تعديل', 'Edit'), isNew ? t('يدخل برقم جواله، وصلاحيته حسب الدور', 'They sign in with their mobile, access follows the role') : '')}
      <div class="stack">
        ${self ? `<div class="notice info">${ic('info')}<span>${esc(t('ما تقدر تغيّر دورك أو توقف حسابك بنفسك', 'You cannot change your own role or deactivate yourself'))}</span></div>` : ''}
        ${field(t('الجوال', 'Mobile'), isNew ? phoneInput('tmPhone') : `<input class="input ltr" value="${esc(SF.showPhone(st.phone))}" readonly>`)}
        ${field(t('الاسم', 'Name'), `<input class="input" id="tmName" maxlength="60" value="${esc(st.name || '')}">`)}
        ${field(t('الدور', 'Role'), `<select class="select" id="tmRole" ${self ? 'disabled' : ''}>${roles.map((r) => `<option value="${r}" ${st.role === r ? 'selected' : ''}>${esc(lb(L.role, r))}</option>`).join('')}</select>`, '', '')}
        <p class="muted small" id="tmHelp"></p>
        <div id="tmFamBox">${field(t('الأسرة', 'Kitchen'), `<select class="select" id="tmFam">${famOptions(st.family_id || '', false)}</select>`)}</div>
        ${srow(t('مفعّل', 'Active'), t('الموقوف ما يقدر يدخل', 'Inactive accounts cannot sign in'), sw('', st.active, `id="tmActive" ${self ? 'disabled' : ''}`))}
        <div class="row"><button class="btn btn-primary btn-lg grow" id="tmGo">${ic('check', 's')}${esc(t('حفظ', 'Save'))}</button><button class="btn btn-ghost" data-close>${esc(t('رجوع', 'Back'))}</button></div>
      </div>`, { noFocus: !isNew });
    const q = (sel) => s.sh.querySelector(sel);
    const HELP = { admin: t('صلاحية كاملة: الإعدادات والفريق والمالية والحذف', 'Full access: settings, team, finance and deleting'), support: t('يتابع الطلبات والشكاوى والأسر، بدون الإعدادات والفريق والتحويلات', 'Handles orders, complaints and kitchens, without settings, team or payouts'),
      family_owner: t('صاحب المطبخ في تطبيق الأسرة', 'The kitchen owner in the kitchen app'), family_staff: t('يساعد في طلبات الأسرة من تطبيقها', 'Helps with the kitchen\'s orders in its app'), driver: t('للتوصيل لاحقًا', 'For delivery later on') };
    const sync = () => { const r = q('#tmRole').value; q('#tmFamBox').classList.toggle('hide', !(r === 'family_owner' || r === 'family_staff')); q('#tmHelp').textContent = HELP[r] || ''; };
    q('#tmRole').onchange = sync; sync();
    q('#tmGo').onclick = () => {
      const phone = isNew ? SF.normPhone(q('#tmPhone').value) : st.phone;
      const role = q('#tmRole').value, famRole = role === 'family_owner' || role === 'family_staff';
      const fam = famRole ? q('#tmFam').value : null, active = q('#tmActive').checked, name = q('#tmName').value.trim();
      if (!phone) { SF.toast(t('اكتب جوال سعودي صحيح يبدأ بـ 05', 'Enter a valid Saudi mobile starting with 05'), 'bad'); return; }
      if (isNew && A.staff.some((x) => x.phone === phone)) { SF.toast(t('الرقم موجود في الفريق، عدّله من القائمة', 'This number is already on the team, edit it from the list'), 'bad'); return; }
      if (famRole && !fam) { SF.toast(t('اختر الأسرة', 'Choose the kitchen'), 'bad'); return; }
      if (name.length < 2) { SF.toast(t('اكتب الاسم', 'Enter the name'), 'bad'); return; }
      if (!isNew && st.role === 'admin' && (role !== 'admin' || !active) && A.staff.filter((x) => x.role === 'admin' && x.active).length <= 1) { SF.toast(t('لازم يبقى مدير واحد مفعّل بالقليل', 'At least one active owner admin must remain'), 'bad'); return; }
      const go = () => SF.busy(q('#tmGo'), async () => {
        try {
          const r = await SF.rpc('sf_admin_staff_save', { p: { phone, name, role: self ? st.role : role, family_id: self ? st.family_id : fam, active: self ? true : active } });
          if (failed(r)) return;
          s.close();
          SF.toast(t('انحفظ', 'Saved'), 'ok');
          await reloadStaff();
          if (A.sec === 'team') renderTeam();
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
      if (role === 'admin' && st.role !== 'admin') SF.confirm({ title: t('صلاحية مدير كاملة؟', 'Give full owner access?'), body: t('المدير يقدر يغيّر الإعدادات والفريق ويسجل التحويلات ويحذف', 'An owner admin can change settings, the team and payouts, and delete data'), ok: t('تمام', 'Yes') }).then((ok) => { if (ok) go(); });
      else go();
    };
  }

  // ============================================================
  //  12) السجل
  // ============================================================
  const LOG_CHIPS = [['all', 'الكل', 'All'], ['order', 'الطلبات', 'Orders'], ['family', 'الأسر', 'Kitchens'], ['money', 'المال والعروض', 'Money and offers'], ['sys', 'الإعدادات والفريق', 'Settings and team']];
  const logCat = (a) => (a.startsWith('order_') ? 'order' : /^(family_|dish_|doc_|join_)/.test(a) ? 'family' : /^(payout|promo_|customer_set|broadcast)/.test(a) ? 'money' : 'sys');
  const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ''));
  V.log = async (el) => {
    if (!A.owner) { el.innerHTML = head(t('السجل', 'Activity log'), '') + `<div class="box">${empty('lock', t('السجل للمدير بس', 'The log is for the owner admin only'))}</div>`; return; }
    const f = A.lf || (A.lf = { st: 'all' });
    const rows = need(await db().from('sf_admin_log').select('*').order('id', { ascending: false }).limit(200)) || [];
    const ids = (pred) => [...new Set(rows.filter(pred).map((x) => x.target).filter(isUuid))];
    const oIds = ids((x) => x.action.startsWith('order_')), pIds = ids((x) => x.action === 'customer_set'), jIds = ids((x) => x.action.startsWith('join_'));
    const [o, p, j] = await Promise.all([
      oIds.length ? db().from('sf_orders').select('id,order_no').in('id', oIds) : Promise.resolve({ data: [] }),
      pIds.length ? db().from('sf_profiles').select('id,name,phone').in('id', pIds) : Promise.resolve({ data: [] }),
      jIds.length ? db().from('sf_join_requests').select('id,kitchen_name').in('id', jIds) : Promise.resolve({ data: [] }),
    ]);
    const maps = { o: Object.fromEntries((o.data || []).map((x) => [x.id, x])), p: Object.fromEntries((p.data || []).map((x) => [x.id, x])), j: Object.fromEntries((j.data || []).map((x) => [x.id, x])) };
    el.innerHTML = head(t('السجل', 'Activity log'), t('آخر 200 إجراء في لوحة الإدارة', 'The last 200 actions in the admin panel')) + `<div class="chips st-chips" id="lchips"></div><div id="llist"></div>`;
    const paint = () => {
      $('#lchips').innerHTML = LOG_CHIPS.map(([v, a, e]) => `<button class="chip ${f.st === v ? 'is-active' : ''}" data-st="${v}">${esc(t(a, e))}</button>`).join('');
      const list = rows.filter((x) => f.st === 'all' || logCat(x.action) === f.st);
      $('#llist').innerHTML = list.length ? `<div class="table-wrap"><table class="t cards log-t">
        <thead><tr><th>${esc(t('الوقت', 'Time'))}</th><th>${esc(t('مين', 'Who'))}</th><th>${esc(t('وش صار', 'What'))}</th><th>${esc(t('على', 'On'))}</th><th>${esc(t('التفاصيل', 'Details'))}</th></tr></thead>
        <tbody>${list.map((x) => { const who = x.actor ? staffByUid(x.actor) : null; return `<tr>
          <td class="small c-time"><span>${esc(SF.fmtDT(x.created_at))}</span><small>${esc(SF.ago(x.created_at))}</small></td>
          <td class="c-who">${x.actor ? esc(who ? who.name || SF.showPhone(who.phone) : t('مستخدم', 'User')) : `<span class="muted">${esc(t('النظام', 'System'))}</span>`}</td>
          <td class="c-what"><b>${esc(lb(L.log, x.action))}</b></td><td class="c-on">${logTarget(x, maps)}</td><td class="c-det">${esc(logDetails(x))}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="box">${empty('list', t('ما فيه شي مسجل هنا', 'Nothing logged here'))}</div>`;
    };
    $('#lchips').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.st = b.dataset.st; paint(); });
    paint();
  };
  function logTarget(x, maps) {
    const a = x.action, id = x.target, d = x.data || {};
    if (!id) return '';
    if (a.startsWith('order_')) { const o = maps.o[id]; return o ? `<button class="link ltr" data-open-order="${esc(id)}">#${esc(o.order_no)}</button>` : esc(t('طلب', 'Order')); }
    if (a.startsWith('family_') || a === 'payout') { const f = A.famById[id]; return f ? `<button class="link" data-open-fam="${esc(id)}">${esc(SF.nm(f, 'name'))}</button>` : esc(d.name || t('أسرة محذوفة', 'Removed kitchen')); }
    if (a === 'customer_set') { const p = maps.p[id]; return p ? `<button class="link" data-open-cust="${esc(id)}">${esc(p.name || SF.showPhone(p.phone))}</button>` : ''; }
    if (a.startsWith('join_')) { const jr = maps.j[id]; return jr ? esc(jr.kitchen_name) : ''; }
    if (a === 'staff_save') { const s = A.staff.find((y) => y.id === id); return s ? esc(s.name || SF.showPhone(s.phone)) : ''; }
    if (a === 'dish_edit' || a === 'doc_review') return d.family ? `<button class="link" data-open-fam="${esc(d.family)}">${esc(famName(d.family))}</button>` : '';
    if (a === 'complaint_update') return `<button class="link" data-open-cmp="${esc(id)}">${esc(t('الشكوى', 'Complaint'))}</button>`;
    if (a.startsWith('promo_') || a.startsWith('city_') || a.startsWith('category_')) return `<span class="mono">${esc(id)}</span>`;
    return '';
  }
  function logDetails(x) {
    const d = x.data || {};
    const yes = (v) => v === true || v === 'true';
    switch (x.action) {
      case 'settings': return Object.entries(d).map(([k, v]) => `${k} = ${String(v).slice(0, 40)}`).join('، ');
      case 'payout': return `${+d.amount > 0 ? t('دفعنا', 'paid') : t('استلمنا', 'received')} ${sar(Math.abs(+d.amount || 0))}${d.method ? ' · ' + methodLabel(d.method) : ''}${d.note ? ' · ' + d.note : ''}`;
      case 'customer_set': return [d.blocked != null ? (yes(d.blocked) ? t('إيقاف', 'blocked') : t('فك إيقاف', 'unblocked')) : '', d.credit ? `${t('رصيد', 'credit')} ${d.credit}` : '', d.reason || ''].filter(Boolean).join(' · ');
      case 'broadcast': return `${lb(L.aud, d.audience)} · ${d.title || ''}`;
      case 'family_create': return d.name_ar || '';
      case 'staff_save': return [d.name, lb(L.role, d.role), d.active === false || d.active === 'false' ? t('موقوف', 'inactive') : ''].filter(Boolean).join(' · ');
      case 'delete_demo': return t(`${d.families} أسر، ${d.orders} طلب`, `${d.families} kitchens, ${d.orders} orders`);
      case 'join_approve': case 'join_reject': return d.note || '';
      default:
        if (x.action.startsWith('order_')) return d.note || (d.action && String(d.action).startsWith('status:') ? SF.statusLabel(String(d.action).slice(7)) : '');
        if (d.fields) return d.fields.join('، ') + (d.status ? ' · ' + lb(L.famSt, d.status) : '');
        return Object.entries(d).filter(([k]) => k !== 'family').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 160);
    }
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-open-cust]'); if (c) { e.preventDefault(); openCustomer(c.dataset.openCust); return; }
    const k = e.target.closest('[data-open-cmp]'); if (k) { e.preventDefault(); openComplaint(k.dataset.openCmp); }
  });

  // ============================================================
  //  الجرس: إشعارات الإدارة (طلب انضمام، شكوى، طلب انلغى، ملخص اليوم)
  // ============================================================
  const NOTIF_ALIAS = { '#join': '#/joins', '#joins': '#/joins', '#complaints': '#/complaints', '#orders': '#/orders', '#dashboard': '#/today', '#today': '#/today', '#families': '#/families', '#finance': '#/finance' };
  const notifIcon = (n) => { const l = n.link || ''; if (/join/.test(l)) return 'door'; if (/complaint/.test(l)) return 'chat'; if (/order/.test(l)) return 'receipt'; if (/dashboard|today/.test(l)) return 'chart'; return n.kind === 'broadcast' ? 'send' : 'bell'; };
  async function loadNotifs() {
    if (!A.me) return;
    try { A.notifs = need(await db().from('sf_notifications').select('id,title,body,link,kind,order_id,read_at,created_at').eq('user_id', A.me.uid).order('id', { ascending: false }).limit(40)) || []; }
    catch (e) { A.notifs = A.notifs || []; }
    paintBell();
  }
  function paintBell() {
    const n = (A.notifs || []).filter((x) => !x.read_at).length;
    $$('[data-bell]').forEach((d) => { d.hidden = !n; d.textContent = n > 9 ? '9+' : String(n); });
  }
  function onNotifRT(p) {
    if (p.eventType !== 'INSERT' || !p.new) return;
    A.notifs = [p.new].concat((A.notifs || []).filter((x) => x.id !== p.new.id)).slice(0, 40);
    paintBell();
    SF.toast(p.new.title);
    countsSoon();
  }
  function followNotif(n) {
    const link = String(n.link || '');
    const m = link.match(/[?&]order=([0-9a-f-]{36})/i);
    if (m) { openOrder(m[1]); return; }
    const base = link.split('?')[0];
    const target = NOTIF_ALIAS[base] || (base.startsWith('#/') ? base : null);
    if (!target) return;
    if (target === '#/orders') { const no = String(n.title || '').match(/\d{5,}/); A.of = Object.assign(ordDefaults(), no ? { q: no[0] } : { status: 'closed' }); }
    if (location.hash === target) route(); else location.hash = target;
  }
  ACT.notifs = () => {
    const s = drawer(drLoading());
    const render = () => {
      const list = A.notifs || [];
      const unread = list.filter((x) => !x.read_at).length;
      s.body.innerHTML = drHead(esc(t('الإشعارات', 'Notifications')), esc(unread ? t(`غير مقروءة: ${unread}`, `${unread} unread`) : t('كلها مقروءة', 'All read')),
        unread ? `<button class="btn btn-ghost btn-sm" data-x="read-all">${ic('check', 's')}<span class="hide-s">${esc(t('تحديد الكل كمقروء', 'Mark all read'))}</span></button>` : '') + `
        <div class="dr-body">
          ${list.length ? `<ul class="nt-list">${list.map((n) => `<li><button class="nt ${n.read_at ? '' : 'unread'}" data-x="open" data-id="${esc(n.id)}"><span class="nt-ic">${ic(notifIcon(n))}</span><div class="grow"><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<small>${esc(SF.ago(n.created_at))}</small></div>${n.link ? ic('chevR', 's flip') : ''}</button></li>`).join('')}</ul>`
            : empty('bell', t('ما فيه إشعارات', 'No notifications'), t('يوصلك هنا كل طلب انضمام وشكوى جديدة، والطلبات اللي تنلغى لحالها، وملخص اليوم الساعة 11 الليل', 'Join requests, new complaints, auto-cancelled orders and the 11 pm daily summary land here'))}
          <section class="dr-sec push-sec"><h3>${ic('bell')}${esc(t('تنبيهات هذا الجهاز', 'Alerts on this device'))}</h3><p class="muted small">${esc(t('فعّلها عشان توصلك نفس الإشعارات حتى لو اللوحة مسكّرة', 'Turn them on to get the same alerts even when the panel is closed'))}</p><div><button class="btn btn-soft btn-sm" data-x="push">${ic('bell', 's')}${esc(t('فعّل التنبيهات', 'Turn on alerts'))}</button></div></section>
        </div>`;
    };
    s.sh.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'read-all') {
        try { await SF.rpc('sf_notif_read', { p_ids: null }); } catch (er) { /* */ }
        (A.notifs || []).forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); });
        paintBell(); render();
      } else if (b.dataset.x === 'open') {
        const n = (A.notifs || []).find((x) => String(x.id) === b.dataset.id); if (!n) return;
        if (!n.read_at) { n.read_at = new Date().toISOString(); paintBell(); SF.rpc('sf_notif_read', { p_ids: [n.id] }).catch(() => {}); }
        if (n.link) { s.close(); followNotif(n); } else render();
      } else if (b.dataset.x === 'push') {
        SF.busy(b, async () => {
          try {
            SF.registerSW('sw.js');
            const r = await Promise.race([SF.enablePush(), new Promise((res) => setTimeout(() => res({ ok: false, why: 'timeout' }), 15000))]);
            const why = { not_configured: t('التنبيهات مو مجهزة في الخادم للحين', 'Alerts are not set up on the server yet'), denied: t('اسمح بالإشعارات من إعدادات المتصفح', 'Allow notifications in your browser settings'), unsupported: t('هذا المتصفح ما يدعم التنبيهات', 'This browser does not support alerts') };
            SF.toast(r.ok ? t('تمام، بتوصلك التنبيهات على هذا الجهاز', 'Done, alerts will reach this device') : why[r.why] || t('ما قدرنا نفعّل التنبيهات، جرّب مرة ثانية', 'Could not turn on alerts, try again'), r.ok ? 'ok' : 'bad');
          } catch (er) { SF.toast(errMsg(er), 'bad'); }
        });
      }
    });
    render();
    loadNotifs().then(() => { if (s.sh.isConnected) render(); });
  };

  // ============================================================
  //  التشغيل
  // ============================================================
  function closeAllSheets() { let n = 0; while (document.querySelector('.sheet.is-open') && n < 20) { SF.closeSheet(); n += 1; } }
  window.SFAdmin = { state: A, route, openOrder, openFamily, openCustomer, openComplaint, refreshCounts, loadNotifs };
  SF.onLang(() => { closeAllSheets(); if (A.me) { renderShell(); paintBell(); route(); } else if (document.getElementById('lgStep')) renderLogin(); });
  SF.auth.onChange((ev) => { if (ev === 'SIGNED_OUT' && A.me) renderLogin(); });
  applyTheme();
  (async () => {
    try {
      const s = await SF.auth.session();
      if (!s) { renderLogin(); return; }
      await enter();
    } catch (e) { renderLogin(); }
  })();
})();
