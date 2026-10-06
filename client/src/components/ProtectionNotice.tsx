import { ShieldAlert, FlaskConical } from 'lucide-react';
import { PROTECTION_NOTICE, PROTECTION_NOTICE_SK } from '../lib/format';

/** Required legal notice wherever rental protection is shown. */
export function ProtectionNotice({ demo = true, compact = false }: { demo?: boolean; compact?: boolean }) {
  return (
    <div className={`notice ${demo ? 'notice-demo' : ''}`} role="note">
      {demo && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="badge badge-demo"><FlaskConical className="h-3 w-3" aria-hidden />DEMO / TEST MODE</span>
          <span className="font-semibold text-ink">Toto nie je skutočné poistné krytie.</span>
        </div>
      )}
      <p className="flex gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neon-purple" aria-hidden />
        <span>{PROTECTION_NOTICE_SK}</span>
      </p>
      {!compact && <p className="mt-2 text-xs text-ink-3" lang="en">{PROTECTION_NOTICE}</p>}
    </div>
  );
}
