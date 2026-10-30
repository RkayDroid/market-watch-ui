import { useState } from 'react';
import { Box, Button, ButtonBase, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import type { QuickSymbol } from '../config/quickLinks.ts';
import type { LookupError } from '../errors/lookupError.ts';
import type { Watchlist, WatchlistDraft, WatchlistEdit } from '../types/watchlist.ts';
import CreateWatchlistDialog from './CreateWatchlistDialog.tsx';
import EditWatchlistDialog from './EditWatchlistDialog.tsx';
import ErrorBanner from './ErrorBanner.tsx';
import LoadingIndicator from './LoadingIndicator.tsx';
import SectionTitle from './SectionTitle.tsx';
import WatchlistCard from './WatchlistCard.tsx';

export interface WatchlistsSectionProps {
  watchlists: readonly Watchlist[];
  /** True while the collection is being loaded from its source. */
  loading?: boolean;
  /** Why loading or deleting failed, if it did. */
  error?: LookupError | null;
  /** Where the lists live, e.g. "Saved in this browser." — shown under the title. */
  sourceCaption: string;
  onCreate: (draft: WatchlistDraft) => Promise<Watchlist>;
  onUpdate: (id: string, edit: WatchlistEdit) => Promise<void>;
  onRemove: (id: string) => void;
  onPickSymbol: (symbol: string) => void;
  /** Opens the comparison view of a list. */
  onCompare: (id: string) => void;
  /** Symbols offered in the create dialog's "quick add" row. */
  suggestions?: readonly QuickSymbol[];
  disabled?: boolean;
}

/** Minimum card width; the grid fits as many per row as the viewport allows. */
export const WATCHLIST_CARD_MIN_WIDTH = 240;

/**
 * The user's watchlists as quick links, plus the entry points for creating and editing one. With no
 * lists yet, the grid is replaced by a single inviting "create" tile.
 */
export default function WatchlistsSection({
  watchlists,
  loading = false,
  error = null,
  sourceCaption,
  onCreate,
  onUpdate,
  onRemove,
  onPickSymbol,
  onCompare,
  suggestions,
  disabled = false,
}: WatchlistsSectionProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === null ? null : (watchlists.find((list) => list.id === editingId) ?? null);

  return (
    <Box component="section" aria-labelledby="watchlists-title" data-testid="watchlists">
      <SectionTitle
        id="watchlists-title"
        icon={<BookmarksOutlinedIcon fontSize="small" color="secondary" />}
        action={
          watchlists.length > 0 ? (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={() => setCreating(true)}
              disabled={disabled}
              data-testid="create-watchlist"
            >
              Create watchlist
            </Button>
          ) : undefined
        }
      >
        Watchlists
      </SectionTitle>
      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
        {sourceCaption} Click a symbol to look it up.
      </Typography>

      {error && <ErrorBanner error={error} />}

      {loading ? (
        <LoadingIndicator subject="watchlists" caption="Retrieving your watchlists" py={3} />
      ) : watchlists.length === 0 ? (
        <Paper
          component={ButtonBase}
          onClick={() => setCreating(true)}
          disabled={disabled}
          data-testid="create-watchlist"
          sx={{
            width: '100%',
            px: 2,
            py: 2.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            borderStyle: 'dashed',
            '&:hover, &:focus-visible': { borderColor: 'secondary.main', bgcolor: 'secondary.main' + '0a' },
          }}
        >
          <AddIcon color="secondary" />
          <Typography variant="subtitle1">Create your first watchlist</Typography>
          <Typography variant="caption" color="textSecondary">
            Group the symbols you follow so they are one click away.
          </Typography>
        </Paper>
      ) : (
        <Box
          data-testid="watchlist-grid"
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: `repeat(auto-fill, minmax(${WATCHLIST_CARD_MIN_WIDTH}px, 1fr))`,
          }}
        >
          {watchlists.map((list) => (
            <WatchlistCard
              key={list.id}
              watchlist={list}
              onPickSymbol={onPickSymbol}
              onCompare={onCompare}
              onEdit={setEditingId}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </Box>
      )}

      <CreateWatchlistDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={onCreate}
        existing={watchlists}
        suggestions={suggestions}
      />
      <EditWatchlistDialog
        watchlist={editing}
        onClose={() => setEditingId(null)}
        onSave={onUpdate}
        existing={watchlists}
        suggestions={suggestions}
      />
    </Box>
  );
}
