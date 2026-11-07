import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clean } from "./_shared.js";

// Consulta o status de um Pix na Unipay (GET /api/user/transactions/:id).
// Status normalizados em minúsculas: paid, waiting_payment, refused, canceled, expired...
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return res.status(400).json({ error: "ID inválido." });
  res.setHeader("Cache-Control", "no-store");

  const token = clean(process.env.UNIPAY_API_KEY || process.env.UNIPAY_SECRET_KEY);
  if (!token) return res.status(500).json({ error: "Pagamento não configurado." });
  const base = clean(process.env.UNIPAY_API_URL).replace(/\/+$/, "").replace(/\/api$/, "") || "https://api.unipaybr.com";
  try {
    const r = await fetch(`${base}/api/user/transactions/${id}`, {
      headers: { Authorization: `Basic ${Buffer.from(`x:${token}`).toString("base64")}` },
    });
    const json: any = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: "Não foi possível consultar o pagamento." });
    const tx = json?.data ?? json;
    return res.status(200).json({ status: String(tx?.status ?? "").toLowerCase() });
  } catch {
    return res.status(502).json({ error: "Falha ao consultar o pagamento." });
  }
}
