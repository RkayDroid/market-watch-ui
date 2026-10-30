import { FormControlLabel, Switch, Tooltip } from '@mui/material';
import type { DataSource } from '../types/stock.ts';

export interface SourceToggleProps {
  source: DataSource;
  onChange: (source: DataSource) => void;
  /** White label and track for use on a dark surface. */
  contrast?: boolean;
}

/** Accessible name of the switch; "on" means offline. */
export const OFFLINE_TOGGLE_LABEL = 'Offline mode';

/**
 * App-wide data-source switch: off = the live APIs (stock + watchlist), on = offline
 * (bundled JSON fixtures for stocks, this browser's storage for watchlists).
 */
export default function SourceToggle({ source, onChange, contrast = false }: SourceToggleProps) {
  const offline = source === 'local';
  return (
    <Tooltip
      title={
        offline
          ? 'Offline: stock data from the bundled JSON fixtures, watchlists in this browser.'
          : 'Online: stock data and watchlists from the live APIs.'
      }
    >
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={offline}
            onChange={(e) => onChange(e.target.checked ? 'local' : 'api')}
            color="secondary"
            slotProps={{ input: { 'aria-label': OFFLINE_TOGGLE_LABEL, role: 'switch' } }}
            data-testid="offline-toggle"
            sx={
              contrast
                ? {
                    // Off: white thumb on a translucent track; on: the brand purple (MUI default for "secondary").
                    '& .MuiSwitch-switchBase:not(.Mui-checked)': { color: 'common.white' },
                    '& .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': {
                      bgcolor: 'rgba(255,255,255,0.45)',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'secondary.light' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      bgcolor: 'secondary.light',
                      opacity: 0.7,
                    },
                  }
                : undefined
            }
          />
        }
        label={OFFLINE_TOGGLE_LABEL}
        slotProps={{ typography: { variant: 'caption', sx: { fontWeight: 700, whiteSpace: 'nowrap' } } }}
        sx={{ mr: 0, ml: 1, color: contrast ? 'common.white' : 'text.primary' }}
      />
    </Tooltip>
  );
}
