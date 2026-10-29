import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemandForm, WaitlistForm } from '../components/LaunchForms';
import { post } from '../api/client';

vi.mock('../api/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/client')>()), post: vi.fn() }));
const mockPost = vi.mocked(post);
const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('launch forms', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('waitlist needs a valid e-mail and consent, then thanks the user', async () => {
    mockPost.mockResolvedValue({ alreadySignedUp: false });
    wrap(<WaitlistForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapísať sa' }));
    expect(await screen.findByText('Zadaj platný e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Potvrď, že ťa môžeme kontaktovať.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Chcem požičiavať svoje veci' }));
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'eva@example.sk' } });
    fireEvent.change(screen.getByLabelText('Mestská časť (nepovinné)'), { target: { value: 'Sever' } });
    fireEvent.click(screen.getByLabelText(/Súhlasím, aby ma ShareOn kontaktoval/));
    fireEvent.click(screen.getByRole('button', { name: 'Zapísať sa' }));
    expect(await screen.findByText('Ďakujeme! Ozveme sa ti medzi prvými.')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/api/launch/waitlist', { email: 'eva@example.sk', role: 'LEND', district: 'Sever', consent: true });
    expect(screen.queryByRole('link', { name: 'zásadách ochrany osobných údajov' })).not.toBeInTheDocument(); // form replaced by thanks
  });

  it('demand form is prefilled from the search and asks for consent only with an e-mail', async () => {
    mockPost.mockResolvedValue({ ok: true });
    wrap(<DemandForm initialWhat="vozík za auto" compact />);
    expect(screen.getByLabelText('Čo si chceš požičať?')).toHaveValue('vozík za auto');
    expect(screen.queryByLabelText(/Súhlasím, aby ma ShareOn kontaktoval/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'zásadách ochrany osobných údajov' })).toHaveAttribute('href', '/ochrana-udajov');
    fireEvent.click(screen.getByRole('button', { name: 'Odoslať' }));
    expect(await screen.findByText(/Ďakujeme! Pozrieme sa/)).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/api/launch/demand', { what: 'vozík za auto', email: null, district: null, consent: false });
  });
});
