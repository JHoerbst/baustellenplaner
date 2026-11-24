import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Store } from './store';
import type { Quote, Kind, Task, Assignment, Company, Trade, Helper, New, Note, Plan, Project, Invoice, Tables, Appointment } from './types';

type InProjectKind = Exclude<Kind, 'Project'>;

type App = {
  store: Store;
  me: string;
  /** null = still loading. */
  projects: Project[] | null;
  project: Project | null;
  selectProject: (id: string) => void;
  trades: Trade[];
  companies: Company[];
  quotes: Quote[];
  appointments: Appointment[];
  tasks: Task[];
  plans: Plan[];
  assignments: Assignment[];
  helpers: Helper[];
  /** Newest first. */
  notes: Note[];
  /** Newest first. */
  invoices: Invoice[];
  members: string[];
  loadMembers: () => void;
  /** Creates a row in the current project or updates it, depending on whether id is set. */
  save: <A extends InProjectKind>(
    kind: A,
    id: string | undefined,
    payload: Partial<Omit<New<A>, 'group' | 'projectId'>>
  ) => Promise<void>;
};

const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppProvider missing');
  return app;
}

function useTable<A extends Kind>(store: Store, kind: A, projectId: string | undefined): Tables[A][] {
  const [rows, setRows] = useState<Tables[A][]>([]);
  useEffect(() => {
    setRows([]);
    if (!projectId) return;
    return store.watch(kind, projectId, setRows);
  }, [store, kind, projectId]);
  return rows;
}

export function AppProvider({ store, me, children }: { store: Store; me: string; children: ReactNode }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState(() => localStorage.getItem('bp:project'));
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => store.watch('Project', null, setProjects), [store]);

  const project = projects?.find((p) => p.id === selected) ?? projects?.[0] ?? null;
  const pid = project?.id;
  const group = project?.group;

  const trades = useTable(store, 'Trade', pid);
  const companies = useTable(store, 'Company', pid);
  const quotes = useTable(store, 'Quote', pid);
  const appointments = useTable(store, 'Appointment', pid);
  const tasks = useTable(store, 'Task', pid);
  const plans = useTable(store, 'Plan', pid);
  const assignments = useTable(store, 'Assignment', pid);
  const helpers = useTable(store, 'Helper', pid);
  const notes = useTable(store, 'Note', pid);
  const invoices = useTable(store, 'Invoice', pid);

  const loadMembers = useCallback(() => {
    if (!group) return setMembers([]);
    store.members(group).then(setMembers, () => setMembers([]));
  }, [store, group]);
  useEffect(loadMembers, [loadMembers]);

  const app = useMemo<App>(
    () => ({
      store,
      me,
      projects,
      project,
      selectProject(id) {
        localStorage.setItem('bp:project', id);
        setSelected(id);
      },
      trades: [...trades].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      companies: [...companies].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      quotes,
      appointments: [...appointments].sort((a, b) => a.start.localeCompare(b.start)),
      tasks,
      plans: [...plans].sort((a, b) => a.title.localeCompare(b.title, 'de', { numeric: true })),
      assignments,
      helpers: [...helpers].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      notes: [...notes].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      invoices: [...invoices].sort((a, b) => b.date.localeCompare(a.date)),
      members,
      loadMembers,
      async save(kind, id, payload) {
        if (!project) throw new Error('Kein Projekt gewählt.');
        if (id) await store.update(kind, id, payload as never);
        else await store.create(kind, { ...payload, group: project.group, projectId: project.id } as never);
      },
    }),
    [store, me, projects, project, trades, companies, quotes, appointments, tasks, plans, assignments, helpers, notes, invoices, members, loadMembers]
  );

  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}
