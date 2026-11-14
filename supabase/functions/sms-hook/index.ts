// سُفرة · Supabase «Send SMS Hook» → يرسل رمز الدخول عبر Authentica (مزوّد سعودي)
// Supabase يولّد الرمز ويتحقق منه، وهذي الدالة توصّله رسالة نصية.
// الحماية: توقيع standard-webhooks بمقارنة ثابتة الزمن + ختم زمني حديث، جوال سعودي فقط،
// وحدود الإرسال عبر sf_sms_allow بفشل مغلق (بدون ok=true صريح ما نرسل).
import { hmacSha256, safeEq, saudiMobile } from "../_shared/sec.ts";

const AUTH_KEY = Deno.env.get("AUTHENTICA_API_KEY") ?? "";
const HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
const MAX_AGE_SEC = 300;

function b64decode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64(bytes: Uint8Array): string { let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); }
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (code: number, message: string) => reply(code, { error: { http_code: code, message } });

async function verify(req: Request, body: string): Promise<boolean> {
  if (!HOOK_SECRET) return false;
  const id = req.headers.get("webhook-id") ?? "", ts = req.headers.get("webhook-timestamp") ?? "", sig = req.headers.get("webhook-signature") ?? "";
  if (!id || !ts || !sig || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > MAX_AGE_SEC) return false;
  const secret = HOOK_SECRET.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  const expected = b64(await hmacSha256(b64decode(secret), `${id}.${ts}.${body}`));
  return sig.split(" ").some((p) => safeEq(p.split(",")[1] ?? "", expected));
}

// وجهة الرمز: sms.phone أولًا، وعند تغيير الجوال الرقم الجديد بس (فشل مغلق إذا الوجهة غير مؤكدة)
type HookBody = { sms?: Record<string, unknown> | null; user?: Record<string, unknown> | null } | null;
function targetPhone(p: HookBody): { raw: string; err?: string } {
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number") ? String(v).trim() : "";
  const norm = (v: string) => saudiMobile(v) || v.replace(/\D/g, "");
  const same = (a: string, b: string) => !!a && !!b && norm(a) === norm(b);
  const smsPhone = str(p?.sms?.phone), newPhone = str(p?.user?.new_phone), userPhone = str(p?.user?.phone);
  if (str(p?.sms?.sms_type) === "phone_change") {
    const to = smsPhone || newPhone;
    if (!to) return { raw: "", err: "no_target" };
    if (smsPhone && newPhone && !same(smsPhone, newPhone)) return { raw: "", err: "mismatch" };
    if (same(to, userPhone)) return { raw: "", err: "same_as_current" };
    return { raw: to };
  }
  if (smsPhone) return { raw: smsPhone };
  if (newPhone) return userPhone ? { raw: "", err: "ambiguous" } : { raw: newPhone };
  return { raw: userPhone };
}

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await verify(req, body))) return fail(401, "توقيع غير صالح");
  let rawPhone = "", otp = "", why = "";
  try { const p = JSON.parse(body); const t = targetPhone(p); rawPhone = t.raw; why = t.err ?? ""; otp = String(p?.sms?.otp ?? ""); } catch { /* */ }
  if (why) return fail(400, "تعذّر إرسال الرمز، جرّب مرة ثانية");
  if (!rawPhone || !otp) return fail(400, "بيانات ناقصة");
  const saudi = saudiMobile(rawPhone);
  if (!saudi) return fail(400, "الخدمة متاحة لأرقام الجوال السعودية فقط");
  const phone = "+" + saudi;
  let allow: { ok?: unknown; reason?: unknown } | null = null;
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/sf_sms_allow`, {
      method: "POST",
      headers: { apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_phone: saudi }),
    });
    allow = r.ok ? await r.json() : null;
  } catch { allow = null; }
  if (!allow || allow.ok !== true) return allow ? fail(429, "انتظر شوي قبل ما تطلب رمز ثاني") : fail(503, "تعذّر إرسال الرمز الحين، جرّب بعد شوي");
  if (!AUTH_KEY) return fail(503, "خدمة الرسائل غير مفعّلة");
  const r = await fetch("https://api.authentica.sa/api/v2/send-otp", {
    method: "POST",
    headers: { "X-Authorization": AUTH_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ method: "sms", phone, otp, template_id: 1 }),
  });
  const txt = await r.text();
  if (!r.ok) { console.error("Authentica send-otp فشل:", r.status, txt.replace(/\d{7,}/g, "*******")); return fail(500, "تعذّر إرسال الرمز"); }
  console.log("أُرسل رمز الدخول إلى ****" + saudi.slice(-3));
  return reply(200, {});
});
