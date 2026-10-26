import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Logo } from '../components/Logo';
import { INTRO_LOGO_SRC } from '../lib/intro';

describe('Logo', () => {
  it('is one home link with a single accessible name and decorative brand images', () => {
    const { container } = render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'ShareOn – domov' });
    expect(link).toHaveAttribute('href', '/');
    expect(screen.queryAllByRole('img')).toHaveLength(0);

    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([INTRO_LOGO_SRC, '/brand/shareon-wordmark.png']);
    imgs.forEach((i) => expect(i).toHaveAttribute('alt', ''));
    expect(link).not.toHaveTextContent(/\S/);
  });
});
