import { useState } from 'react';
import { Mail, Phone, Trash2 } from 'lucide-react';
import { useApp } from '../lib/app';
import type { Company, Contact } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { Empty, PageTitle } from '../ui/Layout';

const FIELDS: Field[] = [
  { name: 'name', label: 'Firma', required: true },
  { name: 'phone', label: 'Telefon Büro', type: 'tel', half: true },
  { name: 'email', label: 'E-Mail Büro', type: 'email', half: true },
  { name: 'address', label: 'Adresse' },
  { name: 'website', label: 'Website' },
  { name: 'note', label: 'Notiz', type: 'textarea' },
];

/** Offered while typing the role; any other text works too. */
const ROLES = ['Chef', 'Baumeister', 'Polier', 'Bauleiter', 'Monteur', 'Büro', 'Planer'];

type ContactDraft = { name: string; role: string; phone: string; email: string };

const toDraft = (c: Contact): ContactDraft => ({ name: c.name, role: c.role ?? '', phone: c.phone ?? '', email: c.email ?? '' });

/**
 * Contacts of a company as they were saved. Older entries only have the
 * single "contactPerson" text field; it is shown as a contact without details.
 */
const contactsOf = (c: Partial<Company>): Contact[] => (c.contacts?.length ? c.contacts : c.contactPerson ? [{ name: c.contactPerson }] : []);

const tel = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

/** The people at a company: who they are, what they do there, how to reach them. */
function ContactsEditor({ contacts, onChange }: { contacts: ContactDraft[]; onChange: (contacts: ContactDraft[]) => void }) {
  const set = (i: number, patch: Partial<ContactDraft>) => onChange(contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <fieldset className="options">
      <legend>Ansprechpersonen</legend>
      {contacts.map((c, i) => (
        <div key={i} className="contact-edit">
          <input value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" aria-label="Name" />
          <input value={c.role} onChange={(e) => set(i, { role: e.target.value })} list="contact-roles" placeholder="Funktion, z.B. Polier" aria-label="Funktion" />
          <input value={c.phone} onChange={(e) => set(i, { phone: e.target.value })} type="tel" placeholder="Telefon" aria-label="Telefon" />
          <input value={c.email} onChange={(e) => set(i, { email: e.target.value })} type="email" placeholder="E-Mail" aria-label="E-Mail" />
          <button type="button" className="icon-btn" onClick={() => onChange(contacts.filter((_, j) => j !== i))} aria-label={`${c.name || `Person ${i + 1}`} entfernen`}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <datalist id="contact-roles">
        {ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => onChange([...contacts, { name: '', role: '', phone: '', email: '' }])}>
          Person hinzufügen
        </button>
      </div>
    </fieldset>
  );
}

export default function Companies() {
  const { companies, quotes, trades, defects, save, store } = useApp();
  const openDefects = (companyId: string) => defects.filter((d) => d.companyId === companyId && d.status !== 'fixed').length;
  const [opened, setOpenedRaw] = useState<Partial<Company> | null>(null);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);

  function setOpened(c: Partial<Company> | null) {
    setContacts(c ? contactsOf(c).map(toDraft) : []);
    setOpenedRaw(c);
  }

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
            <li key={f.id}>
              <div className="row">
                <button type="button" className="row-main row-main--button" onClick={() => setOpened(f)}>
                  <strong>{f.name}</strong>
                  <span>{tradesOf(f.id).join(', ')}</span>
                  {openDefects(f.id) > 0 && <span className="is-urgent">{openDefects(f.id)} offene Mängel</span>}
                </button>
                {f.phone && (
                  <a className="icon-btn" href={tel(f.phone)} aria-label={`${f.name} anrufen`}>
                    <Phone size={20} />
                  </a>
                )}
                {f.email && (
                  <a className="icon-btn" href={`mailto:${f.email}`} aria-label={`E-Mail an ${f.name}`}>
                    <Mail size={20} />
                  </a>
                )}
              </div>
              {/* One line per person, each with its own call and mail buttons. */}
              {contactsOf(f).map((c, i) => (
                <div key={i} className="row contact">
                  <div className="row-main">
                    <strong>{c.name}</strong>
                    {c.role && <span>{c.role}</span>}
                  </div>
                  {c.phone && (
                    <a className="icon-btn" href={tel(c.phone)} aria-label={`${c.name} anrufen`}>
                      <Phone size={18} />
                    </a>
                  )}
                  {c.email && (
                    <a className="icon-btn" href={`mailto:${c.email}`} aria-label={`E-Mail an ${c.name}`}>
                      <Mail size={18} />
                    </a>
                  )}
                </div>
              ))}
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
          onSave={(d) =>
            save('Company', opened.id, {
              ...d,
              // Rows without a name are leftovers from "add person" and are dropped.
              contacts: contacts
                .filter((c) => c.name.trim())
                .map((c) => ({ name: c.name.trim(), role: c.role.trim() || null, phone: c.phone.trim() || null, email: c.email.trim() || null })),
              // The old single field has moved into the list above.
              contactPerson: null,
            })
          }
          onDelete={opened.id ? () => store.remove('Company', opened.id!) : undefined}
        >
          <ContactsEditor contacts={contacts} onChange={setContacts} />
        </EntityForm>
      )}
    </>
  );
}
