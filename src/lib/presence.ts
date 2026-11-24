import { weekdayOf } from './format';
import type { Assignment, Helper } from './types';

/** People in the household when the project has not set a number. */
export const DEFAULT_HOUSEHOLD = 2;

export type Presence = {
  helpersPresent: Helper[];
  tradesPresent: Assignment[];
  /** Contractors who eat along that day. */
  contractors: number;
  /** For how many to cook, the household included; 0 when nobody comes. */
  meals: number;
};

/** Who is on site on a given day, and for how many do we cook? */
export function presenceOn(day: string, helpers: Helper[], assignments: Assignment[], householdSize: number): Presence {
  const helpersPresent = helpers.filter((h) => h.days?.includes(day));
  const tradesPresent = assignments.filter((a) => a.startDate <= day && day <= a.endDate);
  // Contractors only count Mon-Fri; at the weekend the bar stays but nobody eats.
  const isWeekday = weekdayOf(day) % 6 !== 0;
  const contractors = isWeekday ? tradesPresent.filter((a) => a.catered).reduce((n, a) => n + (a.people ?? 1), 0) : 0;
  const guests = helpersPresent.length + contractors;
  return { helpersPresent, tradesPresent, contractors, meals: guests > 0 ? guests + householdSize : 0 };
}
