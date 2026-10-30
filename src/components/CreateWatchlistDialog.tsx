import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import type { QuickSymbol } from '../config/quickLinks.ts';
import { toLookupError } from '../errors/lookupError.ts';
import {
  InvalidWatchlistError,
  isDraftValid,
  parseSymbolList,
  toggleSymbolInText,
  validateWatchlistDraft,
  type WatchlistDraftErrors,
} from '../services/watchlistService.ts';
import {
  WATCHLIST_MAX_SYMBOLS,
  WATCHLIST_NAME_MAX_LENGTH,
  type Watchlist,
  type WatchlistDraft,
} from '../types/watchlist.ts';

export interface CreateWatchlistDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Persists the draft. Rejects with {@link InvalidWatchlistError} for field errors (shown on
   * the fields) or anything else for a storage failure (shown as an alert); both keep the dialog open.
   */
  onCreate: (draft: WatchlistDraft) => Promise<Watchlist>;
  /** Existing lists, for the unique-name rule. */
  existing: readonly Watchlist[];
  /** Symbols offered as one-click toggles beneath the text box. */
  suggestions?: readonly QuickSymbol[];
}

const EMPTY_DRAFT: WatchlistDraft = { name: '', symbolsText: '' };

/**
 * Modal form for a new watchlist: a name and a free-text symbol list (commas, spaces or
 * new lines), with the parsed symbols previewed as chips so typos are visible before saving.
 * The dialog unmounts its content when closed, so every opening starts with a clean draft.
 */
export default function CreateWatchlistDialog({ open, onClose, ...formProps }: CreateWatchlistDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="create-watchlist-title">
      <CreateWatchlistForm onClose={onClose} {...formProps} />
    </Dialog>
  );
}

type CreateWatchlistFormProps = Omit<CreateWatchlistDialogProps, 'open'>;

/** Validation runs live but messages only appear once a field has been touched or on submit. */
function CreateWatchlistForm({ onClose, onCreate, existing, suggestions = [] }: CreateWatchlistFormProps) {
  const [draft, setDraft] = useState<WatchlistDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState<{ name: boolean; symbols: boolean }>({ name: false, symbols: false });
  const [submitError, setSubmitError] = useState<WatchlistDraftErrors | null>(null);
  /** Message of a failed save that was not a field error (e.g. the API was unreachable). */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** True while the save is in flight; the form is frozen meanwhile. */
  const [saving, setSaving] = useState(false);
  /** Set once the draft is persisted: the form then sits still while the dialog fades out. */
  const [saved, setSaved] = useState(false);

  const errors = useMemo(() => validateWatchlistDraft(draft, existing), [draft, existing]);
  const parsed = useMemo(() => parseSymbolList(draft.symbolsText), [draft.symbolsText]);
  const canSave = isDraftValid(errors) && !saving && !saved;

  // "Required" messages wait until the field is left; a token that cannot be a symbol is shown at once.
  const shownErrors: WatchlistDraftErrors = saved
    ? {}
    : {
        name: submitError?.name ?? (touched.name ? errors.name : undefined),
        symbols: submitError?.symbols ?? (touched.symbols || parsed.invalid.length > 0 ? errors.symbols : undefined),
      };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ name: true, symbols: true });
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate(draft);
      setSaved(true);
      onClose();
    } catch (err) {
      if (err instanceof InvalidWatchlistError) setSubmitError(err.errors);
      else setSaveError(toLookupError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<WatchlistDraft>) => {
    setSubmitError(null);
    setSaveError(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate data-testid="create-watchlist-form">
      <DialogTitle id="create-watchlist-title" sx={{ pb: 1 }}>
        Create watchlist
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {saveError && (
          <Alert severity="error" data-testid="watchlist-save-error">
            {saveError}
          </Alert>
        )}
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={Boolean(shownErrors.name)}
          helperText={shownErrors.name ?? `Up to ${WATCHLIST_NAME_MAX_LENGTH} characters.`}
          slotProps={{ htmlInput: { maxLength: WATCHLIST_NAME_MAX_LENGTH, 'data-testid': 'watchlist-name-input' } }}
          autoFocus
          required
          fullWidth
          disabled={saving}
        />

        <TextField
          label="Symbols"
          value={draft.symbolsText}
          onChange={(e) => update({ symbolsText: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, symbols: true }))}
          error={Boolean(shownErrors.symbols)}
          helperText={
            shownErrors.symbols ??
            `Separate with commas or spaces, e.g. AAPL, MSFT, BRK.A — up to ${WATCHLIST_MAX_SYMBOLS}.`
          }
          slotProps={{ htmlInput: { 'data-testid': 'watchlist-symbols-input', spellCheck: false } }}
          multiline
          minRows={2}
          required
          fullWidth
          disabled={saving}
        />

        {parsed.symbols.length > 0 && (
          <Box data-testid="watchlist-preview">
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>
              Will be saved as ({parsed.symbols.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {parsed.symbols.map((symbol) => (
                <Chip
                  key={symbol}
                  label={symbol}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  onDelete={() => update({ symbolsText: toggleSymbolInText(draft.symbolsText, symbol) })}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Box>
          </Box>
        )}

        {suggestions.length > 0 && (
          <Box data-testid="watchlist-suggestions">
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>
              Quick add:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {suggestions.map(({ symbol, name }) => {
                const selected = parsed.symbols.includes(symbol);
                return (
                  <Chip
                    key={symbol}
                    label={symbol}
                    size="small"
                    title={name}
                    variant={selected ? 'filled' : 'outlined'}
                    color={selected ? 'secondary' : 'default'}
                    clickable
                    aria-pressed={selected}
                    onClick={() => update({ symbolsText: toggleSymbolInText(draft.symbolsText, symbol) })}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" color="secondary" disabled={!canSave} data-testid="save-watchlist">
          {saving ? 'Saving…' : 'Save watchlist'}
        </Button>
      </DialogActions>
    </Box>
  );
}
