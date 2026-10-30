import { useCallback, useEffect, useRef, useState } from 'react';
import type { WatchlistProvider } from '../data/providers/WatchlistProvider.ts';
import { toLookupError, type LookupError } from '../errors/lookupError.ts';
import {
  addWatchlist,
  prepareNewWatchlist,
  prepareWatchlistEdit,
  removeWatchlist,
  replaceWatchlist,
} from '../services/watchlistService.ts';
import type { Watchlist, WatchlistDraft, WatchlistEdit } from '../types/watchlist.ts';

export interface WatchlistsState {
  /** Newest first. */
  watchlists: Watchlist[];
  /** True while the collection is being (re)loaded from the provider. */
  loading: boolean;
  /** Why the last load or delete failed, if it did. */
  error: LookupError | null;
}

export interface UseWatchlistsResult extends WatchlistsState {
  /** Reloads the collection from the provider. */
  reload: () => Promise<void>;
  /**
   * Validates the draft and stores it through the provider. Rejects with
   * {@link InvalidWatchlistError} for a bad draft, or the provider's error.
   */
  create: (draft: WatchlistDraft) => Promise<Watchlist>;
  /** Validates and stores an edit (rename / add / remove / reorder); rejects like `create`. */
  update: (id: string, edit: WatchlistEdit) => Promise<void>;
  /** Deletes through the provider; a failure is reported in `error`. */
  remove: (id: string) => Promise<void>;
}

export interface UseWatchlistsOptions {
  /**
   * Whether the collection is wanted at all (e.g. only while the Watchlist view is shown).
   * Nothing is requested until it is; once loaded, the lists stay while it is off again.
   */
  enabled?: boolean;
}

/**
 * Owns the in-memory watchlist collection for the current {@link WatchlistProvider}: loads it
 * when first enabled and whenever the provider changes (e.g. the offline toggle), and writes
 * every change through before reflecting it in state. Only the most recent load may update
 * state, so a provider switch mid-flight cannot show the other source's lists.
 */
export function useWatchlists(
  provider: WatchlistProvider,
  { enabled = true }: UseWatchlistsOptions = {},
): UseWatchlistsResult {
  const [state, setState] = useState<WatchlistsState>({ watchlists: [], loading: enabled, error: null });
  const loadId = useRef(0);
  const mounted = useRef(true);
  /** Provider whose collection is loaded (or loading), so enabling again does not refetch. */
  const loadedFor = useRef<WatchlistProvider | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++loadId.current;
    const isCurrent = () => mounted.current && id === loadId.current;
    setState({ watchlists: [], loading: true, error: null });
    try {
      const watchlists = await provider.list();
      if (isCurrent()) setState({ watchlists, loading: false, error: null });
    } catch (err) {
      if (isCurrent()) setState({ watchlists: [], loading: false, error: toLookupError(err) });
    }
  }, [provider]);

  useEffect(() => {
    if (!enabled || loadedFor.current === provider) return;
    loadedFor.current = provider;
    void reload();
  }, [enabled, provider, reload]);

  const create = useCallback(
    async (draft: WatchlistDraft) => {
      const list = prepareNewWatchlist(draft, state.watchlists);
      const created = await provider.create(list);
      if (mounted.current) setState((prev) => ({ ...prev, watchlists: addWatchlist(prev.watchlists, created) }));
      return created;
    },
    [provider, state.watchlists],
  );

  const update = useCallback(
    async (id: string, edit: WatchlistEdit) => {
      const list = state.watchlists.find((l) => l.id === id);
      if (!list) throw new Error('This watchlist no longer exists.');
      const prepared = prepareWatchlistEdit(list, edit, state.watchlists);
      await provider.update(id, prepared);
      if (mounted.current) {
        setState((prev) => ({ ...prev, watchlists: replaceWatchlist(prev.watchlists, id, prepared) }));
      }
    },
    [provider, state.watchlists],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await provider.remove(id);
        if (mounted.current)
          setState((prev) => ({ ...prev, error: null, watchlists: removeWatchlist(prev.watchlists, id) }));
      } catch (err) {
        if (mounted.current) setState((prev) => ({ ...prev, error: toLookupError(err) }));
      }
    },
    [provider],
  );

  return { ...state, reload, create, update, remove };
}
