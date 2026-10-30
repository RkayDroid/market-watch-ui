import type { ReactNode } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { PerformancePeriod } from '../types/performance.ts';
import { validateReferenceDate } from '../utils/date.ts';
import { DARK_TOOLBAR_SX } from './darkToolbar.ts';
import PeriodSelector from './PeriodSelector.tsx';
import ReferenceDatePicker from './ReferenceDatePicker.tsx';

export interface PerformanceToolbarProps {
  /** Optional reference date (`YYYY-MM-DD`, or `''` for none) the look-back window is anchored on. */
  referenceDate: string;
  onReferenceDateChange: (value: string) => void;
  /** Latest allowed reference date, normally today (`YYYY-MM-DD`). */
  maxReferenceDate: string;
  period: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;
  /** Runs the fetch; blocked while the reference date is invalid. */
  onAction: () => void;
  /** Text (and accessible name) of the action button. */
  actionLabel?: string;
  actionIcon?: ReactNode;
  /** Disables the controls and shows a spinner in the button. */
  loading?: boolean;
  testId?: string;
  actionTestId?: string;
}

/**
 * The dark bar shared by the Past Performance panel ("Performance") and the watchlist
 * comparison ("Compare"): reference date, period radios and the action button.
 */
export default function PerformanceToolbar({
  referenceDate,
  onReferenceDateChange,
  maxReferenceDate,
  period,
  onPeriodChange,
  onAction,
  actionLabel = 'Performance',
  actionIcon = <DownloadIcon />,
  loading = false,
  testId = 'past-performance-toolbar',
  actionTestId = 'fetch-performance',
}: PerformanceToolbarProps) {
  const referenceDateError = validateReferenceDate(referenceDate, maxReferenceDate);

  return (
    <Box data-testid={testId} sx={DARK_TOOLBAR_SX}>
      <ReferenceDatePicker
        value={referenceDate}
        onChange={onReferenceDateChange}
        max={maxReferenceDate}
        error={referenceDateError}
        disabled={loading}
        contrast
      />
      <PeriodSelector value={period} onChange={onPeriodChange} disabled={loading} contrast />
      <Button
        variant="contained"
        size="small"
        startIcon={loading ? undefined : actionIcon}
        disabled={loading || referenceDateError !== null}
        onClick={onAction}
        aria-label={actionLabel}
        sx={{
          flexShrink: 0,
          whiteSpace: 'nowrap',
          minWidth: 132,
          fontWeight: 700,
          bgcolor: 'common.white',
          color: 'grey.900',
          '&:hover': { bgcolor: 'grey.200' },
          '&.Mui-disabled': { bgcolor: 'grey.700', color: 'grey.400' },
        }}
        data-testid={actionTestId}
      >
        {loading ? <CircularProgress size={18} color="inherit" /> : actionLabel}
      </Button>
    </Box>
  );
}
