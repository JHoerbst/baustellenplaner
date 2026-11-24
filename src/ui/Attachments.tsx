import { useRef, useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { useApp } from '../lib/app';
import type { Attachment } from '../lib/types';

/**
 * Files on an entry: upload (on a phone also straight from the camera), open,
 * remove. The list itself is owned by the caller - that way it also works
 * for an entry that has not been saved yet.
 */
export function Attachments({
  group,
  attachments,
  onUpdate,
  label = 'Dateien',
}: {
  group: string;
  attachments: Attachment[];
  onUpdate: (attachments: Attachment[]) => void | Promise<void>;
  label?: string;
}) {
  const { store } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setStatus('Lädt hoch …');
    try {
      const next: Attachment[] = [];
      for (const file of files) next.push(await store.upload(group, file));
      await onUpdate([...attachments, ...next]);
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function openAttachment(attachment: Attachment) {
    // Open the window right away: after the await Safari blocks the popup.
    const popup = window.open('', '_blank');
    try {
      const url = await store.fileUrl(group, attachment);
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch (e) {
      popup?.close();
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  async function detach(attachment: Attachment) {
    if (!window.confirm(`„${attachment.name}“ entfernen?`)) return;
    await onUpdate(attachments.filter((d) => d.key !== attachment.key));
    await store.deleteFile(group, attachment).catch(console.error);
  }

  return (
    <>
      <label htmlFor="attachments">{label}</label>
      <ul className="attachment-list">
        {attachments.map((d) => (
          <li key={d.key}>
            <button type="button" className="link" onClick={() => openAttachment(d)}>
              <Paperclip size={16} aria-hidden /> {d.name}
            </button>
            <button type="button" className="icon-btn" onClick={() => detach(d)} aria-label={`${d.name} entfernen`}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <input
        id="attachments"
        ref={fileInput}
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={(e) => uploadFiles(e.target.files)}
      />
      {status && <p className="hint">{status}</p>}
    </>
  );
}
