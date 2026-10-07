import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceBreakdown } from '../components/PriceBreakdown';

const norm = (t: string | null) => (t ?? '').replace(/\s/g, ' ');

describe('PriceBreakdown', () => {
  it('daily: 3 dni × 8 € = 24 €, protection 2 €, refundable deposit 30 €, total 56 €', () => {
    render(
      <PriceBreakdown rentalMode="DAILY" units={3} pricePerUnitCents={800} rentalPriceCents={2400} protectionFeeCents={200} depositCents={3000} platformFeeCents={0} totalCents={5600} refundableCents={3000} />,
    );
    const box = screen.getByTestId('price-breakdown');
    expect(within(box).getByText('Nevratné')).toBeInTheDocument();
    expect(within(box).getByText('Vratné')).toBeInTheDocument();
    expect(within(box).getByText('Cena prenájmu')).toBeInTheDocument();
    expect(norm(within(box).getByText(/3 dni ×/).textContent)).toBe('3 dni × 8,00 € = 24,00 €');
    expect(within(box).getByText(/Nie je poistenie/)).toBeInTheDocument();
    expect(within(box).getByText('Platformový poplatok')).toBeInTheDocument();
    expect(within(box).getByText(/Vratná kaucia/)).toBeInTheDocument();
    expect(within(box).getByText('Odhad spolu')).toBeInTheDocument();
    expect(norm(within(box).getByText(/56,00/).textContent)).toMatch(/56,00 €/);
  });

  it('hourly: 4 hod. × 3 € = 12 €, protection 1.50 €, total 43.50 €', () => {
    render(
      <PriceBreakdown rentalMode="HOURLY" units={4} pricePerUnitCents={300} rentalPriceCents={1200} protectionFeeCents={150} depositCents={3000} platformFeeCents={0} totalCents={4350} refundableCents={3000} />,
    );
    expect(norm(screen.getByText(/hod\. ×/).textContent)).toBe('4 hod. × 3,00 € = 12,00 €');
    expect(norm(screen.getByText(/43,50/).textContent)).toMatch(/43,50 €/);
  });

  it('fractional hours and no protection line when the fee is 0', () => {
    render(
      <PriceBreakdown rentalMode="HOURLY" units={1.5} pricePerUnitCents={300} rentalPriceCents={450} protectionFeeCents={0} depositCents={0} platformFeeCents={0} totalCents={450} />,
    );
    expect(norm(screen.getByText(/hod\. ×/).textContent)).toBe('1,5 hod. × 3,00 € = 4,50 €');
    expect(screen.queryByText(/Ochrana prenájmu/)).not.toBeInTheDocument();
  });
});
