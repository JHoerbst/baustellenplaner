import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useApp } from '../lib/app';
import { useFileUrl } from '../lib/fileUrl';
import { formatDate, isoDay, relativeDay, today } from '../lib/format';
import { photoReminders } from '../lib/reminders';
import { ROOM_FIELDS, roomLabel } from '../lib/rooms';
import type { Photo } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';
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
  const { photos, rooms, trades, assignments, project, save, store } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  /** Room that the next uploaded photos go into. */
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('');
  const [opened, setOpened] = useState<Photo | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);

  const reminders = photoReminders(assignments, trades);
  const roomOptions = rooms.map((r) => ({ value: r.id, label: roomLabel(r) }));

  const fields: Field[] = [
    { name: 'roomId', label: 'Raum', type: 'select', options: roomOptions, half: true },
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
        await save('Photo', undefined, { attachment, thumb, roomId: roomId || null, takenOn });
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

  // One block per room in room order; photos without a (still existing) room last.
  const known = new Set(rooms.map((r) => r.id));
  const sections = [...rooms.map((r) => ({ id: r.id as string | null, name: roomLabel(r) })), { id: null, name: NO_ROOM }]
    .map((s) => ({ ...s, photos: photos.filter((p) => (p.roomId && known.has(p.roomId) ? p.roomId : null) === s.id) }))
    .filter((s) => s.photos.length > 0);

  const title = (p: Photo) =>
    [sections.find((s) => s.photos.includes(p))?.name, formatDate(p.takenOn), p.description].filter(Boolean).join(', ');

  return (
    <>
      <PageTitle addLabel="Fotos" onAdd={() => fileInput.current?.click()}>
        Fotos
      </PageTitle>

      {reminders.map((r) => (
        <p key={r.id} className="reminder">
          {r.tradeName} kommt {relativeDay(r.startDate)}. Fotografier vorher jede Wand und jeden Boden mit einem Zollstock im Bild, damit du später
          weißt, wo Leitungen liegen.
        </p>
      ))}

      <div className="photo-room">
        <label htmlFor="photo-room">Raum für die nächsten Fotos</label>
        <div>
          <select id="photo-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">{NO_ROOM}</option>
            {roomOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => setAddingRoom(true)}>
            Neuer Raum
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" multiple hidden accept="image/*" onChange={(e) => uploadFiles(e.target.files)} />
      {status && <p className="hint">{status}</p>}

      {photos.length === 0 && <Empty>Noch kein Foto. Wähl oben den Raum und nimm dann Fotos auf; sie werden nach Raum und Datum abgelegt.</Empty>}

      {sections.map((s) => (
        <section key={s.id ?? 'none'} className="block">
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

      {opened && <PlanViewer title={title(opened)} attachment={opened.attachment} group={opened.group} onClose={() => setOpened(null)} />}

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

      {addingRoom && project && (
        <EntityForm
          title="Neuer Raum"
          fields={ROOM_FIELDS(rooms)}
          value={{}}
          onClose={() => setAddingRoom(false)}
          onSave={async (d) => {
            // Created through the store directly to get the id and select the new room.
            const created = await store.create('Room', { ...d, group: project.group, projectId: project.id } as never);
            setRoomId(created.id);
          }}
        />
      )}
    </>
  );
}
