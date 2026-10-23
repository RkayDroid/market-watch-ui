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
import type { HourlyPrice } from '../types/stock.ts';
import TrendIndicator from './TrendIndicator.tsx';

interface HourlyPriceTableProps {
  history: HourlyPrice[];
}

export default function HourlyPriceTable({ history }: HourlyPriceTableProps) {
  return (
    <Paper>
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
        <Typography variant="subtitle1">24-Hour Hourly Price Intervals</Typography>
      </Box>
      <TableContainer>
        <Table
          size="small"
          aria-label="stock hourly details table"
          sx={{ '& td, & th': { py: 0.25, px: 1.5, lineHeight: 1.4 } }}
        >
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell><strong>Timestamp / Hour</strong></TableCell>
              <TableCell align="right"><strong>Rate ($)</strong></TableCell>
              <TableCell align="center"><strong>Hourly Trend</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((row, index) => (
              <TableRow key={`${row.hour}-${index}`} hover>
                <TableCell>{row.hour}</TableCell>
                <TableCell align="right">${row.price.toFixed(2)}</TableCell>
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
