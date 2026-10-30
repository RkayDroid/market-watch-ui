import { Box } from '@mui/material';
import type { QuickSymbol } from '../config/quickLinks.ts';
import type { LookupError } from '../errors/lookupError.ts';
import type { Watchlist, WatchlistDraft, WatchlistEdit } from '../types/watchlist.ts';
import WatchlistsSection from './WatchlistsSection.tsx';

export interface WatchlistPageProps {
  watchlists: readonly Watchlist[];
  loading?: boolean;
  error?: LookupError | null;
  /** Where the lists live, e.g. "Saved in this browser." */
  sourceCaption: string;
  /** Looks a symbol up (switches to the Analysis view). */
  onPickSymbol: (symbol: string) => void;
  /** Opens the comparison view of a list. */
  onCompare: (id: string) => void;
  onCreateWatchlist: (draft: WatchlistDraft) => Promise<Watchlist>;
  onUpdateWatchlist: (id: string, edit: WatchlistEdit) => Promise<void>;
  onRemoveWatchlist: (id: string) => void;
  /** Symbols offered as "quick add" toggles in the create dialog. */
  suggestions: readonly QuickSymbol[];
}

/** The Watchlist view: nothing but the user's watchlists and the way to create one. */
export default function WatchlistPage({
  watchlists,
  loading,
  error,
  sourceCaption,
  onPickSymbol,
  onCompare,
  onCreateWatchlist,
  onUpdateWatchlist,
  onRemoveWatchlist,
  suggestions,
}: WatchlistPageProps) {
  return (
    <Box component="main" aria-label="Watchlist" data-testid="watchlist-page">
      <WatchlistsSection
        watchlists={watchlists}
        loading={loading}
        error={error}
        sourceCaption={sourceCaption}
        onCreate={onCreateWatchlist}
        onUpdate={onUpdateWatchlist}
        onRemove={onRemoveWatchlist}
        onPickSymbol={onPickSymbol}
        onCompare={onCompare}
        suggestions={suggestions}
      />
    </Box>
  );
}
