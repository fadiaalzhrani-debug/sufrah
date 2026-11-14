// ============================================================
//  خافِت — إرسال إشعارات أندرويد عبر Firebase Cloud Messaging (HTTP v1)
//  مشترك بين دالتَي push (العميل) و push-staff (الفنيين).
//
//  الأسرار المطلوبة (تُضبط بـ supabase secrets set):
//    FCM_SERVICE_ACCOUNT  — محتوى ملف حساب الخدمة JSON كاملاً (سطر واحد)
//    FCM_PROJECT_ID        — معرّف مشروع Firebase (اختياري؛ يُقرأ من الحساب)
//
//  ملاحظة: FCM HTTP v1 يتطلب توكن OAuth مُوقّعاً بمفتاح حساب الخدمة —
//  لا يوجد «server key» ثابت بعد الآن. نُوقّع JWT ونبدله بتوكن ونخزّنه ~50 د.
// ============================================================

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let _sa: ServiceAccount | null = null;
function serviceAccount(): ServiceAccount | null {
  if (_sa) return _sa;
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  try { _sa = JSON.parse(raw) as ServiceAccount; return _sa; }
  catch { return null; }
}

export function fcmProjectId(): string {
  return Deno.env.get("FCM_PROJECT_ID") ?? serviceAccount()?.project_id ?? "";
}

export function fcmReady(): boolean {
  return !!serviceAccount();
}

/* ── توقيع JWT ES/RS256 بمفتاح حساب الخدمة (PEM) ── */
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "")
                  .replace(/-----END [^-]+-----/, "")
                  .replace(/\s+/g, "");
  const bin = atob(body);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}

let _tok = "", _tokAt = 0;
async function accessToken(): Promise<string> {
  if (_tok && Date.now() - _tokAt < 50 * 60 * 1000) return _tok;
  const sa = serviceAccount();
  if (!sa) throw new Error("no_fcm_service_account");

  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims  = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" }, key,
    new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error("fcm_oauth_failed: " + JSON.stringify(j));
  _tok = j.access_token; _tokAt = Date.now();
  return _tok;
}

/* ── إرسال إشعار لجهاز أندرويد واحد ── */
export async function fcmSend(token: string, title: string, body: string, data: Record<string, string> = {}):
  Promise<{ ok: boolean; status: number; detail: string }> {
  const pid = fcmProjectId();
  if (!pid) return { ok: false, status: 500, detail: "no_project_id" };
  const at = await accessToken();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${at}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: "high", notification: { sound: "default", default_sound: true } },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  const detail = res.ok ? "" : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, detail };
}
