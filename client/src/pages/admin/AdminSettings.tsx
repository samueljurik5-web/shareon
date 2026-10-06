import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, get, patch } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useUi } from '../../context/UiContext';
import { CATEGORY_LABELS } from '../../lib/format';
import type { Category, ProtectionMode } from '../../api/types';
import { AdminWarning } from './AdminDashboard';
import { ProtectionNotice } from '../../components/ProtectionNotice';

interface Settings {
  protectionMode: ProtectionMode; protectionActive: boolean; minProtectionFeeCents: number; protectionPercentage: number;
  maxProtectedValueCents: number; depositPercentage: number; maxDepositCents: number; allowedCategories: Category[];
  platformFeeEnabled: boolean; platformFeePercentage: number;
}

export function AdminSettings() {
  const { toast } = useUi();
  const [s, setS] = useState<Settings | null>(null);
  const [insuranceConfigured, setInsuranceConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ settings: Settings; insuranceProviderConfigured: boolean }>('/api/admin/settings')
      .then((r) => { setS(r.settings); setInsuranceConfigured(r.insuranceProviderConfigured); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chyba'));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!s) return <Spinner />;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await patch<{ settings: Settings }>('/api/admin/settings', s);
      setS(res.settings);
      toast('Nastavenia uložené (zapísané do audit logu).');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  const num = (v: string) => (v === '' ? 0 : Number(v.replace(',', '.')));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Nastavenia ochrany a poplatkov</h1>
      <AdminNav />
      <AdminWarning />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Režim ochrany</h2>
          <fieldset className="space-y-2">
            <legend className="label">protectionMode</legend>
            {(['NONE', 'PROTECTION_FEE', 'INSURANCE'] as ProtectionMode[]).map((m) => (
              <label key={m} className="flex items-start gap-3 text-sm">
                <input type="radio" name="mode" className="mt-1 accent-[#9B5CFF]" checked={s.protectionMode === m} onChange={() => set('protectionMode', m)} />
                <span>
                  <strong>{m}</strong> – {m === 'NONE' ? 'bez ochrany' : m === 'PROTECTION_FEE' ? 'interný poplatok za ochranu (MVP, mock provider)' : 'skutočné poistenie cez partnera'}
                  {m === 'INSURANCE' && !insuranceConfigured && <span className="block text-xs text-danger">Nie je nakonfigurovaný poisťovací partner – uloženie bude odmietnuté.</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#42F5A7]" checked={s.protectionActive} onChange={(e) => set('protectionActive', e.target.checked)} />
            Ochrana je aktívna
          </label>
          <ProtectionNotice compact />
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Parametre</h2>
          <NumField id="minFee" label="Minimálny poplatok (€)" value={s.minProtectionFeeCents / 100} onChange={(v) => set('minProtectionFeeCents', Math.round(num(v) * 100))} />
          <NumField id="pct" label="Percento ochrany (%)" value={+(s.protectionPercentage * 100).toFixed(2)} onChange={(v) => set('protectionPercentage', num(v) / 100)} />
          <NumField id="maxProt" label="Max. chránená hodnota (€)" value={s.maxProtectedValueCents / 100} onChange={(v) => set('maxProtectedValueCents', Math.round(num(v) * 100))} />
          <NumField id="maxDep" label="Max. záloha (€)" value={s.maxDepositCents / 100} onChange={(v) => set('maxDepositCents', Math.round(num(v) * 100))} />
          <NumField id="depPct" label="Záloha z hodnoty (%)" value={+(s.depositPercentage * 100).toFixed(2)} onChange={(v) => set('depositPercentage', num(v) / 100)} />
          <NumField id="platPct" label="Poplatok platformy (%)" value={+(s.platformFeePercentage * 100).toFixed(2)} onChange={(v) => set('platformFeePercentage', num(v) / 100)} />
          <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" className="h-5 w-5 accent-[#42F5A7]" checked={s.platformFeeEnabled} onChange={(e) => set('platformFeeEnabled', e.target.checked)} />
            Poplatok platformy zapnutý
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="label">Kategórie s ochranou</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => {
                const on = s.allowedCategories.includes(c);
                return (
                  <button key={c} type="button" aria-pressed={on} className={`chip ${on ? 'chip-active' : ''}`} onClick={() => set('allowedCategories', on ? s.allowedCategories.filter((x) => x !== c) : [...s.allowedCategories, c])}>
                    {CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
        <div className="lg:col-span-2">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Ukladám…' : 'Uložiť nastavenia'}</button>
        </div>
      </form>
    </div>
  );
}

function NumField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" type="number" step="0.01" min={0} defaultValue={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
