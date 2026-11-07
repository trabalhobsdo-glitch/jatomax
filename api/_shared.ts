// Funções e preços usados por todas as rotas /api.
// Arquivos que começam com "_" NÃO viram rota na Vercel.
//
// ⚠️ O preço fica no SERVIDOR: o navegador só manda "oferta" e "quantidade".
// Se mudar o preço, mude AQUI e também em checkout.js (UNIT_PRICE) e app.js (valores em centavos).

export const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "");
export const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export const OFFERS: Record<string, { title: string; unitCents: number }> = {
  jatomax: { title: "JatoMax Soprador Turbo 2.0 sem fio 1000G", unitCents: 8990 },
};

// Opções de frete (valores em centavos). Se mudar aqui, mude também SHIPPING_OPTIONS em checkout.js.
export const SHIPPING: Record<string, { name: string; cents: number }> = {
  gratis: { name: "Frete Grátis", cents: 0 },
  pago: { name: "Frete Expresso", cents: 1599 },
};

export function readOrder(body: any) {
  const { offerId, quantity, customer, address, shippingId } = body ?? {};
  const offer = Object.hasOwn(OFFERS, String(offerId)) ? OFFERS[offerId] : undefined;
  if (!offer) return { error: "Oferta inválida." } as const;

  const shippingKey = shippingId ?? "gratis";
  const shipping = Object.hasOwn(SHIPPING, shippingKey) ? SHIPPING[shippingKey] : undefined;
  if (!shipping) return { error: "Opção de frete inválida." } as const;

  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 99) return { error: "Quantidade inválida." } as const;

  const cpf = digits(customer?.cpf);
  let phone = digits(customer?.phone);
  if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
  const zip = digits(address?.cep);
  if (!customer?.name || !customer?.email || cpf.length !== 11 || phone.length < 10 || zip.length !== 8 ||
      !address?.street || !address?.number || !address?.neighborhood || !address?.city || !address?.state) {
    return { error: "Preencha todos os dados obrigatórios." } as const;
  }

  // Itens cobrados (o valor total é calculado AQUI, nunca vem do navegador)
  const items = [
    { title: offer.title, unitPrice: offer.unitCents, quantity: qty, tangible: true, externalRef: String(offerId) },
    ...(shipping.cents > 0 ? [{ title: shipping.name, unitPrice: shipping.cents, quantity: 1, tangible: false, externalRef: "frete" }] : []),
  ];
  const amount = items.reduce((t, p) => t + p.unitPrice * p.quantity, 0);
  return { offerId: String(offerId), offer, qty, cpf, phone, zip, items, amount, shippingName: shipping.name } as const;
}
