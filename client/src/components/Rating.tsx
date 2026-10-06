import { Star } from 'lucide-react';
import type { RatingSummary as Summary } from '../api/types';
import { RATING_LABELS } from '../lib/format';

export function RatingStars({ value, size = 'sm' }: { value: number | null; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `Hodnotenie ${value} z 5` : 'Bez hodnotenia'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={`${s} ${i <= Math.round(v) ? 'fill-neon-pink text-neon-pink' : 'text-ink-3'}`} />
      ))}
    </span>
  );
}

export function RatingInline({ average, count }: { average: number | null; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-2">
      <Star className="h-3.5 w-3.5 fill-neon-pink text-neon-pink" aria-hidden />
      {average != null ? (
        <>
          <span className="font-bold text-ink">{average.toFixed(1)}</span>
          <span>({count})</span>
        </>
      ) : (
        <span>Nové</span>
      )}
    </span>
  );
}

export function RatingDistribution({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-32">
        <div className="text-4xl font-extrabold">{summary.average?.toFixed(1) ?? '–'}</div>
        <RatingStars value={summary.average} size="md" />
        <div className="mt-1 text-xs text-ink-3">{summary.count} hodnotení</div>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const c = summary.distribution[String(n) as '1'] ?? 0;
          const pct = summary.count ? (c / summary.count) * 100 : 0;
          return (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-ink-2">{n} · {RATING_LABELS[n]}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-2" role="presentation">
                <div className="h-full rounded-full bg-grad-secondary" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right text-ink-3">{c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RatingInput({ label, value, onChange, name }: { label: string; value: number; onChange: (v: number) => void; name: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap items-center gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-3 transition peer-checked:border-transparent peer-checked:bg-grad-secondary peer-checked:text-night peer-focus-visible:outline-2 peer-focus-visible:outline-neon-blue" title={RATING_LABELS[n]}>
              <Star className="h-4 w-4" aria-hidden />
              <span className="sr-only">{n} – {RATING_LABELS[n]}</span>
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-ink-2">{value ? RATING_LABELS[value] : ''}</span>
      </div>
    </fieldset>
  );
}
