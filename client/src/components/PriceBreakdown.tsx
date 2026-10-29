import { ShieldCheck } from 'lucide-react';
import type { RentalMode } from '../api/types';
import { formatEur, hoursLabel, PAYMENTS_SIMULATED, PROTECTION_HINT } from '../lib/format';

export interface PriceBreakdownProps {
  rentalMode: RentalMode;
  /** hours (may be fractional) or days */
  units: number;
  pricePerUnitCents: number;
  rentalPriceCents: number;
  protectionFeeCents: number;
  platformFeeCents: number;
  totalCents: number;
  /** Show the "payments are simulated" note (checkout and reservation) */
  showPaymentNote?: boolean;
}

const unitsText = (mode: RentalMode, units: number) =>
  mode === 'HOURLY' ? (Number.isInteger(units) ? String(units) : hoursLabel(units).split(' ')[0]) : String(units);

/** Server-calculated amounts only: rental price + Ochrana prenájmu (+ platform fee) = total. No deposit. */
export function PriceBreakdown(p: PriceBreakdownProps) {
  const unit = p.rentalMode === 'HOURLY' ? 'hod.' : p.units === 1 ? 'deň' : 'dni';
  return (
    <div className="space-y-3" data-testid="price-breakdown">
      <div className="card-elevated p-4">
        <Row
          label="Cena prenájmu"
          hint={`${unitsText(p.rentalMode, p.units)} ${unit} × ${formatEur(p.pricePerUnitCents)}`}
          value={formatEur(p.rentalPriceCents)}
        />
        <Row
          label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-neon-green" aria-hidden />Ochrana prenájmu</span>}
          value={formatEur(p.protectionFeeCents)}
          hint={PROTECTION_HINT}
        />
        {p.platformFeeCents > 0 && <Row label="Poplatok platformy" value={formatEur(p.platformFeeCents)} />}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="font-bold">Spolu</span>
          <span className="text-xl font-extrabold" data-testid="price-total">{formatEur(p.totalCents)}</span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-neon-green">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />Bez kaucie – neplatíš žiadnu vratnú zálohu.
      </p>
      {p.showPaymentNote && <p className="px-1 text-xs text-ink-3">{PAYMENTS_SIMULATED}</p>}
    </div>
  );
}

function Row({ label, value, hint }: { label: React.ReactNode; value: string; hint?: string }) {
  return (
    <div className="mt-2 flex items-start justify-between gap-3 text-sm first:mt-0">
      <div>
        <div className="text-ink">{label}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      <div className="shrink-0 font-bold">{value}</div>
    </div>
  );
}
