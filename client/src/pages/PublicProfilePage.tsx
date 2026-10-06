import { useParams } from 'react-router-dom';
import { get } from '../api/client';
import type { ItemCard, RatingSummary, Review, UserStats } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { Avatar } from '../components/Avatar';
import { ItemGrid } from '../components/ItemCard';
import { EmptyState, ErrorState, Spinner } from '../components/States';
import { RatingDistribution } from '../components/Rating';
import { ReviewList } from '../components/ReviewList';
import { EMPTY, formatDate } from '../lib/format';

interface PublicUser { id: string; name: string; city: string; bio: string | null; avatarUrl: string | null; createdAt: string; rating: RatingSummary; stats: UserStats }

export function PublicProfilePage() {
  const { id } = useParams();
  const profile = useAsync(() => get<{ user: PublicUser; items: ItemCard[] }>(`/api/users/${id}`), [id]);
  const reviews = useAsync(() => get<{ reviews: Review[] }>(`/api/users/${id}/reviews`), [id]);
  if (profile.loading) return <Spinner />;
  if (profile.error || !profile.data) return <ErrorState message={profile.error?.message ?? 'Používateľ sa nenašiel.'} />;
  const { user, items } = profile.data;
  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} url={user.avatarUrl} size={80} />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{user.name}</h1>
          <p className="text-sm text-ink-2">{user.city} · na ShareOn od {formatDate(user.createdAt)}</p>
          {user.bio && <p className="mt-2 text-ink-2">{user.bio}</p>}
          <p className="mt-2 text-xs text-ink-3">Kontaktné údaje sa zobrazia až po prijatí žiadosti o požičanie.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="card-elevated p-2"><div className="text-lg font-extrabold">{user.stats.completedRentals}</div><div className="text-[11px] text-ink-3">Dokončené</div></div>
          <div className="card-elevated p-2"><div className="text-lg font-extrabold">{user.stats.successfulReturns}</div><div className="text-[11px] text-ink-3">Vrátenia</div></div>
          <div className="card-elevated p-2"><div className="text-lg font-extrabold">{user.stats.cancelledRentals}</div><div className="text-[11px] text-ink-3">Zrušené</div></div>
        </div>
      </section>
      <section className="card space-y-5 p-5">
        <h2 className="text-lg font-bold">Hodnotenia</h2>
        <RatingDistribution summary={user.rating} />
        {reviews.data && <ReviewList reviews={reviews.data.reviews} emptyText="Používateľ zatiaľ nemá hodnotenia." />}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Predmety</h2>
        {items.length ? <ItemGrid items={items} /> : <EmptyState message={EMPTY.items} />}
      </section>
    </div>
  );
}
