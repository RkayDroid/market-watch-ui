import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import type { Trend } from '../types/stock.ts';

interface TrendIndicatorProps {
  trend: Trend;
}

export default function TrendIndicator({ trend }: TrendIndicatorProps) {
  switch (trend) {
    case 'up':
      return <ArrowUpwardIcon color="success" fontSize="small" titleAccess="up" />;
    case 'down':
      return <ArrowDownwardIcon color="error" fontSize="small" titleAccess="down" />;
    default:
      return <RemoveIcon color="primary" fontSize="small" titleAccess="neutral" />;
  }
}
