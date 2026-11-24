import { useState } from 'react';
import { useApp } from '../lib/app';
import { roomLabel } from '../lib/rooms';
import { formatDate, relativeDay, daysUntil } from '../lib/format';
import type { Task } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle, TasksSwitch } from '../ui/Layout';

export default function Tasks() {
  const { tasks, trades, rooms, members, memberName, me, save, store } = useApp();
  const roomName = (id?: string | null) => {
    const room = rooms.find((r) => r.id === id);
    return room && roomLabel(room);
  };
  const [opened, setOpened] = useState<Partial<Task> | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const tradeName = (id?: string | null) => trades.find((g) => g.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Was ist zu tun?', required: true },
    { name: 'assignee', label: 'Wer kümmert sich?', type: 'select', half: true, options: members.map((m) => ({ value: m, label: memberName(m) })) },
    { name: 'dueDate', label: 'Fällig am', type: 'date', half: true },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'roomId', label: 'Raum', type: 'select', half: true, options: rooms.map((r) => ({ value: r.id, label: roomLabel(r) })) },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ];

  const visible = tasks.filter((a) => !onlyMine || a.assignee === me);
  // With a due date first, earliest on top; without one after that.
  const todo = visible
    .filter((a) => !a.done)
    .sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
  const done = visible.filter((a) => a.done);

  const row = (a: Task) => (
    <li key={a.id} className="row">
      <input
        type="checkbox"
        className="checkbox"
        checked={a.done}
        onChange={() => store.update('Task', a.id, { done: !a.done })}
        aria-label={a.done ? `${a.title} wieder öffnen` : `${a.title} abhaken`}
      />
      <button type="button" className={`row-main row-main--button${a.done ? ' is-faded' : ''}`} onClick={() => setOpened(a)}>
        <strong>{a.title}</strong>
        <span>
          {a.dueDate && !a.done && (
            <span className={daysUntil(a.dueDate) < 0 ? 'is-urgent' : undefined}>
              {formatDate(a.dueDate)} ({relativeDay(a.dueDate)}){' '}
            </span>
          )}
          {[memberName(a.assignee), tradeName(a.tradeId), roomName(a.roomId)].filter(Boolean).join(', ')}
        </span>
      </button>
    </li>
  );

  return (
    <>
      <PageTitle addLabel="Aufgabe" onAdd={() => setOpened({ assignee: members.includes(me) ? me : undefined })}>
        Aufgaben
      </PageTitle>
      <TasksSwitch />

      <div className="toggle" role="group" aria-label="Filter">
        <button type="button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>
          Alle
        </button>
        <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>
          Meine
        </button>
      </div>

      {todo.length === 0 ? (
        <Empty>{tasks.length === 0 ? 'Noch keine Aufgabe. Schreib auf, was ihr klären, bestellen oder entscheiden müsst.' : 'Alles erledigt.'}</Empty>
      ) : (
        <ul className="list">{todo.map(row)}</ul>
      )}

      {done.length > 0 && (
        <details className="block">
          <summary>Erledigt ({done.length})</summary>
          <ul className="list">{done.map(row)}</ul>
        </details>
      )}

      {opened && (
        <EntityForm
          title={opened.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => save('Task', opened.id, { ...d, done: opened.done ?? false })}
          onDelete={opened.id ? () => store.remove('Task', opened.id!) : undefined}
        />
      )}
    </>
  );
}
