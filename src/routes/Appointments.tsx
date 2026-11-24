import { useState } from 'react';
import { useApp } from '../lib/app';
import { today, relativeDay, longDay, dayOf, formatTime } from '../lib/format';
import type { Appointment } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';

export default function Appointments() {
  const { appointments, trades, companies, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<Appointment> | null>(null);
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Was steht an?', required: true },
    { name: 'start', label: 'Beginn', type: 'datetime-local', required: true, half: true },
    { name: 'endTime', label: 'Ende', type: 'datetime-local', half: true },
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
          <strong>{formatTime(t.start)}</strong>
          {t.endTime && <span>bis {formatTime(t.endTime)}</span>}
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
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => save('Appointment', opened.id, d)}
          onDelete={opened.id ? () => store.remove('Appointment', opened.id!) : undefined}
        />
      )}
    </>
  );
}
