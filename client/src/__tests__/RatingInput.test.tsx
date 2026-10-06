import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RatingInput } from '../components/Rating';

describe('RatingInput', () => {
  it('is keyboard/screen-reader accessible and reports the selected value', async () => {
    const onChange = vi.fn();
    render(<RatingInput name="x" label="Komunikácia" value={0} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('4 – Dobré'));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
