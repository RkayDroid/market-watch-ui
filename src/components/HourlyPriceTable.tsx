import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import type { TrendPoint } from '../types/stock.ts';
import { DEFAULT_CURRENCY, formatPrice } from '../utils/format.ts';
import TrendIndicator from './TrendIndicator.tsx';
import { EMBEDDED_PAPER_SX } from './embedded.ts';

interface HourlyPriceTableProps {
  history: TrendPoint[];
  title?: string;
  /** ISO-4217 code used to format prices; defaults to USD. */
  currency?: string;
  /** Render without its own border/background, for use inside a grouped panel. */
  embedded?: boolean;
}

export const DEFAULT_TABLE_TITLE = 'Price Intervals';

/** Dense table of sampled prices with a trend arrow per row (one row per interval). */
export default function HourlyPriceTable({
  history,
  title = DEFAULT_TABLE_TITLE,
  currency = DEFAULT_CURRENCY,
  embedded = false,
}: HourlyPriceTableProps) {
  return (
    <Paper sx={embedded ? EMBEDDED_PAPER_SX : undefined} data-testid="price-table-panel">
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TimelineIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1">{title}</Typography>
      </Box>
      <TableContainer>
        <Table
          size="small"
          aria-label="price intervals table"
          sx={{ '& td, & th': { py: 0.25, px: 1.5, lineHeight: 1.4 } }}
        >
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell><strong>Timestamp</strong></TableCell>
              <TableCell align="right"><strong>Rate ({currency})</strong></TableCell>
              <TableCell align="center"><strong>Trend</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((row, index) => (
              <TableRow key={`${row.label}-${index}`} hover>
                <TableCell>{row.label}</TableCell>
                <TableCell align="right">{formatPrice(row.price, currency)}</TableCell>
                <TableCell align="center" sx={{ '& svg': { display: 'block', mx: 'auto', fontSize: 16 } }}>
                  <TrendIndicator trend={row.trend} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
