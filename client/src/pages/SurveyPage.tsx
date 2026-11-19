import { CheckCircle2, ClipboardList } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, post } from '../api/client';
import { Checkbox, TextField } from '../components/Field';
import { PrivacyNote } from '../components/LaunchForms';
import { SURVEY_QUESTIONS, type SurveyKey } from '../lib/survey';

type Answers = Record<SurveyKey, string[]>;
const EMPTY: Answers = { boughtUnused: [], categories: [], wouldBorrow: [], barriers: [], noDepositHelps: [], wouldLend: [] };

/** Public market survey at /dotaznik – about one minute, no account needed. */
export function SurveyPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [other, setOther] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const choose = (key: SurveyKey, value: string, multi?: boolean) =>
    setAnswers((a) => {
      if (!multi) return { ...a, [key]: [value] };
      const has = a[key].includes(value);
      let next = has ? a[key].filter((v) => v !== value) : [...a[key], value];
      // "Nič" excludes the other barriers and the other way round.
      if (key === 'barriers' && !has) next = value === 'NOTHING' ? ['NOTHING'] : next.filter((v) => v !== 'NOTHING');
      return { ...a, [key]: next };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const q of SURVEY_QUESTIONS) if (!q.multi && !answers[q.key].length) errs[q.key] = 'Vyber odpoveď.';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Zadaj platný e-mail.';
    if (email.trim() && !consent) errs.consent = 'Potvrď, že ťa môžeme kontaktovať.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`q-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      await post('/api/launch/survey', {
        boughtUnused: answers.boughtUnused[0],
        categories: answers.categories,
        categoryOther: other.trim() || null,
        wouldBorrow: answers.wouldBorrow[0],
        barriers: answers.barriers,
        noDepositHelps: answers.noDepositHelps[0],
        wouldLend: answers.wouldLend[0],
        email: email.trim() || null,
        consent,
      });
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors(), form: err.message } : { form: 'Nepodarilo sa odoslať. Skús to znova.' });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="card space-y-4 p-6 text-center sm:p-10" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-neon-green" aria-hidden />
          <h1 className="text-gradient text-3xl font-extrabold">Ďakujem!</h1>
          <p className="text-ink-2">Tvoje odpovede mi veľmi pomôžu. Pošli dotazník aj kamarátom – čím viac odpovedí, tým lepší ShareOn.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/" className="btn btn-primary">Pozrieť ShareOn</Link>
            <Link to="/search" className="btn btn-secondary">Preskúmať veci</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-neon-blue"><ClipboardList className="h-4 w-4" aria-hidden />Dotazník · 1 minúta</p>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">Požičal by si si veci od susedov?</h1>
        <p className="text-ink-2">Ahoj, pripravujem ShareOn – aplikáciu na požičiavanie vecí od ľudí z okolia. Pomôžeš mi odpoveďou na 7 krátkych otázok? Ďakujem!</p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {SURVEY_QUESTIONS.map((q, i) => (
          <fieldset key={q.key} id={`q-${q.key}`} className="card scroll-mt-24 space-y-3 p-5">
            <legend className="sr-only">{q.title}</legend>
            <p className="font-bold text-ink" aria-hidden><span className="text-neon-blue">{i + 1}.</span> {q.title}</p>
            {q.multi && <p className="text-xs text-ink-3">Môžeš vybrať viac odpovedí.</p>}
            <div className="flex flex-wrap gap-2" role={q.multi ? 'group' : 'radiogroup'} aria-label={q.title}>
              {q.options.map(([value, label]) => {
                const on = answers[q.key].includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    role={q.multi ? undefined : 'radio'}
                    aria-checked={q.multi ? undefined : on}
                    aria-pressed={q.multi ? on : undefined}
                    className={`chip ${on ? 'chip-active' : ''}`}
                    onClick={() => choose(q.key, value, q.multi)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {q.key === 'categories' && answers.categories.includes('OTHER') && (
              <TextField id="sv-other" label="Čo iné?" value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder="napr. karimatka, zváračka" />
            )}
            {errors[q.key] && <p className="field-error" role="alert">{errors[q.key]}</p>}
          </fieldset>
        ))}

        <fieldset id="q-email" className="card scroll-mt-24 space-y-3 p-5">
          <legend className="sr-only">Chceš byť medzi prvými?</legend>
          <p className="font-bold text-ink" aria-hidden><span className="text-neon-blue">7.</span> Chceš byť medzi prvými, keď ShareOn spustím v tvojom okolí?</p>
          <TextField id="sv-email" type="email" autoComplete="email" label="E-mail (nepovinné)" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} error={errors.email} />
          {email.trim() && (
            <Checkbox id="sv-consent" checked={consent} onChange={setConsent} error={errors.consent}>
              Súhlasím, aby ma ShareOn kontaktoval e-mailom ohľadom spustenia služby.
            </Checkbox>
          )}
        </fieldset>

        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Odosielam…' : 'Odoslať odpovede'}</button>
        <PrivacyNote />
      </form>
    </div>
  );
}
