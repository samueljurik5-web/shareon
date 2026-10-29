import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCard } from '../api/types';
import { HomePage } from '../pages/HomePage';
import { AuthProvider } from '../context/AuthContext';
import { UiProvider } from '../context/UiContext';
import { get, post } from '../api/client';

vi.mock('../api/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/client')>()), get: vi.fn(), post: vi.fn() }));
const mockGet = vi.mocked(get);
const mockPost = vi.mocked(post);

const item = (n: number, extra: Partial<ItemCard> = {}): ItemCard => ({
  id: `i${n}`, title: `Vec ${n}`, category: 'WORKSHOP', description: 'Popis', city: 'Košice',
  district: 'Sever', distanceKm: 2.1, availableToday: n === 1, isDemo: false,
  dailyPriceCents: 500, hourlyPriceCents: null, dailyRentalEnabled: true, hourlyRentalEnabled: false,
  condition: 'GOOD', isActive: true, deactivatedByAdmin: false, createdAt: '2026-10-01T00:00:00Z',
  images: [], owner: { id: 'o', name: 'Jana K', city: 'Košice', avatarUrl: null, rating: { average: 4.8, count: 3 } },
  rating: { average: null, count: 0 }, isFavorite: false,
  ...extra,
});

const renderHome = () =>
  render(
    <MemoryRouter>
      <UiProvider>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </UiProvider>
    </MemoryRouter>,
  );

describe('HomePage', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('shows rentable items right away with price, distance, rating, badges and a "Pozrieť" button', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/items?sort=newest')) {
        return { items: [item(1), item(2, { dailyPriceCents: null, hourlyPriceCents: 200, hourlyRentalEnabled: true, dailyRentalEnabled: false }), item(3)], total: 3 };
      }
      if (url.startsWith('/api/items?sort=popular')) return { items: [item(9)], total: 1 };
      throw new Error(`unexpected ${url}`);
    });
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Požičaj si čokoľvek od ľudí vo svojom okolí.' })).toBeInTheDocument();
    expect(screen.getByText('Bez kaucie. Bez zbytočného nakupovania. Len požičaj.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preskúmať veci na prenájom' })).toHaveAttribute('href', '#veci');
    const badges = screen.getByRole('list', { name: 'Prečo je prenájom bezpečný' });
    for (const b of ['Bez kaucie', 'Ochrana prenájmu v cene', 'Jasná cena vopred', 'Hodnotenia používateľov']) expect(within(badges).getByText(b)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Požičaj si v svojom okolí' })).toBeInTheDocument();
    // Trust section with the four cards
    const trust = screen.getByRole('heading', { name: /Požičaj si bez kaucie/ }).closest('section')!;
    expect(within(trust).getByText(/nemusíš viazať peniaze za zálohu/)).toBeInTheDocument();
    for (const t of ['Bez kaucie', 'Ochrana prenájmu v cene', 'Jasná cena vopred', 'Riešenie škôd']) expect(within(trust).getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ako to funguje' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prečo ShareOn' })).toBeInTheDocument();
    expect(screen.getByText('Dostupné veci od ľudí v Košiciach')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Čo si chceš požičať?')).toBeInTheDocument();

    const grid = await screen.findByTestId('rent-grid');
    const cards = within(grid).getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveClass('col-span-2'); // 1 large card on mobile
    expect(within(cards[0]).getByText('od 5,00 € / deň')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Bez kaucie')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Dostupné dnes')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Na dni')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/2,1 km/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('4,8')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: 'Pozrieť: Vec 1' })).toHaveAttribute('href', '/items/i1');
    expect(within(cards[1]).getByText('od 2,00 € / hodinu')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Na hodiny')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Populárne teraz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nájdi vec na hodiny' })).toHaveAttribute('href', '/search?mode=HOURLY');
    for (const l of screen.getAllByRole('link', { name: 'Pridať vec na prenájom' })) expect(l).toHaveAttribute('href', '/items/new');
    expect(document.body.textContent).not.toMatch(/poist|insur|vratná kaucia/i);
  });

  it('quick filters and category tiles filter the items; no items → empty state', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url.includes('category=')) return { items: [], total: 0 };
      return { items: [item(1)], total: 1 };
    });
    renderHome();
    await screen.findByTestId('rent-grid');

    fireEvent.click(screen.getByRole('button', { name: 'Náradie' }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/items?sort=newest&limit=9&category=WORKSHOP,GARDEN'));
    expect(await screen.findByText('Zatiaľ tu nie sú žiadne veci. Skús inú kategóriu alebo pridaj prvú vec.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Náradie' })).toHaveAttribute('aria-pressed', 'true');

    const tiles = screen.getByRole('group', { name: 'Kategórie' });
    fireEvent.click(within(tiles).getByRole('button', { name: 'Technika' }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/items?sort=newest&limit=9&category=ELECTRONICS'));
    expect(screen.getByRole('button', { name: 'Náradie' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Všetko' }));
    expect(await screen.findByTestId('rent-grid')).toBeInTheDocument();
  });
});

describe('HomePage feedback', () => {
  it('sends feedback and shows a thank-you message', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    mockPost.mockResolvedValue({ feedback: { id: 'f1' } });
    renderHome();
    const form = screen.getByRole('heading', { name: 'Povedz nám, čo si myslíš' }).closest('section')!;
    expect(within(form).getByText('ShareOn je v prvej testovacej verzii. Pomôž nám ju zlepšiť svojou spätnou väzbou.')).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('radio', { name: 'Chýba mi funkcia' }));
    fireEvent.change(within(form).getByLabelText('Meno alebo e-mail (nepovinné)'), { target: { value: 'jana@example.sk' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Odoslať spätnú väzbu' }));
    expect(await within(form).findByText('Správa musí mať aspoň 5 znakov.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText('Správa'), { target: { value: 'Chcel by som filter podľa vzdialenosti.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Odoslať spätnú väzbu' }));
    expect(await within(form).findByText(/Ďakujeme! Tvoja spätná väzba/)).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/api/feedback', { type: 'FEATURE', contact: 'jana@example.sk', message: 'Chcel by som filter podľa vzdialenosti.' });
  });
});
