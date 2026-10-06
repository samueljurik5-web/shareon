import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Common = { label: string; error?: string; hint?: ReactNode; id: string };

export function TextField({ label, error, hint, id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

export function TextArea({ label, error, hint, id, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="input min-h-28 py-3" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

export function SelectField({ label, error, id, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...rest}>
        {children}
      </select>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

export function Checkbox({ id, checked, onChange, children, error }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#9B5CFF]" />
        <span>{children}</span>
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
