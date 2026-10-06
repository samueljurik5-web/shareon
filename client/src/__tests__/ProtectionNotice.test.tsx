import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProtectionNotice } from '../components/ProtectionNotice';

describe('ProtectionNotice', () => {
  it('always states protection is not insurance and labels demo mode', () => {
    render(<ProtectionNotice />);
    expect(screen.getByText('DEMO / TEST MODE')).toBeInTheDocument();
    expect(screen.getByText('Toto nie je skutočné poistné krytie.')).toBeInTheDocument();
    expect(screen.getByText(/ShareOn Rental Protection is not insurance coverage/)).toBeInTheDocument();
    expect(screen.queryByText(/insured|poistené/i)).not.toBeInTheDocument();
  });
});
