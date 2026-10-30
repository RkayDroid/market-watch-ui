import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Watchlist } from '../types/watchlist.ts';
import WatchlistCard from './WatchlistCard.tsx';

const list: Watchlist = { id: 'w1', name: 'Big tech', symbols: ['AAPL', 'GOOG'] };

describe('WatchlistCard', () => {
  it('shows the name, a count and a chip per symbol', () => {
    render(
      <WatchlistCard watchlist={list} onPickSymbol={vi.fn()} onCompare={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />,
    );
    const card = screen.getByRole('article', { name: 'Watchlist Big tech' });
    expect(within(card).getByTestId('watchlist-name')).toHaveTextContent('Big tech');
    expect(card).toHaveTextContent('2 symbols');
    expect(
      within(screen.getByTestId('watchlist-symbols'))
        .getAllByRole('button')
        .map((c) => c.textContent),
    ).toEqual(['AAPL', 'GOOG']);
  });

  it('uses the singular for one symbol', () => {
    render(
      <WatchlistCard
        watchlist={{ ...list, symbols: ['V'] }}
        onPickSymbol={vi.fn()}
        onCompare={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('article')).toHaveTextContent('1 symbol');
  });

  it('reports symbol clicks, comparing, editing and deletion', async () => {
    const onPickSymbol = vi.fn();
    const onCompare = vi.fn();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <WatchlistCard
        watchlist={list}
        onPickSymbol={onPickSymbol}
        onCompare={onCompare}
        onEdit={onEdit}
        onRemove={onRemove}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Look up GOOG from Big tech' }));
    expect(onPickSymbol).toHaveBeenCalledWith('GOOG');

    await userEvent.click(screen.getByRole('button', { name: 'Compare Big tech' }));
    expect(onCompare).toHaveBeenCalledWith('w1');

    await userEvent.click(screen.getByRole('button', { name: 'Edit watchlist Big tech' }));
    expect(onEdit).toHaveBeenCalledWith('w1');

    await userEvent.click(screen.getByRole('button', { name: 'Delete watchlist Big tech' }));
    expect(onRemove).toHaveBeenCalledWith('w1');
  });

  it('disables its controls while busy', () => {
    render(
      <WatchlistCard
        watchlist={list}
        onPickSymbol={vi.fn()}
        onCompare={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: /delete watchlist/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /edit watchlist/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /compare/i })).toBeDisabled();
    for (const chip of within(screen.getByTestId('watchlist-symbols')).getAllByRole('button')) {
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('orders the actions compare, edit, delete', () => {
    render(
      <WatchlistCard watchlist={list} onPickSymbol={vi.fn()} onCompare={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />,
    );
    const actions = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((label) => label && !label.startsWith('Look up'));
    expect(actions).toEqual(['Compare Big tech', 'Edit watchlist Big tech', 'Delete watchlist Big tech']);
  });
});
