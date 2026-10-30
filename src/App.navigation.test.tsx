import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App, { type WatchlistProviderRegistry } from './App.tsx';
import { createLiveApiStockProvider, type HttpClient } from './data/providers/LiveApiStockProvider.ts';
import { createLiveApiWatchlistProvider } from './data/providers/LiveApiWatchlistProvider.ts';
import { createLocalStockProvider, type JsonLoader } from './data/providers/LocalStockProvider.ts';
import { createLocalWatchlistProvider } from './data/providers/LocalWatchlistProvider.ts';
import { createMemoryWatchlistStore } from './data/watchlistStore.ts';
import { createStockService } from './services/stockService.ts';
import { createFakeWatchlistApi, type FakeWatchlistRecord } from './test/fakeWatchlistApi.ts';
import type { Watchlist } from './types/watchlist.ts';

/** The offline fixtures, bundled instead of fetched (same approach as App.test.tsx). */
const FIXTURES = import.meta.glob<unknown>('../public/data/*.json', { eager: true, import: 'default' });
const loadLocalJson: JsonLoader = async (path) => FIXTURES[`../public/${path}`] ?? null;

const liveRequests: string[] = [];
const fakeHttp: HttpClient = {
  get: async (url) => {
    liveRequests.push(url);
    const m = /\/stock\/([A-Z.]+)$/.exec(url);
    const data = m ? (FIXTURES[`../public/data/detail-${m[1]}.json`] ?? null) : null;
    if (data) return { data };
    throw new AxiosError('not found', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
  },
};

const service = createStockService(
  {
    local: createLocalStockProvider(loadLocalJson),
    api: createLiveApiStockProvider({ baseUrl: 'https://api.test/v1', timeoutMs: 100 }, { client: fakeHttp }),
  },
  { formatLabel: (d) => d },
);

const seed: Watchlist = { id: 'seed', name: 'Seed list', symbols: ['GOOG', 'NFLX'] };
let ids = 0;
const newId = () => `wl-${++ids}`;

interface Setup {
  /** Offline watchlists (this browser). */
  local?: Watchlist[];
  /** Online watchlists already on the server, keyed by id. */
  server?: Record<string, FakeWatchlistRecord>;
  /** Hook to break the fake API before the app first talks to it. */
  prepare?: (api: ReturnType<typeof createFakeWatchlistApi>) => void;
}

function renderApp({ local = [], server = {}, prepare }: Setup = {}) {
  const store = createMemoryWatchlistStore(local);
  const api = createFakeWatchlistApi(server);
  prepare?.(api);
  const watchlistProviders: WatchlistProviderRegistry = {
    local: createLocalWatchlistProvider(store, { newId }),
    api: createLiveApiWatchlistProvider(
      { baseUrl: 'https://api.test/v1', timeoutMs: 100, userId: 'alice' },
      { client: api.client },
    ),
  };
  render(<App service={service} lookupOptions={{ minLoadingMs: 0 }} watchlistProviders={watchlistProviders} />);
  return { store, api };
}

const navTo = (label: 'Analysis' | 'Watchlist') =>
  userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: label }));

const offlineToggle = () => screen.getByRole('switch', { name: /offline mode/i });

beforeEach(() => {
  liveRequests.length = 0;
});

async function goOffline() {
  if (!(offlineToggle() as HTMLInputElement).checked) await userEvent.click(offlineToggle());
}

/** Waits for the Watchlist view to finish loading. */
const watchlistsLoaded = () => waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

describe('App — header: views and the offline toggle', () => {
  it('opens on Analysis (the lookup form), online, with the menu and the toggle in the header', () => {
    renderApp();
    expect(screen.getByRole('main', { name: 'Analysis' })).toContainElement(screen.getByTestId('lookup-form'));
    expect(screen.queryByRole('main', { name: 'Watchlist' })).not.toBeInTheDocument();

    const header = screen.getByTestId('app-header');
    const nav = within(header).getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Analysis', 'Watchlist']);
    expect(within(nav).getByRole('button', { name: 'Analysis' })).toHaveAttribute('aria-current', 'page');
    expect(within(header).getByRole('switch', { name: /offline mode/i })).not.toBeChecked();

    // The source is no longer chosen on the lookup form.
    expect(within(screen.getByTestId('lookup-form')).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('the toggle drives stock lookups: offline uses the fixtures, online the live API', async () => {
    renderApp();
    await goOffline();
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'AAPL{enter}');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('AAPL');
    expect(liveRequests).toHaveLength(0);

    await userEvent.click(offlineToggle());
    await userEvent.clear(screen.getByLabelText(/stock symbol/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'META{enter}');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(liveRequests).toContain('https://api.test/v1/stock/META');
  });

  it('the Watchlist view shows only the watchlists — no lookup form, no results', async () => {
    renderApp({ local: [seed] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();

    const main = screen.getByRole('main', { name: 'Watchlist' });
    expect(within(main).getByRole('article', { name: 'Watchlist Seed list' })).toBeInTheDocument();
    expect(main).toHaveTextContent('Saved in this browser (offline mode).');
    expect(screen.queryByTestId('lookup-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-tiles')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watchlist' })).toHaveAttribute('aria-current', 'page');

    await navTo('Analysis');
    expect(screen.getByTestId('lookup-form')).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: 'Watchlist' })).not.toBeInTheDocument();
  });

  it('keeps lookup results while visiting the Watchlist view and back', async () => {
    renderApp();
    await goOffline();
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'AAPL{enter}');
    await screen.findByTestId('summary-symbol');

    await navTo('Watchlist');
    expect(screen.queryByTestId('summary-symbol')).not.toBeInTheDocument();
    await navTo('Analysis');
    expect(screen.getByTestId('summary-symbol')).toHaveTextContent('AAPL');
    expect(screen.getByLabelText(/stock symbol/i)).toHaveValue('AAPL');
  });

  it('clicking a watchlist symbol switches to Analysis and looks it up with the app-wide source', async () => {
    renderApp({ local: [seed] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Look up NFLX from Seed list' }));

    expect(screen.getByRole('main', { name: 'Analysis' })).toBeInTheDocument();
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('NFLX');
    expect(screen.getByLabelText(/stock symbol/i)).toHaveValue('NFLX');
    expect(offlineToggle()).toBeChecked();
    expect(liveRequests).toHaveLength(0);
  });

  it('switching the toggle on the Watchlist view reloads the lists from the other source', async () => {
    renderApp({ local: [seed], server: { k1: { name: 'Server list', symbols: ['AAPL'] } } });
    await navTo('Watchlist');
    await watchlistsLoaded();
    expect(screen.getByRole('article', { name: 'Watchlist Server list' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Watchlist' })).toHaveTextContent('Saved on the server.');

    await userEvent.click(offlineToggle());
    await watchlistsLoaded();
    expect(screen.getByRole('article', { name: 'Watchlist Seed list' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Watchlist Server list' })).not.toBeInTheDocument();
  });
});

describe('App — watchlists offline (this browser)', () => {
  it('invites a first watchlist, creates one through the dialog, shows it newest first and persists it', async () => {
    const { store } = renderApp();
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    expect(screen.getByText('Create your first watchlist')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('create-watchlist'));
    const dialog = screen.getByRole('dialog', { name: 'Create watchlist' });
    await userEvent.type(within(dialog).getByTestId('watchlist-name-input'), 'Big tech');
    await userEvent.type(within(dialog).getByTestId('watchlist-symbols-input'), 'aapl, meta');
    await userEvent.click(
      within(within(dialog).getByTestId('watchlist-suggestions')).getByRole('button', { name: 'TSLA' }),
    );
    await userEvent.click(within(dialog).getByTestId('save-watchlist'));
    await waitForElementToBeRemoved(dialog);

    const grid = screen.getByTestId('watchlist-grid');
    expect(
      within(grid)
        .getAllByRole('article')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Watchlist Big tech']);
    expect(store.load()).toEqual([
      { id: expect.stringMatching(/^wl-\d+$/), name: 'Big tech', symbols: ['AAPL', 'META', 'TSLA'] },
    ]);
  });

  it('deletes a watchlist through the store', async () => {
    const { store } = renderApp({ local: [seed] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Delete watchlist Seed list' }));
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
    expect(screen.getByText('Create your first watchlist')).toBeInTheDocument();
    expect(store.load()).toEqual([]);
  });

  it('renames, reorders, removes and adds through the edit dialog and persists it', async () => {
    const { store } = renderApp({ local: [{ ...seed, symbols: ['GOOG', 'NFLX', 'TSLA'] }] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Edit watchlist Seed list' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit watchlist' });
    const name = within(dialog).getByTestId('edit-watchlist-name-input');
    await userEvent.clear(name);
    await userEvent.type(name, 'Streaming first');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move NFLX up' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove TSLA' }));
    await userEvent.type(within(dialog).getByTestId('edit-watchlist-add-input'), 'rblx{enter}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add BRK.A' }));
    await userEvent.click(within(dialog).getByTestId('save-watchlist-edit'));
    await waitForElementToBeRemoved(dialog);

    const card = screen.getByRole('article', { name: 'Watchlist Streaming first' });
    expect(
      within(within(card).getByTestId('watchlist-symbols'))
        .getAllByRole('button')
        .map((c) => c.textContent),
    ).toEqual(['NFLX', 'GOOG', 'RBLX', 'BRK.A']);
    expect(store.load()).toEqual([{ ...seed, name: 'Streaming first', symbols: ['NFLX', 'GOOG', 'RBLX', 'BRK.A'] }]);
  });
});

describe('App — watchlists online (watchlist API)', () => {
  it('loads the lists with GET /user/{userId}/watchlists, then GET /watchlist/{id} for each', async () => {
    const { api } = renderApp({
      server: { k1: { name: 'One', symbols: ['AAPL'] }, k2: { name: 'Two', symbols: ['NOPE'] } },
    });
    await navTo('Watchlist');
    await watchlistsLoaded();
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Watchlist One',
      'Watchlist Two',
    ]);
    expect(api.calls).toEqual([
      'GET https://api.test/v1/user/alice/watchlists',
      'GET https://api.test/v1/watchlist/k1',
      'GET https://api.test/v1/watchlist/k2',
    ]);
  });

  it('creates with POST /watchlist and shows the list under the server id', async () => {
    const { api } = renderApp();
    await navTo('Watchlist');
    await watchlistsLoaded();

    await userEvent.click(screen.getByTestId('create-watchlist'));
    const dialog = screen.getByRole('dialog', { name: 'Create watchlist' });
    await userEvent.type(within(dialog).getByTestId('watchlist-name-input'), 'Tech');
    await userEvent.type(within(dialog).getByTestId('watchlist-symbols-input'), 'aapl, msft');
    await userEvent.click(within(dialog).getByTestId('save-watchlist'));
    await waitForElementToBeRemoved(dialog);

    expect(api.calls.at(-1)).toBe(
      'POST https://api.test/v1/watchlist {"userId":"alice","watchListName":"Tech","symbols":["AAPL","MSFT"]}',
    );
    expect(api.db['srv-1']).toEqual({ name: 'Tech', symbols: ['AAPL', 'MSFT'] });
    expect(screen.getByTestId('watchlist-srv-1')).toHaveTextContent('Tech');
  });

  it('edits with PUT /watchlist and deletes with DELETE /watchlist/{id}', async () => {
    const { api } = renderApp({ server: { k1: { name: 'One', symbols: ['AAPL', 'NOPE'] } } });
    await navTo('Watchlist');
    await watchlistsLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Edit watchlist One' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit watchlist' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move NOPE up' }));
    await userEvent.click(within(dialog).getByTestId('save-watchlist-edit'));
    await waitForElementToBeRemoved(dialog);
    expect(api.calls.at(-1)).toBe(
      'PUT https://api.test/v1/watchlist {"watchListId":"k1","watchListName":"One","symbols":["NOPE","AAPL"]}',
    );
    expect(
      within(within(screen.getByTestId('watchlist-k1')).getByTestId('watchlist-symbols'))
        .getAllByRole('button')
        .map((c) => c.textContent),
    ).toEqual(['NOPE', 'AAPL']);

    await userEvent.click(screen.getByRole('button', { name: 'Delete watchlist One' }));
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
    expect(api.calls.at(-1)).toBe('DELETE https://api.test/v1/watchlist/k1');
    expect(api.db.k1).toBeUndefined();
  });

  it('keeps the dialog open with the API error when a save fails', async () => {
    const { api } = renderApp();
    api.client.post = async () => {
      throw new AxiosError('down', undefined, undefined, undefined, { status: 503 } as AxiosResponse);
    };
    await navTo('Watchlist');
    await watchlistsLoaded();

    await userEvent.click(screen.getByTestId('create-watchlist'));
    const dialog = screen.getByRole('dialog', { name: 'Create watchlist' });
    await userEvent.type(within(dialog).getByTestId('watchlist-name-input'), 'Tech');
    await userEvent.type(within(dialog).getByTestId('watchlist-symbols-input'), 'aapl');
    await userEvent.click(within(dialog).getByTestId('save-watchlist'));

    expect(await within(dialog).findByTestId('watchlist-save-error')).toHaveTextContent('HTTP 503');
    expect(screen.getByRole('dialog', { name: 'Create watchlist' })).toBeInTheDocument();
  });

  it('reports an unreachable API on the Watchlist view instead of an empty list', async () => {
    renderApp({
      server: { k1: { name: 'One', symbols: ['AAPL'] } },
      prepare: (api) => {
        api.client.get = async () => {
          throw Object.assign(new AxiosError('refused'), { code: 'ECONNREFUSED' });
        };
      },
    });
    await navTo('Watchlist');
    await watchlistsLoaded();
    expect(screen.getByRole('alert')).toHaveTextContent('Live API unreachable');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('App — compare view', () => {
  it('opens from a card, keeps Watchlist selected in the menu, compares with the app-wide source, and goes back', async () => {
    renderApp({ local: [{ id: 'w1', name: 'Big tech', symbols: ['AAPL', 'GOOG', 'MSFT'] }] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Compare Big tech' }));
    const main = screen.getByRole('main', { name: 'Compare Big tech' });
    expect(screen.queryByRole('main', { name: 'Watchlist' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watchlist' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(within(main).getByRole('radio', { name: 'Week' }));
    await userEvent.click(within(main).getByRole('button', { name: 'Compare' }));

    const grid = await screen.findByTestId('compare-grid');
    const cards = within(grid).getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Comparison for AAPL',
      'Comparison for GOOG',
      'Comparison for MSFT',
    ]);
    // Offline fixtures: AAPL and GOOG resolve; MSFT has no fixture and says so in its own card.
    expect(within(cards[0]).getByTestId('summary-high')).toHaveTextContent('$351.73');
    expect(within(cards[0]).getByTestId('price-chart-panel')).toHaveTextContent('Price Trend — Past Week');
    expect(within(cards[0]).getByTestId('summary-tiles')).toBeInTheDocument();
    expect(cards[0]).toHaveTextContent('Apple');
    expect(within(cards[1]).getByTestId('summary-price')).toBeInTheDocument();
    expect(within(cards[2]).getByRole('alert')).toHaveTextContent('Symbol not found');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(liveRequests).toHaveLength(0);

    await userEvent.click(screen.getByTestId('compare-back'));
    expect(screen.getByRole('main', { name: 'Watchlist' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Watchlist Big tech' })).toBeInTheDocument();
  });

  it('the menu items still work from the compare view', async () => {
    renderApp({ local: [{ id: 'w1', name: 'Big tech', symbols: ['AAPL'] }] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Compare Big tech' }));

    await navTo('Analysis');
    expect(screen.getByRole('main', { name: 'Analysis' })).toBeInTheDocument();
    await navTo('Watchlist');
    expect(screen.getByRole('main', { name: 'Watchlist' })).toBeInTheDocument();
  });

  it('falls back to the watchlists when the compared list is not in the other source', async () => {
    renderApp({ local: [{ id: 'w1', name: 'Big tech', symbols: ['AAPL'] }] });
    await goOffline();
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Compare Big tech' }));
    expect(screen.getByRole('main', { name: 'Compare Big tech' })).toBeInTheDocument();

    await userEvent.click(offlineToggle()); // online: the server has no such list
    await watchlistsLoaded();
    expect(screen.queryByRole('main', { name: /compare/i })).not.toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Watchlist' })).toBeInTheDocument();
  });

  it('compares with whatever the Offline mode switch says at the time, even for a list that lives online', async () => {
    // The same list exists in both sources, so switching keeps the compare view open.
    renderApp({
      local: [{ id: 'k1', name: 'Both', symbols: ['AAPL'] }],
      server: { k1: { name: 'Both', symbols: ['AAPL'] } },
    });
    await navTo('Watchlist');
    await watchlistsLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Compare Both' }));

    // Online: the live stock API serves /stock and /historic.
    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await screen.findByTestId('compare-grid');
    expect(liveRequests).toContain('https://api.test/v1/stock/AAPL/historic?period=WEEK');

    // Offline: the results vanish with the switch, and a new Compare is served by the fixtures only.
    await userEvent.click(offlineToggle());
    await watchlistsLoaded();
    expect(screen.getByRole('main', { name: 'Compare Both' })).toBeInTheDocument();
    expect(screen.queryByTestId('compare-grid')).not.toBeInTheDocument();
    liveRequests.length = 0;
    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await screen.findByTestId('compare-grid');
    expect(liveRequests).toEqual([]);
    expect(within(screen.getByTestId('compare-AAPL')).getByTestId('summary-high')).toHaveTextContent('$351.73');
  });
});
