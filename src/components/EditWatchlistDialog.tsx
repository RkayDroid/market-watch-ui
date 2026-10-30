import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import type { QuickSymbol } from '../config/quickLinks.ts';
import { toLookupError } from '../errors/lookupError.ts';
import {
  appendSymbols,
  InvalidWatchlistError,
  isDraftValid,
  isEditUnchanged,
  moveSymbol,
  parseSymbolList,
  removeSymbolAt,
  validateWatchlistEdit,
  type WatchlistDraftErrors,
} from '../services/watchlistService.ts';
import {
  WATCHLIST_MAX_SYMBOLS,
  WATCHLIST_NAME_MAX_LENGTH,
  type Watchlist,
  type WatchlistEdit,
} from '../types/watchlist.ts';

export interface EditWatchlistDialogProps {
  /** The list being edited; `null` closes the dialog. */
  watchlist: Watchlist | null;
  onClose: () => void;
  /**
   * Persists the edit. Rejects with {@link InvalidWatchlistError} for field errors (shown on
   * the fields) or anything else for a storage failure (shown as an alert); both keep the dialog open.
   */
  onSave: (id: string, edit: WatchlistEdit) => Promise<void>;
  /** All lists, for the unique-name rule. */
  existing: readonly Watchlist[];
  /** Symbols offered as one-click "quick add" chips (those already in the list are hidden). */
  suggestions?: readonly QuickSymbol[];
}

/**
 * Modal for renaming a watchlist and changing its symbols: add (typed or from the quick-add
 * chips), remove (× per row; never the last one) and reorder (move up / move down per row).
 * The content unmounts when closed, so every opening starts from the list as currently saved.
 */
export default function EditWatchlistDialog({ watchlist, onClose, ...formProps }: EditWatchlistDialogProps) {
  return (
    <Dialog open={watchlist !== null} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="edit-watchlist-title">
      {watchlist && <EditWatchlistForm watchlist={watchlist} onClose={onClose} {...formProps} />}
    </Dialog>
  );
}

interface EditWatchlistFormProps extends Omit<EditWatchlistDialogProps, 'watchlist'> {
  watchlist: Watchlist;
}

function EditWatchlistForm({ watchlist, onClose, onSave, existing, suggestions = [] }: EditWatchlistFormProps) {
  const [edit, setEdit] = useState<WatchlistEdit>({ name: watchlist.name, symbols: [...watchlist.symbols] });
  const [nameTouched, setNameTouched] = useState(false);
  const [submitError, setSubmitError] = useState<WatchlistDraftErrors | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** Text of the "add symbols" box; applied to the list with Add / Enter, not on every keystroke. */
  const [additions, setAdditions] = useState('');
  const [additionsError, setAdditionsError] = useState<string | null>(null);

  const errors = useMemo(() => validateWatchlistEdit(watchlist, edit, existing), [watchlist, edit, existing]);
  const unchanged = isEditUnchanged(watchlist, edit);
  const canSave = isDraftValid(errors) && !unchanged && !saving && !saved;

  const shownNameError = saved ? undefined : (submitError?.name ?? (nameTouched ? errors.name : undefined));
  const shownSymbolsError = saved ? undefined : (submitError?.symbols ?? errors.symbols);

  const move = (from: number, to: number) => {
    setSubmitError(null);
    setSaveError(null);
    setEdit((prev) => ({ ...prev, symbols: moveSymbol(prev.symbols, from, to) }));
  };

  const remove = (index: number) => {
    setSubmitError(null);
    setSaveError(null);
    setEdit((prev) => ({ ...prev, symbols: removeSymbolAt(prev.symbols, index) }));
  };

  const add = (symbols: readonly string[]) => {
    setSubmitError(null);
    setSaveError(null);
    setEdit((prev) => ({ ...prev, symbols: appendSymbols(prev.symbols, symbols) }));
  };

  /** Parses the add box; impossible tokens block the whole entry so nothing is silently dropped. */
  const addTyped = () => {
    const { symbols, invalid } = parseSymbolList(additions);
    if (invalid.length) {
      setAdditionsError(`Not a valid symbol: ${invalid.join(', ')}.`);
      return;
    }
    if (symbols.length === 0) return;
    add(symbols);
    setAdditions('');
    setAdditionsError(null);
  };

  /** Enter in the add box adds; it must not submit the whole form. */
  const onAdditionsKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTyped();
    }
  };

  const typedPreview = parseSymbolList(additions);
  const canAdd = typedPreview.symbols.length > 0 && typedPreview.invalid.length === 0;
  const quickAdd = suggestions.filter(({ symbol }) => !edit.symbols.includes(symbol));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNameTouched(true);
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(watchlist.id, edit);
      setSaved(true);
      onClose();
    } catch (err) {
      if (err instanceof InvalidWatchlistError) setSubmitError(err.errors);
      else setSaveError(toLookupError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const last = edit.symbols.length - 1;

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate data-testid="edit-watchlist-form">
      <DialogTitle id="edit-watchlist-title" sx={{ pb: 1 }}>
        Edit watchlist
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {saveError && (
          <Alert severity="error" data-testid="watchlist-save-error">
            {saveError}
          </Alert>
        )}
        <TextField
          label="Name"
          value={edit.name}
          onChange={(e) => {
            setSubmitError(null);
    setSaveError(null);
            setEdit((prev) => ({ ...prev, name: e.target.value }));
          }}
          onBlur={() => setNameTouched(true)}
          error={Boolean(shownNameError)}
          helperText={shownNameError ?? `Up to ${WATCHLIST_NAME_MAX_LENGTH} characters.`}
          slotProps={{
            htmlInput: { maxLength: WATCHLIST_NAME_MAX_LENGTH, 'data-testid': 'edit-watchlist-name-input' },
          }}
          autoFocus
          required
          fullWidth
          disabled={saving}
        />

        <Box>
          <Typography
            id="edit-watchlist-symbols-label"
            variant="caption"
            color={shownSymbolsError ? 'error' : 'textSecondary'}
            sx={{ display: 'block' }}
          >
            {shownSymbolsError ??
              `Symbols (${edit.symbols.length}/${WATCHLIST_MAX_SYMBOLS}) — arrows change the order, × removes one.`}
          </Typography>
          <List
            dense
            disablePadding
            aria-labelledby="edit-watchlist-symbols-label"
            data-testid="edit-watchlist-symbols"
            sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
          >
            {edit.symbols.map((symbol, index) => (
              <ListItem
                key={symbol}
                divider={index < last}
                data-testid={`edit-symbol-${symbol}`}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Move ${symbol} up`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        >
                          <ArrowUpwardIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Move ${symbol} down`}
                          disabled={index === last}
                          onClick={() => move(index, index + 1)}
                        >
                          <ArrowDownwardIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={last === 0 ? 'A watchlist needs at least one symbol' : 'Remove'}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Remove ${symbol}`}
                          disabled={last === 0}
                          onClick={() => remove(index)}
                          sx={{ ml: 0.5, '&:hover': { color: 'error.main' } }}
                        >
                          <CloseIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemText
                  primary={symbol}
                  secondary={`#${index + 1}`}
                  slotProps={{
                    primary: { sx: { fontWeight: 700 } },
                    secondary: { variant: 'caption' },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Add symbols"
            value={additions}
            onChange={(e) => {
              setAdditions(e.target.value);
              setAdditionsError(null);
            }}
            onKeyDown={onAdditionsKeyDown}
            error={Boolean(additionsError)}
            helperText={additionsError ?? 'Separate with commas or spaces, then press Enter or Add.'}
            slotProps={{ htmlInput: { 'data-testid': 'edit-watchlist-add-input', spellCheck: false } }}
            fullWidth
          />
          <Button
            variant="outlined"
            color="secondary"
            onClick={addTyped}
            disabled={!canAdd}
            data-testid="edit-watchlist-add"
            sx={{ flexShrink: 0, mt: '1px', height: 37 }}
          >
            Add
          </Button>
        </Box>

        {quickAdd.length > 0 && (
          <Box data-testid="edit-watchlist-suggestions">
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>
              Quick add:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {quickAdd.map(({ symbol, name }) => (
                <Chip
                  key={symbol}
                  label={symbol}
                  size="small"
                  title={name}
                  variant="outlined"
                  clickable
                  aria-label={`Add ${symbol}`}
                  onClick={() => add([symbol])}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          disabled={!canSave}
          data-testid="save-watchlist-edit"
        >
          Save changes
        </Button>
      </DialogActions>
    </Box>
  );
}
