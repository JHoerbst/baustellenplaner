import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate } from '../lib/format';
import type { Plan } from '../lib/types';
import { PlanViewer } from '../ui/PlanViewer';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';

/** Offered while typing a category; any other text makes a new one. */
const USUAL_CATEGORIES = ['Grundriss', 'Entwurf', 'Schnitt', 'Ansicht', 'Einreichplan', 'Detail', 'Lageplan', 'Elektro', 'Installation'];
const NO_CATEGORY = 'Ohne Kategorie';

export default function Plans() {
  const { plans, rooms, project, save, store } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  /** Category that the next uploaded plans go into. */
  const [category, setCategory] = useState('');
  const [floor, setFloor] = useState('');
  const [status, setStatus] = useState('');
  const [opened, setOpened] = useState<Plan | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  // Categories in use first, in the order they were first used, then the usual ones.
  const used = [...new Set(plans.map((p) => p.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'de'));
  const suggestions = [...used, ...USUAL_CATEGORIES.filter((c) => !used.includes(c))];

  // Floors as they are already written on rooms and plans.
  const floors = [...new Set([...rooms.map((r) => r.floor), ...plans.map((p) => p.floor)].filter((f): f is string => !!f))].sort((a, b) =>
    a.localeCompare(b, 'de')
  );

  const fields: Field[] = [
    { name: 'title', label: 'Bezeichnung', required: true },
    { name: 'category', label: 'Kategorie', suggestions, half: true },
    { name: 'floor', label: 'Geschoss', suggestions: floors, half: true },
    { name: 'note', label: 'Notiz (z.B. Planstand, von wem)', type: 'textarea' },
  ];

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    setStatus('Lädt hoch …');
    try {
      for (const file of files) {
        const attachment = await store.upload(project.group, file);
        // The file name without extension makes a usable first title.
        await save('Plan', undefined, { title: file.name.replace(/\.[^.]+$/, ''), attachment, category: category.trim() || null, floor: floor.trim() || null });
      }
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function deletePlan(plan: Plan) {
    await store.remove('Plan', plan.id);
    await store.deleteFile(plan.group, plan.attachment).catch(console.error);
  }

  // One block per category; plans without one come last.
  const sections = [...used, null]
    .map((c) => ({
      name: c ?? NO_CATEGORY,
      // Within a category by floor, plans without a floor last, then by title.
      plans: plans
        .filter((p) => (p.category || null) === c)
        .sort((a, b) => (a.floor ?? '\uffff').localeCompare(b.floor ?? '\uffff', 'de') || a.title.localeCompare(b.title, 'de', { numeric: true })),
    }))
    .filter((s) => s.plans.length > 0);

  return (
    <>
      <PageTitle addLabel="Plan" onAdd={() => fileInput.current?.click()}>
        Pläne
      </PageTitle>

      <div className="photo-room">
        <label htmlFor="plan-category">Kategorie und Geschoss für die nächsten Pläne</label>
        <div>
          <input id="plan-category" list="plan-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="z.B. Grundriss" />
          <input list="plan-floors" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="z.B. EG" aria-label="Geschoss" className="plan-floor" />
          <datalist id="plan-floors">
            {floors.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <datalist id="plan-categories">
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="application/pdf,image/*"
        onChange={(e) => uploadFiles(e.target.files)}
      />
      {status && <p className="hint">{status}</p>}

      {plans.length === 0 && (
        <Empty>Noch kein Plan. Lad Grundrisse, Schnitte oder den Einreichplan als PDF oder Foto hoch, dann hast du sie auf der Baustelle zum Hineinzoomen dabei.</Empty>
      )}

      {sections.map((s) => (
        <section key={s.name} className="block">
          {/* A single block without a category needs no heading. */}
          {(sections.length > 1 || s.name !== NO_CATEGORY) && (
            <h2>
              {s.name} <small>{s.plans.length}</small>
            </h2>
          )}
          <ul className="list">
            {s.plans.map((p) => (
              <li key={p.id} className="row">
                <button type="button" className="row-main row-main--button" onClick={() => setOpened(p)}>
                  <strong>{p.title}</strong>
                  <span>{[p.floor, p.note, p.createdAt && `hochgeladen ${formatDate(p.createdAt)}`].filter(Boolean).join(', ')}</span>
                </button>
                <button type="button" className="icon-btn" onClick={() => setEditing(p)} aria-label={`${p.title} bearbeiten oder löschen`}>
                  <Pencil size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {opened && <PlanViewer title={opened.title} attachment={opened.attachment} group={opened.group} onClose={() => setOpened(null)} />}

      {editing && (
        <EntityForm
          title="Plan bearbeiten"
          fields={fields}
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(d) => save('Plan', editing.id, d)}
          onDelete={() => deletePlan(editing)}
        />
      )}
    </>
  );
}
