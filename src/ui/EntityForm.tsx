import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { toInputValue, parseNumber } from '../lib/format';

/** Sheet that slides up from the bottom (centred on desktop), built on <dialog>. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    // showModal sets focus itself (on the close button) and ignores
    // React's autoFocus - hence by hand here.
    dialog.querySelector<HTMLElement>('[data-focus]')?.focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-inner">
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'datetime-local' | 'amount' | 'decimal' | 'integer' | 'select' | 'tel' | 'email' | 'url';
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Earlier values offered while typing (plain text fields only). */
  suggestions?: string[];
  /** Two half fields share a row. */
  half?: boolean;
  /** Show the field only when the current inputs call for it; hidden fields are saved as empty. */
  showWhen?: (inputs: Record<string, string>) => boolean;
};

type Values = Record<string, unknown>;

function toInput(field: Field, value: unknown): string {
  if (value == null || value === '') return '';
  if (field.type === 'datetime-local') return toInputValue(String(value));
  if (field.type === 'amount' || field.type === 'decimal') return String(value).replace('.', ',');
  return String(value);
}

/** Empty inputs become null - AppSync rejects "" for date fields. */
function toValue(field: Field, text: string): unknown {
  const s = text.trim();
  if (!s) return null;
  if (field.type === 'datetime-local') return new Date(s).toISOString();
  if (field.type === 'amount' || field.type === 'decimal') return parseNumber(s);
  if (field.type === 'integer') return Number.isFinite(parseInt(s, 10)) ? parseInt(s, 10) : null;
  return s;
}

/**
 * One form for all tables: fields as a list, values in, values out.
 * children are rendered below the fields (e.g. attachments).
 */
export function EntityForm({
  title,
  fields,
  value,
  onSave,
  onDelete,
  onClose,
  children,
}: {
  title: string;
  fields: Field[];
  value: Values;
  onSave: (payload: Values) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.name, toInput(f, value[f.name])])));
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure('');
    try {
      await action();
      onClose();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const visible = (f: Field) => !f.showWhen || f.showWhen(v);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => onSave(Object.fromEntries(fields.map((f) => [f.name, visible(f) ? toValue(f, v[f.name]) : null]))));
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {fields.map((f, i) => {
          if (!visible(f)) return null;
          const common = {
            id: `f-${f.name}`,
            value: v[f.name],
            required: f.required,
            'data-focus': i === 0 && !value.id ? '' : undefined,
            onChange: (e: { target: { value: string } }) => setV({ ...v, [f.name]: e.target.value }),
          };
          return (
            <div key={f.name} className={f.half ? 'field field--half' : 'field'}>
              <label htmlFor={common.id}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea rows={3} {...common} />
              ) : f.type === 'select' ? (
                <select {...common}>
                  {!f.required && <option value="">–</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'integer' ? (
                <input type="text" inputMode="numeric" pattern="[0-9]*" {...common} />
              ) : f.type === 'decimal' ? (
                <input type="text" inputMode="decimal" {...common} />
              ) : f.type === 'amount' ? (
                <input type="text" inputMode="decimal" placeholder="€ inkl. USt." {...common} />
              ) : (
                <>
                  <input type={f.type ?? 'text'} list={f.suggestions ? `${common.id}-list` : undefined} {...common} />
                  {f.suggestions && (
                    <datalist id={`${common.id}-list`}>
                      {f.suggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
            </div>
          );
        })}
        {children && <div className="field">{children}</div>}
        {failure && (
          <p className="error" role="alert">
            {failure}
          </p>
        )}
        <footer className="form-footer">
          {onDelete && (
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={() => window.confirm('Wirklich löschen?') && run(onDelete)}
            >
              Löschen
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Speichern
          </button>
        </footer>
      </form>
    </Sheet>
  );
}
