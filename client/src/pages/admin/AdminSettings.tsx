import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, get, patch } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useUi } from '../../context/UiContext';
import { AdminWarning } from './AdminDashboard';
import { ProtectionNotice } from '../../components/ProtectionNotice';

interface Settings {
  platformFeeEnabled: boolean;
  platformFeePercentage: number;
}

export function AdminSettings() {
  const { toast } = useUi();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ settings: Settings }>('/api/admin/settings')
      .then((r) => setS(r.settings))
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
      <h1 className="mb-4 text-2xl font-extrabold">Nastavenia poplatkov</h1>
      <AdminNav />
      <AdminWarning />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Ochrana prenájmu</h2>
          <p className="text-sm text-ink-2">
            Je v cene každého prenájmu (na hodiny aj na dni): <strong className="text-ink">10 % z ceny prenájmu</strong>, minimálne <strong className="text-ink">0,50 €</strong>,
            maximálne <strong className="text-ink">5,00 €</strong>. Výpočet robí server. ShareOn nevyžaduje žiadnu kauciu.
          </p>
          <ProtectionNotice />
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="font-bold">Poplatok platformy</h2>
          <NumField id="platPct" label="Poplatok platformy (%)" value={+(s.platformFeePercentage * 100).toFixed(2)} onChange={(v) => set('platformFeePercentage', num(v) / 100)} />
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#42F5A7]" checked={s.platformFeeEnabled} onChange={(e) => set('platformFeeEnabled', e.target.checked)} />
            Poplatok platformy zapnutý
          </label>
          <p className="text-xs text-ink-3">V testovacej verzii odporúčame poplatok vypnutý.</p>
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
