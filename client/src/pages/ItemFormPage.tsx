import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../api/client';
import type { Category, Condition, ItemDetail, PriceBreakdown as Price } from '../api/types';
import { Checkbox, SelectField, TextArea, TextField } from '../components/Field';
import { PhotoUploader } from '../components/PhotoUploader';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { ErrorState, Spinner } from '../components/States';
import { addDaysIso, CATEGORY_LABELS, CONDITION_LABELS, daysLabel, hoursLabel, todayIso } from '../lib/format';
import { useUi } from '../context/UiContext';
import { useAuth } from '../context/AuthContext';

interface FormState {
  title: string;
  category: Category;
  description: string;
  /** owner choice: daily only / hourly only / both */
  rentalAvailability: 'DAILY' | 'HOURLY' | 'BOTH';
  dailyPrice: string;
  hourlyPrice: string;
  minRentalHours: string;
  maxRentalHours: string;
  minRentalDays: string;
  maxRentalDays: string;
  availableFromTime: string;
  availableToTime: string;
  bufferHours: string;
  city: string;
  condition: Condition;
  availableFrom: string;
  availableTo: string;
  replacementValue: string;
  serialNote: string;
  protectionEligible: boolean;
  images: string[];
}

const DECLARATIONS = [
  ['rightToOffer', 'Mám právo tento predmet ponúkať na požičanie.'],
  ['accurateDescription', 'Popis predmetu je pravdivý a presný.'],
  ['damageDisclosed', 'Uviedol/a som všetky existujúce poškodenia.'],
  ['photosCurrent', 'Fotografie zobrazujú aktuálny stav predmetu.'],
] as const;

export function ItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useUi();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    title: '', category: 'GARDEN', description: '', city: user?.city ?? 'Košice', condition: 'GOOD',
    rentalAvailability: 'DAILY', dailyPrice: '', hourlyPrice: '', minRentalHours: '1', maxRentalHours: '8', minRentalDays: '1', maxRentalDays: '14',
    availableFromTime: '08:00', availableToTime: '20:00', bufferHours: '0',
    availableFrom: todayIso(), availableTo: addDaysIso(todayIso(), 90), replacementValue: '', serialNote: '', protectionEligible: true, images: [],
  });
  const [decl, setDecl] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<Price | null>(null);
  const [estimateHourly, setEstimateHourly] = useState<Price | null>(null);

  useEffect(() => {
    if (!id) return;
    get<{ item: ItemDetail }>(`/api/items/${id}`)
      .then(({ item }) => {
        if (!item.isOwner) {
          setLoadError('Tento predmet môže upravovať len jeho vlastník.');
          return;
        }
        setForm({
          title: item.title, category: item.category, description: item.description, city: item.city,
          rentalAvailability: item.dailyRentalEnabled && item.hourlyRentalEnabled ? 'BOTH' : item.hourlyRentalEnabled ? 'HOURLY' : 'DAILY',
          dailyPrice: item.dailyPriceCents ? String(item.dailyPriceCents / 100) : '',
          hourlyPrice: item.hourlyPriceCents ? String(item.hourlyPriceCents / 100) : '',
          minRentalHours: String(item.minRentalHours), maxRentalHours: String(item.maxRentalHours),
          minRentalDays: String(item.minRentalDays), maxRentalDays: String(item.maxRentalDays),
          availableFromTime: item.availableFromTime, availableToTime: item.availableToTime, bufferHours: String(item.bufferHours),
          condition: item.condition, availableFrom: item.availableFrom, availableTo: item.availableTo, replacementValue: String(item.replacementValueCents / 100),
          serialNote: item.serialNote ?? '', protectionEligible: item.protectionEligible, images: item.images.map((i) => i.url),
        });
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Chyba'))
      .finally(() => setLoading(false));
  }, [id]);

  const daily = form.rentalAvailability !== 'HOURLY';
  const hourly = form.rentalAvailability !== 'DAILY';
  const num = (v: string) => Number(v.replace(',', '.'));

  // Live server-side estimates (3 days / a few hours) – shown to the owner before publishing.
  useEffect(() => {
    const value = num(form.replacementValue);
    const base = { category: form.category, replacementValue: value, protectionEligible: form.protectionEligible };
    const t = setTimeout(() => {
      if (daily && num(form.dailyPrice) && value) {
        post<{ price: Price }>('/api/protection/quote', { ...base, rentalMode: 'DAILY', pricePerDay: num(form.dailyPrice), rentalDays: 3 })
          .then((r) => setEstimate(r.price))
          .catch(() => setEstimate(null));
      } else setEstimate(null);
      if (hourly && num(form.hourlyPrice) && value) {
        const h = Math.min(Math.max(num(form.minRentalHours) || 1, 4), num(form.maxRentalHours) || 4);
        post<{ price: Price }>('/api/protection/quote', { ...base, rentalMode: 'HOURLY', pricePerHour: num(form.hourlyPrice), rentalHours: h })
          .then((r) => setEstimateHourly(r.price))
          .catch(() => setEstimateHourly(null));
      } else setEstimateHourly(null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, form.dailyPrice, form.hourlyPrice, form.replacementValue, form.protectionEligible, form.rentalAvailability, form.minRentalHours, form.maxRentalHours]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.title.trim().length < 3) errs.title = 'Názov musí mať aspoň 3 znaky.';
    if (form.description.trim().length < 20) errs.description = 'Popis musí mať aspoň 20 znakov.';
    if (daily && !(num(form.dailyPrice) >= 0.5)) errs.dailyPrice = 'Pri prenájme na dni je cena za deň povinná (aspoň 0,50 €).';
    if (hourly && !(num(form.hourlyPrice) >= 0.1)) errs.hourlyPrice = 'Pri prenájme na hodiny je cena za hodinu povinná (aspoň 0,10 €).';
    if (num(form.maxRentalHours) < num(form.minRentalHours)) errs.maxRentalHours = 'Maximálny počet hodín musí byť aspoň taký ako minimálny.';
    if (num(form.maxRentalDays) < num(form.minRentalDays)) errs.maxRentalDays = 'Maximálny počet dní musí byť aspoň taký ako minimálny.';
    if (hourly && form.availableToTime <= form.availableFromTime) errs.availableToTime = 'Čas „dostupné do“ musí byť neskôr ako čas „dostupné od“.';
    if (!(Number(form.replacementValue.replace(',', '.')) >= 1)) errs.replacementValue = 'Zadaj odhadovanú hodnotu predmetu.';
    if (!form.images.length) errs.images = 'Pridaj aspoň 1 fotografiu.';
    if (form.availableTo < form.availableFrom) errs.availableTo = 'Dátum „dostupné do“ musí byť po dátume „dostupné od“.';
    if (!isEdit && DECLARATIONS.some(([k]) => !decl[k])) errs.declarations = 'Potvrď všetky vyhlásenia pred zverejnením.';
    setErrors(errs);
    if (Object.keys(errs).length) return toast('Skontroluj zadané údaje.', 'error');

    const payload = {
      title: form.title,
      category: form.category,
      description: form.description,
      city: form.city,
      condition: form.condition,
      availableFrom: form.availableFrom,
      availableTo: form.availableTo,
      availableFromTime: form.availableFromTime,
      availableToTime: form.availableToTime,
      protectionEligible: form.protectionEligible,
      images: form.images,
      dailyRentalEnabled: daily,
      hourlyRentalEnabled: hourly,
      dailyPrice: form.dailyPrice ? num(form.dailyPrice) : null,
      hourlyPrice: form.hourlyPrice ? num(form.hourlyPrice) : null,
      minRentalHours: num(form.minRentalHours),
      maxRentalHours: num(form.maxRentalHours),
      minRentalDays: num(form.minRentalDays),
      maxRentalDays: num(form.maxRentalDays),
      bufferHours: num(form.bufferHours),
      replacementValue: num(form.replacementValue),
      serialNote: form.serialNote || null,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await patch(`/api/items/${id}`, payload);
        toast('Zmeny boli uložené.');
        navigate(`/items/${id}`);
      } else {
        const res = await post<{ item: { id: string } }>('/api/items', {
          ...payload,
          declarations: Object.fromEntries(DECLARATIONS.map(([k]) => [k, true])),
        });
        toast('Predmet bol zverejnený.');
        navigate(`/items/${res.item.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        toast(err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-5xl grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{isEdit ? 'Upraviť predmet' : 'Pridať predmet'}</h1>
        <div className="card space-y-4 p-5">
          <TextField id="title" label="Názov" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} maxLength={100} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="category" label="Kategória" value={form.category} onChange={(e) => set('category', e.target.value as Category)} error={errors.category}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
            <SelectField id="condition" label="Stav" value={form.condition} onChange={(e) => set('condition', e.target.value as Condition)} error={errors.condition}>
              {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
          </div>
          <TextArea id="description" label="Popis" value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} maxLength={3000} hint="Uveď príslušenstvo, rozmery a prípadné poškodenia." />
          <TextField id="replacementValue" label="Odhadovaná hodnota predmetu (€)" inputMode="decimal" value={form.replacementValue} onChange={(e) => set('replacementValue', e.target.value)} error={errors.replacementValue} hint="Slúži na výpočet kaucie a ochrany." />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="city" label="Mesto" value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
            <TextField id="availableFrom" type="date" label="Dostupné od" value={form.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} error={errors.availableFrom} />
            <TextField id="availableTo" type="date" label="Dostupné do" value={form.availableTo} onChange={(e) => set('availableTo', e.target.value)} error={errors.availableTo} />
          </div>
          <TextField id="serialNote" label="Sériové číslo alebo identifikačná poznámka (nepovinné)" value={form.serialNote} onChange={(e) => set('serialNote', e.target.value)} hint="Zobrazí sa len tebe a administrátorovi." maxLength={200} />
          <Checkbox id="protectionEligible" checked={form.protectionEligible} onChange={(v) => set('protectionEligible', v)}>
            Ponúknuť Ochranu prenájmu (ak je pre kategóriu dostupná)
          </Checkbox>
        </div>
        <fieldset className="card space-y-4 p-5">
          <legend className="sr-only">Spôsob prenájmu</legend>
          <h2 className="font-bold">Spôsob prenájmu</h2>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Spôsob prenájmu">
            {([['DAILY', 'Len na dni'], ['HOURLY', 'Len na hodiny'], ['BOTH', 'Na dni aj hodiny']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={form.rentalAvailability === k} onClick={() => set('rentalAvailability', k)}
                className={`chip justify-center ${form.rentalAvailability === k ? 'chip-active' : ''}`}>{label}</button>
            ))}
          </div>
          {errors.rentalModes && <p className="field-error">{errors.rentalModes}</p>}
          {daily && (
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="dailyPrice" label="Cena za deň (€)" inputMode="decimal" value={form.dailyPrice} onChange={(e) => set('dailyPrice', e.target.value)} error={errors.dailyPrice} />
              <TextField id="minRentalDays" label="Min. počet dní" type="number" min={1} max={90} value={form.minRentalDays} onChange={(e) => set('minRentalDays', e.target.value)} error={errors.minRentalDays} />
              <TextField id="maxRentalDays" label="Max. počet dní" type="number" min={1} max={90} value={form.maxRentalDays} onChange={(e) => set('maxRentalDays', e.target.value)} error={errors.maxRentalDays} />
            </div>
          )}
          {hourly && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField id="hourlyPrice" label="Cena za hodinu (€)" inputMode="decimal" value={form.hourlyPrice} onChange={(e) => set('hourlyPrice', e.target.value)} error={errors.hourlyPrice} />
                <TextField id="minRentalHours" label="Min. počet hodín" type="number" min={1} max={24} value={form.minRentalHours} onChange={(e) => set('minRentalHours', e.target.value)} error={errors.minRentalHours} />
                <TextField id="maxRentalHours" label="Max. počet hodín" type="number" min={1} max={24} value={form.maxRentalHours} onChange={(e) => set('maxRentalHours', e.target.value)} error={errors.maxRentalHours} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="availableFromTime" label="Dostupné denne od" type="time" step={900} value={form.availableFromTime} onChange={(e) => set('availableFromTime', e.target.value)} error={errors.availableFromTime} />
                <TextField id="availableToTime" label="Dostupné denne do" type="time" step={900} value={form.availableToTime} onChange={(e) => set('availableToTime', e.target.value)} error={errors.availableToTime} />
              </div>
              <p className="text-xs text-ink-3">Prenájom na hodiny je vždy v rámci jedného dňa (nemôže prechádzať cez polnoc).</p>
            </>
          )}
          <TextField id="bufferHours" label="Rezerva medzi prenájmami (hodiny)" type="number" min={0} max={72} value={form.bufferHours} onChange={(e) => set('bufferHours', e.target.value)} error={errors.bufferHours} hint="Čas na kontrolu, čistenie alebo nabitie predmetu medzi dvoma prenájmami." />
        </fieldset>
        <div className="card p-5">
          <PhotoUploader value={form.images} onChange={(v) => set('images', v)} label="Fotografie (1–5)" />
          {errors.images && <p className="field-error">{errors.images}</p>}
        </div>
        {!isEdit && (
          <fieldset className="card space-y-3 p-5">
            <legend className="sr-only">Vyhlásenia majiteľa</legend>
            <h2 className="font-bold">Pred zverejnením potvrď</h2>
            {DECLARATIONS.map(([k, label]) => (
              <Checkbox key={k} id={`decl-${k}`} checked={Boolean(decl[k])} onChange={(v) => setDecl((d) => ({ ...d, [k]: v }))}>{label}</Checkbox>
            ))}
            {errors.declarations && <p className="field-error">{errors.declarations}</p>}
          </fieldset>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-4 p-5">
          <h2 className="font-bold">Odhad pre nájomcu</h2>
          {estimateHourly && (
            <>
              <h3 className="text-sm font-semibold text-ink-2">Na hodiny ({hoursLabel(estimateHourly.units)})</h3>
              <PriceBreakdown {...estimateHourly} isDemo={estimateHourly.protection?.isDemo} />
            </>
          )}
          {estimate && (
            <>
              <h3 className="text-sm font-semibold text-ink-2">Na dni ({daysLabel(estimate.units)})</h3>
              <PriceBreakdown {...estimate} isDemo={estimate.protection?.isDemo} />
            </>
          )}
          {!estimate && !estimateHourly && <p className="text-sm text-ink-3">Zadaj cenu a hodnotu predmetu.</p>}
          {(estimate?.protectionAvailable || estimateHourly?.protectionAvailable) && <ProtectionNotice compact />}
          <p className="text-xs text-ink-3">
            Zverejnením inzerátu potvrdzuješ, že dodržiavaš pravidlá ShareOn. ShareOn je sprostredkovateľská platforma a nie je stranou zmluvy o požičaní.
            Ochrana prenájmu nie je poistenie a nekryje automaticky žiadne škody. Platby a kaucie sú v MVP simulované.
          </p>
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Zverejniť predmet'}
          </button>
        </div>
      </aside>
    </form>
  );
}
