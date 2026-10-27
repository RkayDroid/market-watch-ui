import { Box, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';
import { isPerformancePeriod, PERFORMANCE_PERIODS, type PerformancePeriod } from '../types/performance.ts';

export interface PeriodSelectorProps {
  value: PerformancePeriod;
  onChange: (period: PerformancePeriod) => void;
  disabled?: boolean;
  /** White, bold labels and white radios for use on a dark surface. */
  contrast?: boolean;
}

const CONTRAST_TEXT_SX = {
  color: 'common.white',
  fontWeight: 700,
  '&.Mui-disabled': { color: 'common.white', opacity: 0.6 },
} as const;

const CONTRAST_RADIO_SX = {
  color: 'common.white',
  '&.Mui-checked': { color: 'common.white' },
  '&.Mui-disabled': { color: 'common.white', opacity: 0.6 },
} as const;

const LABEL_ID = 'performance-period-label';

/** Controlled radio group for the "Past Performance" look-back window; label and radios on one line. */
export default function PeriodSelector({ value, onChange, disabled = false, contrast = false }: PeriodSelectorProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="period-selector">
      <FormLabel
        id={LABEL_ID}
        component="span"
        disabled={disabled}
        sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', ...(contrast ? CONTRAST_TEXT_SX : {}) }}
      >
        Period:
      </FormLabel>
      <RadioGroup
        row
        name="performance-period"
        aria-labelledby={LABEL_ID}
        value={value}
        onChange={(e) => {
          if (isPerformancePeriod(e.target.value)) onChange(e.target.value);
        }}
        sx={{ flexWrap: 'wrap', rowGap: 0 }}
      >
        {PERFORMANCE_PERIODS.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio size="small" sx={{ py: 0.5, ...(contrast ? CONTRAST_RADIO_SX : {}) }} />}
            label={option.label}
            disabled={disabled}
            slotProps={{ typography: { variant: 'caption', sx: contrast ? CONTRAST_TEXT_SX : undefined } }}
            sx={{
              mr: 1.5,
              // MUI dims disabled labels to text.disabled; keep them legible on the dark toolbar.
              ...(contrast ? { '& .MuiFormControlLabel-label.Mui-disabled': { color: 'common.white', opacity: 0.6 } } : {}),
            }}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}
