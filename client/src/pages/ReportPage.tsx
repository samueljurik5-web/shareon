import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../api/client';
import type { ReportDetail } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useUi } from '../context/UiContext';
import { ErrorState, Spinner } from '../components/States';
import { PhotoUploader } from '../components/PhotoUploader';
import { SelectField, TextArea, TextField } from '../components/Field';
import { formatDateTime, formatEur, imageUrl, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from '../lib/format';

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
          <span className="badge badge-protect">Rozhodnutie: {REPORT_STATUS_LABELS[d.decision]}</span>
          {d.approvedAmountCents != null && <span className="ml-2">Schválená suma: <strong>{formatEur(d.approvedAmountCents)}</strong></span>}
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
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Požadovaná suma: <strong>{formatEur(r.requestedAmountCents)}</strong></span>
            {r.approvedAmountCents != null && <span>Schválená suma: <strong className="text-neon-green">{formatEur(r.approvedAmountCents)}</strong></span>}
          </div>
          {r.rentalRequestId && <Link to={`/requests/${r.rentalRequestId}`} className="text-sm font-semibold text-neon-blue">Zobraziť prenájom →</Link>}
        </div>
        <p className="notice notice-warn" role="note">{r.disclaimer}</p>
        {r.approvedAmountCents != null && r.approvedAmountCents > 0 && (
          <p className="notice">Schválená suma je rozhodnutím administrátora. V MVP sa žiadna kompenzácia nevypláca automaticky – vyrovnanie prebieha podľa pokynov ShareOn (prípadne zo simulovanej zálohy).</p>
        )}
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

function AdminPanel({ report, onDone }: { report: ReportDetail; onDone: () => void }) {
  const { toast, confirm } = useUi();
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'>('PARTIALLY_APPROVED');
  const [amount, setAmount] = useState('');
  const [publicNote, setPublicNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [depositAction, setDepositAction] = useState('NONE');
  const [withheld, setWithheld] = useState('');
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await patch(`/api/admin/reports/${report.id}/status`, { status, note: note || null });
      setNote('');
      toast('Stav hlásenia zmenený.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await confirm({ title: 'Potvrdiť rozhodnutie?', message: 'Rozhodnutie sa zapíše do audit logu a oznámi obom stranám. Nevypláca sa automaticky žiadna kompenzácia.' });
    if (!ok) return;
    setBusy(true);
    try {
      await post(`/api/admin/reports/${report.id}/decision`, {
        decision,
        approvedAmount: decision === 'REJECTED' ? 0 : decision === 'APPROVED' ? report.requestedAmountCents / 100 : Number(amount.replace(',', '.')) || 0,
        publicNote: publicNote || null,
        internalNote: internalNote || null,
        depositAction,
        ...(depositAction === 'PARTIAL_WITHHOLD' ? { withheldAmount: Number(withheld.replace(',', '.')) || 0 } : {}),
      });
      toast('Rozhodnutie uložené.');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Chyba', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3 border-neon-pink/30 p-5">
        <h2 className="font-bold">Admin: stav hlásenia</h2>
        <TextArea id="adm-note" label="Správa pre strany (nepovinné)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {report.status === 'OPEN' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('UNDER_REVIEW')}>Začať posudzovať</button>}
          {report.isOpen && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('NEEDS_MORE_INFORMATION')}>Vyžiadať viac informácií</button>}
          {report.status !== 'RESOLVED' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('RESOLVED')}>Uzavrieť</button>}
        </div>
      </div>
      {report.isOpen && report.rentalRequestId && (
        <form onSubmit={decide} className="card space-y-3 border-neon-pink/30 p-5">
          <h2 className="font-bold">Admin: rozhodnutie o kompenzácii</h2>
          <SelectField id="adm-dec" label="Rozhodnutie" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            <option value="APPROVED">Schváliť ({formatEur(report.requestedAmountCents)})</option>
            <option value="PARTIALLY_APPROVED">Čiastočne schváliť</option>
            <option value="REJECTED">Zamietnuť</option>
          </SelectField>
          {decision === 'PARTIALLY_APPROVED' && <TextField id="adm-amount" label="Schválená suma (€)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          <SelectField id="adm-dep" label="Simulovaná záloha" value={depositAction} onChange={(e) => setDepositAction(e.target.value)}>
            <option value="NONE">Bez zmeny</option>
            <option value="RELEASE">Uvoľniť</option>
            <option value="WITHHOLD">Zadržať celú</option>
            <option value="PARTIAL_WITHHOLD">Zadržať čiastočne</option>
          </SelectField>
          {depositAction === 'PARTIAL_WITHHOLD' && <TextField id="adm-withheld" label="Zadržaná suma (€)" inputMode="decimal" value={withheld} onChange={(e) => setWithheld(e.target.value)} />}
          <TextArea id="adm-pub" label="Zdôvodnenie (vidia strany)" value={publicNote} onChange={(e) => setPublicNote(e.target.value)} />
          <TextArea id="adm-int" label="Interná poznámka (len admin)" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={busy}>Uložiť rozhodnutie</button>
        </form>
      )}
    </div>
  );
}
