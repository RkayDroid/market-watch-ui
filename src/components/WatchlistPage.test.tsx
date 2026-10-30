import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QUICK_SYMBOLS } from '../config/quickLinks.ts';
import type { Watchlist } from '../types/watchlist.ts';
import WatchlistPage from './WatchlistPage.tsx';

const list: Watchlist = { id: 'a', name: 'Alpha', symbols: ['AAPL'] };

describe('WatchlistPage', () => {
  it('is nothing but the watchlists section', () => {
    render(
      <WatchlistPage
        watchlists={[]}
        sourceCaption="Saved in this browser."
        onPickSymbol={vi.fn()}
        onCompare={vi.fn()}
        onCreateWatchlist={vi.fn()}
        onUpdateWatchlist={vi.fn()}
        onRemoveWatchlist={vi.fn()}
        suggestions={QUICK_SYMBOLS}
      />,
    );
    const main = screen.getByRole('main', { name: 'Watchlist' });
    expect(main.children).toHaveLength(1);
    expect(within(main).getByRole('region', { name: 'Watchlists' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('forwards symbol picks and offers the suggestions in the create dialog', async () => {
    const onPickSymbol = vi.fn();
    render(
      <WatchlistPage
        watchlists={[list]}
        sourceCaption="Saved in this browser."
        onPickSymbol={onPickSymbol}
        onCompare={vi.fn()}
        onCreateWatchlist={vi.fn()}
        onUpdateWatchlist={vi.fn()}
        onRemoveWatchlist={vi.fn()}
        suggestions={QUICK_SYMBOLS}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Look up AAPL from Alpha' }));
    expect(onPickSymbol).toHaveBeenCalledWith('AAPL');

    await userEvent.click(screen.getByRole('button', { name: 'Create watchlist' }));
    expect(within(screen.getByTestId('watchlist-suggestions')).getAllByRole('button')).toHaveLength(
      QUICK_SYMBOLS.length,
    );
  });
});
