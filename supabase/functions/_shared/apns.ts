// ============================================================
//  سُفرة · إرسال إشعارات آيفون مباشرة عبر APNs (بدون Firebase)
//  الأسرار: APNS_KEY_ID، APNS_TEAM_ID، APNS_KEY_JWK (المفتاح بصيغة JWK)
//  المفتاح على مستوى فريق آبل، والموضوع (topic) هو معرّف التطبيق:
//    sa.sufrah.app (العملاء) أو sa.sufrah.family (الأسر)
//  آبل عندها بيئتان: production للمتجر و sandbox للتجارب؛ نجرّب ونحفظ النتيجة
// ============================================================
const KEY_ID = Deno.env.get("APNS_KEY_ID") ?? "";
const TEAM_ID = Deno.env.get("APNS_TEAM_ID") ?? "";
const KEY_JWK = Deno.env.get("APNS_KEY_JWK") ?? "";
export const PROD = "https://api.push.apple.com";
export const SAND = "https://api.sandbox.push.apple.com";

export function apnsReady(): boolean { return !!(KEY_ID && TEAM_ID && KEY_JWK); }

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let _tok = "", _at = 0;
async function apnsJwt(): Promise<string> {
  if (_tok && Date.now() - _at < 50 * 60 * 1000) return _tok;
  const key = await crypto.subtle.importKey("jwk", JSON.parse(KEY_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`));
  _tok = `${header}.${payload}.${b64url(new Uint8Array(sig))}`; _at = Date.now();
  return _tok;
}

async function post(host: string, token: string, topic: string, title: string, body: string, data: Record<string, string>, sticky: boolean) {
  const jwt = await apnsJwt();
  const res = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: { authorization: `bearer ${jwt}`, "apns-topic": topic, "apns-push-type": "alert", "apns-priority": "10", ...(sticky ? { "apns-collapse-id": data.tag || "" } : {}) },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: "default", badge: 1, ...(sticky ? { "interruption-level": "time-sensitive" } : {}) }, ...data }),
  });
  const detail = res.ok ? "" : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, detail };
}

/** يرسل للبيئة المحفوظة أولًا، ولو كانت غلط يجرّب الثانية. يرجّع env المستخدمة لو نجح. */
export async function apnsSend(token: string, topic: string, title: string, body: string, data: Record<string, string> = {}, env?: string | null, sticky = false):
  Promise<{ ok: boolean; status: number; detail: string; env: string; dead: boolean }> {
  const first = env === "sandbox" ? SAND : PROD, second = first === PROD ? SAND : PROD;
  let r = await post(first, token, topic, title, body, data, sticky); let used = first;
  if (!r.ok && /BadEnvironmentKeyInToken|BadDeviceToken/.test(r.detail)) { r = await post(second, token, topic, title, body, data, sticky); used = second; }
  const dead = !r.ok && (r.status === 410 || /Unregistered|BadDeviceToken|DeviceTokenNotForTopic/.test(r.detail));
  return { ...r, env: used === SAND ? "sandbox" : "production", dead };
}
