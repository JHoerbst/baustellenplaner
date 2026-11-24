import { useEffect, useState } from 'react';
import type { Store } from './store';
import type { Attachment } from './types';

/** Signed URLs live for five minutes; ask for a new one a little earlier. */
const MAX_AGE_MS = 4 * 60 * 1000;

const cache = new Map<string, { url: Promise<string>; at: number }>();

/**
 * URL of a stored file for use in <img>. Cached per file key so a grid of
 * thumbnails does not ask the backend again on every render.
 */
export function useFileUrl(store: Store, group: string, attachment: Attachment | null | undefined): string {
  const [url, setUrl] = useState('');
  const key = attachment?.key;

  useEffect(() => {
    if (!attachment || !key) return setUrl('');
    let cancelled = false;
    let hit = cache.get(key);
    // Local blob URLs never expire, signed cloud URLs do.
    if (!hit || (store.cloud && Date.now() - hit.at > MAX_AGE_MS)) {
      hit = { url: store.fileUrl(group, attachment), at: Date.now() };
      cache.set(key, hit);
    }
    hit.url.then(
      (u) => !cancelled && setUrl(u),
      () => cache.delete(key)
    );
    return () => {
      cancelled = true;
    };
    // The attachment object changes identity on every data update; its key does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, group, key]);

  return url;
}
