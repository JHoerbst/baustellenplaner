import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { projectFn } from './functions/project/resource';
import { filesFn } from './functions/files/resource';
import { calendarFn } from './functions/calendar/resource';
import { CALENDAR_TABLES, tableEnv } from './functions/calendar/tables';

const backend = defineBackend({ auth, data, storage, projectFn, filesFn, calendarFn });

const userPool = backend.auth.resources.userPool;
const bucket = backend.storage.resources.bucket;

// Without this anyone could create an account for themselves. Set as an override
// on the single property so the invitation text from auth/resource.ts survives.
backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride(
  'AdminCreateUserConfig.AllowAdminCreateUserOnly',
  true
);

// Create project groups, invite members and list them.
backend.projectFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'cognito-idp:CreateGroup',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:ListUsersInGroup',
    ],
    resources: [userPool.userPoolArn],
  })
);
backend.projectFn.addEnvironment('USER_POOL_ID', userPool.userPoolId);

// A signed URL carries exactly the permissions of the function that issues it.
const filesLambda = backend.filesFn.resources.lambda;
bucket.grantRead(filesLambda, 'projects/*');
bucket.grantPut(filesLambda, 'projects/*');
bucket.grantDelete(filesLambda, 'projects/*');
backend.filesFn.addEnvironment('BUCKET_NAME', bucket.bucketName);

// Calendar feed: read-only on the tables it lists, reachable without sign-in
// because calendar apps cannot log in. The handler checks the project's token.
const calendarLambda = backend.calendarFn.resources.lambda;
for (const name of CALENDAR_TABLES) {
  const table = backend.data.resources.tables[name];
  table.grantReadData(calendarLambda);
  backend.calendarFn.addEnvironment(tableEnv(name), table.tableName);
}
const calendarUrl = calendarLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: { allowedOrigins: ['*'], allowedMethods: [HttpMethod.GET] },
});

backend.addOutput({ custom: { calendarUrl: calendarUrl.url } });
