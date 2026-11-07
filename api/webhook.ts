import type { VercelRequest, VercelResponse } from "@vercel/node";

// Recebe as notificações da Unipay: { type: "transaction", objectId, data: { id, status, amount, ... } }
// Por enquanto só registra nos Logs da Vercel. O site confirma o pagamento consultando /api/pix-status.
// Se quiser liberar pedido / enviar e-mail quando o status for "paid", é aqui que entra.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  let b: any = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const d = b?.data;
  console.log("[webhook Unipay]", b?.objectId ?? d?.id, d?.status, d?.amount, d?.paymentMethod, d?.customer?.email);
  return res.status(200).json({ received: true });
}
