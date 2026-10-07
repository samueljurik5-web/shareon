import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, get, patch, post } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { useUi } from '../../context/UiContext';
import { ADMIN_WARNING, DEPOSIT_STATUS_LABELS, formatDateTime, formatDuration, formatEur, formatPeriod, RENTAL_MODE_LABELS, RENTAL_STATUS_LABELS } from '../../lib/format';
import type { DepositStatus, RentalPeriodFields, RentalStatus } from '../../api/types';

export function AdminWarning() {
  return <p className="notice notice-warn mb-5" role="note">{ADMIN_WARNING}</p>;
}

type Tab = 'rentals' | 'protection' | 'deposits' | 'reviews' | 'audit';

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
          {Object.entries({ users: 'Používatelia', items: 'Aktívne predmety', rentals: 'Prenájmy', openReports: 'Otvorené hlásenia', heldDeposits: 'Blokované zálohy', activeProtection: 'Aktívne ochrany' }).map(([k, l]) => (
            <div key={k} className="card p-4">
              <div className="text-2xl font-extrabold">{overview.data!.counts[k]}</div>
              <div className="text-xs text-ink-3">{l}</div>
            </div>
          ))}
        </div>
      )}
      <div className="h-scroll mb-4" role="tablist">
        {([['rentals', 'Žiadosti o prenájom'], ['protection', 'Ochrana'], ['deposits', 'Zálohy'], ['reviews', 'Hodnotenia'], ['audit', 'Audit log']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'chip-active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'rentals' && <Rentals />}
      {tab === 'protection' && <Protection />}
      {tab === 'deposits' && <Deposits />}
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

interface RentalRow extends RentalPeriodFields { id: string; status: RentalStatus; createdAt: string; totalCents: number; item: { title: string }; renter: { name: string }; owner: { name: string }; deposit: { status: DepositStatus } | null; protection: { status: string } | null }
function Rentals() {
  const { data, loading, error } = useAsync(() => get<{ rentals: RentalRow[] }>('/api/admin/rentals'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  return (
    <Table head={['Predmet', 'Nájomca → Majiteľ', 'Spôsob', 'Termín', 'Trvanie', 'Stav', 'Suma', 'Kaucia', 'Vytvorené']}>
      {data!.rentals.map((r) => (
        <tr key={r.id}>
          <Td><Link className="font-semibold text-neon-blue" to={`/requests/${r.id}`}>{r.item.title}</Link></Td>
          <Td>{r.renter.name} → {r.owner.name}</Td>
          <Td>{RENTAL_MODE_LABELS[r.rentalMode]}</Td>
          <Td><span className="whitespace-nowrap">{formatPeriod(r)}</span></Td>
          <Td>{formatDuration(r)}</Td>
          <Td>{RENTAL_STATUS_LABELS[r.status]}</Td>
          <Td>{formatEur(r.totalCents)}</Td>
          <Td>{r.deposit ? DEPOSIT_STATUS_LABELS[r.deposit.status] : '—'}</Td>
          <Td>{formatDateTime(r.createdAt)}</Td>
        </tr>
      ))}
    </Table>
  );
}

interface ProtectionRow { id: string; status: string; provider: string; isDemo: boolean; feeCents: number; protectedValueCents: number; createdAt: string; rentalRequest: { id: string; item: { title: string } } }
function Protection() {
  const { data, loading, error, reload } = useAsync(() => get<{ records: ProtectionRow[]; quotes: { id: string; feeCents: number; rentalDays: number; createdAt: string; item: { title: string } | null }[] }>('/api/admin/protection'), []);
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
      <Table head={['Prenájom', 'Poskytovateľ', 'Stav', 'Poplatok', 'Chránená hodnota', '']}>
        {data!.records.map((p) => (
          <tr key={p.id}>
            <Td><Link to={`/requests/${p.rentalRequest.id}`} className="text-neon-blue">{p.rentalRequest.item.title}</Link></Td>
            <Td>{p.provider} {p.isDemo && <span className="badge badge-demo">DEMO</span>}</Td>
            <Td>{p.status}</Td>
            <Td>{formatEur(p.feeCents)}</Td>
            <Td>{formatEur(p.protectedValueCents)}</Td>
            <Td>{['ACTIVE', 'QUOTED'].includes(p.status) && <button className="btn btn-ghost btn-sm" onClick={() => cancel(p.id)}>Zrušiť</button>}</Td>
          </tr>
        ))}
      </Table>
      <h3 className="font-bold">Posledné kalkulácie (quotes)</h3>
      <Table head={['Predmet', 'Dni', 'Poplatok', 'Vytvorené']}>
        {data!.quotes.map((q) => (
          <tr key={q.id}><Td>{q.item?.title ?? '—'}</Td><Td>{q.rentalDays}</Td><Td>{formatEur(q.feeCents)}</Td><Td>{formatDateTime(q.createdAt)}</Td></tr>
        ))}
      </Table>
    </div>
  );
}

interface DepositRow { id: string; status: DepositStatus; amountCents: number; withheldCents: number; isSimulated: boolean; rentalRequest: { id: string; status: RentalStatus; item: { title: string }; renter: { name: string } } }
function Deposits() {
  const { data, loading, error, reload } = useAsync(() => get<{ deposits: DepositRow[] }>('/api/admin/deposits'), []);
  const { toast, confirm } = useUi();
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  const run = async (id: string, action: 'release' | 'withhold') => {
    if (!(await confirm({ title: action === 'release' ? 'Uvoľniť simulovanú zálohu?' : 'Zadržať celú simulovanú zálohu?', danger: action === 'withhold' }))) return;
    try {
      await post(`/api/deposits/${id}/${action}`, {});
      toast('Záloha aktualizovaná (SIMULATED PAYMENT).');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Chyba', 'error');
    }
  };
  return (
    <Table head={['Prenájom', 'Nájomca', 'Suma', 'Stav', 'Akcie']}>
      {data!.deposits.map((d) => (
        <tr key={d.id}>
          <Td><Link to={`/requests/${d.rentalRequest.id}`} className="text-neon-blue">{d.rentalRequest.item.title}</Link></Td>
          <Td>{d.rentalRequest.renter.name}</Td>
          <Td>{formatEur(d.amountCents)} {d.isSimulated && <span className="badge badge-demo">SIMULATED PAYMENT</span>}</Td>
          <Td>{DEPOSIT_STATUS_LABELS[d.status]}{d.withheldCents > 0 && ` (${formatEur(d.withheldCents)})`}</Td>
          <Td>
            {['HELD', 'DISPUTED', 'RELEASE_REQUESTED', 'PENDING'].includes(d.status) && (
              <div className="flex gap-1">
                <button className="btn btn-secondary btn-sm" onClick={() => run(d.id, 'release')}>Uvoľniť</button>
                {['HELD', 'DISPUTED'].includes(d.status) && <button className="btn btn-danger btn-sm" onClick={() => run(d.id, 'withhold')}>Zadržať</button>}
              </div>
            )}
          </Td>
        </tr>
      ))}
    </Table>
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
