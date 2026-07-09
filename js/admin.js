/* ===================================================
   سُفرة — لوحة الأدمن (المالك فقط)
   =================================================== */
(function () {
  'use strict';

  const ADMIN_EMAIL = 'fadiaalzhrani@gmail.com';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const $ = (s) => document.querySelector(s);
  const authView = $('#authView');
  const adminView = $('#adminView');
  const toastEl = $('#toast');
  const state = { kitchens: [], dishes: [], ann: [], orders: [], coupons: [] };

  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('is-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2400);
  }

  /* ---------- عرض/إخفاء ---------- */
  function showAuth() { authView.hidden = false; adminView.hidden = true; $('#logoutBtn').hidden = true; }
  function showAdmin() { authView.hidden = true; adminView.hidden = false; $('#logoutBtn').hidden = false; loadAll(); }

  /* ---------- تحميل البيانات ---------- */
  async function loadAll() {
    const [k, d, a, o, cp] = await Promise.all([
      sb.from('kitchens').select('*').order('created_at', { ascending: false }),
      sb.from('dishes').select('*').order('created_at', { ascending: false }),
      sb.from('announcements').select('*').order('created_at', { ascending: false }),
      sb.from('orders').select('*').order('created_at', { ascending: false }),
      sb.from('coupons').select('*').order('created_at', { ascending: false }),
    ]);
    state.kitchens = k.data || []; state.dishes = d.data || []; state.ann = a.data || []; state.orders = o.data || []; state.coupons = cp.data || [];
    render();
  }

  /* ---------- الرسم ---------- */
  function render() {
    const verified = state.kitchens.filter((k) => k.verified).length;
    $('#stKitchens').textContent = state.kitchens.length;
    $('#stVerified').textContent = verified;
    $('#stDishes').textContent = state.dishes.length;
    $('#stAnn').textContent = state.ann.length;
    $('#kCount').textContent = state.kitchens.length;
    $('#dCount').textContent = state.dishes.length;

    // إعلانات
    $('#annList').innerHTML = state.ann.map((a) => `
      <div class="arow">
        <div class="arow__main"><span class="arow__emoji">📣</span><div><b>${esc(a.message)}</b><small>${fmtDate(a.created_at)}</small></div></div>
        <button class="abtn abtn--danger" data-delann="${a.id}">حذف</button>
      </div>`).join('');

    // مطابخ
    $('#kEmpty').hidden = state.kitchens.length > 0;
    $('#kitchensList').innerHTML = state.kitchens.map((k) => {
      const cz = (CUISINE_BY_ID[k.cuisine] || {});
      return `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__emoji">${k.emoji || '🍽️'}</span>
          <div><b>${esc(k.name)} ${k.verified ? '<span class="averified">✔ موثّق</span>' : ''}</b>
            <small>${cz.name || ''}${k.city ? ' · ' + k.city : ''}</small></div>
        </div>
        <label class="averify"><input type="checkbox" data-verify="${k.id}" ${k.verified ? 'checked' : ''} /> توثيق</label>
        <button class="abtn abtn--danger" data-delk="${k.id}">حذف</button>
      </div>`;
    }).join('');

    // أطباق
    $('#dEmpty').hidden = state.dishes.length > 0;
    $('#dishesList').innerHTML = state.dishes.map((d) => {
      const cat = (CATEGORY_BY_ID[d.category] || {});
      const kName = (state.kitchens.find((k) => k.id === d.kitchen_id) || {}).name || '';
      return `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__emoji">${cat.emoji || '🍽️'}</span>
          <div><b>${esc(d.name)}</b><small>${d.price} ر.س · ${cat.name || ''}${kName ? ' · ' + esc(kName) : ''}</small></div>
        </div>
        <button class="abtn abtn--danger" data-deld="${d.id}">حذف</button>
      </div>`;
    }).join('');

    // طلبات
    $('#oEmpty').hidden = state.orders.length > 0;
    $('#oCount').textContent = state.orders.length;
    $('#ordersList').innerHTML = state.orders.map((o) => {
      const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
      const kName = (state.kitchens.find((k) => k.id === o.kitchen_id) || {}).name || '';
      const items = (o.items || []).map((it) => `${it.qty}× ${esc(it.name)}`).join('، ');
      const pm = (PAYMENT_TYPES[o.payment_method] || PAYMENT_TYPES.cash);
      const sv = o.scheduled_for || (o.items || []).reduce((v, it) => v || (it && it.sched) || null, null);
      const sched = sv
        ? ' · 📅 ' + (() => { try { return new Date(sv).toLocaleString('ar', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()
        : '';
      return `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__emoji">📦</span>
          <div><b>${esc(o.customer_name || '')} <span class="ostatus ostatus--${o.status}">${st.emoji} ${st.label}</span></b>
            <small>${esc(kName)} · ${o.total} ر.س · ${pm.emoji} · ${esc(o.customer_phone || '')}${sched} · ${items}</small></div>
        </div>
        <button class="abtn abtn--danger" data-delorder="${o.id}">حذف</button>
      </div>`;
    }).join('');

    // كوبونات
    $('#cCount').textContent = state.coupons.length;
    $('#couponsList').innerHTML = state.coupons.map((c) => `
      <div class="arow">
        <div class="arow__main"><span class="arow__emoji">🎁</span>
          <div><b>${esc(c.code)}</b><small>${c.discount_type === 'percent' ? c.value + '%' : c.value + ' ر.س'} خصم</small></div>
        </div>
        <button class="abtn abtn--danger" data-delcoupon="${c.id}">حذف</button>
      </div>`).join('');
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const fmtDate = (s) => { try { return new Date(s).toLocaleDateString('ar'); } catch { return ''; } };

  /* ---------- إجراءات الأدمن ---------- */
  async function toggleVerify(id, val) {
    const { error } = await sb.from('kitchens').update({ verified: val }).eq('id', id);
    if (error) { showToast('تعذّر التحديث: ' + error.message); return; }
    showToast(val ? '✔ تم التوثيق' : 'أُلغي التوثيق'); loadAll();
  }
  async function delKitchen(id) {
    if (!confirm('حذف هذا المطبخ وكل أطباقه؟')) return;
    const { error } = await sb.from('kitchens').delete().eq('id', id);
    if (error) { showToast('تعذّر الحذف: ' + error.message); return; }
    showToast('🗑️ تم حذف المطبخ'); loadAll();
  }
  async function delDish(id) {
    if (!confirm('حذف هذا الطبق؟')) return;
    const { error } = await sb.from('dishes').delete().eq('id', id);
    if (error) { showToast('تعذّر الحذف: ' + error.message); return; }
    showToast('🗑️ تم حذف الطبق'); loadAll();
  }
  async function sendAnn() {
    const t = $('#annText').value.trim();
    if (!t) return;
    const { error } = await sb.from('announcements').insert({ message: t });
    if (error) { showToast('تعذّر الإرسال: ' + error.message); return; }
    $('#annText').value = ''; showToast('📣 تم إرسال الإعلان'); loadAll();
  }
  async function delAnn(id) {
    const { error } = await sb.from('announcements').delete().eq('id', id);
    if (error) { showToast('تعذّر الحذف: ' + error.message); return; }
    loadAll();
  }
  async function delOrder(id) {
    if (!confirm('حذف هذا الطلب؟')) return;
    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) { showToast('تعذّر الحذف: ' + error.message); return; }
    showToast('🗑️ تم حذف الطلب'); loadAll();
  }
  async function addCoupon() {
    const code = ($('#cCode').value || '').trim().toUpperCase();
    const type = $('#cType').value;
    const value = Number($('#cValue').value);
    if (!code || !value) { showToast('اكتب الكود والقيمة'); return; }
    const { error } = await sb.from('coupons').insert({ code, discount_type: type, value });
    if (error) { showToast(/duplicate|unique/i.test(error.message) ? 'الكود موجود من قبل' : 'تعذّر: ' + error.message); return; }
    $('#cCode').value = ''; $('#cValue').value = '';
    showToast('🎁 تم إضافة الكوبون'); loadAll();
  }
  async function delCoupon(id) {
    if (!confirm('حذف هذا الكوبون؟')) return;
    const { error } = await sb.from('coupons').delete().eq('id', id);
    if (error) { showToast('تعذّر الحذف: ' + error.message); return; }
    showToast('🗑️ تم حذف الكوبون'); loadAll();
  }

  /* ---------- الأحداث ---------- */
  function bind() {
    // إظهار كلمة المرور
    document.querySelectorAll('.pw-toggle').forEach((btn) => btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
    }));

    // دخول
    $('#adminForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#authError');
      const fd = new FormData(e.target);
      const { data, error } = await sb.auth.signInWithPassword({ email: (fd.get('email') || '').trim(), password: fd.get('password') });
      if (error) { err.textContent = 'البريد أو كلمة المرور غير صحيحة'; err.hidden = false; return; }
      if (data.user.email !== ADMIN_EMAIL) { err.textContent = 'هذا الحساب غير مصرّح له بالدخول للوحة'; err.hidden = false; await sb.auth.signOut(); return; }
      err.hidden = true; showAdmin();
    });

    // إنشاء حساب الأدمن (أول مرة)
    $('#signupBtn').addEventListener('click', async () => {
      const err = $('#authError');
      const fd = new FormData($('#adminForm'));
      const email = (fd.get('email') || '').trim();
      if (email !== ADMIN_EMAIL) { err.textContent = `يجب إنشاء الحساب بإيميل الأدمن: ${ADMIN_EMAIL}`; err.hidden = false; return; }
      if (!fd.get('password')) { err.textContent = 'أدخل كلمة مرور'; err.hidden = false; return; }
      const { data, error } = await sb.auth.signUp({ email, password: fd.get('password') });
      if (error) { err.textContent = /registered|already/i.test(error.message) ? 'الحساب موجود، سجّل الدخول مباشرة' : error.message; err.hidden = false; return; }
      if (!data.session) { err.textContent = 'فعّل حسابك ثم سجّل الدخول'; err.hidden = false; return; }
      err.hidden = true; showToast('🎉 تم إنشاء حساب الأدمن'); showAdmin();
    });

    // خروج
    $('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); showAuth(); showToast('تم تسجيل الخروج'); });

    // إعلان
    $('#annSend').addEventListener('click', sendAnn);
    // كوبون
    $('#cAdd').addEventListener('click', addCoupon);

    // إجراءات القوائم
    document.body.addEventListener('click', (e) => {
      const dk = e.target.closest('[data-delk]'); if (dk) { delKitchen(dk.dataset.delk); return; }
      const dd = e.target.closest('[data-deld]'); if (dd) { delDish(dd.dataset.deld); return; }
      const da = e.target.closest('[data-delann]'); if (da) { delAnn(da.dataset.delann); return; }
      const dord = e.target.closest('[data-delorder]'); if (dord) { delOrder(dord.dataset.delorder); return; }
      const dc = e.target.closest('[data-delcoupon]'); if (dc) { delCoupon(dc.dataset.delcoupon); return; }
    });
    document.body.addEventListener('change', (e) => {
      const v = e.target.closest('[data-verify]'); if (v) toggleVerify(v.dataset.verify, v.checked);
    });

    // تحديث لحظي
    sb.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchens' }, () => { if (!adminView.hidden) loadAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, () => { if (!adminView.hidden) loadAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (!adminView.hidden) loadAll(); })
      .subscribe();
  }

  /* ---------- الإقلاع ---------- */
  async function init() {
    bind();
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user.email === ADMIN_EMAIL) showAdmin(); else showAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
