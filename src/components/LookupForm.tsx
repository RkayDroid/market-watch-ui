import type { FormEvent } from 'react';
import { Box, Button, CircularProgress, Paper, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { LAYOUT } from '../layout.ts';

export interface LookupFormProps {
  symbol: string;
  loading: boolean;
  onSymbolChange: (symbol: string) => void;
  /** Submits the typed symbol; the data source is the app-wide setting (see `SourceToggle`). */
  onSubmit: (symbol: string) => void;
}

/** Controlled lookup form: the parent owns the symbol so it can pre-fill it. */
export default function LookupForm({ symbol, loading, onSymbolChange, onSubmit }: LookupFormProps) {
  const canSubmit = symbol.trim().length > 0 && !loading;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(symbol);
  };

  return (
    <Paper sx={{ px: 2, py: 1.5, mb: 2 }}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-label="stock lookup form"
        data-testid="lookup-form"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: { xs: 'wrap', md: 'nowrap' },
        }}
      >
        <TextField
          label="Stock Symbol (e.g., V, AAPL)"
          variant="outlined"
          size="small"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          required
          sx={{ width: { xs: '100%', md: LAYOUT.symbolInput }, flexShrink: 0 }}
        />
        <Button
          type="submit"
          variant="contained"
          size="medium"
          startIcon={loading ? undefined : <SearchIcon />}
          disabled={!canSubmit}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 96 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Find'}
        </Button>
      </Box>
    </Paper>
  );
}
