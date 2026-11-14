// ============================================================
//  سُفرة · التحقق من هوية المتصل، مشترك بين دوال Edge
//  isServiceBearer : التوكن هو مفتاح الخدمة (نداءات pg_net من القاعدة)
//  callerUser      : المستخدم صاحب الجلسة من توكن التطبيق
//  isAdminCaller   : المتصل مدير نشط في sf_staff
//  الدوال تُنشر بدون تحقق JWT من المنصة، فهذا الملف هو خط الدفاع
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bearerToken(req: Request): string {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  return m ? m[1].trim() : "";
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj as Record<string, unknown> : null;
  } catch { return null; }
}

export async function isServiceBearer(req: Request): Promise<boolean> {
  const tok = bearerToken(req);
  if (!tok) return false;
  if (SERVICE_KEY && tok === SERVICE_KEY) return true;
  const payload = jwtPayload(tok);
  if (!payload || payload.role !== "service_role") return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sf_secrets?select=key&limit=1`, { headers: { apikey: tok, Authorization: `Bearer ${tok}` } });
    await r.body?.cancel().catch(() => {});
    return r.status === 200;
  } catch { return false; }
}

export async function callerUser(req: Request): Promise<{ id: string; phone: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+/i.test(auth)) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: auth } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id && UUID_RE.test(String(u.id)) ? { id: String(u.id), phone: String(u.phone || "") } : null;
  } catch { return null; }
}

export async function isAdminCaller(req: Request): Promise<boolean> {
  const user = await callerUser(req);
  if (!user) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sf_staff?user_id=eq.${user.id}&role=in.(admin,support)&active=eq.true&select=id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

// طلب REST بمفتاح الخدمة
export async function db(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(15_000), ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`db ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
export async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  return await db(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
export const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });
export { UUID_RE };
