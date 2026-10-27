import { Box, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';
import { isPerformancePeriod, PERFORMANCE_PERIODS, type PerformancePeriod } from '../types/performance.ts';

export interface PeriodSelectorProps {
  value: PerformancePeriod;
  onChange: (period: PerformancePeriod) => void;
  disabled?: boolean;
}

const LABEL_ID = 'performance-period-label';

/** Controlled radio group for the "Past Performance" look-back window; label and radios on one line. */
export default function PeriodSelector({ value, onChange, disabled = false }: PeriodSelectorProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="period-selector">
      <FormLabel id={LABEL_ID} component="span" disabled={disabled} sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
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
            control={<Radio size="small" sx={{ py: 0.5 }} />}
            label={option.label}
            disabled={disabled}
            slotProps={{ typography: { variant: 'caption' } }}
            sx={{ mr: 1.5 }}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}
