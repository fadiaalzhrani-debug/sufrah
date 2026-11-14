// ============================================================
//  سُفرة · إشعارات المتصفح (Web Push) بدون مكتبات: VAPID (RFC 8292) + تشفير aes128gcm (RFC 8291 / 8188)
//  المفتاح الخاص VAPID بصيغة JWK في السر VAPID_JWK، والعام يُشتق منه ويُعرض في الإعدادات vapid_public
// ============================================================

const te = new TextEncoder();

export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: (Uint8Array | number[])[]): Uint8Array {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

// تشفير الحمولة لاشتراك واحد (سجل واحد، rs = 4096)
export async function encryptPayload(sub: PushSub, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPub = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  if (uaPub.length !== 65 || authSecret.length < 16) throw new Error("bad_subscription_keys");
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  // RFC 8291: IKM من سر الاشتراك ومفتاحي الطرفين
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = (await hmac(prkKey, concat(te.encode("WebPush: info\0"), uaPub, asPub, [1]))).slice(0, 32);
  // RFC 8188: مفتاح المحتوى والـ nonce من ملح عشوائي
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(te.encode("Content-Encoding: aes128gcm\0"), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode("Content-Encoding: nonce\0"), [1]))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, [2])));
  const header = new Uint8Array(16 + 4 + 1 + asPub.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPub.length;
  header.set(asPub, 21);
  return concat(header, ct);
}

// مفاتيح VAPID: الخاص JWK، والعام الخام (0x04||x||y) بصيغة base64url
export type Vapid = { jwk: JsonWebKey; publicB64: string; subject: string; key: CryptoKey };
export async function loadVapid(jwkJson: string, subject: string): Promise<Vapid | null> {
  if (!jwkJson) return null;
  try {
    const jwk = JSON.parse(jwkJson) as JsonWebKey;
    const key = await crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["sign"], ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const pub = concat([4], unb64u(String(jwk.x)), unb64u(String(jwk.y)));
    return { jwk, publicB64: b64u(pub), subject, key };
  } catch { return null; }
}
const jwtCache = new Map<string, { jwt: string; exp: number }>();
export async function vapidJwt(v: Vapid, audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hit = jwtCache.get(audience);
  if (hit && hit.exp - now > 3600) return hit.jwt;
  const exp = now + 12 * 3600;
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud: audience, exp, sub: v.subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, te.encode(`${head}.${body}`)));
  const jwt = `${head}.${body}.${b64u(sig)}`;
  jwtCache.set(audience, { jwt, exp });
  return jwt;
}

// إرسال إشعار واحد. يرجع رمز الحالة (201 نجاح، 404/410 الاشتراك ميت)
export async function sendWebPush(v: Vapid, sub: PushSub, payload: unknown, urgency = "high"): Promise<number> {
  const body = await encryptPayload(sub, te.encode(JSON.stringify(payload)));
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(v, aud);
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: urgency, Authorization: `vapid t=${jwt}, k=${v.publicB64}` },
    body, signal: AbortSignal.timeout(10_000),
  });
  await r.body?.cancel().catch(() => {});
  return r.status;
}
