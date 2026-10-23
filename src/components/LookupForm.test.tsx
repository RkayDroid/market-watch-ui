import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from '../types/stock.ts';
import LookupForm, { type LookupFormProps } from './LookupForm.tsx';

type HarnessProps = Partial<Pick<LookupFormProps, 'loading' | 'onSubmit'>> & { initialSymbol?: string };

/** Owns the controlled state the way App does. */
function Harness({ loading = false, onSubmit = vi.fn(), initialSymbol = '' }: HarnessProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [source, setSource] = useState<DataSource>('api');
  return (
    <LookupForm
      symbol={symbol}
      source={source}
      loading={loading}
      onSymbolChange={setSymbol}
      onSourceChange={setSource}
      onSubmit={onSubmit}
    />
  );
}

describe('LookupForm', () => {
  it('submits the symbol with the default (api) source', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'aapl');
    await userEvent.click(screen.getByRole('button', { name: /find/i }));

    expect(onSubmit).toHaveBeenCalledWith('aapl', 'api');
  });

  it('submits with the file source when selected', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByLabelText(/local flat file/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'META{enter}');

    expect(onSubmit).toHaveBeenCalledWith('META', 'file');
  });

  it('does not submit a blank symbol', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), '   {enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps input, button and source selector as direct siblings in one row', () => {
    render(<Harness />);
    const form = screen.getByTestId('lookup-form');
    const children = Array.from(form.children);
    expect(children).toHaveLength(3);
    expect(children[0]).toContainElement(screen.getByLabelText(/stock symbol/i));
    expect(children[1]).toBe(screen.getByRole('button', { name: /find/i }));
    expect(children[2]).toContainElement(screen.getByLabelText(/live api/i));
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
