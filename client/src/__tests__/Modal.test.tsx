import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal, MODAL_EXIT_MS } from '../components/Modal';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Otvoriť</button>
      {open && (
        <Modal label="Test okno" onClose={() => setOpen(false)}>
          {(close) => (
            <>
              <input aria-label="Pole" />
              <button onClick={close}>Zavrieť</button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('focuses inside, closes with Escape after the exit animation and restores focus', () => {
    render(<Harness />);
    const opener = screen.getByText('Otvoriť');
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Test okno' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pole')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    // While closing it no longer blocks clicks …
    expect(screen.getByTestId('modal-backdrop')).toHaveClass('modal-closing');
    act(() => vi.advanceTimersByTime(MODAL_EXIT_MS));
    // … and afterwards it is removed from the DOM completely.
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on backdrop click but not on clicks inside the panel; traps Tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Otvoriť'));
    fireEvent.click(screen.getByLabelText('Pole'));
    expect(screen.getByTestId('modal-backdrop')).not.toHaveClass('modal-closing');

    const closeBtn = screen.getByText('Zavrieť');
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Pole')).toHaveFocus();

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    act(() => vi.advanceTimersByTime(MODAL_EXIT_MS));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
