import { Heart, MapPin, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { ItemCard as Item } from '../api/types';
import { formatEur, formatKm, imageUrl, priceFrom } from '../lib/format';
import { del, post } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { NoDepositBadge } from './Trust';

/** Stagger for cards in one visible group – capped so large lists never make the user wait. */
const STAGGER_MS = 40;
const MAX_STAGGER_MS = 240;

/** Card badges: availability today + rental mode ("Na hodiny" when hourly is possible, else "Na dni"). */
const badgesFor = (item: Item) => {
  const out: { label: string; className: string }[] = [];
  if (item.availableToday) out.push({ label: 'Dostupné dnes', className: 'badge-info' });
  out.push(item.hourlyRentalEnabled ? { label: 'Na hodiny', className: '' } : { label: 'Na dni', className: '' });
  return out;
};

/** Item rating when the item has reviews, otherwise the owner's rating; "Nové" without any. */
function CardRating({ item }: { item: Item }) {
  const own = item.rating.count > 0 ? item.rating : null;
  const r = own ?? (item.owner.rating.count > 0 ? item.owner.rating : null);
  if (!r || r.average == null) return <span className="text-xs text-ink-3">Nové</span>;
  const value = r.average.toLocaleString('sk-SK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const what = own ? 'Hodnotenie predmetu' : 'Hodnotenie majiteľa';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink" title={`${what}: ${value} z 5 (${r.count})`}>
      <Star className="h-3.5 w-3.5 fill-neon-pink text-neon-pink" aria-hidden />
      <span className="sr-only">{what}: </span>
      {value}
    </span>
  );
}

export function ItemCard({ item, index = 0, featured = false, className = '' }: { item: Item; index?: number; featured?: boolean; className?: string }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [fav, setFav] = useState(item.isFavorite);
  const price = priceFrom(item);

  const toggleFav = async () => {
    if (!user) return navigate('/login');
    const next = !fav;
    setFav(next); // optimistic
    try {
      if (next) await post(`/api/items/${item.id}/favorite`);
      else await del(`/api/items/${item.id}/favorite`);
    } catch {
      setFav(!next);
      toast('Obľúbené sa nepodarilo uložiť.', 'error');
    }
  };

  return (
    <article
      className={`card card-interactive animate-fade-up group flex flex-col overflow-hidden p-0 ${className}`}
      style={{ animationDelay: `${Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}ms` }}
    >
      <div className="relative">
        <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden>
          <img
            src={imageUrl(item.images[0]?.url)}
            alt=""
            className={`card-media w-full object-cover ${featured ? 'aspect-[2/1] md:aspect-[4/3]' : 'aspect-[4/3]'}`}
            loading={index < 4 ? 'eager' : 'lazy'}
          />
        </Link>
        <button
          onClick={toggleFav}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-night/70 backdrop-blur"
          aria-label={fav ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených'}
          aria-pressed={fav}
        >
          <Heart className={`h-4 w-4 transition-colors duration-200 ${fav ? 'animate-icon-pop fill-neon-pink text-neon-pink' : 'text-ink'}`} aria-hidden />
        </button>
        <NoDepositBadge className="absolute left-2 top-2 bg-night/80 backdrop-blur" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap gap-1">
          {badgesFor(item).map((b) => (
            <span key={b.label} className={`badge ${b.className}`}>{b.label}</span>
          ))}
        </div>
        <h3 className={`line-clamp-2 font-bold leading-snug ${featured ? 'text-lg md:text-base' : 'text-sm sm:text-base'}`}>
          <Link to={`/items/${item.id}`} className="hover:underline">{item.title}</Link>
        </h3>
        {price && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={`text-gradient font-extrabold ${featured ? 'text-xl md:text-lg' : 'text-base sm:text-lg'}`}>{price}</span>
            {item.dailyPriceCents && item.hourlyPriceCents && <span className="text-xs font-bold text-ink-2">· {formatEur(item.hourlyPriceCents)} / hod.</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
          {item.distanceKm != null ? (
            <span className="inline-flex items-center gap-1" title={`Orientačná vzdialenosť od centra Košíc${item.district ? ` (${item.district})` : ''}`}>
              <MapPin className="h-3 w-3" aria-hidden />
              {formatKm(item.distanceKm)}
              <span className="sr-only"> od centra Košíc</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{item.city}</span>
          )}
          <CardRating item={item} />
        </div>
        <Link to={`/items/${item.id}`} className="btn btn-secondary btn-sm mt-auto w-full" aria-label={`Pozrieť: ${item.title}`}>Pozrieť</Link>
      </div>
    </article>
  );
}

export function ItemGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i, idx) => (
        <ItemCard key={i.id} item={i} index={idx} />
      ))}
    </div>
  );
}
