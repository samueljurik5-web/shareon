import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceBreakdown } from '../components/PriceBreakdown';

describe('PriceBreakdown', () => {
  it('separates non-refundable price, protection fee and refundable deposit (example: 56 €)', () => {
    render(
      <PriceBreakdown rentalDays={3} pricePerDayCents={800} rentalPriceCents={2400} protectionFeeCents={200} depositCents={3000} platformFeeCents={0} totalCents={5600} />,
    );
    const box = screen.getByTestId('price-breakdown');
    expect(within(box).getByText('Nevratné')).toBeInTheDocument();
    expect(within(box).getByText('Vratné')).toBeInTheDocument();
    expect(within(box).getByText(/Prenájom: 3 dni ×/)).toBeInTheDocument();
    expect(within(box).getByText('Nie je poistenie.')).toBeInTheDocument();
    expect(within(box).getByText('SIMULATED PAYMENT')).toBeInTheDocument();
    expect(within(box).getByText(/56,00/)).toBeInTheDocument();
    expect(within(box).queryByText('Poplatok platformy')).not.toBeInTheDocument();
  });

  it('shows platform fee only when non-zero and hides protection when 0', () => {
    render(
      <PriceBreakdown rentalDays={1} pricePerDayCents={1000} rentalPriceCents={1000} protectionFeeCents={0} depositCents={0} platformFeeCents={100} totalCents={1100} />,
    );
    expect(screen.getByText('Poplatok platformy')).toBeInTheDocument();
    expect(screen.queryByText(/Ochrana prenájmu/)).not.toBeInTheDocument();
  });
});
