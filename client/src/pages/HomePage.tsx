import {
  Bike, ChevronLeft, ChevronRight, Clock, Flame, Hammer, Laptop, PackagePlus, Search, Sofa, Sparkles, Sprout, Tent,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../api/client';
import type { Category, ItemCard as Item } from '../api/types';
import { ItemCard } from '../components/ItemCard';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { useAsync } from '../lib/useAsync';

type ListRes = { items: Item[]; total: number };

/** Quick filters under the search – each maps to one or more item categories. */
const QUICK_FILTERS: { label: string; categories: Category[] }[] = [
  { label: 'Všetko', categories: [] },
  { label: 'Náradie', categories: ['WORKSHOP', 'GARDEN'] },
  { label: 'Šport', categories: ['SPORT'] },
  { label: 'Technika', categories: ['ELECTRONICS'] },
  { label: 'Domácnosť', categories: ['HOUSEHOLD'] },
  { label: 'Ostatné', categories: ['LEISURE', 'OTHER'] },
];

/** Category row with icons – one category each. */
const CATEGORY_TILES: { category: Category; label: string; icon: LucideIcon }[] = [
  { category: 'WORKSHOP', label: 'Dielňa', icon: Hammer },
  { category: 'GARDEN', label: 'Záhrada', icon: Sprout },
  { category: 'SPORT', label: 'Šport', icon: Bike },
  { category: 'ELECTRONICS', label: 'Technika', icon: Laptop },
  { category: 'HOUSEHOLD', label: 'Domácnosť', icon: Sofa },
  { category: 'LEISURE', label: 'Voľný čas', icon: Tent },
  { category: 'OTHER', label: 'Ostatné', icon: Sparkles },
];

/** Items in the main section: mobile 1 large + 8 small (2 per row), md 3 rows of 3, lg 2 rows of 4. */
const MAIN_LIMIT = 9;
const EMPTY_TEXT = 'Zatiaľ tu nie sú žiadne veci. Skús inú kategóriu alebo pridaj prvú vec.';

const sameSet = (a: Category[], b: Category[]) => a.length === b.length && a.every((c) => b.includes(c));

export function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  // The selected categories live in the URL (?category=WORKSHOP,GARDEN), so "back" from a detail keeps the filter.
  const raw = params.get('category') ?? '';
  const selected = raw.split(',').filter(Boolean) as Category[];
  const categoryQuery = selected.length ? `&category=${selected.join(',')}` : '';

  const main = useAsync(() => get<ListRes>(`/api/items?sort=newest&limit=${MAIN_LIMIT}${categoryQuery}`), [raw]);
  const popular = useAsync(() => get<ListRes>('/api/items?sort=popular&limit=10'), []);

  const select = (categories: Category[]) =>
    setParams(categories.length ? { category: categories.join(',') } : {}, { replace: true, preventScrollReset: true });

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    if (selected.length) sp.set('category', selected.join(','));
    const qs = sp.toString();
    navigate(`/search${qs ? `?${qs}` : ''}`);
  };

  const items = main.data?.items ?? [];

  return (
    <div className="space-y-7 sm:space-y-10">
      <div className="space-y-3 sm:space-y-4">
        <form onSubmit={onSearch} role="search" className="relative">
          <label htmlFor="home-search" className="sr-only">Čo si chceš požičať?</label>
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="home-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Čo si chceš požičať?"
            className="input h-14 rounded-full pr-28 text-base sm:h-16 sm:text-lg"
            style={{ paddingLeft: '3.25rem' }}
          />
          <button type="submit" className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2 sm:right-2.5">Hľadať</button>
        </form>

        <div className="h-scroll" role="group" aria-label="Rýchle filtre">
          {QUICK_FILTERS.map((f) => {
            const active = sameSet(f.categories, selected);
            return (
              <button key={f.label} type="button" className={`chip ${active ? 'chip-active' : ''}`} aria-pressed={active} onClick={() => select(f.categories)}>
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="h-scroll -mx-4 gap-2 px-4 md:mx-0 md:grid md:grid-cols-7 md:px-0" role="group" aria-label="Kategórie">
          {CATEGORY_TILES.map(({ category, label, icon: Icon }) => {
            const active = selected.length === 1 && selected[0] === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => select(active ? [] : [category])}
                aria-pressed={active}
                className={`group flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-xs md:gap-1.5 md:py-2.5 font-semibold transition-colors duration-200 ease-out md:w-auto ${active ? 'border-neon-purple/50 bg-neon-purple/10 text-ink' : 'border-line bg-card text-ink-2 hover:bg-elevated hover:text-ink'}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full md:h-10 md:w-10 transition-colors duration-200 ${active ? 'bg-grad-primary text-night' : 'bg-night-2 text-neon-blue group-hover:text-neon-pink'}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="rent-heading">
        <h1 id="rent-heading" className="text-gradient text-[1.4rem] font-extrabold leading-tight tracking-tight sm:text-3xl">Požičaj si v svojom okolí</h1>
        <div className="mb-3 mt-1 flex items-baseline justify-between gap-3 sm:mb-4">
          <p className="text-sm text-ink-2 sm:text-base">Dostupné veci od ľudí v Košiciach</p>
          {items.length > 0 && (
            <Link to={`/search${selected.length ? `?category=${selected.join(',')}` : ''}`} className="shrink-0 text-sm font-semibold text-neon-blue hover:underline">
              Zobraziť všetko
            </Link>
          )}
        </div>
        {main.loading ? (
          <CardSkeletons count={4} />
        ) : main.error ? (
          <ErrorState message={main.error.message} onRetry={main.reload} />
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="rent-grid">
            {items.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                index={idx}
                featured={idx === 0}
                className={idx === 0 ? 'col-span-2 md:col-span-1' : idx === MAIN_LIMIT - 1 ? 'lg:hidden' : ''}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            message={EMPTY_TEXT}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {selected.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => select([])}>Zobraziť všetko</button>}
                <Link className="btn btn-primary btn-sm" to="/items/new">Pridať vec na prenájom</Link>
              </div>
            }
          />
        )}
      </section>

      {popular.data && popular.data.items.length > 0 && <PopularRow items={popular.data.items} />}

      <section className="relative overflow-hidden rounded-[28px] border border-line bg-night-2 p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-neon-purple/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-10 h-64 w-64 rounded-full bg-neon-blue/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grad-primary text-night">
              <Clock className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-gradient text-2xl font-extrabold sm:text-3xl">Potrebuješ to len na pár hodín?</h2>
              <p className="mt-2 max-w-xl text-ink-2">Vyber deň, čas a požičaj si vec bez dlhého prenájmu.</p>
            </div>
          </div>
          <Link to="/search?mode=HOURLY" className="btn btn-primary shrink-0 self-start sm:self-auto">Nájdi vec na hodiny</Link>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-elevated text-neon-blue">
            <PackagePlus className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">Máš niečo, čo nepoužívaš?</h2>
            <p className="mt-1 text-ink-2">Využi to, čo už máš, a zarob.</p>
          </div>
        </div>
        <Link to="/items/new" className="btn btn-secondary shrink-0 self-start sm:self-auto">Pridať vec na prenájom</Link>
      </section>
    </div>
  );
}

function PopularRow({ items }: { items: Item[] }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section aria-labelledby="popular-heading">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="popular-heading" className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
            <Flame className="h-5 w-5 text-neon-pink" aria-hidden />Populárne teraz
          </h2>
          <p className="mt-1 text-sm text-ink-2">Najčastejšie požičiavané a nové veci</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" className="btn btn-secondary btn-sm !px-2.5" onClick={() => scroll(-1)} aria-label="Posunúť doľava"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" className="btn btn-secondary btn-sm !px-2.5" onClick={() => scroll(1)} aria-label="Posunúť doprava"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>
      <div ref={row} className="h-scroll -mx-4 snap-x snap-mandatory scroll-px-4 gap-3 px-4 pb-2 md:mx-0 md:px-0" data-testid="popular-row">
        {items.map((item, idx) => (
          <div key={item.id} className="w-[min(15rem,68vw)] shrink-0 snap-start">
            <ItemCard item={item} index={idx} className="h-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
