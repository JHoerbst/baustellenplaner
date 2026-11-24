import { useState, type FormEvent } from 'react';
import { useApp } from '../lib/app';
import { TRADE_CATALOG, sortOrderFor } from '../lib/tradeCatalog';
import type { Trade } from '../lib/types';
import { Sheet, EntityForm, type Field } from '../ui/EntityForm';
import { PageTitle } from '../ui/Layout';
import Start from './Start';

const PROJECT_FIELDS: Field[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'address', label: 'Adresse der Baustelle' },
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
  const { project, projects, selectProject, trades, members, loadMembers, me, save, store } = useApp();
  const [editedTrade, setEditedTrade] = useState<Partial<Trade> | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!project) return null;

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
            <li key={m} className="row">
              <div className="row-main">
                <strong>{m}</strong>
                {m === me && <span>das bist du</span>}
              </div>
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

      {store.cloud && (
        <section className="block">
          <p className="hint">Angemeldet als {me}</p>
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
