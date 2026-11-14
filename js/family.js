/* ============================================================
   سُفرة · family.js · تطبيق الأسر (المطابخ)
   الطلبات لحظيًا بتنبيه صوتي متكرر، المنيو، الحساب، وإعدادات المطبخ
   يحتاج قبله: supabase-js (CDN) ثم js/config.js ثم js/core.js
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF;
  const t = (ar, en) => SF.t(ar, en);
  const esc = SF.esc;
  // أيقونات إضافية بنفس الأسلوب (السماعة لصوت التنبيه)
  const XP = { sound: 'M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4zM15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8' };
  const ic = (n, c = '') => (XP[n] ? `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${XP[n]}"/></svg>` : SF.icon(n, c));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = document.getElementById('app');
  const NATIVE = !!(SF.isNative && SF.isNative());

  // ───────── الحالة ─────────
  const S = {
    screen: '', me: null, famId: null, fam: null, priv: null,
    orders: new Map(), ordersReady: false,
    dishes: [], cats: [], cities: [], hours: [], timeoff: [], docs: null, reviews: null,
    tab: 'orders', seg: 'new', segB: 'preparing', period: 'week', fin: null, finKey: '', finBusy: false, finErr: false,
    expanded: new Set(), reorder: false, chans: [], pushTried: false,
  };
  const TABS = ['orders', 'menu', 'finance', 'kitchen'];
  const LIVE = ['new', 'preparing', 'ready', 'on_the_way'];
  const DONE = ['delivered', 'picked_up', 'cancelled', 'rejected'];

  // ───────── أدوات ─────────
  const pad2 = (n) => String(n).padStart(2, '0');
  const LOC = () => (SF.lang === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn');
  const riyDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }) : '');
  const dayStart = (offset = 0) => `${SF.dayISO(offset)}T00:00:00+03:00`;
  const digits = (v) => String(v ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[٫,]/g, '.').trim();
  const num = (v) => { const s = digits(v); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const grp = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const moneyBig = (n) => (SF.lang === 'en' ? `<small>SAR</small> ${grp(n)}` : `${grp(n)} <small>ر.س</small>`);
  const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || t('عميل', 'Customer');
  const fmtD = (d, opt = {}) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00+03:00`).toLocaleDateString(LOC(), { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh', ...opt }) : '');
  const isWide = () => window.matchMedia('(min-width: 900px)').matches;
  const DAYS = [['الأحد', 'Sunday'], ['الاثنين', 'Monday'], ['الثلاثاء', 'Tuesday'], ['الأربعاء', 'Wednesday'], ['الخميس', 'Thursday'], ['الجمعة', 'Friday'], ['السبت', 'Saturday']];
  const dayName = (d) => t(DAYS[d][0], DAYS[d][1]);

  function riyNow() {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date());
    const g = (k) => (p.find((x) => x.type === k) || {}).value;
    return { min: (+g('hour') % 24) * 60 + +g('minute'), dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
  }
  // دقائق من منتصف الليل إلى وقت مقروء
  function fmtMin(m) {
    const v = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(v / 60); const mi = v % 60;
    return `${h % 12 || 12}:${pad2(mi)} ${h < 12 ? t('ص', 'AM') : t('م', 'PM')}`;
  }
  const hhmm = (m) => (m >= 1440 ? '00:00' : `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
  const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
  function durTxt(min) {
    const v = Math.max(0, Math.round(min));
    if (v < 60) return t(`${v} دقيقة`, `${v} min`);
    const h = Math.floor(v / 60); const m = v % 60;
    const hAr = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
    const hEn = h === 1 ? '1 hour' : `${h} hours`;
    if (!m) return t(hAr, hEn);
    if (m === 30) return t(`${hAr} ونص`, `${h}.5 hours`);
    return t(`${hAr} و${m} دقيقة`, `${hEn} ${m} min`);
  }
  // عدد بصيغة عربية: [واحد، اثنين، جمع (3 إلى 10)، مفرد (11 وفوق)]
  function cnt(n, ar, en) {
    const v = +n || 0;
    if (SF.lang === 'en') return `${v} ${v === 1 ? en[0] : en[1]}`;
    if (v === 1) return ar[0];
    if (v === 2) return ar[1];
    if (v >= 3 && v <= 10) return `${v} ${ar[2]}`;
    return `${v} ${ar[3]}`;
  }
  function dayWord(iso) {
    const d = riyDate(iso);
    if (d === SF.todayISO()) return t('اليوم', 'Today');
    if (d === SF.dayISO(1)) return t('بكرة', 'Tomorrow');
    if (d === SF.dayISO(-1)) return t('أمس', 'Yesterday');
    return SF.fmtDate(iso, { month: 'short' });
  }
  const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`; };
  const photo = (url, cls = '') => `<span class="ph ${cls}">${ic('dish')}${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  const sheetHead = (title, sub = '') => `<div class="sheet-head"><div class="grow"><h2>${esc(title)}</h2>${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="${esc(t('إغلاق', 'Close'))}">${ic('x')}</button></div>`;
  const catName = (id) => { const c = S.cats.find((x) => x.id === id); return c ? SF.nm(c, 'name') : ''; };
  const cityName = (id) => { const c = S.cities.find((x) => x.id === id); return c ? SF.nm(c, 'name') : ''; };
  const errMsg = (e) => (e && e.text) || SF.errText(e);
  const stars = (n) => `<span class="stars" aria-label="${esc(t(`${n} من 5`, `${n} of 5`))}">${Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">${ic('star', 's')}</span>`).join('')}</span>`;
  function shareLink() {
    const base = String(SF.settings.app_url || '').trim();
    const slug = encodeURIComponent((S.fam && S.fam.slug) || '');
    if (base) return `${base.replace(/\/+$/, '')}/index.html?f=${slug}`;
    return new URL(`index.html?f=${slug}`, location.href).href;
  }
  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2.2a7 7 0 0 0-7 7c0 5.3 7 12.6 7 12.6s7-7.3 7-12.6a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z"/></svg>';

  // حالات الطلب بلغة المطبخ
  const FST = {
    pending_payment: ['بانتظار الدفع', 'Awaiting payment'], new: ['جديد', 'New'], preparing: ['قيد التجهيز', 'Preparing'], ready: ['جاهز', 'Ready'],
    on_the_way: ['في الطريق', 'On the way'], delivered: ['تم التوصيل', 'Delivered'], picked_up: ['استلمه العميل', 'Picked up'],
    cancelled: ['ملغي', 'Cancelled'], rejected: ['تم الاعتذار', 'Declined'],
  };
  const fLabel = (s, ful) => (s === 'ready' && ful === 'pickup' ? t('جاهز للاستلام', 'Ready for pickup') : FST[s] ? t(FST[s][0], FST[s][1]) : s);
  const fBadge = (s, ful) => `<span class="badge st-${esc(s)}"><span class="dot"></span>${esc(fLabel(s, ful))}</span>`;
  const DOC_KINDS = [
    ['freelance', 'وثيقة العمل الحر', 'Freelance certificate'], ['family_cert', 'شهادة الأسرة المنتجة', 'Productive family certificate'],
    ['health_cert', 'الشهادة الصحية', 'Health certificate'], ['municipal', 'رخصة البلدية', 'Municipal license'],
    ['iban_cert', 'شهادة الآيبان', 'IBAN certificate'], ['id', 'الهوية', 'ID'], ['other', 'وثيقة ثانية', 'Other document'],
  ];

  // ───────── التنبيه الصوتي للطلبات الجديدة ─────────
  const ACK_KEY = 'sf_fam_ack_v1';
  const acked = new Set(SF.LS.get(ACK_KEY, []));
  let actx = null; let alertT = null; let flashT = null; let flashOn = false;
  window.__sfChimes = 0;
  function unlockAudio() {
    try {
      if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; actx = new C(); }
      if (actx.state !== 'running') actx.resume().then(renderSoundHint).catch(() => {});
      const b = actx.createBuffer(1, 1, 22050); const src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0);
    } catch { /* المتصفح ما يدعم */ }
    setTimeout(renderSoundHint, 60);
  }
  const audioOn = () => !!actx && actx.state === 'running';
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  // نغمة واضحة من أربع نوتات (مولّدة، بدون ملف)
  function chime() {
    const c = actx; if (!c || c.state !== 'running') return false;
    const t0 = c.currentTime + 0.03;
    const out = c.createGain(); out.gain.value = 0.85;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    out.connect(comp); comp.connect(c.destination);
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((f, i) => {
      const s = t0 + i * 0.14; const last = i === notes.length - 1;
      [[1, 0.42, 'sine'], [2, 0.1, 'triangle'], [3, 0.035, 'sine']].forEach(([mul, vol, type]) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f * mul, s);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(vol, s + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, s + (last ? 1.5 : 0.6));
        o.connect(g); g.connect(out); o.start(s); o.stop(s + 1.6);
      });
    });
    window.__sfChimes += 1;
    return true;
  }
  const pending = () => [...S.orders.values()].filter((o) => o.status === 'new' && !acked.has(o.id));
  function saveAck() {
    if (S.ordersReady) {
      const live = new Set([...S.orders.values()].filter((o) => o.status === 'new').map((o) => o.id));
      [...acked].forEach((id) => { if (!live.has(id)) acked.delete(id); });
    }
    SF.LS.set(ACK_KEY, [...acked]);
  }
  function ack(ids) {
    let changed = false;
    ids.forEach((id) => { if (id && !acked.has(id)) { acked.add(id); changed = true; } });
    if (!changed) return;
    saveAck(); syncAlert();
    ids.forEach((id) => { const el = document.querySelector(`.oc[data-id="${CSS.escape(id)}"]`); if (el) el.classList.remove('is-unseen'); });
  }
  function ring() {
    chime();
    try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([400, 160, 400, 160, 600]); } catch { /* */ }
  }
  function syncAlert() {
    const p = pending();
    if (p.length && S.fam) {
      if (!alertT) { ring(); alertT = setInterval(ring, 3000); }
      if (!flashT) flashT = setInterval(() => { flashOn = !flashOn; document.title = flashOn ? `(${pending().length}) ${t('طلب جديد!', 'New order!')}` : baseTitle(); }, 1000);
    } else {
      clearInterval(alertT); alertT = null; clearInterval(flashT); flashT = null; flashOn = false;
    }
    if (!flashOn) document.title = baseTitle();
    renderAlert(); renderSoundHint();
  }
  function baseTitle() {
    const n = [...S.orders.values()].filter((o) => o.status === 'new').length;
    const k = S.fam ? SF.nm(S.fam, 'name') : '';
    return `${n ? `(${n}) ` : ''}${t('سُفرة للأسر', 'Sufrah Kitchens')}${k ? ` · ${k}` : ''}`;
  }
  function renderAlert() {
    const box = $('#nalert'); if (!box) return;
    const p = pending();
    if (!p.length || S.screen !== 'app') { box.innerHTML = ''; box.classList.remove('is-on'); return; }
    const o = p[0];
    const qty = (o.items || []).reduce((a, it) => a + (+it.qty || 1), 0);
    box.classList.add('is-on');
    box.innerHTML = `<div class="na" role="alert">
      <span class="na-ic">${ic('bell')}</span>
      <div class="na-txt"><b>${esc(t(`وصلك ${cnt(p.length, ['طلب جديد', 'طلبين جدد', 'طلبات جديدة', 'طلب جديد'], ['', ''])}`, p.length > 1 ? `${p.length} new orders` : 'New order!'))}</b>
        <span><bdi>#${esc(o.order_no)}</bdi> · ${esc(cnt(qty, ['صنف واحد', 'صنفين', 'أصناف', 'صنف'], ['item', 'items']))} · ${esc(SF.money(o.total))} · ${esc(o.scheduled_for ? t('موعد', 'Scheduled') : t('بأسرع وقت', 'ASAP'))}</span></div>
      <button type="button" class="btn na-open" data-na="open">${esc(t('افتح', 'Open'))}</button>
      <button type="button" class="btn na-ok" data-na="ok">${esc(t('شفته', 'Seen'))}</button>
    </div>`;
  }
  function renderSoundHint() {
    const box = $('#sndHint'); if (!box) return;
    const show = S.screen === 'app' && !audioOn();
    box.innerHTML = show ? `<div class="snd-hint">${ic('sound')}<span class="grow">${esc(t('فعّل صوت التنبيه عشان تسمع الطلبات الجديدة', 'Turn on the alert sound so you hear new orders'))}</span><button type="button" class="btn btn-sm btn-primary" data-k="sound">${esc(t('فعّل الصوت', 'Turn on'))}</button></div>` : '';
  }

  // ───────── الدخول والصلاحية ─────────
  let starting = null;
  const start = () => { if (!starting) starting = doStart().finally(() => { starting = null; }); return starting; };
  async function doStart() {
    const sess = await SF.auth.session();
    if (!sess) { showLogin(); return; }
    let me;
    try { me = await SF.me(true); } catch { me = { error: true }; }
    if (!me || me.error) { showError(); return; }
    if (!['family_owner', 'family_staff'].includes(me.role) || !me.family) { showGate(me); return; }
    if (S.screen === 'app' && S.famId === me.family.id) return;
    S.me = me; S.famId = me.family.id;
    try { await loadAll(); } catch (e) { showError(e); return; }
    renderApp();
    subscribe();
    handleDeepLink();
    if (NATIVE && !S.pushTried) { S.pushTried = true; SF.enablePush().then((r) => { if (r && r.ok) SF.LS.set('sf_push_on', true); }).catch(() => {}); }
  }
  function teardown() {
    S.chans.forEach((ch) => { try { SF.sb.removeChannel(ch); } catch { /* */ } });
    S.chans = [];
    clearInterval(alertT); alertT = null; clearInterval(flashT); flashT = null;
    Object.assign(S, { me: null, famId: null, fam: null, priv: null, orders: new Map(), ordersReady: false, dishes: [], hours: [], timeoff: [], docs: null, reviews: null, fin: null, finKey: '', expanded: new Set(), reorder: false });
    const na = $('#nalert'); if (na) { na.innerHTML = ''; na.classList.remove('is-on'); }
  }

  let loginStep = 'phone'; let otpPhone = ''; let resendT = null;
  function showLogin() {
    teardown();
    S.screen = 'login';
    document.title = t('سُفرة للأسر', 'Sufrah Kitchens');
    app.innerHTML = `
      <div class="auth">
        <div class="auth-top">
          <button type="button" class="icon-btn auth-lang" data-lang aria-label="${esc(t('English', 'العربية'))}">${ic('globe')}<span>${SF.lang === 'en' ? 'عربي' : 'EN'}</span></button>
          <img class="auth-mark" src="img/mark.svg" alt="">
          <h1>${esc(t('سُفرة للأسر', 'Sufrah Kitchens'))}</h1>
          <p>${esc(t('استقبل طلباتك وأدر مطبخك من جوالك', 'Take orders and run your kitchen from your phone'))}</p>
        </div>
        <div class="sadu"></div>
        <div class="auth-card card"><div id="authStep"></div></div>
        <p class="auth-foot">${esc(t('تبي تبيع أكلك من البيت؟', 'Want to sell your home cooking?'))} <a href="join.html">${esc(t('قدّم طلب انضمام', 'Apply to join'))}</a></p>
      </div>`;
    $('[data-lang]', app).onclick = () => SF.setLang(SF.lang === 'en' ? 'ar' : 'en');
    if (loginStep === 'otp' && otpPhone) stepOtp(); else stepPhone(otpPhone);
  }
  function authErr(msg) { const el = $('#authErr'); if (el) { el.innerHTML = `${ic('alert')}<span>${esc(msg)}</span>`; el.classList.remove('hide'); } }
  function stepPhone(prefill = '') {
    loginStep = 'phone';
    clearInterval(resendT);
    const box = $('#authStep'); if (!box) return;
    box.innerHTML = `
      <form id="fPhone" class="stack l" novalidate>
        <div class="stack s"><h2>${esc(t('سجّل دخولك', 'Sign in'))}</h2><p class="ink2">${esc(t('اكتب رقم جوال المطبخ ونرسل لك رمز تحقق.', 'Enter your kitchen mobile number and we will text you a code.'))}</p></div>
        <label class="field"><span>${esc(t('رقم الجوال', 'Mobile number'))}</span>
          <div class="input-group big" dir="ltr"><span class="addon">+966</span><input class="input" id="inPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="05XXXXXXXX" maxlength="14" dir="ltr" value="${esc(prefill)}"></div></label>
        <div class="notice bad hide" id="authErr" role="alert"></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${esc(t('أرسل الرمز', 'Send code'))}</button>
      </form>`;
    const f = $('#fPhone');
    f.onsubmit = (e) => {
      e.preventDefault();
      SF.busy(f.querySelector('[type=submit]'), async () => {
        const v = $('#inPhone').value;
        try { await SF.auth.sendCode(v); otpPhone = v; stepOtp(true); } catch (er) { authErr(errMsg(er)); }
      });
    };
    if (!('ontouchstart' in window)) setTimeout(() => { const i = $('#inPhone'); if (i) i.focus(); }, 60);
  }
  function stepOtp(fresh = false) {
    loginStep = 'otp';
    const box = $('#authStep'); if (!box) return;
    box.innerHTML = `
      <form id="fOtp" class="stack l" novalidate>
        <div class="stack s"><h2>${esc(t('اكتب الرمز', 'Enter the code'))}</h2><p class="ink2">${esc(t('أرسلنا رمز من 6 أرقام للجوال', 'We sent a 6 digit code to'))} <b dir="ltr">${esc(SF.showPhone(otpPhone))}</b></p></div>
        <div class="otp">${Array.from({ length: 6 }, (_, i) => `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'} aria-label="${esc(t(`الرقم ${i + 1}`, `Digit ${i + 1}`))}">`).join('')}</div>
        <div class="notice bad hide" id="authErr" role="alert"></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${esc(t('دخول', 'Sign in'))}</button>
        <div class="row between wrap"><button type="button" class="link" id="otpChange">${esc(t('تغيير الرقم', 'Change number'))}</button><button type="button" class="link" id="otpResend"></button></div>
      </form>`;
    const ins = $$('.otp input', box);
    const code = () => ins.map((i) => i.value).join('');
    let verifying = false;
    const submit = async () => {
      if (verifying) return;
      const c = code();
      if (c.length !== 6) { authErr(t('اكتب الرمز كامل', 'Enter the full code')); return; }
      verifying = true;
      await SF.busy($('#fOtp [type=submit]'), async () => {
        try { await SF.auth.verify(otpPhone, c); loginStep = 'phone'; await start(); }
        catch (er) { authErr(errMsg(er)); ins.forEach((i) => { i.value = ''; }); ins[0].focus(); }
      });
      verifying = false;
    };
    const fill = (str, from) => {
      const d = digits(str).replace(/\D/g, '').split('');
      let k = from;
      d.forEach((ch) => { if (k <= 5) { ins[k].value = ch; k += 1; } });
      ins[Math.min(k, 5)].focus();
      if (code().length === 6) submit();
    };
    ins.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const v = digits(inp.value).replace(/\D/g, '');
        if (v.length > 1) { inp.value = ''; fill(v, i); return; }
        inp.value = v;
        if (v && i < 5) ins[i + 1].focus();
        if (code().length === 6) submit();
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) { e.preventDefault(); ins[i - 1].value = ''; ins[i - 1].focus(); } });
      inp.addEventListener('paste', (e) => { const txt = (e.clipboardData || window.clipboardData).getData('text'); if (txt) { e.preventDefault(); fill(txt, 0); } });
    });
    $('#fOtp').onsubmit = (e) => { e.preventDefault(); submit(); };
    $('#otpChange').onclick = () => stepPhone(otpPhone);
    const rs = $('#otpResend');
    let left = fresh ? 60 : 0;
    const paint = () => { rs.disabled = left > 0; rs.textContent = left > 0 ? t(`أرسل رمز جديد بعد ${Math.floor(left / 60)}:${pad2(left % 60)}`, `New code in ${Math.floor(left / 60)}:${pad2(left % 60)}`) : t('أرسل الرمز مرة ثانية', 'Resend code'); };
    paint();
    clearInterval(resendT);
    resendT = setInterval(() => { if (left > 0) { left -= 1; paint(); } }, 1000);
    rs.onclick = () => SF.busy(rs, async () => { try { await SF.auth.sendCode(otpPhone); left = 60; paint(); SF.toast(t('أرسلنا رمز جديد', 'New code sent'), 'ok'); } catch (er) { authErr(errMsg(er)); } });
    setTimeout(() => ins[0].focus(), 80);
  }
  function showGate(me) {
    teardown();
    S.screen = 'gate';
    const admin = ['admin', 'support'].includes(me && me.role);
    document.title = t('سُفرة للأسر', 'Sufrah Kitchens');
    app.innerHTML = `
      <div class="gate">
        <div class="gate-card card">
          <div class="empty">
            <div class="art">${ic('store')}</div>
            <h2>${esc(t('هذا الرقم مو مسجل كأسرة في سُفرة', 'This number is not registered as a Sufrah kitchen'))}</h2>
            <p>${esc(t('دخلت بالرقم', 'You signed in with'))} <bdi dir="ltr">${esc(SF.showPhone(me && me.phone))}</bdi>. ${esc(t('لو عندك مطبخ بيتي وتبي تبيع أكلك، قدّم طلب انضمام ونتواصل معك.', 'If you cook from home and want to sell, apply to join and we will contact you.'))}</p>
            <div class="stack gate-act">
              <a class="btn btn-primary btn-lg btn-block" href="join.html">${esc(t('قدّم طلب انضمام', 'Apply to join'))}</a>
              ${admin && !NATIVE ? `<a class="btn btn-soft btn-lg btn-block" href="admin.html">${esc(t('لوحة الإدارة', 'Admin panel'))}</a>` : ''}
              <button type="button" class="btn btn-ghost btn-block" data-out>${esc(t('ادخل برقم ثاني', 'Use another number'))}</button>
            </div>
          </div>
        </div>
      </div>`;
    $('[data-out]', app).onclick = async () => { await SF.auth.signOut(); otpPhone = ''; showLogin(); };
  }
  function showError() {
    S.screen = 'error';
    app.innerHTML = `<div class="gate"><div class="gate-card card"><div class="empty">
      <div class="art">${ic('refresh')}</div>
      <h2>${esc(t('ما قدرنا نفتح مطبخك', 'We could not open your kitchen'))}</h2>
      <p>${esc(t('تأكد من الإنترنت وجرب مرة ثانية.', 'Check your connection and try again.'))}</p>
      <button type="button" class="btn btn-primary btn-lg" data-retry>${esc(t('جرّب مرة ثانية', 'Try again'))}</button>
    </div></div></div>`;
    $('[data-retry]', app).onclick = (e) => SF.busy(e.currentTarget, () => start());
  }

  // ───────── تحميل البيانات ─────────
  async function loadAll() {
    const id = S.famId; const sb = SF.sb;
    const [fam, priv, cats, cities, hours, off, dishes] = await Promise.all([
      sb.from('sf_families').select('*').eq('id', id).single(),
      sb.from('sf_family_private').select('*').eq('family_id', id).maybeSingle(),
      sb.from('sf_categories').select('id,name_ar,name_en,sort,active').order('sort'),
      sb.from('sf_cities').select('id,name_ar,name_en,lat,lng,active,sort').order('sort'),
      sb.from('sf_family_hours').select('dow,open_min,close_min').eq('family_id', id).order('dow').order('open_min'),
      sb.from('sf_family_timeoff').select('*').eq('family_id', id).gte('to_date', SF.todayISO()).order('from_date'),
      sb.from('sf_dishes').select('*').eq('family_id', id).order('sort').order('created_at'),
    ]);
    if (fam.error) throw fam.error;
    S.fam = fam.data; S.priv = priv.data || null;
    S.cats = cats.data || []; S.cities = cities.data || []; S.hours = hours.data || []; S.timeoff = off.data || []; S.dishes = dishes.data || [];
    await loadOrders();
    if (S.fam.status === 'pending') loadDocs().then(() => { if (S.tab === 'orders') renderView(); }).catch(() => {});
  }
  async function loadOrders() {
    const since = dayStart(-1);
    const { data, error } = await SF.sb.from('sf_orders').select('*')
      .eq('family_id', S.famId).neq('status', 'pending_payment')
      .or(`status.in.(new,preparing,ready,on_the_way),created_at.gte."${since}",status_at.gte."${since}"`)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const initial = !S.ordersReady;
    const old = S.orders; const next = new Map(); const arrived = [];
    let changed = initial;
    (data || []).forEach((r) => {
      const prev = old.get(r.id);
      if (!initial && r.status === 'new' && (!prev || prev.status !== 'new')) arrived.push(r);
      if (!prev || prev.status !== r.status || prev.updated_at !== r.updated_at) changed = true;
      next.set(r.id, r);
    });
    // نخلي القديمة المنتهية اللي ما رجعت بالاستعلام (تبقى لين تقلب الصفحة)
    old.forEach((r, k) => { if (!next.has(k)) { if (DONE.includes(r.status)) next.set(k, r); else changed = true; } });
    S.orders = next; S.ordersReady = true;
    saveAck();
    if (arrived.length) onArrived(arrived);
    if (changed) refreshOrdersUI();
  }
  async function loadDishes() {
    const { data, error } = await SF.sb.from('sf_dishes').select('*').eq('family_id', S.famId).order('sort').order('created_at');
    if (error) throw error;
    S.dishes = data || [];
  }
  async function loadDocs() {
    const { data, error } = await SF.sb.from('sf_family_docs').select('*').eq('family_id', S.famId).order('created_at', { ascending: false });
    if (error) throw error;
    S.docs = data || [];
  }
  async function loadReviews() {
    const { data, error } = await SF.sb.from('sf_orders').select('id,order_no,customer_name,rating,review,review_photo,reviewed_at,family_reply,review_hidden,items')
      .eq('family_id', S.famId).not('rating', 'is', null).order('reviewed_at', { ascending: false }).limit(50);
    if (error) throw error;
    S.reviews = data || [];
  }

  // ───────── التحديث الحي ─────────
  function subscribe() {
    S.chans.forEach((ch) => { try { SF.sb.removeChannel(ch); } catch { /* */ } });
    S.chans = [
      SF.live('sf_orders', `family_id=eq.${S.famId}`, onOrderEvent, `fam-orders-${S.famId}`),
      SF.live('sf_families', `id=eq.${S.famId}`, (p) => { if (p.new && p.new.id === S.famId) { S.fam = { ...S.fam, ...p.new }; renderHeader(); } }, `fam-self-${S.famId}`),
    ];
  }
  function onOrderEvent(p) {
    if (p.eventType === 'DELETE') { if (p.old && p.old.id) { S.orders.delete(p.old.id); refreshOrdersUI(); } return; }
    const r = p.new; if (!r || !r.id || r.family_id !== S.famId) return;
    if (r.status === 'pending_payment') return;
    const prev = S.orders.get(r.id);
    S.orders.set(r.id, prev ? { ...prev, ...r } : r);
    if (r.status === 'new' && (!prev || prev.status !== 'new')) onArrived([r]);
    else if (prev && prev.status !== r.status && r.status === 'cancelled' && r.cancelled_by !== 'family') SF.toast(t(`انلغى طلب #${r.order_no}`, `Order #${r.order_no} was cancelled`), 'bad');
    saveAck();
    refreshOrdersUI();
  }
  function onArrived(list) {
    list.forEach((o) => SF.toast(t(`وصلك طلب جديد #${o.order_no}`, `New order #${o.order_no}`), 'ok'));
    syncAlert();
    if (!document.querySelector('.sheet.is-open')) {
      S.seg = 'new';
      if (S.tab !== 'orders') go('orders'); else renderView();
    }
  }
  function refreshOrdersUI() {
    if (S.screen !== 'app') return;
    renderHeader(); renderNav(); syncAlert();
    if (S.tab === 'orders') renderOrders();
  }
  async function reloadOrder(id) {
    const { data } = await SF.sb.from('sf_orders').select('*').eq('id', id).maybeSingle();
    if (data) S.orders.set(data.id, data);
    saveAck(); refreshOrdersUI();
  }
  function handleDeepLink() {
    const id = new URLSearchParams(location.search).get('order');
    if (!id) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch { /* */ }
    const o = S.orders.get(id); if (!o) return;
    ack([id]);
    const sg = segOf(o); if (sg === 'new') S.seg = 'new'; else { S.seg = sg; S.segB = sg; }
    go('orders');
    setTimeout(() => focusCard(id), 120);
  }
  function focusCard(id) {
    const el = document.querySelector(`.oc[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('is-focus'); setTimeout(() => el.classList.remove('is-focus'), 2200);
  }

  // ───────── الهيكل: الرأس والتنقل ─────────
  function renderApp() {
    S.screen = 'app';
    app.innerHTML = `
      <div class="fam-shell">
        <header class="fam-hdr" id="famHdr"></header>
        <div class="sadu"></div>
        <div class="fam-body">
          <nav class="bottomnav fam-nav" id="famNav" aria-label="${esc(t('التنقل', 'Navigation'))}"></nav>
          <main class="fam-main" id="view" tabindex="-1"></main>
        </div>
      </div>`;
    renderHeader(); renderNav(); renderView(); syncAlert();
  }
  function openState() {
    const f = S.fam;
    if (!f) return { kind: 'off', txt: '' };
    if (f.status === 'pending') return { kind: 'off', txt: t('تحت المراجعة', 'Under review') };
    if (f.status !== 'active') return { kind: 'off', txt: t('الحساب موقوف', 'Account paused') };
    if (!f.is_open) return { kind: 'off', txt: t('استقبال الطلبات موقّف', 'Not taking orders') };
    const today = SF.todayISO();
    const vac = S.timeoff.find((x) => today >= x.from_date && today <= x.to_date);
    if (vac) return { kind: 'off', txt: t(`في إجازة لين ${fmtD(vac.to_date)}`, `On vacation until ${fmtD(vac.to_date)}`) };
    const now = riyNow();
    const todays = S.hours.filter((h) => h.dow === now.dow).sort((a, b) => a.open_min - b.open_min);
    const cur = todays.find((h) => now.min >= h.open_min && now.min < h.close_min);
    if (cur) return { kind: 'open', txt: t(`مفتوح الحين · يسكر ${fmtMin(cur.close_min)}`, `Open now · closes ${fmtMin(cur.close_min)}`) };
    const nx = todays.find((h) => h.open_min > now.min);
    if (nx) return { kind: 'closed', txt: t(`مسكّر الحين · يفتح ${fmtMin(nx.open_min)}`, `Closed now · opens ${fmtMin(nx.open_min)}`) };
    return { kind: 'closed', txt: t('خلص دوام اليوم، والحجز المسبق شغّال', 'Closed for today, pre-orders still on') };
  }
  const segOf = (o) => (o.status === 'new' ? 'new' : o.status === 'preparing' ? 'preparing' : o.status === 'ready' || o.status === 'on_the_way' ? 'ready' : 'done');
  function counts() {
    const today = SF.todayISO(); const yday = SF.dayISO(-1);
    const c = { n: 0, p: 0, r: 0, d: 0, done: 0, net: 0 };
    S.orders.forEach((o) => {
      if (o.status === 'pending_payment') return;
      const s = segOf(o);
      if (s === 'new') c.n += 1; else if (s === 'preparing') c.p += 1; else if (s === 'ready') c.r += 1; else if (riyDate(o.status_at) >= yday) c.d += 1;
      if ((o.status === 'delivered' || o.status === 'picked_up') && riyDate(o.done_at) === today && !o.is_test) { c.done += 1; c.net += +o.family_net || 0; }
    });
    return c;
  }
  function renderHeader() {
    const h = $('#famHdr'); if (!h || !S.fam) return;
    const f = S.fam; const st = openState(); const c = counts();
    h.innerHTML = `
      <div class="fh-in">
        <div class="fh-id">
          <span class="fh-logo"><img class="fh-mark" src="img/mark.svg" alt="">${f.logo_url ? `<img class="fh-img" src="${esc(f.logo_url)}" alt="" onerror="this.remove()">` : ''}</span>
          <div class="fh-txt"><h1 class="fh-name">${esc(SF.nm(f, 'name'))}</h1><div class="fh-st is-${st.kind}"><span class="dot"></span><span>${esc(st.txt)}</span></div></div>
        </div>
        <button type="button" class="openbtn ${f.is_open ? 'is-on' : ''}" id="openBtn" role="switch" aria-checked="${f.is_open ? 'true' : 'false'}">
          <span class="ob-cap">${esc(t('استقبال الطلبات', 'Taking orders'))}</span>
          <span class="ob-pill"><span class="ob-word">${esc(f.is_open ? t('شغّال', 'On') : t('موقّف', 'Off'))}</span><span class="ob-knob">${ic(f.is_open ? 'check' : 'power', 's')}</span></span>
        </button>
      </div>
      <div class="fh-sum" role="group" aria-label="${esc(t('ملخص اليوم', "Today's summary"))}">
        <button type="button" data-go="orders:new" class="${c.n ? 'is-hot' : ''}"><b>${c.n}</b><small>${esc(t('جديدة', 'New'))}</small></button>
        <button type="button" data-go="orders:preparing"><b>${c.p}</b><small>${esc(t('قيد التجهيز', 'Preparing'))}</small></button>
        <button type="button" data-go="orders:done"><b>${c.done}</b><small>${esc(t('تمت اليوم', 'Done today'))}</small></button>
        <button type="button" data-go="finance:today"><b>${grp(Math.round(c.net))}</b><small>${esc(t('صافي اليوم (ر.س)', "Today's net (SAR)"))}</small></button>
      </div>`;
  }
  function renderNav() {
    const n = $('#famNav'); if (!n) return;
    const c = counts();
    const items = [['orders', 'receipt', t('الطلبات', 'Orders'), c.n], ['menu', 'dish', t('المنيو', 'Menu'), 0], ['finance', 'wallet', t('الحساب', 'Earnings'), 0], ['kitchen', 'store', t('مطبخي', 'My kitchen'), 0]];
    n.innerHTML = `<div class="bottomnav-in">${items.map(([k, i, l, cn]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? 'is-active' : ''}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${esc(l)}</span>${cn ? `<span class="count">${cn}</span>` : ''}</button>`).join('')}</div>`;
  }
  function renderView() {
    if (S.screen !== 'app') return;
    $$('#famNav [data-tab]').forEach((b) => { const on = b.dataset.tab === S.tab; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const v = $('#view'); if (!v) return;
    v.dataset.view = S.tab;
    if (S.tab === 'orders') renderOrders();
    else if (S.tab === 'menu') renderMenu();
    else if (S.tab === 'finance') renderFinance();
    else renderKitchen();
  }
  function go(tab, sub) {
    if (tab === 'orders' && sub) { if (sub === 'new') S.seg = 'new'; else { S.seg = sub; S.segB = sub; } }
    if (tab === 'finance' && sub) { S.period = sub; S.finErr = false; }
    if (location.hash !== `#${tab}`) location.hash = tab;
    else { S.tab = tab; renderView(); }
  }
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1); const tab = TABS.includes(h) ? h : 'orders';
    for (let i = 0; i < 6 && document.querySelector('.sheet.is-open'); i += 1) SF.closeSheet();
    S.tab = tab; renderView(); window.scrollTo(0, 0);
  });

  // ───────── الطلبات ─────────
  function deadline(o) {
    const st = new Date(o.status_at).getTime();
    if (!o.scheduled_for) { const m = SF.setNum('accept_timeout_min', 15); return { end: st + m * 60000, total: m * 60000 }; }
    const m = SF.setNum('accept_timeout_sched_min', 180);
    const end = Math.min(st + m * 60000, new Date(o.scheduled_for).getTime() - 30 * 60000);
    return { end, total: Math.max(end - st, 60000) };
  }
  function listFor(seg) {
    const ts = (x) => (x ? new Date(x).getTime() : 0);
    const yday = SF.dayISO(-1);
    const arr = [...S.orders.values()].filter((o) => o.status !== 'pending_payment' && segOf(o) === seg && (seg !== 'done' || riyDate(o.status_at) >= yday));
    if (seg === 'new') arr.sort((a, b) => deadline(a).end - deadline(b).end);
    else if (seg === 'preparing') arr.sort((a, b) => (ts(a.ready_eta) || ts(a.scheduled_for)) - (ts(b.ready_eta) || ts(b.scheduled_for)));
    else if (seg === 'ready') arr.sort((a, b) => ts(a.ready_at || a.status_at) - ts(b.ready_at || b.status_at));
    else arr.sort((a, b) => ts(b.status_at) - ts(a.status_at));
    return arr;
  }
  function topNotices() {
    const f = S.fam; const p = S.priv || {}; let h = '';
    if (f.status === 'pending') h += `<div class="notice info fam-banner">${ic('info')}<span><b>${esc(t('حسابك تحت المراجعة، كمّل بيانات مطبخك ومنيوك', 'Your account is under review. Complete your kitchen details and menu'))}</b></span></div>${checklistHtml()}`;
    else if (f.status === 'suspended' || f.status === 'closed') {
      const wa = SF.settings.support_whatsapp;
      h += `<div class="notice bad fam-banner">${ic('alert')}<span class="grow"><b>${esc(t('حسابك موقوف مؤقتًا، تواصل مع الدعم', 'Your account is paused, please contact support'))}</b></span>${wa ? `<a class="btn btn-sm btn-danger" href="${esc(SF.waLink(wa))}" target="_blank" rel="noopener">${ic('whatsapp', 's')} ${esc(t('الدعم', 'Support'))}</a>` : ''}</div>`;
    } else if (!p.lat || !p.lng) h += `<div class="notice bad fam-banner">${ic('pin')}<span class="grow">${esc(t('حدد موقع مطبخك عشان يقدر العملاء يطلبون توصيل', 'Set your kitchen location so customers can order delivery'))}</span><button type="button" class="btn btn-sm btn-danger" data-k="location">${esc(t('حدده الحين', 'Set it now'))}</button></div>`;
    return h;
  }
  function checklistHtml() {
    const f = S.fam; const p = S.priv || {};
    const withPhoto = S.dishes.filter((d) => d.image_url).length;
    const items = [
      [!!(f.logo_url && f.cover_url), t('أضف شعار وصورة غلاف لمطبخك', 'Add a logo and a cover photo'), 'profile'],
      [!!(p.lat && p.lng), t('حدد موقع المطبخ على الخريطة', 'Pin your kitchen on the map'), 'location'],
      [!!(p.whatsapp || p.phone), t('أضف رقم الجوال والواتساب', 'Add your phone and WhatsApp'), 'contact'],
      [S.hours.length > 0, t('حدد أوقات الدوام', 'Set your working hours'), 'hours'],
      [withPhoto >= 3, t('أضف 3 أطباق على الأقل بصورها', 'Add at least 3 dishes with photos'), 'menu'],
      [!!(S.docs && S.docs.some((d) => ['freelance', 'family_cert'].includes(d.kind))), t('ارفع وثيقة العمل الحر أو شهادة الأسرة المنتجة', 'Upload your freelance or productive family certificate'), 'docs'],
    ];
    const done = items.filter((x) => x[0]).length;
    return `<section class="card pad check-card">
      <div class="card-title"><h3>${esc(t('خطوات تجهيز مطبخك', 'Get your kitchen ready'))}</h3><span class="badge b-brand">${done} / ${items.length}</span></div>
      <div class="meter"><i style="width:${Math.round((done / items.length) * 100)}%"></i></div>
      <ul class="check-list">${items.map(([ok, label, k]) => `<li class="${ok ? 'is-done' : ''}"><span class="ck">${ok ? ic('check', 's') : ''}</span><span class="grow">${esc(label)}</span>${ok ? '' : `<button type="button" class="btn btn-soft btn-sm" ${k === 'menu' ? 'data-tab="menu"' : `data-k="${k}"`}>${esc(t('كمّل', 'Do it'))}</button>`}</li>`).join('')}</ul>
    </section>`;
  }
  function renderOrders() {
    const v = $('#view'); if (!v || S.tab !== 'orders') return;
    const c = counts();
    const segs = [['new', t('جديدة', 'New'), c.n], ['preparing', t('قيد التجهيز', 'Preparing'), c.p], ['ready', t('جاهزة', 'Ready'), c.r], ['done', t('المنتهية', 'Finished'), c.d]];
    const segBtn = ([k, l, n], cur, attr) => `<button type="button" ${attr}="${k}" class="${cur === k ? 'is-active' : ''}" aria-pressed="${cur === k}"><span class="sl">${esc(l)}</span>${n && k !== 'done' ? `<i class="sn ${k === 'new' ? 'hot' : ''}">${n}</i>` : ''}</button>`;
    let html = `${topNotices()}<div id="sndHint"></div>`;
    if (isWide()) {
      if (S.segB === 'new') S.segB = 'preparing';
      html += `<div class="board">
        <section class="bcol bcol-new" aria-label="${esc(t('الطلبات الجديدة', 'New orders'))}">
          <div class="bcol-head"><h2>${esc(t('طلبات جديدة', 'New orders'))}</h2>${c.n ? `<i class="sn hot">${c.n}</i>` : ''}</div>
          ${listHtml('new')}
        </section>
        <section class="bcol" aria-label="${esc(t('الطلبات الشغّالة', 'Orders in progress'))}">
          <div class="seg oseg">${segs.slice(1).map((s) => segBtn(s, S.segB, 'data-segb')).join('')}</div>
          ${listHtml(S.segB)}
        </section>
      </div>`;
    } else {
      html += `<div class="oseg-wrap"><div class="seg oseg">${segs.map((s) => segBtn(s, S.seg, 'data-seg')).join('')}</div></div>${listHtml(S.seg)}`;
    }
    // نحافظ على «تفاصيل المبلغ» المفتوحة بعد إعادة الرسم
    const openDet = $$('.oc details[open]', v).map((d) => d.closest('.oc').dataset.id);
    v.innerHTML = html;
    openDet.forEach((id) => { const el = v.querySelector(`.oc[data-id="${CSS.escape(id)}"] details`); if (el) el.open = true; });
    renderSoundHint();
    tick();
  }
  function listHtml(seg) {
    if (!S.ordersReady) return `<div class="olist"><div class="skel oc-skel"></div><div class="skel oc-skel"></div></div>`;
    const arr = listFor(seg);
    if (!arr.length) return emptyHtml(seg);
    return `<div class="olist">${arr.map(orderCard).join('')}</div>`;
  }
  function emptyHtml(seg) {
    if (seg === 'new' && !S.fam.is_open) {
      return `<div class="empty o-empty"><div class="art">${ic('power')}</div><h3>${esc(t('استقبال الطلبات موقّف', 'You are not taking orders'))}</h3><p>${esc(t('شغّله من الزر فوق عشان توصلك الطلبات.', 'Turn it on from the switch above to receive orders.'))}</p></div>`;
    }
    const m = {
      new: [ic('bell'), t('ما فيه طلبات جديدة', 'No new orders'), t('أول ما يوصلك طلب بتسمع تنبيه وتشوفه هنا.', 'When an order arrives you will hear an alert and see it here.')],
      preparing: [ic('flame'), t('ما فيه طلبات قيد التجهيز', 'Nothing being prepared'), t('الطلبات اللي تقبلها تنتقل هنا.', 'Orders you accept move here.')],
      ready: [ic('box'), t('ما فيه طلبات جاهزة', 'No ready orders'), t('لما يجهز الطلب اضغط «جاهز» ويطلع هنا.', 'Tap Ready when an order is done and it shows here.')],
      done: [ic('receipt'), t('ما فيه طلبات منتهية اليوم وأمس', 'No finished orders today or yesterday'), t('الطلبات اللي تسلمها أو تنلغي تبان هنا.', 'Delivered and cancelled orders show here.')],
    }[seg];
    return `<div class="empty o-empty"><div class="art">${m[0]}</div><h3>${esc(m[1])}</h3><p>${esc(m[2])}</p></div>`;
  }
  function whenHtml(o) {
    if (o.scheduled_for) {
      return `<div class="oc-when is-sched">${ic('calendar')}<div><small>${esc(t('موعد التسليم', 'Scheduled for'))}</small><b>${esc(dayWord(o.scheduled_for))} · ${esc(SF.fmtTime(o.scheduled_for))} ${esc(t('إلى', 'to'))} ${esc(SF.fmtTime(o.window_end))}</b></div></div>`;
    }
    return `<div class="oc-when is-asap">${ic('flame')}<b>${esc(t('بأسرع وقت', 'As soon as possible'))}</b></div>`;
  }
  function cdHtml(o) {
    if (o.status !== 'new') return '';
    const { end, total } = deadline(o);
    const left = end - Date.now();
    const label = o.scheduled_for ? t(`اقبله قبل ${SF.fmtTime(new Date(end).toISOString())} وإلا يتلغى`, `Accept before ${SF.fmtTime(new Date(end).toISOString())} or it is cancelled`) : t('اقبل الطلب قبل ما يتلغى تلقائيًا', 'Accept before it is cancelled automatically');
    return `<div class="oc-cd ${left < 180000 ? 'is-low' : ''}" data-cd="${end}" data-total="${total}">
      <div class="cd-row">${ic('clock', 's')}<span class="grow">${esc(label)}</span><b class="cd-t" dir="ltr">${left > 0 ? fmtLeft(left) : esc(t('الحين', 'now'))}</b></div>
      <div class="cd-bar"><i style="width:${Math.max(0, Math.min(100, (left / total) * 100))}%"></i></div>
    </div>`;
  }
  function etaHtml(o) {
    if (o.status === 'preparing' && o.ready_eta) {
      const late = Date.now() - new Date(o.ready_eta).getTime();
      const lateTxt = late > 60000 ? ` · ${esc(t(`متأخر ${durTxt(late / 60000)}`, `${durTxt(late / 60000)} late`))}` : '';
      return `<div class="oc-eta ${late > 60000 ? 'is-late' : ''}">${ic('clock', 's')}<span>${esc(t('متوقع يجهز الساعة', 'Expected ready at'))} <b>${esc(SF.fmtTime(o.ready_eta))}</b>${lateTxt}</span></div>`;
    }
    if (o.status === 'ready' && o.ready_at) return `<div class="oc-eta">${ic('check', 's')}<span>${esc(t('جاهز من الساعة', 'Ready since'))} <b>${esc(SF.fmtTime(o.ready_at))}</b></span></div>`;
    if (o.status === 'on_the_way') return `<div class="oc-eta">${ic('bike', 's')}<span>${esc(t('طلع للتوصيل الساعة', 'Left for delivery at'))} <b>${esc(SF.fmtTime(o.status_at))}</b></span></div>`;
    return '';
  }
  function optLines(it) {
    const groups = new Map();
    (it.options || []).forEach((op) => {
      const g = SF.lang === 'en' ? (op.group_en || op.group_ar || '') : (op.group_ar || op.group_en || '');
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(SF.nm(op, 'name'));
    });
    return [...groups.entries()].map(([g, list]) => `<div class="opt">${g ? `${esc(g)}: ` : ''}<b>${esc(list.join(t('، ', ', ')))}</b></div>`).join('');
  }
  function itemsHtml(o) {
    const items = Array.isArray(o.items) ? o.items : [];
    return `<ul class="oc-items">${items.map((it) => `<li>
      <span class="q"><bdi>${esc(it.qty)}×</bdi></span>
      <div class="it"><b class="nm">${esc(SF.nm(it, 'name'))}</b>${optLines(it)}${it.note ? `<div class="lnote">${ic('chat', 's')}<span>${esc(it.note)}</span></div>` : ''}</div>
      <span class="lt">${esc(SF.money(it.line_total))}</span>
    </li>`).join('')}</ul>`;
  }
  function payHtml(o) {
    if (o.pay_method === 'cod') {
      if (o.status === 'delivered' || o.status === 'picked_up') return `<div class="oc-pay is-paid">${ic('check', 's')}<span class="grow">${esc(t('استلمت المبلغ كاش', 'Cash collected'))}</span><b>${esc(SF.money(o.total))}</b></div>`;
      if (o.status === 'cancelled' || o.status === 'rejected') return `<div class="oc-pay">${ic('wallet', 's')}<span class="grow">${esc(t('كاش عند الاستلام', 'Cash on delivery'))}</span></div>`;
      return `<div class="oc-pay is-cod">${ic('wallet')}<span class="grow"><small>${esc(t('كاش عند الاستلام', 'Cash on delivery'))}</small>${esc(t('اجمع من العميل', 'Collect from the customer'))}</span><b>${SF.moneyHtml(o.total)}</b></div>`;
    }
    if (o.pay_status === 'refund_pending' || o.pay_status === 'refunded') return `<div class="oc-pay">${ic('refresh', 's')}<span class="grow">${esc(t('المبلغ يرجع للعميل', 'Refunded to the customer'))}</span></div>`;
    if (o.pay_status === 'paid' || o.pay_method === 'free') return `<div class="oc-pay is-paid">${ic('check', 's')}<span class="grow">${esc(o.pay_method === 'card' ? t('مدفوع بالبطاقة، لا تاخذ كاش', 'Paid by card, do not collect cash') : t('مدفوع بالكامل', 'Fully paid'))}</span></div>`;
    return `<div class="oc-pay">${ic('clock', 's')}<span class="grow">${esc(t('بانتظار الدفع', 'Awaiting payment'))}</span></div>`;
  }
  function totalsHtml(o) {
    const neg = (v) => `<bdi dir="ltr">-${esc(SF.n2(v))}</bdi> ${esc(t('ر.س', 'SAR'))}`;
    const rows = [[t('قيمة الأكل', 'Food'), SF.money(o.subtotal)]];
    if (+o.delivery_fee) rows.push([t('التوصيل', 'Delivery'), SF.money(o.delivery_fee)]);
    if (+o.small_order_fee) rows.push([t('رسوم الطلب الصغير', 'Small order fee'), SF.money(o.small_order_fee)]);
    if (+o.discount) rows.push([t('الخصم', 'Discount'), null, neg(o.discount)]);
    if (+o.credit_used) rows.push([t('رصيد العميل', 'Customer credit'), null, neg(o.credit_used)]);
    if (+o.vat) rows.push([t('الضريبة', 'VAT'), SF.money(o.vat)]);
    return `<div class="oc-tot">
      <div><small>${esc(t('الإجمالي', 'Total'))}</small><b>${SF.moneyHtml(o.total)}</b></div>
      <div class="net"><small>${esc(t('صافي لك', 'Your net'))}</small><b>${SF.moneyHtml(o.family_net)}</b></div>
    </div>
    <details class="oc-more"><summary>${esc(t('تفاصيل المبلغ', 'Amount details'))}</summary><div class="sum">
      ${rows.map(([l, v, h]) => `<div class="r"><span>${esc(l)}</span><b>${h || esc(v)}</b></div>`).join('')}
      <div class="r"><span>${esc(t('الإجمالي اللي يدفعه العميل', 'Customer pays'))}</span><b>${esc(SF.money(o.total))}</b></div>
      <div class="r"><span>${esc(t('عمولة سُفرة', 'Sufrah commission'))} (${esc(SF.n2(o.commission_pct))}%)</span><b>${neg(o.commission)}</b></div>
      <div class="r total"><span>${esc(t('صافي لك', 'Your net'))}</span><b>${esc(SF.money(o.family_net))}</b></div>
    </div></details>`;
  }
  function reasonLine(o) {
    if (o.status !== 'cancelled' && o.status !== 'rejected') return '';
    const by = {
      customer: t('ألغاه العميل', 'Cancelled by the customer'),
      family: o.status === 'rejected' ? t('اعتذرت عنه', 'You declined it') : t('ألغيته', 'You cancelled it'),
      admin: t('ألغته الإدارة', 'Cancelled by Sufrah'),
      system: t('انلغى تلقائيًا لأنه ما انقبل بالوقت', 'Cancelled automatically, it was not accepted in time'),
    }[o.cancelled_by] || '';
    const why = o.cancelled_by !== 'system' && o.cancel_reason ? `${t('السبب', 'Reason')}: ${o.cancel_reason}` : '';
    return `<div class="oc-reason">${ic('info', 's')}<span>${esc([by, why].filter(Boolean).join(' · '))}</span></div>`;
  }
  function actionsHtml(o) {
    const id = esc(o.id);
    const b = (act, cls, label, icon = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${id}">${icon ? ic(icon) : ''}${esc(label)}</button>`;
    switch (o.status) {
      case 'new': return `<div class="oc-act">${b('accept', 'btn-ok grow', t('قبول', 'Accept'), 'check')}${b('reject', 'btn-danger', t('اعتذار', 'Decline'))}</div>`;
      case 'preparing': return `<div class="oc-act">${b('ready', 'btn-primary grow', o.fulfillment === 'pickup' ? t('جاهز للاستلام', 'Ready for pickup') : t('جاهز', 'Ready'), 'check')}${b('cancel', 'btn-ghost', t('إلغاء', 'Cancel'))}</div>`;
      case 'ready':
        if (o.fulfillment === 'pickup') return `<div class="oc-act">${b('picked', 'btn-ok grow', t('استلمه العميل', 'Customer picked it up'), 'check')}${b('cancel', 'btn-ghost', t('إلغاء', 'Cancel'))}</div>`;
        return `<div class="oc-act wrap">${b('otw', 'btn-primary grow', t('طلع للتوصيل', 'Out for delivery'), 'bike')}${b('delivered', 'btn-soft grow', t('تم التسليم', 'Delivered'), 'check')}${b('cancel', 'btn-ghost', t('إلغاء', 'Cancel'))}</div>`;
      case 'on_the_way': return `<div class="oc-act">${b('delivered', 'btn-ok grow', t('تم التوصيل', 'Delivered'), 'check')}</div>`;
      default: return '';
    }
  }
  const waText = (o) => t(`هلا ${firstName(o.customer_name)}، معك ${SF.nm(S.fam, 'name')} بخصوص طلبك رقم ${o.order_no} من سُفرة.`, `Hi ${firstName(o.customer_name)}, this is ${SF.nm(S.fam, 'name')} about your Sufrah order #${o.order_no}.`);
  function toolsHtml(o) {
    const live = LIVE.includes(o.status);
    const ph = SF.normPhone(o.customer_phone);
    const a = o.address || {};
    const out = [];
    if (live && ph) {
      out.push(`<a class="tool" href="tel:+${esc(ph)}">${ic('phone')}<span>${esc(t('اتصال', 'Call'))}</span></a>`);
      out.push(`<a class="tool" href="${esc(SF.waLink(ph, waText(o)))}" target="_blank" rel="noopener">${ic('whatsapp')}<span>${esc(t('واتساب', 'WhatsApp'))}</span></a>`);
    }
    if (live && o.fulfillment === 'delivery' && a.lat && a.lng) out.push(`<a class="tool" href="https://maps.google.com/?q=${+a.lat},${+a.lng}" target="_blank" rel="noopener">${ic('nav')}<span>${esc(t('الخريطة', 'Map'))}</span></a>`);
    if (!NATIVE) out.push(`<button type="button" class="tool" data-act="print" data-id="${esc(o.id)}">${ic('file')}<span>${esc(t('طباعة', 'Print'))}</span></button>`);
    return out.length ? `<div class="oc-tools" style="--n:${out.length}">${out.join('')}</div>` : '';
  }
  function addrLine(o) {
    const a = o.address || {};
    const parts = [a.label, a.street, a.details].filter(Boolean);
    return parts.length ? `<div class="oc-addr">${ic('pin', 's')}<span>${esc(parts.join(t('، ', ', ')))}</span></div>` : '';
  }
  function orderCard(o) {
    const done = DONE.includes(o.status);
    const open = !done || S.expanded.has(o.id);
    const unseen = o.status === 'new' && !acked.has(o.id);
    const ful = o.fulfillment; const a = o.address || {};
    const head = `<header class="oc-head">
        <span class="oc-no"><bdi>#${esc(o.order_no)}</bdi></span>
        ${fBadge(o.status, ful)}
        ${o.is_test ? `<span class="badge">${esc(t('تجريبي', 'Test'))}</span>` : ''}
        <span class="oc-ago" data-ago="${esc(o.created_at)}">${esc(SF.ago(o.created_at))}</span>
      </header>`;
    if (!open) {
      const sum = (o.items || []).map((it) => `${SF.nm(it, 'name')} ×${it.qty}`).join(t('، ', ', '));
      return `<article class="oc s-${esc(o.status)} is-compact" data-id="${esc(o.id)}">${head}
        <p class="oc-sum">${esc(sum)}</p>
        ${reasonLine(o)}
        ${o.rating ? `<div class="oc-rate">${stars(o.rating)}${o.review ? `<span>${esc(o.review)}</span>` : ''}</div>` : ''}
        <div class="oc-foot"><span>${esc(t('الإجمالي', 'Total'))} <b>${esc(SF.money(o.total))}</b></span>${o.status === 'delivered' || o.status === 'picked_up' ? `<span class="net">${esc(t('صافي لك', 'Your net'))} <b>${esc(SF.money(o.family_net))}</b></span>` : ''}<button type="button" class="link" data-act="expand" data-id="${esc(o.id)}">${esc(t('التفاصيل', 'Details'))}</button></div>
      </article>`;
    }
    const where = ful === 'pickup'
      ? `<span>${ic('store', 's')}${esc(t('استلام من المطبخ', 'Pickup from your kitchen'))}</span>`
      : `<span>${ic('bike', 's')}${esc(t('توصيل', 'Delivery'))}${a.district ? ` · ${esc(a.district)}` : ''}${o.distance_km != null ? ` · <bdi>${esc(SF.n2(o.distance_km))}</bdi> ${esc(t('كم', 'km'))}` : ''}</span>`;
    return `<article class="oc s-${esc(o.status)} ${unseen ? 'is-unseen' : ''}" data-id="${esc(o.id)}">
      ${head}
      ${whenHtml(o)}
      ${cdHtml(o)}
      ${etaHtml(o)}
      <div class="oc-who"><span>${ic('user', 's')}${esc(firstName(o.customer_name))}</span>${where}</div>
      ${ful === 'delivery' ? addrLine(o) : ''}
      ${itemsHtml(o)}
      ${o.note ? `<div class="oc-note">${ic('chat', 's')}<div><small>${esc(t('ملاحظة العميل', 'Customer note'))}</small><p>${esc(o.note)}</p></div></div>` : ''}
      ${payHtml(o)}
      ${totalsHtml(o)}
      ${reasonLine(o)}
      ${o.rating ? `<div class="oc-rate">${stars(o.rating)}${o.review ? `<span>${esc(o.review)}</span>` : ''}</div>` : ''}
      ${actionsHtml(o)}
      ${toolsHtml(o)}
      ${done ? `<button type="button" class="link oc-less" data-act="expand" data-id="${esc(o.id)}">${esc(t('أخفِ التفاصيل', 'Hide details'))}</button>` : ''}
    </article>`;
  }
  function tick() {
    const now = Date.now();
    $$('[data-cd]').forEach((el) => {
      const end = +el.dataset.cd; const total = +el.dataset.total || 1; const left = end - now;
      const tEl = el.querySelector('.cd-t'); if (tEl) tEl.textContent = left > 0 ? fmtLeft(left) : t('الحين', 'now');
      const bar = el.querySelector('.cd-bar i'); if (bar) bar.style.width = `${Math.max(0, Math.min(100, (left / total) * 100))}%`;
      el.classList.toggle('is-low', left < 180000);
    });
  }

  // إجراءات الطلب
  async function setStatus(o, st, { eta = null, reason = null } = {}) {
    try {
      const r = await SF.rpc('sf_family_set_status', { p_order: o.id, p_status: st, p_eta_min: eta, p_reason: reason });
      if (!r || !r.ok) { SF.toast(SF.msgOf(r) || t('ما تغيّرت حالة الطلب', 'Status was not changed'), 'bad'); await reloadOrder(o.id); return false; }
      const msg = {
        preparing: t('تم قبول الطلب، وبلّغنا العميل', 'Order accepted, the customer was notified'), rejected: t('تم الاعتذار عن الطلب', 'Order declined'),
        ready: t('الطلب جاهز', 'Order is ready'), on_the_way: t('الطلب طلع للتوصيل', 'Order is out for delivery'),
        delivered: t('تم التوصيل، يعطيك العافية', 'Delivered, well done'), picked_up: t('تم التسليم، يعطيك العافية', 'Picked up, well done'), cancelled: t('تم إلغاء الطلب', 'Order cancelled'),
      }[st];
      SF.toast(msg || t('تم', 'Done'), 'ok');
      await reloadOrder(o.id);
      return true;
    } catch (e) { SF.toast(errMsg(e), 'bad'); return false; }
  }
  function acceptSheet(o) {
    const prep = Math.min(1440, Math.max(5, +S.fam.prep_min || 45));
    const chips = [...new Set([15, 30, 45, 60, 90, 120, prep])].sort((a, b) => a - b);
    let eta = prep;
    const sched = !!o.scheduled_for;
    const s = SF.openSheet(`
      ${sheetHead(t(`قبول طلب #${o.order_no}`, `Accept order #${o.order_no}`))}
      ${sched ? `<div class="notice info">${ic('calendar')}<span>${esc(t('الطلب مجدول بموعد', 'This order is scheduled for'))} <b>${esc(dayWord(o.scheduled_for))} · ${esc(SF.fmtTime(o.scheduled_for))} ${esc(t('إلى', 'to'))} ${esc(SF.fmtTime(o.window_end))}</b>. ${esc(t('جهّزه قبل الموعد.', 'Have it ready before then.'))}</span></div>`
        : `<p class="lead">${esc(t('متى بيكون الطلب جاهز؟', 'When will it be ready?'))}</p>
        <div class="eta-grid">${chips.map((m) => `<button type="button" class="eta ${m === eta ? 'is-active' : ''}" data-eta="${m}" aria-pressed="${m === eta}">${esc(durTxt(m))}</button>`).join('')}</div>
        <p class="eta-at" id="etaAt"></p>`}
      <div class="sheet-foot"><button type="button" class="btn btn-ok btn-lg btn-block" id="accOk">${ic('check')}${esc(t('اقبل الطلب', 'Accept order'))}</button></div>`, { noFocus: true });
    const upd = () => { const el = $('#etaAt', s.sh); if (el) el.innerHTML = `${esc(t('بيكون جاهز تقريبًا الساعة', 'Ready at about'))} <b>${esc(SF.fmtTime(new Date(Date.now() + eta * 60000).toISOString()))}</b>`; };
    upd();
    s.sh.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-eta]'); if (!btn) return;
      eta = +btn.dataset.eta;
      $$('[data-eta]', s.sh).forEach((x) => { x.classList.toggle('is-active', x === btn); x.setAttribute('aria-pressed', x === btn); });
      upd();
    });
    $('#accOk', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => { if (await setStatus(o, 'preparing', { eta: sched ? Math.max(prep, 30) : eta })) s.close(); });
  }
  function reasonSheet(o, st) {
    const rej = st === 'rejected';
    const reasons = rej
      ? [t('خلصت الكمية', 'Sold out'), t('المطبخ مشغول', 'The kitchen is busy'), t('خارج نطاق التوصيل', 'Outside our delivery area')]
      : [t('خلصت الكمية', 'Sold out'), t('ظرف طارئ في المطبخ', 'Kitchen emergency'), t('العميل طلب الإلغاء', 'The customer asked to cancel')];
    const s = SF.openSheet(`
      ${sheetHead(rej ? t(`الاعتذار عن طلب #${o.order_no}`, `Decline order #${o.order_no}`) : t(`إلغاء طلب #${o.order_no}`, `Cancel order #${o.order_no}`))}
      <p class="ink2">${esc(t('اختر السبب، بيوصل للعميل.', 'Pick a reason, the customer will see it.'))}</p>
      <div class="stack s" role="radiogroup">
        ${reasons.map((r, i) => `<label class="choice"><input type="radio" name="rs" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span class="grow">${esc(r)}</span></label>`).join('')}
        <label class="choice"><input type="radio" name="rs" value="__other"><span class="grow">${esc(t('غيره', 'Something else'))}</span></label>
      </div>
      <textarea class="textarea hide" id="rsOther" maxlength="200" placeholder="${esc(t('اكتب السبب للعميل', 'Write the reason for the customer'))}"></textarea>
      ${o.pay_method === 'card' && o.pay_status === 'paid' ? `<p class="muted small">${esc(t('المبلغ يرجع للعميل تلقائيًا.', 'The customer is refunded automatically.'))}</p>` : ''}
      <div class="sheet-foot"><button type="button" class="btn btn-danger btn-lg btn-block" id="rsOk">${esc(rej ? t('أرسل الاعتذار', 'Send decline') : t('ألغِ الطلب', 'Cancel order'))}</button></div>`, { noFocus: true });
    const other = $('#rsOther', s.sh);
    s.sh.addEventListener('change', () => { const v = ($('input[name=rs]:checked', s.sh) || {}).value; other.classList.toggle('hide', v !== '__other'); if (v === '__other') other.focus(); });
    $('#rsOk', s.sh).onclick = (e) => {
      const v = ($('input[name=rs]:checked', s.sh) || {}).value;
      const reason = v === '__other' ? other.value.trim() : v;
      if (!reason || reason.length < 2) { SF.toast(t('اكتب السبب', 'Please write a reason'), 'bad'); other.focus(); return; }
      SF.busy(e.currentTarget, async () => { if (await setStatus(o, st, { reason })) s.close(); });
    };
  }
  async function finishOrder(o, st, btn) {
    const cod = o.pay_method === 'cod';
    const ok = await SF.confirm({
      title: st === 'picked_up' ? t('العميل استلم الطلب؟', 'Did the customer pick it up?') : t('تم توصيل الطلب؟', 'Was the order delivered?'),
      body: cod ? t(`تأكد إنك استلمت ${SF.money(o.total)} كاش من العميل.`, `Make sure you collected ${SF.money(o.total)} in cash.`) : t('بنبلغ العميل إن طلبه وصل.', 'We will let the customer know.'),
      ok: st === 'picked_up' ? t('نعم، استلمه', 'Yes, picked up') : t('نعم، وصل', 'Yes, delivered'),
    });
    if (ok) await SF.busy(btn, () => setStatus(o, st));
  }
  function printTicket(o) {
    const el = $('#ticket'); if (!el) return;
    const a = o.address || {};
    const items = (o.items || []).map((it) => `<tr><td class="q">${esc(it.qty)}×</td><td><b>${esc(SF.nm(it, 'name'))}</b>${(it.options || []).length ? `<div>${esc((it.options || []).map((op) => SF.nm(op, 'name')).join(t('، ', ', ')))}</div>` : ''}${it.note ? `<div class="tn">${esc(t('ملاحظة', 'Note'))}: ${esc(it.note)}</div>` : ''}</td></tr>`).join('');
    el.innerHTML = `<div class="tk">
      <div class="tk-top"><b>${esc(t('سُفرة', 'Sufrah'))}</b><span>${esc(SF.nm(S.fam, 'name'))}</span></div>
      <div class="tk-no">#${esc(o.order_no)}</div>
      <div class="tk-when">${esc(o.scheduled_for ? `${t('موعد', 'Scheduled')}: ${dayWord(o.scheduled_for)} ${SF.fmtTime(o.scheduled_for)} ${t('إلى', 'to')} ${SF.fmtTime(o.window_end)}` : t('بأسرع وقت', 'As soon as possible'))}</div>
      <div class="tk-row">${esc(t('وقت الطلب', 'Ordered'))}: ${esc(SF.fmtDT(o.created_at))}</div>
      <div class="tk-row">${esc(o.fulfillment === 'pickup' ? t('استلام من المطبخ', 'Pickup') : `${t('توصيل', 'Delivery')}${a.district ? ` · ${a.district}` : ''}${o.distance_km != null ? ` · ${SF.n2(o.distance_km)} ${t('كم', 'km')}` : ''}`)}</div>
      ${o.fulfillment === 'delivery' && (a.street || a.details) ? `<div class="tk-row">${esc([a.street, a.details].filter(Boolean).join(t('، ', ', ')))}</div>` : ''}
      <div class="tk-row">${esc(t('العميل', 'Customer'))}: ${esc(firstName(o.customer_name))} <bdi dir="ltr">${esc(SF.showPhone(o.customer_phone))}</bdi></div>
      <table class="tk-items">${items}</table>
      ${o.note ? `<div class="tk-note">${esc(t('ملاحظة العميل', 'Customer note'))}: ${esc(o.note)}</div>` : ''}
      <div class="tk-tot"><span>${esc(t('الإجمالي', 'Total'))}</span><b>${esc(SF.money(o.total))}</b></div>
      <div class="tk-pay">${esc(o.pay_method === 'cod' ? t(`كاش عند الاستلام · اجمع ${SF.money(o.total)}`, `Cash on delivery · collect ${SF.money(o.total)}`) : t('مدفوع', 'Paid'))}</div>
    </div>`;
    document.body.classList.add('print-ticket');
    const done = () => document.body.classList.remove('print-ticket');
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => { try { window.print(); } catch { done(); } }, 60);
  }
  function doAct(act, id, btn) {
    const o = S.orders.get(id);
    if (act === 'expand') { if (S.expanded.has(id)) S.expanded.delete(id); else S.expanded.add(id); renderOrders(); return; }
    if (!o) return;
    ack([id]);
    if (act === 'accept') acceptSheet(o);
    else if (act === 'reject') reasonSheet(o, 'rejected');
    else if (act === 'cancel') reasonSheet(o, 'cancelled');
    else if (act === 'ready') SF.busy(btn, () => setStatus(o, 'ready'));
    else if (act === 'otw') SF.busy(btn, () => setStatus(o, 'on_the_way'));
    else if (act === 'delivered') finishOrder(o, 'delivered', btn);
    else if (act === 'picked') finishOrder(o, 'picked_up', btn);
    else if (act === 'print') printTicket(o);
  }
  async function toggleOpen() {
    const f = S.fam; const next = !f.is_open;
    if (!next) {
      const ok = await SF.confirm({ title: t('توقف استقبال الطلبات؟', 'Stop taking orders?'), body: t('ما بيقدر أحد يطلب منك لين ترجع تشغّله.', 'Nobody can order from you until you turn it back on.'), ok: t('أوقف الطلبات', 'Stop orders'), danger: true });
      if (!ok) return;
    }
    f.is_open = next; renderHeader();
    try {
      const r = await SF.rpc('sf_f_save', { p: { is_open: next } });
      if (r && r.id) S.fam = { ...S.fam, ...r };
      SF.toast(next ? t('استقبال الطلبات شغّال', 'You are taking orders') : t('استقبال الطلبات موقّف', 'Orders are paused'), 'ok');
    } catch (e) { f.is_open = !next; SF.toast(errMsg(e), 'bad'); }
    renderHeader();
    if (S.tab === 'orders') renderOrders();
  }

  // ───────── المنيو ─────────
  const bySort = (a, b) => (a.sort - b.sort) || String(a.created_at).localeCompare(String(b.created_at));
  const sectionKey = (d) => (d.section || '').trim() || catName(d.category_id) || t('بدون قسم', 'Other');
  function renderMenu() {
    const v = $('#view'); if (!v || S.tab !== 'menu') return;
    const ds = [...S.dishes].sort(bySort);
    const groups = new Map();
    ds.forEach((d) => { const k = sectionKey(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
    const avail = ds.filter((d) => d.available).length;
    const noPhoto = ds.filter((d) => !d.image_url).length; const noDesc = ds.filter((d) => !(d.desc_ar || '').trim()).length; const noPrice = ds.filter((d) => !(+d.price > 0)).length;
    const tips = [];
    if (noPhoto) tips.push(t(`${cnt(noPhoto, ['طبق واحد', 'طبقين', 'أطباق', 'طبق'], ['', ''])} بدون صورة، والصورة تزيد الطلبات`, `${noPhoto} ${noPhoto === 1 ? 'dish has' : 'dishes have'} no photo, photos bring more orders`));
    if (noDesc) tips.push(t(`${cnt(noDesc, ['طبق واحد', 'طبقين', 'أطباق', 'طبق'], ['', ''])} بدون وصف`, `${noDesc} without a description`));
    if (noPrice) tips.push(t(`${cnt(noPrice, ['طبق واحد', 'طبقين', 'أطباق', 'طبق'], ['', ''])} بدون سعر`, `${noPrice} without a price`));
    v.innerHTML = `
      <div class="m-top">
        <div class="m-title"><h2>${esc(t('المنيو', 'Menu'))}</h2><p class="muted">${esc(ds.length ? t(`${cnt(ds.length, ['طبق واحد', 'طبقين', 'أطباق', 'طبق'], ['', ''])} · ${avail} ${avail === 1 ? 'متوفر' : 'متوفرة'}`, `${ds.length} dishes · ${avail} available`) : t('ما أضفت أطباق للحين', 'No dishes yet'))}</p></div>
        ${ds.length > 1 ? `<button type="button" class="btn m-ordbtn ${S.reorder ? 'btn-ok' : 'btn-soft'}" data-m="reorder">${ic(S.reorder ? 'check' : 'list', 's')}${esc(S.reorder ? t('خلصت', 'Done') : t('رتّب', 'Reorder'))}</button>` : ''}
        <button type="button" class="btn btn-primary m-add" data-m="add">${ic('plus')}${esc(t('أضف طبق جديد', 'Add a new dish'))}</button>
      </div>
      ${tips.length && !S.reorder ? `<div class="notice m-tips">${ic('sparkle')}<div><b>${esc(t('كمّل منيوك عشان يبان أحلى للعملاء', 'Polish your menu so customers love it'))}</b><ul>${tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      ${S.reorder ? `<p class="notice info">${ic('info')}<span>${esc(t('حرّك الأطباق فوق وتحت داخل كل قسم، والترتيب ينحفظ على طول.', 'Move dishes up or down inside each section, it saves right away.'))}</span></p>` : ''}
      ${ds.length ? [...groups.entries()].map(([k, list]) => `
        <section class="m-sec">
          <div class="m-sec-head"><h3>${esc(k)}</h3><span class="muted small">${list.length}</span></div>
          <div class="m-list">${list.map((d, i) => dishRow(d, i, list.length)).join('')}</div>
        </section>`).join('')
        : `<div class="empty"><div class="art">${ic('dish')}</div><h3>${esc(t('منيوك فاضي', 'Your menu is empty'))}</h3><p>${esc(t('أضف أطباقك بصور واضحة وأسعارها، وتبدأ توصلك الطلبات.', 'Add your dishes with clear photos and prices to start receiving orders.'))}</p><button type="button" class="btn btn-primary btn-lg" data-m="add">${ic('plus', 's')}${esc(t('أضف أول طبق', 'Add your first dish'))}</button></div>`}`;
  }
  function dishRow(d, i, n) {
    const tags = [];
    if ((d.options || []).length) tags.push(t(`خيارات ${d.options.length}`, `${d.options.length} option groups`));
    if (d.min_lead_hours) tags.push(t(`طلب مسبق ${d.min_lead_hours} س`, `Order ${d.min_lead_hours} h ahead`));
    if (d.daily_limit) tags.push(t(`${d.daily_limit} باليوم`, `${d.daily_limit} a day`));
    if (d.prep_min) tags.push(t(`تجهيز ${durTxt(d.prep_min)}`, `${durTxt(d.prep_min)} prep`));
    const ctl = S.reorder
      ? `<span class="m-ord"><button type="button" class="icon-btn solid" data-m="up" data-id="${esc(d.id)}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(t('فوق', 'Move up'))}">${ic('chevD', 'up')}</button><button type="button" class="icon-btn solid" data-m="down" data-id="${esc(d.id)}" ${i === n - 1 ? 'disabled' : ''} aria-label="${esc(t('تحت', 'Move down'))}">${ic('chevD')}</button></span>`
      : `<label class="m-av"><span class="switch"><input type="checkbox" data-avail="${esc(d.id)}" ${d.available ? 'checked' : ''} aria-label="${esc(t('متوفر', 'Available'))}"><span></span></span><small>${esc(d.available ? t('متوفر', 'Available') : t('خلصان', 'Sold out'))}</small></label>`;
    return `<div class="m-row ${d.available ? '' : 'is-off'}" data-id="${esc(d.id)}">
      <button type="button" class="m-main" data-m="edit" data-id="${esc(d.id)}" ${S.reorder ? 'tabindex="-1"' : ''}>
        ${photo(d.image_url, 'm-ph')}
        <span class="m-txt">
          <b class="m-name">${esc(SF.nm(d, 'name'))}</b>
          <span class="m-price"><span class="price">${SF.moneyHtml(d.price)}</span>${d.old_price ? ` <span class="price-old">${esc(SF.money(d.old_price))}</span>` : ''}${d.serves ? ` <span class="muted">· ${esc(d.serves)}</span>` : ''}</span>
          ${tags.length ? `<span class="m-tags">${tags.map((x) => `<i>${esc(x)}</i>`).join('')}</span>` : ''}
        </span>
      </button>
      ${ctl}
    </div>`;
  }
  async function setAvail(id, on, input) {
    const d = S.dishes.find((x) => x.id === id); if (!d) return;
    d.available = on;
    const row = input.closest('.m-row'); if (row) { row.classList.toggle('is-off', !on); const sm = row.querySelector('.m-av small'); if (sm) sm.textContent = on ? t('متوفر', 'Available') : t('خلصان', 'Sold out'); }
    const { error } = await SF.sb.from('sf_dishes').update({ available: on }).eq('id', id);
    if (error) { d.available = !on; input.checked = !on; SF.toast(errMsg(error), 'bad'); renderMenu(); return; }
    SF.toast(on ? t('الطبق متوفر للطلب', 'Dish is available') : t('الطبق صار خلصان، وما ينطلب لين ترجعه', 'Dish marked sold out'), 'ok');
    renderMenu();
  }
  async function moveDish(id, dir) {
    const ds = [...S.dishes].sort(bySort);
    const d = ds.find((x) => x.id === id); if (!d) return;
    const same = ds.filter((x) => sectionKey(x) === sectionKey(d));
    const j = same.indexOf(d) + dir; if (j < 0 || j >= same.length) return;
    const a = ds.indexOf(d); const b = ds.indexOf(same[j]);
    [ds[a], ds[b]] = [ds[b], ds[a]];
    const changes = [];
    ds.forEach((x, idx) => { if (x.sort !== idx + 1) { x.sort = idx + 1; changes.push({ id: x.id, sort: idx + 1 }); } });
    renderMenu();
    try {
      const res = await Promise.all(changes.map((c) => SF.sb.from('sf_dishes').update({ sort: c.sort }).eq('id', c.id)));
      const bad = res.find((r) => r.error); if (bad) throw bad.error;
    } catch (e) { SF.toast(errMsg(e), 'bad'); await loadDishes().catch(() => {}); renderMenu(); }
  }
  // محرر الخيارات
  function optEditor(opts) {
    if (!opts.length) return `<p class="muted small opt-empty">${esc(t('ما فيه خيارات. أضف مجموعة لو الطبق له أحجام أو إضافات.', 'No options yet. Add a group if the dish has sizes or extras.'))}</p>`;
    return opts.map((g, gi) => `
      <div class="og" data-gi="${gi}">
        <div class="og-head">
          <span class="og-n">${gi + 1}</span>
          <input class="input" data-o="g.name_ar" data-gi="${gi}" value="${esc(g.name_ar || '')}" maxlength="40" placeholder="${esc(t('اسم المجموعة، مثال: الحجم', 'Group name, e.g. Size'))}" aria-label="${esc(t('اسم المجموعة', 'Group name'))}">
          <button type="button" class="icon-btn" data-o="g.del" data-gi="${gi}" aria-label="${esc(t('احذف المجموعة', 'Delete group'))}">${ic('trash')}</button>
        </div>
        <div class="seg og-type">
          <button type="button" class="${g.type !== 'multi' ? 'is-active' : ''}" data-o="g.type" data-v="single" data-gi="${gi}">${esc(t('اختيار واحد', 'One choice'))}</button>
          <button type="button" class="${g.type === 'multi' ? 'is-active' : ''}" data-o="g.type" data-v="multi" data-gi="${gi}">${esc(t('أكثر من اختيار', 'Several choices'))}</button>
        </div>
        <div class="og-flags">
          <label class="row"><span class="switch"><input type="checkbox" data-o="g.required" data-gi="${gi}" ${g.required ? 'checked' : ''}><span></span></span><span>${esc(t('إجباري يختار منها', 'Required'))}</span></label>
          ${g.type === 'multi' ? `<label class="row og-max"><span>${esc(t('أقصى عدد', 'Max'))}</span><input class="input" type="number" inputmode="numeric" min="1" max="20" data-o="g.max" data-gi="${gi}" value="${esc(g.max || '')}" placeholder="${esc(t('بدون', 'Any'))}"></label>` : ''}
        </div>
        <div class="og-choices">
          ${(g.choices || []).map((c, ci) => `
            <div class="och">
              <input class="input" data-o="c.name_ar" data-gi="${gi}" data-ci="${ci}" value="${esc(c.name_ar || '')}" maxlength="40" placeholder="${esc(t('الاختيار، مثال: نفرين', 'Choice, e.g. For two'))}" aria-label="${esc(t('اسم الاختيار', 'Choice name'))}">
              <div class="input-group och-price"><span class="addon">+</span><input class="input" type="number" inputmode="decimal" min="0" step="0.5" data-o="c.price" data-gi="${gi}" data-ci="${ci}" value="${esc(+c.price ? c.price : '')}" placeholder="0" aria-label="${esc(t('السعر الإضافي', 'Extra price'))}"></div>
              <button type="button" class="icon-btn" data-o="c.del" data-gi="${gi}" data-ci="${ci}" aria-label="${esc(t('احذف الاختيار', 'Delete choice'))}">${ic('x')}</button>
            </div>`).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm og-add" data-o="c.add" data-gi="${gi}">${ic('plus', 's')}${esc(t('أضف اختيار', 'Add choice'))}</button>
      </div>`).join('');
  }
  function dishSheet(d) {
    const isNew = !d;
    const D = d ? JSON.parse(JSON.stringify(d)) : { name_ar: '', name_en: '', desc_ar: '', desc_en: '', category_id: '', section: '', price: '', old_price: '', serves: '', prep_min: '', min_lead_hours: 0, daily_limit: '', available: true, image_url: '', options: [] };
    D.options = Array.isArray(D.options) ? D.options : [];
    const sections = [...new Set(S.dishes.map((x) => (x.section || '').trim()).filter(Boolean))];
    const v = (x) => esc(x == null ? '' : x);
    const s = SF.openSheet(`
      ${sheetHead(isNew ? t('طبق جديد', 'New dish') : t('تعديل الطبق', 'Edit dish'))}
      <form id="dForm" class="stack l" novalidate>
        <div class="dphoto">
          <div class="dphoto-ph" id="dPh">${photo(D.image_url)}</div>
          <div class="dphoto-act">
            <label class="btn btn-soft">${ic('camera', 's')}${esc(t('صوّر', 'Camera'))}<input type="file" accept="image/*" capture="environment" class="sr" data-pick></label>
            <label class="btn btn-soft">${ic('image', 's')}${esc(t('من الصور', 'Gallery'))}<input type="file" accept="image/*" class="sr" data-pick></label>
            <button type="button" class="btn btn-ghost btn-sm ${D.image_url ? '' : 'hide'}" id="dPhDel">${esc(t('شيل الصورة', 'Remove photo'))}</button>
          </div>
        </div>
        <label class="field"><span>${esc(t('اسم الطبق', 'Dish name'))} <em class="req">*</em></span><input class="input" name="name_ar" maxlength="80" value="${v(D.name_ar)}" placeholder="${esc(t('مثال: كبسة دجاج', 'e.g. Chicken kabsa'))}"></label>
        <label class="field"><span>${esc(t('الوصف', 'Description'))}</span><textarea class="textarea" name="desc_ar" maxlength="400" placeholder="${esc(t('وش فيه الطبق وكيف يتقدم', 'What is in it and how it is served'))}">${v(D.desc_ar)}</textarea></label>
        <div class="grid2">
          <label class="field"><span>${esc(t('السعر', 'Price'))} <em class="req">*</em></span><div class="input-group"><input class="input" name="price" type="number" inputmode="decimal" min="0" step="0.5" value="${v(D.price)}" placeholder="0"><span class="addon">${esc(t('ر.س', 'SAR'))}</span></div></label>
          <label class="field"><span>${esc(t('السعر قبل الخصم', 'Price before discount'))}</span><div class="input-group"><input class="input" name="old_price" type="number" inputmode="decimal" min="0" step="0.5" value="${v(D.old_price)}" placeholder="${esc(t('اختياري', 'Optional'))}"><span class="addon">${esc(t('ر.س', 'SAR'))}</span></div></label>
        </div>
        <div class="grid2">
          <label class="field"><span>${esc(t('التصنيف', 'Category'))}</span><select class="select" name="category_id"><option value="">${esc(t('بدون تصنيف', 'No category'))}</option>${S.cats.filter((c) => c.active || c.id === D.category_id).map((c) => `<option value="${esc(c.id)}" ${c.id === D.category_id ? 'selected' : ''}>${esc(SF.nm(c, 'name'))}</option>`).join('')}</select></label>
          <label class="field"><span>${esc(t('القسم في المنيو', 'Menu section'))}</span><input class="input" name="section" list="dSecs" maxlength="40" value="${v(D.section)}" placeholder="${esc(t('مثال: الأطباق الرئيسية', 'e.g. Main dishes'))}"><datalist id="dSecs">${sections.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></label>
        </div>
        <div class="grid2">
          <label class="field"><span>${esc(t('يكفي كم شخص', 'Serves'))}</span><input class="input" name="serves" maxlength="40" value="${v(D.serves)}" placeholder="${esc(t('مثال: يكفي شخصين', 'e.g. Serves two'))}"></label>
          <label class="field"><span>${esc(t('وقت التجهيز', 'Prep time'))}</span><div class="input-group"><input class="input" name="prep_min" type="number" inputmode="numeric" min="5" max="2880" value="${v(D.prep_min)}" placeholder="${esc(String(S.fam.prep_min || 45))}"><span class="addon">${esc(t('دقيقة', 'min'))}</span></div></label>
        </div>
        <div class="grid2">
          <label class="field"><span>${esc(t('يحتاج طلب مسبق', 'Needs ordering ahead'))}</span><div class="input-group"><input class="input" name="min_lead_hours" type="number" inputmode="numeric" min="0" max="168" value="${v(D.min_lead_hours || '')}" placeholder="0"><span class="addon">${esc(t('ساعة', 'hours'))}</span></div><small class="hint">${esc(t('24 يعني العميل يطلبه قبلها بيوم', '24 means the customer orders a day ahead'))}</small></label>
          <label class="field"><span>${esc(t('الحد اليومي', 'Daily limit'))}</span><div class="input-group"><input class="input" name="daily_limit" type="number" inputmode="numeric" min="1" max="10000" value="${v(D.daily_limit)}" placeholder="${esc(t('بدون حد', 'No limit'))}"><span class="addon">${esc(t('باليوم', 'a day'))}</span></div><small class="hint">${esc(t('كم حبة تقدر تسوي منه باليوم', 'How many you can make a day'))}</small></label>
        </div>
        <details class="en-box" ${D.name_en || D.desc_en ? 'open' : ''}><summary>${esc(t('الاسم والوصف بالإنجليزي (اختياري)', 'Name and description in English (optional)'))}</summary>
          <div class="stack">
            <label class="field"><span>${esc(t('الاسم بالإنجليزي', 'English name'))}</span><input class="input" name="name_en" dir="ltr" maxlength="80" value="${v(D.name_en)}"></label>
            <label class="field"><span>${esc(t('الوصف بالإنجليزي', 'English description'))}</span><textarea class="textarea" name="desc_en" dir="ltr" maxlength="400">${v(D.desc_en)}</textarea></label>
          </div></details>
        <section class="opt-box">
          <div class="opt-head"><h3>${esc(t('الخيارات والإضافات', 'Options and extras'))}</h3><p class="muted small">${esc(t('مثل الحجم أو الإضافات، والعميل يختار منها. السعر الإضافي يزيد على سعر الطبق.', 'Like sizes or extras. The extra price is added to the dish price.'))}</p></div>
          <div id="optEd">${optEditor(D.options)}</div>
          <button type="button" class="btn btn-soft btn-block" data-o="g.add">${ic('plus', 's')}${esc(t('أضف مجموعة خيارات', 'Add an option group'))}</button>
        </section>
        <label class="avail-row"><span class="switch"><input type="checkbox" name="available" ${D.available ? 'checked' : ''}><span></span></span><span class="grow"><b>${esc(t('متوفر للطلب الحين', 'Available to order now'))}</b><small>${esc(t('لو خلص طفّه، والطبق يبقى بالمنيو', 'Turn it off when sold out, the dish stays on the menu'))}</small></span></label>
        ${isNew ? '' : `<button type="button" class="btn btn-danger btn-block" id="dDel">${ic('trash', 's')}${esc(t('احذف الطبق', 'Delete dish'))}</button>`}
      </form>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="dSave">${esc(isNew ? t('أضف الطبق', 'Add dish') : t('احفظ التعديلات', 'Save changes'))}</button></div>`, { noFocus: true });
    s.sh.classList.add('fam-wide');
    const sh = s.sh; const form = $('#dForm', sh); const ed = $('#optEd', sh);
    const redraw = () => { ed.innerHTML = optEditor(D.options); };
    // الصورة
    $$('[data-pick]', sh).forEach((inp) => inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      const ph = $('#dPh', sh); ph.classList.add('is-busy');
      try {
        D.image_url = await SF.uploadImage(`families/${S.famId}/dishes`, file, { maxDim: 1280 });
        ph.innerHTML = photo(D.image_url); $('#dPhDel', sh).classList.remove('hide');
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
      ph.classList.remove('is-busy'); inp.value = '';
    }));
    $('#dPhDel', sh).onclick = () => { D.image_url = ''; $('#dPh', sh).innerHTML = photo(''); $('#dPhDel', sh).classList.add('hide'); };
    // الخيارات: الكتابة تتحدث بالحالة بدون إعادة رسم
    sh.addEventListener('input', (e) => {
      const el = e.target.closest('[data-o]'); if (!el) return;
      const g = D.options[+el.dataset.gi]; if (!g) return;
      const f = el.dataset.o;
      if (f === 'g.name_ar') g.name_ar = el.value;
      else if (f === 'g.max') g.max = el.value === '' ? null : el.value;
      else if (f === 'c.name_ar') g.choices[+el.dataset.ci].name_ar = el.value;
      else if (f === 'c.price') g.choices[+el.dataset.ci].price = el.value;
    });
    sh.addEventListener('change', (e) => { const el = e.target.closest('[data-o="g.required"]'); if (el) D.options[+el.dataset.gi].required = el.checked; });
    sh.addEventListener('click', (e) => {
      const el = e.target.closest('[data-o]'); if (!el || el.tagName === 'INPUT') return;
      const f = el.dataset.o; const gi = +el.dataset.gi; const g = D.options[gi];
      if (f === 'g.add') { D.options.push({ name_ar: '', name_en: null, type: 'single', required: false, max: null, choices: [{ name_ar: '', price: 0 }, { name_ar: '', price: 0 }] }); redraw(); const last = ed.querySelector('.og:last-child input'); if (last) last.focus(); return; }
      if (!g) return;
      if (f === 'g.del') { D.options.splice(gi, 1); redraw(); }
      else if (f === 'g.type') { g.type = el.dataset.v; if (g.type !== 'multi') g.max = null; redraw(); }
      else if (f === 'c.add') { g.choices = g.choices || []; g.choices.push({ name_ar: '', price: 0 }); redraw(); const box = ed.querySelector(`.og[data-gi="${gi}"] .och:last-child input`); if (box) box.focus(); }
      else if (f === 'c.del') { g.choices.splice(+el.dataset.ci, 1); redraw(); }
    });
    const del = $('#dDel', sh);
    if (del) del.onclick = async () => {
      const ok = await SF.confirm({ title: t('حذف الطبق؟', 'Delete this dish?'), body: t(`بينحذف «${D.name_ar}» من المنيو نهائيًا. لو خلص مؤقتًا الأفضل تطفيه بس.`, `"${D.name_ar}" will be removed for good. If it is only sold out, just switch it off.`), ok: t('احذفه', 'Delete'), danger: true });
      if (!ok) return;
      SF.busy(del, async () => {
        const { error } = await SF.sb.from('sf_dishes').delete().eq('id', D.id);
        if (error) { SF.toast(errMsg(error), 'bad'); return; }
        S.dishes = S.dishes.filter((x) => x.id !== D.id);
        s.close(); SF.toast(t('انحذف الطبق', 'Dish deleted'), 'ok'); renderMenu();
      });
    };
    $('#dSave', sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const fd = new FormData(form);
      const val = (k) => String(fd.get(k) ?? '').trim();
      const errs = [];
      const name = val('name_ar');
      const price = num(val('price')); const old = num(val('old_price')); const prep = num(val('prep_min')); const lead = num(val('min_lead_hours')); const lim = num(val('daily_limit'));
      if (name.length < 2) errs.push(t('اكتب اسم الطبق', 'Enter the dish name'));
      if (price == null || Number.isNaN(price) || price <= 0) errs.push(t('اكتب سعر الطبق', 'Enter the dish price'));
      if (old != null && (Number.isNaN(old) || old <= (price || 0))) errs.push(t('السعر قبل الخصم لازم يكون أكبر من السعر الحالي', 'The price before discount must be higher than the price'));
      if (prep != null && (Number.isNaN(prep) || prep < 5 || prep > 2880)) errs.push(t('وقت التجهيز من 5 دقايق لين 2880 دقيقة', 'Prep time must be 5 to 2880 minutes'));
      if (lead != null && (Number.isNaN(lead) || lead < 0 || lead > 168)) errs.push(t('الطلب المسبق من 0 لين 168 ساعة', 'Ordering ahead must be 0 to 168 hours'));
      if (lim != null && (Number.isNaN(lim) || lim < 1 || lim > 10000)) errs.push(t('الحد اليومي لازم يكون 1 أو أكثر', 'Daily limit must be 1 or more'));
      const options = [];
      D.options.forEach((g, gi) => {
        const choices = (g.choices || []).filter((c) => String(c.name_ar || '').trim()).map((c) => {
          const out = { name_ar: String(c.name_ar).trim(), name_en: c.name_en || null, price: Math.max(0, num(c.price) || 0) };
          if (c.id) out.id = c.id;
          return out;
        });
        const gname = String(g.name_ar || '').trim();
        if (!gname && !choices.length) return;
        if (!gname) errs.push(t(`اكتب اسم مجموعة الخيارات رقم ${gi + 1}`, `Name option group ${gi + 1}`));
        if (!choices.length) errs.push(t(`أضف اختيار واحد على الأقل في «${gname || gi + 1}»`, `Add at least one choice to "${gname || gi + 1}"`));
        const grp2 = { name_ar: gname, name_en: g.name_en || null, type: g.type === 'multi' ? 'multi' : 'single', required: !!g.required, choices };
        if (g.id) grp2.id = g.id;
        if (grp2.type === 'multi' && g.max != null && g.max !== '') { const mx = num(g.max); if (Number.isNaN(mx) || mx < 1) errs.push(t('أقصى عدد لازم يكون 1 أو أكثر', 'Max must be 1 or more')); else grp2.max = Math.min(20, Math.round(mx)); }
        options.push(grp2);
      });
      if (errs.length) { SF.toast(errs[0], 'bad'); return; }
      const payload = {
        name_ar: name, name_en: val('name_en') || null, desc_ar: val('desc_ar') || null, desc_en: val('desc_en') || null,
        category_id: val('category_id') || null, section: val('section') || null, image_url: D.image_url || null,
        price: Math.round(price * 100) / 100, old_price: old == null ? null : Math.round(old * 100) / 100, serves: val('serves') || null,
        prep_min: prep == null ? null : Math.round(prep), min_lead_hours: lead == null ? 0 : Math.round(lead), daily_limit: lim == null ? null : Math.round(lim),
        available: !!fd.get('available'), options,
      };
      let res;
      if (isNew) {
        payload.family_id = S.famId;
        payload.sort = S.dishes.reduce((m, x) => Math.max(m, x.sort || 0), 0) + 1;
        res = await SF.sb.from('sf_dishes').insert(payload).select().single();
      } else {
        res = await SF.sb.from('sf_dishes').update(payload).eq('id', D.id).select().single();
      }
      if (res.error) { SF.toast(errMsg(res.error), 'bad'); return; }
      if (isNew) S.dishes.push(res.data); else S.dishes = S.dishes.map((x) => (x.id === res.data.id ? res.data : x));
      s.close();
      SF.toast(isNew ? t('انضاف الطبق للمنيو', 'Dish added to your menu') : t('انحفظت التعديلات', 'Changes saved'), 'ok');
      renderMenu();
    });
  }

  // ───────── الحساب (المالية) ─────────
  const isoDay = (dt) => dt.toISOString().slice(0, 10);
  function periodRange(k) {
    const today = SF.todayISO();
    const d = new Date(`${today}T12:00:00Z`);
    if (k === 'today') return [today, today];
    if (k === 'week') return [isoDay(new Date(d.getTime() - d.getUTCDay() * 86400000)), today];
    if (k === 'month') return [`${today.slice(0, 8)}01`, today];
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    return [isoDay(first), isoDay(last)];
  }
  function daysBetween(a, b) { const out = []; let d = new Date(`${a}T12:00:00Z`); const end = new Date(`${b}T12:00:00Z`); while (d <= end && out.length < 62) { out.push(isoDay(d)); d = new Date(d.getTime() + 86400000); } return out; }
  const PERIODS = () => [['today', t('اليوم', 'Today')], ['week', t('هالأسبوع', 'This week')], ['month', t('هالشهر', 'This month')], ['last', t('الشهر الماضي', 'Last month')]];
  async function loadFinance(force = false) {
    const [from, to] = periodRange(S.period);
    const key = `${S.period}:${from}:${to}`;
    if (!force && S.fin && S.finKey === key) return;
    S.finBusy = true;
    if (S.tab === 'finance') { const box = $('#finBody'); if (box) box.classList.add('is-loading'); }
    try { S.fin = await SF.rpc('sf_family_finance', { p_from: from, p_to: to }); S.finKey = key; S.finErr = false; }
    catch (e) { S.finErr = true; SF.toast(errMsg(e), 'bad'); }
    S.finBusy = false;
  }
  function renderFinance() {
    const v = $('#view'); if (!v || S.tab !== 'finance') return;
    const [from, to] = periodRange(S.period);
    const key = `${S.period}:${from}:${to}`;
    const p = S.priv || {};
    // فشل التحميل: زر «جرّب مرة ثانية» بدل إعادة الطلب بلا نهاية
    const retry = `<div class="notice bad">${ic('alert')}<span class="grow">${esc(t('ما قدرنا نجيب أرقام الحساب، تأكد من الإنترنت', 'Could not load your earnings, check your connection'))}</span><button type="button" class="btn btn-sm btn-danger" data-p="retry">${esc(t('جرّب مرة ثانية', 'Try again'))}</button></div>`;
    if (!S.fin && S.finErr) { v.innerHTML = `<div class="fin">${retry}</div>`; return; }
    if (!S.fin) {
      v.innerHTML = `<div class="fin"><div class="skel" style="height:120px;border-radius:22px"></div><div class="skel" style="height:44px;margin-top:16px"></div><div class="skel" style="height:220px;margin-top:16px;border-radius:22px"></div></div>`;
      loadFinance().then(() => { if (S.tab === 'finance') renderFinance(); });
      return;
    }
    const f = S.fin;
    const bal = +f.balance || 0;
    const balCls = bal > 0.004 ? 'is-plus' : bal < -0.004 ? 'is-minus' : 'is-zero';
    const balTitle = bal > 0.004 ? t('لك عند سُفرة', 'Sufrah owes you') : bal < -0.004 ? t('عليك لسُفرة', 'You owe Sufrah') : t('حسابك مصفّى', 'You are all settled');
    v.innerHTML = `
      <div class="fin">
        <section class="card bal-card ${balCls}">
          <div class="bal-ic">${ic('wallet', 'l')}</div>
          <div class="grow">
            <small>${esc(t('الرصيد الحالي', 'Current balance'))}</small>
            <h2>${esc(balTitle)}</h2>
            ${Math.abs(bal) > 0.004 ? `<b class="bal-v">${moneyBig(Math.abs(bal))}</b>` : ''}
            <p>${esc(t('مبالغ طلبات البطاقة تستلمها سُفرة وتحولها لك، وعمولة طلبات الكاش تنحسب عليك.', 'Sufrah collects card payments and transfers them to you. The commission on cash orders is owed by you.'))}</p>
          </div>
        </section>
        <div class="seg fin-periods" role="tablist">${PERIODS().map(([k, l]) => `<button type="button" class="${S.period === k ? 'is-active' : ''}" data-p="${k}" role="tab" aria-selected="${S.period === k}">${esc(l)}</button>`).join('')}</div>
        ${S.finErr && S.finKey !== key ? retry : ''}
        <div id="finBody" class="fin-body ${S.finBusy || (S.finKey !== key && !S.finErr) ? 'is-loading' : ''}">
          <section class="fin-hero">
            <small>${esc(t('صافي لك', 'Your net'))} · ${esc(PERIODS().find((x) => x[0] === S.period)[1])}</small>
            <b>${moneyBig(f.net)}</b>
            <span class="muted small">${esc(from === to ? fmtD(from) : `${fmtD(from)} ${t('إلى', 'to')} ${fmtD(to)}`)}</span>
          </section>
          <div class="stats fin-stats">
            <div class="stat"><small>${esc(t('الطلبات المكتملة', 'Completed orders'))}</small><b>${grp(f.orders)}</b></div>
            <div class="stat"><small>${esc(t('المبيعات', 'Sales'))}</small><b>${moneyBig(f.subtotal)}</b></div>
            <div class="stat"><small>${esc(t('عمولة المنصة', 'Platform commission'))}</small><b>${moneyBig(f.commission)}</b></div>
            <div class="stat"><small>${esc(t('رسوم التوصيل لك', 'Delivery fees to you'))}</small><b>${moneyBig(f.delivery_fees)}</b></div>
          </div>
          ${+f.cod_total ? `<p class="fin-cash">${ic('wallet', 's')}<span>${esc(t(`استلمت كاش ${SF.money(f.cod_total)}، وعمولتها ${SF.money(f.cod_commission)} تنحسب عليك.`, `You collected ${SF.money(f.cod_total)} in cash; its commission of ${SF.money(f.cod_commission)} is owed by you.`))}</span></p>` : ''}
          ${chartHtml(f, from, to)}
          ${topHtml(f)}
        </div>
        <section class="card pad">
          <div class="card-title"><h3>${esc(t('التحويلات', 'Transfers'))}</h3></div>
          ${(f.payouts || []).length ? `<ul class="pay-list">${f.payouts.map((x) => `<li>
            <span class="pl-ic ${+x.amount >= 0 ? 'in' : 'out'}">${ic(+x.amount >= 0 ? 'download' : 'upload', 's')}</span>
            <div class="grow"><b>${esc(+x.amount >= 0 ? t('حوّلنا لك', 'We paid you') : t('استلمنا منك', 'You paid us'))}</b><small>${esc(SF.fmtShort(x.created_at))}${x.method ? ` · ${esc(x.method)}` : ''}${x.ref ? ` · ${esc(x.ref)}` : ''}</small>${x.note ? `<small>${esc(x.note)}</small>` : ''}</div>
            <b class="pl-v">${esc(SF.money(Math.abs(+x.amount)))}</b></li>`).join('')}</ul>`
            : `<p class="muted">${esc(t('ما فيه تحويلات للحين.', 'No transfers yet.'))}</p>`}
        </section>
        <section class="card pad">
          <div class="card-title"><h3>${esc(t('حسابك البنكي', 'Your bank account'))}</h3>${p.iban ? `<span class="badge b-ok">${ic('check', 's')}${esc(t('محفوظ', 'Saved'))}</span>` : ''}</div>
          <p class="muted small">${esc(t('نحوّل لك مستحقاتك على هذا الحساب.', 'We transfer what you are owed to this account.'))}</p>
          <form id="ibanForm" class="stack" novalidate>
            <label class="field"><span>${esc(t('رقم الآيبان', 'IBAN'))}</span><input class="input mono" name="iban" dir="ltr" maxlength="34" autocomplete="off" placeholder="SA00 0000 0000 0000 0000 0000" value="${esc((p.iban || '').replace(/(.{4})/g, '$1 ').trim())}"></label>
            <label class="field"><span>${esc(t('اسم صاحب الحساب', 'Account holder name'))}</span><input class="input" name="iban_name" maxlength="80" value="${esc(p.iban_name || '')}"></label>
            <button type="submit" class="btn btn-primary btn-lg btn-block">${esc(t('احفظ الحساب', 'Save account'))}</button>
          </form>
        </section>
      </div>`;
    bindChart();
    $('#ibanForm').onsubmit = (e) => {
      e.preventDefault();
      const fm = e.currentTarget;
      SF.busy(fm.querySelector('[type=submit]'), async () => {
        const iban = digits(fm.elements.iban.value).replace(/\s+/g, '').toUpperCase();
        const name = fm.elements.iban_name.value.trim();
        if (!/^SA\d{22}$/.test(iban)) { SF.toast(t('الآيبان يبدأ بـ SA وبعده 22 رقم', 'The IBAN starts with SA followed by 22 digits'), 'bad'); return; }
        if (name.length < 3) { SF.toast(t('اكتب اسم صاحب الحساب', 'Enter the account holder name'), 'bad'); return; }
        try { await SF.rpc('sf_f_save', { p: { private: { iban, iban_name: name } } }); S.priv = { ...(S.priv || {}), iban, iban_name: name }; SF.toast(t('انحفظ الحساب البنكي', 'Bank account saved'), 'ok'); renderFinance(); }
        catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    };
    if (S.finKey !== key && !S.finBusy && !S.finErr) loadFinance().then(() => { if (S.tab === 'finance') renderFinance(); });
  }
  function chartHtml(f, from, to) {
    const days = daysBetween(from, to);
    if (days.length < 2) return '';
    const map = new Map((f.days || []).map((d) => [String(d.date).slice(0, 10), d]));
    const vals = days.map((d) => ({ d, net: +((map.get(d) || {}).net || 0), n: +((map.get(d) || {}).orders || 0) }));
    const max = Math.max(0, ...vals.map((x) => x.net));
    const maxI = max > 0 ? vals.findIndex((x) => x.net === max) : -1;
    const lab = (d) => new Date(`${d}T12:00:00+03:00`).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
    return `<section class="card pad fin-chart">
      <div class="card-title"><h3>${esc(t('صافي كل يوم', 'Net per day'))}</h3><span class="muted small">${esc(t('ر.س', 'SAR'))}</span></div>
      ${max > 0 ? `<div class="bars" style="--n:${vals.length}">
        ${vals.map((x, i) => `<button type="button" class="bar ${i === maxI ? 'is-max' : ''}" style="--h:${max ? Math.max((x.net / max) * 100, x.net > 0 ? 3 : 0) : 0}%" data-tv="${esc(SF.money(x.net))}" data-tl="${esc(`${lab(x.d)} · ${cnt(x.n, ['طلب واحد', 'طلبين', 'طلبات', 'طلب'], ['order', 'orders'])}`)}" aria-label="${esc(`${lab(x.d)}: ${SF.money(x.net)}`)}"><span class="bar-fill"></span>${i === maxI ? `<span class="bar-max">${esc(grp(x.net))}</span>` : ''}</button>`).join('')}
      </div>
      <div class="bars-x"><span>${esc(lab(days[0]))}</span><span>${esc(lab(days[days.length - 1]))}</span></div>
      <div class="bar-tip" id="barTip" hidden><b></b><small></small></div>`
      : `<p class="muted chart-empty">${esc(t('ما فيه طلبات مكتملة بهالفترة.', 'No completed orders in this period.'))}</p>`}
      ${vals.some((x) => x.n) ? `<details class="fin-table"><summary>${esc(t('الأرقام بالتفصيل', 'See the numbers'))}</summary>
        <div class="table-wrap"><table class="t"><thead><tr><th>${esc(t('اليوم', 'Day'))}</th><th class="num">${esc(t('الطلبات', 'Orders'))}</th><th class="num">${esc(t('الصافي', 'Net'))}</th></tr></thead>
        <tbody>${vals.filter((x) => x.n).map((x) => `<tr><td>${esc(lab(x.d))}</td><td class="num">${x.n}</td><td class="num">${esc(SF.money(x.net))}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    </section>`;
  }
  function topHtml(f) {
    const top = f.top || [];
    if (!top.length) return '';
    const max = Math.max(...top.map((x) => +x.qty || 0), 1);
    return `<section class="card pad">
      <div class="card-title"><h3>${esc(t('الأكثر طلبًا', 'Best sellers'))}</h3></div>
      <ul class="tops">${top.map((x) => `<li><span class="tn">${esc(x.name)}</span><span class="tb"><i style="width:calc((100% - 3em) * ${Math.max(0.04, (+x.qty || 0) / max).toFixed(3)})"></i><b>${grp(x.qty)}</b></span></li>`).join('')}</ul>
    </section>`;
  }
  function bindChart() {
    const tip = $('#barTip'); if (!tip) return;
    const wrap = tip.parentElement;
    const show = (b) => {
      tip.querySelector('b').textContent = b.dataset.tv; tip.querySelector('small').textContent = b.dataset.tl;
      tip.hidden = false;
      const r = b.getBoundingClientRect(); const w = wrap.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2 - w.left, 70), w.width - 70);
      tip.style.left = `${x}px`; tip.style.top = `${Math.max(r.top - w.top - 8, 30)}px`;
      $$('.bar', wrap).forEach((z) => z.classList.toggle('is-hover', z === b));
    };
    const hide = () => { tip.hidden = true; $$('.bar', wrap).forEach((z) => z.classList.remove('is-hover')); };
    $$('.bar', wrap).forEach((b) => { b.addEventListener('pointerenter', () => show(b)); b.addEventListener('focus', () => show(b)); b.addEventListener('click', () => show(b)); b.addEventListener('pointerleave', hide); b.addEventListener('blur', hide); });
  }

  // ───────── مطبخي (الإعدادات) ─────────
  function hoursSummary() {
    if (!S.hours.length) return t('ما تحددت أوقات الدوام', 'No working hours yet');
    const key = (d) => S.hours.filter((h) => h.dow === d).map((h) => `${h.open_min}-${h.close_min}`).join(',');
    const keys = [0, 1, 2, 3, 4, 5, 6].map(key);
    const open = keys.filter(Boolean).length;
    const ranges = (d) => S.hours.filter((h) => h.dow === d).map((h) => `${fmtMin(h.open_min)} ${t('إلى', 'to')} ${fmtMin(h.close_min)}`).join(t(' و ', ' & '));
    if (open === 7 && new Set(keys).size === 1) return `${t('كل يوم', 'Every day')} · ${ranges(0)}`;
    return t(`${cnt(open, ['يوم واحد', 'يومين', 'أيام', 'يوم'], ['', ''])} بالأسبوع`, `${open} days a week`);
  }
  function vacSummary() {
    const up = S.timeoff.filter((x) => x.to_date >= SF.todayISO());
    if (!up.length) return t('ما فيه إجازات قادمة', 'No upcoming vacations');
    const v = up[0];
    return t(`أقرب إجازة من ${fmtD(v.from_date)} إلى ${fmtD(v.to_date)}`, `Next: ${fmtD(v.from_date)} to ${fmtD(v.to_date)}`);
  }
  function docsSummary() {
    if (!S.docs) return t('الوثائق والشهادات', 'Certificates and licenses');
    if (!S.docs.length) return t('ما رفعت وثائق للحين', 'Nothing uploaded yet');
    const pend = S.docs.filter((d) => d.status === 'pending').length;
    return `${cnt(S.docs.length, ['وثيقة وحدة', 'وثيقتين', 'وثائق', 'وثيقة'], ['document', 'documents'])}${pend ? ` · ${t(`${pend} بانتظار المراجعة`, `${pend} under review`)}` : ''}`;
  }
  function renderKitchen() {
    const v = $('#view'); if (!v || S.tab !== 'kitchen') return;
    const f = S.fam; const p = S.priv || {};
    const krow = (k, icon, title, sub, tone = '') => `<button type="button" class="k-row ${tone ? `is-${tone}` : ''}" data-k="${k}"><span class="k-ic">${ic(icon)}</span><span class="grow"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${ic('chevR', 'flip k-chev')}</button>`;
    const link = shareLink();
    v.innerHTML = `
      <div class="k-grid">
        <section class="k-prof card">
          <div class="k-cover">${f.cover_url ? `<img src="${esc(f.cover_url)}" alt="" onerror="this.remove()">` : ''}<span class="k-logo"><img class="fh-mark" src="img/mark.svg" alt="">${f.logo_url ? `<img class="fh-img" src="${esc(f.logo_url)}" alt="" onerror="this.remove()">` : ''}</span></div>
          <div class="k-prof-body">
            <h2>${esc(SF.nm(f, 'name'))}</h2>
            <div class="k-meta">
              <span>${ic('pin', 's')}${esc([cityName(f.city_id), f.district].filter(Boolean).join(t('، ', ', ')) || t('حدد المدينة والحي', 'Set city and district'))}</span>
              ${+f.rating_count ? `<span class="stars">${ic('star')}${esc(SF.n2(f.rating_avg))} <span class="cnt">(${grp(f.rating_count)})</span></span>` : ''}
            </div>
            ${SF.nm(f, 'bio') ? `<p class="k-bio">${esc(SF.nm(f, 'bio'))}</p>` : ''}
            <div class="k-link"><span class="k-url" dir="ltr">${esc(link.replace(/^https?:\/\//, ''))}</span>
              <button type="button" class="btn btn-soft btn-sm" data-k="copy">${ic('copy', 's')}${esc(t('نسخ', 'Copy'))}</button>
              ${navigator.share ? `<button type="button" class="btn btn-soft btn-sm" data-k="share" aria-label="${esc(t('مشاركة', 'Share'))}">${ic('share', 's')}</button>` : ''}</div>
            <button type="button" class="btn btn-block" data-k="profile">${ic('edit', 's')}${esc(t('عدّل بيانات المطبخ', 'Edit kitchen details'))}</button>
          </div>
        </section>
        <div class="stack l k-side">
          <section class="k-list card">
            ${krow('location', 'pin', t('موقع المطبخ', 'Kitchen location'), p.lat ? (p.address_text || t('محدد على الخريطة', 'Pinned on the map')) : t('ما تحدد الموقع، والتوصيل متوقف', 'Not set, delivery is off'), p.lat ? '' : 'warn')}
            ${krow('contact', 'phone', t('أرقام التواصل', 'Contact numbers'), p.whatsapp || p.phone ? [p.phone && SF.showPhone(p.phone), p.whatsapp && `${t('واتساب', 'WhatsApp')} ${SF.showPhone(p.whatsapp)}`].filter(Boolean).join(' · ') : t('أضف جوال وواتساب المطبخ', 'Add your phone and WhatsApp'), p.whatsapp || p.phone ? '' : 'warn')}
            ${krow('hours', 'clock', t('أوقات الدوام', 'Working hours'), hoursSummary(), S.hours.length ? '' : 'warn')}
            ${krow('vac', 'calendar', t('الإجازات', 'Vacations'), vacSummary())}
            ${krow('orders', 'bike', t('الطلبات والتوصيل', 'Orders and delivery'), `${t('تجهيز', 'Prep')} ${durTxt(f.prep_min)} · ${t('أقل طلب', 'Min order')} ${SF.money(f.min_order)} · ${[f.delivery_enabled && t('توصيل', 'Delivery'), f.pickup_enabled && t('استلام', 'Pickup')].filter(Boolean).join(t(' و', ' & ')) || t('مقفل', 'Off')}`)}
            ${krow('capacity', 'users', t('السعة والحجز المسبق', 'Capacity and pre-orders'), `${t(`${f.slot_capacity} بالفترة · ${f.daily_capacity} باليوم`, `${f.slot_capacity} per slot · ${f.daily_capacity} a day`)} · ${+f.preorder_days ? t(`الحجز قبلها بـ ${cnt(f.preorder_days, ['يوم واحد', 'يومين', 'أيام', 'يوم'], ['', ''])}`, `book ${f.preorder_days} days ahead`) : t('الحجز لنفس اليوم', 'same day only')}`)}
            ${krow('docs', 'file', t('الوثائق', 'Documents'), docsSummary())}
            ${krow('reviews', 'star', t('التقييمات', 'Reviews'), +f.rating_count ? t(`${SF.n2(f.rating_avg)} من 5 · ${grp(f.rating_count)} تقييم`, `${SF.n2(f.rating_avg)} of 5 · ${grp(f.rating_count)} reviews`) : t('ردّ على تقييمات عملائك', 'Reply to your customers'))}
          </section>
          <section class="k-list card">
            <div class="k-row k-static"><span class="k-ic">${ic('bell')}</span><span class="grow"><b>${esc(t('إشعارات الجوال', 'Phone notifications'))}</b><small id="pushSub">${esc(t('توصلك الطلبات حتى لو التطبيق مقفل', 'Get orders even when the app is closed'))}</small></span><span class="switch"><input type="checkbox" id="pushSw" aria-label="${esc(t('إشعارات الجوال', 'Phone notifications'))}"><span></span></span></div>
            <div class="k-row k-static"><span class="k-ic">${ic('sound')}</span><span class="grow"><b>${esc(t('صوت التنبيه', 'Alert sound'))}</b><small>${esc(t('يتكرر لين تضغط «شفته»', 'Repeats until you tap Seen'))}</small></span><button type="button" class="btn btn-soft btn-sm" data-k="sound">${esc(t('جرّبه', 'Test'))}</button></div>
            <div class="k-row k-static k-seg"><span class="k-ic">${ic('globe')}</span><span class="grow"><b>${esc(t('اللغة', 'Language'))}</b></span><div class="seg sm"><button type="button" class="${SF.lang === 'ar' ? 'is-active' : ''}" data-k="lang" data-v="ar">العربية</button><button type="button" class="${SF.lang === 'en' ? 'is-active' : ''}" data-k="lang" data-v="en">English</button></div></div>
            <div class="k-row k-static k-seg"><span class="k-ic">${ic('moon')}</span><span class="grow"><b>${esc(t('المظهر', 'Theme'))}</b></span><div class="seg sm">${[['auto', t('تلقائي', 'Auto')], ['light', t('فاتح', 'Light')], ['dark', t('داكن', 'Dark')]].map(([k, l]) => `<button type="button" class="${theme() === k ? 'is-active' : ''}" data-k="theme" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
          </section>
          <button type="button" class="btn btn-danger btn-lg btn-block" data-k="logout">${ic('logout')}${esc(t('تسجيل الخروج', 'Sign out'))}</button>
          <p class="muted small k-who">${esc(t('مسجل بالرقم', 'Signed in as'))} <bdi dir="ltr">${esc(SF.showPhone(S.me && S.me.phone))}</bdi>${S.me && S.me.staff_name ? ` · ${esc(S.me.staff_name)}` : ''}</p>
        </div>
      </div>`;
    if (S.docs == null) loadDocs().then(() => { if (S.tab === 'kitchen') renderKitchen(); }).catch(() => {});
    syncPushSwitch();
  }
  async function pushState() {
    if (NATIVE) return { supported: true, on: !!SF.LS.get('sf_push_on', false) };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { supported: false, on: false };
    if (Notification.permission !== 'granted') return { supported: true, on: false };
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && (await reg.pushManager.getSubscription()); return { supported: true, on: !!sub }; } catch { return { supported: true, on: false }; }
  }
  async function syncPushSwitch() {
    const sw = $('#pushSw'); if (!sw) return;
    const st = await pushState();
    sw.checked = st.on; sw.disabled = !st.supported;
    if (!st.supported) { const sub = $('#pushSub'); if (sub) sub.textContent = t('جهازك ما يدعم إشعارات المتصفح', 'This device does not support notifications'); }
    sw.onchange = async () => {
      if (sw.checked) {
        sw.disabled = true;
        let r = { ok: false };
        try { r = await SF.enablePush(); } catch { r = { ok: false }; }
        sw.disabled = false;
        if (r && r.ok) { SF.LS.set('sf_push_on', true); SF.toast(t('تم تفعيل الإشعارات', 'Notifications are on'), 'ok'); return; }
        sw.checked = false;
        const why = (r && r.why) || '';
        SF.toast(why === 'denied' ? t('الإشعارات مقفلة من إعدادات الجهاز', 'Notifications are blocked in your settings') : why === 'unsupported' ? t('جهازك ما يدعم الإشعارات', 'Notifications are not supported here') : t('الإشعارات غير متاحة حاليًا', 'Notifications are not available right now'), 'bad');
      } else {
        SF.LS.set('sf_push_on', false);
        try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && (await reg.pushManager.getSubscription()); if (sub) await sub.unsubscribe(); } catch { /* */ }
        SF.toast(t('وقفت إشعارات الجوال', 'Notifications are off'), 'ok');
      }
    };
  }
  const theme = () => SF.LS.get('sf_theme', 'auto');
  function applyTheme() {
    const th = theme();
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme');
    const dark = th === 'dark' || (th === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#24101A' : '#5E0F29');
  }

  // بيانات المطبخ: الصور والاسم والنبذة والمدينة والرابط
  function profileSheet() {
    const f = S.fam;
    const cities = S.cities.filter((c) => c.active || c.id === f.city_id);
    const s = SF.openSheet(`
      ${sheetHead(t('بيانات المطبخ', 'Kitchen details'))}
      <form id="pForm" class="stack l" novalidate>
        <div class="p-media">
          <div class="p-cover" id="pCover">${f.cover_url ? `<img src="${esc(f.cover_url)}" alt="">` : `<span class="muted">${ic('image', 'l')}</span>`}
            <label class="btn btn-sm p-media-btn">${ic('camera', 's')}${esc(t('صورة الغلاف', 'Cover photo'))}<input type="file" accept="image/*" class="sr" data-up="cover_url"></label></div>
          <div class="p-logo-wrap"><span class="p-logo" id="pLogo">${f.logo_url ? `<img src="${esc(f.logo_url)}" alt="">` : `<img src="img/mark.svg" alt="">`}</span>
            <label class="btn btn-soft btn-sm">${ic('camera', 's')}${esc(t('الشعار', 'Logo'))}<input type="file" accept="image/*" class="sr" data-up="logo_url"></label></div>
        </div>
        <p class="muted small">${esc(t('الصور تنحفظ أول ما تختارها. الأفضل صورة غلاف لأكلك بإضاءة حلوة.', 'Photos save as soon as you pick them. A well lit photo of your food makes a great cover.'))}</p>
        <label class="field"><span>${esc(t('اسم المطبخ', 'Kitchen name'))} <em class="req">*</em></span><input class="input" name="name_ar" maxlength="60" value="${esc(f.name_ar || '')}"></label>
        <label class="field"><span>${esc(t('نبذة عن المطبخ', 'About your kitchen'))}</span><textarea class="textarea" name="bio_ar" maxlength="400" placeholder="${esc(t('وش يميز أكلك؟ مثال: أكلات نجدية بطبخ البيت', 'What makes your food special?'))}">${esc(f.bio_ar || '')}</textarea></label>
        <div class="grid2">
          <label class="field"><span>${esc(t('المدينة', 'City'))}</span><select class="select" name="city_id">${cities.map((c) => `<option value="${esc(c.id)}" ${c.id === f.city_id ? 'selected' : ''}>${esc(SF.nm(c, 'name'))}</option>`).join('')}</select></label>
          <label class="field"><span>${esc(t('الحي', 'District'))}</span><input class="input" name="district" maxlength="60" value="${esc(f.district || '')}" placeholder="${esc(t('مثال: العقربية', 'e.g. Al Aqrabiyah'))}"></label>
        </div>
        <label class="field"><span>${esc(t('رابط مطبخك', 'Your kitchen link'))}</span><div class="input-group slug"><span class="addon">?f=</span><input class="input" name="slug" dir="ltr" maxlength="30" value="${esc(f.slug || '')}" autocomplete="off"></div><small class="hint">${esc(t('حروف إنجليزية وأرقام فقط، مثال: umfahad', 'English letters and numbers only, e.g. umfahad'))}</small></label>
        <details class="en-box" ${f.name_en || f.bio_en ? 'open' : ''}><summary>${esc(t('الاسم والنبذة بالإنجليزي (اختياري)', 'English name and bio (optional)'))}</summary>
          <div class="stack">
            <label class="field"><span>${esc(t('الاسم بالإنجليزي', 'English name'))}</span><input class="input" name="name_en" dir="ltr" maxlength="60" value="${esc(f.name_en || '')}"></label>
            <label class="field"><span>${esc(t('النبذة بالإنجليزي', 'English bio'))}</span><textarea class="textarea" name="bio_en" dir="ltr" maxlength="400">${esc(f.bio_en || '')}</textarea></label>
          </div></details>
      </form>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="pSave">${esc(t('احفظ البيانات', 'Save details'))}</button></div>`, { noFocus: true });
    s.sh.classList.add('fam-wide');
    const sh = s.sh;
    $$('[data-up]', sh).forEach((inp) => inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      const key = inp.dataset.up; const box = key === 'cover_url' ? $('#pCover', sh) : $('#pLogo', sh);
      box.classList.add('is-busy');
      try {
        const url = await SF.uploadImage(`families/${S.famId}/${key === 'cover_url' ? 'cover' : 'logo'}`, file, { maxDim: key === 'cover_url' ? 1600 : 600 });
        const r = await SF.rpc('sf_f_save', { p: { [key]: url } });
        S.fam = { ...S.fam, ...(r && r.id ? r : { [key]: url }) };
        const img = box.querySelector('img:not([src="img/mark.svg"])') || box.querySelector('img');
        if (img) img.src = url; else box.insertAdjacentHTML('afterbegin', `<img src="${esc(url)}" alt="">`);
        const ph = box.querySelector('.muted'); if (ph) ph.remove();
        SF.toast(t('انحفظت الصورة', 'Photo saved'), 'ok');
        renderHeader(); if (S.tab === 'kitchen') renderKitchen();
      } catch (e) { SF.toast(errMsg(e), 'bad'); }
      box.classList.remove('is-busy'); inp.value = '';
    }));
    $('#pSave', sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const fm = $('#pForm', sh); const g = (k) => String(fm.elements[k].value || '').trim();
      if (g('name_ar').length < 2) { SF.toast(t('اكتب اسم المطبخ', 'Enter the kitchen name'), 'bad'); return; }
      const slug = g('slug').toLowerCase();
      if (slug && slug !== f.slug) {
        if (!/^[a-z0-9-]{3,30}$/.test(slug)) { SF.toast(t('الرابط حروف إنجليزية وأرقام، 3 على الأقل', 'Link must be 3+ English letters or numbers'), 'bad'); return; }
        const r = await SF.rpc('sf_family_slug_set', { p_slug: slug }).catch((er) => ({ ok: false, ar: errMsg(er), en: errMsg(er) }));
        if (!r || !r.ok) { SF.toast(SF.msgOf(r) || t('الرابط مستخدم', 'That link is taken'), 'bad'); return; }
        S.fam.slug = r.slug;
      }
      try {
        const r = await SF.rpc('sf_f_save', { p: { name_ar: g('name_ar'), name_en: g('name_en'), bio_ar: g('bio_ar'), bio_en: g('bio_en'), city_id: g('city_id'), district: g('district') } });
        if (r && r.id) S.fam = { ...S.fam, ...r };
        s.close(); SF.toast(t('انحفظت بيانات المطبخ', 'Kitchen details saved'), 'ok'); renderHeader(); renderKitchen();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  // تحميل Leaflet وقت الحاجة بس
  let leafletP = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      const sc = document.createElement('script'); sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      sc.onload = () => res(window.L); sc.onerror = () => { leafletP = null; rej(new Error('leaflet')); };
      document.head.appendChild(sc);
    });
    return leafletP;
  }
  async function locationSheet() {
    const p = S.priv || {};
    const city = S.cities.find((c) => c.id === S.fam.city_id);
    const startAt = p.lat && p.lng ? [p.lat, p.lng] : city && city.lat ? [city.lat, city.lng] : [26.2794, 50.2083];
    const s = SF.openSheet(`
      ${sheetHead(t('موقع المطبخ', 'Kitchen location'))}
      <div class="stack l"><p class="ink2">${esc(t('حرّك الخريطة لين يصير الدبوس فوق مطبخك بالضبط.', 'Move the map until the pin sits right on your kitchen.'))}</p>
      <div class="map-box fam-map"><div id="kMap" class="kmap"></div><div class="pin">${PIN_SVG}</div>
        <button type="button" class="btn btn-sm map-gps" id="kGps">${ic('nav', 's')}${esc(t('موقعي الحالي', 'My location'))}</button></div>
      <label class="field"><span>${esc(t('وصف العنوان', 'Address description'))}</span><input class="input" id="kAddr" maxlength="200" value="${esc(p.address_text || '')}" placeholder="${esc(t('مثال: الخبر، حي العقربية، شارع الأمير ماجد', 'e.g. Al Khobar, Al Aqrabiyah, Prince Majed St'))}"></label>
      <div class="notice info">${ic('lock')}<span>${esc(t('نستخدم الموقع لحساب مسافة التوصيل، وعميل الاستلام ما يشوفه إلا بعد ما تقبل طلبه.', 'We use it to work out delivery distance. Pickup customers only see it after you accept their order.'))}</span></div></div>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="kSave">${esc(t('احفظ الموقع', 'Save location'))}</button></div>`, { noFocus: true });
    s.sh.classList.add('fam-wide');
    let map = null;
    try {
      const L = await loadLeaflet();
      map = L.map($('#kMap', s.sh), { zoomControl: true, attributionControl: true }).setView(startAt, p.lat ? 16 : 13);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      setTimeout(() => map.invalidateSize(), 340);
    } catch {
      $('#kMap', s.sh).innerHTML = `<div class="empty small">${esc(t('ما قدرنا نحمّل الخريطة، تأكد من الإنترنت', 'Could not load the map, check your connection'))}</div>`;
    }
    $('#kGps', s.sh).onclick = (e) => {
      if (!navigator.geolocation || !map) { SF.toast(t('تحديد الموقع غير متاح', 'Location is not available'), 'bad'); return; }
      SF.busy(e.currentTarget, () => new Promise((res) => {
        navigator.geolocation.getCurrentPosition((pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 17); res(); },
          () => { SF.toast(t('ما قدرنا نحدد موقعك، فعّل الموقع وجرب', 'Could not get your location, turn on location and try again'), 'bad'); res(); },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
      }));
    };
    $('#kSave', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      if (!map) { SF.toast(t('الخريطة ما تحمّلت', 'The map did not load'), 'bad'); return; }
      const c = map.getCenter();
      let lat = Math.round(c.lat * 1e6) / 1e6; let lng = Math.round(c.lng * 1e6) / 1e6;
      // لو الدبوس ما تحرك فعليًا (فرق أمتار من تقريب الخريطة) نخلي الموقع المحفوظ مثل ما هو
      if (p.lat && p.lng && Math.abs(lat - p.lat) < 0.00003 && Math.abs(lng - p.lng) < 0.00003) { lat = p.lat; lng = p.lng; }
      const addr = $('#kAddr', s.sh).value.trim();
      try {
        await SF.rpc('sf_f_save', { p: { private: { lat, lng, address_text: addr } } });
        S.priv = { ...(S.priv || {}), lat, lng, address_text: addr };
        s.close(); SF.toast(t('انحفظ موقع المطبخ', 'Kitchen location saved'), 'ok'); renderView();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function contactSheet() {
    const p = S.priv || {};
    const same = !p.whatsapp || p.whatsapp === p.phone;
    const s = SF.openSheet(`
      ${sheetHead(t('أرقام التواصل', 'Contact numbers'))}
      <form id="cForm" class="stack l" novalidate>
        <label class="field"><span>${esc(t('جوال المطبخ', 'Kitchen phone'))}</span><div class="input-group big" dir="ltr"><span class="addon">+966</span><input class="input" name="phone" type="tel" inputmode="numeric" dir="ltr" maxlength="14" placeholder="05XXXXXXXX" value="${esc(p.phone ? SF.showPhone(p.phone) : '')}"></div></label>
        <label class="row ck-row"><input type="checkbox" name="same" ${same ? 'checked' : ''}><span>${esc(t('رقم الواتساب نفس رقم الجوال', 'WhatsApp is the same number'))}</span></label>
        <label class="field ${same ? 'hide' : ''}" id="waField"><span>${esc(t('رقم الواتساب', 'WhatsApp number'))}</span><div class="input-group big" dir="ltr"><span class="addon">+966</span><input class="input" name="whatsapp" type="tel" inputmode="numeric" dir="ltr" maxlength="14" placeholder="05XXXXXXXX" value="${esc(p.whatsapp ? SF.showPhone(p.whatsapp) : '')}"></div></label>
        <div class="notice info">${ic('info')}<span>${esc(t('يوصل للعميل بعد ما تقبل طلبه عشان يتواصل معك.', 'Customers get it after you accept their order so they can reach you.'))}</span></div>
      </form>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="cSave">${esc(t('احفظ الأرقام', 'Save numbers'))}</button></div>`, { noFocus: true });
    const fm = $('#cForm', s.sh);
    fm.elements.same.onchange = () => $('#waField', s.sh).classList.toggle('hide', fm.elements.same.checked);
    $('#cSave', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const ph = fm.elements.phone.value.trim(); const wa = fm.elements.same.checked ? ph : fm.elements.whatsapp.value.trim();
      if (ph && !SF.normPhone(ph)) { SF.toast(t('رقم الجوال غير صحيح، يبدأ بـ 05', 'Invalid phone, it starts with 05'), 'bad'); return; }
      if (wa && !SF.normPhone(wa)) { SF.toast(t('رقم الواتساب غير صحيح', 'Invalid WhatsApp number'), 'bad'); return; }
      try {
        await SF.rpc('sf_f_save', { p: { private: { phone: ph, whatsapp: wa } } });
        S.priv = { ...(S.priv || {}), phone: SF.normPhone(ph), whatsapp: SF.normPhone(wa) };
        s.close(); SF.toast(t('انحفظت الأرقام', 'Numbers saved'), 'ok'); renderView();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function hoursSheet() {
    const H = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, ranges: S.hours.filter((h) => h.dow === dow).sort((a, b) => a.open_min - b.open_min).map((h) => ({ o: h.open_min, c: h.close_min })) }));
    const dayHtml = (d) => `
      <div class="hday ${d.ranges.length ? '' : 'is-closed'}" data-dow="${d.dow}">
        <div class="hday-top"><b>${esc(dayName(d.dow))}</b><span class="hday-st">${esc(d.ranges.length ? t('مفتوح', 'Open') : t('مسكّر', 'Closed'))}</span><span class="switch"><input type="checkbox" data-h="open" data-dow="${d.dow}" ${d.ranges.length ? 'checked' : ''} aria-label="${esc(`${dayName(d.dow)}: ${t('مفتوح', 'Open')}`)}"><span></span></span></div>
        ${d.ranges.length ? `<div class="hday-rs">${d.ranges.map((r, i) => `
          <div class="hr"><input class="input" type="time" step="900" dir="ltr" data-h="o" data-dow="${d.dow}" data-i="${i}" value="${hhmm(r.o)}" aria-label="${esc(t('من', 'From'))}"><span>${esc(t('إلى', 'to'))}</span><input class="input" type="time" step="900" dir="ltr" data-h="c" data-dow="${d.dow}" data-i="${i}" value="${hhmm(r.c)}" aria-label="${esc(t('إلى', 'To'))}">${d.ranges.length > 1 ? `<button type="button" class="icon-btn" data-h="del" data-dow="${d.dow}" data-i="${i}" aria-label="${esc(t('احذف الفترة', 'Remove period'))}">${ic('x')}</button>` : ''}</div>`).join('')}
          ${d.ranges.length < 2 ? `<button type="button" class="btn btn-ghost btn-sm" data-h="add" data-dow="${d.dow}">${ic('plus', 's')}${esc(t('أضف فترة ثانية', 'Add a second period'))}</button>` : ''}</div>` : ''}
      </div>`;
    const s = SF.openSheet(`
      ${sheetHead(t('أوقات الدوام', 'Working hours'), t('العملاء يطلبون بأسرع وقت داخل الدوام، ويحجزون مواعيد فيه.', 'Customers order ASAP and book slots within these hours.'))}
      <div class="stack l"><div id="hList" class="hlist">${H.map(dayHtml).join('')}</div>
      <button type="button" class="btn btn-soft btn-block" id="hCopy">${ic('copy', 's')}${esc(t('طبّق دوام الأحد على كل الأيام', 'Copy Sunday to every day'))}</button>
      <p class="muted small">${esc(t('لو تسكر بعد نص الليل اختر 12:00 ص كآخر وقت.', 'If you close at midnight choose 12:00 AM as the end.'))}</p></div>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="hSave">${esc(t('احفظ الدوام', 'Save hours'))}</button></div>`, { noFocus: true });
    const sh = s.sh; const list = $('#hList', sh);
    const redraw = () => { list.innerHTML = H.map(dayHtml).join(''); };
    sh.addEventListener('change', (e) => {
      const el = e.target.closest('[data-h]'); if (!el) return;
      const d = H[+el.dataset.dow];
      if (el.dataset.h === 'open') { d.ranges = el.checked ? [{ o: 660, c: 1320 }] : []; redraw(); }
      else if (el.dataset.h === 'o' || el.dataset.h === 'c') {
        const m = toMin(el.value); if (m == null) return;
        const r = d.ranges[+el.dataset.i]; if (!r) return;
        if (el.dataset.h === 'o') r.o = m; else r.c = m === 0 ? 1440 : m;
      }
    });
    sh.addEventListener('click', (e) => {
      const el = e.target.closest('[data-h]'); if (!el || el.tagName === 'INPUT') return;
      const d = H[+el.dataset.dow];
      if (el.dataset.h === 'add') { const last = d.ranges[d.ranges.length - 1]; const o = Math.min((last ? last.c : 960) + 60, 1380); d.ranges.push({ o, c: Math.min(o + 180, 1440) }); redraw(); }
      else if (el.dataset.h === 'del') { d.ranges.splice(+el.dataset.i, 1); redraw(); }
    });
    $('#hCopy', sh).onclick = () => { H.forEach((d) => { if (d.dow !== 0) d.ranges = H[0].ranges.map((r) => ({ ...r })); }); redraw(); SF.toast(t('نسخنا دوام الأحد لكل الأيام، اضغط حفظ', 'Copied Sunday to every day, tap save'), 'ok'); };
    $('#hSave', sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const out = []; const errs = [];
      H.forEach((d) => {
        const rs = [...d.ranges].sort((a, b) => a.o - b.o);
        rs.forEach((r, i) => {
          if (r.c <= r.o) errs.push(`${dayName(d.dow)}: ${t('وقت الإغلاق لازم يكون بعد وقت الفتح', 'closing time must be after opening')}`);
          else if (i > 0 && r.o < rs[i - 1].c) errs.push(`${dayName(d.dow)}: ${t('الفترتين متداخلة', 'the two periods overlap')}`);
          else out.push({ dow: d.dow, open_min: r.o, close_min: r.c });
        });
      });
      if (errs.length) { SF.toast(errs[0], 'bad'); return; }
      try {
        const rows = await SF.rpc('sf_family_hours_save', { p: out });
        S.hours = (rows || []).map((h) => ({ dow: h.dow, open_min: h.open_min, close_min: h.close_min }));
        s.close(); SF.toast(t('انحفظت أوقات الدوام', 'Working hours saved'), 'ok'); renderHeader(); renderView();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function vacSheet() {
    const s = SF.openSheet(`
      ${sheetHead(t('الإجازات', 'Vacations'), t('خلال الإجازة ما يقدر أحد يطلب منك.', 'Nobody can order from you during a vacation.'))}
      <div class="stack l"><div id="vList"></div>
      <form id="vForm" class="card pad stack" novalidate>
        <h3>${esc(t('أضف إجازة', 'Add a vacation'))}</h3>
        <div class="grid2">
          <label class="field"><span>${esc(t('من تاريخ', 'From'))}</span><input class="input" type="date" name="from" min="${SF.todayISO()}" value="${SF.todayISO()}"></label>
          <label class="field"><span>${esc(t('إلى تاريخ', 'To'))}</span><input class="input" type="date" name="to" min="${SF.todayISO()}" value="${SF.todayISO()}"></label>
        </div>
        <label class="field"><span>${esc(t('ملاحظة (اختياري)', 'Note (optional)'))}</span><input class="input" name="note" maxlength="80" placeholder="${esc(t('مثال: سفر', 'e.g. Travelling'))}"></label>
        <button type="submit" class="btn btn-primary btn-lg btn-block">${ic('plus', 's')}${esc(t('أضف الإجازة', 'Add vacation'))}</button>
      </form></div>`, { noFocus: true });
    const sh = s.sh;
    const paint = () => {
      const up = S.timeoff.filter((x) => x.to_date >= SF.todayISO()).sort((a, b) => a.from_date.localeCompare(b.from_date));
      $('#vList', sh).innerHTML = up.length ? `<ul class="v-list">${up.map((x) => `<li><span class="k-ic">${ic('calendar')}</span><div class="grow"><b>${esc(x.from_date === x.to_date ? fmtD(x.from_date, { weekday: 'long' }) : `${fmtD(x.from_date)} ${t('إلى', 'to')} ${fmtD(x.to_date)}`)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</div><button type="button" class="icon-btn" data-vdel="${esc(x.id)}" aria-label="${esc(t('احذف الإجازة', 'Remove vacation'))}">${ic('trash')}</button></li>`).join('')}</ul>` : `<p class="muted v-empty">${esc(t('ما فيه إجازات قادمة.', 'No upcoming vacations.'))}</p>`;
    };
    paint();
    const fm = $('#vForm', sh);
    fm.elements.from.onchange = () => { fm.elements.to.min = fm.elements.from.value; if (fm.elements.to.value < fm.elements.from.value) fm.elements.to.value = fm.elements.from.value; };
    fm.onsubmit = (e) => {
      e.preventDefault();
      SF.busy(fm.querySelector('[type=submit]'), async () => {
        const from = fm.elements.from.value; const to = fm.elements.to.value;
        if (!from || !to) { SF.toast(t('اختر التاريخين', 'Pick both dates'), 'bad'); return; }
        if (to < from) { SF.toast(t('تاريخ النهاية لازم بعد البداية', 'The end must be after the start'), 'bad'); return; }
        const { data, error } = await SF.sb.from('sf_family_timeoff').insert({ family_id: S.famId, from_date: from, to_date: to, note: fm.elements.note.value.trim() || null }).select().single();
        if (error) { SF.toast(errMsg(error), 'bad'); return; }
        S.timeoff.push(data); paint(); fm.elements.note.value = '';
        SF.toast(t('انضافت الإجازة', 'Vacation added'), 'ok'); renderHeader(); if (S.tab === 'kitchen') renderKitchen();
      });
    };
    sh.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-vdel]'); if (!b) return;
      const id = +b.dataset.vdel;
      const ok = await SF.confirm({ title: t('تحذف الإجازة؟', 'Remove this vacation?'), ok: t('احذفها', 'Remove'), danger: true });
      if (!ok) return;
      const { error } = await SF.sb.from('sf_family_timeoff').delete().eq('id', id);
      if (error) { SF.toast(errMsg(error), 'bad'); return; }
      S.timeoff = S.timeoff.filter((x) => +x.id !== id); paint();
      SF.toast(t('انحذفت الإجازة', 'Vacation removed'), 'ok'); renderHeader(); if (S.tab === 'kitchen') renderKitchen();
    });
  }
  function ordersSheet() {
    const f = S.fam;
    const tiers = (Array.isArray(f.delivery_tiers) ? f.delivery_tiers : []).map((x) => ({ km: +x.km, fee: +x.fee })).sort((a, b) => a.km - b.km);
    const tierHtml = () => tiers.map((x, i) => `
      <div class="tier"><span>${esc(t('لين', 'Up to'))}</span>
        <div class="input-group"><input class="input" type="number" inputmode="decimal" min="0.5" max="60" step="0.5" data-t="km" data-i="${i}" value="${esc(x.km)}" aria-label="${esc(t('المسافة', 'Distance'))}"><span class="addon">${esc(t('كم', 'km'))}</span></div>
        <div class="input-group"><input class="input" type="number" inputmode="decimal" min="0" max="200" step="1" data-t="fee" data-i="${i}" value="${esc(x.fee)}" aria-label="${esc(t('الرسوم', 'Fee'))}"><span class="addon">${esc(t('ر.س', 'SAR'))}</span></div>
        ${tiers.length > 1 ? `<button type="button" class="icon-btn" data-t="del" data-i="${i}" aria-label="${esc(t('احذف', 'Remove'))}">${ic('x')}</button>` : '<span class="icon-sp"></span>'}
      </div>`).join('');
    const s = SF.openSheet(`
      ${sheetHead(t('الطلبات والتوصيل', 'Orders and delivery'))}
      <form id="oForm" class="stack l" novalidate>
        <div class="field"><label class="field"><span>${esc(t('وقت التجهيز المعتاد', 'Usual prep time'))}</span><div class="input-group big"><input class="input" name="prep_min" type="number" inputmode="numeric" min="5" max="1440" value="${esc(f.prep_min)}"><span class="addon">${esc(t('دقيقة', 'min'))}</span></div></label>
          <div class="chips wrap">${[30, 45, 60, 90, 120].map((m) => `<button type="button" class="chip" data-prep="${m}">${esc(durTxt(m))}</button>`).join('')}</div></div>
        <label class="field"><span>${esc(t('أقل مبلغ للطلب', 'Minimum order'))}</span><div class="input-group big"><input class="input" name="min_order" type="number" inputmode="decimal" min="0" step="1" value="${esc(+f.min_order)}"><span class="addon">${esc(t('ر.س', 'SAR'))}</span></div></label>
        <div class="card flat k-toggles">
          <label class="k-tg"><span class="k-ic">${ic('store')}</span><span class="grow"><b>${esc(t('استلام من المطبخ', 'Pickup from kitchen'))}</b><small>${esc(t('العميل يجي ياخذ طلبه', 'Customers come to collect'))}</small></span><span class="switch"><input type="checkbox" name="pickup_enabled" ${f.pickup_enabled ? 'checked' : ''}><span></span></span></label>
          <label class="k-tg"><span class="k-ic">${ic('bike')}</span><span class="grow"><b>${esc(t('توصيل', 'Delivery'))}</b><small>${esc(t('توصّل الطلب لبيت العميل', 'You deliver to the customer'))}</small></span><span class="switch"><input type="checkbox" name="delivery_enabled" ${f.delivery_enabled ? 'checked' : ''}><span></span></span></label>
        </div>
        <section class="tiers-box" id="tiersBox">
          <h3>${esc(t('رسوم التوصيل حسب المسافة', 'Delivery fee by distance'))}</h3>
          <p class="muted small">${esc(t('الرسوم كاملة لك، والمسافة تنحسب من موقع مطبخك.', 'You keep the whole fee. Distance is measured from your kitchen.'))}</p>
          <div id="tierList" class="tier-list">${tierHtml()}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-t="add">${ic('plus', 's')}${esc(t('أضف مسافة', 'Add a distance'))}</button>
          <label class="field"><span>${esc(t('أبعد مسافة توصيل', 'Longest delivery distance'))}</span><div class="input-group"><input class="input" name="delivery_max_km" type="number" inputmode="decimal" min="1" max="60" step="0.5" value="${esc(+f.delivery_max_km)}"><span class="addon">${esc(t('كم', 'km'))}</span></div></label>
        </section>
      </form>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="oSave">${esc(t('احفظ الإعدادات', 'Save settings'))}</button></div>`, { noFocus: true });
    const sh = s.sh; const fm = $('#oForm', sh);
    const redraw = () => { $('#tierList', sh).innerHTML = tierHtml(); };
    const syncTiersBox = () => $('#tiersBox', sh).classList.toggle('is-off', !fm.elements.delivery_enabled.checked);
    syncTiersBox();
    fm.elements.delivery_enabled.addEventListener('change', syncTiersBox);
    sh.addEventListener('input', (e) => { const el = e.target.closest('[data-t]'); if (!el || el.tagName !== 'INPUT') return; const x = tiers[+el.dataset.i]; if (x) x[el.dataset.t] = num(el.value); });
    sh.addEventListener('click', (e) => {
      const pr = e.target.closest('[data-prep]'); if (pr) { fm.elements.prep_min.value = pr.dataset.prep; return; }
      const el = e.target.closest('[data-t]'); if (!el || el.tagName === 'INPUT') return;
      if (el.dataset.t === 'add') { if (tiers.length >= 8) { SF.toast(t('بالكثير 8 مسافات', 'Up to 8 distances'), 'bad'); return; } const last = tiers[tiers.length - 1] || { km: 0, fee: 5 }; tiers.push({ km: Math.min((+last.km || 0) + 3, 60), fee: (+last.fee || 0) + 5 }); redraw(); }
      else if (el.dataset.t === 'del') { tiers.splice(+el.dataset.i, 1); redraw(); }
    });
    $('#oSave', sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const prep = num(fm.elements.prep_min.value); const minO = num(fm.elements.min_order.value); const maxKm = num(fm.elements.delivery_max_km.value);
      const pick = fm.elements.pickup_enabled.checked; const deliv = fm.elements.delivery_enabled.checked;
      if (prep == null || Number.isNaN(prep) || prep < 5 || prep > 1440) { SF.toast(t('وقت التجهيز من 5 دقايق لين 24 ساعة', 'Prep time must be 5 minutes to 24 hours'), 'bad'); return; }
      if (minO == null || Number.isNaN(minO) || minO < 0) { SF.toast(t('اكتب أقل مبلغ للطلب، أو 0', 'Enter a minimum order, or 0'), 'bad'); return; }
      if (!pick && !deliv) { SF.toast(t('شغّل التوصيل أو الاستلام على الأقل', 'Turn on delivery or pickup at least'), 'bad'); return; }
      const clean = tiers.filter((x) => x.km != null && x.fee != null);
      if (deliv) {
        if (!clean.length || clean.some((x) => Number.isNaN(x.km) || Number.isNaN(x.fee) || x.km <= 0 || x.km > 60 || x.fee < 0 || x.fee > 200)) { SF.toast(t('راجع المسافات والرسوم: المسافة من 0.5 لين 60 كم والرسوم لين 200', 'Check distances (0.5 to 60 km) and fees (up to 200)'), 'bad'); return; }
        const kms = clean.map((x) => x.km); if (new Set(kms).size !== kms.length) { SF.toast(t('فيه مسافتين متكررة', 'Two distances are the same'), 'bad'); return; }
        if (maxKm == null || Number.isNaN(maxKm) || maxKm < 1 || maxKm > 60) { SF.toast(t('أبعد مسافة من 1 لين 60 كم', 'Longest distance must be 1 to 60 km'), 'bad'); return; }
      }
      const sorted = [...clean].sort((a, b) => a.km - b.km);
      const payload = { prep_min: Math.round(prep), min_order: Math.round(minO * 100) / 100, pickup_enabled: pick, delivery_enabled: deliv };
      if (deliv) { payload.delivery_tiers = sorted; payload.delivery_max_km = Math.min(maxKm, 60); }
      try {
        const r = await SF.rpc('sf_f_save', { p: payload });
        if (r && r.id) S.fam = { ...S.fam, ...r };
        s.close(); SF.toast(t('انحفظت الإعدادات', 'Settings saved'), 'ok');
        if (deliv && sorted.length && maxKm > sorted[sorted.length - 1].km) SF.toast(t(`تنبيه: الطلبات أبعد من ${SF.n2(sorted[sorted.length - 1].km)} كم ما لها رسوم، فما بتنقبل`, `Note: orders beyond ${SF.n2(sorted[sorted.length - 1].km)} km have no fee, so they cannot be placed`), 'bad');
        renderView();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function capacitySheet() {
    const f = S.fam; const slot = SF.setNum('slot_minutes', 60);
    const s = SF.openSheet(`
      ${sheetHead(t('السعة والحجز المسبق', 'Capacity and pre-orders'), t('عشان ما تجيك طلبات أكثر من طاقتك.', 'So you never get more orders than you can handle.'))}
      <form id="capForm" class="stack l" novalidate>
        <label class="field"><span>${esc(t('أقصى عدد طلبات في الفترة الوحدة', 'Most orders in one time slot'))}</span><div class="input-group big"><input class="input" name="slot_capacity" type="number" inputmode="numeric" min="1" max="200" value="${esc(f.slot_capacity)}"><span class="addon">${esc(t('طلب', 'orders'))}</span></div><small class="hint">${esc(t(`كل فترة ${durTxt(slot)}`, `Each slot is ${durTxt(slot)}`))}</small></label>
        <label class="field"><span>${esc(t('أقصى عدد طلبات باليوم', 'Most orders in a day'))}</span><div class="input-group big"><input class="input" name="daily_capacity" type="number" inputmode="numeric" min="1" max="2000" value="${esc(f.daily_capacity)}"><span class="addon">${esc(t('طلب', 'orders'))}</span></div></label>
        <label class="field"><span>${esc(t('كم يوم قدام يقدر العميل يحجز', 'How many days ahead customers can book'))}</span><div class="input-group big"><input class="input" name="preorder_days" type="number" inputmode="numeric" min="0" max="30" value="${esc(f.preorder_days)}"><span class="addon">${esc(t('يوم', 'days'))}</span></div><small class="hint">${esc(t('0 يعني الطلب لنفس اليوم بس', '0 means same day only'))}</small></label>
      </form>
      <div class="sheet-foot"><button type="button" class="btn btn-primary btn-lg btn-block" id="capSave">${esc(t('احفظ', 'Save'))}</button></div>`, { noFocus: true });
    const fm = $('#capForm', s.sh);
    $('#capSave', s.sh).onclick = (e) => SF.busy(e.currentTarget, async () => {
      const a = num(fm.elements.slot_capacity.value); const b = num(fm.elements.daily_capacity.value); const c = num(fm.elements.preorder_days.value);
      if (a == null || Number.isNaN(a) || a < 1 || a > 200) { SF.toast(t('طلبات الفترة من 1 لين 200', 'Orders per slot must be 1 to 200'), 'bad'); return; }
      if (b == null || Number.isNaN(b) || b < 1 || b > 2000) { SF.toast(t('طلبات اليوم من 1 لين 2000', 'Orders per day must be 1 to 2000'), 'bad'); return; }
      if (b < a) { SF.toast(t('طلبات اليوم لازم تكون أكثر من طلبات الفترة', 'Daily orders must be at least the slot orders'), 'bad'); return; }
      if (c == null || Number.isNaN(c) || c < 0 || c > 30) { SF.toast(t('أيام الحجز من 0 لين 30', 'Booking days must be 0 to 30'), 'bad'); return; }
      try {
        const r = await SF.rpc('sf_f_save', { p: { slot_capacity: Math.round(a), daily_capacity: Math.round(b), preorder_days: Math.round(c) } });
        if (r && r.id) S.fam = { ...S.fam, ...r };
        s.close(); SF.toast(t('انحفظت السعة', 'Capacity saved'), 'ok'); renderView();
      } catch (er) { SF.toast(errMsg(er), 'bad'); }
    });
  }
  function docRow(d) {
    const k = DOC_KINDS.find((x) => x[0] === d.kind) || DOC_KINDS[DOC_KINDS.length - 1];
    const st = { pending: ['b-warn', t('بانتظار المراجعة', 'Under review')], approved: ['b-ok', t('معتمدة', 'Approved')], rejected: ['b-bad', t('مرفوضة', 'Rejected')] }[d.status] || ['', d.status];
    let exp = '';
    if (d.expires_on) {
      const days = Math.round((new Date(`${d.expires_on}T00:00:00+03:00`) - new Date(`${SF.todayISO()}T00:00:00+03:00`)) / 86400000);
      exp = days < 0 ? `<span class="badge b-bad">${esc(t('منتهية', 'Expired'))}</span>` : days <= 30 ? `<span class="badge b-warn">${esc(t('تنتهي قريب', 'Expires soon'))}</span>` : '';
    }
    return `<div class="doc-row">
      <span class="k-ic">${ic('file')}</span>
      <div class="grow"><b>${esc(t(k[1], k[2]))}</b><small>${esc(d.expires_on ? t(`تنتهي ${fmtD(d.expires_on, { year: 'numeric' })}`, `Expires ${fmtD(d.expires_on, { year: 'numeric' })}`) : t('بدون تاريخ انتهاء', 'No expiry date'))}</small>
        <div class="doc-badges"><span class="badge ${st[0]}">${esc(st[1])}</span>${exp}</div>
        ${d.note ? `<small class="doc-note">${esc(d.note)}</small>` : ''}</div>
      <div class="doc-act"><button type="button" class="btn btn-soft btn-sm" data-dv="${esc(d.id)}">${ic('eye', 's')}${esc(t('عرض', 'View'))}</button>${d.status !== 'approved' ? `<button type="button" class="icon-btn" data-dd="${esc(d.id)}" aria-label="${esc(t('احذف الوثيقة', 'Delete document'))}">${ic('trash')}</button>` : ''}</div>
    </div>`;
  }
  async function docsSheet() {
    const s = SF.openSheet(`
      ${sheetHead(t('الوثائق', 'Documents'), t('الوثائق خاصة، تشوفها الإدارة بس للاعتماد.', 'Documents are private and only reviewed by Sufrah.'))}
      <div class="stack l"><div id="docList"><div class="skel" style="height:80px"></div></div>
      <form id="docForm" class="card pad stack" novalidate>
        <h3>${esc(t('ارفع وثيقة', 'Upload a document'))}</h3>
        <label class="field"><span>${esc(t('نوع الوثيقة', 'Document type'))}</span><select class="select" name="kind">${DOC_KINDS.map(([k, ar, en]) => `<option value="${k}">${esc(t(ar, en))}</option>`).join('')}</select></label>
        <label class="field"><span>${esc(t('تاريخ الانتهاء', 'Expiry date'))}</span><input class="input" type="date" name="expires_on" min="${SF.todayISO()}"><small class="hint">${esc(t('اتركه فاضي لو الوثيقة ما تنتهي', 'Leave empty if it does not expire'))}</small></label>
        <label class="filepick"><input type="file" name="file" accept="image/*,application/pdf" class="sr"><span class="k-ic">${ic('upload')}</span><span class="grow"><b id="fpName">${esc(t('اختر الملف', 'Choose a file'))}</b><small>${esc(t('صورة أو PDF، لين 10 ميقا', 'Photo or PDF, up to 10 MB'))}</small></span></label>
        <button type="submit" class="btn btn-primary btn-lg btn-block">${ic('upload', 's')}${esc(t('ارفع الوثيقة', 'Upload document'))}</button>
      </form></div>`, { noFocus: true });
    const sh = s.sh;
    const paint = () => { $('#docList', sh).innerHTML = S.docs && S.docs.length ? `<div class="doc-list">${S.docs.map(docRow).join('')}</div>` : `<p class="muted v-empty">${esc(t('ما فيه وثائق للحين.', 'No documents yet.'))}</p>`; };
    try { await loadDocs(); } catch (e) { SF.toast(errMsg(e), 'bad'); S.docs = S.docs || []; }
    paint();
    const fm = $('#docForm', sh); const fileIn = fm.elements.namedItem('file');
    fileIn.onchange = () => { const f = fileIn.files[0]; $('#fpName', sh).textContent = f ? f.name : t('اختر الملف', 'Choose a file'); };
    fm.onsubmit = (e) => {
      e.preventDefault();
      SF.busy(fm.querySelector('[type=submit]'), async () => {
        let f = fileIn.files[0];
        if (!f) { SF.toast(t('اختر الملف أول', 'Choose a file first'), 'bad'); return; }
        if (f.size > 10 * 1024 * 1024) { SF.toast(t('الملف أكبر من 10 ميقا', 'The file is over 10 MB'), 'bad'); return; }
        try {
          if (/^image\//.test(f.type) && f.type !== 'image/webp') { const blob = await SF.compressImage(f, 2200, 0.86); f = new File([blob], 'doc.webp', { type: 'image/webp' }); }
          if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(f.type)) { SF.toast(t('الملف لازم يكون صورة أو PDF', 'The file must be a photo or a PDF'), 'bad'); return; }
          const path = await SF.uploadDoc(`families/${S.famId}`, f);
          const { data, error } = await SF.sb.from('sf_family_docs').insert({ family_id: S.famId, kind: fm.elements.kind.value, file_path: path, expires_on: fm.elements.expires_on.value || null }).select().single();
          if (error) throw error;
          S.docs = [data, ...(S.docs || [])]; paint();
          fm.reset(); $('#fpName', sh).textContent = t('اختر الملف', 'Choose a file');
          SF.toast(t('انرفعت الوثيقة، وبتراجعها الإدارة', 'Uploaded, Sufrah will review it'), 'ok');
          if (S.tab === 'kitchen') renderKitchen(); else if (S.tab === 'orders') renderOrders();
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    };
    sh.addEventListener('click', async (e) => {
      const vb = e.target.closest('[data-dv]');
      if (vb) {
        const d = (S.docs || []).find((x) => x.id === vb.dataset.dv); if (!d) return;
        const w = NATIVE ? null : window.open('', '_blank');
        const { data, error } = await SF.sb.storage.from('docs').createSignedUrl(d.file_path, 600);
        if (error || !data) { if (w) w.close(); SF.toast(errMsg(error), 'bad'); return; }
        if (w) { w.opener = null; w.location.href = data.signedUrl; } else window.open(data.signedUrl, '_blank');
        return;
      }
      const db = e.target.closest('[data-dd]');
      if (db) {
        const ok = await SF.confirm({ title: t('تحذف الوثيقة؟', 'Delete this document?'), ok: t('احذفها', 'Delete'), danger: true });
        if (!ok) return;
        const { error } = await SF.sb.from('sf_family_docs').delete().eq('id', db.dataset.dd);
        if (error) { SF.toast(errMsg(error), 'bad'); return; }
        S.docs = S.docs.filter((x) => x.id !== db.dataset.dd); paint();
        SF.toast(t('انحذفت الوثيقة', 'Document deleted'), 'ok'); if (S.tab === 'kitchen') renderKitchen();
      }
    });
  }
  async function reviewsSheet() {
    const f = S.fam;
    const s = SF.openSheet(`
      ${sheetHead(t('التقييمات', 'Reviews'))}
      ${+f.rating_count ? `<div class="rev-sum"><b>${esc(SF.n2(f.rating_avg))}</b>${stars(Math.round(+f.rating_avg))}<span class="muted">${esc(t(`${grp(f.rating_count)} تقييم`, `${grp(f.rating_count)} reviews`))}</span></div>` : ''}
      <div id="revList"><div class="skel" style="height:110px"></div></div>`, { noFocus: true });
    const sh = s.sh;
    const paint = () => {
      const list = S.reviews || [];
      $('#revList', sh).innerHTML = list.length ? list.map((r) => `
        <article class="rev" data-id="${esc(r.id)}">
          <div class="rev-head">${stars(r.rating)}<b>${esc(firstName(r.customer_name))}</b><span class="muted small">${esc(SF.fmtShort(r.reviewed_at))} · <bdi>#${esc(r.order_no)}</bdi></span>${r.review_hidden ? `<span class="badge">${esc(t('مخفي', 'Hidden'))}</span>` : ''}</div>
          ${r.review ? `<p class="rev-txt">${esc(r.review)}</p>` : ''}
          <p class="muted small">${esc((r.items || []).map((it) => SF.nm(it, 'name')).join(t('، ', ', ')))}</p>
          ${r.review_photo ? `<a href="${esc(r.review_photo)}" target="_blank" rel="noopener" class="rev-ph"><img src="${esc(r.review_photo)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></a>` : ''}
          ${r.family_reply ? `<div class="rev-reply"><small>${esc(t('ردك', 'Your reply'))}</small><p>${esc(r.family_reply)}</p><button type="button" class="link" data-redit="${esc(r.id)}">${esc(t('عدّل الرد', 'Edit reply'))}</button></div>`
            : `<div class="rev-form"><textarea class="textarea" maxlength="300" data-rtxt="${esc(r.id)}" placeholder="${esc(t('اكتب ردك على العميل', 'Write your reply to the customer'))}"></textarea><button type="button" class="btn btn-soft btn-sm" data-rsend="${esc(r.id)}">${ic('send', 's')}${esc(t('أرسل الرد', 'Send reply'))}</button></div>`}
        </article>`).join('') : `<div class="empty"><div class="art">${ic('star')}</div><h3>${esc(t('ما فيه تقييمات للحين', 'No reviews yet'))}</h3><p>${esc(t('بعد ما يستلم العميل طلبه يقدر يقيّمك، وتقدر ترد عليه هنا.', 'Customers can rate you after receiving their order, and you can reply here.'))}</p></div>`;
    };
    try { await loadReviews(); } catch (e) { SF.toast(errMsg(e), 'bad'); S.reviews = []; }
    paint();
    sh.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-redit]');
      if (ed) { const r = S.reviews.find((x) => x.id === ed.dataset.redit); if (!r) return; const box = ed.closest('.rev-reply'); box.outerHTML = `<div class="rev-form"><textarea class="textarea" maxlength="300" data-rtxt="${esc(r.id)}">${esc(r.family_reply || '')}</textarea><button type="button" class="btn btn-soft btn-sm" data-rsend="${esc(r.id)}">${ic('send', 's')}${esc(t('أرسل الرد', 'Send reply'))}</button></div>`; return; }
      const sb2 = e.target.closest('[data-rsend]'); if (!sb2) return;
      const id = sb2.dataset.rsend; const ta = $(`[data-rtxt="${CSS.escape(id)}"]`, sh); const txt = ta ? ta.value.trim() : '';
      if (txt.length < 2) { SF.toast(t('اكتب ردك أول', 'Write your reply first'), 'bad'); return; }
      SF.busy(sb2, async () => {
        try {
          const r = await SF.rpc('sf_family_reply', { p_order: id, p_reply: txt });
          if (!r || !r.ok) { SF.toast(t('ما انحفظ الرد', 'Reply was not saved'), 'bad'); return; }
          const rv = S.reviews.find((x) => x.id === id); if (rv) rv.family_reply = txt;
          paint(); SF.toast(t('انحفظ ردك، ويبان للعملاء تحت التقييم', 'Reply saved, customers see it under the review'), 'ok');
        } catch (er) { SF.toast(errMsg(er), 'bad'); }
      });
    });
  }
  async function copyLink() {
    const link = shareLink();
    try { await navigator.clipboard.writeText(link); SF.toast(t('انتسخ رابط مطبخك', 'Link copied'), 'ok'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = link; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); SF.toast(t('انتسخ رابط مطبخك', 'Link copied'), 'ok'); } catch { SF.toast(link); }
      ta.remove();
    }
  }
  async function logout() {
    const ok = await SF.confirm({ title: t('تسجيل الخروج؟', 'Sign out?'), body: t('ما بتوصلك تنبيهات الطلبات على هذا الجهاز لين تدخل مرة ثانية.', 'You will not get order alerts on this device until you sign in again.'), ok: t('اطلع', 'Sign out'), danger: true });
    if (!ok) return;
    await SF.auth.signOut();
    otpPhone = ''; loginStep = 'phone';
    showLogin();
  }

  // ───────── الأحداث ─────────
  function onClick(e) {
    const el = e.target.closest('[data-tab],[data-go],[data-seg],[data-segb],[data-act],[data-m],[data-p],[data-k],[data-na],#openBtn');
    const card = e.target.closest('.oc.is-unseen');
    if (card) ack([card.dataset.id]);
    if (!el) return;
    if (el.id === 'openBtn') { toggleOpen(); return; }
    const d = el.dataset;
    if (d.tab) { if (d.tab === S.tab && S.tab !== 'orders') window.scrollTo({ top: 0, behavior: 'smooth' }); go(d.tab); return; }
    if (d.go) { const [tab, sub] = d.go.split(':'); go(tab, sub); return; }
    if (d.seg) { S.seg = d.seg; renderOrders(); return; }
    if (d.segb) { S.segB = d.segb; renderOrders(); return; }
    if (d.act) { doAct(d.act, d.id, el); return; }
    if (d.na) {
      const ids = pending().map((o) => o.id); const first = ids[0];
      ack(ids);
      if (d.na === 'open') {
        for (let i = 0; i < 6 && document.querySelector('.sheet.is-open'); i += 1) SF.closeSheet();
        S.seg = 'new'; go('orders'); setTimeout(() => focusCard(first), 80);
      }
      return;
    }
    if (d.m) {
      if (d.m === 'add') dishSheet(null);
      else if (d.m === 'edit') { if (!S.reorder) dishSheet(S.dishes.find((x) => x.id === d.id)); }
      else if (d.m === 'reorder') { S.reorder = !S.reorder; renderMenu(); }
      else if (d.m === 'up') moveDish(d.id, -1);
      else if (d.m === 'down') moveDish(d.id, 1);
      return;
    }
    if (d.p) { if (d.p === 'retry') { S.finErr = false; renderFinance(); } else if (S.period !== d.p) { S.period = d.p; S.finErr = false; renderFinance(); } return; }
    if (d.k) {
      const k = d.k;
      if (k === 'profile') profileSheet();
      else if (k === 'location') locationSheet();
      else if (k === 'contact') contactSheet();
      else if (k === 'hours') hoursSheet();
      else if (k === 'vac') vacSheet();
      else if (k === 'orders') ordersSheet();
      else if (k === 'capacity') capacitySheet();
      else if (k === 'docs') docsSheet();
      else if (k === 'reviews') reviewsSheet();
      else if (k === 'copy') copyLink();
      else if (k === 'share') navigator.share({ title: SF.nm(S.fam, 'name'), text: t(`اطلب من ${SF.nm(S.fam, 'name')} على سُفرة`, `Order from ${SF.nm(S.fam, 'name')} on Sufrah`), url: shareLink() }).catch(() => {});
      else if (k === 'sound') { unlockAudio(); setTimeout(() => { if (chime()) SF.toast(t('هذا صوت تنبيه الطلب الجديد', 'This is the new order sound'), 'ok'); else SF.toast(t('الصوت ما اشتغل، ارفع صوت الجهاز وجرّب', 'Sound did not play, raise the volume and try again'), 'bad'); renderSoundHint(); }, 120); }
      else if (k === 'lang') { if (d.v !== SF.lang) { SF.setLang(d.v); SF.rpc('sf_profile_save', { p: { lang: d.v } }).catch(() => {}); } }
      else if (k === 'theme') { SF.LS.set('sf_theme', d.v); applyTheme(); renderKitchen(); }
      else if (k === 'logout') logout();
    }
  }
  function onChange(e) {
    const av = e.target.closest('[data-avail]');
    if (av) setAvail(av.dataset.avail, av.checked, av);
  }

  // ───────── التشغيل ─────────
  function rerender() {
    if (S.screen === 'login') showLogin();
    else if (S.screen === 'app') { document.title = baseTitle(); renderHeader(); renderNav(); renderView(); syncAlert(); }
    else if (S.screen === 'gate' || S.screen === 'error') start();
  }
  function boot() {
    applyTheme();
    if (!NATIVE) SF.registerSW('sw.js');
    const h = location.hash.slice(1); if (TABS.includes(h)) S.tab = h;
    SF.onLang(rerender);
    SF.auth.onChange((ev) => {
      if (ev === 'SIGNED_OUT') { if (S.screen === 'app' || S.screen === 'gate') setTimeout(showLogin, 0); }
      else if (ev === 'SIGNED_IN' && S.screen !== 'app') setTimeout(() => start(), 0);
    });
    app.addEventListener('click', onClick);
    app.addEventListener('change', onChange);
    document.addEventListener('click', (e) => { if (e.target.closest('#nalert')) onClick(e); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.screen === 'app') loadOrders().catch(() => {}); });
    window.matchMedia('(min-width: 900px)').addEventListener('change', () => { if (S.screen === 'app' && S.tab === 'orders') renderOrders(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    setInterval(tick, 1000);
    setInterval(() => {
      if (S.screen !== 'app') return;
      renderHeader();
      const busyInput = document.activeElement && document.activeElement.closest && document.activeElement.closest('#view input, #view textarea, #view select');
      if (S.tab === 'orders' && !busyInput) renderOrders();
      else $$('[data-ago]').forEach((el) => { el.textContent = SF.ago(el.dataset.ago); });
    }, 30000);
    setInterval(() => { if (S.screen === 'app') loadOrders().catch(() => {}); }, 25000);
    window.__fam = { S, go, ack, pending: () => pending().length, chimes: () => window.__sfChimes, audioOn, alerting: () => !!alertT, start, refresh: refreshOrdersUI };
    SF.loadSettings().catch(() => {}).finally(async () => {
      try { await start(); } catch { showError(); }
      SF.splash(1300);
    });
  }
  boot();
})();
