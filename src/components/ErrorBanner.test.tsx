import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorBanner from './ErrorBanner.tsx';

describe('ErrorBanner', () => {
  it('renders title, message and hint as an alert', () => {
    render(<ErrorBanner error={{ title: 'Live API unreachable', message: 'Could not reach X.', hint: 'Check the URL.' }} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Live API unreachable');
    expect(alert).toHaveTextContent('Could not reach X.');
    expect(alert).toHaveTextContent('Check the URL.');
    expect(screen.queryByTestId('suggested-symbols')).not.toBeInTheDocument();
  });

  it('renders clickable suggested symbols', async () => {
    const onPick = vi.fn();
    render(
      <ErrorBanner
        error={{ title: 'Symbol not found', message: 'm', suggestedSymbols: ['AAPL', 'V'] }}
        onPickSymbol={onPick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'V' }));
    expect(onPick).toHaveBeenCalledWith('V');
  });

  it('renders suggestions as plain chips when no handler is given', () => {
    render(<ErrorBanner error={{ title: 't', message: 'm', suggestedSymbols: ['AAPL'] }} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
