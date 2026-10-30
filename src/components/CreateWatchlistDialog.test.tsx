import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QUICK_SYMBOLS } from '../config/quickLinks.ts';
import { LiveApiError } from '../data/providers/StockProvider.ts';
import { InvalidWatchlistError } from '../services/watchlistService.ts';
import type { Watchlist, WatchlistDraft } from '../types/watchlist.ts';
import CreateWatchlistDialog from './CreateWatchlistDialog.tsx';

const existing: Watchlist[] = [{ id: '1', name: 'Tech', symbols: ['AAPL'] }];

function renderDialog(overrides: Partial<React.ComponentProps<typeof CreateWatchlistDialog>> = {}) {
  const onCreate = vi.fn(
    async (draft: WatchlistDraft): Promise<Watchlist> => ({ id: 'new', name: draft.name.trim(), symbols: [] }),
  );
  const onClose = vi.fn();
  render(
    <CreateWatchlistDialog
      open
      onClose={onClose}
      onCreate={onCreate}
      existing={existing}
      suggestions={QUICK_SYMBOLS}
      {...overrides}
    />,
  );
  return { onCreate, onClose };
}

const nameBox = () => screen.getByTestId('watchlist-name-input');
const symbolsBox = () => screen.getByTestId('watchlist-symbols-input');
const save = () => screen.getByTestId('save-watchlist');

describe('CreateWatchlistDialog', () => {
  it('opens as a labelled dialog with Save disabled until the draft is valid', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Create watchlist' })).toBeInTheDocument();
    expect(nameBox()).toHaveFocus();
    expect(save()).toBeDisabled();
    expect(screen.queryByTestId('watchlist-preview')).not.toBeInTheDocument();
  });

  it('previews the parsed symbols as chips while typing and lets a chip remove one', async () => {
    renderDialog();
    await userEvent.type(symbolsBox(), 'aapl, goog goog');
    const preview = screen.getByTestId('watchlist-preview');
    expect(preview).toHaveTextContent('Will be saved as (2):');
    expect(
      within(preview)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['AAPL', 'GOOG']);

    const aaplChip = within(preview).getByRole('button', { name: 'AAPL' });
    await userEvent.click(within(aaplChip).getByTestId('CancelIcon'));
    expect(symbolsBox()).toHaveValue('GOOG');
  });

  it('toggles quick-add suggestions in and out of the text', async () => {
    renderDialog();
    const suggestions = screen.getByTestId('watchlist-suggestions');
    await userEvent.click(within(suggestions).getByRole('button', { name: 'TSLA' }));
    await userEvent.click(within(suggestions).getByRole('button', { name: 'NFLX' }));
    expect(symbolsBox()).toHaveValue('TSLA, NFLX');
    expect(within(suggestions).getByRole('button', { name: 'TSLA' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(suggestions).getByRole('button', { name: 'TSLA' }));
    expect(symbolsBox()).toHaveValue('NFLX');
    expect(within(suggestions).getByRole('button', { name: 'TSLA' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('flags an impossible symbol immediately, but "required" only after leaving the field', async () => {
    renderDialog();
    // The name box starts focused and empty: no nagging until it is left.
    expect(screen.queryByText('Give the watchlist a name.')).not.toBeInTheDocument();

    await userEvent.type(symbolsBox(), 'AAPL, bad!');
    expect(screen.getByText('Not a valid symbol: bad!.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
    // Moving into the symbols box left the name box, so its requirement now shows.
    expect(screen.getByText('Give the watchlist a name.')).toBeInTheDocument();

    // "Add at least one symbol" likewise waits: clear the box while still in it.
    await userEvent.clear(symbolsBox());
    expect(screen.queryByText('Add at least one symbol.')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText('Add at least one symbol.')).toBeInTheDocument();
  });

  it('refuses a duplicate name (case-insensitively)', async () => {
    renderDialog();
    await userEvent.type(nameBox(), 'tech');
    await userEvent.type(symbolsBox(), 'AAPL');
    await userEvent.tab();
    expect(screen.getByText('You already have a watchlist called "tech".')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('submits the draft and closes when valid', async () => {
    const { onCreate, onClose } = renderDialog();
    await userEvent.type(nameBox(), ' Growth ');
    await userEvent.type(symbolsBox(), 'nflx rblx');
    expect(save()).toBeEnabled();
    await userEvent.click(save());
    expect(onCreate).toHaveBeenCalledWith({ name: ' Growth ', symbolsText: 'nflx rblx' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('submits on Enter in the name box', async () => {
    const { onCreate } = renderDialog();
    await userEvent.type(symbolsBox(), 'V');
    await userEvent.type(nameBox(), 'Payments{enter}');
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows field errors raised by onCreate inline and stays open', async () => {
    const { onClose } = renderDialog({
      onCreate: async () => {
        throw new InvalidWatchlistError({ name: 'Name taken meanwhile.' });
      },
    });
    await userEvent.type(nameBox(), 'Growth');
    await userEvent.type(symbolsBox(), 'V');
    await userEvent.click(save());
    expect(await screen.findByText('Name taken meanwhile.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a storage failure as an alert, stays open, and lets the user retry', async () => {
    const onCreate = vi
      .fn<(draft: WatchlistDraft) => Promise<Watchlist>>()
      .mockRejectedValueOnce(new LiveApiError('unreachable', 'Could not reach the watchlist API.'))
      .mockResolvedValueOnce({ id: 'new', name: 'Growth', symbols: ['V'] });
    const { onClose } = renderDialog({ onCreate });
    await userEvent.type(nameBox(), 'Growth');
    await userEvent.type(symbolsBox(), 'V');
    await userEvent.click(save());

    const alert = await screen.findByTestId('watchlist-save-error');
    expect(alert).toHaveTextContent('Could not reach the watchlist API.');
    expect(onClose).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();

    await userEvent.click(save());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('freezes the form while the save is in flight', async () => {
    let release!: () => void;
    const onCreate = vi.fn(
      () => new Promise<Watchlist>((resolve) => (release = () => resolve({ id: 'n', name: 'G', symbols: ['V'] }))),
    );
    renderDialog({ onCreate });
    await userEvent.type(nameBox(), 'Growth');
    await userEvent.type(symbolsBox(), 'V');
    await userEvent.click(save());

    expect(save()).toBeDisabled();
    expect(save()).toHaveTextContent('Saving…');
    expect(nameBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => release());
  });

  it('cancels without creating', async () => {
    const { onCreate, onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
