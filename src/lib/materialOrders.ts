import { daysUntil, formatDate, relativeDay } from './format';
import type { MaterialOrder } from './types';

/** From this many days before the latest order date the order shows up as due. */
const ORDER_WARNING_DAYS = 7;

export type OrderWarning = { text: string; urgent: boolean };

/**
 * What needs attention on an order: not placed in time, promised later than
 * it is needed, or not arrived on the promised day. The classic mistake is
 * ordering too late, so that material arrives after the trade that needs it.
 */
export function orderWarning(o: MaterialOrder): OrderWarning | null {
  if (o.status === 'planned' && o.orderBy && daysUntil(o.orderBy) <= ORDER_WARNING_DAYS) {
    const late = daysUntil(o.orderBy) < 0;
    return { text: late ? `hätte ${relativeDay(o.orderBy)} bestellt werden sollen` : `bestellen bis ${relativeDay(o.orderBy)}`, urgent: daysUntil(o.orderBy) <= 2 };
  }
  if (o.status === 'ordered' && o.deliveryDate && o.neededBy && o.deliveryDate > o.neededBy) {
    return { text: `kommt ${formatDate(o.deliveryDate)}, gebraucht ab ${formatDate(o.neededBy)}`, urgent: true };
  }
  if (o.status === 'ordered' && o.deliveryDate && daysUntil(o.deliveryDate) < 0) {
    return { text: `Lieferung war für ${formatDate(o.deliveryDate)} zugesagt`, urgent: true };
  }
  return null;
}
