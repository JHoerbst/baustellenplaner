import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate } from '../lib/format';
import type { Plan } from '../lib/types';
import { PlanViewer } from '../ui/PlanViewer';
import { EntityForm, type Field } from '../ui/EntityForm';
import { DocsSwitch, Empty, PageTitle } from '../ui/Layout';

const FIELDS: Field[] = [
  { name: 'title', label: 'Bezeichnung', required: true },
  { name: 'note', label: 'Notiz (z.B. Planstand, von wem)', type: 'textarea' },
];

export default function Plans() {
  const { plans, project, save, store } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [opened, setOpened] = useState<Plan | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    setStatus('Lädt hoch …');
    try {
      for (const file of files) {
        const attachment = await store.upload(project.group, file);
        // The file name without extension makes a usable first title.
        await save('Plan', undefined, { title: file.name.replace(/\.[^.]+$/, ''), attachment });
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

  return (
    <>
      <PageTitle addLabel="Plan" onAdd={() => fileInput.current?.click()}>
        Pläne
      </PageTitle>
      <DocsSwitch />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="application/pdf,image/*"
        onChange={(e) => uploadFiles(e.target.files)}
      />
      {status && <p className="hint">{status}</p>}

      {plans.length === 0 ? (
        <Empty>Noch kein Plan. Lad Grundrisse, Schnitte oder den Einreichplan als PDF oder Foto hoch, dann hast du sie auf der Baustelle zum Hineinzoomen dabei.</Empty>
      ) : (
        <ul className="list">
          {plans.map((p) => (
            <li key={p.id} className="row">
              <button type="button" className="row-main row-main--button" onClick={() => setOpened(p)}>
                <strong>{p.title}</strong>
                <span>{[p.note, p.createdAt && `hochgeladen ${formatDate(p.createdAt)}`].filter(Boolean).join(', ')}</span>
              </button>
              <button type="button" className="icon-btn" onClick={() => setEditing(p)} aria-label={`${p.title} umbenennen oder löschen`}>
                <Pencil size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {opened && <PlanViewer title={opened.title} attachment={opened.attachment} group={opened.group} onClose={() => setOpened(null)} />}

      {editing && (
        <EntityForm
          title="Plan bearbeiten"
          fields={FIELDS}
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(d) => save('Plan', editing.id, d)}
          onDelete={() => deletePlan(editing)}
        />
      )}
    </>
  );
}
