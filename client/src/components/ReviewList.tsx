import type { Review } from '../api/types';
import { formatDate, EMPTY } from '../lib/format';
import { Avatar } from './Avatar';
import { RatingStars } from './Rating';
import { Link } from 'react-router-dom';

export function ReviewList({ reviews, emptyText = EMPTY.reviews }: { reviews: Review[]; emptyText?: string }) {
  if (!reviews.length) return <p className="text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <Avatar name={r.author.name} url={r.author.avatarUrl} size={32} />
            <div className="min-w-0 flex-1">
              <Link to={`/users/${r.author.id}`} className="font-semibold hover:underline">{r.author.name}</Link>
              <div className="text-xs text-ink-3">{formatDate(r.createdAt)}</div>
            </div>
            <RatingStars value={r.overall} />
          </div>
          {r.comment && <p className="mt-3 text-sm text-ink-2">{r.comment}</p>}
        </li>
      ))}
    </ul>
  );
}
