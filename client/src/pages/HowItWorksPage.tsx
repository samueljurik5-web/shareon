import { CalendarClock, Handshake, Mail, Search, ShieldCheck, Star } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/site';

const STEPS = [
  { icon: Search, title: 'Nájdi vec v okolí', text: 'Prezri si veci od ľudí v Košiciach – podľa kategórie, ceny alebo toho, či sa dajú požičať na hodiny.' },
  { icon: CalendarClock, title: 'Pošli žiadosť', text: 'Vyber dni alebo čas na hodiny. Cenu a kauciu vždy vypočíta server, majiteľ žiadosť schváli alebo zamietne.' },
  { icon: Handshake, title: 'Odovzdanie a vrátenie', text: 'Odovzdanie aj vrátenie potvrdíte v aplikácii. Kaucia je v tejto verzii len simulovaná (SIMULATED PAYMENT).' },
  { icon: Star, title: 'Ohodnoťte sa', text: 'Po skončení prenájmu sa navzájom ohodnoťte – hodnotenia pomáhajú ostatným vybrať si spoľahlivo.' },
];

export function HowItWorksPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">Ako to funguje</h1>
        <p className="mt-2 text-ink-2">Požičaj si vec od suseda namiesto kupovania – alebo zarob na tom, čo už máš.</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="card flex gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grad-primary text-night" aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold"><span className="text-neon-blue">{i + 1}.</span> {title}</h2>
              <p className="mt-1 text-sm text-ink-2">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link to="/protection" className="card flex items-center gap-4 p-5 hover:border-neon-green/40">
        <ShieldCheck className="h-8 w-8 shrink-0 text-neon-green" aria-hidden />
        <div>
          <div className="font-bold">Ochrana prenájmu</div>
          <p className="text-sm text-ink-2">Ochrana prenájmu nie je poistenie. Pozri si, čo pokrýva a ako sa posudzujú škody.</p>
        </div>
      </Link>

      <section id="kontakt" className="card scroll-mt-24 space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-neon-blue" aria-hidden />Kontakt</h2>
        <p className="text-sm text-ink-2">
          Problém s konkrétnym prenájmom (poškodenie, nevrátenie, platba) nahlás priamo v detaile žiadosti cez „Nahlásiť problém“ – dostane sa k administrátorovi aj s históriou prenájmu.
        </p>
        {CONTACT_EMAIL ? (
          <p className="text-sm text-ink-2">
            Ostatné otázky: <a className="font-semibold text-neon-blue hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        ) : (
          <p className="text-sm text-ink-3">Kontaktný e-mail doplníme čoskoro.</p>
        )}
      </section>
    </div>
  );
}
