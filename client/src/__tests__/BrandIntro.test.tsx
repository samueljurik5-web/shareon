import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandIntro } from '../components/BrandIntro';
import { INTRO_STORAGE_KEY, INTRO_TIMING, resetIntroForTests } from '../lib/intro';

const App = () => <button type="button">Aplikácia</button>;
const renderIntro = () => render(<BrandIntro><App /></BrandIntro>);
const overlay = () => screen.queryByTestId('brand-intro');
const appWrapper = () => screen.getByText('Aplikácia').parentElement!;
const loadLogo = () => fireEvent.load(screen.getByAltText('ShareOn'));

describe('BrandIntro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    resetIntroForTests();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('plays on the first visit with the real logo, keeps the app rendered but inert, then removes itself', () => {
    renderIntro();
    expect(overlay()).toBeInTheDocument();
    const img = screen.getByAltText('ShareOn') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/brand/shareon-logo.png');
    // App is already mounted underneath (loads in the background) but not focusable/clickable.
    expect(screen.getByText('Aplikácia')).toBeInTheDocument();
    expect(appWrapper()).toHaveAttribute('inert');
    expect(sessionStorage.getItem(INTRO_STORAGE_KEY)).not.toBeNull();

    loadLogo();
    act(() => vi.advanceTimersByTime(INTRO_TIMING.hold));
    expect(overlay()).toHaveAttribute('data-state', 'leaving');
    act(() => vi.advanceTimersByTime(INTRO_TIMING.fadeOut));
    expect(overlay()).not.toBeInTheDocument();
    expect(appWrapper()).not.toHaveAttribute('inert');
  });

  it('does not replay within the same tab session (navigation, refresh)', () => {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    renderIntro();
    expect(overlay()).not.toBeInTheDocument();
    expect(appWrapper()).not.toHaveAttribute('inert');
  });

  it('can be skipped with Escape and with a click/tap', () => {
    const first = renderIntro();
    loadLogo();
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(INTRO_TIMING.skipFadeOut));
    expect(overlay()).not.toBeInTheDocument();
    first.unmount();

    resetIntroForTests();
    sessionStorage.clear();
    renderIntro();
    fireEvent.click(screen.getByRole('button', { name: 'Preskočiť úvodnú animáciu' }));
    act(() => vi.advanceTimersByTime(INTRO_TIMING.skipFadeOut));
    expect(overlay()).not.toBeInTheDocument();
  });

  it('skips immediately when the logo fails to load, and when it loads too slowly', () => {
    const first = renderIntro();
    fireEvent.error(screen.getByAltText('ShareOn'));
    expect(overlay()).not.toBeInTheDocument();
    first.unmount();

    resetIntroForTests();
    sessionStorage.clear();
    renderIntro();
    act(() => vi.advanceTimersByTime(INTRO_TIMING.logoTimeout));
    expect(overlay()).not.toBeInTheDocument();
  });

  it('never stays longer than the hard limit', () => {
    renderIntro();
    loadLogo();
    act(() => vi.advanceTimersByTime(INTRO_TIMING.maxTotal));
    expect(overlay()).not.toBeInTheDocument();
  });

  it('is skipped entirely with prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    renderIntro();
    expect(overlay()).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('works when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    renderIntro();
    expect(screen.getByText('Aplikácia')).toBeInTheDocument();
    loadLogo();
    act(() => vi.advanceTimersByTime(INTRO_TIMING.hold + INTRO_TIMING.fadeOut));
    expect(overlay()).not.toBeInTheDocument();
  });

  it('?intro=1 forces a replay for testing', () => {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    window.history.replaceState(null, '', '/items/abc?intro=1');
    renderIntro();
    expect(overlay()).toBeInTheDocument();
  });
});
