import { useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { useApp } from '../lib/app';
import { daysUntil, euro, formatDate, parseNumber, relativeDay, today } from '../lib/format';
import { roomLabel } from '../lib/rooms';
import type { Attachment, Decision, DecisionOption } from '../lib/types';
import { Attachments } from '../ui/Attachments';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle, TasksSwitch } from '../ui/Layout';

/** One row of the options editor; the price stays text while it is being typed. */
type OptionDraft = { name: string; price: string; note: string };

const toDraft = (o: DecisionOption): OptionDraft => ({
  name: o.name,
  price: o.price == null ? '' : String(o.price).replace('.', ','),
  note: o.note ?? '',
});

/** The options of a decision: name, price and which one was picked. */
function OptionsEditor({
  options,
  chosen,
  onChange,
}: {
  options: OptionDraft[];
  chosen: number | null;
  onChange: (options: OptionDraft[], chosen: number | null) => void;
}) {
  const set = (i: number, patch: Partial<OptionDraft>) =>
    onChange(
      options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
      chosen
    );

  function remove(i: number) {
    // Keep the choice on the same option when an earlier row disappears.
    const next = chosen === null || chosen === i ? null : chosen > i ? chosen - 1 : chosen;
    onChange(
      options.filter((_, j) => j !== i),
      next
    );
  }

  return (
    <fieldset className="options">
      <legend>Möglichkeiten</legend>
      {options.map((o, i) => (
        <div key={i} className="option">
          <input
            type="radio"
            name="chosen"
            className="checkbox"
            checked={chosen === i}
            onChange={() => onChange(options, i)}
            aria-label={`${o.name || `Möglichkeit ${i + 1}`} wählen`}
          />
          <input value={o.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="z.B. Feinsteinzeug 60×60" aria-label="Bezeichnung" />
          <input value={o.price} onChange={(e) => set(i, { price: e.target.value })} inputMode="decimal" placeholder="€" aria-label="Preis" />
          <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`${o.name || `Möglichkeit ${i + 1}`} entfernen`}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => onChange([...options, { name: '', price: '', note: '' }], chosen)}>
          Möglichkeit hinzufügen
        </button>
        {chosen !== null && (
          <button type="button" className="btn" onClick={() => onChange(options, null)}>
            Wahl aufheben
          </button>
        )}
      </div>
      <p className="hint">Markier die gewählte Möglichkeit, dann gilt die Entscheidung als getroffen.</p>
    </fieldset>
  );
}

/**
 * Open questions such as tiles, floors or socket positions, each with its
 * options and the date by which the tradesperson needs an answer. The many
 * small decisions are what tends to hold up a build.
 */
export default function Decisions() {
  const { decisions, rooms, trades, project, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<Decision> | null>(null);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  /** Files of an entry that has not been saved yet. */
  const [draft, setDraft] = useState<Attachment[]>([]);

  const roomName = (id?: string | null) => {
    const room = rooms.find((r) => r.id === id);
    return room && roomLabel(room);
  };
  const tradeName = (id?: string | null) => trades.find((t) => t.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Was ist zu entscheiden?', required: true },
    { name: 'description', label: 'Worauf kommt es an?', type: 'textarea' },
    { name: 'deadline', label: 'Bis wann muss es feststehen?', type: 'date' },
    { name: 'roomId', label: 'Raum', type: 'select', half: true, options: rooms.map((r) => ({ value: r.id, label: roomLabel(r) })) },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((t) => ({ value: t.id, label: t.name })) },
  ];

  function openForm(d: Partial<Decision>) {
    const list = d.options ?? [];
    setOptions(list.map(toDraft));
    const index = list.findIndex((o) => o.name === d.chosen);
    setChosen(d.chosen && index >= 0 ? index : null);
    setDraft([]);
    setOpened(d);
  }

  // Soonest deadline first, those without one last.
  const pending = decisions.filter((d) => !d.chosen).sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'));
  const decided = decisions.filter((d) => d.chosen);

  // The sheet shows the live row so new attachments appear immediately.
  const liveRow = opened?.id ? decisions.find((d) => d.id === opened.id) : undefined;

  const row = (d: Decision) => {
    const pick = d.options?.find((o) => o.name === d.chosen);
    return (
      <li key={d.id}>
        <button type="button" className={`row row--button${d.chosen ? ' is-faded' : ''}`} onClick={() => openForm(d)}>
          <div className="row-main">
            <strong>{d.title}</strong>
            <span>
              {[roomName(d.roomId), tradeName(d.tradeId), d.chosen ? `gewählt: ${d.chosen}` : `${d.options?.length ?? 0} Möglichkeiten`]
                .filter(Boolean)
                .join(', ')}
              {!!d.attachments?.length && <Paperclip size={13} aria-label="mit Datei" className="clip" />}
            </span>
            {!d.chosen && d.deadline && (
              <span className={daysUntil(d.deadline) <= 3 ? 'is-urgent' : undefined}>
                bis {formatDate(d.deadline)} ({relativeDay(d.deadline)})
              </span>
            )}
          </div>
          {pick?.price != null && (
            <div className="row-amount">
              <strong>{euro(pick.price)}</strong>
            </div>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <PageTitle addLabel="Entscheidung" onAdd={() => openForm({})}>
        Entscheidungen
      </PageTitle>
      <TasksSwitch />

      {decisions.length === 0 && (
        <Empty>Noch keine Entscheidung. Schreib auf, was ihr auswählen müsst und bis wann der Handwerker es wissen muss, zum Beispiel Fliesen, Böden oder Steckdosen.</Empty>
      )}
      {decisions.length > 0 && pending.length === 0 && <Empty>Alles entschieden.</Empty>}

      {pending.length > 0 && <ul className="list">{pending.map(row)}</ul>}

      {decided.length > 0 && (
        <details className="block">
          <summary>Entschieden ({decided.length})</summary>
          <ul className="list">{decided.map(row)}</ul>
        </details>
      )}

      {opened && project && (
        <EntityForm
          title={opened.id ? 'Entscheidung bearbeiten' : 'Neue Entscheidung'}
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => {
            // Rows without a name are leftovers from "add option" and are dropped.
            const kept = options.map((o, i) => ({ o, i })).filter(({ o }) => o.name.trim());
            const pick = kept.find(({ i }) => i === chosen)?.o.name.trim() ?? null;
            return save('Decision', opened.id, {
              ...d,
              options: kept.map(({ o }) => ({ name: o.name.trim(), price: parseNumber(o.price), note: o.note || null })),
              chosen: pick,
              // Remember when it was decided, and forget it again if the choice is undone.
              decidedOn: pick ? (opened.decidedOn ?? today()) : null,
              ...(opened.id ? {} : { attachments: draft }),
            });
          }}
          onDelete={opened.id ? () => store.remove('Decision', opened.id!) : undefined}
        >
          <OptionsEditor
            options={options}
            chosen={chosen}
            onChange={(o, c) => {
              setOptions(o);
              setChosen(c);
            }}
          />
          <Attachments
            label="Muster, Fotos, Datenblätter"
            group={project.group}
            attachments={liveRow ? (liveRow.attachments ?? []) : draft}
            onUpdate={(a) => (liveRow ? store.update('Decision', liveRow.id, { attachments: a }) : setDraft(a))}
          />
        </EntityForm>
      )}
    </>
  );
}
