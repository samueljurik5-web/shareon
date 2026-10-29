import { BadgeCheck, Camera, Flag, Handshake, ReceiptText, ShieldCheck, Star, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** "🛡️ Bez kaucie" – on every item card and item detail. */
export function NoDepositBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`badge badge-protect ${className}`}>
      <span aria-hidden>🛡️</span>Bez kaucie
    </span>
  );
}

/** Compact trust badges under the hero. */
export function TrustBadges() {
  const badges: { icon?: LucideIcon; emoji?: string; label: string }[] = [
    { emoji: '🛡️', label: 'Bez kaucie' },
    { icon: ShieldCheck, label: 'Ochrana prenájmu v cene' },
    { icon: ReceiptText, label: 'Jasná cena vopred' },
    { icon: Star, label: 'Hodnotenia používateľov' },
  ];
  return (
    <ul className="h-scroll gap-2 sm:flex-wrap sm:overflow-visible lg:justify-end" aria-label="Prečo je prenájom bezpečný">
      {badges.map(({ icon: Icon, emoji, label }) => (
        <li key={label} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink sm:text-sm">
          {emoji ? <span aria-hidden>{emoji}</span> : Icon && <Icon className="h-4 w-4 text-neon-green" aria-hidden />}
          {label}
        </li>
      ))}
    </ul>
  );
}

const SAFE_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: Wallet, text: 'Žiadna vratná kaucia.' },
  { icon: ShieldCheck, text: 'Ochrana prenájmu v cene.' },
  { icon: ReceiptText, text: 'Jasná cena vopred, bez skrytých poplatkov.' },
  { icon: Camera, text: 'Fotodokumentácia stavu veci pri odovzdaní.' },
  { icon: Flag, text: 'Nahlásenie škody do 48 hodín po vrátení.' },
  { icon: Star, text: 'Hodnotenia používateľov.' },
  { icon: Handshake, text: 'Riešenie sporov platformou.' },
];

/** "Bezpečný prenájom" – item detail page. */
export function SafeRental() {
  return (
    <section className="card space-y-3 p-5" aria-labelledby="safe-rental">
      <h2 id="safe-rental" className="flex items-center gap-2 text-lg font-bold">
        <BadgeCheck className="h-5 w-5 text-neon-green" aria-hidden />Bezpečný prenájom
      </h2>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {SAFE_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-ink-2">
            <Icon className="h-4 w-4 shrink-0 text-neon-green" aria-hidden />{text}
          </li>
        ))}
      </ul>
    </section>
  );
}
