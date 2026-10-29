import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceBreakdown } from '../components/PriceBreakdown';

const norm = (t: string | null) => (t ?? '').replace(/\s/g, ' ');

describe('PriceBreakdown', () => {
  it('daily: 3 dni × 8 € = 24 € + Ochrana prenájmu 2,40 € = 26,40 €, no deposit line', () => {
    render(
      <PriceBreakdown rentalMode="DAILY" units={3} pricePerUnitCents={800} rentalPriceCents={2400} protectionFeeCents={240} platformFeeCents={0} totalCents={2640} showPaymentNote />,
    );
    const box = screen.getByTestId('price-breakdown');
    expect(within(box).getByText('Cena prenájmu')).toBeInTheDocument();
    expect(norm(within(box).getByText(/3 dni ×/).textContent)).toBe('3 dni × 8,00 €');
    expect(within(box).getByText('Ochrana prenájmu')).toBeInTheDocument();
    expect(within(box).getByText('Chráni tvoj prenájom a pomáha riešiť prípadné škody alebo spory.')).toBeInTheDocument();
    expect(norm(within(box).getByText(/2,40/).textContent)).toBe('2,40 €');
    expect(within(box).getByText('Spolu')).toBeInTheDocument();
    expect(norm(within(box).getByTestId('price-total').textContent)).toBe('26,40 €');
    expect(within(box).queryByText(/Poplatok platformy/)).not.toBeInTheDocument();
    expect(within(box).getByText(/zaplatíš majiteľovi pri odovzdaní/)).toBeInTheDocument();
    // "Bez kaucie" is the only mention – no deposit amount, no "poistenie"
    expect(box.textContent).not.toMatch(/vratná kaucia|záloha \d|poisten/i);
  });

  it('hourly: 4 hod. × 3 € = 12 € + 1,20 € = 13,20 €', () => {
    render(
      <PriceBreakdown rentalMode="HOURLY" units={4} pricePerUnitCents={300} rentalPriceCents={1200} protectionFeeCents={120} platformFeeCents={0} totalCents={1320} />,
    );
    expect(norm(screen.getByText(/hod\. ×/).textContent)).toBe('4 hod. × 3,00 €');
    expect(norm(screen.getByTestId('price-total').textContent)).toBe('13,20 €');
    expect(screen.queryByText(/zaplatíš majiteľovi pri odovzdaní/)).not.toBeInTheDocument();
  });

  it('fractional hours with the 0,50 € minimum and an enabled platform fee', () => {
    render(
      <PriceBreakdown rentalMode="HOURLY" units={1.5} pricePerUnitCents={300} rentalPriceCents={450} protectionFeeCents={50} platformFeeCents={45} totalCents={545} />,
    );
    expect(norm(screen.getByText(/hod\. ×/).textContent)).toBe('1,5 hod. × 3,00 €');
    expect(screen.getByText('Poplatok platformy')).toBeInTheDocument();
    expect(norm(screen.getByTestId('price-total').textContent)).toBe('5,45 €');
  });
});
