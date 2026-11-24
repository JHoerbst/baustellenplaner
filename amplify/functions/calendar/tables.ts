/** Tables the calendar feed reads. backend.ts passes each name as TABLE_<NAME>. */
export const CALENDAR_TABLES = [
  'Project',
  'Appointment',
  'Company',
  'Trade',
  'Assignment',
  'Task',
  'Decision',
  'Defect',
  'MaterialOrder',
  'Invoice',
] as const;

export type CalendarTable = (typeof CALENDAR_TABLES)[number];

export const tableEnv = (name: CalendarTable) => `TABLE_${name.toUpperCase()}`;
