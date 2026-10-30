import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LookupForm, { type LookupFormProps } from './LookupForm.tsx';

type HarnessProps = Partial<Pick<LookupFormProps, 'loading' | 'onSubmit'>> & { initialSymbol?: string };

/** Owns the controlled state the way App does. */
function Harness({ loading = false, onSubmit = vi.fn(), initialSymbol = '' }: HarnessProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  return <LookupForm symbol={symbol} loading={loading} onSymbolChange={setSymbol} onSubmit={onSubmit} />;
}

describe('LookupForm', () => {
  it('submits the typed symbol on click', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'aapl');
    await userEvent.click(screen.getByRole('button', { name: /find/i }));

    expect(onSubmit).toHaveBeenCalledWith('aapl');
  });

  it('submits on Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'META{enter}');

    expect(onSubmit).toHaveBeenCalledWith('META');
  });

  it('does not submit a blank symbol', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), '   {enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is just the input and the button, side by side (the data source is chosen in the header)', () => {
    render(<Harness />);
    const form = screen.getByTestId('lookup-form');
    const children = Array.from(form.children);
    expect(children).toHaveLength(2);
    expect(children[0]).toContainElement(screen.getByLabelText(/stock symbol/i));
    expect(children[1]).toBe(screen.getByRole('button', { name: /find/i }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('keeps Find disabled until a non-blank symbol is typed', async () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: /find/i });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/stock symbol/i), '   ');
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'V');
    expect(button).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(/stock symbol/i));
    expect(button).toBeDisabled();
  });

  it('reflects an externally supplied symbol', () => {
    render(<Harness initialSymbol="GOOG" />);
    expect(screen.getByLabelText(/stock symbol/i)).toHaveValue('GOOG');
    expect(screen.getByRole('button', { name: /find/i })).toBeEnabled();
  });

  it('disables the submit button while loading', () => {
    render(<Harness loading initialSymbol="V" />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
