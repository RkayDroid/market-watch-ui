import { useId, useRef } from 'react';
import { Box, FormLabel, IconButton, InputAdornment, TextField } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import { ISO_DATE_PATTERN } from '../utils/date.ts';

export interface ReferenceDatePickerProps {
  /** Selected date as `YYYY-MM-DD`, or `''` when none has been picked (the field is optional). */
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable date (`YYYY-MM-DD`), normally today; the calendar greys out later days. */
  max: string;
  /** Validation message to show; the field is marked invalid when set. */
  error?: string | null;
  disabled?: boolean;
  /** White text and outline for use on a dark surface. */
  contrast?: boolean;
}

export const REFERENCE_DATE_LABEL = 'Reference date';

/** Room for "YYYY-MM-DD" plus the clear and calendar buttons. */
const FIELD_WIDTH = 136;

const COMPACT_FIELD_SX = {
  width: FIELD_WIDTH,
  '& .MuiInputBase-root': { fontSize: 13 },
  // MUI's adorned-end rule is more specific than a plain root selector, so match it exactly.
  '& .MuiOutlinedInput-root.MuiInputBase-adornedEnd': { pr: 0.5 },
  '& .MuiInputBase-input': { py: 0.5, pl: 1.25, cursor: 'pointer' },
  '& .MuiInputAdornment-root': { ml: 0 },
  '& .MuiFormHelperText-root': { mx: 0, mt: 0.25, whiteSpace: 'nowrap', fontSize: 11 },
} as const;

const ICON_BUTTON_SX = { p: 0.25 } as const;

const CONTRAST_LABEL_SX = {
  color: 'common.white',
  fontWeight: 700,
  '&.Mui-disabled': { color: 'common.white', opacity: 0.6 },
} as const;

const CONTRAST_FIELD_SX = {
  '& .MuiInputBase-root': { color: 'common.white' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.6)' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'common.white' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'common.white' },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: 'error.light' },
  '& .MuiFormHelperText-root': { color: 'error.light' },
  '& .MuiIconButton-root': { color: 'common.white' },
  '& .Mui-disabled': { color: 'rgba(255,255,255,0.6)', WebkitTextFillColor: 'rgba(255,255,255,0.6)' },
} as const;

/**
 * Optional "reference date" the past-performance window is anchored on. Shows nothing until a
 * date is picked; clicking the field (or its calendar button) opens the browser's native date
 * picker, capped at `max`, and the choice is then displayed as `YYYY-MM-DD` regardless of the
 * browser locale. A clear button returns the field to "no date".
 */
export default function ReferenceDatePicker({
  value,
  onChange,
  max,
  error = null,
  disabled = false,
  contrast = false,
}: ReferenceDatePickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const helperId = useId();

  const openCalendar = () => {
    const input = nativeRef.current;
    if (!input || disabled) return;
    // `showPicker` needs a user gesture (we are in a click handler); older browsers fall back to focus.
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1 }} data-testid="reference-date">
      <FormLabel
        id={labelId}
        component="span"
        disabled={disabled}
        sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', ...(contrast ? CONTRAST_LABEL_SX : {}) }}
      >
        {REFERENCE_DATE_LABEL}:
      </FormLabel>
      <TextField
        value={value}
        size="small"
        error={error !== null}
        helperText={error ?? undefined}
        disabled={disabled}
        onClick={openCalendar}
        sx={{ ...COMPACT_FIELD_SX, ...(contrast ? CONTRAST_FIELD_SX : {}) }}
        slotProps={{
          htmlInput: {
            readOnly: true,
            'aria-labelledby': labelId,
            'aria-describedby': error ? helperId : undefined,
            'data-testid': 'reference-date-input',
          },
          formHelperText: { id: helperId },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                {value && (
                  <IconButton
                    aria-label="Clear reference date"
                    size="small"
                    sx={ICON_BUTTON_SX}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange('');
                    }}
                    data-testid="reference-date-clear"
                  >
                    <ClearIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
                <IconButton
                  aria-label="Open calendar"
                  size="small"
                  sx={ICON_BUTTON_SX}
                  disabled={disabled}
                  data-testid="reference-date-calendar"
                >
                  <CalendarMonthIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {/*
        Native picker, kept rendered (showPicker needs that) but out of sight. It is the only
        way to get a calendar without a date-picker dependency; its own display format is
        irrelevant because the read-only field above is what the user reads.
      */}
      <input
        ref={nativeRef}
        type="date"
        max={max}
        value={ISO_DATE_PATTERN.test(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        data-testid="reference-date-native"
        style={{
          position: 'absolute',
          right: 8,
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          border: 0,
          padding: 0,
        }}
      />
    </Box>
  );
}
