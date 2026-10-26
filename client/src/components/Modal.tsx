import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Must match the closing animation duration (--motion-fast) in styles/index.css. */
export const MODAL_EXIT_MS = 150;

interface ModalProps {
  /** Called after the closing animation – the parent should unmount the modal then. */
  onClose: () => void;
  /** Accessible name of the dialog. */
  label?: string;
  labelledBy?: string;
  role?: 'dialog' | 'alertdialog';
  /** Element to focus when opened (defaults to the first focusable element). */
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Children may be a render function receiving `close` (plays the exit animation, then onClose). */
  children: ReactNode | ((close: () => void) => ReactNode);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal with a short fade/scale animation.
 * Escape and backdrop click close it, focus is trapped inside and restored afterwards.
 * The overlay ignores pointer events while closing and is always unmounted (timer fallback),
 * so it can never stay invisible on top of the page.
 */
export function Modal({ onClose, label, labelledBy, role = 'dialog', initialFocus, className = '', children }: ModalProps) {
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), MODAL_EXIT_MS);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current;
    target?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the element that opened the modal (if it still exists).
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-[65] flex items-end justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center ${closing ? 'modal-closing' : ''}`}
      onClick={close}
      data-testid="modal-backdrop"
    >
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`modal-panel card my-auto w-full ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  );
}
