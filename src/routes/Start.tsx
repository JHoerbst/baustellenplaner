import { useState, type FormEvent } from 'react';
import { useApp } from '../lib/app';
import { TRADE_CATALOG, sortOrderFor } from '../lib/tradeCatalog';

/** Create the first (or another) project, optionally with trades switched on. */
export default function Start({ onDone }: { onDone?: () => void }) {
  const { store, selectProject } = useApp();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure('');
    try {
      const group = await store.createGroup();
      const project = await store.create('Project', { group, name: name.trim(), address: address.trim() || null });
      await Promise.all(
        selected.map((g) =>
          store.create('Trade', { group, projectId: project.id, name: g, sortOrder: sortOrderFor(g, 0) })
        )
      );
      selectProject(project.id);
      onDone?.();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="form start" onSubmit={createProject}>
      <div className="field">
        <label htmlFor="p-name">Wie heißt euer Projekt?</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zubau 2027" required autoFocus data-focus="" />
      </div>
      <div className="field">
        <label htmlFor="p-address">Adresse der Baustelle</label>
        <input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="field">
        <span className="field-title" id="p-trades">Welche Gewerke stehen an? (später jederzeit änderbar)</span>
        <div className="chips" role="group" aria-labelledby="p-trades">
          {TRADE_CATALOG.map((name) => {
            const isOn = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={isOn}
                // Functional update: several quick taps must not overwrite each other.
                onClick={() => setSelected((now) => (now.includes(name) ? now.filter((g) => g !== name) : [...now, name]))}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      {failure && (
        <p className="error" role="alert">
          {failure}
        </p>
      )}
      <footer className="form-footer">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Projekt anlegen
        </button>
      </footer>
    </form>
  );
}
