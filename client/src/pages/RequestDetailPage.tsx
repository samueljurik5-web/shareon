import { AlertTriangle, CalendarClock, Check, Mail, Phone, ShieldCheck, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../api/client';
import type { HandoverRecord, Party, RentalDetail, RentalStatus } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { ErrorState, Spinner } from '../components/States';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { PhotoUploader } from '../components/PhotoUploader';
import { RatingInput } from '../components/Rating';
import { Avatar } from '../components/Avatar';
import { SelectField, TextArea, TextField } from '../components/Field';
import {
  DAMAGE_DISCLAIMER, DEPOSIT_STATUS_LABELS, formatDate, formatDateTime, formatEur, HANDOVER_LABELS, imageUrl,
  RENTAL_STATUS_BADGE, RENTAL_STATUS_LABELS, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS,
} from '../lib/format';

const STEPS: { key: RentalStatus[]; label: string }[] = [
  { key: ['PENDING'], label: 'Žiadosť' },
  { key: ['ACCEPTED'], label: 'Prijatá' },
  { key: ['ACTIVE', 'RETURN_PENDING'], label: 'Odovzdané' },
  { key: ['RETURNED', 'DISPUTED'], label: 'Vrátené' },
  { key: ['COMPLETED'], label: 'Dokončené' },
];

export function RequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => get<{ rentalRequest: RentalDetail }>(`/api/rental-requests/${id}`), [id]);
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const [busy, setBusy] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error?.message ?? 'Žiadosť sa nenašla.'} onRetry={reload} />;
  const r = data.rentalRequest;
  const can = (a: string) => r.availableActions.includes(a);
  const isOwner = r.viewerRole === 'OWNER';
  const other = isOwner ? r.renter : r.owner;
  const stepIndex = STEPS.findIndex((s) => s.key.includes(r.status));
  const terminal = ['REJECTED', 'CANCELLED'].includes(r.status);

  const act = async (action: string, opts: { title: string; message?: string; danger?: boolean; confirmLabel?: string }, extra: object = {}) => {
    if (!(await confirm(opts))) return;
    setBusy(true);
    try {
      await patch(`/api/rental-requests/${r.id}/status`, { action, ...extra });
      toast('Uložené.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Akcia zlyhala.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const myHandover = r.handoverRecords.find((h) => h.type === 'HANDOVER' && h.partyRole === r.viewerRole);
  const myReturn = r.handoverRecords.find((h) => h.type === 'RETURN' && h.partyRole === r.viewerRole);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Link to={`/items/${r.item.id}`} className="card flex items-center gap-4 p-4 hover:border-neon-purple/40">
          <img src={imageUrl(r.item.images[0]?.url)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          <div className="min-w-0">
            <span className={`badge ${RENTAL_STATUS_BADGE[r.status]}`}>{RENTAL_STATUS_LABELS[r.status]}</span>
            <h1 className="mt-1 truncate text-xl font-extrabold">{r.item.title}</h1>
            <p className="text-sm text-ink-2">{formatDate(r.startDate)} – {formatDate(r.endDate)} · {r.rentalDays} d · {HANDOVER_LABELS[r.handoverMethod]}</p>
          </div>
        </Link>

        {!terminal && (
          <ol className="card grid grid-cols-5 gap-1 p-4 text-center text-[11px] font-semibold sm:text-xs" aria-label="Priebeh prenájmu">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex flex-col items-center gap-1" aria-current={i === stepIndex ? 'step' : undefined}>
                <span className={`grid h-8 w-8 place-items-center rounded-full ${i < stepIndex ? 'bg-grad-green text-night' : i === stepIndex ? 'bg-grad-primary text-night' : 'bg-elevated text-ink-3'}`}>
                  {i < stepIndex ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span className={i <= stepIndex ? 'text-ink' : 'text-ink-3'}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        {r.proposedStartDate && (
          <div className="notice notice-warn">
            <div className="flex items-center gap-2 font-semibold text-ink"><CalendarClock className="h-4 w-4" aria-hidden />Majiteľ navrhol iný termín: {formatDate(r.proposedStartDate)} – {formatDate(r.proposedEndDate!)}</div>
            {r.ownerNote && <p className="mt-1">„{r.ownerNote}“</p>}
            {can('ACCEPT_PROPOSAL') && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('ACCEPT_PROPOSAL', { title: 'Prijať nový termín?', message: 'Cena sa prepočíta pre nový termín a žiadosť bude prijatá.' })}>Prijať termín</button>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act('DECLINE_PROPOSAL', { title: 'Odmietnuť navrhnutý termín?' })}>Odmietnuť</button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <PartyCard title={isOwner ? 'Nájomca' : 'Majiteľ'} party={other} visible={r.contactVisible} />
          <div className="card p-4 text-sm">
            <div className="label">Správa od nájomcu</div>
            <p className="text-ink-2">{r.message || '—'}</p>
            {r.ownerNote && !r.proposedStartDate && (<><div className="label mt-3">Poznámka majiteľa</div><p className="text-ink-2">{r.ownerNote}</p></>)}
          </div>
        </div>

        {/* Actions */}
        {(can('ACCEPT') || can('REJECT') || can('CANCEL') || can('COMPLETE') || can('PROPOSE_DATES')) && (
          <div className="card flex flex-wrap gap-2 p-4">
            {can('ACCEPT') && <button className="btn btn-primary" disabled={busy} onClick={() => act('ACCEPT', { title: 'Prijať žiadosť?', message: 'Nájomcovi sa zobrazia tvoje kontaktné údaje a zablokuje sa simulovaná záloha.', confirmLabel: 'Prijať' })}>Prijať</button>}
            {can('PROPOSE_DATES') && <button className="btn btn-secondary" onClick={() => setProposeOpen((o) => !o)}>Navrhnúť iný termín</button>}
            {can('REJECT') && <button className="btn btn-danger" disabled={busy} onClick={() => act('REJECT', { title: 'Zamietnuť žiadosť?', danger: true, confirmLabel: 'Zamietnuť' })}>Zamietnuť</button>}
            {can('COMPLETE') && <button className="btn btn-primary" disabled={busy} onClick={() => act('COMPLETE', { title: 'Dokončiť prenájom?', message: 'Potvrdzuješ, že nemáš ďalšie nároky. Záloha bude uvoľnená.' })}>Dokončiť bez nárokov</button>}
            {can('CANCEL') && <button className="btn btn-ghost" disabled={busy} onClick={() => act('CANCEL', { title: 'Zrušiť prenájom?', danger: true, confirmLabel: 'Zrušiť prenájom' })}>Zrušiť</button>}
          </div>
        )}
        {proposeOpen && <ProposeDates rentalId={r.id} onDone={() => { setProposeOpen(false); reload(); }} />}

        {can('HANDOVER') && !myHandover && (
          <Checklist
            title={isOwner ? 'Potvrdiť odovzdanie predmetu' : 'Potvrdiť prevzatie predmetu'}
            description={isOwner ? 'Nahraj fotky aktuálneho stavu predmetu pri odovzdaní.' : 'Skontroluj predmet a potvrď, že si ho prevzal/a.'}
            endpoint={`/api/rental-requests/${r.id}/handover`}
            onDone={reload}
          />
        )}
        {can('RETURN') && !myReturn && (
          <Checklist title="Potvrdiť vrátenie predmetu" description="Nahraj fotky stavu pri vrátení." endpoint={`/api/rental-requests/${r.id}/return`} askItemOk={isOwner} onDone={reload} />
        )}

        {r.handoverRecords.length > 0 && (
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Záznamy odovzdania a vrátenia</h2>
            <ul className="space-y-3">
              {r.handoverRecords.map((h) => <RecordRow key={h.id} h={h} />)}
            </ul>
          </section>
        )}

        {r.status === 'COMPLETED' && r.viewerRole && <Reviews r={r} userId={user!.id} onDone={reload} />}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-4 p-5">
          <h2 className="font-bold">Cena</h2>
          <PriceBreakdown rentalDays={r.rentalDays} {...r.price} isDemo={r.protection?.isDemo ?? true} simulated={r.deposit?.isSimulated ?? true} />
        </div>
        {r.protection && (
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-neon-green" aria-hidden />Ochrana prenájmu</h2>
            <p className="text-sm text-ink-2">Stav: <strong>{r.protection.status}</strong> · Chránená hodnota do {formatEur(r.protection.protectedValueCents)}</p>
            <ProtectionNotice demo={r.protection.isDemo} compact />
          </div>
        )}
        {!r.protection && r.price.protectionFeeCents > 0 && <ProtectionNotice compact />}
        {r.deposit && (
          <div className="card space-y-2 p-5">
            <h2 className="flex items-center gap-2 font-bold"><Wallet className="h-5 w-5 text-neon-blue" aria-hidden />Záloha</h2>
            {r.deposit.label && <span className="badge badge-demo">{r.deposit.label}</span>}
            <p className="text-sm text-ink-2">{formatEur(r.deposit.amountCents)} · {DEPOSIT_STATUS_LABELS[r.deposit.status]}{r.deposit.withheldCents > 0 && ` · zadržané ${formatEur(r.deposit.withheldCents)}`}</p>
            <p className="text-xs text-ink-3">V MVP sa žiadne peniaze neblokujú ani neprevádzajú.</p>
          </div>
        )}
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">Problémy a spory</h2>
          {r.reports.length === 0 && <p className="text-sm text-ink-3">Žiadne nahlásené problémy.</p>}
          <ul className="space-y-2">
            {r.reports.map((rep) => (
              <li key={rep.id}>
                <Link to={`/reports/${rep.id}`} className="card-elevated flex items-center justify-between gap-2 p-3 text-sm hover:border-neon-purple/40">
                  <span>{REPORT_TYPE_LABELS[rep.type]}</span>
                  <span className="badge">{REPORT_STATUS_LABELS[rep.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {can('REPORT') && <button className="btn btn-danger btn-sm w-full" onClick={() => setReportOpen(true)}><AlertTriangle className="h-4 w-4" aria-hidden />Nahlásiť problém</button>}
        </div>
      </aside>
      {reportOpen && <ReportModal rentalId={r.id} maxCents={r.item.replacementValueCents} onClose={() => setReportOpen(false)} />}
    </div>
  );
}

function PartyCard({ title, party, visible }: { title: string; party: Party; visible: boolean }) {
  return (
    <div className="card p-4">
      <div className="label">{title}</div>
      <Link to={`/users/${party.id}`} className="flex items-center gap-3 hover:underline">
        <Avatar name={party.name} url={party.avatarUrl} size={40} />
        <span className="font-bold">{party.name}</span>
      </Link>
      {visible ? (
        <div className="mt-3 space-y-1 text-sm">
          {party.phone && <a href={`tel:${party.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-neon-blue"><Phone className="h-4 w-4" aria-hidden />{party.phone}</a>}
          {party.email && <a href={`mailto:${party.email}`} className="flex items-center gap-2 text-neon-blue"><Mail className="h-4 w-4" aria-hidden />{party.email}</a>}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">Kontakt sa zobrazí po prijatí žiadosti.</p>
      )}
    </div>
  );
}

function RecordRow({ h }: { h: HandoverRecord }) {
  const label = h.type === 'HANDOVER' ? (h.partyRole === 'OWNER' ? 'Majiteľ odovzdal' : 'Nájomca prevzal') : h.partyRole === 'OWNER' ? 'Majiteľ potvrdil vrátenie' : 'Nájomca vrátil';
  return (
    <li className="card-elevated p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{label} · {h.user.name}</span>
        <span className="text-xs text-ink-3">{formatDateTime(h.confirmedAt)}</span>
      </div>
      {h.itemOk === false && <span className="badge badge-danger mt-1">Predmet nie je v poriadku</span>}
      {h.itemOk === true && <span className="badge badge-protect mt-1">Predmet v poriadku</span>}
      {h.note && <p className="mt-1 text-ink-2">{h.note}</p>}
      {h.photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {h.photos.map((p, i) => <a key={p.id} href={imageUrl(p.url)} target="_blank" rel="noreferrer"><img src={imageUrl(p.url)} alt={`Fotografia stavu ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" /></a>)}
        </div>
      )}
    </li>
  );
}

function Checklist({ title, description, endpoint, askItemOk, onDone }: { title: string; description: string; endpoint: string; askItemOk?: boolean; onDone: () => void }) {
  const { toast } = useUi();
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [itemOk, setItemOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post(endpoint, { note: note || null, photos, ...(askItemOk ? { itemOk } : {}) });
      toast('Potvrdené.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 border-neon-blue/30 p-5">
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-sm text-ink-2">{description}</p>
      </div>
      {askItemOk && (
        <fieldset>
          <legend className="label">Bol predmet vrátený v poriadku?</legend>
          <div className="flex gap-2">
            <button type="button" className={`chip ${itemOk === true ? 'chip-active' : ''}`} aria-pressed={itemOk === true} onClick={() => setItemOk(true)}>Áno, v poriadku</button>
            <button type="button" className={`chip ${itemOk === false ? 'chip-active' : ''}`} aria-pressed={itemOk === false} onClick={() => setItemOk(false)}>Nie, je problém</button>
          </div>
        </fieldset>
      )}
      <TextArea id={`note-${endpoint}`} label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      <PhotoUploader value={photos} onChange={setPhotos} label="Fotografie stavu" />
      <button className="btn btn-primary" disabled={busy || (askItemOk && itemOk === null)}>{busy ? 'Ukladám…' : 'Potvrdiť'}</button>
    </form>
  );
}

function ProposeDates({ rentalId, onDone }: { rentalId: string; onDone: () => void }) {
  const { toast } = useUi();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await patch(`/api/rental-requests/${rentalId}/status`, { action: 'PROPOSE_DATES', startDate: start, endDate: end, note: note || undefined });
      toast('Návrh termínu bol odoslaný.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <TextField id="p-start" type="date" label="Nový začiatok" value={start} onChange={(e) => setStart(e.target.value)} required />
      <TextField id="p-end" type="date" label="Nový koniec" value={end} onChange={(e) => setEnd(e.target.value)} required />
      <div className="sm:col-span-2"><TextField id="p-note" label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <button className="btn btn-primary sm:col-span-2" disabled={busy || !start || !end}>Odoslať návrh</button>
    </form>
  );
}

function ReportModal({ rentalId, maxCents, onClose }: { rentalId: string; maxCents: number; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useUi();
  const [type, setType] = useState('ITEM_DAMAGED');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post<{ report: { id: string } }>(`/api/rental-requests/${rentalId}/dispute`, { type, description, requestedAmount: Number(amount.replace(',', '.')) || 0, photos });
      toast('Problém bol nahlásený. Posúdi ho administrátor.');
      navigate(`/reports/${res.report.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        toast(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center overflow-y-auto bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Nahlásiť problém" onSubmit={submit} className="card my-auto w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Nahlásiť problém</h2>
        <p className="notice notice-warn">{DAMAGE_DISCLAIMER}</p>
        <SelectField id="rep-type" label="Typ problému" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <TextArea id="rep-desc" label="Popis" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} hint="Čo sa stalo, kedy a ako to vieš doložiť (min. 20 znakov)." />
        <TextField id="rep-amount" label="Požadovaná suma (€, nepovinné)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.requestedAmount} hint={`Najviac ${formatEur(maxCents)} (hodnota predmetu). Nejde o automatický nárok.`} />
        <PhotoUploader value={photos} onChange={setPhotos} label="Dôkazy (fotografie)" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušiť</button>
          <button className="btn btn-danger" disabled={busy || description.trim().length < 20}>Odoslať hlásenie</button>
        </div>
      </form>
    </div>
  );
}

function Reviews({ r, userId, onDone }: { r: RentalDetail; userId: string; onDone: () => void }) {
  const isOwner = r.viewerRole === 'OWNER';
  const myUserReview = r.reviews.find((rv) => rv.authorId === userId);
  const theirReview = r.reviews.find((rv) => rv.authorId !== userId);
  return (
    <section className="space-y-4">
      {myUserReview ? (
        <div className="card p-5 text-sm"><Check className="mr-1 inline h-4 w-4 text-neon-green" aria-hidden />Tvoje hodnotenie bolo uložené ({myUserReview.overall}/5).</div>
      ) : (
        <UserReviewForm r={r} isOwner={isOwner} onDone={onDone} />
      )}
      {!isOwner && (r.itemReview ? <div className="card p-5 text-sm"><Check className="mr-1 inline h-4 w-4 text-neon-green" aria-hidden />Predmet si ohodnotil/a.</div> : <ItemReviewForm rentalId={r.id} onDone={onDone} />)}
      {theirReview && <div className="card p-5 text-sm text-ink-2">Druhá strana ťa ohodnotila: <strong className="text-ink">{theirReview.overall}/5</strong>{theirReview.comment && ` – „${theirReview.comment}“`}</div>}
    </section>
  );
}

function UserReviewForm({ r, isOwner, onDone }: { r: RentalDetail; isOwner: boolean; onDone: () => void }) {
  const { toast } = useUi();
  const fields = isOwner
    ? ([['respectfulUse', 'Šetrné zaobchádzanie'], ['onTimeReturn', 'Včasné vrátenie'], ['communication', 'Komunikácia'], ['overall', 'Celkový dojem z nájomcu']] as const)
    : ([['punctuality', 'Dochvíľnosť'], ['communication', 'Komunikácia'], ['reliability', 'Spoľahlivosť'], ['overall', 'Celkové hodnotenie majiteľa']] as const);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const complete = fields.every(([k]) => vals[k]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/api/reviews/user', { rentalRequestId: r.id, ...vals, comment: comment || null });
      toast('Ďakujeme za hodnotenie!');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-bold">Ohodnoť {isOwner ? 'nájomcu' : 'majiteľa'}: {isOwner ? r.renter.name : r.owner.name}</h2>
      {fields.map(([k, label]) => <RatingInput key={k} name={`u-${k}`} label={label} value={vals[k] ?? 0} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} />)}
      <TextArea id="u-comment" label="Komentár" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <button className="btn btn-primary" disabled={busy || !complete}>Odoslať hodnotenie</button>
    </form>
  );
}

function ItemReviewForm({ rentalId, onDone }: { rentalId: string; onDone: () => void }) {
  const { toast } = useUi();
  const fields = [['descriptionAccuracy', 'Presnosť popisu'], ['itemCondition', 'Stav predmetu'], ['valueForMoney', 'Pomer cena/výkon'], ['handoverExperience', 'Odovzdanie'], ['overall', 'Celkové hodnotenie predmetu']] as const;
  const [vals, setVals] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/api/reviews/item', { rentalRequestId: rentalId, ...vals, comment: comment || null });
      toast('Hodnotenie predmetu uložené.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-bold">Ohodnoť predmet a prenájom</h2>
      {fields.map(([k, label]) => <RatingInput key={k} name={`i-${k}`} label={label} value={vals[k] ?? 0} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} />)}
      <TextArea id="i-comment" label="Komentár" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <button className="btn btn-primary" disabled={busy || !fields.every(([k]) => vals[k])}>Odoslať hodnotenie</button>
    </form>
  );
}
