import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate, today, mondayOf, addDays, longDay, daysBetween, weekdayOf } from '../lib/format';
import { DEFAULT_HOUSEHOLD, presenceOn } from '../lib/presence';
import type { Assignment, Helper } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { PageTitle } from '../ui/Layout';

/** Four weeks side by side; paging moves by half of that. */
const COLUMNS = 28;
const STEP_DAYS = 14;
const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const monthFormat = new Intl.DateTimeFormat('de-AT', { month: 'short', year: 'numeric' });
const monthOf = (day: string) => monthFormat.format(new Date(`${day}T12:00`));

const HELPER_FIELDS: Field[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'phone', label: 'Telefon', type: 'tel' },
  { name: 'note', label: 'Notiz (z.B. isst vegetarisch, bringt Mischmaschine)', type: 'textarea' },
];

export default function Schedule() {
  const { assignments, helpers, materialOrders, trades, companies, project, save, store } = useApp();
  // Deliveries still to come, in the order they are expected.
  const deliveries = materialOrders
    .filter((o) => o.status !== 'delivered' && (o.deliveryDate || o.neededBy))
    .sort((a, b) => (a.deliveryDate ?? a.neededBy ?? '').localeCompare(b.deliveryDate ?? b.neededBy ?? ''));
  const [start, setStart] = useState(() => mondayOf(today()));
  const [selected, setSelected] = useState(today());
  const [assignment, setAssignment] = useState<Partial<Assignment> | null>(null);
  const [helperDraft, setHelperDraft] = useState<Partial<Helper> | null>(null);

  const days = useMemo(() => Array.from({ length: COLUMNS }, (_, i) => addDays(start, i)), [start]);
  const householdSize = project?.householdSize ?? DEFAULT_HOUSEHOLD;
  const tradeName = (id?: string | null) => trades.find((g) => g.id === id)?.name;
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  const assignmentFields: Field[] = [
    { name: 'tradeId', label: 'Gewerk', type: 'select', required: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'title', label: 'Was wird gemacht?' },
    { name: 'startDate', label: 'Von', type: 'date', required: true, half: true },
    { name: 'endDate', label: 'Bis', type: 'date', required: true, half: true },
    { name: 'companyId', label: 'Firma', type: 'select', options: companies.map((f) => ({ value: f.id, label: f.name })) },
    { name: 'people', label: 'Wie viele Leute kommen?', type: 'integer', half: true },
    { name: 'catered', label: 'Essen sie bei euch mit?', type: 'select', required: true, half: true, options: [{ value: 'no', label: 'Nein' }, { value: 'yes', label: 'Ja' }] },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ];

  const onDay = (day: string) => presenceOn(day, helpers, assignments, householdSize);

  const cellClass = (day: string, extra = '') =>
    ['sched-cell', weekdayOf(day) % 6 === 0 && 'is-weekend', day === today() && 'is-today', day === selected && 'is-selected', extra]
      .filter(Boolean)
      .join(' ');

  function toggleDay(h: Helper, day: string) {
    const oldDays = h.days ?? [];
    const newDays = oldDays.includes(day) ? oldDays.filter((t) => t !== day) : [...oldDays, day].sort();
    store.update('Helper', h.id, { days: newDays });
  }

  // Who helped how often - e.g. for the thank-you at the end.
  const stats = helpers
    .map((h) => {
      const all = h.days ?? [];
      const pastDays = all.filter((t) => t <= today()).length;
      return { h, pastDays, plannedDays: all.length - pastDays, lastDay: all.filter((t) => t <= today()).at(-1) };
    })
    .filter((z) => z.pastDays + z.plannedDays > 0)
    .sort((a, b) => b.pastDays + b.plannedDays - (a.pastDays + a.plannedDays));
  const helperDays = stats.reduce((n, z) => n + z.pastDays + z.plannedDays, 0);

  const sorted = [...assignments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const detail = onDay(selected);

  return (
    <>
      <PageTitle addLabel="Einsatz" onAdd={() => setAssignment({ startDate: selected, endDate: selected, catered: false })}>
        Zeitplan
      </PageTitle>

      <div className="sched-controls">
        <button type="button" className="icon-btn" onClick={() => setStart(addDays(start, -STEP_DAYS))} aria-label="Zwei Wochen zurück">
          <ChevronLeft size={20} />
        </button>
        <input
          type="date"
          value={start}
          onChange={(e) => e.target.value && setStart(mondayOf(e.target.value))}
          aria-label="Zeitplan ab diesem Datum zeigen"
        />
        <button type="button" className="icon-btn" onClick={() => setStart(addDays(start, STEP_DAYS))} aria-label="Zwei Wochen weiter">
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setStart(mondayOf(today()));
            setSelected(today());
          }}
        >
          Heute
        </button>
      </div>

      <div className="schedule">
        <div className="sched-row sched-head">
          <div className="sched-name">
            <strong>{monthOf(days[0])}</strong>
            {monthOf(days[COLUMNS - 1]) !== monthOf(days[0]) && <span>bis {monthOf(days[COLUMNS - 1])}</span>}
          </div>
          {days.map((day, i) => (
            <button
              key={day}
              type="button"
              className={cellClass(day)}
              style={{ gridColumn: i + 2 }}
              aria-pressed={day === selected}
              aria-label={longDay(day)}
              onClick={() => setSelected(day)}
            >
              <span>{WEEKDAY_NAMES[weekdayOf(day)]}</span>
              <b>{Number(day.slice(8))}</b>
            </button>
          ))}
        </div>

        <div className="sched-row sched-section">
          <div className="sched-name">Gewerke</div>
        </div>
        {sorted.length === 0 && <p className="sched-empty">Noch kein Einsatz. Trag ein, wann welches Gewerk auf der Baustelle ist.</p>}
        {sorted.map((e) => {
          // Clip the bar to the visible window.
          const fromCol = Math.max(0, daysBetween(start, e.startDate));
          const toCol = Math.min(COLUMNS - 1, daysBetween(start, e.endDate));
          return (
            <div key={e.id} className="sched-row">
              <button type="button" className="sched-name" onClick={() => setAssignment(e)}>
                <strong>{tradeName(e.tradeId) ?? 'Ohne Gewerk'}</strong>
                <span>
                  {formatDate(e.startDate)}
                  {e.endDate !== e.startDate && ` bis ${formatDate(e.endDate)}`}
                </span>
              </button>
              {days.map((day, i) => (
                <div key={day} className={cellClass(day)} style={{ gridColumn: i + 2 }} />
              ))}
              {fromCol <= toCol && (
                <button type="button" className="sched-bar" style={{ gridColumn: `${fromCol + 2} / ${toCol + 3}` }} onClick={() => setAssignment(e)}>
                  {[e.title, companyName(e.companyId), e.people && `${e.people} Pers.`].filter(Boolean).join(', ')}
                </button>
              )}
            </div>
          );
        })}

        {deliveries.length > 0 && (
          <div className="sched-row sched-section">
            <div className="sched-name">Lieferungen</div>
          </div>
        )}
        {deliveries.map((o) => (
          <div key={o.id} className="sched-row">
            <Link to="/bestellungen" className="sched-name">
              <strong>{o.title}</strong>
              <span>{o.deliveryDate ? `kommt ${formatDate(o.deliveryDate)}` : `gebraucht ab ${formatDate(o.neededBy!)}`}</span>
            </Link>
            {days.map((day, i) => (
              <div key={day} className={cellClass(day)} style={{ gridColumn: i + 2 }}>
                {day === o.deliveryDate && <i className="mark mark--delivery" title="Zugesagter Liefertermin" />}
                {day === o.neededBy && <i className="mark mark--needed" title="Auf der Baustelle gebraucht ab" />}
              </div>
            ))}
          </div>
        ))}

        <div className="sched-row sched-section">
          <div className="sched-name">Helfer</div>
        </div>
        {helpers.length === 0 && <p className="sched-empty">Noch keine Helfer. Leg Freunde und Familie an und tipp dann die Tage an, an denen sie kommen.</p>}
        {helpers.map((h) => (
          <div key={h.id} className="sched-row">
            <button type="button" className="sched-name" onClick={() => setHelperDraft(h)}>
              <strong>{h.name}</strong>
              <span>{h.days?.length ? `${h.days.length} Tage` : 'noch kein Tag'}</span>
            </button>
            {days.map((day, i) => {
              const present = !!h.days?.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={cellClass(day, present ? 'is-present' : '')}
                  style={{ gridColumn: i + 2 }}
                  aria-pressed={present}
                  aria-label={`${h.name}, ${longDay(day)}`}
                  onClick={() => toggleDay(h, day)}
                />
              );
            })}
          </div>
        ))}

        <div className="sched-row sched-meals">
          <div className="sched-name">
            <strong>Essen für</strong>
            <span>inkl. euch ({householdSize})</span>
          </div>
          {days.map((day, i) => (
            <div key={day} className={cellClass(day)} style={{ gridColumn: i + 2 }}>
              {onDay(day).meals || ''}
            </div>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setHelperDraft({})}>
          Helfer hinzufügen
        </button>
      </div>

      <section className="block">
        <h2>{longDay(selected)}</h2>
        {detail.meals === 0 && detail.tradesPresent.length === 0 ? (
          <p className="empty">An diesem Tag ist niemand eingetragen.</p>
        ) : (
          <>
            {detail.meals > 0 && (
              <p className="figure">
                <strong>{detail.meals}</strong> zum Essen: ihr ({householdSize})
                {detail.helpersPresent.length > 0 && `, ${detail.helpersPresent.length} Helfer`}
                {detail.contractors > 0 && `, ${detail.contractors} Handwerker`}
              </p>
            )}
            <ul className="list">
              {detail.tradesPresent.map((e) => (
                <li key={e.id} className="row">
                  <div className="row-main">
                    <strong>{tradeName(e.tradeId) ?? 'Ohne Gewerk'}</strong>
                    <span>
                      {[e.title, companyName(e.companyId), e.people && `${e.people} Personen`, e.catered ? 'essen mit' : 'essen nicht mit']
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                </li>
              ))}
              {detail.helpersPresent.map((h) => (
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

      {stats.length > 0 && (
        <section className="block">
          <h2>Wer wie oft hilft</h2>
          <p className="figure">
            <strong>{helperDays}</strong> Helfertage, davon {stats.reduce((n, z) => n + z.pastDays, 0)} schon geleistet
          </p>
          <ul className="list">
            {stats.map(({ h, pastDays, plannedDays, lastDay }) => (
              <li key={h.id} className="row">
                <div className="row-main">
                  <strong>{h.name}</strong>
                  <span>
                    {[pastDays > 0 && `${pastDays} geleistet`, plannedDays > 0 && `${plannedDays} geplant`, lastDay && `zuletzt ${formatDate(lastDay)}`]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                  <span className="bar" style={{ width: `${((pastDays + plannedDays) / (stats[0].pastDays + stats[0].plannedDays)) * 100}%` }} />
                </div>
                <div className="row-amount">
                  <strong>{pastDays + plannedDays}</strong>
                  <span>{pastDays + plannedDays === 1 ? 'Tag' : 'Tage'}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assignment && (
        <EntityForm
          title={assignment.id ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}
          fields={assignmentFields}
          value={{ ...assignment, catered: assignment.catered ? 'yes' : 'no' }}
          onClose={() => setAssignment(null)}
          onSave={(d) => {
            if (String(d.endDate) < String(d.startDate)) throw new Error('Das Ende liegt vor dem Beginn.');
            return save('Assignment', assignment.id, { ...d, catered: d.catered === 'yes' });
          }}
          onDelete={assignment.id ? () => store.remove('Assignment', assignment.id!) : undefined}
        />
      )}

      {helperDraft && (
        <EntityForm
          title={helperDraft.id ? 'Helfer bearbeiten' : 'Neuer Helfer'}
          fields={HELPER_FIELDS}
          value={helperDraft}
          onClose={() => setHelperDraft(null)}
          onSave={(d) => save('Helper', helperDraft.id, helperDraft.id ? d : { ...d, days: [] })}
          onDelete={helperDraft.id ? () => store.remove('Helper', helperDraft.id!) : undefined}
        />
      )}
    </>
  );
}
