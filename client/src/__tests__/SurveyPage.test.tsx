import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyPage } from '../pages/SurveyPage';
import { post } from '../api/client';

vi.mock('../api/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/client')>()), post: vi.fn() }));
const mockPost = vi.mocked(post);

describe('survey page', () => {
  beforeEach(() => {
    mockPost.mockReset();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('requires single-choice answers, then sends them and thanks the respondent', async () => {
    mockPost.mockResolvedValue({ ok: true });
    render(<MemoryRouter><SurveyPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Odoslať odpovede' }));
    expect(screen.getAllByText('Vyber odpoveď.')).toHaveLength(4);
    expect(mockPost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Áno, často' }));
    fireEvent.click(screen.getByRole('button', { name: 'Náradie (vŕtačka, rebrík…)' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Skôr áno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Záloha, ktorú musím zaplatiť vopred' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nič, požičal by som si' })); // replaces the other barriers
    const yes = screen.getAllByRole('radio', { name: 'Áno' });
    fireEvent.click(yes[0]);
    fireEvent.click(screen.getByRole('radio', { name: 'Možno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Odoslať odpovede' }));

    expect(await screen.findByText('Ďakujem!')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/api/launch/survey', {
      boughtUnused: 'OFTEN', categories: ['TOOLS'], categoryOther: null, wouldBorrow: 'RATHER_YES', barriers: ['NOTHING'],
      noDepositHelps: 'YES', wouldLend: 'MAYBE', email: null, consent: false,
    });
  });
});
