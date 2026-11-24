import { randomUUID } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  ListUsersInGroupCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { identityOf, requireMember, type ResolverEvent } from '../shared/group';

const cognito = new CognitoIdentityProviderClient({});
const UserPoolId = process.env.USER_POOL_ID!;

/** One handler for several schema fields, dispatched by fieldName. */
export const handler = async (event: ResolverEvent) => {
  const args = event.arguments;
  switch (event.info.fieldName) {
    case 'createProjectGroup': {
      const GroupName = `p-${randomUUID()}`;
      await cognito.send(new CreateGroupCommand({ UserPoolId, GroupName }));
      await cognito.send(
        new AdminAddUserToGroupCommand({ UserPoolId, GroupName, Username: identityOf(event).username })
      );
      return GroupName;
    }

    case 'inviteMember': {
      const GroupName = requireMember(event, args.group);
      const email = (args.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Das ist keine gültige E-Mail-Adresse.');
      try {
        // Sends the invitation with a temporary password (text in auth/resource.ts).
        await cognito.send(
          new AdminCreateUserCommand({
            UserPoolId,
            Username: email,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
            ],
            DesiredDeliveryMediums: ['EMAIL'],
          })
        );
      } catch (e) {
        // The account already exists (e.g. from another project): just add it.
        if (!(e instanceof UsernameExistsException)) throw e;
      }
      await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId, GroupName, Username: email }));
      return true;
    }

    case 'members': {
      const GroupName = requireMember(event, args.group);
      const r = await cognito.send(new ListUsersInGroupCommand({ UserPoolId, GroupName, Limit: 60 }));
      return (r.Users ?? [])
        .map((u) => u.Attributes?.find((a) => a.Name === 'email')?.Value)
        .filter((e): e is string => !!e)
        .sort();
    }

    default:
      throw new Error(`Unknown field ${event.info.fieldName}`);
  }
};
