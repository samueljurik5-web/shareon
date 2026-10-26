import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { INTRO_LOGO_SRC, INTRO_TIMING, shouldPlayIntro } from '../lib/intro';

type Phase = 'showing' | 'leaving' | 'done';

/**
 * Animated brand splash shown once per tab session. The app (children) renders and loads
 * underneath immediately – the intro never delays routing, data fetching or initialisation.
 * While it is visible the app is `inert` (no focus / clicks reach hidden controls).
 */
export function BrandIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => (shouldPlayIntro() ? 'showing' : 'done'));
  const [loaded, setLoaded] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const loadedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const timers = useRef<number[]>([]);
  const skipButton = useRef<HTMLButtonElement>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = useCallback(() => {
    clearTimers();
    phaseRef.current = 'done';
    setPhase('done');
  }, []);

  const leave = useCallback(
    (skipped = false) => {
      if (phaseRef.current !== 'showing') return;
      phaseRef.current = 'leaving';
      setSkipped(skipped);
      setPhase('leaving');
      later(finish, skipped ? INTRO_TIMING.skipFadeOut : INTRO_TIMING.fadeOut);
    },
    [finish],
  );

  // Safety nets: never let the overlay hang (slow/missing logo, interrupted animation, hidden tab).
  useEffect(() => {
    if (phase === 'done') return;
    later(finish, INTRO_TIMING.maxTotal);
    later(() => {
      if (!loadedRef.current) finish();
    }, INTRO_TIMING.logoTimeout);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the timeline once the logo is ready.
  useEffect(() => {
    if (!loaded || phase !== 'showing') return;
    later(() => leave(false), INTRO_TIMING.hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Skip with Escape (also Enter/Space via the focused skip button).
  useEffect(() => {
    if (phase === 'done') return;
    skipButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, leave]);

  const active = phase !== 'done';

  return (
    <>
      <div inert={active ? true : undefined}>{children}</div>
      {active && (
        <div
          className="brand-intro"
          data-state={phase}
          data-loaded={loaded}
          data-skipped={skipped || undefined}
          data-testid="brand-intro"
        >
          <span className="brand-intro__glow" aria-hidden />
          <img
            className="brand-intro__logo"
            src={INTRO_LOGO_SRC}
            alt="ShareOn"
            decoding="async"
            onLoad={() => {
              loadedRef.current = true;
              setLoaded(true);
            }}
            onError={finish}
            draggable={false}
          />
          {/* Full-screen transparent button: a click/tap anywhere or Enter/Space skips the intro. */}
          <button
            ref={skipButton}
            type="button"
            onClick={() => leave(true)}
            className="absolute inset-0 h-full w-full cursor-pointer bg-transparent focus:outline-none"
            aria-label="Preskočiť úvodnú animáciu"
          />
        </div>
      )}
    </>
  );
}
