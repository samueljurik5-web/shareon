import { ShieldCheck } from 'lucide-react';
import { PROTECTION_NOTICE_SK } from '../lib/format';

/** Rules of Ochrana prenájmu – shown wherever the protection is explained. */
export function ProtectionNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`notice ${className}`} role="note">
      <p className="flex gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" aria-hidden />
        <span>{PROTECTION_NOTICE_SK}</span>
      </p>
    </div>
  );
}
