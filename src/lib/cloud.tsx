import { useEffect, useState, type ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '../../amplify/data/resource';
import type { Store } from './store';

type ClientResult<T> = { data?: T | null; errors?: readonly { message: string }[] };

/** Amplify reports errors in the errors field instead of throwing. */
function unwrap<T>(response: ClientResult<T>): T {
  if (response.errors?.length) throw new Error(response.errors[0].message);
  return response.data as T;
}

export function cloudStore(outputs: Record<string, unknown>): Store {
  Amplify.configure(outputs);
  I18n.putVocabularies(translations);
  I18n.setLanguage('de');

  const client = generateClient<Schema>();
  // The store is generic over all tables - the deeply nested Amplify
  // types cannot express that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelOf = (kind: string) => (client.models as any)[kind];

  return {
    cloud: true,

    watch(kind, projectId, cb) {
      const subscription = modelOf(kind)
        .observeQuery(projectId ? { filter: { projectId: { eq: projectId } } } : {})
        .subscribe({
          // Report only once everything is loaded - otherwise "no project" flashes up.
          next: (snapshot: { items: never[]; isSynced: boolean }) => snapshot.isSynced && cb([...snapshot.items]),
          error: (e: unknown) => console.error(`Subscription ${kind}`, e),
        });
      return () => subscription.unsubscribe();
    },

    async create(kind, payload) {
      return unwrap(await modelOf(kind).create(payload));
    },

    async update(kind, id, payload) {
      unwrap(await modelOf(kind).update({ id, ...payload }));
    },

    async remove(kind, id) {
      unwrap(await modelOf(kind).delete({ id }));
    },

    async createGroup() {
      const group = unwrap(await client.mutations.createProjectGroup());
      // The new group only shows up in the token after a refresh.
      await fetchAuthSession({ forceRefresh: true });
      return group;
    },

    async invite(group, email) {
      unwrap(await client.mutations.inviteMember({ group, email }));
    },

    async members(group) {
      const list = unwrap(await client.queries.members({ group })) ?? [];
      return list.filter((e): e is string => !!e);
    },

    async upload(group, file) {
      const key = `projects/${group}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      const contentType = file.type || 'application/octet-stream';
      const url = unwrap(await client.queries.fileUrl({ group, key, action: 'upload', contentType }));
      const response = await fetch(url, { method: 'PUT', body: file, headers: { 'content-type': contentType } });
      if (!response.ok) throw new Error(`Upload fehlgeschlagen (${response.status}).`);
      return { key, name: file.name, size: file.size };
    },

    async fileUrl(group, attachment) {
      return unwrap(await client.queries.fileUrl({ group, key: attachment.key, action: 'download' }));
    },

    async deleteFile(group, attachment) {
      unwrap(await client.mutations.deleteFile({ group, key: attachment.key }));
    },

    async logout() {
      await signOut();
    },
  };
}

function SignedIn({ children }: { children: (me: string) => ReactNode }) {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    // Refresh so that yesterday's invitation is in today's token.
    fetchAuthSession({ forceRefresh: true })
      .then(fetchUserAttributes)
      .then((a) => setMe(a.email ?? ''))
      .catch(() => setMe(''));
  }, []);
  return me === null ? <p className="hint">Lädt …</p> : <>{children(me)}</>;
}

/** Sign-in gate; accounts exist by invitation only, hence no "Sign up". */
export function SignIn({ children }: { children: (me: string) => ReactNode }) {
  return (
    <Authenticator
      hideSignUp
      components={{
        Header: () => <h1 className="signin-title">Baustellenplaner</h1>,
      }}
    >
      <SignedIn>{children}</SignedIn>
    </Authenticator>
  );
}
