import { useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate, euro, parseNumber, today, daysUntil } from '../lib/format';
import { orderStatus } from '../lib/orders';
import { STATUS, type Quote, type QuoteExtra, type QuoteStatus, type Attachment } from '../lib/types';
import { Attachments } from '../ui/Attachments';
import { BudgetSummary } from '../ui/BudgetSummary';
import { EntityForm, type Field } from '../ui/EntityForm';
import { CostsSwitch, Empty, PageTitle } from '../ui/Layout';

/** One row of the change-order editor; the amount stays text while it is being typed. */
type ExtraDraft = { title: string; amount: string; date: string };

const toDraft = (e: QuoteExtra): ExtraDraft => ({
  title: e.title,
  amount: e.amount == null ? '' : String(e.amount).replace('.', ','),
  date: e.date ?? '',
});

/** Change orders: work agreed after the quote was awarded, with its price. */
function ExtrasEditor({ extras, onChange }: { extras: ExtraDraft[]; onChange: (extras: ExtraDraft[]) => void }) {
  const set = (i: number, patch: Partial<ExtraDraft>) => onChange(extras.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <fieldset className="options">
      <legend>Nachträge</legend>
      {extras.map((e, i) => (
        <div key={i} className="option option--extra">
          <input value={e.title} onChange={(ev) => set(i, { title: ev.target.value })} placeholder="z.B. zusätzlicher Durchbruch" aria-label="Was kam dazu?" />
          <input value={e.amount} onChange={(ev) => set(i, { amount: ev.target.value })} inputMode="decimal" placeholder="€" aria-label="Betrag" />
          <button type="button" className="icon-btn" onClick={() => onChange(extras.filter((_, j) => j !== i))} aria-label={`${e.title || `Nachtrag ${i + 1}`} entfernen`}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => onChange([...extras, { title: '', amount: '', date: today() }])}>
          Nachtrag hinzufügen
        </button>
      </div>
    </fieldset>
  );
}

export default function Quotes() {
  const { quotes, invoices, trades, companies, project, save, store } = useApp();
  const [opened, setOpenedRaw] = useState<Partial<Quote> | null>(null);
  /** Files of a quote that has not been saved yet. */
  const [draft, setDraft] = useState<Attachment[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);

  function setOpened(a: Partial<Quote> | null) {
    setDraft([]);
    setExtras((a?.extras ?? []).map(toDraft));
    setOpenedRaw(a);
  }
  const companyName = (id?: string | null) => companies.find((f) => f.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Worum geht es?', required: true },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'companyId', label: 'Firma', type: 'select', half: true, options: companies.map((f) => ({ value: f.id, label: f.name })) },
    { name: 'status', label: 'Stand', type: 'select', required: true, half: true, options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) },
    { name: 'amount', label: 'Betrag', type: 'amount', half: true },
    { name: 'requestedOn', label: 'Angefragt am', type: 'date', half: true },
    { name: 'receivedOn', label: 'Erhalten am', type: 'date', half: true },
    { name: 'validUntil', label: 'Gültig bis', type: 'date' },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ];

  // One block per trade, in construction order; quotes without a trade last.
  const sections = [
    ...trades.map((g) => ({ id: g.id as string | null, name: g.name })),
    { id: null, name: 'Ohne Gewerk' },
  ]
    .map((g) => ({
      ...g,
      quotes: quotes
        .filter((a) => (trades.some((x) => x.id === a.tradeId) ? a.tradeId : null) === g.id)
        // Rejected ones last, otherwise cheapest first.
        .sort(
          (a, b) =>
            +(a.status === 'rejected') - +(b.status === 'rejected') ||
            (a.amount ?? Infinity) - (b.amount ?? Infinity)
        ),
    }))
    .filter((g) => g.quotes.length > 0);

  // What the owners do themselves needs no quote.
  const withoutQuote = trades.filter((g) => !g.selfPerformed && !quotes.some((a) => a.tradeId === g.id));
  // The sheet shows the live row so new attachments appear immediately.
  const liveRow = opened?.id ? quotes.find((a) => a.id === opened.id) : undefined;
  const openedOrder = liveRow?.status === 'awarded' ? orderStatus(liveRow, invoices) : null;

  /** "verrechnet € 25.000, bezahlt € 10.000, noch offen € 61.000" for an awarded quote. */
  const orderLine = (a: Quote) => {
    const o = orderStatus(a, invoices);
    return [
      o.extras !== 0 && `Auftrag ${euro(o.total)} mit Nachträgen`,
      `verrechnet ${euro(o.invoiced)}`,
      `bezahlt ${euro(o.paid)}`,
      o.remaining < 0 ? `${euro(-o.remaining)} über dem Auftrag` : `noch offen ${euro(o.remaining)}`,
    ]
      .filter(Boolean)
      .join(', ');
  };

  return (
    <>
      <PageTitle addLabel="Angebot" onAdd={() => setOpened({ status: 'requested', requestedOn: today() })}>
        Angebote
      </PageTitle>
      <CostsSwitch />
      <BudgetSummary />

      {quotes.length === 0 && (
        <Empty>Noch kein Angebot. Trag ein, sobald du eine Firma angefragt hast, dann siehst du hier, wer noch nicht geantwortet hat.</Empty>
      )}

      {sections.map((g) => {
        const contenders = g.quotes.filter((a) => a.status !== 'rejected' && a.amount != null);
        const min = Math.min(...contenders.map((a) => a.amount!));
        const max = Math.max(...contenders.map((a) => a.amount!));
        return (
          <section key={g.id ?? 'ohne'} className="block">
            <h2>{g.name}</h2>
            <ul className="list">
              {g.quotes.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`row row--button${a.status === 'rejected' ? ' is-faded' : ''}`} onClick={() => setOpened(a)}>
                    <div className="row-main">
                      <strong>{companyName(a.companyId) ?? a.title}</strong>
                      <span>
                        <em className={`status status--${a.status}`}>{STATUS[a.status as QuoteStatus]}</em>
                        {companyName(a.companyId) && ` ${a.title}`}
                        {a.validUntil && a.status !== 'awarded' && a.status !== 'rejected' && (
                          <span className={daysUntil(a.validUntil) <= 3 ? 'is-urgent' : undefined}> gültig bis {formatDate(a.validUntil)}</span>
                        )}
                        {!!a.attachments?.length && <Paperclip size={13} aria-label="mit Datei" className="clip" />}
                      </span>
                      {a.status === 'awarded' && <span className={orderStatus(a, invoices).remaining < 0 ? 'is-urgent' : undefined}>{orderLine(a)}</span>}
                      {/* Bar only when there is something to compare. */}
                      {contenders.length > 1 && a.amount != null && a.status !== 'rejected' && (
                        <span className="bar" style={{ width: `${(a.amount / max) * 100}%` }} />
                      )}
                    </div>
                    <div className="row-amount">
                      <strong>{euro(a.amount)}</strong>
                      {contenders.length > 1 && a.amount != null && a.status !== 'rejected' && (
                        <span>{a.amount === min ? 'günstigstes' : `+ ${euro(a.amount - min)}`}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {quotes.length > 0 && withoutQuote.length > 0 && (
        <p className="hint">Noch ohne Angebot: {withoutQuote.map((g) => g.name).join(', ')}</p>
      )}

      {opened && project && (
        <EntityForm
          title={opened.id ? 'Angebot bearbeiten' : 'Neues Angebot'}
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) =>
            save('Quote', opened.id, {
              ...d,
              // Rows without a title are leftovers from "add" and are dropped.
              extras: extras
                .filter((e) => e.title.trim())
                .map((e) => ({ title: e.title.trim(), amount: parseNumber(e.amount), date: e.date || null })),
              ...(opened.id ? {} : { attachments: draft }),
            })
          }
          onDelete={opened.id ? () => store.remove('Quote', opened.id!) : undefined}
        >
          {/* Change orders and the payment status only make sense once the quote is awarded. */}
          {openedOrder && (
            <>
              <p className="figure">
                <strong>{euro(openedOrder.total)}</strong> Auftrag, verrechnet {euro(openedOrder.invoiced)}, bezahlt {euro(openedOrder.paid)}
              </p>
              <ExtrasEditor extras={extras} onChange={setExtras} />
            </>
          )}
          <Attachments
            group={project.group}
            attachments={liveRow ? (liveRow.attachments ?? []) : draft}
            onUpdate={(d) => (liveRow ? store.update('Quote', liveRow.id, { attachments: d }) : setDraft(d))}
          />
        </EntityForm>
      )}
    </>
  );
}
