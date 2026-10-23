import type { FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { isDataSource, type DataSource } from '../types/stock.ts';
import { LAYOUT } from '../layout.ts';

export interface LookupFormProps {
  symbol: string;
  source: DataSource;
  loading: boolean;
  onSymbolChange: (symbol: string) => void;
  onSourceChange: (source: DataSource) => void;
  onSubmit: (symbol: string, source: DataSource) => void;
}

/** Controlled lookup form: the parent owns the symbol/source so it can pre-fill them. */
export default function LookupForm({
  symbol,
  source,
  loading,
  onSymbolChange,
  onSourceChange,
  onSubmit,
}: LookupFormProps) {
  const canSubmit = symbol.trim().length > 0 && !loading;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(symbol, source);
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

        <FormControl
          component="fieldset"
          sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, ml: { md: 2 } }}
        >
          <FormLabel component="legend" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            Source:
          </FormLabel>
          <RadioGroup
            row
            value={source}
            onChange={(e) => {
              if (isDataSource(e.target.value)) onSourceChange(e.target.value);
            }}
            sx={{ flexWrap: 'nowrap' }}
          >
            <FormControlLabel
              value="api"
              control={<Radio size="small" sx={{ py: 0.5 }} />}
              label="Live API"
              slotProps={{ typography: { variant: 'caption' } }}
              sx={{ mr: 1.5 }}
            />
            <FormControlLabel
              value="file"
              control={<Radio size="small" sx={{ py: 0.5 }} />}
              label="Local Flat File (CSV)"
              slotProps={{ typography: { variant: 'caption' } }}
              sx={{ mr: 0 }}
            />
          </RadioGroup>
        </FormControl>
      </Box>
    </Paper>
  );
}
