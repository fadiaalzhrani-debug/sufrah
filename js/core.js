/* ============================================================
   سُفرة · core.js · أدوات مشتركة لكل التطبيقات (العميل، الأسرة، الإدارة)
   يحتاج قبله: supabase-js v2 (CDN) و js/config.js
   ============================================================ */
(function () {
  'use strict';
  const CFG = window.SF_CFG;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* وضع خاص */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
  };

  const sb = window.supabase.createClient(CFG.url, CFG.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sf_auth_v1', detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  // ───────── اللغة ─────────
  let lang = LS.get('sf_lang', null) || ((navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'ar');
  const langSubs = [];
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  applyLang();
  const t = (ar, en) => (lang === 'en' ? (en ?? ar) : ar);
  const setLang = (l) => { lang = l === 'en' ? 'en' : 'ar'; LS.set('sf_lang', lang); applyLang(); langSubs.forEach((f) => f(lang)); };
  // اسم الحقل حسب اللغة: nm(row, 'name') = row.name_en لو إنجليزي وموجود، وإلا row.name_ar
  const nm = (row, base = 'name') => (row ? (lang === 'en' ? (row[base + '_en'] || row[base + '_ar']) : (row[base + '_ar'] || row[base + '_en'])) || '' : '');

  // ───────── تنسيق ─────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = (n) => { const v = Math.round((+n || 0) * 100) / 100; return Number.isInteger(v) ? String(v) : v.toFixed(2); };
  const money = (n) => (lang === 'en' ? `SAR ${n2(n)}` : `${n2(n)} ر.س`);
  const moneyHtml = (n) => (lang === 'en' ? `<small>SAR</small> ${n2(n)}` : `${n2(n)} <small>ر.س</small>`);
  const loc = () => (lang === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn');
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : '');
  const fmtDate = (iso, opt = {}) => (iso ? new Date(iso).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh', ...opt }) : '');
  const fmtShort = (iso) => (iso ? new Date(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' }) : '');
  const fmtDT = (iso) => (iso ? `${fmtShort(iso)} · ${fmtTime(iso)}` : '');
  function ago(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return t('الحين', 'just now');
    if (s < 3600) { const m = Math.round(s / 60); return t(`قبل ${m} دقيقة`, `${m} min ago`); }
    if (s < 86400) { const h = Math.round(s / 3600); return t(`قبل ${h} ساعة`, `${h} h ago`); }
    return fmtShort(iso);
  }
  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const dayISO = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); };

  function normPhone(p) {
    const d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
    if (/^9665\d{8}$/.test(d)) return d;
    if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
    if (/^5\d{8}$/.test(d)) return '966' + d;
    if (/^009665\d{8}$/.test(d)) return d.slice(2);
    return null;
  }
  const showPhone = (p) => { const n = normPhone(p); return n ? '0' + n.slice(3) : (p || ''); };

  // ───────── حالات الطلب ─────────
  const STATUS = {
    pending_payment: ['بانتظار الدفع', 'Awaiting payment'],
    new: ['بانتظار قبول الأسرة', 'Waiting for the kitchen'],
    preparing: ['يتجهز', 'Preparing'],
    ready: ['جاهز', 'Ready'],
    on_the_way: ['في الطريق', 'On the way'],
    delivered: ['تم التوصيل', 'Delivered'],
    picked_up: ['تم الاستلام', 'Picked up'],
    cancelled: ['ملغي', 'Cancelled'],
    rejected: ['اعتذرت الأسرة', 'Declined'],
  };
  const statusLabel = (s, ful) => {
    if (s === 'ready' && ful === 'pickup') return t('جاهز للاستلام', 'Ready for pickup');
    const v = STATUS[s]; return v ? t(v[0], v[1]) : s;
  };
  const statusBadge = (s, ful) => `<span class="badge st-${esc(s)}"><span class="dot"></span>${esc(statusLabel(s, ful))}</span>`;
  const isLive = (s) => ['pending_payment', 'new', 'preparing', 'ready', 'on_the_way'].includes(s);

  // ───────── الأيقونات (SVG مضمّن) ─────────
  const P = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20.5 20.5 16 16',
    bag: 'M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8zM9 8V6.5a3 3 0 0 1 6 0V8',
    receipt: 'M6 3h12v18l-2.2-1.4L13.6 21 12 19.6 10.4 21l-2.2-1.4L6 21zM9 8h6M9 12h6M9 16h3',
    user: 'M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4 21c.8-4 4-6.2 8-6.2s7.2 2.2 8 6.2',
    bell: 'M18 9.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15.5 18 9.5zM10.2 20a2 2 0 0 0 3.6 0',
    heart: 'M12 20s-7.5-4.6-9.2-9.4C1.6 7 4 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4 20 4 22.4 7 21.2 10.6 19.5 15.4 12 20 12 20z',
    star: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
    bike: 'M5.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 15.5 9 8h5l4.5 7.5M9 8 7.5 5H5M14 8l1.5-3h2.5',
    store: 'M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.2 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M10 20v-5h4v5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    x: 'M6 6l12 12M18 6 6 18',
    check: 'M4.5 12.5 9.5 17.5 19.5 7',
    chevL: 'M15 5l-7 7 7 7',
    chevR: 'M9 5l7 7-7 7',
    chevD: 'M5 9l7 7 7-7',
    arrowL: 'M19 12H5M11 6l-6 6 6 6',
    arrowR: 'M5 12h14M13 6l6 6-6 6',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.4 3.6 5.4 3.6 9s-1.1 6.6-3.6 9c-2.5-2.4-3.6-5.4-3.6-9S9.5 5.4 12 3z',
    phone: 'M6.6 3.5h2.8l1.4 4.2-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4.2 1.4v2.8a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z',
    chat: 'M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8.5zM8 9h8M8 12.5h5',
    edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
    trash: 'M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5A2 2 0 0 0 8.5 21h7a2 2 0 0 0 2-1.5L18.5 7M9 7V4.5h6V7',
    camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.5h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM12 16.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
    image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01',
    menu: 'M4 7h16M4 12h16M4 17h16',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H19v4M4 7.5V18a2 2 0 0 0 2 2h14v-5M4 7.5A2.5 2.5 0 0 0 6.5 10H21v5h-4a2.5 2.5 0 0 1 0-5',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.7 2.7 2.4 3 5.2',
    dish: 'M3 15h18M4.5 15a7.5 7.5 0 0 1 15 0M12 7.5V5.5M10 5.5h4M2.5 18.5h19',
    filter: 'M4 6h16M7 12h10M10 18h4',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
    alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
    logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h10',
    power: 'M12 3v8M6.5 6.5a7.5 7.5 0 1 0 11 0',
    calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM4 10h16M8.5 3v4M15.5 3v4',
    refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 4.5l1.5-2M20 20v-4.5h-4.5',
    send: 'M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.7 13.5l6.6 3.8M15.3 6.7l-6.6 3.8',
    eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    truck: 'M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    gift: 'M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5S10.8 3.5 8 3.5a2 2 0 0 0 0 4M12 7.5s1.2-4 4-4a2 2 0 0 1 0 4',
    tag: 'M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5zM8 8.5h.01',
    shield: 'M12 3 4.5 6v5.5c0 4.8 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.7 7.5-9.5V6z',
    file: 'M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5M9 13h6M9 17h6',
    download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 13.5l5-5 5 5M5 4h14',
    nav: 'M3 11 21 3l-8 18-2.2-7.8z',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.6-5.6-3.7-8.8-1.6 2-2.2 3.4-2.4 5-1-1.4-1.6-2.6-1.8-4.8C8.2 8.4 5.5 11 5.5 14.8 5.5 18.4 8.1 21 12 21z',
    leaf: 'M5 19c0-8 5-13.5 15-14-.3 10-5.8 15-14 15M5 19c2.5-3.5 5.5-6.2 9-8',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
    whatsapp: 'M4 20l1.2-3.6A8.2 8.2 0 1 1 8 19zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.4-2.6-1.8-3-3l1-1-1-2z',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    box: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9',
    door: 'M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18M15 12h.01',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.info}"/></svg>`;

  // ───────── تنبيهات سريعة ─────────
  let toastBox;
  function toast(msg, kind = '') {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); document.body.appendChild(toastBox); }
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = (kind === 'ok' ? icon('check', 's') : kind === 'bad' ? icon('alert', 's') : '') + `<span>${esc(msg)}</span>`;
    toastBox.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, kind === 'bad' ? 4200 : 2600);
  }

  // ───────── اللوح السفلي (نافذة على الكمبيوتر) ─────────
  const sheets = [];
  function openSheet(html, opts = {}) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = `<div class="grab"></div>` + (typeof html === 'string' ? html : '');
    if (typeof html !== 'string' && html) sh.appendChild(html);
    document.body.appendChild(bd); document.body.appendChild(sh);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { bd.classList.add('is-open'); sh.classList.add('is-open'); });
    const entry = { bd, sh, opts };
    sheets.push(entry);
    const close = () => closeSheet(entry);
    bd.addEventListener('click', () => { if (!opts.sticky) close(); });
    sh.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    // سحب لتحت للإغلاق على الجوال
    let y0 = null;
    sh.addEventListener('touchstart', (e) => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', (e) => { if (y0 != null && e.touches[0].clientY - y0 > 90 && !opts.sticky) { y0 = null; close(); } }, { passive: true });
    if (!opts.noFocus) setTimeout(() => { const f = sh.querySelector('[autofocus], input, textarea, select'); if (f && window.innerWidth > 760) f.focus(); }, 300);
    entry.close = close;
    return entry;
  }
  function closeSheet(entry) {
    const e = entry || sheets[sheets.length - 1];
    if (!e) return;
    const i = sheets.indexOf(e); if (i >= 0) sheets.splice(i, 1);
    e.bd.classList.remove('is-open'); e.sh.classList.remove('is-open');
    setTimeout(() => { e.bd.remove(); e.sh.remove(); }, 300);
    if (!sheets.length) document.body.style.overflow = '';
    if (e.opts.onClose) e.opts.onClose();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheets.length) closeSheet(); });

  function confirmBox({ title, body = '', ok, cancel, danger = false, input = null }) {
    return new Promise((resolve) => {
      let done = false;
      const s = openSheet(`
        <div class="stack">
          <h2>${esc(title)}</h2>
          ${body ? `<p class="ink2">${esc(body)}</p>` : ''}
          ${input ? `<textarea class="textarea" id="sfConfirmIn" placeholder="${esc(input.placeholder || '')}" maxlength="${input.max || 300}"></textarea>` : ''}
          <div class="row" style="margin-top:6px">
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} grow" id="sfConfirmOk">${esc(ok || t('تأكيد', 'Confirm'))}</button>
            <button class="btn btn-ghost" data-close>${esc(cancel || t('رجوع', 'Back'))}</button>
          </div>
        </div>`, { onClose: () => { if (!done) resolve(input ? null : false); } });
      s.sh.querySelector('#sfConfirmOk').onclick = () => {
        let v = true;
        if (input) { v = s.sh.querySelector('#sfConfirmIn').value.trim(); if (input.required && v.length < 2) { toast(input.requiredMsg || t('اكتب السبب', 'Please write a reason'), 'bad'); return; } }
        done = true; closeSheet(s); resolve(v);
      };
    });
  }

  // ───────── زر يحمل ─────────
  async function busy(btn, fn) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const html = btn.innerHTML; const w = btn.offsetWidth;
    btn.style.minWidth = w + 'px'; btn.innerHTML = '<span class="spin"></span>'; btn.setAttribute('aria-disabled', 'true');
    try { return await fn(); } finally { btn.innerHTML = html; btn.removeAttribute('aria-disabled'); delete btn.dataset.busy; btn.style.minWidth = ''; }
  }

  // ───────── الخادم ─────────
  const ERR = {
    SF_LOGIN: ['سجّل دخولك أول', 'Please sign in first'],
    SF_FORBIDDEN: ['ما عندك صلاحية لهذا', 'Not allowed'],
    SF_ORDER: ['الطلب غير موجود', 'Order not found'],
  };
  function errText(e) {
    const m = String(e?.message || e || '');
    for (const k of Object.keys(ERR)) if (m.includes(k)) return t(ERR[k][0], ERR[k][1]);
    if (/Failed to fetch|NetworkError|network/i.test(m)) return t('تأكد من الإنترنت وجرب مرة ثانية', 'Check your connection and try again');
    if (/JWT|token/i.test(m)) return t('انتهت الجلسة، سجّل دخولك من جديد', 'Session expired, please sign in again');
    return t('صار خطأ، جرّب مرة ثانية', 'Something went wrong, try again');
  }
  async function rpc(name, args = {}) {
    const { data, error } = await sb.rpc(name, args);
    if (error) { const e = new Error(error.message); e.raw = error; e.text = errText(error); throw e; }
    return data;
  }
  // رسالة أول خطأ من رد فيه errors[] أو {ar,en}
  const msgOf = (r) => (r?.errors?.length ? t(r.errors[0].ar, r.errors[0].en) : r && (r.ar || r.en) ? t(r.ar, r.en) : '');

  // ───────── الدخول برمز الجوال ─────────
  let meCache = null;
  const auth = {
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async user() { const s = await auth.session(); return s ? s.user : null; },
    async sendCode(phone) {
      const p = normPhone(phone);
      if (!p) throw Object.assign(new Error('phone'), { text: t('اكتب رقم جوال سعودي صحيح يبدأ بـ 05', 'Enter a valid Saudi mobile starting with 05') });
      const { error } = await sb.auth.signInWithOtp({ phone: '+' + p });
      if (error) {
        const m = String(error.message || '');
        const text = /rate|seconds|too many/i.test(m) ? t('انتظر شوي قبل ما تطلب رمز ثاني', 'Please wait before requesting another code') : t('ما قدرنا نرسل الرمز، جرّب بعد شوي', 'Could not send the code, try again shortly');
        throw Object.assign(new Error(m), { text });
      }
      return p;
    },
    async verify(phone, code) {
      const p = normPhone(phone);
      const { data, error } = await sb.auth.verifyOtp({ phone: '+' + p, token: String(code).trim(), type: 'sms' });
      if (error) throw Object.assign(new Error(error.message), { text: t('الرمز غير صحيح أو انتهى', 'The code is wrong or expired') });
      meCache = null;
      return data.session;
    },
    // local: يطلع من هالجهاز بس، وباقي أجهزة الحساب تبقى داخلة
    async signOut() { meCache = null; await sb.auth.signOut({ scope: 'local' }); },
    onChange(cb) { return sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_OUT' || ev === 'SIGNED_IN') meCache = null; cb(ev, s); }); },
  };
  async function me(force = false) {
    if (meCache && !force) return meCache;
    const s = await auth.session();
    if (!s) { meCache = { uid: null, role: 'guest' }; return meCache; }
    try { meCache = await rpc('sf_me'); } catch (e) { meCache = { uid: s.user.id, role: 'customer', error: true }; }
    return meCache;
  }

  // ───────── الإعدادات العامة ─────────
  let settings = null;
  async function loadSettings(force = false) {
    if (settings && !force) return settings;
    const cached = LS.get('sf_settings_v1', null);
    if (cached && !force) settings = cached;
    const { data } = await sb.from('sf_settings').select('key,value');
    if (data) { settings = Object.fromEntries(data.map((r) => [r.key, r.value])); LS.set('sf_settings_v1', settings); }
    return settings || {};
  }
  const setOn = (k, d = false) => { const v = settings?.[k]; return v == null || v === '' ? d : !/^(0|false|off|no)$/i.test(String(v).trim()); };
  const setNum = (k, d = 0) => { const v = parseFloat(settings?.[k]); return Number.isFinite(v) ? v : d; };

  // ───────── رفع الصور (ضغط في المتصفح) ─────────
  function compressImage(file, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const r = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/webp', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }
  async function uploadImage(folder, file, opts = {}) {
    const blob = await compressImage(file, opts.maxDim || 1280, opts.quality || 0.82);
    const path = `${folder.replace(/\/+$/, '')}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (error) throw Object.assign(new Error(error.message), { text: t('ما انرفعت الصورة، جرّب مرة ثانية', 'Upload failed, try again') });
    return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  }
  async function uploadDoc(folder, file) {
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const path = `${folder.replace(/\/+$/, '')}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('docs').upload(path, file, { contentType: file.type || 'application/pdf', upsert: false });
    if (error) throw Object.assign(new Error(error.message), { text: t('ما انرفع الملف، جرّب مرة ثانية', 'Upload failed, try again') });
    return path;
  }

  // ───────── التحديث الحي ─────────
  function live(table, filter, cb, name) {
    const ch = sb.channel(name || `${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (p) => cb(p))
      .subscribe();
    return ch;
  }

  // ───────── إشعارات الجوال (تطبيق مبني بـ Capacitor) ─────────
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  async function enableNativePush() {
    const PN = window.Capacitor?.Plugins?.PushNotifications;
    if (!PN) return { ok: false, why: 'no_plugin' };
    let perm = await PN.checkPermissions();
    if (perm.receive !== 'granted') perm = await PN.requestPermissions();
    if (perm.receive !== 'granted') return { ok: false, why: 'denied' };
    return await new Promise((resolve) => {
      let done = false;
      PN.addListener('registration', async (tok) => {
        if (done) return; done = true;
        const kind = window.Capacitor.getPlatform() === 'ios' ? 'apns' : 'fcm';
        try { await rpc('sf_device_register', { p_kind: kind, p_token: tok.value, p_ua: 'native-' + window.Capacitor.getPlatform() + '-' + (document.querySelector('script[src*="family.js"]') ? 'family' : 'customer') }); resolve({ ok: true }); }
        catch { resolve({ ok: false, why: 'save' }); }
      });
      PN.addListener('registrationError', () => { if (!done) { done = true; resolve({ ok: false, why: 'register' }); } });
      // الضغط على الإشعار يفتح الرابط داخل التطبيق
      PN.addListener('pushNotificationActionPerformed', (a) => { const u = a?.notification?.data?.url; if (u) location.href = u; });
      PN.register();
      setTimeout(() => { if (!done) { done = true; resolve({ ok: false, why: 'timeout' }); } }, 15000);
    });
  }

  // ───────── إشعارات المتصفح (Web Push) ─────────
  async function enablePush() {
    if (isNative()) return enableNativePush();
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, why: 'unsupported' };
    await loadSettings();
    const pub = settings?.vapid_public;
    if (!pub) return { ok: false, why: 'not_configured' };
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, why: 'denied' };
    const reg = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(pub.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((pub.length + 3) % 4)), (c) => c.charCodeAt(0));
    let subn = await reg.pushManager.getSubscription();
    if (!subn) subn = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const ok = await rpc('sf_device_register', { p_kind: 'webpush', p_token: JSON.stringify(subn), p_ua: navigator.userAgent.slice(0, 180) });
    return { ok: !!ok };
  }
  function registerSW(path = 'sw.js') {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register(path).catch(() => {});
  }

  // ───────── شاشة البداية ─────────
  function splash(minMs = 1500) {
    const el = document.querySelector('.splash');
    if (!el) return Promise.resolve();
    let shown = false;
    try { shown = !!sessionStorage.getItem('sf_splash'); sessionStorage.setItem('sf_splash', '1'); } catch { /* وضع خاص */ }
    const wait = shown ? 250 : minMs;
    return new Promise((r) => setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 500); r(); }, wait));
  }

  // واتساب
  const waLink = (phone, text = '') => { const p = normPhone(phone); return p ? `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; };

  window.SF = {
    cfg: CFG, sb, LS, t, nm, setLang, get lang() { return lang; }, onLang: (f) => langSubs.push(f),
    esc, money, moneyHtml, n2, fmtTime, fmtDate, fmtShort, fmtDT, ago, todayISO, dayISO, normPhone, showPhone,
    STATUS, statusLabel, statusBadge, isLive, icon, toast, openSheet, closeSheet, confirm: confirmBox, busy,
    rpc, msgOf, errText, auth, me, loadSettings, get settings() { return settings || {}; }, setOn, setNum,
    compressImage, uploadImage, uploadDoc, live, enablePush, registerSW, splash, waLink, isNative,
  };
})();
