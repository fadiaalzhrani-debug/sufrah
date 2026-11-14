// صفحات الشروط والخصوصية وحذف الحساب: لغة واحدة ظاهرة حسب اختيار المستخدم (sf_lang)، وسطر الاسم النظامي من الإعدادات
(function () {
  let lang = 'ar';
  try { lang = JSON.parse(localStorage.getItem('sf_lang') || '"ar"') === 'en' ? 'en' : 'ar'; } catch { /* */ }
  const btn = document.getElementById('langBtn');
  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-lang]').forEach((el) => { el.hidden = el.getAttribute('data-lang') !== lang; });
    if (btn) btn.textContent = lang === 'ar' ? 'English' : 'العربية';
  }
  apply();
  if (btn) btn.addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('sf_lang', JSON.stringify(lang)); } catch { /* */ } apply(); });
  // الاسم النظامي ورقم السجل (لو انضبطت من الإدارة)
  const line = document.getElementById('legalLine');
  if (line && window.fetch) {
    fetch('https://uzwuvzxdjijlbfguhlmc.supabase.co/rest/v1/sf_settings?select=key,value&key=in.(legal_name,cr_number,vat_number)', {
      headers: { apikey: (window.SF_CFG && window.SF_CFG.key) || '' },
    }).then((r) => r.ok ? r.json() : []).then((rows) => {
      const m = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
      const parts = [m.legal_name, m.cr_number ? 'س.ت ' + m.cr_number : '', m.vat_number ? 'الرقم الضريبي ' + m.vat_number : ''].filter(Boolean);
      if (parts.length) line.textContent = parts.join(' · ');
    }).catch(() => {});
  }
})();
