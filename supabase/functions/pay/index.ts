// ============================================================
//  سُفرة · pay: الدفع بالبطاقة عبر ميسر (مدى، فيزا، ماستركارد، أبل باي) بصفحة الدفع المستضافة (Invoices API)
//  POST /pay/create {order_id}   ← العميل بتوكنه: يرجع {url} لصفحة الدفع، أو {mode:'off'} لو الدفع بالبطاقة مقفل
//  GET  /pay/status?order=<id>   ← العميل بعد الرجوع: يتأكد من ميسر ويثبّت الدفع
//  POST /pay/webhook             ← إشعار ميسر (secret_token = MOYASAR_WEBHOOK_TOKEN)
//  POST /pay/sweep               ← القاعدة كل 3 دقايق: تثبيت الدفعات المعلّقة واسترجاع الطلبات الملغية المدفوعة
//  الأسرار: MOYASAR_SECRET_KEY (sk_live_ أو sk_test_)، MOYASAR_WEBHOOK_TOKEN، PAY_RETURN_URL (صفحة التطبيق)
//  المبلغ دايمًا من القاعدة (total للطلب)، والتثبيت بس لو ميسر يقول مدفوع وبالمبلغ والعملة نفسها
// ============================================================
import { isServiceBearer, callerUser, db, json, CORS, UUID_RE } from "../_shared/auth.ts";
import { safeEq } from "../_shared/sec.ts";

const MOYASAR_API = "https://api.moyasar.com/v1";
const MOYASAR_KEY = Deno.env.get("MOYASAR_SECRET_KEY") ?? "";
const WEBHOOK_TOKEN = Deno.env.get("MOYASAR_WEBHOOK_TOKEN") ?? "";
const RETURN_URL = Deno.env.get("PAY_RETURN_URL") ?? "https://fadiaalzhrani-debug.github.io/sufrah/index.html";
const auth = () => "Basic " + btoa(MOYASAR_KEY + ":");

type Order = { id: string; order_no: number; user_id: string | null; status: string; pay_method: string; pay_status: string; total: number; paid_amount: number; customer_name: string | null; created_at: string };
type Pay = { id: string; order_id: string; provider_id: string | null; amount: number; status: string; refunded_amount: number; raw: Record<string, unknown> | null };

async function cardOn(): Promise<boolean> {
  if (!MOYASAR_KEY) return false;
  const r = await db(`sf_settings?key=eq.pay_card_enabled&select=value`).catch(() => []);
  const v = String(r?.[0]?.value ?? "0").trim().toLowerCase();
  return !["0", "false", "off", "no", ""].includes(v);
}

async function moyasarInvoice(invId: string): Promise<{ paid: boolean; pay?: any; inv?: any }> {
  const r = await fetch(`${MOYASAR_API}/invoices/${encodeURIComponent(invId)}`, { headers: { Authorization: auth() }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return { paid: false };
  const inv = await r.json();
  const pays = Array.isArray(inv?.payments) ? inv.payments : [];
  const pay = pays.find((p: any) => p.status === "paid" || p.status === "captured");
  return { paid: inv?.status === "paid" && !!pay, pay, inv };
}

// تثبيت الدفع على الطلب: الطلب ينتقل من pending_payment إلى new (يوصل للأسرة) أو، لو انلغى بالانتظار، يصير للاسترجاع
async function settle(p: Pay): Promise<{ paid: boolean; status?: string }> {
  if (!p.provider_id) return { paid: false };
  const r = await moyasarInvoice(p.provider_id);
  if (!r.paid || !r.pay) return { paid: false };
  const amount = Math.round(Number(r.pay.amount)) / 100;
  if (String(r.pay.currency || "SAR").toUpperCase() !== "SAR" || Math.abs(amount - Number(p.amount)) > 0.01) {
    console.error("amount mismatch", p.id, amount, p.amount);
    return { paid: false };
  }
  const src = String(r.pay.source?.company || r.pay.source?.type || "card");
  await db(`sf_payments?id=eq.${p.id}&status=eq.initiated`, { method: "PATCH", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), method: src, raw: { invoice: r.inv?.id, payment: r.pay.id, source: src } }) });
  const o = ((await db(`sf_orders?id=eq.${p.order_id}&select=id,status,pay_status,total`)) as Order[])[0];
  if (!o) return { paid: true };
  if (o.status === "pending_payment") {
    await db(`sf_orders?id=eq.${o.id}&status=eq.pending_payment`, { method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ pay_status: "paid", paid_amount: amount, status: "new", status_at: new Date().toISOString() }) });
    await db("sf_order_events", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ order_id: o.id, status: "paid", by_role: "system", note: src }) }).catch(() => {});
    return { paid: true, status: "new" };
  }
  if ((o.status === "cancelled" || o.status === "rejected") && o.pay_status !== "refunded") {
    // انلغى (انتهت مهلة الدفع) ودفع بعدها: نرجع له المبلغ
    await db(`sf_orders?id=eq.${o.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pay_status: "refund_pending", paid_amount: amount }) });
    return { paid: true, status: o.status };
  }
  if (o.pay_status !== "paid") await db(`sf_orders?id=eq.${o.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pay_status: "paid", paid_amount: amount }) });
  return { paid: true, status: o.status };
}

async function refund(p: Pay): Promise<boolean> {
  if (!MOYASAR_KEY || !p.provider_id) return false;
  const r = await moyasarInvoice(p.provider_id);
  const pid = r.pay?.id;
  if (!pid) return false;
  const res = await fetch(`${MOYASAR_API}/payments/${encodeURIComponent(pid)}/refund`, { method: "POST", headers: { Authorization: auth(), "Content-Type": "application/json" }, body: "{}" });
  const body = await res.json().catch(() => ({}));
  let ok = res.ok && (body?.status === "refunded" || Number(body?.refunded) > 0);
  if (!ok) {
    const g = await fetch(`${MOYASAR_API}/payments/${encodeURIComponent(pid)}`, { headers: { Authorization: auth() } });
    const gb = await g.json().catch(() => ({}));
    ok = g.ok && Number(gb?.refunded) >= Number(gb?.amount) - 1;
  }
  if (!ok) { console.error("refund failed", p.id, JSON.stringify(body).slice(0, 200)); return false; }
  await db(`sf_payments?id=eq.${p.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "refunded", refunded_amount: p.amount }) });
  await db(`sf_orders?id=eq.${p.order_id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pay_status: "refunded", refunded_amount: p.amount }) });
  await db("sf_order_events", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ order_id: p.order_id, status: "refunded", by_role: "system" }) }).catch(() => {});
  return true;
}

async function create(req: Request): Promise<Response> {
  const user = await callerUser(req);
  if (!user) return json({ ok: false, error: "login" }, 401);
  const b = await req.json().catch(() => ({}));
  const id = String(b.order_id || "");
  if (!UUID_RE.test(id)) return json({ ok: false, error: "bad_order" }, 400);
  if (!(await cardOn())) return json({ ok: false, mode: "off" });
  const o = ((await db(`sf_orders?id=eq.${id}&select=id,order_no,user_id,status,pay_method,pay_status,total,paid_amount,customer_name,created_at`)) as Order[])[0];
  if (!o || o.user_id !== user.id) return json({ ok: false, error: "not_found" }, 404);
  if (o.status !== "pending_payment" || o.pay_method !== "card") return json({ ok: false, error: "state", status: o.status }, 409);
  if (!(Number(o.total) > 0)) return json({ ok: false, error: "amount" }, 400);
  // فاتورة سابقة ما زالت صالحة لنفس المبلغ: نرجعها بدل ما نسوي ثانية
  const prev = ((await db(`sf_payments?order_id=eq.${id}&status=eq.initiated&provider=eq.moyasar&order=created_at.desc&limit=1&select=id,order_id,provider_id,amount,status,refunded_amount,raw,pay_url`)) as (Pay & { pay_url: string })[])[0];
  if (prev && prev.pay_url && Math.abs(Number(prev.amount) - Number(o.total)) < 0.01) {
    const st = await settle(prev);
    if (st.paid) return json({ ok: true, paid: true });
    return json({ ok: true, url: prev.pay_url });
  }
  const rows = await db("sf_payments", { method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ order_id: id, user_id: user.id, provider: "moyasar", amount: o.total, status: "initiated" }) }) as Pay[];
  const payId = rows[0].id;
  const back = `${RETURN_URL}?order=${id}&paid=1`;
  const inv = await fetch(`${MOYASAR_API}/invoices`, {
    method: "POST", headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(Number(o.total) * 100), currency: "SAR", description: `طلب سُفرة رقم ${o.order_no}`,
      callback_url: back, success_url: back, back_url: `${RETURN_URL}?order=${id}`, metadata: { payment_id: payId, order_id: id, order_no: String(o.order_no) } }),
    signal: AbortSignal.timeout(20_000),
  });
  const ib = await inv.json().catch(() => ({}));
  if (!inv.ok || !ib?.url) {
    await db(`sf_payments?id=eq.${payId}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", raw: { status: inv.status, type: ib?.type, message: ib?.message } }) });
    console.error("moyasar invoice", inv.status, JSON.stringify(ib).slice(0, 300));
    return json({ ok: false, error: "provider" }, 502);
  }
  await db(`sf_payments?id=eq.${payId}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ provider_id: String(ib.id), pay_url: ib.url }) });
  await db(`sf_orders?id=eq.${id}&pay_status=eq.unpaid`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pay_status: "pending" }) });
  return json({ ok: true, url: ib.url });
}

async function status(req: Request, url: URL): Promise<Response> {
  const user = await callerUser(req);
  const id = String(url.searchParams.get("order") || "");
  if (!user || !UUID_RE.test(id)) return json({ ok: false }, 400);
  const o = ((await db(`sf_orders?id=eq.${id}&select=id,user_id,status,pay_status`)) as Order[])[0];
  if (!o || o.user_id !== user.id) return json({ ok: false }, 404);
  if (MOYASAR_KEY && (o.pay_status === "pending" || o.pay_status === "unpaid")) {
    const ps = (await db(`sf_payments?order_id=eq.${id}&status=eq.initiated&select=id,order_id,provider_id,amount,status,refunded_amount,raw`)) as Pay[];
    for (const p of ps) { const r = await settle(p); if (r.paid) break; }
  }
  const fresh = ((await db(`sf_orders?id=eq.${id}&select=status,pay_status,paid_amount`)) as Order[])[0];
  return json({ ok: true, ...fresh });
}

async function webhook(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  if (!WEBHOOK_TOKEN) return json({ ok: false, error: "webhook_not_configured" }, 401);
  if (!safeEq(String(body?.secret_token ?? req.headers.get("x-moyasar-token") ?? ""), WEBHOOK_TOKEN)) return json({ ok: false, error: "bad_token" }, 401);
  const data = body?.data ?? body;
  const invId = String(data?.invoice_id ?? data?.id ?? "");
  const payId = String(data?.metadata?.payment_id ?? "");
  let p: Pay | undefined;
  if (UUID_RE.test(payId)) p = ((await db(`sf_payments?id=eq.${payId}&select=id,order_id,provider_id,amount,status,refunded_amount,raw`)) as Pay[])[0];
  if (!p && invId) p = ((await db(`sf_payments?provider_id=eq.${encodeURIComponent(invId)}&select=id,order_id,provider_id,amount,status,refunded_amount,raw`)) as Pay[])[0];
  if (!p) return json({ ok: true, skipped: "unknown" });
  if (p.status !== "initiated") return json({ ok: true, dup: true });
  return json({ ok: true, ...(await settle(p)) });
}

async function sweep(): Promise<Response> {
  if (!MOYASAR_KEY) return json({ ok: true, skipped: "no_key" });
  const out: Record<string, number> = { settled: 0, refunded: 0 };
  // دفعات معلّقة عمرها أقل من يوم
  const pend = (await db(`sf_payments?status=eq.initiated&provider=eq.moyasar&provider_id=not.is.null&created_at=gt.${encodeURIComponent(new Date(Date.now() - 86400_000).toISOString())}&select=id,order_id,provider_id,amount,status,refunded_amount,raw&limit=30`)) as Pay[];
  for (const p of pend) { const r = await settle(p).catch(() => ({ paid: false })); if (r.paid) out.settled++; }
  // طلبات ملغية مدفوعة: نسترجع
  const toRefund = (await db(`sf_orders?pay_status=eq.refund_pending&select=id&limit=20`)) as { id: string }[];
  for (const o of toRefund) {
    const p = ((await db(`sf_payments?order_id=eq.${o.id}&status=eq.paid&provider=eq.moyasar&select=id,order_id,provider_id,amount,status,refunded_amount,raw&limit=1`)) as Pay[])[0];
    if (p && await refund(p).catch(() => false)) out.refunded++;
  }
  return json({ ok: true, ...out });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  try {
    if (path.endsWith("/webhook")) return await webhook(req);
    if (path.endsWith("/create")) return await create(req);
    if (path.endsWith("/status")) return await status(req, url);
    if (path.endsWith("/mode")) return json({ card: await cardOn(), live: MOYASAR_KEY.startsWith("sk_live_") });
    if (path.endsWith("/sweep")) { if (!(await isServiceBearer(req))) return json({ error: "forbidden" }, 401); return await sweep(); }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("pay", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
