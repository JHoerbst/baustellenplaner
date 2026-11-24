/** One calendar entry; all-day when start is a date (YYYY-MM-DD) rather than a timestamp. */
export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO timestamp, or YYYY-MM-DD for an all-day entry. */
  start: string;
  /** Same form as start; for all-day entries the last day, inclusive. */
  end?: string | null;
  location?: string | null;
  description?: string | null;
  /** When the entry last changed, ISO timestamp. */
  changed?: string | null;
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** 2026-11-25T08:00:00.000Z -> 20261125T080000Z */
const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const dateStamp = (day: string) => day.replace(/-/g, '');

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Commas, semicolons, backslashes and line breaks have to be escaped in text values. */
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 bytes must be folded; continuation lines start with a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  let limit = 75;
  while (Buffer.byteLength(rest, 'utf8') > limit) {
    // Cut on a character boundary so multi-byte letters such as umlauts stay intact.
    let cut = limit;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > limit) cut--;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
    limit = 74;
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

/** Default length of an appointment without an end time. */
const DEFAULT_MINUTES = 60;

/**
 * Timed entries are written as UTC instants, which every calendar converts
 * correctly. The time zone only tells the calendar app which zone the feed
 * belongs to; without it Google files the calendar under GMT+0.
 */
export function toIcs(name: string, events: CalendarEvent[], timezone: string): string {
  const now = utcStamp(new Date().toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Baustellenplaner//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`, `X-WR-TIMEZONE:${timezone}`];

  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@baustellenplaner`, `DTSTAMP:${e.changed ? utcStamp(e.changed) : now}`);
    if (isDate(e.start)) {
      // DTEND is exclusive for all-day entries.
      const last = e.end && isDate(e.end) && e.end >= e.start ? e.end : e.start;
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start)}`, `DTEND;VALUE=DATE:${dateStamp(nextDay(last))}`);
    } else {
      const start = new Date(e.start);
      const end = e.end && new Date(e.end) > start ? new Date(e.end) : new Date(start.getTime() + DEFAULT_MINUTES * 60_000);
      lines.push(`DTSTART:${utcStamp(start.toISOString())}`, `DTEND:${utcStamp(end.toISOString())}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
