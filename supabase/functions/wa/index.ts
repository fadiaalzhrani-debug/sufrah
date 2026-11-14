// ============================================================
//  سُفرة · wa: بوت واتساب (نفس فكرة بوت خافت بنسخة مختصرة للأكل)
//  الاستقبال:  GET  /wa              تحقق ميتا (hub.challenge) بالرمز WA_VERIFY_TOKEN أو المسار السري
//              POST /wa/{WA_DUALHOOK_PATH}  رسائل واتساب عبر Dualhook (Coexistence)، أو POST /wa بتوقيع ميتا WA_APP_SECRET
//  الإرسال:    POST /wa/notify {type, order_id}  من القاعدة: تنبيه الأسرة بطلب جديد، وحالة الطلب للعميل داخل نافذة 24 ساعة
//  السلوك: ترحيب مرة كل wa_welcome_days برابط التطبيق، «طلبي» يرد بحالة آخر طلب، «انضم» يرد برابط تسجيل الأسر،
//          وبعدها ساكت. رد يدوي من رقم سُفرة يسكّت البوت مع العميل wa_pause_hours ساعة.
//  الأسرار: WA_DUALHOOK_KEY + WA_PHONE_ID + WA_DUALHOOK_PATH، أو WA_TOKEN + WA_PHONE_ID + WA_APP_SECRET (ميتا مباشرة)، و WA_VERIFY_TOKEN
//  المفتاح الرئيسي: sf_settings.wa_enabled
// ============================================================
import { isServiceBearer, db, json } from "../_shared/auth.ts";
import { safeEq, saudiMobile } from "../_shared/sec.ts";

const DH_KEY = Deno.env.get("WA_DUALHOOK_KEY") ?? "";
const DH_PATH = Deno.env.get("WA_DUALHOOK_PATH") ?? "";
const WA_TOKEN = Deno.env.get("WA_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WA_PHONE_ID") ?? "";
const APP_SECRET = Deno.env.get("WA_APP_SECRET") ?? "";
const VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN") ?? "";
const SEND_URL = DH_KEY ? `https://api.dualhook.com/v25.0/${WA_PHONE_ID}/messages` : `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;
const SEND_AUTH = { authorization: `Bearer ${DH_KEY || WA_TOKEN}` };
const CONNECTED = !!WA_PHONE_ID && !!(DH_KEY || WA_TOKEN);

type Settings = Record<string, string>;
let setCache: { at: number; s: Settings } | null = null;
async function settings(): Promise<Settings> {
  if (setCache && Date.now() - setCache.at < 60_000) return setCache.s;
  const rows = await db("sf_settings?select=key,value");
  const s = Object.fromEntries((rows as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  setCache = { at: Date.now(), s };
  return s;
}
const on = (v?: string) => !!v && !/^(0|false|off|no)$/i.test(v.trim());
const num = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) ? n : d; };

async function hmacHex(secret: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let lastErr = "";
async function send(to: string, payload: Record<string, unknown>): Promise<string> {
  lastErr = "";
  if (!CONNECTED) { lastErr = "not_connected"; return ""; }
  const r = await fetch(SEND_URL, { method: "POST", headers: { ...SEND_AUTH, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }), signal: AbortSignal.timeout(25_000) }).catch((e) => { lastErr = String(e); return null; });
  if (!r) return "";
  if (!r.ok) { lastErr = `${r.status} ${(await r.text()).slice(0, 200)}`; return ""; }
  const j = await r.json().catch(() => ({}));
  return String(j?.messages?.[0]?.id || "ok");
}
const text = (body: string) => ({ type: "text", text: { body, preview_url: true } });
const cta = (body: string, label: string, url: string, footer = "") => ({
  type: "interactive", interactive: { type: "cta_url", body: { text: body }, ...(footer ? { footer: { text: footer } } : {}), action: { name: "cta_url", parameters: { display_text: label, url } } },
});

// نافذة الرد المجانية: العميل راسلنا خلال آخر 23.5 ساعة
async function inWindow(phone9: string): Promise<boolean> {
  const since = new Date(Date.now() - 23.5 * 3600_000).toISOString();
  const r = await db(`sf_wa_log?select=id&phone9=eq.${phone9}&kind=not.in.(notify,echo)&created_at=gt.${encodeURIComponent(since)}&limit=1`).catch(() => []);
  return Array.isArray(r) && r.length > 0;
}

const STATUS_AR: Record<string, string> = { pending_payment: "بانتظار الدفع", new: "بانتظار قبول الأسرة", preparing: "يتجهز", ready: "جاهز", on_the_way: "في الطريق لك", delivered: "وصلك", picked_up: "استلمته", cancelled: "ملغي", rejected: "اعتذرت الأسرة" };

async function handle(msg: any, name: string): Promise<void> {
  const from = saudiMobile(msg.from);
  if (!from || !msg.id) return;
  const phone9 = from.slice(-9);
  const kind = String(msg.type || "text");
  const body = String(msg.text?.body || msg.interactive?.button_reply?.title || msg.button?.text || "").slice(0, 500);
  const ins = await db("sf_wa_log?on_conflict=msg_id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ msg_id: String(msg.id), phone9, wa_name: name.slice(0, 80) || null, kind, body: body || null }) });
  if (!ins?.length) return;                         // تكرار من ميتا
  const rowId = ins[0].id;
  const done = (p: Record<string, unknown>) => db(`sf_wa_log?id=eq.${rowId}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(p) }).catch(() => {});
  if (msg.timestamp && Date.now() / 1000 - Number(msg.timestamp) > 900) return void (await done({ intent: "late" }));
  const s = await settings();
  if (!on(s.wa_enabled) || !CONNECTED) return void (await done({ intent: "off" }));
  const paused = await db(`sf_wa_pause?select=until&phone9=eq.${phone9}&until=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`).catch(() => []);
  if (paused?.length) return void (await done({ intent: "paused" }));
  // حد الردود: 6 بالساعة للرقم
  const recent = await db(`sf_wa_log?select=id&phone9=eq.${phone9}&reply=not.is.null&created_at=gt.${encodeURIComponent(new Date(Date.now() - 3600_000).toISOString())}&limit=7`).catch(() => []);
  if (recent.length >= 6) return void (await done({ intent: "limit" }));
  const app = (s.app_url || "https://fadiaalzhrani-debug.github.io/sufrah/").replace(/\/?$/, "/");
  const t = body.replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").toLowerCase();
  let intent = "", reply = "", payload: Record<string, unknown> | null = null;
  if (/طلب(ي|ى)|وين الطلب|حاله? الطلب|متى يوصل|وصل الطلب/.test(t)) {
    const rows = await db(`sf_orders?customer_phone=eq.${from}&select=id,order_no,status,fulfillment,ready_eta,scheduled_for,family:sf_families(name_ar)&order=created_at.desc&limit=1`).catch(() => []);
    const o = rows?.[0];
    intent = "status";
    if (o) {
      reply = `طلب رقم ${o.order_no} من ${o.family?.name_ar || "الأسرة"}: ${STATUS_AR[o.status] || o.status}.`;
      payload = cta(reply + "\nتابع تفاصيله من التطبيق:", "تابع طلبك", `${app}index.html?order=${o.id}`);
    } else {
      reply = "ما لقينا طلب على رقمك. تقدر تطلب من أسر الشرقية من هنا:";
      payload = cta(reply, "اطلب الحين", `${app}index.html`);
    }
  } else if (/انضم|اسره منتجه|اسرة منتجة|ابي ابيع|بيع اكلي|تسجيل اسره|تسجيل اسرة/.test(t)) {
    intent = "join";
    reply = "حياك في سُفرة. سجّل مطبخك من هنا، ونتواصل معك خلال يومين:";
    payload = cta(reply, "سجّل مطبخك", `${app}join.html`);
  } else {
    const days = Math.max(1, num(s.wa_welcome_days, 30));
    const w = await db(`sf_wa_welcomed?select=at&phone9=eq.${phone9}&at=gt.${encodeURIComponent(new Date(Date.now() - days * 86400_000).toISOString())}&limit=1`).catch(() => []);
    if (w?.length) return void (await done({ intent: "welcomed" }));
    intent = "welcome";
    reply = `أهلًا بك في سُفرة\n${s.tagline_ar || "أكل بيت من الأسر المنتجة"}، يوصلك لين بابك أو تستلمه من المطبخ.\nاكتب «طلبي» لحالة طلبك.`;
    payload = cta(reply, "اطلب الحين", `${app}index.html?src=wa`, "سُفرة · الخبر والدمام والظهران");
    await db("sf_wa_welcomed?on_conflict=phone9", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ phone9, at: new Date().toISOString() }) }).catch(() => {});
  }
  let oid = payload ? await send(from, payload) : "";
  if (!oid && payload) oid = await send(from, text(reply + "\n" + (payload as any).interactive?.action?.parameters?.url));
  await done({ intent, reply: oid ? reply.slice(0, 1000) : null, out_id: oid || null, err: oid ? null : lastErr.slice(0, 300) });
}

// رد يدوي من رقم سُفرة: البوت يسكت مع هالعميل
async function pauseFor(e: any): Promise<void> {
  const to = saudiMobile(e?.to);
  if (!to || e?.type === "interactive") return;
  const s = await settings();
  const hours = Math.max(0, num(s.wa_pause_hours, 6));
  if (!hours) return;
  await db("sf_wa_pause?on_conflict=phone9", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ phone9: to.slice(-9), until: new Date(Date.now() + hours * 3600_000).toISOString(), updated_at: new Date().toISOString() }) });
}

async function notify(b: { type?: string; order_id?: string }): Promise<Record<string, unknown>> {
  const s = await settings();
  if (!on(s.wa_enabled) || !CONNECTED) return { skip: "off" };
  const id = String(b.order_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { skip: "bad" };
  const o = (await db(`sf_orders?id=eq.${id}&select=id,order_no,status,family_id,customer_phone,total,pay_method,fulfillment,scheduled_for,items,ready_eta,family:sf_families(name_ar)`))?.[0];
  if (!o) return { skip: "missing" };
  const app = (s.app_url || "").replace(/\/?$/, "/");
  if (b.type === "family_order") {
    const fp = (await db(`sf_family_private?family_id=eq.${o.family_id}&select=whatsapp,phone`))?.[0];
    const to = saudiMobile(fp?.whatsapp || fp?.phone);
    if (!to) return { skip: "no_family_phone" };
    const key = `notify:family:${o.id}`;
    const ins = await db("sf_wa_log?on_conflict=msg_id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ msg_id: key, phone9: to.slice(-9), kind: "notify", intent: "family_order" }) });
    if (!ins?.length) return { skip: "dup" };
    const lines = `طلب جديد رقم ${o.order_no} · ${(o.items || []).length} أصناف · ${o.total} ريال${o.pay_method === "cod" ? " · كاش" : ""}`;
    let oid = "";
    if (await inWindow(to.slice(-9))) oid = await send(to, cta(lines + "\nافتح الطلب واقبله:", "افتح الطلب", `${app}family.html?order=${o.id}`));
    else if (s.wa_tpl_family_order) oid = await send(to, { type: "template", template: { name: s.wa_tpl_family_order, language: { code: s.wa_tpl_lang || "ar" },
      components: [{ type: "body", parameters: [{ type: "text", text: String(o.order_no) }, { type: "text", text: String(o.total) }] }] } });
    await db(`sf_wa_log?id=eq.${ins[0].id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ reply: oid ? lines : null, out_id: oid || null, err: oid ? null : (lastErr || "window_closed_no_template").slice(0, 300) }) });
    return { sent: !!oid };
  }
  if (b.type === "customer_status") {
    const to = saudiMobile(o.customer_phone);
    if (!to || !(await inWindow(to.slice(-9)))) return { skip: "window" };
    const msg = `طلبك رقم ${o.order_no} من ${o.family?.name_ar || "الأسرة"}: ${STATUS_AR[o.status] || o.status}`;
    const key = `notify:cust:${o.id}:${o.status}`;
    const ins = await db("sf_wa_log?on_conflict=msg_id", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ msg_id: key, phone9: to.slice(-9), kind: "notify", intent: "customer_status" }) });
    if (!ins?.length) return { skip: "dup" };
    const oid = await send(to, cta(msg, "تابع طلبك", `${app}index.html?order=${o.id}`));
    await db(`sf_wa_log?id=eq.${ins[0].id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ reply: oid ? msg : null, out_id: oid || null, err: oid ? null : lastErr.slice(0, 300) }) });
    return { sent: !!oid };
  }
  return { skip: "type" };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const last = url.pathname.split("/").filter(Boolean).pop() || "";
  const dhPath = DH_PATH.length >= 24 && safeEq(last, DH_PATH);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && (dhPath || (VERIFY_TOKEN && safeEq(url.searchParams.get("hub.verify_token") || "", VERIFY_TOKEN)));
    return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = await req.text();
  if (url.pathname.endsWith("/notify")) {
    if (!(await isServiceBearer(req))) return json({ error: "forbidden" }, 401);
    let b = {}; try { b = JSON.parse(raw || "{}"); } catch { /* */ }
    return json(await notify(b).catch((e) => ({ error: String((e as Error)?.message || e).slice(0, 200) })));
  }
  const sig = req.headers.get("x-hub-signature-256") || "";
  const trusted = dhPath || (!!APP_SECRET && sig.startsWith("sha256=") && safeEq(sig.slice(7), await hmacHex(APP_SECRET, raw)));
  if (!trusted) return new Response("bad signature", { status: 401 });
  const job = (async () => {
    try {
      const body = JSON.parse(raw);
      for (const entry of body.entry || []) for (const ch of entry.changes || []) {
        const v = ch.value || {};
        if (WA_PHONE_ID && v.metadata?.phone_number_id && String(v.metadata.phone_number_id) !== WA_PHONE_ID) continue;
        if (ch.field === "smb_message_echoes" || ch.field === "message_echoes") { for (const e of v.message_echoes || []) await pauseFor(e).catch(() => {}); continue; }
        for (const st of v.statuses || []) {
          const id = String(st?.id || ""), status = String(st?.status || "");
          if (id && ["delivered", "read", "failed"].includes(status)) await db(`sf_wa_log?out_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status }) }).catch(() => {});
        }
        const names: Record<string, string> = {};
        for (const c of v.contacts || []) names[c.wa_id] = c.profile?.name || "";
        for (const m of v.messages || []) await handle(m, names[m.from] || "").catch((e) => console.error("handle", e));
      }
    } catch (e) { console.error("webhook", e); }
  })();
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(job); else await job;
  return new Response("ok", { status: 200 });
});
