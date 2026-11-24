// Mirrors amplify/data/resource.ts by hand - change both together.

export type Attachment = { key: string; name: string; size?: number | null };

type Base = { id: string; group: string; createdAt?: string; updatedAt?: string };
type InProject = Base & { projectId: string };

export type Project = Base & {
  name: string;
  address?: string | null;
  note?: string | null;
  householdSize?: number | null;
  budget?: number | null;
  reserve?: number | null;
};

export type Trade = InProject & { name: string; sortOrder?: number | null; selfPerformed?: boolean | null };

export type Company = InProject & {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  note?: string | null;
};

export type QuoteStatus = 'requested' | 'received' | 'negotiating' | 'awarded' | 'rejected';

export const STATUS: Record<QuoteStatus, string> = {
  requested: 'Angefragt',
  received: 'Erhalten',
  negotiating: 'In Verhandlung',
  awarded: 'Beauftragt',
  rejected: 'Abgelehnt',
};

export type QuoteExtra = { title: string; amount?: number | null; date?: string | null };

export type Quote = InProject & {
  title: string;
  tradeId?: string | null;
  companyId?: string | null;
  amount?: number | null;
  status: QuoteStatus;
  requestedOn?: string | null;
  receivedOn?: string | null;
  validUntil?: string | null;
  note?: string | null;
  extras?: QuoteExtra[] | null;
  attachments?: Attachment[] | null;
};

export type Appointment = InProject & {
  title: string;
  start: string;
  endTime?: string | null;
  place?: string | null;
  tradeId?: string | null;
  companyId?: string | null;
  note?: string | null;
};

export type Task = InProject & {
  title: string;
  done: boolean;
  dueDate?: string | null;
  assignee?: string | null;
  roomId?: string | null;
  tradeId?: string | null;
  note?: string | null;
};

export type Plan = InProject & { title: string; attachment: Attachment; note?: string | null };

export type Assignment = InProject & {
  tradeId?: string | null;
  companyId?: string | null;
  title?: string | null;
  startDate: string;
  endDate: string;
  people?: number | null;
  catered?: boolean | null;
  note?: string | null;
};

export type Helper = InProject & {
  name: string;
  phone?: string | null;
  note?: string | null;
  days?: string[] | null;
};

export type Note = InProject & {
  text: string;
  companyId?: string | null;
  tradeId?: string | null;
  author?: string | null;
};

export const INVOICE_CATEGORY = {
  material: 'Baustoff',
  tool: 'Werkzeug',
  equipment: 'Gerät oder Miete',
  contractors: 'Handwerker',
  misc: 'Sonstiges',
};
export type InvoiceCategory = keyof typeof INVOICE_CATEGORY;

export type Invoice = InProject & {
  vendor: string;
  description?: string | null;
  date: string;
  amount?: number | null;
  category: string;
  tradeId?: string | null;
  quoteId?: string | null;
  paid: boolean;
  cashAmount?: number | null;
  dueDate?: string | null;
  note?: string | null;
  attachments?: Attachment[] | null;
};

export type Photo = InProject & {
  attachment: Attachment;
  thumb?: Attachment | null;
  roomId?: string | null;
  takenOn: string;
  description?: string | null;
  tradeId?: string | null;
};

export const MATERIAL_ORDER_STATUS = {
  planned: 'Noch zu bestellen',
  ordered: 'Bestellt',
  delivered: 'Geliefert',
};
export type MaterialOrderStatus = keyof typeof MATERIAL_ORDER_STATUS;

export type MaterialOrder = InProject & {
  title: string;
  supplier?: string | null;
  amount?: number | null;
  status: string;
  orderBy?: string | null;
  orderedOn?: string | null;
  deliveryDate?: string | null;
  neededBy?: string | null;
  tradeId?: string | null;
  roomId?: string | null;
  note?: string | null;
};

export type DecisionOption = { name: string; price?: number | null; note?: string | null };

export type Decision = InProject & {
  title: string;
  description?: string | null;
  roomId?: string | null;
  tradeId?: string | null;
  deadline?: string | null;
  options?: DecisionOption[] | null;
  chosen?: string | null;
  decidedOn?: string | null;
  attachments?: Attachment[] | null;
};

export type Room = InProject & { name: string; floor?: string | null; area?: number | null };

export const DEFECT_STATUS = {
  open: 'Offen',
  reported: 'Der Firma gemeldet',
  fixed: 'Behoben',
};
export type DefectStatus = keyof typeof DEFECT_STATUS;

export type Defect = InProject & {
  title: string;
  description?: string | null;
  roomId?: string | null;
  status: string;
  companyId?: string | null;
  tradeId?: string | null;
  foundOn: string;
  deadline?: string | null;
  fixedOn?: string | null;
  attachments?: Attachment[] | null;
};

export type Tables = {
  Project: Project;
  Trade: Trade;
  Company: Company;
  Quote: Quote;
  Appointment: Appointment;
  Task: Task;
  Plan: Plan;
  Assignment: Assignment;
  Helper: Helper;
  Note: Note;
  Invoice: Invoice;
  Photo: Photo;
  Defect: Defect;
  Room: Room;
  Decision: Decision;
  MaterialOrder: MaterialOrder;
};
export type Kind = keyof Tables;
export type New<A extends Kind> = Omit<Tables[A], 'id' | 'createdAt' | 'updatedAt'>;
