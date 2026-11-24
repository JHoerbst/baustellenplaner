import { timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { toIcs, type CalendarEvent } from './ics';
import { tableEnv, type CalendarTable } from './tables';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = (name: CalendarTable) => process.env[tableEnv(name)]!;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * All rows of a project. A scan with a filter reads the whole table; that is
 * fine while a deployment holds a handful of projects and would want an
 * index on projectId if it ever grew.
 */
async function rowsOf(name: CalendarTable, projectId: string): Promise<Row[]> {
  const rows: Row[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName(name),
        FilterExpression: 'projectId = :p',
        ExpressionAttributeValues: { ':p': projectId },
        ExclusiveStartKey: startKey,
      })
    );
    rows.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return rows;
}

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Used when the link carries no time zone, e.g. links created before it was added. */
const DEFAULT_TIMEZONE = 'Europe/Vienna';
/** IANA names such as Europe/Vienna; anything else falls back to the default. */
const TIMEZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/;

const notFound = { statusCode: 404, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'Kalender nicht gefunden.' };

type UrlEvent = { queryStringParameters?: Record<string, string | undefined> };

/**
 * GET ?p=<project id>&t=<token>[&nur=termine][&tz=Europe/Vienna]
 * Without "nur=termine" the feed also carries deadlines and the trades'
 * assignments as all-day entries.
 */
export const handler = async (event: UrlEvent) => {
  const { p: projectId, t: token, nur, tz } = event.queryStringParameters ?? {};
  if (!projectId || !token) return notFound;

  const project = (await db.send(new GetCommand({ TableName: tableName('Project'), Key: { id: projectId } }))).Item;
  // Same answer for a wrong token and an unknown project, so ids cannot be probed.
  if (!project?.calendarToken || !sameToken(token, project.calendarToken)) return notFound;

  const onlyAppointments = nur === 'termine';
  const [appointments, companies] = await Promise.all([rowsOf('Appointment', projectId), rowsOf('Company', projectId)]);
  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name as string | undefined;

  const events: CalendarEvent[] = appointments.map((a) => ({
    id: a.id,
    title: [a.title, companyName(a.companyId)].filter(Boolean).join(', '),
    start: a.start,
    end: a.endTime,
    location: a.place,
    description: a.note,
    changed: a.updatedAt,
  }));

  if (!onlyAppointments) {
    const [trades, assignments, tasks, decisions, defects, orders, invoices] = await Promise.all([
      rowsOf('Trade', projectId),
      rowsOf('Assignment', projectId),
      rowsOf('Task', projectId),
      rowsOf('Decision', projectId),
      rowsOf('Defect', projectId),
      rowsOf('MaterialOrder', projectId),
      rowsOf('Invoice', projectId),
    ]);
    const tradeName = (id?: string) => trades.find((t) => t.id === id)?.name as string | undefined;
    const allDay = (row: Row, title: string, start: string, end?: string): CalendarEvent => ({
      id: row.id,
      title,
      start,
      end,
      description: row.note ?? row.description,
      changed: row.updatedAt,
    });

    for (const a of assignments) {
      events.push(allDay(a, [tradeName(a.tradeId) ?? 'Gewerk', a.title, companyName(a.companyId)].filter(Boolean).join(', '), a.startDate, a.endDate));
    }
    for (const t of tasks) if (!t.done && t.dueDate) events.push(allDay(t, `Aufgabe: ${t.title}`, t.dueDate));
    for (const d of decisions) if (!d.chosen && d.deadline) events.push(allDay(d, `Entscheiden: ${d.title}`, d.deadline));
    for (const d of defects) if (d.status !== 'fixed' && d.deadline) events.push(allDay(d, `Mangel beheben: ${d.title}`, d.deadline));
    for (const o of orders) {
      if (o.status === 'planned' && o.orderBy) events.push(allDay(o, `Bestellen: ${o.title}`, o.orderBy));
      if (o.status === 'ordered' && o.deliveryDate) events.push(allDay(o, `Lieferung: ${o.title}`, o.deliveryDate));
    }
    for (const i of invoices) if (!i.paid && i.dueDate) events.push(allDay(i, `Zahlen: ${i.vendor}`, i.dueDate));
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      // Calendar apps poll on their own schedule; do not let anything in between keep an old copy.
      'cache-control': 'no-store',
    },
    body: toIcs(project.name ?? 'Baustellenplaner', events, tz && TIMEZONE.test(tz) ? tz : DEFAULT_TIMEZONE),
  };
};
