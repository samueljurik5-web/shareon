import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, get, patch, post } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { useUi } from '../../context/UiContext';
import { ADMIN_WARNING, formatDateTime, formatDuration, formatEur, formatPeriod, RENTAL_MODE_LABELS, RENTAL_STATUS_LABELS } from '../../lib/format';
import type { RentalPeriodFields, RentalStatus } from '../../api/types';

export function AdminWarning() {
  return <p className="notice notice-warn mb-5" role="note">{ADMIN_WARNING}</p>;
}

type Tab = 'rentals' | 'protection' | 'reviews' | 'audit';

export function AdminDashboard() {
  const overview = useAsync(() => get<{ counts: Record<string, number> }>('/api/admin/overview'), []);
  const [tab, setTab] = useState<Tab>('rentals');
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Administrácia</h1>
      <AdminNav />
      <AdminWarning />
      {overview.data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries({ users: 'Používatelia', items: 'Aktívne predmety', rentals: 'Prenájmy', openReports: 'Otvorené hlásenia', feedback: 'Spätná väzba', activeProtection: 'Aktívne ochrany prenájmu' }).map(([k, l]) => (
            <div key={k} className="card p-4">
              <div className="text-2xl font-extrabold">{overview.data!.counts[k]}</div>
              <div className="text-xs text-ink-3">{l}</div>
            </div>
          ))}
        </div>
      )}
      <div className="h-scroll mb-4" role="tablist">
        {([['rentals', 'Žiadosti o prenájom'], ['protection', 'Ochrana prenájmu'], ['reviews', 'Hodnotenia'], ['audit', 'Audit log']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'chip-active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'rentals' && <Rentals />}
      {tab === 'protection' && <Protection />}
      {tab === 'reviews' && <Reviews />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase text-ink-3">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children }: { children: React.ReactNode }) => <td className="px-4 py-3 align-top">{children}</td>;

interface RentalRow extends RentalPeriodFields { id: string; status: RentalStatus; createdAt: string; rentalPriceCents: number; protectionFeeCents: number; platformFeeCents: number; item: { title: string }; renter: { name: string }; owner: { name: string }; protection: { status: string } | null }
function Rentals() {
  const { data, loading, error } = useAsync(() => get<{ rentals: RentalRow[] }>('/api/admin/rentals'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  return (
    <Table head={['Predmet', 'Nájomca → Majiteľ', 'Spôsob', 'Termín', 'Trvanie', 'Stav', 'Cena prenájmu', 'Ochrana prenájmu', 'Vytvorené']}>
      {data!.rentals.map((r) => (
        <tr key={r.id}>
          <Td><Link className="font-semibold text-neon-blue" to={`/requests/${r.id}`}>{r.item.title}</Link></Td>
          <Td>{r.renter.name} → {r.owner.name}</Td>
          <Td>{RENTAL_MODE_LABELS[r.rentalMode]}</Td>
          <Td><span className="whitespace-nowrap">{formatPeriod(r)}</span></Td>
          <Td>{formatDuration(r)}</Td>
          <Td>{RENTAL_STATUS_LABELS[r.status]}</Td>
          <Td>{formatEur(r.rentalPriceCents)}</Td>
          <Td>{formatEur(r.protectionFeeCents)}{r.protection && <span className="block text-xs text-ink-3">{PROTECTION_STATUS[r.protection.status] ?? r.protection.status}</span>}</Td>
          <Td>{formatDateTime(r.createdAt)}</Td>
        </tr>
      ))}
    </Table>
  );
}

const PROTECTION_STATUS: Record<string, string> = {
  QUOTED: 'Pripravená', ACTIVE: 'Aktívna', CLAIM_UNDER_REVIEW: 'Hlásenie sa posudzuje', EXPIRED: 'Ukončená', CANCELLED: 'Zrušená',
};

interface ProtectionRow { id: string; status: string; feeCents: number; createdAt: string; rentalRequest: { id: string; item: { title: string } } }
function Protection() {
  const { data, loading, error, reload } = useAsync(() => get<{ records: ProtectionRow[]; quotes: { id: string; feeCents: number; rentalDays: number | null; durationMinutes: number | null; createdAt: string; item: { title: string } | null }[] }>('/api/admin/protection'), []);
  const { toast, confirm } = useUi();
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  const cancel = async (id: string) => {
    if (!(await confirm({ title: 'Zrušiť záznam ochrany?', danger: true }))) return;
    try {
      await post(`/api/protection/${id}/cancel`);
      toast('Ochrana zrušená.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Chyba', 'error');
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Ochrana prenájmu je v cene každého prenájmu: 10 % z ceny prenájmu, min. 0,50 €, max. 5,00 €.</p>
      <Table head={['Prenájom', 'Stav', 'Poplatok', 'Vytvorené', '']}>
        {data!.records.map((p) => (
          <tr key={p.id}>
            <Td><Link to={`/requests/${p.rentalRequest.id}`} className="text-neon-blue">{p.rentalRequest.item.title}</Link></Td>
            <Td>{PROTECTION_STATUS[p.status] ?? p.status}</Td>
            <Td>{formatEur(p.feeCents)}</Td>
            <Td>{formatDateTime(p.createdAt)}</Td>
            <Td>{['ACTIVE', 'QUOTED'].includes(p.status) && <button className="btn btn-ghost btn-sm" onClick={() => cancel(p.id)}>Zrušiť</button>}</Td>
          </tr>
        ))}
      </Table>
      <h3 className="font-bold">Posledné kalkulácie</h3>
      <Table head={['Predmet', 'Trvanie', 'Poplatok', 'Vytvorené']}>
        {data!.quotes.map((q) => (
          <tr key={q.id}><Td>{q.item?.title ?? '—'}</Td><Td>{q.rentalDays ? `${q.rentalDays} d` : q.durationMinutes ? `${q.durationMinutes / 60} h` : '—'}</Td><Td>{formatEur(q.feeCents)}</Td><Td>{formatDateTime(q.createdAt)}</Td></tr>
        ))}
      </Table>
    </div>
  );
}

interface ReviewRow { id: string; overall: number; comment: string | null; isHidden: boolean; createdAt: string; author: { name: string }; target?: { name: string }; item?: { title: string } }
function Reviews() {
  const { data, loading, error, reload } = useAsync(() => get<{ reviews: ReviewRow[]; itemReviews: ReviewRow[] }>('/api/admin/reviews'), []);
  const { toast } = useUi();
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  const hide = async (kind: 'reviews' | 'item-reviews', id: string, hidden: boolean) => {
    try {
      await patch(`/api/admin/${kind}/${id}/hide`, { hidden });
      toast(hidden ? 'Hodnotenie skryté.' : 'Hodnotenie zobrazené.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Chyba', 'error');
    }
  };
  const rows = [...data!.reviews.map((r) => ({ ...r, kind: 'reviews' as const })), ...data!.itemReviews.map((r) => ({ ...r, kind: 'item-reviews' as const }))];
  return (
    <Table head={['Autor', 'Cieľ', 'Hodnotenie', 'Komentár', '']}>
      {rows.map((r) => (
        <tr key={r.id} className={r.isHidden ? 'opacity-50' : ''}>
          <Td>{r.author.name}</Td>
          <Td>{r.target?.name ?? r.item?.title}</Td>
          <Td>{r.overall}/5</Td>
          <Td>{r.comment}</Td>
          <Td><button className="btn btn-ghost btn-sm" onClick={() => hide(r.kind, r.id, !r.isHidden)}>{r.isHidden ? 'Zobraziť' : 'Skryť'}</button></Td>
        </tr>
      ))}
    </Table>
  );
}

interface AuditRow { id: string; action: string; entityType: string; entityId: string; oldValue: unknown; newValue: unknown; createdAt: string; admin: { name: string } | null }
function Audit() {
  const { data, loading, error } = useAsync(() => get<{ entries: AuditRow[] }>('/api/admin/audit-log'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  return (
    <Table head={['Čas', 'Admin', 'Akcia', 'Záznam', 'Pôvodne', 'Nová hodnota']}>
      {data!.entries.map((e) => (
        <tr key={e.id}>
          <Td>{formatDateTime(e.createdAt)}</Td>
          <Td>{e.admin?.name ?? '—'}</Td>
          <Td><code className="text-xs">{e.action}</code></Td>
          <Td><span className="text-xs">{e.entityType} {e.entityId.slice(0, 8)}…</span></Td>
          <Td><code className="block max-w-xs truncate text-xs text-ink-3" title={JSON.stringify(e.oldValue)}>{JSON.stringify(e.oldValue)}</code></Td>
          <Td><code className="block max-w-xs truncate text-xs text-ink-3" title={JSON.stringify(e.newValue)}>{JSON.stringify(e.newValue)}</code></Td>
        </tr>
      ))}
    </Table>
  );
}
