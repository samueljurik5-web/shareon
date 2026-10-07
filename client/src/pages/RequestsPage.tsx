import { Link, useSearchParams } from 'react-router-dom';
import { get } from '../api/client';
import type { RentalListEntry } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, Spinner } from '../components/States';
import { EMPTY, formatDuration, formatEur, formatPeriod, imageUrl, RENTAL_MODE_LABELS, RENTAL_STATUS_BADGE, RENTAL_STATUS_LABELS } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'received' ? 'received' : 'sent';
  const { data, loading, error, reload } = useAsync(() => get<{ rentalRequests: RentalListEntry[] }>(`/api/rental-requests/${tab}`), [tab]);
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Moje žiadosti</h1>
      <div className="h-scroll" role="tablist">
        <button role="tab" aria-selected={tab === 'sent'} className={`chip ${tab === 'sent' ? 'chip-active' : ''}`} onClick={() => setParams({ tab: 'sent' })}>Požičiavam si</button>
        <button role="tab" aria-selected={tab === 'received'} className={`chip ${tab === 'received' ? 'chip-active' : ''}`} onClick={() => setParams({ tab: 'received' })}>Požičiavam druhým</button>
      </div>
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data!.rentalRequests.length ? (
        <EmptyState message={EMPTY.requests} action={tab === 'sent' ? <Link to="/search" className="btn btn-primary btn-sm">Objaviť predmety</Link> : <Link to="/items/new" className="btn btn-primary btn-sm">Pridať predmet</Link>} />
      ) : (
        <ul className="space-y-3">
          {data!.rentalRequests.map((r) => {
            const other = tab === 'sent' ? r.owner : r.renter;
            const reviewedByMe = r.reviews.some((rv) => rv.authorId === user?.id);
            return (
              <li key={r.id}>
                <Link to={`/requests/${r.id}`} className="card flex items-center gap-4 p-3 hover:border-neon-purple/40 sm:p-4">
                  <img src={imageUrl(r.item.images[0]?.url)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${RENTAL_STATUS_BADGE[r.status]}`}>{RENTAL_STATUS_LABELS[r.status]}</span>
                      {r.status === 'COMPLETED' && !reviewedByMe && <span className="badge badge-demo">Ohodnoť</span>}
                    </div>
                    <div className="mt-1 truncate font-bold">{r.item.title}</div>
                    <div className="text-xs text-ink-2">
                      <span className="font-semibold text-neon-blue">{RENTAL_MODE_LABELS[r.rentalMode]}</span> · {formatPeriod(r)} · {formatDuration(r)}
                    </div>
                    <div className="text-xs text-ink-3">{tab === 'sent' ? 'Majiteľ' : 'Nájomca'}: {other.name}</div>
                  </div>
                  <div className="shrink-0 text-right font-extrabold">{formatEur(r.totalCents)}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
