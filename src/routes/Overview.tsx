import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { photoReminders } from '../lib/reminders';
import { formatDate, euro, today, isoDay, relativeDay, dayOf, daysUntil, formatTime } from '../lib/format';

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** After this many days without a reply it is worth following up. */
const FOLLOW_UP_AFTER_DAYS = 10;

export default function Overview() {
  const { appointments, tasks, quotes, trades, companies, notes, invoices, defects, decisions, me, assignments } = useApp();
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
        decisions.filter((d) => !d.chosen && d.deadline === day).length,
    };
  });

  const upcoming = appointments.filter((t) => dayOf(t.start) >= today()).slice(0, 5);

  const openTasks = tasks
    .filter((a) => !a.done)
    .sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
  const dueSoon = openTasks.filter((a) => a.dueDate && daysUntil(a.dueDate) <= 7);

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
  const awardedTotal = awarded.reduce((s, a) => s + (a.amount ?? 0), 0);
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
          <Link to="/termine">Nächste Termine</Link>
        </h2>
        {upcoming.length === 0 ? (
          <p className="empty">Kein Termin eingetragen.</p>
        ) : (
          <ul className="list">
            {upcoming.map((t) => (
              <li key={t.id} className="row">
                <div className="row-when">
                  <strong>{formatDate(t.start)}</strong>
                  <span>{formatTime(t.start)}</span>
                </div>
                <div className="row-main">
                  <strong>{t.title}</strong>
                  <span>{[companyName(t.companyId), t.place].filter(Boolean).join(', ') || relativeDay(t.start)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>
          <Link to="/angebote">Angebote</Link>
        </h2>
        <p className="figure">
          <strong>{euro(awardedTotal)}</strong> beauftragt, {awardedCount} von {trades.filter((g) => !g.selfPerformed).length} Gewerken vergeben
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
        {dueSoon.length > 0 && (
          <ul className="list">
            {dueSoon.map((a) => (
              <li key={a.id} className="row">
                <div className="row-main">
                  <strong>{a.title}</strong>
                  <span className={daysUntil(a.dueDate!) < 0 ? 'is-urgent' : undefined}>
                    fällig {relativeDay(a.dueDate!)}
                    {a.assignee ? `, ${a.assignee}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
