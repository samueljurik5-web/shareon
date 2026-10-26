import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCard } from '../api/types';
import { HomePage } from '../pages/HomePage';
import { AuthProvider } from '../context/AuthContext';
import { UiProvider } from '../context/UiContext';
import { get } from '../api/client';

vi.mock('../api/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/client')>()), get: vi.fn() }));
const mockGet = vi.mocked(get);

const item = (n: number, extra: Partial<ItemCard> = {}): ItemCard => ({
  id: `i${n}`, title: `Vec ${n}`, category: 'WORKSHOP', description: 'Popis', city: 'Košice',
  district: 'Sever', distanceKm: 2.1, availableToday: n === 1,
  dailyPriceCents: 500, hourlyPriceCents: null, dailyRentalEnabled: true, hourlyRentalEnabled: false,
  condition: 'GOOD', isActive: true, deactivatedByAdmin: false, createdAt: '2026-10-01T00:00:00Z',
  images: [], owner: { id: 'o', name: 'Jana K', city: 'Košice', avatarUrl: null, rating: { average: 4.8, count: 3 } },
  rating: { average: null, count: 0 }, protectionAvailable: false, isFavorite: false,
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

    expect(screen.getByRole('heading', { level: 1, name: 'Požičaj si v svojom okolí' })).toBeInTheDocument();
    expect(screen.getByText('Dostupné veci od ľudí v Košiciach')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Čo si chceš požičať?')).toBeInTheDocument();

    const grid = await screen.findByTestId('rent-grid');
    const cards = within(grid).getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveClass('col-span-2'); // 1 large card on mobile
    expect(within(cards[0]).getByText('od 5,00 € / deň')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Dostupné dnes')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Na dni')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/2,1 km/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('4,8')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: 'Pozrieť: Vec 1' })).toHaveAttribute('href', '/items/i1');
    expect(within(cards[1]).getByText('od 2,00 € / hodinu')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Na hodiny')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Populárne teraz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nájdi vec na hodiny' })).toHaveAttribute('href', '/search?mode=HOURLY');
    expect(screen.getByRole('link', { name: 'Pridať vec na prenájom' })).toHaveAttribute('href', '/items/new');
    expect(document.body.textContent).not.toMatch(/poisten[ée]|insured/i);
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
