import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { BudgetSummary } from '../ui/BudgetSummary';
import { orderWarning } from '../lib/materialOrders';
import { orderStatus } from '../lib/orders';
import { DEFAULT_HOUSEHOLD, presenceOn } from '../lib/presence';
import { photoReminders } from '../lib/reminders';
import { formatDate, euro, isoDay, relativeDay, dayOf, daysUntil, appointmentTime } from '../lib/format';

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** The day-by-day agenda covers this many days, starting today. */
const WEEK_DAYS = 7;
/** Appointments after that week, shown as a short list. */
const LATER_SHOWN = 3;

/** The overview lists this many open tasks; the rest is one tap away. */
const TASKS_SHOWN = 8;

/** After this many days without a reply it is worth following up. */
const FOLLOW_UP_AFTER_DAYS = 10;

export default function Overview() {
  const { appointments, tasks, quotes, trades, companies, notes, invoices, defects, decisions, materialOrders, helpers, project, me, memberName, assignments, store } = useApp();
  const orderWarnings = materialOrders.flatMap((o) => {
    const warning = orderWarning(o);
    return warning ? [{ id: o.id, title: o.title, ...warning }] : [];
  });
  // Decisions that are due within two weeks or already overdue.
  const toDecide = decisions
    .filter((d) => !d.chosen && d.deadline && daysUntil(d.deadline) <= 14)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const openDefects = defects.filter((d) => d.status !== 'fixed');
  const toPay = invoices.filter((r) => !r.paid);
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  // The folding rule: the next 14 days, one segment per day.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const day = isoDay(d);
    return {
      day,
      d,
      appointments: appointments.filter((t) => dayOf(t.start) === day).length,
      deadlines:
        tasks.filter((a) => !a.done && a.dueDate === day).length +
        quotes.filter((a) => a.validUntil === day && (a.status === 'received' || a.status === 'negotiating')).length +
        invoices.filter((r) => !r.paid && r.dueDate === day).length +
        defects.filter((d) => d.status !== 'fixed' && d.deadline === day).length +
        decisions.filter((d) => !d.chosen && d.deadline === day).length +
        materialOrders.filter((o) => (o.status === 'planned' && o.orderBy === day) || (o.status === 'ordered' && o.deliveryDate === day)).length,
    };
  });

  // The week ahead, day by day: appointments and which trades are on site.
  const tradeName = (id?: string | null) => trades.find((t) => t.id === id)?.name;
  const whoIsThere = (day: string) => {
    const p = presenceOn(day, helpers, assignments, project?.householdSize ?? DEFAULT_HOUSEHOLD);
    return {
      onSite: p.tradesPresent.map((a) => tradeName(a.tradeId)).filter((name): name is string => !!name),
      helpersThere: p.helpersPresent,
      meals: p.meals,
    };
  };
  const week = days.slice(0, WEEK_DAYS).map(({ day, d }) => ({
    day,
    d,
    items: appointments.filter((t) => dayOf(t.start) === day),
    ...whoIsThere(day),
  }));
  // Tomorrow gets its own block: who comes decides what has to be ready tonight.
  const tomorrow = { day: days[1].day, ...whoIsThere(days[1].day) };
  const lastWeekDay = week[week.length - 1].day;
  const later = appointments.filter((t) => dayOf(t.start) > lastWeekDay).slice(0, LATER_SHOWN);

  const openTasks = tasks
    .filter((a) => !a.done)
    .sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));

  // Quotes that need someone to act.
  const attention = quotes.flatMap((a) => {
    const who = companyName(a.companyId) ?? a.title;
    if ((a.status === 'received' || a.status === 'negotiating') && a.validUntil && daysUntil(a.validUntil) <= 10) {
      const n = daysUntil(a.validUntil);
      return [{ id: a.id, text: who, what: n < 0 ? `ist ${relativeDay(a.validUntil)} abgelaufen` : `läuft ${relativeDay(a.validUntil)} ab`, urgent: n <= 3 }];
    }
    if (a.status === 'requested' && a.requestedOn && -daysUntil(a.requestedOn) >= FOLLOW_UP_AFTER_DAYS) {
      return [{ id: a.id, text: who, what: `seit ${-daysUntil(a.requestedOn)} Tagen keine Antwort`, urgent: false }];
    }
    return [];
  });

  const awarded = quotes.filter((a) => a.status === 'awarded');
  // Order totals include change orders.
  const orders = awarded.map((a) => orderStatus(a, invoices));
  const awardedTotal = orders.reduce((s, o) => s + o.total, 0);
  const invoicedTotal = orders.reduce((s, o) => s + o.invoiced, 0);
  const awardedCount = new Set(awarded.map((a) => a.tradeId)).size;

  return (
    <>
      <ol className="ruler" aria-label="Die nächsten 14 Tage">
        {days.map(({ day, d, appointments: t, deadlines: f }, i) => (
          <li key={day} className={i === 0 ? 'is-today' : d.getDay() % 6 === 0 ? 'is-weekend' : undefined}>
            <span className="ruler-weekday">{i === 0 ? 'Heute' : WEEKDAY_NAMES[d.getDay()]}</span>
            <span className="ruler-day">{d.getDate()}</span>
            <span className="ruler-marks">
              {t > 0 && <i className="mark mark--appointment" title={`${t} Termin(e)`} />}
              {f > 0 && <i className="mark mark--deadline" title={`${f} Frist(en)`} />}
            </span>
          </li>
        ))}
      </ol>
      <p className="legend">
        <i className="mark mark--appointment" /> Termin <i className="mark mark--deadline" /> Frist
      </p>

      {photoReminders(assignments, trades).map((r) => (
        <p key={r.id} className="reminder">
          {r.tradeName} kommt {relativeDay(r.startDate)}: vorher Wände und Böden <Link to="/fotos">fotografieren</Link>.
        </p>
      ))}

      <section className="block">
        <h2>
          <Link to="/zeitplan">Morgen auf der Baustelle</Link>
        </h2>
        {tomorrow.helpersThere.length === 0 && tomorrow.onSite.length === 0 ? (
          <p className="empty empty--short">Für morgen ist niemand eingetragen.</p>
        ) : (
          <>
            {tomorrow.meals > 0 && (
              <p className="figure">
                <strong>{tomorrow.meals}</strong> zum Essen
              </p>
            )}
            <ul className="list">
              {tomorrow.onSite.map((name, i) => (
                <li key={`trade-${i}`} className="row">
                  <div className="row-main">
                    <strong>{name}</strong>
                    <span>Gewerk</span>
                  </div>
                </li>
              ))}
              {tomorrow.helpersThere.map((h) => (
                <li key={h.id} className="row">
                  <div className="row-main">
                    <strong>{h.name}</strong>
                    <span>{h.note || 'hilft mit'}</span>
                  </div>
                  {h.phone && (
                    <a className="link" href={`tel:${h.phone.replace(/\s/g, '')}`}>
                      {h.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="block">
        <h2>
          <Link to="/termine">Die nächsten sieben Tage</Link>
        </h2>
        {/* One row per day, also for days without anything, so the shape of the week shows. */}
        <ol className="week">
          {week.map(({ day, d, items, onSite, helpersThere }, i) => (
            <li key={day} className={['week-day', i === 0 && 'is-today', d.getDay() % 6 === 0 && 'is-weekend', !items.length && !onSite.length && !helpersThere.length && 'is-free'].filter(Boolean).join(' ')}>
              <div className="week-date">
                <span>{i === 0 ? 'Heute' : WEEKDAY_NAMES[d.getDay()]}</span>
                <b>{d.getDate()}</b>
              </div>
              <div className="week-items">
                {items.map((t) => (
                  <Link key={t.id} to="/termine" className="week-item">
                    <time dateTime={t.allDay ? dayOf(t.start) : t.start} className={t.allDay ? 'is-all-day' : undefined}>
                      {appointmentTime(t)}
                    </time>
                    <span>
                      <strong>{t.title}</strong>
                      {[companyName(t.companyId), t.place].filter(Boolean).join(', ')}
                    </span>
                  </Link>
                ))}
                {onSite.length > 0 && <p className="week-site">Auf der Baustelle: {onSite.join(', ')}</p>}
                {helpersThere.length > 0 && <p className="week-site">Helfer: {helpersThere.map((h) => h.name).join(', ')}</p>}
              </div>
            </li>
          ))}
        </ol>
        {later.length > 0 && (
          <>
            <p className="hint">Danach</p>
            <ul className="list">
              {later.map((t) => (
                <li key={t.id} className="row">
                  <div className="row-when">
                    <strong>{formatDate(t.start)}</strong>
                    <span>{appointmentTime(t)}</span>
                  </div>
                  <div className="row-main">
                    <strong>{t.title}</strong>
                    <span>{[companyName(t.companyId), t.place].filter(Boolean).join(', ') || relativeDay(t.start)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="block">
        <h2>
          <Link to="/angebote">Angebote</Link>
        </h2>
        <BudgetSummary compact />
        <p className="figure">
          <strong>{euro(awardedTotal)}</strong> beauftragt, {invoicedTotal > 0 && `davon ${euro(invoicedTotal)} verrechnet, `}{awardedCount} von {trades.filter((g) => !g.selfPerformed).length} Gewerken vergeben
        </p>
        {attention.length > 0 && (
          <ul className="list">
            {attention.map((a) => (
              <li key={a.id} className="row">
                <div className="row-main">
                  <strong>{a.text}</strong>
                  <span className={a.urgent ? 'is-urgent' : undefined}>{a.what}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orderWarnings.length > 0 && (
        <section className="block">
          <h2>
            <Link to="/bestellungen">Bestellungen</Link>
          </h2>
          <ul className="list">
            {orderWarnings.map((o) => (
              <li key={o.id} className="row">
                <div className="row-main">
                  <strong>{o.title}</strong>
                  <span className={o.urgent ? 'is-urgent' : undefined}>{o.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toDecide.length > 0 && (
        <section className="block">
          <h2>
            <Link to="/entscheidungen">Zu entscheiden</Link>
          </h2>
          <ul className="list">
            {toDecide.map((d) => (
              <li key={d.id} className="row">
                <div className="row-main">
                  <strong>{d.title}</strong>
                  <span className={daysUntil(d.deadline!) <= 3 ? 'is-urgent' : undefined}>bis {relativeDay(d.deadline!)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openDefects.length > 0 && (
        <section className="block">
          <h2>
            <Link to="/maengel">Mängel</Link>
          </h2>
          <p className="figure">
            <strong>{openDefects.length}</strong> offen
            {openDefects.some((d) => d.deadline && daysUntil(d.deadline) <= 0) &&
              `, bei ${openDefects.filter((d) => d.deadline && daysUntil(d.deadline) <= 0).length} ist die Frist abgelaufen`}
          </p>
        </section>
      )}

      {toPay.length > 0 && (
        <section className="block">
          <h2>
            <Link to="/rechnungen">Offene Rechnungen</Link>
          </h2>
          <ul className="list">
            {toPay.map((r) => (
              <li key={r.id} className="row">
                <div className="row-main">
                  <strong>{r.vendor}</strong>
                  <span className={r.dueDate && daysUntil(r.dueDate) <= 3 ? 'is-urgent' : undefined}>
                    {r.dueDate ? `fällig ${relativeDay(r.dueDate)}` : 'ohne Fälligkeit'}
                  </span>
                </div>
                <div className="row-amount">
                  <strong>{euro(r.amount)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2>
          <Link to="/aufgaben">Aufgaben</Link>
        </h2>
        <p className="figure">
          <strong>{openTasks.length}</strong> offen, davon {openTasks.filter((a) => a.assignee === me).length} bei dir
        </p>
        {openTasks.length > 0 && (
          <ul className="list">
            {openTasks.slice(0, TASKS_SHOWN).map((a) => (
              <li key={a.id} className="row">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={false}
                  onChange={() => store.update('Task', a.id, { done: true })}
                  aria-label={`${a.title} abhaken`}
                />
                <div className="row-main">
                  <strong>{a.title}</strong>
                  <span>
                    {a.dueDate && (
                      <span className={daysUntil(a.dueDate) < 0 ? 'is-urgent' : undefined}>fällig {relativeDay(a.dueDate)}</span>
                    )}
                    {a.dueDate && a.assignee && ', '}
                    {memberName(a.assignee)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {openTasks.length > TASKS_SHOWN && (
          <p className="hint">
            <Link to="/aufgaben">und {openTasks.length - TASKS_SHOWN} weitere</Link>
          </p>
        )}
      </section>

      {notes.length > 0 && (
        <section className="block">
          <h2>
            <Link to="/notizen">Letzte Notizen</Link>
          </h2>
          <ul className="list">
            {notes.slice(0, 3).map((n) => (
              <li key={n.id} className="row">
                <div className="row-main">
                  <p className="note-text note-text--clamped">{n.text}</p>
                  <span>{[n.createdAt && formatDate(n.createdAt), companyName(n.companyId)].filter(Boolean).join(', ')}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
