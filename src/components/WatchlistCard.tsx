import { Box, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import type { Watchlist } from '../types/watchlist.ts';

export interface WatchlistCardProps {
  watchlist: Watchlist;
  /** Runs a lookup for the clicked symbol. */
  onPickSymbol: (symbol: string) => void;
  /** Opens the comparison view of this list's symbols. */
  onCompare: (id: string) => void;
  /** Opens the rename / reorder dialog. */
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/** A saved watchlist: its name, a count, compare/edit/delete actions, and one clickable chip per symbol. */
export default function WatchlistCard({
  watchlist,
  onPickSymbol,
  onCompare,
  onEdit,
  onRemove,
  disabled = false,
}: WatchlistCardProps) {
  const { id, name, symbols } = watchlist;
  return (
    <Paper
      component="article"
      aria-label={`Watchlist ${name}`}
      data-testid={`watchlist-${id}`}
      sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.3 }} data-testid="watchlist-name">
            {name}
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ lineHeight: 1.2 }}>
            {symbols.length} {symbols.length === 1 ? 'symbol' : 'symbols'}
          </Typography>
        </Box>
        <Tooltip title="Compare symbols">
          <span>
            <IconButton
              size="small"
              aria-label={`Compare ${name}`}
              onClick={() => onCompare(id)}
              disabled={disabled}
              sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
            >
              <ShowChartIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit watchlist">
          <span>
            <IconButton
              size="small"
              aria-label={`Edit watchlist ${name}`}
              onClick={() => onEdit(id)}
              disabled={disabled}
              sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete watchlist">
          <span>
            <IconButton
              size="small"
              aria-label={`Delete watchlist ${name}`}
              onClick={() => onRemove(id)}
              disabled={disabled}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="watchlist-symbols">
        {symbols.map((symbol) => (
          <Chip
            key={symbol}
            label={symbol}
            size="small"
            variant="outlined"
            clickable
            disabled={disabled}
            onClick={() => onPickSymbol(symbol)}
            aria-label={`Look up ${symbol} from ${name}`}
            sx={{ fontWeight: 600, '&:hover': { borderColor: 'secondary.main' } }}
          />
        ))}
      </Box>
    </Paper>
  );
}
