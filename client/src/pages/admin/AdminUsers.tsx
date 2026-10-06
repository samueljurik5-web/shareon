import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, get, patch } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { useUi } from '../../context/UiContext';
import { AdminWarning, Table, Td } from './AdminDashboard';

interface UserRow { id: string; name: string; email: string; phone: string; city: string; role: string; isActive: boolean; _count: { items: number; rentalsAsRenter: number; rentalsAsOwner: number; reportsAgainst: number } }

export function AdminUsers() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => get<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`), [q]);
  const { toast, confirm } = useUi();
  const toggle = async (u: UserRow) => {
    if (!(await confirm({ title: u.isActive ? `Deaktivovať ${u.name}?` : `Aktivovať ${u.name}?`, message: u.isActive ? 'Používateľ bude okamžite odhlásený a jeho predmety sa skryjú.' : undefined, danger: u.isActive }))) return;
    try {
      await patch(`/api/admin/users/${u.id}/deactivate`, { active: !u.isActive });
      toast('Uložené.');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Chyba', 'error');
    }
  };
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Používatelia</h1>
      <AdminNav />
      <AdminWarning />
      <label htmlFor="u-q" className="sr-only">Hľadať</label>
      <input id="u-q" className="input mb-4 max-w-sm" placeholder="Hľadať meno alebo e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} /> : (
        <Table head={['Meno', 'Kontakt', 'Rola', 'Predmety', 'Prenájmy', 'Hlásenia', 'Stav', '']}>
          {data!.users.map((u) => (
            <tr key={u.id}>
              <Td><Link to={`/users/${u.id}`} className="font-semibold text-neon-blue">{u.name}</Link></Td>
              <Td><div className="text-xs">{u.email}<br />{u.phone}</div></Td>
              <Td>{u.role}</Td>
              <Td>{u._count.items}</Td>
              <Td>{u._count.rentalsAsRenter + u._count.rentalsAsOwner}</Td>
              <Td>{u._count.reportsAgainst}</Td>
              <Td>{u.isActive ? <span className="badge badge-protect">Aktívny</span> : <span className="badge badge-danger">Deaktivovaný</span>}</Td>
              <Td>{u.role !== 'ADMIN' && <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggle(u)}>{u.isActive ? 'Deaktivovať' : 'Aktivovať'}</button>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
