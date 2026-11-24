import { defineFunction } from '@aws-amplify/backend';

/**
 * Calendar feed (iCalendar) of a project, for subscribing in Google or Apple
 * Calendar. Reached through a public Function URL and protected by a secret
 * token per project, because calendar apps cannot sign in. The table names
 * and read permissions are set in backend.ts.
 */
export const calendarFn = defineFunction({
  name: 'bp-calendar',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 20,
  resourceGroupName: 'data',
});
