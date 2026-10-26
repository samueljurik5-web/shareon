/** Brand intro: once-per-tab-session decision (see components/BrandIntro.tsx). */

/** sessionStorage key – the intro plays once per browser tab session. */
export const INTRO_STORAGE_KEY = 'shareon.introShown.v1';
export const INTRO_LOGO_SRC = '/brand/shareon-logo.png';

/** Timeline (ms): logo + glow animate, then the overlay fades out. Total ≈ 1.6 s. */
export const INTRO_TIMING = {
  hold: 1200, // logo fade/scale (700 ms) + glow swell finished
  fadeOut: 400,
  /** Faster fade when the user skips (click/tap/Escape). */
  skipFadeOut: 200,
  /** If the logo has not loaded by then, skip the intro instead of making the user wait. */
  logoTimeout: 900,
  /** Hard safety limit – the overlay is always removed by then. */
  maxTotal: 2000,
} as const;

const prefersReducedMotion = () => {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Decision is memoised per page load: React StrictMode calls state initialisers twice and the
 * in-memory value also covers browsers where sessionStorage is unavailable.
 */
let decision: boolean | null = null;

/**
 * Decides synchronously (before first paint) whether to play the intro, and marks it as shown
 * right away – a refresh during or after the intro does not replay it.
 * `?intro=1` forces a replay (handy for testing).
 */
export const shouldPlayIntro = (): boolean => {
  if (decision === null) decision = decideIntro();
  return decision;
};

const decideIntro = (): boolean => {
  if (prefersReducedMotion()) return false;
  let forced = false;
  try {
    forced = new URLSearchParams(window.location.search).get('intro') === '1';
  } catch {
    /* ignore */
  }
  try {
    if (!forced && window.sessionStorage.getItem(INTRO_STORAGE_KEY)) return false;
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (privacy mode, blocked storage) – fall back to the in-memory flag.
  }
  return true;
};

/** Test helper. */
export const resetIntroForTests = () => {
  decision = null;
};
