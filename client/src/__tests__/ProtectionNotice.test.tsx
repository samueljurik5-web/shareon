import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProtectionNotice } from '../components/ProtectionNotice';

describe('ProtectionNotice', () => {
  it('explains Ochrana prenájmu in Slovak without promising automatic compensation or using "poistenie"', () => {
    const { container } = render(<ProtectionNotice />);
    expect(screen.getByText(/Ochrana prenájmu je služba ShareOn/)).toBeInTheDocument();
    expect(screen.getByText(/náhrada nie je automatická ani garantovaná/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/poist|insur|100 %|DEMO/i);
  });
});
