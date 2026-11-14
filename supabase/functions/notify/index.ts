// ============================================================
//  سُفرة · notify: يرسل إشعارات sf_notifications للجوالات والمتصفحات
//  POST /notify {ids:[...]}   ← من القاعدة (sf_hook بمفتاح الخدمة) بعد كل تغيير حالة طلب أو إشعار جماعي
//  POST /notify/broadcast {id} ← يرسل إشعار جماعي (يقرأ الإشعارات اللي ما انرسلت للجوال بعد)
//  القنوات: Web Push (VAPID) للمتصفح، APNs للآيفون (الأسرار APNS_*)، FCM لأندرويد (السر FCM_SERVICE_ACCOUNT)
//  الاشتراك الميت (404/410) ينحذف
// ============================================================
import { isServiceBearer, db, json, CORS } from "../_shared/auth.ts";
import { loadVapid, sendWebPush, type PushSub } from "../_shared/webpush.ts";
import { fcmReady, fcmSend } from "../_shared/fcm.ts";
import { apnsReady, apnsSend } from "../_shared/apns.ts";

const TOPIC_APP = Deno.env.get("APNS_BUNDLE_ID") ?? "sa.sufrah.app";
const TOPIC_FAMILY = Deno.env.get("APNS_BUNDLE_ID_FAMILY") ?? "sa.sufrah.family";

const VAPID_JWK = Deno.env.get("VAPID_JWK") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://fadiaalzhrani-debug.github.io/sufrah/";

type Notif = { id: number; user_id: string; title: string; body: string | null; link: string | null; kind: string | null; order_id: string | null };
type Device = { id: string; user_id: string; kind: string; token: string; ua: string | null; apns_env: string | null };

async function deliver(notifs: Notif[]): Promise<Record<string, unknown>> {
  if (!notifs.length) return { sent: 0 };
  const vapid = await loadVapid(VAPID_JWK, VAPID_SUBJECT);
  const users = [...new Set(notifs.map((n) => n.user_id))];
  const inList = users.map((u) => `"${u}"`).join(",");
  const [devices, staff] = await Promise.all([
    db(`sf_devices?user_id=in.(${inList})&select=id,user_id,kind,token,ua,apns_env`) as Promise<Device[]>,
    db(`sf_staff?user_id=in.(${inList})&active=eq.true&select=user_id,role`) as Promise<{ user_id: string; role: string }[]>,
  ]);
  const roleOf = new Map(staff.map((s) => [s.user_id, s.role]));
  let sent = 0, dead = 0, failed = 0;
  const deadIds: string[] = [], pushed: number[] = [], envFix: { id: string; env: string }[] = [];
  const jobs: Promise<void>[] = [];
  for (const n of notifs) {
    const role = roleOf.get(n.user_id) || "customer";
    const isFamily = role === "family_owner" || role === "family_staff";
    const page = n.kind === "family_order" || n.kind === "review" || (n.kind === "broadcast" && isFamily) ? "family.html"
      : (role === "admin" || role === "support") && n.kind === "admin" ? "admin.html" : "index.html";
    const payload = {
      title: n.title, body: n.body || "", url: page + (n.link || ""), tag: n.order_id ? `o-${n.order_id}` : `n-${n.id}`,
      sticky: n.kind === "family_order", lang: "ar",
    };
    const mine = devices.filter((d) => d.user_id === n.user_id);
    for (const d of mine) {
      jobs.push((async () => {
        try {
          if (d.kind === "webpush") {
            if (!vapid) return;
            const sub = JSON.parse(d.token) as PushSub;
            const st = await sendWebPush(vapid, sub, payload, n.kind === "broadcast" ? "normal" : "high");
            if (st === 404 || st === 410) { deadIds.push(d.id); dead++; }
            else if (st >= 200 && st < 300) { sent++; if (!pushed.includes(n.id)) pushed.push(n.id); }
            else failed++;
          } else if (d.kind === "apns") {
            if (!apnsReady()) return;
            // أي تطبيق؟ من بصمة الجهاز (native-ios-family) وإلا من دور المستخدم
            const topic = /family/.test(d.ua || "") || (!/customer/.test(d.ua || "") && isFamily) ? TOPIC_FAMILY : TOPIC_APP;
            const r = await apnsSend(d.token, topic, payload.title, payload.body, { url: payload.url, tag: payload.tag }, d.apns_env, payload.sticky);
            if (r.ok) { sent++; if (!pushed.includes(n.id)) pushed.push(n.id); if (d.apns_env !== r.env) envFix.push({ id: d.id, env: r.env }); }
            else if (r.dead) { deadIds.push(d.id); dead++; }
            else { failed++; console.error("apns", r.status, r.detail.slice(0, 160)); }
          } else if (d.kind === "fcm" && fcmReady()) {
            const r = await fcmSend(d.token, payload.title, payload.body, { url: payload.url, tag: payload.tag });
            if (r.status === 404 || /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(r.detail)) { deadIds.push(d.id); dead++; }
            else if (r.ok) { sent++; if (!pushed.includes(n.id)) pushed.push(n.id); } else failed++;
          }
        } catch (e) { failed++; console.error("push", d.kind, String((e as Error)?.message || e).slice(0, 160)); }
      })());
    }
  }
  // دفعات متوازية بحد معقول
  for (let i = 0; i < jobs.length; i += 25) await Promise.all(jobs.slice(i, i + 25));
  for (const f of envFix) await db(`sf_devices?id=eq.${f.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ apns_env: f.env, last_ok: new Date().toISOString() }) }).catch(() => {});
  if (deadIds.length) await db(`sf_devices?id=in.(${deadIds.map((x) => `"${x}"`).join(",")})`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
  if (pushed.length) await db(`sf_notifications?id=in.(${pushed.join(",")})`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pushed_at: new Date().toISOString() }) }).catch(() => {});
  return { notifs: notifs.length, devices: devices.length, sent, dead, failed, vapid: !!vapid, apns: apnsReady() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) return json({ ok: true, vapid: !!VAPID_JWK, fcm: fcmReady(), apns: apnsReady() });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await isServiceBearer(req))) return json({ error: "forbidden" }, 401);
  let b: any = {};
  try { b = await req.json(); } catch { /* فاضي */ }
  try {
    if (url.pathname.endsWith("/broadcast")) {
      // إشعار جماعي: كل الإشعارات الجماعية الأخيرة اللي ما انرسلت للجوال
      const rows = await db(`sf_notifications?kind=eq.broadcast&pushed_at=is.null&created_at=gt.${encodeURIComponent(new Date(Date.now() - 6 * 3600_000).toISOString())}&select=id,user_id,title,body,link,kind,order_id&limit=2000`);
      return json(await deliver(rows));
    }
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0).slice(0, 200);
    if (!ids.length) return json({ sent: 0 });
    const rows = await db(`sf_notifications?id=in.(${ids.join(",")})&select=id,user_id,title,body,link,kind,order_id`);
    return json(await deliver(rows));
  } catch (e) {
    console.error("notify", e);
    return json({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
