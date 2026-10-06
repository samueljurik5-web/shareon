import type { Category } from '../api/types';
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../lib/format';

const ORDER: Category[] = ['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER'];

export function CategoryChips({ value, onChange }: { value: Category | ''; onChange: (c: Category | '') => void }) {
  return (
    <div className="h-scroll" role="group" aria-label="Kategórie">
      <button className={`chip ${value === '' ? 'chip-active' : ''}`} aria-pressed={value === ''} onClick={() => onChange('')}>Všetko</button>
      {ORDER.map((c) => (
        <button key={c} className={`chip ${value === c ? 'chip-active' : ''}`} aria-pressed={value === c} onClick={() => onChange(c)}>
          <span aria-hidden>{CATEGORY_EMOJI[c]}</span>
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}
