import { useState } from 'react';
import { get } from '../../api/client';
import type { FeedbackEntry, FeedbackType } from '../../api/types';
import { AdminNav } from '../../components/Layout';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { useAsync } from '../../lib/useAsync';
import { FEEDBACK_TYPE_LABELS, formatDateTime } from '../../lib/format';
import { Table, Td } from './AdminDashboard';

export function AdminFeedback() {
  const [type, setType] = useState<FeedbackType | ''>('');
  const { data, loading, error, reload } = useAsync(() => get<{ feedback: FeedbackEntry[] }>(`/api/admin/feedback${type ? `?status=${type}` : ''}`), [type]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Spätná väzba</h1>
      <AdminNav />
      <div className="h-scroll mb-4" role="group" aria-label="Typ spätnej väzby">
        {(['', 'LIKE', 'BUG', 'FEATURE', 'TESTER'] as const).map((t) => (
          <button key={t} className={`chip ${type === t ? 'chip-active' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>
            {t ? FEEDBACK_TYPE_LABELS[t] : 'Všetko'}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : error ? <ErrorState message={error.message} onRetry={reload} /> : !data!.feedback.length ? (
        <EmptyState message="Zatiaľ žiadna spätná väzba." />
      ) : (
        <Table head={['Čas', 'Typ', 'Správa', 'Kontakt', 'Účet']}>
          {data!.feedback.map((f) => (
            <tr key={f.id}>
              <Td><span className="whitespace-nowrap">{formatDateTime(f.createdAt)}</span></Td>
              <Td><span className="badge">{FEEDBACK_TYPE_LABELS[f.type]}</span></Td>
              <Td><p className="max-w-md whitespace-pre-line">{f.message}</p></Td>
              <Td>{f.contact ?? '—'}</Td>
              <Td>{f.user ? <>{f.user.name}<span className="block text-xs text-ink-3">{f.user.email}</span></> : 'Anonym'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
