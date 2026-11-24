import { defineFunction } from '@aws-amplify/backend';

/**
 * Manage project groups and members in Cognito. USER_POOL_ID and the IAM
 * permissions are set in backend.ts.
 *
 * resourceGroupName "data": the function is a resolver in the data stack;
 * without it the stacks end up with a circular dependency.
 */
export const projectFn = defineFunction({
  name: 'bp-project',
  entry: './handler.ts',
  runtime: 24,
  timeoutSeconds: 20,
  resourceGroupName: 'data',
});
