import { defineAuth } from '@aws-amplify/backend';

// AWS_APP_ID and AWS_BRANCH are set by Amplify Hosting during the build; the
// sandbox has neither, so the invitation simply carries no link.
const appId = process.env.AWS_APP_ID;
const branch = process.env.AWS_BRANCH;
// APP_URL is for a custom domain: set it as an environment variable in the
// Amplify console, otherwise the invitation links to the amplifyapp.com address.
const address = process.env.APP_URL ?? (appId && branch ? `https://${branch}.${appId}.amplifyapp.com` : null);

/**
 * Sign-in by email. Nobody can self-register (see backend.ts): the first
 * account is created by hand, all others come from "Einladen" in the app -
 * Cognito then sends this mail with a temporary password.
 *
 * Who sees which project is governed by Cognito groups: one group per project,
 * created by the Lambda in functions/project.
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      userInvitation: {
        emailSubject: 'Einladung zum Baustellenplaner',
        emailBody: (user, code) =>
          `Du wurdest zu einem Projekt im Baustellenplaner eingeladen.<br><br>` +
          (address ? `Adresse: ${address}<br>` : '') +
          `Anmeldung: ${user()}<br>Vorläufiges Passwort: ${code()}<br><br>` +
          `Beim ersten Anmelden vergibst du ein eigenes Passwort.`,
      },
    },
  },
});
