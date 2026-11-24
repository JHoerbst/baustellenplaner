import type { Invoice, Quote } from './types';

export type OrderStatus = {
  /** Sum of the change orders added after the quote was awarded. */
  extras: number;
  /** Quote amount plus change orders. */
  total: number;
  invoiced: number;
  paid: number;
  /** What has not been invoiced yet; negative when invoices exceed the order. */
  remaining: number;
};

/** Where an awarded quote stands: ordered, invoiced, paid, still to come. */
export function orderStatus(quote: Quote, invoices: Invoice[]): OrderStatus {
  const own = invoices.filter((i) => i.quoteId === quote.id);
  const extras = (quote.extras ?? []).reduce((n, e) => n + (e.amount ?? 0), 0);
  const total = (quote.amount ?? 0) + extras;
  const invoiced = own.reduce((n, i) => n + (i.amount ?? 0), 0);
  const paid = own.filter((i) => i.paid).reduce((n, i) => n + (i.amount ?? 0), 0);
  return { extras, total, invoiced, paid, remaining: total - invoiced };
}
