import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Toast = { id: number; message: string; kind: 'success' | 'error' };
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

interface UiState {
  toast: (message: string, kind?: Toast['kind']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })), []);

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              t.kind === 'success' ? 'border-neon-green/30 bg-elevated text-ink' : 'border-danger/40 bg-elevated text-ink'
            }`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-neon-green" aria-hidden /> : <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 id="confirm-title" className="text-lg font-bold">{dialog.title}</h2>
              <button className="btn-ghost rounded-full p-1" onClick={() => close(false)} aria-label="Zavrieť">
                <X className="h-5 w-5" />
              </button>
            </div>
            {dialog.message && <p className="mt-2 text-sm text-ink-2">{dialog.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn btn-secondary" onClick={() => close(false)}>Zrušiť</button>
              <button ref={confirmBtn} className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {dialog.confirmLabel ?? 'Potvrdiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUi = () => {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside UiProvider');
  return ctx;
};
