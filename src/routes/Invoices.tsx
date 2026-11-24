import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate, euro, today, relativeDay, daysUntil } from '../lib/format';
import { INVOICE_CATEGORY, type Attachment, type Invoice, type InvoiceCategory } from '../lib/types';
import { Attachments } from '../ui/Attachments';
import { EntityForm, type Field } from '../ui/EntityForm';
import { CostsSwitch, Empty, PageTitle } from '../ui/Layout';

/** From this many invoices on, the search field is worth showing. */
const SEARCH_FROM = 6;

type Sum = { name: string; amount: number };

/** Totals per group, largest first. */
function sumBy(invoices: Invoice[], group: (r: Invoice) => string | undefined): Sum[] {
  const buckets = new Map<string, number>();
  for (const r of invoices) {
    const name = group(r);
    if (name && r.amount) buckets.set(name, (buckets.get(name) ?? 0) + r.amount);
  }
  return [...buckets].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

/** Choice in the form: unpaid, cash, partly cash or paid without cash. */
function paymentMode(r: Partial<Invoice>): 'no' | 'yes' | 'cash' | 'partial' {
  if (!r.paid) return 'no';
  if (!r.cashAmount) return 'yes';
  return r.amount != null && r.cashAmount < r.amount ? 'partial' : 'cash';
}

function cashLabel(r: Invoice): string | false {
  const kind = paymentMode(r);
  return kind === 'cash' ? 'bar bezahlt' : kind === 'partial' && `${euro(r.cashAmount)} davon bar`;
}

/**
 * Everything that cost money: own purchases (materials, tools) and
 * contractor invoices. The receipt is attached as a photo or PDF - to find
 * it again when the warranty is needed later.
 */
export default function Invoices() {
  const { invoices, trades, quotes, companies, project, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<Invoice> | null>(null);
  /** Receipts of an entry that has not been saved yet. */
  const [draft, setDraft] = useState<Attachment[]>([]);
  const [search, setSearch] = useState('');

  const tradeName = (id?: string | null) => trades.find((g) => g.id === id)?.name;
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  const fields: Field[] = [
    { name: 'vendor', label: 'Händler oder Firma', required: true },
    { name: 'description', label: 'Was wurde gekauft oder gemacht?' },
    { name: 'date', label: 'Rechnungsdatum', type: 'date', required: true, half: true },
    { name: 'amount', label: 'Betrag', type: 'amount', half: true },
    { name: 'category', label: 'Art', type: 'select', required: true, half: true, options: Object.entries(INVOICE_CATEGORY).map(([value, label]) => ({ value, label })) },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
    {
      name: 'quoteId',
      label: 'Gehört zu Angebot',
      type: 'select',
      options: quotes
        .filter((a) => a.status === 'awarded')
        .map((a) => ({ value: a.id, label: [companyName(a.companyId), a.title].filter(Boolean).join(', ') })),
    },
    {
      name: 'paid',
      label: 'Schon bezahlt?',
      type: 'select',
      required: true,
      half: true,
      options: [
        { value: 'yes', label: 'Ja, Karte oder Überweisung' },
        { value: 'cash', label: 'Ja, bar' },
        { value: 'partial', label: 'Ja, teils bar' },
        { value: 'no', label: 'Nein, noch offen' },
      ],
    },
    { name: 'dueDate', label: 'Fällig am', type: 'date', half: true },
    { name: 'cashAmount', label: 'Davon bar', type: 'amount', required: true, showWhen: (e) => e.paid === 'partial' },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ];

  function openForm(r: Partial<Invoice>) {
    setDraft([]);
    setOpened(r);
  }

  const total = invoices.reduce((n, r) => n + (r.amount ?? 0), 0);
  const unpaid = invoices.filter((r) => !r.paid);
  const cashTotal = invoices.filter((r) => r.paid).reduce((n, r) => n + (r.cashAmount ?? 0), 0);
  const byCategory = sumBy(invoices, (r) => INVOICE_CATEGORY[r.category as InvoiceCategory] ?? INVOICE_CATEGORY.misc);
  const byTrade = sumBy(invoices, (r) => tradeName(r.tradeId));

  const term = search.trim().toLowerCase();
  const visible = term
    ? invoices.filter((r) => [r.vendor, r.description, r.note, tradeName(r.tradeId)].join(' ').toLowerCase().includes(term))
    : invoices;

  // The sheet shows the live row so new receipts appear immediately.
  const liveRow = opened?.id ? invoices.find((r) => r.id === opened.id) : undefined;

  const sumList = (title: string, list: Sum[]) =>
    list.length > 0 && (
      <section className="block">
        <h2>{title}</h2>
        <ul className="list">
          {list.map((s) => (
            <li key={s.name} className="row">
              <div className="row-main">
                <strong>{s.name}</strong>
                <span className="bar" style={{ width: `${(s.amount / list[0].amount) * 100}%` }} />
              </div>
              <div className="row-amount">
                <strong>{euro(s.amount)}</strong>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <>
      <PageTitle addLabel="Rechnung" onAdd={() => openForm({ date: today(), category: 'material', paid: true })}>
        Rechnungen
      </PageTitle>
      <CostsSwitch />

      {invoices.length === 0 ? (
        <Empty>Noch keine Rechnung. Fotografier Belege für Baustoffe und Werkzeug gleich beim Kauf, dann findest du sie wieder, wenn du die Garantie brauchst.</Empty>
      ) : (
        <>
          <p className="figure">
            <strong>{euro(total)}</strong> ausgegeben
            {unpaid.length > 0 && `, davon ${euro(unpaid.reduce((n, r) => n + (r.amount ?? 0), 0))} noch offen`}
            {cashTotal > 0 && `, ${euro(cashTotal)} bar bezahlt`}
          </p>

          {invoices.length >= SEARCH_FROM && (
            <input
              type="search"
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Händler oder Artikel suchen"
              aria-label="Rechnungen durchsuchen"
            />
          )}

          <ul className="list">
            {visible.map((r) => (
              <li key={r.id}>
                <button type="button" className="row row--button" onClick={() => openForm(r)}>
                  <div className="row-main">
                    <strong>{r.vendor}</strong>
                    <span>
                      {[formatDate(r.date), r.description, INVOICE_CATEGORY[r.category as InvoiceCategory], tradeName(r.tradeId), cashLabel(r)].filter(Boolean).join(', ')}
                      {!!r.attachments?.length && <Paperclip size={13} aria-label="mit Beleg" className="clip" />}
                    </span>
                    {!r.paid && (
                      <span className={r.dueDate && daysUntil(r.dueDate) <= 3 ? 'is-urgent' : undefined}>
                        noch offen{r.dueDate && `, fällig ${relativeDay(r.dueDate)}`}
                      </span>
                    )}
                  </div>
                  <div className="row-amount">
                    <strong>{euro(r.amount)}</strong>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {term && visible.length === 0 && <p className="empty">Keine Rechnung enthält „{search.trim()}“.</p>}

          {!term && sumList('Nach Art', byCategory)}
          {!term && sumList('Nach Gewerk', byTrade)}
        </>
      )}

      {opened && project && (
        <EntityForm
          title={opened.id ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
          fields={fields}
          value={{ ...opened, paid: paymentMode(opened), cashAmount: paymentMode(opened) === 'partial' ? opened.cashAmount : null }}
          onClose={() => setOpened(null)}
          onSave={(d) => {
            const amount = typeof d.amount === 'number' ? d.amount : null;
            const cashPart = typeof d.cashAmount === 'number' ? d.cashAmount : null;
            if (d.paid === 'partial' && (!cashPart || !amount || cashPart >= amount)) {
              throw new Error('Bei „teils bar“ muss der bar bezahlte Betrag größer als 0 und kleiner als der Gesamtbetrag sein.');
            }
            return save('Invoice', opened.id, {
              ...d,
              // The single choice in the form is two fields in the data.
              paid: d.paid !== 'no',
              cashAmount: d.paid === 'cash' ? amount : d.paid === 'partial' ? cashPart : null,
              // A new entry takes the receipts that were already uploaded with it.
              ...(opened.id ? {} : { attachments: draft }),
            });
          }}
          onDelete={opened.id ? () => store.remove('Invoice', opened.id!) : undefined}
        >
          <Attachments
            label="Beleg (Foto oder PDF)"
            group={project.group}
            attachments={liveRow ? (liveRow.attachments ?? []) : draft}
            onUpdate={(d) => (liveRow ? store.update('Invoice', liveRow.id, { attachments: d }) : setDraft(d))}
          />
        </EntityForm>
      )}
    </>
  );
}
