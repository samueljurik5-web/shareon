import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { get } from '../api/client';
import type { PublicSettings } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { CATEGORY_LABELS, DAMAGE_DISCLAIMER, formatEur } from '../lib/format';

export function ProtectionPage() {
  const { data } = useAsync(() => get<PublicSettings>('/api/settings/public'), []);
  const s = data?.settings;
  const modeLabel = s ? ({ NONE: 'Vypnutá', PROTECTION_FEE: 'Poplatok za ochranu (interný mechanizmus)', INSURANCE: 'Poistenie cez partnera' } as const)[s.protectionMode] : '…';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">Ochrana prenájmu</h1>
        <p className="mt-2 text-ink-2">Ako ShareOn chráni majiteľov aj nájomcov – a čo ochrana prenájmu <strong>nie je</strong>.</p>
      </div>
      <ProtectionNotice />

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-neon-green" aria-hidden />Aktuálne nastavenie</h2>
        {s ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Row k="Režim" v={s.protectionActive ? modeLabel : 'Vypnutá'} />
            <Row k="Poskytovateľ" v={s.protectionProvider === 'mock' ? 'DEMO / TEST MODE (interný výpočet)' : s.protectionProvider} />
            <Row k="Minimálny poplatok" v={formatEur(s.minProtectionFeeCents)} />
            <Row k="Percento z hodnoty" v={`${(s.protectionPercentage * 100).toFixed(1)} %`} />
            <Row k="Max. chránená hodnota" v={formatEur(s.maxProtectedValueCents)} />
            <Row k="Záloha" v={`${Math.round(s.depositPercentage * 100)} % z hodnoty, max. ${formatEur(s.maxDepositCents)}`} />
            <Row k="Kategórie s ochranou" v={s.allowedCategories.map((c) => CATEGORY_LABELS[c]).join(', ') || '—'} />
            <Row k="Skutočné poistenie" v={s.insuranceAvailable ? 'Nakonfigurované' : 'Nie je k dispozícii'} />
          </dl>
        ) : <p className="text-ink-3">Načítavam…</p>}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Demo výpočet poplatku</h2>
        <p className="text-sm text-ink-2">Interný demo výpočet – <strong>nejde o cenu poistenia</strong>.</p>
        <pre className="overflow-x-auto rounded-2xl bg-night-2 p-4 text-xs text-ink-2">{`základný poplatok = max(1,50 €, hodnota predmetu × 2 %)
násobok trvania   = 1 + max(0, počet dní − 3) × 0,05
poplatok          = zaokrúhlenie(základ × násobok, 2 desatinné miesta)`}</pre>
        <p className="text-sm text-ink-2">Príklad: predmet v hodnote 100 €, 3 dni × 8 € → prenájom 24 €, ochrana 2 €, vratná záloha 30 €, spolu 56 €.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card space-y-2 p-5">
          <h2 className="font-bold text-neon-green">Čo ochrana znamená</h2>
          {['Pri škode môžeš otvoriť hlásenie s dôkazmi.', 'Prípad posúdi administrátor ShareOn.', 'Záloha môže byť čiastočne alebo úplne zadržaná podľa rozhodnutia.', 'Fotky pri odovzdaní a vrátení slúžia ako dôkaz.'].map((t) => (
            <p key={t} className="flex gap-2 text-sm text-ink-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" aria-hidden />{t}</p>
          ))}
        </section>
        <section className="card space-y-2 p-5">
          <h2 className="font-bold text-danger">Čo ochrana nie je</h2>
          {['Nie je to poistenie ani poistná zmluva.', 'Kompenzácia nie je automatická ani garantovaná.', 'V MVP sa neprevádzajú žiadne skutočné peniaze (SIMULATED PAYMENT).', 'Nekryje škody nad maximálnu chránenú hodnotu.'].map((t) => (
            <p key={t} className="flex gap-2 text-sm text-ink-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />{t}</p>
          ))}
        </section>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">Pravidlá ShareOn (skrátene)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Ponúkaj len veci, na ktoré máš právo, a opíš ich pravdivo vrátane poškodení.</li>
          <li>Pri odovzdaní aj vrátení nahrajte fotky stavu a potvrďte checklist.</li>
          <li>Predmet vráť načas, čistý a v rovnakom stave.</li>
          <li>Problémy rieš cez hlásenie v aplikácii – nie mimo platformy.</li>
          <li>{DAMAGE_DISCLAIMER}</li>
        </ol>
        <p className="text-xs text-ink-3">Právne dokumenty (VOP, ochrana osobných údajov) v MVP ešte neprešli odbornou právnou kontrolou.</p>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="card-elevated p-3">
      <dt className="text-xs text-ink-3">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
