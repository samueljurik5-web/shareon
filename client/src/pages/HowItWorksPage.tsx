import { Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSite } from '../lib/site';
import { HOW_STEPS } from '../lib/content';


export function HowItWorksPage() {
  const { contactEmail: CONTACT_EMAIL } = useSite();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">Ako to funguje</h1>
        <p className="mt-2 text-ink-2">Požičaj si vec od suseda namiesto kupovania – alebo zarob na tom, čo už máš.</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2">
        {HOW_STEPS.map(({ icon: Icon, title, text }, i) => (
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
          <p className="text-sm text-ink-2">Bez kaucie a s Ochranou prenájmu v cene. Pozri si, ako funguje a ako sa riešia škody.</p>
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
          <p className="text-sm text-ink-3">Kontaktný e-mail doplníme čoskoro. Dovtedy nám napíš cez spätnú väzbu na hlavnej stránke.</p>
        )}
      </section>
    </div>
  );
}
