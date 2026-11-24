import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import './index.css';
import { cloudOutputs } from './outputs';
import { AppProvider, useApp } from './lib/app';
import { localStore, type Store } from './lib/store';
import { Layout } from './ui/Layout';
import Start from './routes/Start';
import Overview from './routes/Overview';
import Quotes from './routes/Quotes';
import Appointments from './routes/Appointments';
import Tasks from './routes/Tasks';
import Plans from './routes/Plans';
import Schedule from './routes/Schedule';
import Notes from './routes/Notes';
import Photos from './routes/Photos';
import Defects from './routes/Defects';
import Decisions from './routes/Decisions';
import Invoices from './routes/Invoices';
import Companies from './routes/Companies';
import ProjectPage from './routes/Project';

// HashRouter: this way Amplify Hosting needs no SPA rewrite rule.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Overview /> },
      { path: '/zeitplan', element: <Schedule /> },
      { path: '/angebote', element: <Quotes /> },
      { path: '/termine', element: <Appointments /> },
      { path: '/aufgaben', element: <Tasks /> },
      { path: '/plaene', element: <Plans /> },
      { path: '/rechnungen', element: <Invoices /> },
      { path: '/entscheidungen', element: <Decisions /> },
      { path: '/maengel', element: <Defects /> },
      { path: '/fotos', element: <Photos /> },
      { path: '/notizen', element: <Notes /> },
      { path: '/firmen', element: <Companies /> },
      { path: '/projekt', element: <ProjectPage /> },
    ],
  },
]);

function Gate() {
  const { projects, project } = useApp();
  if (projects === null) return <p className="hint">Lädt …</p>;
  if (!project) {
    return (
      <main className="welcome">
        <h1>Baustellenplaner</h1>
        <p>Termine, Angebote und Aufgaben für euren Umbau an einem Ort. Leg zuerst euer Projekt an.</p>
        <Start />
      </main>
    );
  }
  return <RouterProvider router={router} />;
}

const withStore = (store: Store, me: string) => (
  <AppProvider store={store} me={me}>
    <Gate />
  </AppProvider>
);

// Load Amplify and the sign-in UI only when there is a backend.
const Cloud = lazy(async () => {
  const { cloudStore, SignIn } = await import('./lib/cloud');
  const store = cloudStore(cloudOutputs!);
  return { default: () => <SignIn>{(me) => withStore(store, me)}</SignIn> };
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {cloudOutputs ? (
      <Suspense fallback={<p className="hint">Lädt …</p>}>
        <Cloud />
      </Suspense>
    ) : (
      withStore(localStore, 'Ich')
    )}
  </React.StrictMode>
);
