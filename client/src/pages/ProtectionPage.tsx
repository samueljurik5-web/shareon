import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { TRUST_CARDS } from '../lib/content';
import { DAMAGE_DISCLAIMER, formatEur, MVP_NOTICE, PAYMENTS_SIMULATED, PROTECTION_HINT } from '../lib/format';

/** Worked examples – the same values the server calculates (10 %, min. 0,50 €, max. 5,00 €). */
const EXAMPLES = [500, 1200, 3000, 8000, 12000].map((rental) => {
  const fee = Math.min(500, Math.max(50, Math.round(rental / 10)));
  return { rental, fee, total: rental + fee };
});

export function ProtectionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">Ochrana prenájmu</h1>
        <p className="mt-2 text-ink-2">Požičaj si bez kaucie. Ochranu prenájmu máš v cene každého prenájmu.</p>
      </div>
      <ProtectionNotice />

      <div className="grid gap-3 sm:grid-cols-2">
        {TRUST_CARDS.map(({ icon: Icon, title, text }) => (
          <section key={title} className="card flex gap-3 p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" aria-hidden />
            <div>
              <h2 className="font-bold">{title}</h2>
              <p className="text-sm text-ink-2">{text}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-neon-green" aria-hidden />Koľko to stojí</h2>
        <p className="text-sm text-ink-2">
          Ochrana prenájmu je <strong className="text-ink">10 % z ceny prenájmu</strong>, minimálne <strong className="text-ink">0,50 €</strong> a maximálne{' '}
          <strong className="text-ink">5,00 €</strong> za prenájom – na hodiny aj na dni. {PROTECTION_HINT}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-3">
              <tr><th scope="col" className="py-2">Cena prenájmu</th><th scope="col" className="py-2">Ochrana prenájmu</th><th scope="col" className="py-2">Spolu</th></tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
              {EXAMPLES.map((e) => (
                <tr key={e.rental}><td className="py-2">{formatEur(e.rental)}</td><td className="py-2">{formatEur(e.fee)}</td><td className="py-2 font-bold">{formatEur(e.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3">Žiadna kaucia ani vratná záloha. {PAYMENTS_SIMULATED}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card space-y-2 p-5">
          <h2 className="font-bold text-neon-green">Čo Ochrana prenájmu znamená</h2>
          {[
            'Pri odovzdaní aj vrátení zdokumentujete stav veci fotkami.',
            'Problém alebo škodu nahlásiš v aplikácii do 48 hodín po vrátení.',
            'Hlásenie s dôkazmi posúdi tím ShareOn a pomôže s riešením sporu.',
            'Hodnotenia ukazujú, komu sa dá dôverovať.',
          ].map((t) => (
            <p key={t} className="flex gap-2 text-sm text-ink-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" aria-hidden />{t}</p>
          ))}
        </section>
        <section className="card space-y-2 p-5">
          <h2 className="font-bold text-danger">Na čo myslieť</h2>
          {[
            'Náhrada škody nie je automatická ani garantovaná.',
            'Každé hlásenie posudzuje človek podľa pravidiel a dôkazov.',
            'Bez fotiek a včasného nahlásenia je posúdenie ťažšie.',
            'V testovacej verzii platíš majiteľovi pri odovzdaní – ShareOn platby ešte nespracúva.',
          ].map((t) => (
            <p key={t} className="flex gap-2 text-sm text-ink-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />{t}</p>
          ))}
        </section>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">Pravidlá ShareOn (skrátene)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Ponúkaj len veci, na ktoré máš právo, a opíš ich pravdivo vrátane poškodení.</li>
          <li>Pri odovzdaní aj vrátení nahrajte fotky stavu a potvrďte checklist.</li>
          <li>Vec vráť načas, čistú a v rovnakom stave.</li>
          <li>Problémy rieš cez „Nahlásiť problém“ v aplikácii – najneskôr do 48 hodín po vrátení.</li>
          <li>{DAMAGE_DISCLAIMER}</li>
        </ol>
        <p className="text-xs text-ink-3">{MVP_NOTICE} Právne dokumenty (VOP, ochrana osobných údajov) ešte neprešli odbornou právnou kontrolou.</p>
      </section>
      <Link to="/" className="btn btn-primary">Preskúmať veci na prenájom</Link>
    </div>
  );
}
