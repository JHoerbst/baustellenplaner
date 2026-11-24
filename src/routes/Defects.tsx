import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '../lib/app';
import { daysUntil, formatDate, relativeDay, today } from '../lib/format';
import { roomLabel } from '../lib/rooms';
import { DEFECT_STATUS, type Attachment, type Defect, type DefectStatus } from '../lib/types';
import { Attachments } from '../ui/Attachments';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle, TasksSwitch } from '../ui/Layout';

const NO_COMPANY = 'Ohne Firma';

/**
 * Defects with photo, responsible company and deadline until they are fixed.
 * Open ones are grouped by company, because that is how the list gets handed
 * over: each company is told what it still has to put right.
 */
export default function Defects() {
  const { defects, rooms, companies, trades, project, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<Defect> | null>(null);
  /** Photos of an entry that has not been saved yet. */
  const [draft, setDraft] = useState<Attachment[]>([]);

  const companyName = (id?: string | null) => companies.find((c) => c.id === id)?.name;
  const roomName = (id?: string | null) => {
    const room = rooms.find((r) => r.id === id);
    return room && roomLabel(room);
  };

  const fields: Field[] = [
    { name: 'title', label: 'Was ist der Mangel?', required: true },
    { name: 'description', label: 'Beschreibung', type: 'textarea' },
    { name: 'roomId', label: 'Raum', type: 'select', half: true, options: rooms.map((r) => ({ value: r.id, label: roomLabel(r) })) },
    { name: 'status', label: 'Stand', type: 'select', required: true, half: true, options: Object.entries(DEFECT_STATUS).map(([value, label]) => ({ value, label })) },
    { name: 'companyId', label: 'Wer muss es beheben?', type: 'select', half: true, options: companies.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'foundOn', label: 'Festgestellt am', type: 'date', required: true, half: true },
    { name: 'deadline', label: 'Frist zur Behebung', type: 'date', half: true },
  ];

  function openForm(d: Partial<Defect>) {
    setDraft([]);
    setOpened(d);
  }

  // Overdue and soonest deadlines first, those without a deadline last.
  const unresolved = defects
    .filter((d) => d.status !== 'fixed')
    .sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'));
  const fixed = defects.filter((d) => d.status === 'fixed');

  const sections = [...companies.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: NO_COMPANY }]
    .map((s) => ({ ...s, defects: unresolved.filter((d) => (companyName(d.companyId) ? d.companyId : null) === s.id) }))
    .filter((s) => s.defects.length > 0);

  // The sheet shows the live row so new photos appear immediately.
  const liveRow = opened?.id ? defects.find((d) => d.id === opened.id) : undefined;

  const row = (d: Defect) => (
    <li key={d.id}>
      <button type="button" className={`row row--button${d.status === 'fixed' ? ' is-faded' : ''}`} onClick={() => openForm(d)}>
        <div className="row-main">
          <strong>{d.title}</strong>
          <span>
            {[roomName(d.roomId), DEFECT_STATUS[d.status as DefectStatus], d.status === 'fixed' && d.fixedOn && formatDate(d.fixedOn)].filter(Boolean).join(', ')}
            {!!d.attachments?.length && <Paperclip size={13} aria-label="mit Foto" className="clip" />}
          </span>
          {d.status !== 'fixed' && d.deadline && (
            <span className={daysUntil(d.deadline) <= 0 ? 'is-urgent' : undefined}>
              Frist {formatDate(d.deadline)} ({relativeDay(d.deadline)})
            </span>
          )}
        </div>
      </button>
    </li>
  );

  return (
    <>
      <PageTitle addLabel="Mangel" onAdd={() => openForm({ status: 'open', foundOn: today() })}>
        Mängel
      </PageTitle>
      <TasksSwitch />

      {defects.length === 0 && (
        <Empty>Noch kein Mangel. Halt mit Foto fest, was nicht passt, wer es beheben muss und bis wann, am besten gleich bei der Abnahme.</Empty>
      )}
      {defects.length > 0 && unresolved.length === 0 && <Empty>Alle Mängel sind behoben.</Empty>}

      {sections.map((s) => (
        <section key={s.id ?? 'none'} className="block">
          <h2>
            {s.name} <small>{s.defects.length} offen</small>
          </h2>
          <ul className="list">{s.defects.map(row)}</ul>
        </section>
      ))}

      {fixed.length > 0 && (
        <details className="block">
          <summary>Behoben ({fixed.length})</summary>
          <ul className="list">{fixed.map(row)}</ul>
        </details>
      )}

      {opened && project && (
        <EntityForm
          title={opened.id ? 'Mangel bearbeiten' : 'Neuer Mangel'}
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) =>
            save('Defect', opened.id, {
              ...d,
              // Remember when it was fixed, and forget it again if it is reopened.
              fixedOn: d.status === 'fixed' ? (opened.fixedOn ?? today()) : null,
              ...(opened.id ? {} : { attachments: draft }),
            })
          }
          onDelete={opened.id ? () => store.remove('Defect', opened.id!) : undefined}
        >
          <Attachments
            label="Fotos"
            group={project.group}
            attachments={liveRow ? (liveRow.attachments ?? []) : draft}
            onUpdate={(a) => (liveRow ? store.update('Defect', liveRow.id, { attachments: a }) : setDraft(a))}
          />
        </EntityForm>
      )}
    </>
  );
}
