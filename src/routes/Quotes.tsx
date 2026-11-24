import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '../lib/app';
import { formatDate, euro, today, daysUntil } from '../lib/format';
import { STATUS, type Quote, type QuoteStatus, type Attachment } from '../lib/types';
import { Attachments } from '../ui/Attachments';
import { EntityForm, type Field } from '../ui/EntityForm';
import { CostsSwitch, Empty, PageTitle } from '../ui/Layout';

export default function Quotes() {
  const { quotes, trades, companies, project, save, store } = useApp();
  const [opened, setOpenedRaw] = useState<Partial<Quote> | null>(null);
  /** Files of a quote that has not been saved yet. */
  const [draft, setDraft] = useState<Attachment[]>([]);

  function setOpened(a: Partial<Quote> | null) {
    setDraft([]);
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
        // Abgelehnte ans Ende, sonst guenstigstes zuerst.
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

  return (
    <>
      <PageTitle addLabel="Angebot" onAdd={() => setOpened({ status: 'requested', requestedOn: today() })}>
        Angebote
      </PageTitle>
      <CostsSwitch />

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
          onSave={(d) => save('Quote', opened.id, opened.id ? d : { ...d, attachments: draft })}
          onDelete={opened.id ? () => store.remove('Quote', opened.id!) : undefined}
        >
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
