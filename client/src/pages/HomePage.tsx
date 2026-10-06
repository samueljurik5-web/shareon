import { MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import type { Category, ItemCard } from '../api/types';
import { CategoryChips } from '../components/CategoryChips';
import { ItemGrid } from '../components/ItemCard';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { useAsync } from '../lib/useAsync';
import { CATEGORY_EMOJI, CATEGORY_LABELS, EMPTY } from '../lib/format';

type ListRes = { items: ItemCard[]; total: number };

export function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | ''>('');

  const recommended = useAsync(() => get<ListRes>(`/api/items?sort=rating&limit=8${category ? `&category=${category}` : ''}`), [category]);
  const latest = useAsync(() => get<ListRes>(`/api/items?sort=newest&limit=8${category ? `&category=${category}` : ''}`), [category]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-night-2 px-5 py-8 sm:px-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon-purple/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-neon-blue/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink-2">
            <MapPin className="h-3.5 w-3.5 text-neon-blue" aria-hidden />Košice
          </span>
          <h1 className="text-gradient mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Požičaj si viac. Kupuj menej.</h1>
          <p className="mt-4 text-lg text-ink-2">Objav veci vo svojom okolí a požičaj ich ďalej.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search" className="btn btn-primary">Objaviť predmety</Link>
            <Link to="/items/new" className="btn btn-secondary">Pridať predmet</Link>
          </div>
        </div>
        <form onSubmit={onSearch} role="search" className="relative mt-8 max-w-2xl">
          <label htmlFor="home-search" className="sr-only">Čo si chceš požičať?</label>
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Čo si chceš požičať?" className="input h-14 rounded-full pl-13 pr-32 text-base" style={{ paddingLeft: '3.25rem' }} />
          <button type="submit" className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">Hľadať</button>
        </form>
      </section>

      <CategoryChips value={category} onChange={setCategory} />

      <Section title="Odporúčané" icon={<Sparkles className="h-5 w-5 text-neon-pink" aria-hidden />} link={`/search?sort=rating${category ? `&category=${category}` : ''}`}>
        {recommended.loading ? <CardSkeletons /> : recommended.error ? <ErrorState message={recommended.error.message} onRetry={recommended.reload} /> : recommended.data!.items.length ? <ItemGrid items={recommended.data!.items.slice(0, 4)} /> : <EmptyState message={EMPTY.items} />}
      </Section>

      <Section title="Najnovšie" link={`/search?sort=newest${category ? `&category=${category}` : ''}`}>
        {latest.loading ? <CardSkeletons /> : latest.error ? <ErrorState message={latest.error.message} onRetry={latest.reload} /> : latest.data!.items.length ? <ItemGrid items={latest.data!.items} /> : <EmptyState message={EMPTY.items} action={<Link className="btn btn-primary btn-sm" to="/items/new">Pridať predmet</Link>} />}
      </Section>

      <Section title="Populárne kategórie">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE'] as Category[]).map((c) => (
            <Link key={c} to={`/search?category=${c}`} className="card flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:border-neon-purple/40">
              <span className="text-3xl" aria-hidden>{CATEGORY_EMOJI[c]}</span>
              <span className="font-bold">{CATEGORY_LABELS[c]}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Link to="/protection" className="card flex items-center gap-4 p-5 hover:border-neon-green/40">
        <ShieldCheck className="h-8 w-8 shrink-0 text-neon-green" aria-hidden />
        <div>
          <div className="font-bold">Ako funguje Ochrana prenájmu?</div>
          <p className="text-sm text-ink-2">Ochrana prenájmu nie je poistenie. Pozri si, čo pokrýva a ako sa posudzujú škody.</p>
        </div>
      </Link>
    </div>
  );
}

function Section({ title, link, icon, children }: { title: string; link?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">{icon}{title}</h2>
        {link && <Link to={link} className="text-sm font-semibold text-neon-blue hover:underline">Zobraziť všetko</Link>}
      </div>
      {children}
    </section>
  );
}
