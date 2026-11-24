import { useState } from 'react';
import { useApp } from '../lib/app';
import { euro, formatDate, relativeDay } from '../lib/format';
import { orderWarning } from '../lib/materialOrders';
import { roomLabel } from '../lib/rooms';
import { MATERIAL_ORDER_STATUS, type MaterialOrder, type MaterialOrderStatus } from '../lib/types';
import { EntityForm, type Field } from '../ui/EntityForm';
import { CostsSwitch, Empty, PageTitle } from '../ui/Layout';

/**
 * Things to order with their delivery time: what, where, by when it has to
 * be ordered, when it is promised and from when it is needed on site.
 */
export default function MaterialOrders() {
  const { materialOrders, rooms, trades, save, store } = useApp();
  const [opened, setOpened] = useState<Partial<MaterialOrder> | null>(null);

  const roomName = (id?: string | null) => {
    const room = rooms.find((r) => r.id === id);
    return room && roomLabel(room);
  };
  const tradeName = (id?: string | null) => trades.find((t) => t.id === id)?.name;

  const fields: Field[] = [
    { name: 'title', label: 'Was wird bestellt?', required: true },
    { name: 'supplier', label: 'Wo?', half: true },
    { name: 'amount', label: 'Betrag', type: 'amount', half: true },
    { name: 'status', label: 'Stand', type: 'select', required: true, options: Object.entries(MATERIAL_ORDER_STATUS).map(([value, label]) => ({ value, label })) },
    { name: 'orderBy', label: 'Spätestens bestellen bis', type: 'date', showWhen: (e) => e.status === 'planned' },
    { name: 'orderedOn', label: 'Bestellt am', type: 'date', half: true, showWhen: (e) => e.status !== 'planned' },
    { name: 'deliveryDate', label: 'Zugesagter Liefertermin', type: 'date', half: true, showWhen: (e) => e.status !== 'planned' },
    { name: 'neededBy', label: 'Auf der Baustelle gebraucht ab', type: 'date' },
    { name: 'tradeId', label: 'Gewerk', type: 'select', half: true, options: trades.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'roomId', label: 'Raum', type: 'select', half: true, options: rooms.map((r) => ({ value: r.id, label: roomLabel(r) })) },
    { name: 'note', label: 'Notiz (z.B. Bestellnummer, Maße)', type: 'textarea' },
  ];

  // Each list in the order things have to happen; entries without a date last.
  const byDate = (key: 'orderBy' | 'deliveryDate') => (a: MaterialOrder, b: MaterialOrder) => (a[key] ?? '9').localeCompare(b[key] ?? '9');
  const planned = materialOrders.filter((o) => o.status === 'planned').sort(byDate('orderBy'));
  const ordered = materialOrders.filter((o) => o.status === 'ordered').sort(byDate('deliveryDate'));
  const delivered = materialOrders.filter((o) => o.status === 'delivered');

  const row = (o: MaterialOrder) => {
    const warning = orderWarning(o);
    return (
      <li key={o.id}>
        <button type="button" className={`row row--button${o.status === 'delivered' ? ' is-faded' : ''}`} onClick={() => setOpened(o)}>
          <div className="row-main">
            <strong>{o.title}</strong>
            <span>{[o.supplier, tradeName(o.tradeId), roomName(o.roomId)].filter(Boolean).join(', ')}</span>
            {warning ? (
              <span className={warning.urgent ? 'is-urgent' : undefined}>{warning.text}</span>
            ) : (
              <span>
                {o.status === 'planned' && o.orderBy && `bestellen bis ${formatDate(o.orderBy)}`}
                {o.status === 'ordered' && o.deliveryDate && `kommt ${formatDate(o.deliveryDate)} (${relativeDay(o.deliveryDate)})`}
                {o.status === 'delivered' && o.deliveryDate && `geliefert ${formatDate(o.deliveryDate)}`}
              </span>
            )}
          </div>
          {o.amount != null && (
            <div className="row-amount">
              <strong>{euro(o.amount)}</strong>
            </div>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <PageTitle addLabel="Bestellung" onAdd={() => setOpened({ status: 'planned' })}>
        Bestellungen
      </PageTitle>
      <CostsSwitch />

      {materialOrders.length === 0 && (
        <Empty>Noch keine Bestellung. Trag ein, was Lieferzeit hat, zum Beispiel Fenster, Türen, Fliesen oder die Badewanne, und ab wann es auf der Baustelle sein muss.</Empty>
      )}

      {planned.length > 0 && (
        <section className="block">
          <h2>Noch zu bestellen</h2>
          <ul className="list">{planned.map(row)}</ul>
        </section>
      )}

      {ordered.length > 0 && (
        <section className="block">
          <h2>Unterwegs</h2>
          <ul className="list">{ordered.map(row)}</ul>
        </section>
      )}

      {delivered.length > 0 && (
        <details className="block">
          <summary>Geliefert ({delivered.length})</summary>
          <ul className="list">{delivered.map(row)}</ul>
        </details>
      )}

      {opened && (
        <EntityForm
          title={opened.id ? 'Bestellung bearbeiten' : 'Neue Bestellung'}
          fields={fields}
          value={opened}
          onClose={() => setOpened(null)}
          onSave={(d) => save('MaterialOrder', opened.id, { ...d, status: d.status as MaterialOrderStatus })}
          onDelete={opened.id ? () => store.remove('MaterialOrder', opened.id!) : undefined}
        />
      )}
    </>
  );
}
