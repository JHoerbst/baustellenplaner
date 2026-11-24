import { defineFunction } from '@aws-amplify/backend';

/** Signed URLs for project files. BUCKET_NAME and permissions are set in backend.ts. */
export const filesFn = defineFunction({
  name: 'bp-files',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
});
