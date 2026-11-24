import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { projectFn } from '../functions/project/resource';
import { filesFn } from '../functions/files/resource';

/**
 * Every record carries the name of its project's Cognito group in the "group"
 * field; only members of that group may read and write it.
 *
 * Relations are plain ID fields without hasMany/belongsTo: the frontend loads
 * all tables of a project anyway and joins them itself.
 *
 * The types in src/lib/types.ts mirror this schema by hand - change both
 * places together.
 */
const inProject = {
  group: a.string().required(),
  projectId: a.id().required(),
};

const schema = a.schema({
  Attachment: a.customType({
    key: a.string().required(),
    name: a.string().required(),
    size: a.integer(),
  }),

  QuoteStatus: a.enum(['requested', 'received', 'negotiating', 'awarded', 'rejected']),

  Project: a
    .model({
      group: a.string().required(),
      name: a.string().required(),
      address: a.string(),
      note: a.string(),
      // People in the owners' own household - counted for meals in the schedule.
      householdSize: a.integer(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  Trade: a
    .model({
      ...inProject,
      name: a.string().required(),
      sortOrder: a.integer(),
      // Done by the owners themselves - needs no quote and is never awarded.
      selfPerformed: a.boolean(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  Company: a
    .model({
      ...inProject,
      name: a.string().required(),
      contactPerson: a.string(),
      phone: a.string(),
      email: a.string(),
      address: a.string(),
      website: a.string(),
      note: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  Quote: a
    .model({
      ...inProject,
      title: a.string().required(),
      tradeId: a.id(),
      companyId: a.id(),
      amount: a.float(),
      status: a.ref('QuoteStatus').required(),
      requestedOn: a.date(),
      receivedOn: a.date(),
      validUntil: a.date(),
      note: a.string(),
      attachments: a.ref('Attachment').array(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  Appointment: a
    .model({
      ...inProject,
      title: a.string().required(),
      start: a.datetime().required(),
      endTime: a.datetime(),
      place: a.string(),
      tradeId: a.id(),
      companyId: a.id(),
      note: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  Task: a
    .model({
      ...inProject,
      title: a.string().required(),
      done: a.boolean().required(),
      dueDate: a.date(),
      assignee: a.string(),
      tradeId: a.id(),
      note: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Schedule: when is which trade on site. A trade can come more than
  // once (first fix, second fix), hence separate rows.
  Assignment: a
    .model({
      ...inProject,
      tradeId: a.id(),
      companyId: a.id(),
      title: a.string(),
      startDate: a.date().required(),
      endDate: a.date().required(),
      people: a.integer(),
      catered: a.boolean(),
      note: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Friends and family who help; "days" are the days they are on site.
  Helper: a
    .model({
      ...inProject,
      name: a.string().required(),
      phone: a.string(),
      note: a.string(),
      days: a.date().array(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Own purchases and contractor invoices in one table. "category" is one of
  // the keys of INVOICE_CATEGORY in src/lib/types.ts.
  Invoice: a
    .model({
      ...inProject,
      vendor: a.string().required(),
      description: a.string(),
      date: a.date().required(),
      amount: a.float(),
      category: a.string().required(),
      tradeId: a.id(),
      quoteId: a.id(),
      paid: a.boolean().required(),
      // Part paid in cash: empty = none, equal to amount = all of it,
      // in between = partly cash, partly card or bank transfer.
      cashAmount: a.float(),
      dueDate: a.date(),
      note: a.string(),
      attachments: a.ref('Attachment').array(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Quick note, e.g. during a phone call. Timestamp = createdAt.
  Note: a
    .model({
      ...inProject,
      text: a.string().required(),
      companyId: a.id(),
      tradeId: a.id(),
      author: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Site photos by room and date. "thumb" is a small preview made in the
  // browser so the grid does not load the originals.
  Photo: a
    .model({
      ...inProject,
      attachment: a.ref('Attachment').required(),
      thumb: a.ref('Attachment'),
      room: a.string(),
      takenOn: a.date().required(),
      description: a.string(),
      tradeId: a.id(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Floor plans, sections, building permit drawings - one file per plan.
  Plan: a
    .model({
      ...inProject,
      title: a.string().required(),
      attachment: a.ref('Attachment').required(),
      note: a.string(),
    })
    .authorization((allow) => [allow.groupDefinedIn('group')]),

  // Creates the Cognito group for a new project, adds the caller and
  // returns its name. The project record itself is written by the frontend
  // afterwards (after a token refresh, so the group is in the token).
  createProjectGroup: a
    .mutation()
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(projectFn)),

  inviteMember: a
    .mutation()
    .arguments({ group: a.string().required(), email: a.string().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(projectFn)),

  members: a
    .query()
    .arguments({ group: a.string().required() })
    .returns(a.string().array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(projectFn)),

  // action: "upload" | "download" - returns a signed URL.
  fileUrl: a
    .query()
    .arguments({
      group: a.string().required(),
      key: a.string().required(),
      action: a.string().required(),
      contentType: a.string(),
    })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(filesFn)),

  deleteFile: a
    .mutation()
    .arguments({ group: a.string().required(), key: a.string().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(filesFn)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
