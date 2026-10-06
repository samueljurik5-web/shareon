import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get } from '../api/client';
import type { Category, Condition, ItemCard } from '../api/types';
import { CategoryChips } from '../components/CategoryChips';
import { ItemGrid } from '../components/ItemCard';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { useAsync } from '../lib/useAsync';
import { CONDITION_LABELS, EMPTY } from '../lib/format';

const FILTER_KEYS = ['q', 'category', 'city', 'minPrice', 'maxPrice', 'condition', 'from', 'to', 'protection', 'sort'];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const qs = params.toString();
  const { data, loading, error, reload } = useAsync(() => get<{ items: ItemCard[]; total: number }>(`/api/items?limit=48&${qs}`), [qs]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const conditions = (params.get('condition') ?? '').split(',').filter(Boolean) as Condition[];
  const toggleCondition = (c: Condition) => set('condition', (conditions.includes(c) ? conditions.filter((x) => x !== c) : [...conditions, c]).join(','));
  const activeCount = FILTER_KEYS.filter((k) => k !== 'q' && k !== 'sort' && k !== 'category' && params.get(k)).length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Objaviť predmety</h1>
      <div className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">Čo si chceš požičať?</label>
        <input id="search-q" type="search" defaultValue={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} placeholder="Čo si chceš požičať?" className="input rounded-full" />
        <button className="btn btn-secondary shrink-0" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="filters">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filtre</span>
          {activeCount > 0 && <span className="badge badge-info">{activeCount}</span>}
        </button>
      </div>
      <CategoryChips value={(params.get('category') as Category) ?? ''} onChange={(c) => set('category', c)} />

      {showFilters && (
        <div id="filters" className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="f-city">Mesto</label>
            <input id="f-city" className="input" value={params.get('city') ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="Košice" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="f-min">Cena od (€/deň)</label>
              <input id="f-min" className="input" type="number" min={0} inputMode="decimal" value={params.get('minPrice') ?? ''} onChange={(e) => set('minPrice', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-max">Cena do</label>
              <input id="f-max" className="input" type="number" min={0} inputMode="decimal" value={params.get('maxPrice') ?? ''} onChange={(e) => set('maxPrice', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="f-from">Dostupné od</label>
              <input id="f-from" className="input" type="date" value={params.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-to">do</label>
              <input id="f-to" className="input" type="date" value={params.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-sort">Zoradiť</label>
            <select id="f-sort" className="input" value={params.get('sort') ?? 'newest'} onChange={(e) => set('sort', e.target.value)}>
              <option value="newest">Najnovšie</option>
              <option value="price_asc">Najnižšia cena</option>
              <option value="price_desc">Najvyššia cena</option>
              <option value="rating">Najlepšie hodnotenie</option>
            </select>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="label">Stav</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
                <button key={c} type="button" className={`chip ${conditions.includes(c) ? 'chip-active' : ''}`} aria-pressed={conditions.includes(c)} onClick={() => toggleCondition(c)}>{CONDITION_LABELS[c]}</button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 self-end text-sm font-semibold text-ink-2">
            <input type="checkbox" className="h-5 w-5 accent-[#42F5A7]" checked={params.get('protection') === 'true'} onChange={(e) => set('protection', e.target.checked ? 'true' : '')} />
            Dostupná Ochrana prenájmu
          </label>
          <button className="btn btn-ghost btn-sm self-end justify-self-start" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            <X className="h-4 w-4" aria-hidden />Vymazať filtre
          </button>
        </div>
      )}

      {!loading && data && <p className="text-sm text-ink-3" aria-live="polite">Nájdené: {data.total}</p>}
      {loading ? <CardSkeletons count={8} /> : error ? <ErrorState message={error.message} onRetry={reload} /> : data!.items.length ? <ItemGrid items={data!.items} /> : <EmptyState message={EMPTY.results} />}
    </div>
  );
}
