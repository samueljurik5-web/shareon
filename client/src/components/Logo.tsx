import { Link } from 'react-router-dom';
import { INTRO_LOGO_SRC } from '../lib/intro';

/** Name image (transparent background) shown next to the symbol shared with the brand intro. */
const WORDMARK_SRC = '/brand/shareon-wordmark.png';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl py-1 ${className}`} aria-label="ShareOn – domov">
      {/* Decorative images – the link's aria-label is the only accessible name. */}
      <img
        src={INTRO_LOGO_SRC}
        alt=""
        aria-hidden
        width={706}
        height={706}
        draggable={false}
        className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
      />
      <img
        src={WORDMARK_SRC}
        alt=""
        aria-hidden
        width={583}
        height={160}
        draggable={false}
        className="h-6 w-auto shrink-0 object-contain sm:h-8"
      />
    </Link>
  );
}
