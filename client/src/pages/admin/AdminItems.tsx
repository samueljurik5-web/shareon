import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, get, patch } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { useUi } from '../../context/UiContext';
import { CATEGORY_LABELS, imageUrl, priceLabels } from '../../lib/format';
import type { Category } from '../../api/types';
import { AdminWarning, Table, Td } from './AdminDashboard';

interface ItemRow { id: string; title: string; category: Category; dailyPriceCents: number | null; hourlyPriceCents: number | null; dailyRentalEnabled: boolean; hourlyRentalEnabled: boolean; isActive: boolean; deactivatedByAdmin: boolean; owner: { id: string; name: string }; images: { url: string }[]; _count: { rentals: number; reports: number } }

export function AdminItems() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => get<{ items: ItemRow[] }>(`/api/admin/items?q=${encodeURIComponent(q)}`), [q]);
  const { toast, confirm } = useUi();
  const toggle = async (i: ItemRow) => {
    if (!(await confirm({ title: i.isActive ? `Deaktivovať „${i.title}“?` : `Aktivovať „${i.title}“?`, danger: i.isActive }))) return;
    try {
      await patch(`/api/admin/items/${i.id}/deactivate`, { active: !i.isActive });
      toast('Uložené.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Chyba', 'error');
    }
  };
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Predmety</h1>
      <AdminNav />
      <AdminWarning />
      <label htmlFor="i-q" className="sr-only">Hľadať</label>
      <input id="i-q" className="input mb-4 max-w-sm" placeholder="Hľadať názov" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} /> : (
        <Table head={['Predmet', 'Majiteľ', 'Kategória', 'Ceny', 'Prenájmy', 'Hlásenia', 'Stav', '']}>
          {data!.items.map((i) => (
            <tr key={i.id}>
              <Td><Link to={`/items/${i.id}`} className="flex items-center gap-2 font-semibold text-neon-blue"><img src={imageUrl(i.images[0]?.url)} alt="" className="h-9 w-9 rounded-lg object-cover" />{i.title}</Link></Td>
              <Td>{i.owner.name}</Td>
              <Td>{CATEGORY_LABELS[i.category]}</Td>
              <Td>{priceLabels({ dailyPriceCents: i.dailyRentalEnabled ? i.dailyPriceCents : null, hourlyPriceCents: i.hourlyRentalEnabled ? i.hourlyPriceCents : null }).map((p) => p.text).join(' · ')}</Td>
              <Td>{i._count.rentals}</Td>
              <Td>{i._count.reports}</Td>
              <Td>{i.isActive ? <span className="badge badge-protect">Aktívny</span> : <span className="badge badge-danger">{i.deactivatedByAdmin ? 'Deaktivoval admin' : 'Skrytý'}</span>}</Td>
              <Td><button className={`btn btn-sm ${i.isActive ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggle(i)}>{i.isActive ? 'Deaktivovať' : 'Aktivovať'}</button></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
