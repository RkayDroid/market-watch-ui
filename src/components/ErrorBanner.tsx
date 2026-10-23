import { Box, Chip, Paper, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import type { LookupError } from '../errors/lookupError.ts';

interface ErrorBannerProps {
  error: LookupError;
  /** Called when a suggested symbol is clicked. */
  onPickSymbol?: (symbol: string) => void;
}

export default function ErrorBanner({ error, onPickSymbol }: ErrorBannerProps) {
  return (
    <Paper
      role="alert"
      data-testid="error-banner"
      sx={{
        mb: 2,
        px: 2,
        py: 1.5,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        borderLeft: '4px solid',
        borderLeftColor: 'error.main',
        bgcolor: (theme) => theme.palette.error.main + '0d', // ~5% tint
      }}
    >
      <ErrorOutlineIcon color="error" sx={{ mt: 0.25 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" color="error.dark" sx={{ lineHeight: 1.3 }}>
          {error.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
          {error.message}
        </Typography>
        {error.hint && (
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
            {error.hint}
          </Typography>
        )}
        {error.suggestedSymbols && error.suggestedSymbols.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }} data-testid="suggested-symbols">
            {error.suggestedSymbols.map((symbol) => (
              <Chip
                key={symbol}
                label={symbol}
                size="small"
                variant="outlined"
                clickable={Boolean(onPickSymbol)}
                onClick={onPickSymbol ? () => onPickSymbol(symbol) : undefined}
              />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
