import { useState, type FormEvent } from 'react';
import { useApp } from '../lib/app';
import { formatDate, formatTime } from '../lib/format';
import type { Note } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { PageTitle } from '../ui/Layout';

/** From this many notes on, the search field is worth showing. */
const SEARCH_FROM = 6;

/**
 * Jot things down while someone is on the phone: the text field is ready at
 * once, everything else (company, trade) is optional and can follow later.
 */
export default function Notes() {
  const { notes, companies, trades, me, memberName, save, store } = useApp();
  const [text, setText] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<Note | null>(null);
  const [failure, setFailure] = useState('');

  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;
  const tradeName = (id?: string | null) => trades.find((g) => g.id === id)?.name;

  const fields: Field[] = [
    { name: 'text', label: 'Notiz', type: 'textarea', required: true },
    { name: 'companyId', label: 'Firma', type: 'select', half: true, options: companies.map((f) => ({ value: f.id, label: f.name })) },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
  ];

  async function saveNote(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setFailure('');
    try {
      await save('Note', undefined, { text: text.trim(), companyId: companyId || null, author: me });
      setText('');
      setCompanyId('');
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? notes.filter((n) => [n.text, companyName(n.companyId), tradeName(n.tradeId)].join(' ').toLowerCase().includes(term))
    : notes;

  return (
    <>
      <PageTitle>Notizen</PageTitle>

      <form className="note-new" onSubmit={saveNote}>
        <label htmlFor="n-text">Neue Notiz</label>
        <textarea
          id="n-text"
          rows={4}
          autoFocus
          value={text}
          placeholder="Was wurde besprochen?"
          onChange={(e) => setText(e.target.value)}
          // Ctrl/Cmd+Enter saves without leaving the keyboard.
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && saveNote()}
        />
        <div className="note-footer">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Mit welcher Firma?">
            <option value="">Mit wem? (freiwillig)</option>
            {companies.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            Notiz speichern
          </button>
        </div>
        {failure && (
          <p className="error" role="alert">
            {failure}
          </p>
        )}
      </form>

      {notes.length >= SEARCH_FROM && (
        <input
          type="search"
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Notizen durchsuchen"
          aria-label="Notizen durchsuchen"
        />
      )}

      {visible.length > 0 && (
        <ul className="list">
          {visible.map((n) => (
            <li key={n.id}>
              <button type="button" className="row row--button" onClick={() => setOpened(n)}>
                <div className="row-main">
                  <p className="note-text">{n.text}</p>
                  <span>
                    {[n.createdAt && `${formatDate(n.createdAt)}, ${formatTime(n.createdAt)}`, companyName(n.companyId), tradeName(n.tradeId), memberName(n.author)]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term && visible.length === 0 && <p className="empty">Keine Notiz enthält „{search.trim()}“.</p>}

      {opened && (
        <EntityForm
          title="Notiz bearbeiten"
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => save('Note', opened.id, d)}
          onDelete={() => store.remove('Note', opened.id)}
        />
      )}
    </>
  );
}
