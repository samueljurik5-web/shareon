import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../api/client';
import type { Category, Condition, ItemDetail, PriceBreakdown as Price } from '../api/types';
import { Checkbox, SelectField, TextArea, TextField } from '../components/Field';
import { PhotoUploader } from '../components/PhotoUploader';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ProtectionNotice } from '../components/ProtectionNotice';
import { ErrorState, Spinner } from '../components/States';
import { addDaysIso, CATEGORY_LABELS, CONDITION_LABELS, todayIso } from '../lib/format';
import { useUi } from '../context/UiContext';
import { useAuth } from '../context/AuthContext';

interface FormState {
  title: string;
  category: Category;
  description: string;
  pricePerDay: string;
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
    title: '', category: 'GARDEN', description: '', pricePerDay: '', city: user?.city ?? 'Košice', condition: 'GOOD',
    availableFrom: todayIso(), availableTo: addDaysIso(todayIso(), 90), replacementValue: '', serialNote: '', protectionEligible: true, images: [],
  });
  const [decl, setDecl] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<Price | null>(null);

  useEffect(() => {
    if (!id) return;
    get<{ item: ItemDetail }>(`/api/items/${id}`)
      .then(({ item }) => {
        if (!item.isOwner) {
          setLoadError('Tento predmet môže upravovať len jeho vlastník.');
          return;
        }
        setForm({
          title: item.title, category: item.category, description: item.description, pricePerDay: String(item.pricePerDayCents / 100), city: item.city,
          condition: item.condition, availableFrom: item.availableFrom, availableTo: item.availableTo, replacementValue: String(item.replacementValueCents / 100),
          serialNote: item.serialNote ?? '', protectionEligible: item.protectionEligible, images: item.images.map((i) => i.url),
        });
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Chyba'))
      .finally(() => setLoading(false));
  }, [id]);

  // Live server-side estimate (3-day example)
  useEffect(() => {
    const price = Number(form.pricePerDay.replace(',', '.'));
    const value = Number(form.replacementValue.replace(',', '.'));
    if (!price || !value) return setEstimate(null);
    const t = setTimeout(() => {
      post<{ price: Price }>('/api/protection/quote', { category: form.category, pricePerDay: price, replacementValue: value, rentalDays: 3, protectionEligible: form.protectionEligible })
        .then((r) => setEstimate(r.price))
        .catch(() => setEstimate(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.category, form.pricePerDay, form.replacementValue, form.protectionEligible]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.title.trim().length < 3) errs.title = 'Názov musí mať aspoň 3 znaky.';
    if (form.description.trim().length < 20) errs.description = 'Popis musí mať aspoň 20 znakov.';
    if (!(Number(form.pricePerDay.replace(',', '.')) >= 0.5)) errs.pricePerDay = 'Cena za deň musí byť aspoň 0,50 €.';
    if (!(Number(form.replacementValue.replace(',', '.')) >= 1)) errs.replacementValue = 'Zadaj odhadovanú hodnotu predmetu.';
    if (!form.images.length) errs.images = 'Pridaj aspoň 1 fotografiu.';
    if (form.availableTo < form.availableFrom) errs.availableTo = 'Dátum „dostupné do“ musí byť po dátume „dostupné od“.';
    if (!isEdit && DECLARATIONS.some(([k]) => !decl[k])) errs.declarations = 'Potvrď všetky vyhlásenia pred zverejnením.';
    setErrors(errs);
    if (Object.keys(errs).length) return toast('Skontroluj zadané údaje.', 'error');

    const payload = {
      ...form,
      pricePerDay: Number(form.pricePerDay.replace(',', '.')),
      replacementValue: Number(form.replacementValue.replace(',', '.')),
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
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.4fr_1fr]">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="pricePerDay" label="Cena za deň (€)" inputMode="decimal" value={form.pricePerDay} onChange={(e) => set('pricePerDay', e.target.value)} error={errors.pricePerDay} />
            <TextField id="replacementValue" label="Odhadovaná hodnota predmetu (€)" inputMode="decimal" value={form.replacementValue} onChange={(e) => set('replacementValue', e.target.value)} error={errors.replacementValue} hint="Slúži na výpočet zálohy a ochrany." />
          </div>
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
          <h2 className="font-bold">Odhad pre nájomcu (3 dni)</h2>
          {estimate ? <PriceBreakdown {...estimate} isDemo={estimate.protection?.isDemo} /> : <p className="text-sm text-ink-3">Zadaj cenu a hodnotu predmetu.</p>}
          {estimate?.protectionAvailable && <ProtectionNotice compact />}
          <p className="text-xs text-ink-3">
            Zverejnením inzerátu potvrdzuješ, že dodržiavaš pravidlá ShareOn. ShareOn je sprostredkovateľská platforma a nie je stranou zmluvy o požičaní.
            Ochrana prenájmu nie je poistenie a nekryje automaticky žiadne škody. Platby a zálohy sú v MVP simulované.
          </p>
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Zverejniť predmet'}
          </button>
        </div>
      </aside>
    </form>
  );
}
