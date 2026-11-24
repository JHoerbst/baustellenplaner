import type { Kind, Attachment, New, Tables } from './types';

/**
 * The only interface between UI and data. Two implementations: cloud.tsx
 * (Amplify) and the local store below, which runs in the browser without a
 * backend - for trying the app out and for development.
 */
export interface Store {
  cloud: boolean;
  /** Delivers all rows immediately and on every change; the return value ends the subscription. */
  watch<A extends Kind>(kind: A, projectId: string | null, cb: (rows: Tables[A][]) => void): () => void;
  create<A extends Kind>(kind: A, payload: New<A>): Promise<Tables[A]>;
  update<A extends Kind>(kind: A, id: string, payload: Partial<New<A>>): Promise<void>;
  remove(kind: Kind, id: string): Promise<void>;
  /** Creates the access group for a new project. */
  createGroup(): Promise<string>;
  invite(group: string, email: string): Promise<void>;
  members(group: string): Promise<string[]>;
  upload(group: string, file: File): Promise<Attachment>;
  fileUrl(group: string, attachment: Attachment): Promise<string>;
  deleteFile(group: string, attachment: Attachment): Promise<void>;
  logout(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local store: tables in localStorage, files in IndexedDB.

type Row = { id: string; projectId?: string };

const storageKey = (kind: Kind) => `bp:${kind}`;
const readRows = (kind: Kind): Row[] => JSON.parse(localStorage.getItem(storageKey(kind)) ?? '[]');
const listeners = new Set<() => void>();

function writeRows(kind: Kind, rows: Row[]) {
  localStorage.setItem(storageKey(kind), JSON.stringify(rows));
  listeners.forEach((h) => h());
}

function fileDb(): Promise<IDBObjectStore> {
  return new Promise((ok, failure) => {
    const opened = indexedDB.open('bp-files', 1);
    opened.onupgradeneeded = () => opened.result.createObjectStore('files');
    opened.onerror = () => failure(opened.error);
    opened.onsuccess = () => ok(opened.result.transaction('files', 'readwrite').objectStore('files'));
  });
}

const requestDone = <T>(request: IDBRequest<T>) =>
  new Promise<T>((ok, failure) => {
    request.onsuccess = () => ok(request.result);
    request.onerror = () => failure(request.error);
  });

export const localStore: Store = {
  cloud: false,

  watch(kind, projectId, cb) {
    const notify = () =>
      cb(readRows(kind).filter((z) => !projectId || z.projectId === projectId) as never);
    listeners.add(notify);
    notify();
    return () => listeners.delete(notify);
  },

  async create(kind, payload) {
    const row = { ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    writeRows(kind, [...readRows(kind), row]);
    return row as never;
  },

  async update(kind, id, payload) {
    writeRows(kind, readRows(kind).map((z) => (z.id === id ? { ...z, ...payload } : z)));
  },

  async remove(kind, id) {
    writeRows(kind, readRows(kind).filter((z) => z.id !== id));
  },

  async createGroup() {
    return `p-${crypto.randomUUID()}`;
  },

  async invite() {
    throw new Error('Einladen geht erst mit dem Cloud-Backend. Im Probiermodus bleiben die Daten in diesem Browser.');
  },

  async members() {
    return ['Ich', 'Partner:in'];
  },

  async upload(group, file) {
    const attachment = { key: `projects/${group}/${crypto.randomUUID()}`, name: file.name, size: file.size };
    await requestDone((await fileDb()).put(file, attachment.key));
    return attachment;
  },

  async fileUrl(_group, attachment) {
    const blob = await requestDone<Blob | undefined>((await fileDb()).get(attachment.key));
    if (!blob) throw new Error('Die Datei ist in diesem Browser nicht mehr vorhanden.');
    return URL.createObjectURL(blob);
  },

  async deleteFile(_group, attachment) {
    await requestDone((await fileDb()).delete(attachment.key));
  },

  async logout() {},
};
