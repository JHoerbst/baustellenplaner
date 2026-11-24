import { daysUntil } from './format';
import type { Assignment, Trade } from './types';

/** Trades after which pipes and cables disappear behind plaster, screed or boards. */
const COVERS_UP = /putz|estrich|trockenbau/i;
/** How many days ahead the reminder shows up. */
const LEAD_DAYS = 14;

export type PhotoReminder = { id: string; tradeName: string; startDate: string };

/**
 * Upcoming assignments that cover up installations. The advice heard most
 * often from people who have built: photograph every wall before that.
 */
export function photoReminders(assignments: Assignment[], trades: Trade[]): PhotoReminder[] {
  return assignments
    .map((a) => ({ id: a.id, startDate: a.startDate, tradeName: trades.find((t) => t.id === a.tradeId)?.name ?? '' }))
    .filter((r) => COVERS_UP.test(r.tradeName) && daysUntil(r.startDate) >= 0 && daysUntil(r.startDate) <= LEAD_DAYS)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
