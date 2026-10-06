import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../api/client';
import { AdminNav } from '../../components/Layout';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime, formatEur, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, DAMAGE_DISCLAIMER } from '../../lib/format';
import type { ReportStatus, ReportType } from '../../api/types';
import { AdminWarning, Table, Td } from './AdminDashboard';

interface ReportRow { id: string; type: ReportType; status: ReportStatus; requestedAmountCents: number; createdAt: string; item: { title: string }; reporter: { name: string }; reportedUser: { name: string } | null; rentalRequest: { id: string } | null; _count: { evidence: number } }

export function AdminReports() {
  const [status, setStatus] = useState('');
  const { data, loading, error } = useAsync(() => get<{ reports: ReportRow[] }>(`/api/admin/reports${status ? `?status=${status}` : ''}`), [status]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Hlásenia a spory</h1>
      <AdminNav />
      <AdminWarning />
      <p className="notice mb-4">{DAMAGE_DISCLAIMER}</p>
      <div className="h-scroll mb-4">
        {['', 'OPEN', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'RESOLVED'].map((s) => (
          <button key={s} className={`chip ${status === s ? 'chip-active' : ''}`} onClick={() => setStatus(s)}>{s ? REPORT_STATUS_LABELS[s as ReportStatus] : 'Všetky'}</button>
        ))}
      </div>
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} /> : !data!.reports.length ? <EmptyState message="Žiadne hlásenia." /> : (
        <Table head={['Typ', 'Predmet', 'Nahlásil', 'Proti', 'Požadované', 'Stav', 'Vytvorené']}>
          {data!.reports.map((r) => (
            <tr key={r.id}>
              <Td><Link to={`/reports/${r.id}`} className="font-semibold text-neon-blue">{REPORT_TYPE_LABELS[r.type]}</Link>{!r.rentalRequest && <span className="badge ml-1">Inzerát</span>}</Td>
              <Td>{r.item.title}</Td>
              <Td>{r.reporter.name}</Td>
              <Td>{r.reportedUser?.name ?? '—'}</Td>
              <Td>{formatEur(r.requestedAmountCents)}</Td>
              <Td>{REPORT_STATUS_LABELS[r.status]}</Td>
              <Td>{formatDateTime(r.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
