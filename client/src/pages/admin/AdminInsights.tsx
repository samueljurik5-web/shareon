import { Download } from 'lucide-react';
import { useState } from 'react';
import { get } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/format';
import { Table, Td } from './AdminDashboard';

type Role = 'BORROW' | 'LEND' | 'BOTH';
interface Insights {
  days: number;
  funnel: { name: string; label: string; count: number }[];
  daily: { day: string; name: string; count: number }[];
  searches: { query: string; count: number; maxResults: number }[];
  zeroResultSearches: { query: string; count: number }[];
  waitlist: { byRole: Partial<Record<Role, number>>; entries: { id: string; email: string; role: Role; city: string | null; district: string | null; wish: string | null; createdAt: string }[] };
  demand: { id: string; what: string; email: string | null; district: string | null; createdAt: string }[];
}

const ROLE_LABELS: Record<Role, string> = { BORROW: 'Chce si požičiavať', LEND: 'Chce požičiavať', BOTH: 'Oboje' };
const DAILY_EVENTS = ['visit_home', 'view_item', 'rent_click', 'rental_request', 'register', 'item_created', 'waitlist', 'demand'];

const downloadCsv = (name: string, rows: (string | number | null)[][]) => {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export function AdminInsights() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => get<Insights>(`/api/admin/insights?days=${days}`), [days]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Štatistiky spustenia</h1>
      <AdminNav />
      <p className="notice mb-4 text-sm">Anonymné denné počty bez cookies a bez identifikácie návštevníkov. Pri malých číslach ich ber orientačne (rátajú sa aj opakované návštevy).</p>
      <div className="h-scroll mb-5" role="group" aria-label="Obdobie">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`chip ${days === d ? 'chip-active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>Posledných {d} dní</button>
        ))}
      </div>
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} onRetry={reload} /> : <Content data={data!} />}
    </div>
  );
}

function Content({ data }: { data: Insights }) {
  const byDay = new Map<string, Record<string, number>>();
  for (const d of data.daily) byDay.set(d.day, { ...(byDay.get(d.day) ?? {}), [d.name]: d.count });
  const labelOf = (name: string) => data.funnel.find((f) => f.name === name)?.label ?? name;
  const count = (name: string) => data.funnel.find((f) => f.name === name)?.count ?? 0;
  const pct = (a: string, b: string) => (count(b) ? `${Math.round((count(a) / count(b)) * 100)} %` : '–');

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Návštevy', count('visit_home')],
          ['Žiadosti o prenájom', count('rental_request')],
          ['Registrácie', count('register')],
          ['Zápisy medzi prvých', count('waitlist')],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-2xl font-extrabold">{v}</div>
            <div className="text-xs text-ink-3">{l}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Lievik</h2>
        <p className="text-sm text-ink-2">
          Detail → klik „Požiadať“: <strong className="text-ink">{pct('rent_click', 'view_item')}</strong> · klik → odoslaná žiadosť:{' '}
          <strong className="text-ink">{pct('rental_request', 'rent_click')}</strong> · formulár „Pridať vec“ → pridaná vec:{' '}
          <strong className="text-ink">{pct('item_created', 'add_item_open')}</strong>
        </p>
        <Table head={['Udalosť', `Počet za ${data.days} dní`]}>
          {data.funnel.map((f) => (
            <tr key={f.name}><Td>{f.label}</Td><Td><strong>{f.count}</strong></Td></tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Po dňoch</h2>
        {byDay.size === 0 ? <EmptyState message="Zatiaľ žiadne dáta." /> : (
          <Table head={['Deň', ...DAILY_EVENTS.map(labelOf)]}>
            {[...byDay.entries()].map(([day, c]) => (
              <tr key={day}><Td><span className="whitespace-nowrap">{day.split('-').reverse().join('. ')}</span></Td>{DAILY_EVENTS.map((e) => <Td key={e}>{c[e] ?? 0}</Td>)}</tr>
            ))}
          </Table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Hľadania bez výsledku</h2>
          <p className="text-sm text-ink-2">Toto ľudia chcú, ale nikto to zatiaľ neponúka – oslov ľudí, ktorí to vlastnia.</p>
          {data.zeroResultSearches.length === 0 ? <EmptyState message="Zatiaľ žiadne." /> : (
            <Table head={['Hľadaný text', 'Koľkokrát']}>
              {data.zeroResultSearches.map((s) => <tr key={s.query}><Td>{s.query}</Td><Td>{s.count}</Td></tr>)}
            </Table>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Najčastejšie hľadania</h2>
          {data.searches.length === 0 ? <EmptyState message="Zatiaľ žiadne." /> : (
            <Table head={['Hľadaný text', 'Koľkokrát', 'Max. výsledkov']}>
              {data.searches.map((s) => <tr key={s.query}><Td>{s.query}</Td><Td>{s.count}</Td><Td>{s.maxResults}</Td></tr>)}
            </Table>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            Chcem byť medzi prvými ({data.waitlist.entries.length})
            <span className="ml-2 text-sm font-normal text-ink-2">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => `${ROLE_LABELS[r]}: ${data.waitlist.byRole[r] ?? 0}`).join(' · ')}
            </span>
          </h2>
          {data.waitlist.entries.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCsv('shareon-zaujemcovia.csv', [['E-mail', 'Záujem', 'Mesto', 'Mestská časť', 'Chce si požičať', 'Dátum'], ...data.waitlist.entries.map((w) => [w.email, ROLE_LABELS[w.role], w.city, w.district, w.wish, formatDateTime(w.createdAt)])])}
            >
              <Download className="h-4 w-4" aria-hidden />Stiahnuť CSV
            </button>
          )}
        </div>
        {data.waitlist.entries.length === 0 ? <EmptyState message="Zatiaľ sa nikto nezapísal." /> : (
          <Table head={['E-mail', 'Záujem', 'Mesto', 'Chce si požičať', 'Dátum']}>
            {data.waitlist.entries.map((w) => (
              <tr key={w.id}><Td><a href={`mailto:${w.email}`} className="text-neon-blue">{w.email}</a></Td><Td>{ROLE_LABELS[w.role]}</Td><Td>{[w.city, w.district].filter(Boolean).join(' – ') || '—'}</Td><Td>{w.wish ?? '—'}</Td><Td>{formatDateTime(w.createdAt)}</Td></tr>
            ))}
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Čo ľudia hľadajú ({data.demand.length})</h2>
          {data.demand.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCsv('shareon-dopyt.csv', [['Čo hľadá', 'E-mail', 'Mestská časť', 'Dátum'], ...data.demand.map((d) => [d.what, d.email, d.district, formatDateTime(d.createdAt)])])}
            >
              <Download className="h-4 w-4" aria-hidden />Stiahnuť CSV
            </button>
          )}
        </div>
        {data.demand.length === 0 ? <EmptyState message="Zatiaľ žiadne požiadavky." /> : (
          <Table head={['Čo hľadá', 'E-mail', 'Mestská časť', 'Dátum']}>
            {data.demand.map((d) => (
              <tr key={d.id}><Td>{d.what}</Td><Td>{d.email ? <a href={`mailto:${d.email}`} className="text-neon-blue">{d.email}</a> : '—'}</Td><Td>{d.district ?? '—'}</Td><Td>{formatDateTime(d.createdAt)}</Td></tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
