import type { AppSyncIdentityCognito, AppSyncResolverEvent } from 'aws-lambda';

/** Project groups are named "p-<uuid>" - see functions/project/handler.ts. */
const GROUP_PATTERN = /^p-[0-9a-f-]{36}$/;

export type ResolverEvent = AppSyncResolverEvent<Record<string, string | null | undefined>>;

export function identityOf(event: ResolverEvent): AppSyncIdentityCognito {
  const id = event.identity as AppSyncIdentityCognito | null | undefined;
  if (!id?.username) throw new Error('Nicht angemeldet.');
  return id;
}

/** Throws unless the caller is a member of the project group. */
export function requireMember(event: ResolverEvent, group: string | null | undefined): string {
  const id = identityOf(event);
  if (!group || !GROUP_PATTERN.test(group) || !(id.groups ?? []).includes(group)) {
    throw new Error('Kein Zugriff auf dieses Projekt.');
  }
  return group;
}
