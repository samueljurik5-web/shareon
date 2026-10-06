import { AlertTriangle, PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ label = 'Načítavam…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-ink-2">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon-blue border-t-transparent" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function CardSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden p-0">
          <div className="skeleton aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <PackageOpen className="h-10 w-10 text-neon-purple" aria-hidden />
      <p className="text-ink-2">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-danger/30 px-6 py-10 text-center">
      <AlertTriangle className="h-9 w-9 text-danger" aria-hidden />
      <p className="text-ink-2">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>Skúsiť znova</button>
      )}
    </div>
  );
}
