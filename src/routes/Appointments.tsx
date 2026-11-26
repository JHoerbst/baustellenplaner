import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../lib/app';
import { today, relativeDay, longDay, dayOf, formatTime, clockOf, addDays, daysBetween } from '../lib/format';
import type { Appointment } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';

/** The form asks for the day and the times separately; the time may stay empty. */
function toForm(t: Partial<Appointment>): Record<string, unknown> {
  const timed = !!t.start && !t.allDay;
  return { ...t, date: t.start ? dayOf(t.start) : '', from: timed ? clockOf(t.start!) : '', to: timed && t.endTime ? clockOf(t.endTime) : '' };
}

function fromForm({ date, from, to, ...rest }: Record<string, unknown>, before: Partial<Appointment>): Record<string, unknown> {
  const at = (day: string, clock: string) => new Date(`${day}T${clock}`);
  if (!from) return { ...rest, start: at(String(date), '00:00').toISOString(), endTime: null, allDay: true };
  const start = at(String(date), String(from));
  let endTime: string | null = null;
  if (to) {
    // An appointment that already ran over several days keeps its length in days.
    const days = before.start && before.endTime && !before.allDay ? Math.max(0, daysBetween(dayOf(before.start), dayOf(before.endTime))) : 0;
    let end = at(addDays(String(date), days), String(to));
    // An end before the start means past midnight.
    if (end <= start) end = at(addDays(String(date), days + 1), String(to));
    endTime = end.toISOString();
  }
  return { ...rest, start: start.toISOString(), endTime, allDay: false };
}

export default function Appointments() {
  const { appointments, trades, companies, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<Appointment> | null>(null);

  // The quick action in the header links here with ?neu=1: open the empty
  // form and drop the parameter, so going back does not open it again.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!params.has('neu')) return;
    setOpened({});
    setParams({}, { replace: true });
  }, [params, setParams]);
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Was steht an?', required: true },
    { name: 'date', label: 'Datum', type: 'date', required: true },
    { name: 'from', label: 'Uhrzeit, falls bekannt', type: 'time', half: true },
    { name: 'to', label: 'Bis', type: 'time', half: true, showWhen: (inputs) => !!inputs.from },
    { name: 'place', label: 'Ort' },
    { name: 'companyId', label: 'Firma', type: 'select', half: true, options: companies.map((f) => ({ value: f.id, label: f.name })) },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ];

  const upcoming = appointments.filter((t) => dayOf(t.start) >= today());
  const past = appointments.filter((t) => dayOf(t.start) < today()).reverse();

  // Group by calendar day; appointments is already sorted by time.
  const days = [...new Set(upcoming.map((t) => dayOf(t.start)))];

  const row = (t: Appointment) => (
    <li key={t.id}>
      <button type="button" className="row row--button" onClick={() => setOpened(t)}>
        <div className="row-when">
          {t.allDay ? (
            <span>ganztags</span>
          ) : (
            <>
              <strong>{formatTime(t.start)}</strong>
              {t.endTime && <span>bis {formatTime(t.endTime)}</span>}
            </>
          )}
        </div>
        <div className="row-main">
          <strong>{t.title}</strong>
          <span>{[companyName(t.companyId), t.place].filter(Boolean).join(', ')}</span>
        </div>
      </button>
    </li>
  );

  return (
    <>
      <PageTitle addLabel="Termin" onAdd={() => setOpened({})}>
        Termine
      </PageTitle>

      {upcoming.length === 0 && <Empty>Kein Termin geplant. Trag Besichtigungen, Lieferungen und Baubesprechungen hier ein.</Empty>}

      {days.map((day) => (
        <section key={day} className="block">
          <h2>
            {longDay(day)} <small>{relativeDay(day)}</small>
          </h2>
          <ul className="list">{upcoming.filter((t) => dayOf(t.start) === day).map(row)}</ul>
        </section>
      ))}

      {past.length > 0 && (
        <details className="block">
          <summary>Vergangene Termine ({past.length})</summary>
          <ul className="list">
            {past.map((t) => (
              <li key={t.id}>
                <button type="button" className="row row--button is-faded" onClick={() => setOpened(t)}>
                  <div className="row-main">
                    <strong>{t.title}</strong>
                    <span>{[longDay(dayOf(t.start)), companyName(t.companyId)].filter(Boolean).join(', ')}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {opened && (
        <EntityForm
          title={opened.id ? 'Termin bearbeiten' : 'Neuer Termin'}
          fields={fields}
          value={toForm(opened)}
          onClose={() => setOpened(null)}
          onSave={(d) => save('Appointment', opened.id, fromForm(d, opened))}
          onDelete={opened.id ? () => store.remove('Appointment', opened.id!) : undefined}
        />
      )}
    </>
  );
}
