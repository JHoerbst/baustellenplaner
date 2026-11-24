import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, CalendarRange, DraftingCompass, Euro, HardHat, House, ListChecks, NotebookPen, Plus, Settings } from 'lucide-react';
import { useApp } from '../lib/app';

const NAV_ITEMS: { path: string; label: string; Icon: typeof House; alsoPath?: string }[] = [
  { path: '/', label: 'Übersicht', Icon: House },
  { path: '/zeitplan', label: 'Zeitplan', Icon: CalendarRange },
  // Quotes and invoices share one slot, see CostsSwitch.
  { path: '/angebote', label: 'Kosten', Icon: Euro, alsoPath: '/rechnungen' },
  { path: '/termine', label: 'Termine', Icon: CalendarDays },
  { path: '/aufgaben', label: 'Aufgaben', Icon: ListChecks },
  { path: '/plaene', label: 'Pläne', Icon: DraftingCompass },
];

export function Layout() {
  const { project, store } = useApp();
  const { pathname } = useLocation();
  return (
    <div className="frame">
      <header className="header">
        <div className="header-project">
          <strong>{project?.name}</strong>
          {project?.address && <span>{project.address}</span>}
        </div>
        {/* One tap from anywhere to the empty note field - e.g. when the phone rings. */}
        <NavLink to="/notizen" className="icon-btn icon-btn--accent" aria-label="Notiz schreiben">
          <NotebookPen size={20} />
        </NavLink>
        {/* Six sections fill the bar; companies are needed less often. */}
        <NavLink to="/firmen" className="icon-btn" aria-label="Firmen">
          <HardHat size={20} />
        </NavLink>
        <NavLink to="/projekt" className="icon-btn" aria-label="Projekt und Mitglieder">
          <Settings size={20} />
        </NavLink>
      </header>
      {!store.cloud && (
        <p className="trial-note">
          Probiermodus: Die Daten liegen nur in diesem Browser. Gemeinsam nutzen könnt ihr die App erst mit dem
          Cloud-Backend.
        </p>
      )}
      <main className="content">
        <Outlet />
      </main>
      <nav className="navbar" aria-label="Bereiche">
        {NAV_ITEMS.map(({ path, label, Icon, alsoPath }) => (
          <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => (isActive || pathname === alsoPath ? 'active' : '')}>
            <Icon size={22} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Page title with the page's one main action. */
export function PageTitle({ children, addLabel, onAdd }: { children: ReactNode; addLabel?: string; onAdd?: () => void }) {
  return (
    <div className="page-title">
      <h1>{children}</h1>
      {addLabel && (
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          <Plus size={18} aria-hidden />
          {addLabel}
        </button>
      )}
    </div>
  );
}

/** Switch between the two pages under "Kosten". */
export function CostsSwitch() {
  return (
    <nav className="toggle" aria-label="Kosten">
      <NavLink to="/angebote">Angebote</NavLink>
      <NavLink to="/rechnungen">Rechnungen</NavLink>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
