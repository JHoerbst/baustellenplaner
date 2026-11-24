import { orderStatus } from './orders';
import type { Invoice, MaterialOrder, Project, Quote, Trade } from './types';

export type Budget = {
  /** Total money available for the project; null when none has been set. */
  budget: number | null;
  /** Part of the budget held back for surprises. */
  reserve: number;
  /** All invoices, paid or not. */
  spent: number;
  /** Awarded quotes: what has been ordered but not invoiced yet. */
  openOrders: number;
  /** Material orders that have not been delivered (the invoice follows on delivery). */
  pendingOrders: number;
  /** Trades without an award: the cheapest quote still in the running. */
  expected: number;
  /** Trades without an award that have no priced quote either. */
  unpriced: string[];
  /** spent + openOrders + pendingOrders: money that is certain to go. */
  committed: number;
  /** committed + expected. */
  forecast: number;
  /** 'reserve' = the forecast eats into the reserve, 'over' = it exceeds the budget. */
  level: 'ok' | 'reserve' | 'over' | null;
};

/**
 * One budget for the whole project rather than one per trade. The forecast
 * counts what is certain (invoices, open orders, pending deliveries) and
 * what is likely (the cheapest quote of every trade not awarded yet).
 */
export function computeBudget(input: {
  project: Project | null;
  quotes: Quote[];
  invoices: Invoice[];
  materialOrders: MaterialOrder[];
  trades: Trade[];
}): Budget {
  const { project, quotes, invoices, materialOrders, trades } = input;
  const sum = (numbers: (number | null | undefined)[]) => numbers.reduce<number>((n, x) => n + (x ?? 0), 0);

  const awarded = quotes.filter((q) => q.status === 'awarded');
  const spent = sum(invoices.map((i) => i.amount));
  const openOrders = sum(awarded.map((q) => Math.max(0, orderStatus(q, invoices).remaining)));
  const pendingOrders = sum(materialOrders.filter((o) => o.status !== 'delivered').map((o) => o.amount));

  let expected = 0;
  const unpriced: string[] = [];
  for (const trade of trades) {
    if (trade.selfPerformed || awarded.some((q) => q.tradeId === trade.id)) continue;
    const prices = quotes
      .filter((q) => q.tradeId === trade.id && q.status !== 'rejected' && q.amount != null)
      .map((q) => q.amount!);
    if (prices.length) expected += Math.min(...prices);
    else unpriced.push(trade.name);
  }

  const budget = project?.budget ?? null;
  const reserve = project?.reserve ?? 0;
  const committed = spent + openOrders + pendingOrders;
  const forecast = committed + expected;
  const level = budget == null ? null : forecast > budget ? 'over' : forecast > budget - reserve ? 'reserve' : 'ok';

  return { budget, reserve, spent, openOrders, pendingOrders, expected, unpriced, committed, forecast, level };
}
