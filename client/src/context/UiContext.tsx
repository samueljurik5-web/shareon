import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Modal } from '../components/Modal';

type Toast = { id: number; message: string; kind: 'success' | 'error'; leaving?: boolean };

const TOAST_VISIBLE_MS = 4000;
const TOAST_EXIT_MS = 150;
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

interface UiState {
  toast: (message: string, kind?: Toast['kind']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { id: number; resolve: (v: boolean) => void }) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  const settled = useRef(false);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    // Fade out, then remove from the DOM.
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), TOAST_VISIBLE_MS);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_VISIBLE_MS + TOAST_EXIT_MS);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        settled.current = false;
        setDialog({ ...opts, id: Date.now(), resolve });
      }),
    [],
  );

  /** Resolve the pending confirm exactly once (button click resolves immediately, before the exit animation). */
  const settle = (v: boolean) => {
    if (settled.current) return;
    settled.current = true;
    dialog?.resolve(v);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`${t.leaving ? 'animate-toast-out' : 'animate-toast'} pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              t.kind === 'success' ? 'border-neon-green/30 bg-elevated text-ink' : 'border-danger/40 bg-elevated text-ink'
            }`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="animate-icon-pop h-5 w-5 shrink-0 text-neon-green" aria-hidden /> : <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <Modal
          key={dialog.id}
          role="alertdialog"
          labelledBy="confirm-title"
          initialFocus={confirmBtn}
          className="max-w-md p-6"
          onClose={() => {
            settle(false);
            setDialog(null);
          }}
        >
          {(close) => (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 id="confirm-title" className="text-lg font-bold">{dialog.title}</h2>
                <button className="btn-ghost rounded-full p-1" onClick={close} aria-label="Zavrieť">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {dialog.message && <p className="mt-2 text-sm text-ink-2">{dialog.message}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="btn btn-secondary" onClick={() => { settle(false); close(); }}>Zrušiť</button>
                <button ref={confirmBtn} className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { settle(true); close(); }}>
                  {dialog.confirmLabel ?? 'Potvrdiť'}
                </button>
              </div>
            </>
          )}
        </Modal>
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
