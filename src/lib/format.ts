export type CurrencyCode = "USD" | "EUR" | "CUP" | "MXN";

const numberFormat = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto siempre con su código de moneda, para no confundir
 * dólares, pesos mexicanos y pesos cubanos (todos usan "$").
 *   USD → $1,250.00 USD   EUR → €1,250.00 EUR
 *   MXN → $1,250.00 MXN   CUP → 1,250.00 CUP
 */
export function formatAmount(value: number, currency: CurrencyCode): string {
  const n = numberFormat.format(Number(value) || 0);
  switch (currency) {
    case "USD":
      return `$${n} USD`;
    case "EUR":
      return `€${n} EUR`;
    case "MXN":
      return `$${n} MXN`;
    case "CUP":
      return `${n} CUP`;
  }
}

/** Montos distintos de cero de una orden, en el orden USD, EUR, CUP. */
export function getOrderAmounts(order: {
  usd_amount: number;
  eur_amount: number;
  cup_amount: number;
}): { currency: CurrencyCode; text: string }[] {
  const list: { currency: CurrencyCode; text: string }[] = [];
  if (order.usd_amount > 0) list.push({ currency: "USD", text: formatAmount(order.usd_amount, "USD") });
  if (order.eur_amount > 0) list.push({ currency: "EUR", text: formatAmount(order.eur_amount, "EUR") });
  if (order.cup_amount > 0) list.push({ currency: "CUP", text: formatAmount(order.cup_amount, "CUP") });
  return list;
}
