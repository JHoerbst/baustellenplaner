import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useApp } from '../lib/app';
import { useFileUrl } from '../lib/fileUrl';
import { formatDate, isoDay, relativeDay, today } from '../lib/format';
import { photoReminders } from '../lib/reminders';
import type { Photo } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { DocsSwitch, Empty, PageTitle } from '../ui/Layout';
import { PlanViewer } from '../ui/PlanViewer';

/** Longest edge of the stored preview image, in pixels. */
const THUMB_SIZE = 480;
const NO_ROOM = 'Ohne Raum';

/** Small JPEG preview so the grid does not have to load full-size photos. */
async function makeThumb(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    return blob && new File([blob], `thumb-${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    // Format the browser cannot decode: the grid falls back to the original.
    return null;
  }
}

function Thumb({ photo }: { photo: Photo }) {
  const { store } = useApp();
  const url = useFileUrl(store, photo.group, photo.thumb ?? photo.attachment);
  return url ? <img src={url} alt={photo.description ?? ''} loading="lazy" /> : null;
}

/**
 * Site photos by room and date. Main use: photograph every wall before it
 * is plastered and every floor before the screed, to know later where
 * pipes and cables run.
 */
export default function Photos() {
  const { photos, trades, assignments, project, save, store } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const [opened, setOpened] = useState<Photo | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);

  const rooms = [...new Set(photos.map((p) => p.room).filter((r): r is string => !!r))].sort((a, b) =>
    a.localeCompare(b, 'de')
  );
  const reminders = photoReminders(assignments, trades);

  const fields: Field[] = [
    { name: 'room', label: 'Raum', suggestions: rooms, half: true },
    { name: 'takenOn', label: 'Aufgenommen am', type: 'date', required: true, half: true },
    { name: 'description', label: 'Was ist zu sehen?', type: 'textarea' },
    { name: 'tradeId', label: 'Gewerk', type: 'select', options: trades.map((t) => ({ value: t.id, label: t.name })) },
  ];

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    try {
      let n = 0;
      for (const file of files) {
        setStatus(`Lädt hoch … ${++n} von ${files.length}`);
        const thumbFile = await makeThumb(file);
        const attachment = await store.upload(project.group, file);
        const thumb = thumbFile ? await store.upload(project.group, thumbFile) : null;
        // The file's own date is when the photo was taken, not when it is uploaded.
        const takenOn = file.lastModified ? isoDay(new Date(file.lastModified)) : today();
        await save('Photo', undefined, { attachment, thumb, room: room.trim() || null, takenOn });
      }
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function deletePhoto(photo: Photo) {
    await store.remove('Photo', photo.id);
    await store.deleteFile(photo.group, photo.attachment).catch(console.error);
    if (photo.thumb) await store.deleteFile(photo.group, photo.thumb).catch(console.error);
  }

  // One block per room, rooms alphabetically, photos without a room last.
  const sections = [...rooms, null]
    .map((r) => ({ name: r ?? NO_ROOM, photos: photos.filter((p) => (p.room || null) === r) }))
    .filter((s) => s.photos.length > 0);

  return (
    <>
      <PageTitle addLabel="Fotos" onAdd={() => fileInput.current?.click()}>
        Fotos
      </PageTitle>
      <DocsSwitch />

      {reminders.map((r) => (
        <p key={r.id} className="reminder">
          {r.tradeName} kommt {relativeDay(r.startDate)}. Fotografier vorher jede Wand und jeden Boden mit einem Zollstock im Bild, damit du später
          weißt, wo Leitungen liegen.
        </p>
      ))}

      <div className="field photo-room">
        <label htmlFor="photo-room">Raum für die nächsten Fotos</label>
        <input id="photo-room" list="photo-rooms" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="z.B. Bad OG" />
        <datalist id="photo-rooms">
          {rooms.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <input ref={fileInput} type="file" multiple hidden accept="image/*" onChange={(e) => uploadFiles(e.target.files)} />
      {status && <p className="hint">{status}</p>}

      {photos.length === 0 && (
        <Empty>Noch kein Foto. Trag oben den Raum ein und nimm dann Fotos auf; sie werden nach Raum und Datum abgelegt.</Empty>
      )}

      {sections.map((s) => (
        <section key={s.name} className="block">
          <h2>
            {s.name} <small>{s.photos.length}</small>
          </h2>
          <ul className="photo-grid">
            {s.photos.map((p) => (
              <li key={p.id} className="photo">
                <button type="button" className="photo-open" onClick={() => setOpened(p)} aria-label={`Foto vom ${formatDate(p.takenOn)} öffnen`}>
                  <Thumb photo={p} />
                  <span>{[formatDate(p.takenOn), p.description].filter(Boolean).join(', ')}</span>
                </button>
                <button type="button" className="icon-btn photo-edit" onClick={() => setEditing(p)} aria-label="Foto bearbeiten">
                  <Pencil size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {opened && (
        <PlanViewer
          title={[opened.room, formatDate(opened.takenOn), opened.description].filter(Boolean).join(', ')}
          attachment={opened.attachment}
          group={opened.group}
          onClose={() => setOpened(null)}
        />
      )}

      {editing && (
        <EntityForm
          title="Foto bearbeiten"
          fields={fields}
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(d) => save('Photo', editing.id, d)}
          onDelete={() => deletePhoto(editing)}
        />
      )}
    </>
  );
}
