import type { AppSyncIdentityCognito } from 'aws-lambda';

/** Project groups are named "p-<uuid>" - see functions/project/handler.ts. */
const GROUP_PATTERN = /^p-[0-9a-f-]{36}$/;

/**
 * What Amplify passes to a function used as a data handler. The field name
 * sits at the top level; a direct AppSync Lambda resolver would carry it
 * under "info" instead, so fieldNameOf accepts both.
 */
export type ResolverEvent = {
  typeName?: string;
  fieldName?: string;
  info?: { fieldName?: string };
  arguments?: Record<string, string | null | undefined>;
  identity?: unknown;
};

export function fieldNameOf(event: ResolverEvent): string {
  return event.fieldName ?? event.info?.fieldName ?? '';
}

/** Arguments of the call; empty for operations that take none. */
export const argsOf = (event: ResolverEvent) => event.arguments ?? {};

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
