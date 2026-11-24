// amplify_outputs.json only exists after a backend deploy (sandbox or
// hosting) and is not checked in. The glob simply yields nothing when the
// file is missing - the app then runs in trial mode with the local store.
const found = import.meta.glob<Record<string, unknown>>('../amplify_outputs.json', {
  eager: true,
  import: 'default',
});

const outputs = Object.values(found)[0];

/** A backend is only there if both the auth and the data block exist. */
export const cloudOutputs = outputs?.auth && outputs?.data ? outputs : null;

/** Address of the calendar feed function; only known once the backend is deployed. */
export const calendarUrl = (cloudOutputs?.custom as { calendarUrl?: string } | undefined)?.calendarUrl ?? null;
