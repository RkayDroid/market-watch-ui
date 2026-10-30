import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QUICK_SYMBOLS } from '../config/quickLinks.ts';
import { LiveApiError } from '../data/providers/StockProvider.ts';
import { InvalidWatchlistError } from '../services/watchlistService.ts';
import type { Watchlist } from '../types/watchlist.ts';
import EditWatchlistDialog from './EditWatchlistDialog.tsx';

const tech: Watchlist = { id: 't', name: 'Tech', symbols: ['AAPL', 'GOOG', 'META'] };
const other: Watchlist = { id: 'o', name: 'Other', symbols: ['V'] };

function renderDialog(overrides: Partial<React.ComponentProps<typeof EditWatchlistDialog>> = {}) {
  const onSave = vi.fn(async () => {});
  const onClose = vi.fn();
  render(
    <EditWatchlistDialog
      watchlist={tech}
      onClose={onClose}
      onSave={onSave}
      existing={[tech, other]}
      suggestions={QUICK_SYMBOLS}
      {...overrides}
    />,
  );
  return { onSave, onClose };
}

const nameBox = () => screen.getByTestId('edit-watchlist-name-input');
const save = () => screen.getByTestId('save-watchlist-edit');
const order = () =>
  within(screen.getByTestId('edit-watchlist-symbols'))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-testid')!.replace('edit-symbol-', ''));

describe('EditWatchlistDialog', () => {
  it('starts from the saved name and order, with Save disabled until something changes', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Edit watchlist' })).toBeInTheDocument();
    expect(nameBox()).toHaveValue('Tech');
    expect(nameBox()).toHaveFocus();
    expect(order()).toEqual(['AAPL', 'GOOG', 'META']);
    expect(save()).toBeDisabled();
  });

  it('disables "up" on the first row and "down" on the last', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Move AAPL up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move AAPL down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move META down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move META up' })).toBeEnabled();
  });

  it('reorders with the arrows and saves the new order', async () => {
    const { onSave, onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Move META up' }));
    expect(order()).toEqual(['AAPL', 'META', 'GOOG']);
    await userEvent.click(screen.getByRole('button', { name: 'Move AAPL down' }));
    expect(order()).toEqual(['META', 'AAPL', 'GOOG']);

    expect(save()).toBeEnabled();
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith('t', { name: 'Tech', symbols: ['META', 'AAPL', 'GOOG'] });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('removes a symbol with ×, but never the last one', async () => {
    const { onSave } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Remove GOOG' }));
    expect(order()).toEqual(['AAPL', 'META']);
    expect(save()).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove AAPL' }));
    expect(order()).toEqual(['META']);
    expect(screen.getByRole('button', { name: 'Remove META' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move META up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move META down' })).toBeDisabled();

    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith('t', { name: 'Tech', symbols: ['META'] });
  });

  it('adds typed symbols with Enter or the Add button, normalised and de-duplicated, at the end', async () => {
    const { onSave } = renderDialog();
    const addBox = screen.getByTestId('edit-watchlist-add-input');
    expect(screen.getByTestId('edit-watchlist-add')).toBeDisabled();

    await userEvent.type(addBox, 'nflx, aapl tsla{enter}');
    expect(order()).toEqual(['AAPL', 'GOOG', 'META', 'NFLX', 'TSLA']);
    expect(addBox).toHaveValue('');
    expect(onSave).not.toHaveBeenCalled(); // Enter in the add box must not submit the form

    await userEvent.type(addBox, 'v');
    await userEvent.click(screen.getByTestId('edit-watchlist-add'));
    expect(order()).toEqual(['AAPL', 'GOOG', 'META', 'NFLX', 'TSLA', 'V']);
    expect(screen.getByText(/Symbols \(6\/20\)/)).toBeInTheDocument();

    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith('t', { name: 'Tech', symbols: ['AAPL', 'GOOG', 'META', 'NFLX', 'TSLA', 'V'] });
  });

  it('refuses to add while the box holds an impossible token, and says which', async () => {
    renderDialog();
    const addBox = screen.getByTestId('edit-watchlist-add-input');
    await userEvent.type(addBox, 'nflx, bad!{enter}');
    expect(order()).toEqual(['AAPL', 'GOOG', 'META']);
    expect(screen.getByText('Not a valid symbol: bad!.')).toBeInTheDocument();
    expect(screen.getByTestId('edit-watchlist-add')).toBeDisabled();
    expect(addBox).toHaveValue('nflx, bad!');
  });

  it('offers quick-add chips only for symbols not yet in the list', async () => {
    renderDialog();
    const chips = () => within(screen.getByTestId('edit-watchlist-suggestions')).getAllByRole('button');
    expect(chips().map((c) => c.textContent)).toEqual(['NFLX', 'TSLA', 'RBLX', 'BRK.A']);

    await userEvent.click(screen.getByRole('button', { name: 'Add TSLA' }));
    expect(order()).toEqual(['AAPL', 'GOOG', 'META', 'TSLA']);
    expect(chips().map((c) => c.textContent)).toEqual(['NFLX', 'RBLX', 'BRK.A']);

    await userEvent.click(screen.getByRole('button', { name: 'Remove TSLA' }));
    expect(chips().map((c) => c.textContent)).toEqual(['NFLX', 'TSLA', 'RBLX', 'BRK.A']);
    expect(save()).toBeDisabled(); // back to the saved state
  });

  it('flags the symbol limit and disables Save', async () => {
    const seventeen = Array.from({ length: 17 }, (_, i) => `S${i}`).join(' ');
    renderDialog();
    await userEvent.type(screen.getByTestId('edit-watchlist-add-input'), `${seventeen} ZZ{enter}`);
    expect(screen.getByText(/at most 20 symbols \(you have 21\)/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('renames, trimming the name', async () => {
    const { onSave } = renderDialog();
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), ' Big tech {enter}');
    expect(onSave).toHaveBeenCalledWith('t', { name: ' Big tech ', symbols: ['AAPL', 'GOOG', 'META'] });
  });

  it('treats reverting to the saved state as "no change"', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Move GOOG down' }));
    expect(save()).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move GOOG up' }));
    expect(save()).toBeDisabled();
  });

  it("allows keeping its own name but refuses another list's", async () => {
    renderDialog();
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), 'tech');
    expect(screen.queryByText(/already have/)).not.toBeInTheDocument();

    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), 'other');
    await userEvent.tab();
    expect(screen.getByText('You already have a watchlist called "other".')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('requires a name once the field has been left', async () => {
    renderDialog();
    await userEvent.clear(nameBox());
    expect(screen.queryByText('Give the watchlist a name.')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText('Give the watchlist a name.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('shows field errors raised by onSave inline and stays open', async () => {
    const { onClose } = renderDialog({
      onSave: async () => {
        throw new InvalidWatchlistError({ name: 'This watchlist no longer exists.' });
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Move META up' }));
    await userEvent.click(save());
    expect(await screen.findByText('This watchlist no longer exists.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a storage failure as an alert and stays open', async () => {
    const { onClose } = renderDialog({
      onSave: async () => {
        throw new LiveApiError('http', 'The watchlist API responded with HTTP 500 for updating watchlist t.', {
          status: 500,
        });
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Move META up' }));
    await userEvent.click(save());
    expect(await screen.findByTestId('watchlist-save-error')).toHaveTextContent('HTTP 500');
    expect(onClose).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('cancels without saving and renders nothing when there is no list', async () => {
    const { onSave, onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();

    render(<EditWatchlistDialog watchlist={null} onClose={vi.fn()} onSave={vi.fn()} existing={[]} />);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
