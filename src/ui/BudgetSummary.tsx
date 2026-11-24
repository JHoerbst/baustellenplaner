import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { computeBudget } from '../lib/budget';
import { euro } from '../lib/format';

/**
 * The project budget at a glance: a bar of what is spent, committed and
 * expected against the budget, with the reserve marked at its end.
 * `compact` leaves out the breakdown (used on the overview).
 */
export function BudgetSummary({ compact = false }: { compact?: boolean }) {
  const { project, quotes, invoices, materialOrders, trades } = useApp();
  const b = computeBudget({ project, quotes, invoices, materialOrders, trades });

  if (b.budget == null) {
    // Nothing to compare against yet; only nudge once there are costs at all.
    if (b.forecast === 0) return null;
    return (
      <p className="hint">
        Voraussichtlich {euro(b.forecast)}. <Link to="/projekt">Leg ein Gesamtbudget fest</Link>, dann siehst du hier, wie viel Luft noch ist.
      </p>
    );
  }

  // The bar spans the budget, or the forecast when that is larger.
  const scale = Math.max(b.budget, b.forecast) || 1;
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const left = b.budget - b.forecast;

  return (
    <section className="budget" aria-label="Budget">
      <p className="figure">
        <strong>{euro(b.forecast)}</strong> voraussichtlich von {euro(b.budget)}
        {b.level === 'over' && <span className="is-urgent">, {euro(-left)} über dem Budget</span>}
        {b.level === 'reserve' && <span className="is-urgent">, der Puffer von {euro(b.reserve)} wird angegriffen</span>}
        {b.level === 'ok' && `, ${euro(left)} Luft`}
      </p>

      <div className="budget-bar" role="img" aria-label={`${euro(b.spent)} ausgegeben, ${euro(b.openOrders + b.pendingOrders)} gebunden, ${euro(b.expected)} erwartet`}>
        <span className="budget-spent" style={{ width: pct(b.spent) }} />
        <span className="budget-committed" style={{ width: pct(b.openOrders + b.pendingOrders) }} />
        <span className="budget-expected" style={{ width: pct(b.expected) }} />
        {/* Where the reserve starts, measured from the end of the budget. */}
        {b.reserve > 0 && <i className="budget-reserve" style={{ left: pct(b.budget - b.reserve), width: pct(b.reserve) }} />}
      </div>

      {!compact && (
        <>
          <ul className="budget-legend">
            <li>
              <i className="budget-spent" /> Rechnungen {euro(b.spent)}
            </li>
            <li>
              <i className="budget-committed" /> beauftragt, noch nicht verrechnet {euro(b.openOrders)}
              {b.pendingOrders > 0 && `, Bestellungen ${euro(b.pendingOrders)}`}
            </li>
            <li>
              <i className="budget-expected" /> noch nicht vergeben, günstigstes Angebot {euro(b.expected)}
            </li>
            {b.reserve > 0 && (
              <li>
                <i className="budget-reserve" /> Puffer {euro(b.reserve)}
              </li>
            )}
          </ul>
          {b.unpriced.length > 0 && <p className="hint">Noch ohne Preis und daher nicht eingerechnet: {b.unpriced.join(', ')}</p>}
        </>
      )}
    </section>
  );
}
