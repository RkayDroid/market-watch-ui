import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Watchlist } from '../types/watchlist.ts';
import WatchlistsSection from './WatchlistsSection.tsx';

const lists: Watchlist[] = [
  { id: 'a', name: 'Alpha', symbols: ['AAPL'] },
  { id: 'b', name: 'Beta', symbols: ['GOOG', 'META'] },
];

const noop = {
  sourceCaption: 'Saved in this browser.',
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  onPickSymbol: vi.fn(),
  onCompare: vi.fn(),
};

describe('WatchlistsSection', () => {
  it('invites the user to create a first watchlist when there are none', async () => {
    render(<WatchlistsSection watchlists={[]} {...noop} />);
    const section = screen.getByRole('region', { name: 'Watchlists' });
    expect(section).toHaveTextContent('Create your first watchlist');
    expect(screen.queryByTestId('watchlist-grid')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('create-watchlist'));
    expect(screen.getByRole('dialog', { name: 'Create watchlist' })).toBeInTheDocument();
  });

  it('lists the watchlists in order with a Create button in the title row', async () => {
    render(<WatchlistsSection watchlists={lists} {...noop} />);
    const grid = screen.getByTestId('watchlist-grid');
    expect(
      within(grid)
        .getAllByRole('article')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Watchlist Alpha', 'Watchlist Beta']);
    await userEvent.click(screen.getByRole('button', { name: 'Create watchlist' }));
    expect(screen.getByRole('dialog', { name: 'Create watchlist' })).toBeInTheDocument();
  });

  it('creates through the dialog and forwards symbol clicks and removals', async () => {
    const onCreate = vi.fn(async () => lists[0]);
    const onRemove = vi.fn();
    const onPickSymbol = vi.fn();
    render(
      <WatchlistsSection
        watchlists={lists}
        sourceCaption="Saved in this browser."
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onRemove={onRemove}
        onPickSymbol={onPickSymbol}
        onCompare={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Look up META from Beta' }));
    expect(onPickSymbol).toHaveBeenCalledWith('META');

    await userEvent.click(screen.getByRole('button', { name: 'Delete watchlist Alpha' }));
    expect(onRemove).toHaveBeenCalledWith('a');

    await userEvent.click(screen.getByRole('button', { name: 'Create watchlist' }));
    await userEvent.type(screen.getByTestId('watchlist-name-input'), 'Gamma');
    await userEvent.type(screen.getByTestId('watchlist-symbols-input'), 'V');
    await userEvent.click(screen.getByTestId('save-watchlist'));
    expect(onCreate).toHaveBeenCalledWith({ name: 'Gamma', symbolsText: 'V' });
  });

  it('opens the edit dialog for the clicked list and saves through onUpdate', async () => {
    const onUpdate = vi.fn(async () => {});
    render(<WatchlistsSection watchlists={lists} {...noop} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Edit watchlist Beta' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit watchlist' });
    expect(within(dialog).getByTestId('edit-watchlist-name-input')).toHaveValue('Beta');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Move META up' }));
    await userEvent.click(within(dialog).getByTestId('save-watchlist-edit'));
    expect(onUpdate).toHaveBeenCalledWith('b', { name: 'Beta', symbols: ['META', 'GOOG'] });
  });

  it('shows the source caption, a loading indicator, and a load error', () => {
    const { rerender } = render(<WatchlistsSection watchlists={[]} {...noop} loading />);
    expect(screen.getByRole('region', { name: 'Watchlists' })).toHaveTextContent('Saved in this browser.');
    expect(screen.getByRole('status')).toHaveTextContent('Fetching watchlists');
    expect(screen.queryByTestId('create-watchlist')).not.toBeInTheDocument();

    rerender(
      <WatchlistsSection
        watchlists={[]}
        {...noop}
        sourceCaption="Saved on the server."
        error={{ title: 'Live API unreachable', message: 'Could not reach the watchlist API.' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Live API unreachable');
    expect(screen.getByRole('region', { name: 'Watchlists' })).toHaveTextContent('Saved on the server.');
    expect(screen.getByTestId('create-watchlist')).toBeInTheDocument();
  });
});
