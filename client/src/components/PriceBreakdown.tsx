import type { RentalMode } from '../api/types';
import { formatEur, hoursLabel } from '../lib/format';

export interface PriceBreakdownProps {
  rentalMode: RentalMode;
  /** hours (may be fractional) or days */
  units: number;
  pricePerUnitCents: number;
  rentalPriceCents: number;
  protectionFeeCents: number;
  depositCents: number;
  platformFeeCents: number;
  totalCents: number;
  refundableCents?: number;
  isDemo?: boolean;
  simulated?: boolean;
}

const unitsText = (mode: RentalMode, units: number) =>
  mode === 'HOURLY' ? (Number.isInteger(units) ? String(units) : hoursLabel(units).split(' ')[0]) : String(units);

/**
 * Server-calculated amounts only. Visually separates the non-refundable rental price,
 * protection fee (not insurance) and platform fee from the refundable deposit.
 */
export function PriceBreakdown(p: PriceBreakdownProps) {
  const unit = p.rentalMode === 'HOURLY' ? 'hod.' : p.units === 1 ? 'deň' : 'dni';
  return (
    <div className="space-y-3" data-testid="price-breakdown">
      <div className="card-elevated p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Nevratné</div>
        <Row
          label="Cena prenájmu"
          hint={`${unitsText(p.rentalMode, p.units)} ${unit} × ${formatEur(p.pricePerUnitCents)} = ${formatEur(p.rentalPriceCents)}`}
          value={formatEur(p.rentalPriceCents)}
        />
        {p.protectionFeeCents > 0 && (
          <Row
            label={
              <>
                Ochrana prenájmu {p.isDemo !== false && <span className="badge badge-demo ml-1">DEMO</span>}
              </>
            }
            value={formatEur(p.protectionFeeCents)}
            hint="Nie je poistenie. Kompenzácia nie je automatická."
          />
        )}
        <Row label="Platformový poplatok" value={formatEur(p.platformFeeCents)} hint={p.platformFeeCents === 0 ? 'Počas MVP bez poplatku.' : undefined} />
      </div>
      <div className="card-elevated border-neon-green/25 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neon-green">Vratné</div>
        <Row
          label={
            <>
              Vratná kaucia {p.simulated !== false && <span className="badge ml-1">SIMULATED PAYMENT</span>}
            </>
          }
          value={formatEur(p.depositCents)}
          hint="Vráti sa po riadnom vrátení predmetu, ak nie je zadržaná v spore."
        />
      </div>
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="font-semibold text-ink-2">Odhad spolu</span>
        <span className="text-xl font-extrabold">{formatEur(p.totalCents)}</span>
      </div>
      {p.refundableCents != null && p.refundableCents > 0 && (
        <p className="px-1 text-xs text-ink-3">Z toho vratné: {formatEur(p.refundableCents)}</p>
      )}
    </div>
  );
}

function Row({ label, value, hint }: { label: React.ReactNode; value: string; hint?: string }) {
  return (
    <div className="mt-2 flex items-start justify-between gap-3 text-sm">
      <div>
        <div className="text-ink">{label}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      <div className="shrink-0 font-bold">{value}</div>
    </div>
  );
}
