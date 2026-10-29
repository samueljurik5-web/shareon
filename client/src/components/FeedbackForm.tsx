import { CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, post } from '../api/client';
import type { FeedbackType } from '../api/types';
import { FEEDBACK_TYPE_LABELS, MVP_NOTICE } from '../lib/format';
import { TextArea, TextField } from './Field';
import { PrivacyNote } from './LaunchForms';

const TYPES: FeedbackType[] = ['LIKE', 'BUG', 'FEATURE', 'TESTER'];

/** Home page feedback form – stored in the database and shown to admins. */
export function FeedbackForm() {
  const [type, setType] = useState<FeedbackType>('LIKE');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) return setErrors({ message: 'Správa musí mať aspoň 5 znakov.' });
    setBusy(true);
    setErrors({});
    try {
      await post('/api/feedback', { type, contact: contact.trim() || null, message: message.trim() });
      setSent(true);
      setMessage('');
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors(), form: err.message } : { form: 'Spätnú väzbu sa nepodarilo odoslať. Skús to znova.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="spatna-vazba" className="card scroll-mt-24 space-y-4 p-6 sm:p-8" aria-labelledby="feedback-heading">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-elevated text-neon-pink">
          <MessageSquareHeart className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 id="feedback-heading" className="text-xl font-extrabold sm:text-2xl">Povedz nám, čo si myslíš</h2>
          <p className="mt-1 text-ink-2">{MVP_NOTICE}</p>
        </div>
      </div>
      {sent ? (
        <div className="notice flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <CheckCircle2 className="h-5 w-5 text-neon-green" aria-hidden />Ďakujeme! Tvoja spätná väzba nám pomôže ShareOn zlepšiť.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSent(false)}>Poslať ďalšiu</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset>
            <legend className="label">Typ spätnej väzby</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} className={`chip ${type === t ? 'chip-active' : ''}`} onClick={() => setType(t)}>
                  {FEEDBACK_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <TextField id="fb-contact" label="Meno alebo e-mail (nepovinné)" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} error={errors.contact} autoComplete="email" />
          <TextArea id="fb-message" label="Správa" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} error={errors.message} placeholder="Čo sa ti páči, čo nefunguje alebo čo ti chýba?" />
          {errors.form && !errors.message && <p className="field-error" role="alert">{errors.form}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Odosielam…' : 'Odoslať spätnú väzbu'}</button>
          <PrivacyNote />
        </form>
      )}
    </section>
  );
}
