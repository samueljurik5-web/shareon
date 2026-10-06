import { Link } from 'react-router-dom';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="ShareOn – domov">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-2xl bg-grad-primary text-lg font-extrabold text-night shadow-[var(--shadow-neon)]">S</span>
      <span className="text-gradient text-2xl font-extrabold tracking-tight">ShareOn</span>
    </Link>
  );
}
