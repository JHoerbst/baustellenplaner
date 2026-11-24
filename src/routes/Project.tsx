import { useState, type FormEvent } from 'react';
import { useApp } from '../lib/app';
import { calendarUrl } from '../outputs';
import { ROOM_FIELDS, ROOM_LIST_FIELDS, parseRoomList, roomLabel } from '../lib/rooms';
import { TRADE_CATALOG, sortOrderFor } from '../lib/tradeCatalog';
import type { Room, Trade } from '../lib/types';
import { Sheet, EntityForm, type Field } from '../ui/EntityForm';
import { PageTitle } from '../ui/Layout';
import Start from './Start';

const PROJECT_FIELDS: Field[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'address', label: 'Adresse der Baustelle' },
  { name: 'budget', label: 'Gesamtbudget', type: 'amount', half: true },
  { name: 'reserve', label: 'davon Puffer', type: 'amount', half: true },
  { name: 'householdSize', label: 'Wie viele seid ihr selbst? (zählt beim Essen im Zeitplan mit)', type: 'integer' },
  { name: 'note', label: 'Notiz', type: 'textarea' },
];

const TRADE_FIELDS: Field[] = [
  { name: 'name', label: 'Gewerk', required: true },
  {
    name: 'selfPerformed',
    label: 'Wer macht das?',
    type: 'select',
    required: true,
    options: [
      { value: 'no', label: 'Eine Firma' },
      { value: 'yes', label: 'Wir selbst' },
    ],
  },
];

export default function ProjectPage() {
  const { project, projects, selectProject, trades, rooms, members, memberName, loadMembers, me, save, store } = useApp();
  /** Email of the member whose nickname is being edited. */
  const [naming, setNaming] = useState<string | null>(null);
  const [editedRoom, setEditedRoom] = useState<Partial<Room> | null>(null);
  /** Label of the calendar link that was just copied. */
  const [copied, setCopied] = useState('');
  const [pastingRooms, setPastingRooms] = useState(false);
  const [editedTrade, setEditedTrade] = useState<Partial<Trade> | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!project) return null;

  // The feed states which time zone it belongs to; take the one of this device.
  const timezone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Two UUIDs give 244 random bits; the token is the only thing protecting the feed.
  const newCalendarToken = () =>
    store.update('Project', project.id, { calendarToken: `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '') });

  const missing = TRADE_CATALOG.filter((name) => !trades.some((g) => g.name === name));
  const maxSortOrder = Math.max(-1, ...trades.map((g) => g.sortOrder ?? 0));

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await store.invite(project!.group, email);
      setNotice(`${email} ist eingeladen und bekommt eine E-Mail mit den Zugangsdaten.`);
      setEmail('');
      loadMembers();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  return (
    <>
      <PageTitle>Projekt</PageTitle>

      <section className="block">
        <h2>{project.name}</h2>
        <p className="figure">{project.address || 'Keine Adresse hinterlegt'}</p>
        {project.note && <p className="hint">{project.note}</p>}
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Bearbeiten
          </button>
          <button type="button" className="btn" onClick={() => setAddingProject(true)}>
            Weiteres Projekt anlegen
          </button>
        </div>
        {projects && projects.length > 1 && (
          <div className="field">
            <label htmlFor="p-switch">Projekt wechseln</label>
            <select id="p-switch" value={project.id} onChange={(e) => selectProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="block">
        <h2>Wer mitplant</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m}>
              <button type="button" className="row row--button" onClick={() => setNaming(m)} aria-label={`Namen für ${m} ändern`}>
                <div className="row-main">
                  <strong>{memberName(m)}</strong>
                  <span>{[m, m === me && 'das bist du'].filter(Boolean).join(', ')}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <form className="invite" onSubmit={invite}>
          <label htmlFor="m-email">Jemanden per E-Mail einladen</label>
          <div>
            <input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.at" required />
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Einladen
            </button>
          </div>
          {notice && <p className="hint" role="status">{notice}</p>}
        </form>
      </section>

      <section className="block">
        <div className="page-title">
          <h2>Räume</h2>
          <div className="btn-row btn-row--tight">
            <button type="button" className="btn" onClick={() => setPastingRooms(true)}>
              Mehrere einfügen
            </button>
            <button type="button" className="btn" onClick={() => setEditedRoom({})}>
              Raum hinzufügen
            </button>
          </div>
        </div>
        {rooms.length === 0 ? (
          <p className="empty">Noch kein Raum. Leg die Räume einmal an, dann kannst du Fotos, Mängel und Aufgaben zuordnen.</p>
        ) : (
          <ul className="list">
            {rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className="row row--button" onClick={() => setEditedRoom(r)}>
                  <div className="row-main">
                    <strong>{roomLabel(r)}</strong>
                  </div>
                  {r.area != null && (
                    <div className="row-amount">
                      <strong>{r.area.toLocaleString('de-AT', { minimumFractionDigits: 2 })} m²</strong>
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <div className="page-title">
          <h2>Gewerke</h2>
          <button type="button" className="btn" onClick={() => setEditedTrade({})}>
            Eigenes Gewerk
          </button>
        </div>
        <ul className="list">
          {trades.map((g) => (
            <li key={g.id}>
              <button type="button" className="row row--button" onClick={() => setEditedTrade(g)}>
                <div className="row-main">
                  <strong>{g.name}</strong>
                  {g.selfPerformed && <span>machen wir selbst</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {trades.length === 0 && <p className="empty">Noch kein Gewerk. Schalt unten zu, was bei euch ansteht.</p>}
        {missing.length > 0 && (
          <>
            <p className="hint">Zuschalten:</p>
            <div className="chips">
              {missing.map((name) => (
                <button key={name} type="button" className="chip" onClick={() => save('Trade', undefined, { name, sortOrder: sortOrderFor(name, maxSortOrder) })}>
                  + {name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {calendarUrl && (
        <section className="block">
          <h2>Kalender-Abo</h2>
          {project.calendarToken ? (
            <>
              <p className="hint">
                Füg einen der Links in deinem Kalender als Abo hinzu (Google Kalender: „Weitere Kalender“, dann „Per URL“). Der Kalender holt Änderungen von
                selbst ab, bei Google kann das einige Stunden dauern.
              </p>
              {[
                { label: 'Nur Termine', url: `${calendarUrl}?p=${project.id}&t=${project.calendarToken}&tz=${timezone}&nur=termine` },
                { label: 'Termine, Fristen und Einsätze', url: `${calendarUrl}?p=${project.id}&t=${project.calendarToken}&tz=${timezone}` },
              ].map((link) => (
                <div key={link.label} className="field calendar-link">
                  <label htmlFor={`cal-${link.label}`}>{link.label}</label>
                  <div>
                    <input id={`cal-${link.label}`} readOnly value={link.url} onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(link.url).then(() => setCopied(link.label))}>
                      {copied === link.label ? 'Kopiert' : 'Kopieren'}
                    </button>
                  </div>
                </div>
              ))}
              <p className="hint">Wer einen Link kennt, kann die Einträge ohne Anmeldung lesen. Mit einem neuen Link wird der alte ungültig.</p>
              <button
                type="button"
                className="btn"
                onClick={() => window.confirm('Neuen Link erzeugen? Bestehende Kalender-Abos hören dann auf zu funktionieren.') && newCalendarToken()}
              >
                Neuen Link erzeugen
              </button>
            </>
          ) : (
            <>
              <p className="hint">Termine, Fristen und Einsätze im eigenen Kalender sehen, in Google Kalender oder am iPhone.</p>
              <button type="button" className="btn" onClick={newCalendarToken}>
                Kalender-Link erzeugen
              </button>
            </>
          )}
        </section>
      )}

      {store.cloud && (
        <section className="block">
          <p className="hint">
            Angemeldet als {memberName(me)} ({me})
          </p>
          <button type="button" className="btn" onClick={() => store.logout()}>
            Abmelden
          </button>
        </section>
      )}

      {editing && (
        <EntityForm
          title="Projekt bearbeiten"
          fields={PROJECT_FIELDS}
          value={project}
          onClose={() => setEditing(false)}
          onSave={(d) => store.update('Project', project.id, d)}
        />
      )}

      {pastingRooms && (
        <EntityForm
          title="Mehrere Räume einfügen"
          fields={ROOM_LIST_FIELDS(rooms)}
          value={{}}
          onClose={() => setPastingRooms(false)}
          onSave={async (d) => {
            for (const room of parseRoomList(String(d.list ?? ''))) {
              await save('Room', undefined, { ...room, floor: (d.floor as string | null) ?? null });
            }
          }}
        />
      )}

      {naming && (
        <EntityForm
          title="Name ändern"
          fields={[{ name: 'name', label: `Wie soll ${naming} in der App heißen?`, required: true }]}
          value={{ id: naming, name: memberName(naming) }}
          onClose={() => setNaming(null)}
          onSave={(d) =>
            store.update('Project', project.id, {
              memberNames: [...(project.memberNames ?? []).filter((m) => m.email !== naming), { email: naming, name: String(d.name) }],
            })
          }
        />
      )}

      {editedRoom && (
        <EntityForm
          title={editedRoom.id ? 'Raum bearbeiten' : 'Neuer Raum'}
          fields={ROOM_FIELDS(rooms)}
          value={editedRoom}
          onClose={() => setEditedRoom(null)}
          onSave={(d) => save('Room', editedRoom.id, d)}
          onDelete={editedRoom.id ? () => store.remove('Room', editedRoom.id!) : undefined}
        />
      )}

      {editedTrade && (
        <EntityForm
          title={editedTrade.id ? 'Gewerk bearbeiten' : 'Neues Gewerk'}
          fields={TRADE_FIELDS}
          value={{ ...editedTrade, selfPerformed: editedTrade.selfPerformed ? 'yes' : 'no' }}
          onClose={() => setEditedTrade(null)}
          onSave={(d) =>
            save('Trade', editedTrade.id, {
              ...d,
              selfPerformed: d.selfPerformed === 'yes',
              sortOrder: editedTrade.sortOrder ?? sortOrderFor(String(d.name), maxSortOrder),
            })
          }
          onDelete={editedTrade.id ? () => store.remove('Trade', editedTrade.id!) : undefined}
        />
      )}

      {addingProject && (
        <Sheet title="Neues Projekt" onClose={() => setAddingProject(false)}>
          <Start onDone={() => setAddingProject(false)} />
        </Sheet>
      )}
    </>
  );
}
