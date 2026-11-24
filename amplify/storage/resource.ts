import { defineStorage } from '@aws-amplify/backend';

/**
 * Quotes, plans, photos - stored under projects/<group>/.
 *
 * Deliberately WITHOUT access rules: Amplify only knows static groups there,
 * but project groups are created at runtime. The Lambda in functions/files
 * checks membership and hands out signed URLs.
 *
 * keepOnDelete: otherwise Amplify deletes the bucket and its contents as soon
 * as it disappears from the code - a rename is enough.
 */
export const storage = defineStorage({
  name: 'siteFiles',
  keepOnDelete: true,
});
