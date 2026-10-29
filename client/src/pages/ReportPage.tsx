import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../api/client';
import type { ReportDetail } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useUi } from '../context/UiContext';
import { ErrorState, Spinner } from '../components/States';
import { PhotoUploader } from '../components/PhotoUploader';
import { SelectField, TextArea } from '../components/Field';
import { formatDateTime, formatEur, imageUrl, RENTAL_MODE_LABELS, RENTAL_STATUS_LABELS, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from '../lib/format';

const KIND_LABEL = { EVIDENCE: 'Dôkaz', RESPONSE: 'Odpoveď druhej strany', ADMIN_NOTE_PUBLIC: 'Správa od administrátora' } as const;

export function ReportPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => get<{ report: ReportDetail }>(`/api/reports/${id}`), [id]);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error?.message ?? 'Hlásenie sa nenašlo.'} onRetry={reload} />;
  const r = data.report;

  // Unified timeline: evidence + decisions
  const timeline = [
    { at: r.createdAt, key: 'created', node: <><strong>{r.reporter.name}</strong> otvoril/a hlásenie</> },
    ...r.evidence.map((e) => ({
      at: e.createdAt,
      key: e.id,
      node: (
        <>
          <span className={`badge ${e.kind === 'RESPONSE' ? 'badge-info' : e.kind === 'ADMIN_NOTE_PUBLIC' ? 'badge-demo' : ''}`}>{KIND_LABEL[e.kind]}</span>{' '}
          <strong>{e.author.name}</strong>
          {e.text && <p className="mt-1 text-ink-2">{e.text}</p>}
          {e.fileUrl && <a href={imageUrl(e.fileUrl)} target="_blank" rel="noreferrer"><img src={imageUrl(e.fileUrl)} alt="Dôkaz" className="mt-2 h-24 w-24 rounded-xl object-cover" /></a>}
        </>
      ),
    })),
    ...r.decisions.map((d) => ({
      at: d.createdAt,
      key: d.id,
      node: (
        <>
          <span className="badge badge-protect">Stav: {REPORT_STATUS_LABELS[d.decision]}</span>
          {d.admin && <span className="ml-2 text-xs text-ink-3">{d.admin.name}</span>}
          {d.publicNote && <p className="mt-1 text-ink-2">{d.publicNote}</p>}
          {d.internalNote && <p className="mt-1 rounded-xl bg-night-2 p-2 text-xs text-ink-3">Interná poznámka: {d.internalNote}</p>}
        </>
      ),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-danger">{REPORT_TYPE_LABELS[r.type]}</span>
            <span className="badge">{REPORT_STATUS_LABELS[r.status]}</span>
          </div>
          <h1 className="text-2xl font-extrabold">Hlásenie k predmetu {r.item.title}</h1>
          <p className="text-ink-2">{r.description}</p>
          {r.contactNote && <p className="text-sm"><span className="text-ink-3">Poznámka ku kontaktu:</span> {r.contactNote}</p>}
          {r.rentalRequestId && <Link to={`/requests/${r.rentalRequestId}`} className="text-sm font-semibold text-neon-blue">Zobraziť prenájom →</Link>}
        </div>
        <p className="notice notice-warn" role="note">{r.disclaimer}</p>
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Priebeh</h2>
          <ol className="space-y-4 border-l border-line pl-5">
            {timeline.map((t) => (
              <li key={t.key} className="relative text-sm">
                <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-grad-primary" aria-hidden />
                <div className="text-xs text-ink-3">{formatDateTime(t.at)}</div>
                <div>{t.node}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <aside className="space-y-4">
        {r.isOpen && r.viewerRole !== 'ADMIN' && <AddEvidence report={r} onDone={reload} />}
        {r.viewerRole === 'ADMIN' && <AdminPanel report={r} onDone={reload} />}
      </aside>
    </div>
  );
}

function AddEvidence({ report, onDone }: { report: ReportDetail; onDone: () => void }) {
  const { toast } = useUi();
  const isResponse = report.viewerRole === 'REPORTED';
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/api/reports/${report.id}/${isResponse ? 'response' : 'evidence'}`, { text: text || null, fileUrl: photo[0] ?? null });
      setText('');
      setPhoto([]);
      toast('Pridané.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-bold">{isResponse ? 'Tvoja odpoveď' : 'Doplniť dôkazy'}</h2>
      <TextArea id="ev-text" label="Text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      <PhotoUploader value={photo} onChange={setPhoto} max={1} label="Fotografia" />
      <button className="btn btn-primary w-full" disabled={busy || (!text && !photo.length)}>Odoslať</button>
    </form>
  );
}

const ADMIN_STATUSES = ['UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'RESOLVED', 'REJECTED'] as const;

function AdminPanel({ report, onDone }: { report: ReportDetail; onDone: () => void }) {
  const { toast, confirm } = useUi();
  const closed = report.status === 'RESOLVED' || report.status === 'REJECTED';
  const [status, setStatus] = useState<(typeof ADMIN_STATUSES)[number]>(report.status === 'OPEN' ? 'UNDER_REVIEW' : 'RESOLVED');
  const [publicNote, setPublicNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [busy, setBusy] = useState(false);
  const rental = report.rental;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'RESOLVED' || status === 'REJECTED') {
      const ok = await confirm({
        title: `${REPORT_STATUS_LABELS[status]} – uzavrieť hlásenie?`,
        message: 'Zmena sa zapíše do audit logu a oznámi obom stranám. Žiadna náhrada sa nevypláca automaticky.',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await patch(`/api/admin/reports/${report.id}/status`, { status, publicNote: publicNote || null, internalNote: internalNote || null });
      setPublicNote('');
      setInternalNote('');
      toast('Stav hlásenia bol zmenený.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {rental && (
        <div className="card space-y-3 p-5 text-sm">
          <h2 className="font-bold">Rezervácia</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-3">Stav</dt><dd>{RENTAL_STATUS_LABELS[rental.status]}</dd>
            <dt className="text-ink-3">Typ</dt><dd>{RENTAL_MODE_LABELS[rental.rentalMode]}</dd>
            <dt className="text-ink-3">Termín</dt><dd>{formatDateTime(rental.startAt)} – {formatDateTime(rental.endAt)}</dd>
            <dt className="text-ink-3">Vrátené</dt><dd>{rental.returnedAt ? formatDateTime(rental.returnedAt) : '–'}</dd>
            <dt className="text-ink-3">Cena</dt><dd>{formatEur(rental.rentalPriceCents)} + Ochrana prenájmu {formatEur(rental.protectionFeeCents)}</dd>
          </dl>
          {[['Nájomca', rental.renter], ['Majiteľ', rental.owner]].map(([role, u]) => {
            const p = u as typeof rental.renter;
            return (
              <div key={role as string} className="card-elevated p-3">
                <div className="text-xs text-ink-3">{role as string}</div>
                <Link to={`/users/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                <div className="text-xs text-ink-2"><a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a> · <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a></div>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={save} className="card space-y-3 border-neon-pink/30 p-5">
        <h2 className="font-bold">Admin: posúdenie hlásenia</h2>
        <p className="text-xs text-ink-3">Aktuálny stav: <strong className="text-ink">{REPORT_STATUS_LABELS[report.status]}</strong>. Hlásenia sa nikdy neschvaľujú ani nevyplácajú automaticky.</p>
        {closed ? (
          <p className="text-sm text-ink-2">Hlásenie je uzavreté.</p>
        ) : (
          <>
            <SelectField id="adm-status" label="Nový stav" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {ADMIN_STATUSES.filter((st) => st !== report.status).map((st) => <option key={st} value={st}>{REPORT_STATUS_LABELS[st]}</option>)}
            </SelectField>
            <TextArea id="adm-pub" label="Správa pre obe strany (nepovinné)" value={publicNote} onChange={(e) => setPublicNote(e.target.value)} maxLength={2000} />
            <TextArea id="adm-int" label="Interná poznámka (vidí len admin)" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} maxLength={2000} />
            <button className="btn btn-primary w-full" disabled={busy}>Uložiť stav</button>
          </>
        )}
      </form>
    </div>
  );
}
