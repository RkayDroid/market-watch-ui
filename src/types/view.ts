/** Top-level screens of the app, switched from the header menu. */
export type AppView = 'analysis' | 'watchlist';

export interface AppViewOption {
  id: AppView;
  /** Menu label. */
  label: string;
}

/** Menu order. */
export const APP_VIEWS: readonly AppViewOption[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'watchlist', label: 'Watchlist' },
];

/** Where the app opens: the symbol lookup, as it always has. */
export const DEFAULT_APP_VIEW: AppView = 'analysis';

export function isAppView(value: string): value is AppView {
  return APP_VIEWS.some((view) => view.id === value);
}

/**
 * What the app is showing. The comparison is a sub-view of Watchlist (reached from a card,
 * not the menu), so the menu keeps "Watchlist" selected while it is open.
 */
export type ViewState = { kind: 'analysis' } | { kind: 'watchlist' } | { kind: 'compare'; watchlistId: string };

/** The menu item that stands for a view state. */
export function menuViewOf(state: ViewState): AppView {
  return state.kind === 'compare' ? 'watchlist' : state.kind;
}
