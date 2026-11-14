// ============================================================
//  سُفرة · delete-account: العميل يحذف حسابه بنفسه (متطلب المتاجر ونظام حماية البيانات)
//  POST /delete-account  بتوكن المستخدم → نخفي بياناته الشخصية من الطلبات ونحذف حساب الدخول
//  حسابات الطاقم (إدارة/أسرة) ما تنحذف من هنا: تتواصل مع الإدارة
// ============================================================
import { callerUser, db, rpc, json, CORS } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await callerUser(req);
  if (!user) return json({ ok: false, error: "login" }, 401);
  try {
    const staff = await db(`sf_staff?user_id=eq.${user.id}&active=eq.true&select=id,role&limit=1`);
    if (Array.isArray(staff) && staff.length) return json({ ok: false, error: "staff", ar: "حسابك مرتبط بأسرة أو بالإدارة، تواصل معنا لحذفه", en: "Staff accounts are removed by the admin team" }, 409);
    const live = await db(`sf_orders?user_id=eq.${user.id}&status=in.(pending_payment,new,preparing,ready,on_the_way)&select=id&limit=1`);
    if (Array.isArray(live) && live.length) return json({ ok: false, error: "live_order", ar: "عندك طلب ما خلص، انتظر لين يوصلك أو ألغه أول", en: "You have an active order" }, 409);
    await rpc("sf_account_anonymize", { p_user: user.id });
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok && r.status !== 404) { console.error("delete user", r.status, (await r.text()).slice(0, 200)); return json({ ok: false, error: "delete_failed" }, 500); }
    return json({ ok: true });
  } catch (e) {
    console.error("delete-account", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
