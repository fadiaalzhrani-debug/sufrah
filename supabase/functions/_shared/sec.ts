// ============================================================
//  خافِت · أدوات أمان مشتركة بين دوال Edge
//
//  safeEq       : مقارنة ثابتة الزمن لنصّين (لا تكشف موضع أول اختلاف ولا تتوقف مبكرًا)
//  hmacSha256   : توقيع HMAC-SHA256 لنص بمفتاح (نص أو بايتات)
//  b64urlEncode / b64urlDecode : ترميز base64url المستخدم في JWT
//  hs256Verify  : تحقق من JWT بخوارزمية HS256 بمفتاح سري، مع فحص exp/nbf/iat (وexp إلزامي عند الطلب)، يرجع الحمولة أو null
//  saudiMobile  : يوحّد رقم الجوال السعودي إلى 9665xxxxxxxx أو يرجع "" لو لم يكن جوالًا سعوديًا
//  logFail      : يكتب تفاصيل الخطأ في السجل ويرجع معرّف تتبع قصير يُعاد للمتصل بدل نص الخطأ
// ============================================================

const enc = new TextEncoder();

/* مقارنة ثابتة الزمن: نمرّ على أطول النصّين دائمًا، والفرق في الطول يدخل في النتيجة بلا تفرّع */
export function safeEq(a: string, b: string): boolean {
  const x = enc.encode(String(a ?? "")), y = enc.encode(String(b ?? ""));
  if (!x.length || !y.length) return false;
  const n = Math.max(x.length, y.length);
  let d = x.length ^ y.length;
  for (let i = 0; i < n; i++) d |= (x[i % x.length] ?? 0) ^ (y[i % y.length] ?? 0);
  return d === 0;
}

export async function hmacSha256(secret: string | Uint8Array, data: string): Promise<Uint8Array> {
  const raw = typeof secret === "string" ? enc.encode(secret) : secret;
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  let t = String(s ?? "").replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* تحقق JWT (HS256): الترويسة لازم تعلن HS256، والتوقيع يُقارن بمقارنة ثابتة الزمن،
   وexp/nbf يُحترمان إن وُجدا بسماحية دقيقة. أي خلل يرجع null بلا استثناء.
   الوسيط الثالث رقم (السماحية بالثواني، كما كان) أو خيارات:
     requireExp : التوكن لازم يكون له عمر محدود: exp صالح، وإن غاب exp فـiat إلزامي ولا يكون أقدم من maxAgeSec
                  (توكن بلا exp ولا iat يُرفض، فالتوكن المتسرّب ما يبقى صالحًا للأبد)
     maxAgeSec  : أقصى عمر مقبول من iat (يُفحص متى ما وُجد iat) */
export type Hs256Opts = { leewaySec?: number; requireExp?: boolean; maxAgeSec?: number };
export async function hs256Verify(token: string, secret: string, opt: number | Hs256Opts = 60): Promise<Record<string, unknown> | null> {
  try {
    const o: Hs256Opts = typeof opt === "number" ? { leewaySec: opt } : (opt ?? {});
    const leewaySec = Number.isFinite(o.leewaySec) ? Number(o.leewaySec) : 60;
    if (!token || !secret) return null;
    const parts = String(token).trim().split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))) as Record<string, unknown>;
    if (!header || header.alg !== "HS256") return null;
    const expected = b64urlEncode(await hmacSha256(secret, `${parts[0]}.${parts[1]}`));
    if (!safeEq(expected, parts[2].replace(/=+$/, ""))) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const now = Date.now() / 1000;
    const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    if (payload.exp !== undefined && !num(payload.exp)) return null;
    if (payload.iat !== undefined && !num(payload.iat)) return null;
    if (num(payload.exp) && (payload.exp as number) + leewaySec < now) return null;
    if (typeof payload.nbf === "number" && payload.nbf - leewaySec > now) return null;
    if (num(payload.iat)) {
      if ((payload.iat as number) - leewaySec > now) return null;                                    // صادر من المستقبل
      if (o.maxAgeSec && now - (payload.iat as number) > o.maxAgeSec + leewaySec) return null;       // قديم
    }
    if (o.requireExp && !num(payload.exp) && !(num(payload.iat) && o.maxAgeSec)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* جوال سعودي بصيغة موحّدة 9665xxxxxxxx (بدون +)، أو "" لو لم يكن كذلك.
   يقبل: +9665…، 009665…، 9665…، 05…، 5… (٩ أرقام) */
export function saudiMobile(p: unknown): string {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  return /^9665\d{8}$/.test(d) ? d : "";
}

/* يسجّل التفاصيل في سجل الدالة فقط، ويرجع معرّفًا قصيرًا يُعاد للمتصل للمطابقة عند المراجعة */
export function logFail(where: string, e: unknown): string {
  const t = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  console.error(`[${t}] ${where}:`, e instanceof Error ? (e.stack ?? e.message) : String(e));
  return t;
}
