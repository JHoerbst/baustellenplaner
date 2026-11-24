const eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const shortDateFormat = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short' });
const longDayFormat = new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' });

export const euro = (n: number | null | undefined) => (n == null ? '–' : eur.format(n));

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const today = () => isoDay(new Date());

/** Calendar day of a date (YYYY-MM-DD) or timestamp (ISO) value. */
export const dayOf = (value: string) => (value.length <= 10 ? value : isoDay(new Date(value)));

const noon = (day: string) => new Date(`${day}T12:00`);

export const formatDate = (value: string) => shortDateFormat.format(noon(dayOf(value)));
export const longDay = (day: string) => longDayFormat.format(noon(day));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

export function addDays(day: string, n: number): string {
  const d = noon(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** 0 = Sunday ... 6 = Saturday. */
export const weekdayOf = (day: string) => noon(day).getDay();

/** The Monday of the week the day falls in. */
export const mondayOf = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

/** Whole days from a to b; negative if b is earlier. */
export const daysBetween = (a: string, b: string) => Math.round((+noon(b) - +noon(a)) / 864e5);

/** Whole days from today to the day; negative = in the past. */
export function daysUntil(value: string): number {
  return Math.round((+noon(dayOf(value)) - +noon(today())) / 864e5);
}

export function relativeDay(value: string): string {
  const n = daysUntil(value);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

/** ISO timestamp -> value for <input type="datetime-local">. */
export function toInputValue(iso: string): string {
  const d = new Date(iso);
  return `${isoDay(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "12.500,50", "12500.5" or "12 500 €" -> number. */
export function parseNumber(text: string): number | null {
  let s = text.replace(/[\s€]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
