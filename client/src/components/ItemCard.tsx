import { Heart, MapPin, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { ItemCard as Item } from '../api/types';
import { CONDITION_LABELS, imageUrl, priceLabels } from '../lib/format';
import { RatingInline } from './Rating';
import { del, post } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';

export function ItemCard({ item }: { item: Item }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [fav, setFav] = useState(item.isFavorite);

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
    <article className="card group flex flex-col overflow-hidden p-0">
      <div className="relative">
        <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden>
          <img src={imageUrl(item.images[0]?.url)} alt="" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        </Link>
        <button
          onClick={toggleFav}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-night/70 backdrop-blur"
          aria-label={fav ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených'}
          aria-pressed={fav}
        >
          <Heart className={`h-4 w-4 ${fav ? 'fill-neon-pink text-neon-pink' : 'text-ink'}`} aria-hidden />
        </button>
        {item.protectionAvailable && (
          <span className="badge badge-protect absolute left-2 top-2 bg-night/80 backdrop-blur">
            <ShieldCheck className="h-3 w-3" aria-hidden />Ochrana
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">
          <Link to={`/items/${item.id}`} className="hover:underline">{item.title}</Link>
        </h3>
        <div className="flex flex-wrap items-baseline gap-x-2">
          {priceLabels(item).map((p, i) => (
            <span key={p.mode} className={i === 0 ? 'text-gradient text-lg font-extrabold' : 'text-sm font-bold text-ink-2'}>
              {p.mode === 'DAILY' && i > 0 ? `od ${p.text}` : p.text}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{item.city}</span>
          <span aria-hidden>·</span>
          <span>{CONDITION_LABELS[item.condition]}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="flex items-center gap-1 truncate text-xs text-ink-3">
            <span className="truncate">{item.owner.name.split(' ')[0]}</span>
            <RatingInline average={item.owner.rating.average} count={item.owner.rating.count} />
          </span>
          <Link to={`/items/${item.id}`} className="btn btn-secondary btn-sm shrink-0" aria-label={`Detail: ${item.title}`}>Detail</Link>
        </div>
      </div>
    </article>
  );
}

export function ItemGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <ItemCard key={i.id} item={i} />
      ))}
    </div>
  );
}
