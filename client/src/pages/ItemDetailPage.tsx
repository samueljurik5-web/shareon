import { CalendarDays, Flag, Heart, MapPin, Pencil, ShieldCheck, Tag } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, del, get, patch, post } from '../api/client';
import type { ItemDetail, PriceBreakdown as Price, Review } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { addDaysIso, CATEGORY_LABELS, CONDITION_LABELS, formatDate, formatEur, HANDOVER_LABELS, imageUrl, todayIso } from '../lib/format';
import { ErrorState, Spinner } from '../components/States';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { RatingDistribution, RatingInline } from '../components/Rating';
import { ReviewList } from '../components/ReviewList';
import { Avatar } from '../components/Avatar';
import { Checkbox, SelectField, TextArea } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';

export function ItemDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useAsync(() => get<{ item: ItemDetail }>(`/api/items/${id}`), [id]);
  const reviews = useAsync(() => get<{ reviews: Review[] }>(`/api/items/${id}/reviews`), [id]);
  const [img, setImg] = useState(0);
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error?.message ?? 'Predmet sa nenašiel.'} onRetry={reload} />;
  const item = data.item;

  const toggleFav = async () => {
    if (!user) return navigate('/login');
    const next = !item.isFavorite;
    setData({ item: { ...item, isFavorite: next } });
    try {
      if (next) await post(`/api/items/${item.id}/favorite`);
      else await del(`/api/items/${item.id}/favorite`);
    } catch {
      setData({ item: { ...item, isFavorite: !next } });
    }
  };

  const toggleActive = async () => {
    const ok = await confirm({ title: item.isActive ? 'Skryť inzerát?' : 'Zverejniť inzerát?', message: item.isActive ? 'Predmet sa prestane zobrazovať vo vyhľadávaní.' : undefined });
    if (!ok) return;
    try {
      await patch(`/api/items/${item.id}`, { isActive: !item.isActive });
      toast(item.isActive ? 'Inzerát je skrytý.' : 'Inzerát je zverejnený.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Nepodarilo sa uložiť.', 'error');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <div className="card overflow-hidden p-0">
          <img src={imageUrl(item.images[img]?.url)} alt={`${item.title} – fotografia ${img + 1}`} className="aspect-[4/3] w-full object-cover" />
          {item.images.length > 1 && (
            <div className="flex gap-2 p-3">
              {item.images.map((im, i) => (
                <button key={im.id} onClick={() => setImg(i)} className={`h-16 w-16 overflow-hidden rounded-xl border-2 ${i === img ? 'border-neon-blue' : 'border-transparent'}`} aria-label={`Zobraziť fotografiu ${i + 1}`}>
                  <img src={imageUrl(im.url)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <span className="badge"><Tag className="h-3 w-3" aria-hidden />{CATEGORY_LABELS[item.category]}</span>
            <span className="badge">Stav: {CONDITION_LABELS[item.condition]}</span>
            {item.protectionAvailable && <span className="badge badge-protect"><ShieldCheck className="h-3 w-3" aria-hidden />Ochrana prenájmu</span>}
            {!item.isActive && <span className="badge badge-danger">Neaktívny</span>}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{item.title}</h1>
            <button onClick={toggleFav} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated" aria-pressed={item.isFavorite} aria-label={item.isFavorite ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených'}>
              <Heart className={`h-5 w-5 ${item.isFavorite ? 'fill-neon-pink text-neon-pink' : ''}`} aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
            <span className="text-gradient text-2xl font-extrabold">{formatEur(item.pricePerDayCents)}<span className="text-sm text-ink-3"> / deň</span></span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{item.city}</span>
            <RatingInline average={item.rating.average} count={item.rating.count} />
          </div>
          {!item.isOwner && (
            <a href="#request-form" className="btn btn-primary w-full lg:hidden">Požičať si</a>
          )}
          <p className="whitespace-pre-line text-ink-2">{item.description}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="card-elevated p-3"><CalendarDays className="mb-1 h-4 w-4 text-neon-blue" aria-hidden />Dostupné {formatDate(item.availableFrom)} – {formatDate(item.availableTo)}</div>
            <div className="card-elevated p-3">Odhadovaná hodnota: <strong>{formatEur(item.replacementValueCents)}</strong></div>
          </div>
          {item.blockedRanges.length > 0 && (
            <div className="text-sm">
              <div className="label">Obsadené termíny</div>
              <div className="flex flex-wrap gap-2">
                {item.blockedRanges.map((r) => <span key={r.start} className="badge badge-warn">{formatDate(r.start)} – {formatDate(r.end)}</span>)}
              </div>
            </div>
          )}
          {item.isOwner && item.serialNote && <p className="text-xs text-ink-3">Identifikačná poznámka (vidíš len ty): {item.serialNote}</p>}
        </div>

        <Link to={`/users/${item.owner.id}`} className="card flex items-center gap-4 p-5 hover:border-neon-purple/40">
          <Avatar name={item.owner.name} url={item.owner.avatarUrl} size={52} />
          <div className="min-w-0">
            <div className="text-xs text-ink-3">Majiteľ</div>
            <div className="font-bold">{item.owner.name}</div>
            <RatingInline average={item.owner.rating.average} count={item.owner.rating.count} />
          </div>
        </Link>

        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Hodnotenia predmetu</h2>
          <RatingDistribution summary={item.rating} />
          {reviews.data && <ReviewList reviews={reviews.data.reviews} emptyText="Predmet zatiaľ nemá hodnotenia." />}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {item.isOwner ? (
          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">Tvoj predmet</h2>
            {item.deactivatedByAdmin && <p className="notice notice-warn">Inzerát deaktivoval administrátor.</p>}
            <Link to={`/items/${item.id}/edit`} className="btn btn-primary w-full"><Pencil className="h-4 w-4" aria-hidden />Upraviť</Link>
            {!item.deactivatedByAdmin && <button className="btn btn-secondary w-full" onClick={toggleActive}>{item.isActive ? 'Skryť inzerát' : 'Zverejniť inzerát'}</button>}
            <Link to="/requests?tab=received" className="btn btn-ghost w-full">Prijaté žiadosti</Link>
          </div>
        ) : (
          <RentalRequestForm item={item} />
        )}
        {!item.isOwner && user && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}><Flag className="h-4 w-4" aria-hidden />Nahlásiť inzerát</button>
        )}
        {reportOpen && <ListingReportModal itemId={item.id} onClose={() => setReportOpen(false)} />}
      </aside>
    </div>
  );
}

function RentalRequestForm({ item }: { item: ItemDetail }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const minStart = item.availableFrom > todayIso() ? item.availableFrom : todayIso();
  const [start, setStart] = useState(addDaysIso(minStart, 1));
  const [end, setEnd] = useState(addDaysIso(minStart, 4));
  const [message, setMessage] = useState('');
  const [handover, setHandover] = useState('PERSONAL_PICKUP');
  const [rules, setRules] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false);
  const [price, setPrice] = useState<Price | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!start || !end) return;
    const t = setTimeout(async () => {
      try {
        const res = await post<{ price: Price }>('/api/protection/quote', { itemId: item.id, startDate: start, endDate: end });
        setPrice(res.price);
        setQuoteError(null);
      } catch (e) {
        setQuoteError(e instanceof ApiError ? e.message : 'Cenu sa nepodarilo vypočítať.');
      }
    }, 250);
    return () => clearTimeout(t);
  }, [start, end, item.id]);

  const needsDisclaimer = (price?.protectionFeeCents ?? 0) > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: `/items/${item.id}` } });
    const errs: Record<string, string> = {};
    if (!rules) errs.acceptRules = 'Musíš súhlasiť s pravidlami ShareOn.';
    if (needsDisclaimer && !disclaimer) errs.disclaimer = 'Potvrď, že rozumieš, že Ochrana prenájmu nie je poistenie.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const res = await post<{ rentalRequest: { id: string } }>('/api/rental-requests', {
        itemId: item.id, startDate: start, endDate: end, message: message || null, handoverMethod: handover, acceptRules: true, acceptProtectionDisclaimer: disclaimer,
      });
      toast('Žiadosť bola odoslaná majiteľovi.');
      navigate(`/requests/${res.rentalRequest.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors());
        toast(e.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="request-form" onSubmit={submit} className="card scroll-mt-20 space-y-4 p-5" noValidate>
      <h2 className="text-lg font-bold">Požiadať o požičanie</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="r-start" className="label">Od</label>
          <input id="r-start" type="date" className="input" min={minStart} max={item.availableTo} value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="r-end" className="label">Do</label>
          <input id="r-end" type="date" className="input" min={start} max={item.availableTo} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      {quoteError ? <p className="field-error" role="alert">{quoteError}</p> : price ? <PriceBreakdown {...price} isDemo={price.protection?.isDemo} /> : <Spinner label="Počítam cenu…" />}
      {needsDisclaimer && <ProtectionNotice compact />}
      <SelectField id="r-handover" label="Spôsob odovzdania" value={handover} onChange={(e) => setHandover(e.target.value)}>
        {Object.entries(HANDOVER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>
      <TextArea id="r-msg" label="Správa pre majiteľa" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="Na čo predmet potrebuješ, kedy ho vyzdvihneš…" error={errors.message} />
      <Checkbox id="r-rules" checked={rules} onChange={setRules} error={errors.acceptRules}>
        Súhlasím s <Link to="/protection" className="text-neon-blue underline">pravidlami ShareOn</Link> a zaväzujem sa predmet vrátiť v rovnakom stave.
      </Checkbox>
      {needsDisclaimer && (
        <Checkbox id="r-disc" checked={disclaimer} onChange={setDisclaimer} error={errors.disclaimer}>
          Rozumiem, že Ochrana prenájmu <strong>nie je poistenie</strong> a kompenzácia nie je automatická.
        </Checkbox>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={submitting || !price}>
        {submitting ? 'Odosielam…' : user ? 'Odoslať žiadosť' : 'Prihlás sa a požiadaj'}
      </button>
      <p className="text-xs text-ink-3">Kontaktné údaje sa zobrazia až po prijatí žiadosti. Platby a záloha sú v MVP simulované.</p>
    </form>
  );
}

function ListingReportModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { toast } = useUi();
  const [type, setType] = useState('ITEM_DIFFERENT_THAN_DESCRIPTION');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/api/items/${itemId}/report`, { type, description });
      toast('Ďakujeme, nahlásenie posúdi administrátor.');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors().description ?? err.message) : 'Chyba');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Nahlásiť inzerát" onSubmit={submit} className="card w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Nahlásiť inzerát</h2>
        <SelectField id="lr-type" label="Dôvod" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ITEM_DIFFERENT_THAN_DESCRIPTION">Predmet nezodpovedá popisu</option>
          <option value="USER_BEHAVIOR">Správanie používateľa</option>
          <option value="OTHER">Iné</option>
        </SelectField>
        <TextArea id="lr-desc" label="Popis" value={description} onChange={(e) => setDescription(e.target.value)} error={error} required minLength={10} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušiť</button>
          <button className="btn btn-primary" disabled={busy || description.trim().length < 10}>Odoslať</button>
        </div>
      </form>
    </div>
  );
}
