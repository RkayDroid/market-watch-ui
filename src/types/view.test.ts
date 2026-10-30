import { describe, expect, it } from 'vitest';
import { APP_VIEWS, DEFAULT_APP_VIEW, isAppView, menuViewOf } from './view.ts';

describe('app views', () => {
  it('are Analysis then Watchlist, opening on Analysis', () => {
    expect(APP_VIEWS.map((v) => v.label)).toEqual(['Analysis', 'Watchlist']);
    expect(DEFAULT_APP_VIEW).toBe('analysis');
  });

  it('isAppView guards the ids', () => {
    expect(isAppView('watchlist')).toBe(true);
    expect(isAppView('landing')).toBe(false);
  });

  it('the comparison sits under the Watchlist menu item', () => {
    expect(menuViewOf({ kind: 'analysis' })).toBe('analysis');
    expect(menuViewOf({ kind: 'watchlist' })).toBe('watchlist');
    expect(menuViewOf({ kind: 'compare', watchlistId: 'x' })).toBe('watchlist');
  });
});
