import { formatEur } from '../lib/format';

interface Props {
  rentalDays: number;
  pricePerDayCents: number;
  rentalPriceCents: number;
  protectionFeeCents: number;
  depositCents: number;
  platformFeeCents: number;
  totalCents: number;
  isDemo?: boolean;
  simulated?: boolean;
}

/** Visually separates non-refundable rental price, protection fee, refundable deposit and platform fee. */
export function PriceBreakdown(p: Props) {
  return (
    <div className="space-y-3" data-testid="price-breakdown">
      <div className="card-elevated p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Nevratné</div>
        <Row label={`Prenájom: ${p.rentalDays} ${dayWord(p.rentalDays)} × ${formatEur(p.pricePerDayCents)}`} value={formatEur(p.rentalPriceCents)} />
        {p.protectionFeeCents > 0 && (
          <Row
            label={
              <>
                Ochrana prenájmu {p.isDemo !== false && <span className="badge badge-demo ml-1">DEMO</span>}
              </>
            }
            value={formatEur(p.protectionFeeCents)}
            hint="Nie je poistenie."
          />
        )}
        {p.platformFeeCents > 0 && <Row label="Poplatok platformy" value={formatEur(p.platformFeeCents)} />}
      </div>
      <div className="card-elevated border-neon-green/25 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neon-green">Vratné</div>
        <Row
          label={
            <>
              Vratná záloha {p.simulated !== false && <span className="badge ml-1">SIMULATED PAYMENT</span>}
            </>
          }
          value={formatEur(p.depositCents)}
          hint="Vráti sa po riadnom vrátení predmetu."
        />
      </div>
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="font-semibold text-ink-2">Odhadovaná suma spolu</span>
        <span className="text-xl font-extrabold">{formatEur(p.totalCents)}</span>
      </div>
    </div>
  );
}

const dayWord = (n: number) => (n === 1 ? 'deň' : n >= 2 && n <= 4 ? 'dni' : 'dní');

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
