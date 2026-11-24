import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { useApp } from '../lib/app';
import type { Company } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';

const FIELDS: Field[] = [
  { name: 'name', label: 'Firma', required: true },
  { name: 'contactPerson', label: 'Ansprechperson' },
  { name: 'phone', label: 'Telefon', type: 'tel', half: true },
  { name: 'email', label: 'E-Mail', type: 'email', half: true },
  { name: 'address', label: 'Adresse' },
  { name: 'website', label: 'Website' },
  { name: 'note', label: 'Notiz', type: 'textarea' },
];

export default function Companies() {
  const { companies, quotes, trades, defects, save, store } = useApp();
  const openDefects = (companyId: string) => defects.filter((d) => d.companyId === companyId && d.status !== 'fixed').length;
  const [opened, setOpened] = useState<Partial<Company> | null>(null);

  // A company's trades follow from its quotes.
  const tradesOf = (companyId: string) =>
    trades.filter((g) => quotes.some((a) => a.companyId === companyId && a.tradeId === g.id)).map((g) => g.name);

  return (
    <>
      <PageTitle addLabel="Firma" onAdd={() => setOpened({})}>
        Firmen
      </PageTitle>

      {companies.length === 0 ? (
        <Empty>Noch keine Firma. Leg Handwerker und Planer hier an, dann kannst du sie bei Angeboten und Terminen auswählen.</Empty>
      ) : (
        <ul className="list">
          {companies.map((f) => (
            <li key={f.id} className="row">
              <button type="button" className="row-main row-main--button" onClick={() => setOpened(f)}>
                <strong>{f.name}</strong>
                <span>{[f.contactPerson, ...tradesOf(f.id)].filter(Boolean).join(', ')}</span>
                {openDefects(f.id) > 0 && <span className="is-urgent">{openDefects(f.id)} offene Mängel</span>}
              </button>
              {f.phone && (
                <a className="icon-btn" href={`tel:${f.phone.replace(/\s/g, '')}`} aria-label={`${f.name} anrufen`}>
                  <Phone size={20} />
                </a>
              )}
              {f.email && (
                <a className="icon-btn" href={`mailto:${f.email}`} aria-label={`E-Mail an ${f.name}`}>
                  <Mail size={20} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {opened && (
        <EntityForm
          title={opened.id ? 'Firma bearbeiten' : 'Neue Firma'}
          fields={FIELDS}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => save('Company', opened.id, d)}
          onDelete={opened.id ? () => store.remove('Company', opened.id!) : undefined}
        />
      )}
    </>
  );
}
