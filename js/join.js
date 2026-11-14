/* ============================================================
   سُفرة · صفحة انضمام الأسر · js/join.js
   صفحة عامة دافية: ليش سُفرة، كيف تشتغل، ونموذج الطلب ← sf_join_submit
   ============================================================ */
(function () {
  'use strict';
  const t = (ar, en) => SF.t(ar, en);
  const esc = (s) => SF.esc(s);
  const ic = (n, c = '') => SF.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = document.getElementById('app');
  const DRAFT = 'sf_join_draft_v1';

  const CUISINES = [['سعودي', 'Saudi'], ['نجدي', 'Najdi'], ['حجازي', 'Hijazi'], ['جنوبي', 'Southern'], ['شمالي', 'Northern'], ['شرقاوي', 'Eastern'], ['يمني', 'Yemeni'], ['شامي', 'Levantine'],
    ['مصري', 'Egyptian'], ['هندي', 'Indian'], ['حلويات', 'Sweets'], ['معجنات', 'Pastries'], ['مشويات', 'Grills'], ['صحي', 'Healthy'], ['مفرزنات', 'Frozen meals'], ['فطور', 'Breakfast']];
  const LICENSES = [['وثيقة عمل حر', 'Freelance permit'], ['شهادة أسرة منتجة', 'Productive family certificate'], ['غيره', 'Other']];

  const blank = { name: '', phone: '', kitchen: '', city: '', district: '', cuisines: [], specialties: '', license: false, licenseKind: '', instagram: '', notes: '', agree: false };
  const S = Object.assign({}, blank, SF.LS.get(DRAFT, {}) || {});
  if (!Array.isArray(S.cuisines)) S.cuisines = [];
  let cities = [], photos = [], done = null, errs = {}, sending = false;

  const saveDraft = (() => { let h; return () => { clearTimeout(h); h = setTimeout(() => SF.LS.set(DRAFT, S), 250); }; })();
  const cityName = (id) => { const c = cities.find((x) => x.id === id); return c ? SF.nm(c, 'name') : ''; };
  const cleanIg = (v) => String(v || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);

  // ───────── الأجزاء ─────────
  const topbar = () => `
    <header class="topbar j-topbar"><div class="topbar-in">
      <a class="brand" href="index.html" aria-label="${esc(t('سُفرة، الرئيسية', 'Sufrah home'))}"><img src="img/mark.svg" alt=""><span>${esc(t('سُفرة', 'Sufrah'))}</span></a>
      <span class="grow"></span>
      <a class="btn btn-ghost btn-sm j-login" href="family.html">${ic('store', 's')}<span>${esc(t('دخول الأسر', 'Kitchen login'))}</span></a>
      <button class="icon-btn" data-lang aria-label="${esc(SF.lang === 'en' ? 'العربية' : 'English')}">${ic('globe')}</button>
    </div></header>`;
  const stars = () => `<span class="j-stars">${ic('star', 's')}${ic('star', 's')}${ic('star', 's')}${ic('star', 's')}${ic('star', 's')}</span>`;
  function hero() {
    return `
    <section class="j-hero">
      <div class="j-hero-in">
        <div class="j-copy">
          <span class="j-eyebrow">${ic('sparkle', 's')}${esc(t('للأسر المنتجة', 'For home kitchens'))}</span>
          <h1>${esc(t('بيع أكلك', 'Sell your food'))}<em>${esc(t('من بيتك', 'from home'))}</em></h1>
          <p class="j-lead">${esc(t('سُفرة توصل طبخك لأهل مدينتك. أنت تطبخ في مطبخك، والطلبات توصلك على جوالك.', 'Sufrah brings your cooking to people in your city. You cook at home, orders reach your phone.'))}</p>
          <div class="j-cta">
            <a class="btn btn-primary btn-lg" href="#form" data-go="form">${esc(t('سجّل مطبخك', 'Register your kitchen'))}${ic('arrowL', 's j-arr')}</a>
            <a class="btn btn-soft btn-lg" href="#how" data-go="how">${esc(t('كيف تشتغل؟', 'How it works'))}</a>
          </div>
          <ul class="j-trust">
            <li>${ic('check', 's')}${esc(t('التسجيل ياخذ دقيقتين', 'Takes two minutes'))}</li>
            <li>${ic('check', 's')}${esc(t('عمولة بسيطة على كل طلب', 'A small commission per order'))}</li>
            <li>${ic('check', 's')}${esc(t('نرد عليك خلال يومين', 'We reply within two days'))}</li>
          </ul>
        </div>
        <div class="j-art" aria-hidden="true">
          <div class="j-plate"><span class="r r1"></span><span class="r r2"></span><span class="r r3"></span><img src="img/mark.svg" alt=""></div>
          <div class="j-float f1"><span class="fi">${ic('bell', 's')}</span><div><b>${esc(t('طلب جديد', 'New order'))}</b><small>${esc(t('جريش بالدجاج × 2', 'Jareesh with chicken × 2'))}</small></div></div>
          <div class="j-float f2"><span class="fi st">${ic('star', 's')}</span><div><b>${esc(t('تقييم جديد', 'New review'))}</b>${stars()}</div></div>
          <div class="j-float f3"><span class="fi ok">${ic('wallet', 's')}</span><div><b>${esc(t('حسابك واضح', 'Clear earnings'))}</b><small>${esc(t('صافيك أول بأول', 'Your net, as it happens'))}</small></div></div>
        </div>
      </div>
      <div class="sadu"></div>
    </section>`;
  }
  function photosStrip() {
    if (photos.length < 3) return '';
    return `<section class="j-sec j-photos"><div class="j-in"><h2 class="j-h">${esc(t('من مطابخ سُفرة', 'From Sufrah kitchens'))}</h2>
      <div class="j-strip">${photos.slice(0, 8).map((p) => `<figure><img src="${esc(p.image_url)}" alt="${esc(SF.nm(p, 'name'))}" loading="lazy" onerror="this.closest('figure').remove()"><figcaption>${esc(SF.nm(p, 'name'))}</figcaption></figure>`).join('')}</div></div></section>`;
  }
  function benefits() {
    const B = [
      ['users', t('زبائن من مدينتك', 'Customers in your city'), t('أهل مدينتك يلقون مطبخك ويطلبون منه بضغطة.', 'People nearby find your kitchen and order in a tap.')],
      ['clock', t('أنت تحدد وقتك', 'You set your hours'), t('تختار أيام الدوام والكميات، وتوقف استقبال الطلبات متى ما تبي.', 'Pick your days and quantities, pause orders whenever you like.')],
      ['wallet', t('حسابك واضح', 'Clear earnings'), t('تشوف طلباتك ومبيعاتك وصافيك أول بأول من جوالك.', 'See your orders, sales and net income on your phone.')],
    ];
    return `<section class="j-sec" id="why"><div class="j-in">
      <h2 class="j-h">${esc(t('ليش تبيع في سُفرة؟', 'Why sell on Sufrah?'))}</h2>
      <div class="j-benefits">${B.map(([i, h, p]) => `<article class="j-ben"><span class="j-ben-ic">${ic(i)}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></article>`).join('')}</div>
    </div></section>`;
  }
  function steps() {
    const St = [
      [t('سجّل مطبخك', 'Register your kitchen'), t('عبّ النموذج تحت، ما ياخذ دقيقتين.', 'Fill in the short form below.')],
      [t('نكلمك على الواتساب', 'We message you on WhatsApp'), t('نتعرف على مطبخك ونجهز حسابك.', 'We get to know your kitchen and set up your account.')],
      [t('استقبل الطلبات', 'Start taking orders'), t('من تطبيق الأسرة على جوالك، وأنت في بيتك.', 'From the kitchen app on your phone, right from home.')],
    ];
    return `<section class="j-sec j-how" id="how"><div class="j-in">
      <h2 class="j-h">${esc(t('كيف تشتغل؟', 'How it works'))}</h2>
      <ol class="j-steps">${St.map(([h, p], i) => `<li><span class="j-n">${i + 1}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></li>`).join('')}</ol>
      <p class="j-fee">${ic('tag', 's')}<span>${esc(t('عمولة بسيطة على كل طلب، وكل شي واضح في حسابك.', 'A small commission on each order, and everything is clear in your account.'))}</span></p>
    </div></section>`;
  }
  const err = (k) => (errs[k] ? `<small class="j-err" id="e-${k}">${ic('alert', 's')}${esc(errs[k])}</small>` : '');
  const bad = (k) => (errs[k] ? 'is-bad' : '');
  function formCard() {
    const cityOpts = `<option value="">${esc(t('اختر مدينتك', 'Choose your city'))}</option>` + cities.map((c) => `<option value="${esc(c.id)}" ${S.city === c.id ? 'selected' : ''}>${esc(SF.nm(c, 'name'))}</option>`).join('');
    return `<section class="j-sec j-form-sec" id="form"><div class="j-in">
      <div class="j-card">
        <div class="j-card-h"><span class="j-card-ic">${ic('store')}</span><div><h2>${esc(t('سجّل مطبخك', 'Register your kitchen'))}</h2><p>${esc(t('عبّ بياناتك، وبنتواصل معك على الواتساب.', 'Fill in your details and we will reach you on WhatsApp.'))}</p></div></div>
        <form id="jf" novalidate autocomplete="on">
          <div class="j-grid">
            <label class="field"><span>${esc(t('اسمك', 'Your name'))} <i class="req">*</i></span><input class="input ${bad('name')}" name="name" autocomplete="name" maxlength="60" value="${esc(S.name)}">${err('name')}</label>
            <label class="field"><span>${esc(t('رقم الجوال', 'Mobile number'))} <i class="req">*</i></span>
              <div class="input-group ${bad('phone')}"><span class="addon">+966</span><input class="input" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="05XXXXXXXX" dir="ltr" maxlength="14" value="${esc(S.phone)}"></div>
              ${err('phone') || `<small class="hint">${esc(t('نكلمك على الواتساب على هذا الرقم', 'We will WhatsApp you on this number'))}</small>`}</label>
            <label class="field full"><span>${esc(t('اسم المطبخ', 'Kitchen name'))} <i class="req">*</i></span><input class="input ${bad('kitchen')}" name="kitchen" maxlength="60" placeholder="${esc(t('مثل: مطبخ أم فهد', 'For example: Um Fahad Kitchen'))}" value="${esc(S.kitchen)}">${err('kitchen')}</label>
            <label class="field"><span>${esc(t('المدينة', 'City'))} <i class="req">*</i></span><select class="select ${bad('city')}" name="city">${cityOpts}</select>${err('city')}</label>
            <label class="field"><span>${esc(t('الحي', 'District'))}</span><input class="input" name="district" maxlength="60" autocomplete="address-level3" value="${esc(S.district)}"></label>
          </div>
          <div class="field"><span>${esc(t('وش تطبخ؟', 'What do you cook?'))}</span>
            <div class="j-chips" id="jCuis">${CUISINES.map(([a, e]) => `<button type="button" class="chip ${S.cuisines.includes(a) ? 'is-active' : ''}" data-cu="${esc(a)}" aria-pressed="${S.cuisines.includes(a)}">${S.cuisines.includes(a) ? ic('check', 's') : ''}${esc(t(a, e))}</button>`).join('')}</div>
            <small class="hint">${esc(t('اختر لين 8', 'Pick up to 8'))}</small></div>
          <label class="field"><span>${esc(t('أشهر أكلاتك', 'Your best dishes'))}</span><textarea class="textarea" name="specialties" maxlength="500" placeholder="${esc(t('مثل: جريش، قرصان، مرقوق، كيك التمر', 'For example: jareesh, qursan, date cake'))}">${esc(S.specialties)}</textarea></label>
          <div class="j-lic">
            <div class="j-lic-row"><div class="grow"><b>${esc(t('عندك ترخيص؟', 'Do you have a licence?'))}</b><small>${esc(t('مثل وثيقة العمل الحر أو شهادة الأسرة المنتجة', 'Like a freelance permit or a productive family certificate'))}</small></div>
              <span class="switch"><input type="checkbox" name="license" ${S.license ? 'checked' : ''} aria-label="${esc(t('عندك ترخيص؟', 'Do you have a licence?'))}"><span></span></span></div>
            <div class="j-lic-kinds ${S.license ? '' : 'hide'}">${LICENSES.map(([a, e]) => `<label class="choice ${S.licenseKind === a ? 'is-active' : ''}"><input type="radio" name="licenseKind" value="${esc(a)}" ${S.licenseKind === a ? 'checked' : ''}><span class="grow">${esc(t(a, e))}</span></label>`).join('')}${err('licenseKind')}</div>
          </div>
          <div class="j-grid">
            <label class="field"><span>${esc(t('حساب انستقرام', 'Instagram'))}</span><div class="input-group"><span class="addon">@</span><input class="input" name="instagram" dir="ltr" maxlength="60" autocapitalize="off" spellcheck="false" value="${esc(S.instagram)}"></div><small class="hint">${esc(t('اختياري، نشوف فيه أكلك', 'Optional, so we can see your food'))}</small></label>
            <label class="field"><span>${esc(t('ملاحظات', 'Notes'))}</span><input class="input" name="notes" maxlength="500" value="${esc(S.notes)}" placeholder="${esc(t('أي شي تبي تقوله لنا', 'Anything you want to tell us'))}"></label>
          </div>
          <label class="j-agree ${bad('agree')}"><input type="checkbox" name="agree" ${S.agree ? 'checked' : ''}><span>${esc(t('قرأت', 'I have read'))} <a href="terms.html" target="_blank" rel="noopener">${esc(t('الشروط', 'the terms'))}</a> ${esc(t('وأوافق عليها', 'and I agree'))}</span></label>
          ${err('agree')}
          <button class="btn btn-primary btn-lg btn-block j-send" type="submit" id="jSend">${ic('send', 's flip')}${esc(t('أرسل الطلب', 'Send request'))}</button>
        </form>
      </div>
    </div></section>`;
  }
  function footer() {
    const wa = SF.settings && SF.settings.support_whatsapp ? SF.waLink(SF.settings.support_whatsapp, t('أهلًا، عندي سؤال عن الانضمام لسُفرة', 'Hi, I have a question about joining Sufrah')) : '';
    return `<footer class="j-foot"><div class="j-in">
      <div class="brand"><img src="img/mark.svg" alt=""><span>${esc(t('سُفرة', 'Sufrah'))}</span></div>
      <p>${esc(t('أكل بيت من الأسر المنتجة', 'Home cooking from local families'))}</p>
      <nav><a href="terms.html">${esc(t('الشروط', 'Terms'))}</a><a href="privacy.html">${esc(t('الخصوصية', 'Privacy'))}</a><a href="credits.html">${esc(t('مصادر الصور', 'Photo credits'))}</a><a href="index.html">${esc(t('تصفح سُفرة', 'Browse Sufrah'))}</a>${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">${ic('whatsapp', 's')}${esc(t('تواصل معنا', 'Contact us'))}</a>` : ''}</nav>
    </div></footer>`;
  }
  function doneScreen() {
    const d = done;
    return `<main class="j-done"><div class="j-card j-done-card">
      <div class="j-ok">${ic('check', 'l')}</div>
      <h1>${esc(t('وصلنا طلبك', 'We got your request'))}</h1>
      <p class="j-done-lead">${esc(t('بنكلمك على الواتساب خلال يومين', 'We will message you on WhatsApp within two days'))}</p>
      ${d && d.kitchen_name ? `<div class="j-sum"><span class="j-sum-ic">${ic('store')}</span><div class="grow"><b>${esc(d.kitchen_name)}</b><small>${esc([d.name, cityName(d.city_id)].filter(Boolean).join(' · '))}</small></div><span class="ltr j-sum-ph">${esc(SF.showPhone(d.phone))}</span></div>` : ''}
      <div class="j-next"><h3>${esc(t('وش اللي بعدها؟', 'What happens next?'))}</h3>
        <ol>
          <li><span class="j-n">1</span>${esc(t('نكلمك ونتعرف على مطبخك', 'We call and get to know your kitchen'))}</li>
          <li><span class="j-n">2</span>${esc(t('لما ينقبل طلبك تدخل تطبيق الأسرة برقم جوالك نفسه', 'Once approved, sign in to the kitchen app with the same number'))}</li>
          <li><span class="j-n">3</span>${esc(t('تضيف منيوك وتبدأ تستقبل الطلبات', 'Add your menu and start taking orders'))}</li>
        </ol></div>
      <a class="btn btn-primary btn-lg btn-block" href="family.html">${ic('store', 's')}${esc(t('افتح تطبيق الأسرة', 'Open the kitchen app'))}</a>
      <a class="btn btn-ghost btn-block" href="index.html">${esc(t('تصفح سُفرة', 'Browse Sufrah'))}</a>
    </div></main>`;
  }

  // ───────── العرض والربط ─────────
  function render() {
    document.title = done ? t('سُفرة · وصلنا طلبك', 'Sufrah · Request received') : t('سُفرة · بيع أكلك من بيتك', 'Sufrah · Sell your food from home');
    app.className = 'j-page';
    app.innerHTML = topbar() + (done ? doneScreen() : `<main>${hero()}${photosStrip()}${benefits()}${steps()}${formCard()}</main>`) + footer();
    bind();
  }
  function bind() {
    const lang = $('[data-lang]');
    if (lang) lang.onclick = () => SF.setLang(SF.lang === 'en' ? 'ar' : 'en');
    $$('[data-go]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const el = document.getElementById(a.dataset.go); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (a.dataset.go === 'form') setTimeout(() => { const f = $('#jf [name="name"]'); if (f && !f.value && window.innerWidth > 760) f.focus({ preventScroll: true }); }, 500); }; });
    const form = $('#jf');
    if (!form) return;
    form.addEventListener('input', (e) => {
      const el = e.target; if (!el.name) return;
      if (el.type === 'checkbox') S[el.name] = el.checked;
      else if (el.type === 'radio') S[el.name] = el.value;
      else S[el.name] = el.value;
      if (errs[el.name]) { delete errs[el.name]; const box = el.closest('.field, .j-agree, .j-lic-kinds'); if (box) { const m = box.querySelector('.j-err'); if (m) m.remove(); $$('.is-bad', box).forEach((x) => x.classList.remove('is-bad')); box.classList.remove('is-bad'); } }
      saveDraft();
    });
    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.name === 'license') { S.license = el.checked; $('.j-lic-kinds', form).classList.toggle('hide', !el.checked); saveDraft(); }
      if (el.name === 'licenseKind') { $$('.j-lic-kinds .choice', form).forEach((c) => c.classList.toggle('is-active', c.contains(el))); }
      if (el.name === 'city') S.city = el.value;
    });
    $('#jCuis').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cu]'); if (!b) return;
      const v = b.dataset.cu, i = S.cuisines.indexOf(v);
      if (i >= 0) S.cuisines.splice(i, 1);
      else { if (S.cuisines.length >= 8) { SF.toast(t('تقدر تختار 8 بالكثير', 'You can pick up to 8'), 'bad'); return; } S.cuisines.push(v); }
      const on = S.cuisines.includes(v);
      b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      const c = CUISINES.find((x) => x[0] === v);
      b.innerHTML = (on ? ic('check', 's') : '') + esc(t(c[0], c[1]));
      saveDraft();
    });
    form.addEventListener('submit', submit);
  }
  function validate() {
    const e = {};
    if (S.name.trim().length < 2) e.name = t('اكتب اسمك', 'Enter your name');
    if (!SF.normPhone(S.phone)) e.phone = t('اكتب رقم جوال سعودي يبدأ بـ 05', 'Enter a Saudi mobile starting with 05');
    if (S.kitchen.trim().length < 2) e.kitchen = t('اكتب اسم مطبخك', 'Enter your kitchen name');
    if (!S.city) e.city = t('اختر مدينتك', 'Choose your city');
    if (S.license && !S.licenseKind) e.licenseKind = t('اختر نوع الترخيص', 'Choose the licence type');
    if (!S.agree) e.agree = t('وافق على الشروط عشان نكمل', 'Please accept the terms to continue');
    return e;
  }
  async function submit(ev) {
    ev.preventDefault();
    if (sending) return;
    errs = validate();
    if (Object.keys(errs).length) {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
      const first = $('.j-err');
      if (first) (first.closest('.field') || first.previousElementSibling || first).scrollIntoView({ behavior: 'smooth', block: 'center' });
      SF.toast(Object.values(errs)[0], 'bad');
      return;
    }
    const payload = {
      phone: SF.normPhone(S.phone), name: S.name.trim(), kitchen_name: S.kitchen.trim(), city_id: S.city, district: S.district.trim() || null,
      cuisines: S.cuisines.slice(0, 8), specialties: S.specialties.trim() || null, has_license: !!S.license, license_kind: S.license ? S.licenseKind || null : null,
      instagram: cleanIg(S.instagram) || null, notes: S.notes.trim() || null,
    };
    sending = true;
    await SF.busy($('#jSend'), async () => {
      try {
        const r = await SF.rpc('sf_join_submit', { p: payload });
        if (r && r.ok) { finish(payload); return; }
        // نفس الرقم أرسل قبل (حد يومي): الطلب واصل أصلًا
        if (r && /وصلنا طلبك/.test(r.ar || '')) { finish(payload); return; }
        SF.toast(SF.msgOf(r) || t('ما وصل الطلب، جرّب مرة ثانية', 'The request did not go through, try again'), 'bad');
      } catch (e) { SF.toast(e.text || SF.errText(e), 'bad'); }
    });
    sending = false;
  }
  function finish(payload) {
    done = payload;
    $$('.toast').forEach((x) => x.remove());
    SF.LS.del(DRAFT);
    Object.assign(S, blank, { cuisines: [] });
    render();
    window.scrollTo(0, 0);
  }

  // ───────── التشغيل ─────────
  SF.onLang(() => render());
  render();
  (async () => {
    try {
      const [c] = await Promise.all([
        SF.sb.from('sf_cities').select('id,name_ar,name_en,active,sort').order('sort'),
        SF.loadSettings().catch(() => ({})),
      ]);
      cities = (c.data || []).sort((a, b) => (b.active - a.active) || (a.sort - b.sort));
      render();
      const p = await SF.sb.from('sf_dishes').select('name_ar,name_en,image_url').not('image_url', 'is', null).eq('available', true).limit(12);
      photos = (p.data || []).filter((x) => x.image_url);
      if (photos.length >= 3 && !done) { const y = window.scrollY; render(); window.scrollTo(0, y); }
    } catch (e) { /* الصفحة تشتغل بدون المدن، والاختيار يرجع بعد التحديث */ }
  })();
})();
