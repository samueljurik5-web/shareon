import { CheckCircle2, Rocket, SearchX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, post } from '../api/client';
import { KOSICE_DISTRICTS } from '../lib/districts';
import { Checkbox, SelectField, TextField } from './Field';

/** Short GDPR note under every form that collects contact data. */
export function PrivacyNote() {
  return (
    <p className="text-xs text-ink-3">
      Údaje použijeme len na kontakt ohľadom ShareOn. Viac v <Link to="/ochrana-udajov" className="underline">zásadách ochrany osobných údajov</Link>.
    </p>
  );
}

function Thanks({ children, onAgain }: { children: string; onAgain: () => void }) {
  return (
    <div className="notice flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
      <span className="flex items-center gap-2 font-semibold text-ink"><CheckCircle2 className="h-5 w-5 text-neon-green" aria-hidden />{children}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onAgain}>Poslať ďalšie</button>
    </div>
  );
}

const errorsOf = (err: unknown) =>
  err instanceof ApiError ? { ...err.fieldErrors(), form: err.message } : { form: 'Nepodarilo sa odoslať. Skús to znova.' };

/** "Nenašiel si, čo hľadáš?" – demand for things nobody offers yet. */
export function DemandForm({ initialWhat = '', compact = false }: { initialWhat?: string; compact?: boolean }) {
  const [what, setWhat] = useState(initialWhat);
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (what.trim().length < 3) errs.what = 'Napíš aspoň 3 znaky.';
    if (email.trim() && !consent) errs.consent = 'Potvrď, že ťa môžeme kontaktovať.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await post('/api/launch/demand', { what: what.trim(), email: email.trim() || null, district: district || null, consent });
      setSent(true);
      setWhat('');
    } catch (err) {
      setErrors(errorsOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id={compact ? undefined : 'hladam'} className={`card scroll-mt-24 space-y-4 ${compact ? 'p-5' : 'p-6 sm:p-8'}`} aria-labelledby={compact ? 'demand-heading-c' : 'demand-heading'}>
      <div className="flex items-start gap-3">
        <SearchX className="mt-1 h-6 w-6 shrink-0 text-neon-blue" aria-hidden />
        <div>
          <h2 id={compact ? 'demand-heading-c' : 'demand-heading'} className="text-xl font-extrabold">Nenašiel si, čo hľadáš?</h2>
          <p className="mt-1 text-sm text-ink-2">Daj nám vedieť – zoženieme to od ľudí v okolí a ozveme sa ti.</p>
        </div>
      </div>
      {sent ? (
        <Thanks onAgain={() => setSent(false)}>Ďakujeme! Pozrieme sa, kto v okolí to môže požičať.</Thanks>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <TextField id={`dm-what${compact ? '-c' : ''}`} label="Čo si chceš požičať?" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={200} error={errors.what} placeholder="napr. vozík za auto, karimatka, zváračka" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id={`dm-email${compact ? '-c' : ''}`} type="email" autoComplete="email" label="E-mail (nepovinné)" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} error={errors.email} />
            <SelectField id={`dm-district${compact ? '-c' : ''}`} label="Mestská časť (nepovinné)" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Neuvádzať</option>
              {KOSICE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </SelectField>
          </div>
          {email.trim() && (
            <Checkbox id={`dm-consent${compact ? '-c' : ''}`} checked={consent} onChange={setConsent} error={errors.consent}>
              Súhlasím, aby ma ShareOn kontaktoval, keď bude vec dostupná.
            </Checkbox>
          )}
          {errors.form && !errors.what && !errors.email && <p className="field-error" role="alert">{errors.form}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Odosielam…' : 'Odoslať'}</button>
          <PrivacyNote />
        </form>
      )}
    </section>
  );
}

const ROLES = [
  ['BORROW', 'Chcem si požičiavať'],
  ['LEND', 'Chcem požičiavať svoje veci'],
  ['BOTH', 'Oboje'],
] as const;

/** "Chcem byť medzi prvými" – early-interest list. */
export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number][0]>('BORROW');
  const [district, setDistrict] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Zadaj platný e-mail.';
    if (!consent) errs.consent = 'Potvrď, že ťa môžeme kontaktovať.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await post<{ alreadySignedUp: boolean }>('/api/launch/waitlist', { email: email.trim(), role, district: district || null, consent });
      setSent(res.alreadySignedUp ? 'Už si na zozname – aktualizovali sme tvoju voľbu.' : 'Ďakujeme! Ozveme sa ti medzi prvými.');
      setEmail('');
      setConsent(false);
    } catch (err) {
      setErrors(errorsOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="medzi-prvymi" className="card scroll-mt-24 space-y-4 p-6 sm:p-8" aria-labelledby="waitlist-heading">
      <div className="flex items-start gap-3">
        <Rocket className="mt-1 h-6 w-6 shrink-0 text-neon-pink" aria-hidden />
        <div>
          <h2 id="waitlist-heading" className="text-xl font-extrabold">Chcem byť medzi prvými</h2>
          <p className="mt-1 text-sm text-ink-2">ShareOn spúšťame v Košiciach. Zapíš sa a dáme ti vedieť, keď bude v tvojom okolí dosť vecí.</p>
        </div>
      </div>
      {sent ? (
        <Thanks onAgain={() => setSent(null)}>{sent}</Thanks>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <fieldset>
            <legend className="label">Čo ťa zaujíma?</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {ROLES.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={role === value} className={`chip ${role === value ? 'chip-active' : ''}`} onClick={() => setRole(value)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="wl-email" type="email" autoComplete="email" label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} error={errors.email} />
            <SelectField id="wl-district" label="Mestská časť (nepovinné)" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Neuvádzať</option>
              {KOSICE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </SelectField>
          </div>
          <Checkbox id="wl-consent" checked={consent} onChange={setConsent} error={errors.consent}>
            Súhlasím, aby ma ShareOn kontaktoval e-mailom ohľadom spustenia služby.
          </Checkbox>
          {errors.form && !errors.email && !errors.consent && <p className="field-error" role="alert">{errors.form}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Odosielam…' : 'Zapísať sa'}</button>
          <PrivacyNote />
        </form>
      )}
    </section>
  );
}
