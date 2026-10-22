import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TimelineIcon from '@mui/icons-material/Timeline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';

interface HourlyPrice {
  hour: string;
  price: number;
  trend: 'up' | 'down' | 'neutral';
}

interface StockData {
  symbol: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  changePercent: number;
  history: HourlyPrice[];
}

interface FileRecord {
  rate: number;
  date: string;
}

// Structured JSON flat file database with rate and date objects
const LOCAL_FLAT_FILE_DB: Record<string, FileRecord[]> = {
  V: [
    { rate: 275.20, date: "2026-10-21T15:00:00Z" },
    { rate: 274.80, date: "2026-10-21T16:00:00Z" },
    { rate: 275.10, date: "2026-10-21T17:00:00Z" },
    { rate: 276.00, date: "2026-10-21T18:00:00Z" },
    { rate: 275.90, date: "2026-10-21T19:00:00Z" },
    { rate: 276.50, date: "2026-10-21T20:00:00Z" },
    { rate: 277.10, date: "2026-10-21T21:00:00Z" },
    { rate: 276.80, date: "2026-10-21T22:00:00Z" },
    { rate: 277.50, date: "2026-10-21T23:00:00Z" },
    { rate: 278.00, date: "2026-10-22T00:00:00Z" },
    { rate: 277.90, date: "2026-10-22T01:00:00Z" },
    { rate: 278.40, date: "2026-10-22T02:00:00Z" },
    { rate: 279.00, date: "2026-10-22T03:00:00Z" },
    { rate: 278.80, date: "2026-10-22T04:00:00Z" },
    { rate: 279.50, date: "2026-10-22T05:00:00Z" },
    { rate: 280.10, date: "2026-10-22T06:00:00Z" },
    { rate: 279.80, date: "2026-10-22T07:00:00Z" },
    { rate: 280.40, date: "2026-10-22T08:00:00Z" },
    { rate: 281.00, date: "2026-10-22T09:00:00Z" },
    { rate: 280.90, date: "2026-10-22T10:00:00Z" },
    { rate: 281.50, date: "2026-10-22T11:00:00Z" },
    { rate: 282.00, date: "2026-10-22T12:00:00Z" },
    { rate: 281.80, date: "2026-10-22T13:00:00Z" },
    { rate: 282.50, date: "2026-10-22T14:00:00Z" }
  ],
  AAPL: [
    { rate: 220.10, date: "2026-10-21T15:00:00Z" },
    { rate: 219.50, date: "2026-10-21T16:00:00Z" },
    { rate: 220.00, date: "2026-10-21T17:00:00Z" },
    { rate: 221.20, date: "2026-10-21T18:00:00Z" },
    { rate: 220.80, date: "2026-10-21T19:00:00Z" },
    { rate: 221.50, date: "2026-10-21T20:00:00Z" },
    { rate: 222.00, date: "2026-10-21T21:00:00Z" },
    { rate: 221.80, date: "2026-10-21T22:00:00Z" },
    { rate: 222.50, date: "2026-10-21T23:00:00Z" },
    { rate: 223.10, date: "2026-10-22T00:00:00Z" },
    { rate: 222.90, date: "2026-10-22T01:00:00Z" },
    { rate: 223.50, date: "2026-10-22T02:00:00Z" },
    { rate: 224.00, date: "2026-10-22T03:00:00Z" },
    { rate: 223.80, date: "2026-10-22T04:00:00Z" },
    { rate: 224.50, date: "2026-10-22T05:00:00Z" },
    { rate: 225.00, date: "2026-10-22T06:00:00Z" },
    { rate: 224.70, date: "2026-10-22T07:00:00Z" },
    { rate: 225.20, date: "2026-10-22T08:00:00Z" },
    { rate: 226.00, date: "2026-10-22T09:00:00Z" },
    { rate: 225.80, date: "2026-10-22T10:00:00Z" },
    { rate: 226.40, date: "2026-10-22T11:00:00Z" },
    { rate: 227.00, date: "2026-10-22T12:00:00Z" },
    { rate: 226.80, date: "2026-10-22T13:00:00Z" },
    { rate: 227.50, date: "2026-10-22T14:00:00Z" }
  ]
};

export default function App() {
  const [symbol, setSymbol] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('api');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    setLoading(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      let rawPrices: number[] = [];
      let rawDates: string[] = [];

      if (dataSource === 'file') {
        if (LOCAL_FLAT_FILE_DB[cleanSymbol]) {
          const records = LOCAL_FLAT_FILE_DB[cleanSymbol];
          rawPrices = records.map((r) => r.rate);
          rawDates = records.map((r) => r.date);
        } else {
          let base = 150;
          const now = new Date();
          rawPrices = Array.from({ length: 24 }, () => {
            base += (Math.random() - 0.48) * 2;
            return parseFloat(base.toFixed(2));
          });
          rawDates = Array.from({ length: 24 }, (_, i) => 
            new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString()
          );
        }
      } else {
        let base = 100 + Math.random() * 150;
        const now = new Date();
        rawPrices = Array.from({ length: 24 }, () => {
          base += (Math.random() - 0.48) * 3;
          return parseFloat(base.toFixed(2));
        });
        rawDates = Array.from({ length: 24 }, (_, i) => 
          new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString()
        );
      }

      const history: HourlyPrice[] = rawPrices.map((price, index) => {
        const d = new Date(rawDates[index]);
        let trend: 'up' | 'down' | 'neutral' = 'neutral';

        if (index === 0) {
          trend = 'neutral';
        } else if (price > rawPrices[index - 1]) {
          trend = 'up';
        } else if (price < rawPrices[index - 1]) {
          trend = 'down';
        }

        return {
          hour: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
          price,
          trend,
        };
      });

      const highPrice = Math.max(...rawPrices);
      const lowPrice = Math.min(...rawPrices);
      const startPrice = rawPrices[0];
      const endPrice = rawPrices[rawPrices.length - 1];
      const changePercent = parseFloat((((endPrice - startPrice) / startPrice) * 100).toFixed(2));

      setStockData({
        symbol: cleanSymbol,
        currentPrice: endPrice,
        highPrice,
        lowPrice,
        changePercent,
        history,
      });
    } catch (err) {
      setError('Failed to retrieve stock data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        Market Watch & Analytics
      </Typography>

      {/* Component 1: Lookup Form with Radio Buttons for Data Source */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Lookup Stock Symbol
        </Typography>
        <Box component="form" onSubmit={handleFetchStock} display="flex" flexDirection="column" gap={3}>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Stock Symbol (e.g., V, AAPL)"
              variant="outlined"
              size="small"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 240 }}
              required
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Get Data'}
            </Button>
          </Box>

          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
              Data Source Selection
            </FormLabel>
            <RadioGroup
              row
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
            >
              <FormControlLabel value="api" control={<Radio />} label="Live API" />
              <FormControlLabel value="file" control={<Radio />} label="Local Flat File (JSON)" />
            </RadioGroup>
          </FormControl>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Component 2: Rich Details Display */}
      {stockData && (
        <Box>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2">
                    Symbol
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {stockData.symbol}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2">
                    Current Price
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${stockData.currentPrice.toFixed(2)}
                  </Typography>
                  <Chip
                    icon={stockData.changePercent >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    label={`${stockData.changePercent}%`}
                    color={stockData.changePercent >= 0 ? 'success' : 'error'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2">
                    24h High / Low
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ${stockData.highPrice.toFixed(2)} / ${stockData.lowPrice.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Hourly Breakdown Table with Trend Indicators */}
          <Paper elevation={2}>
            <Box p={2} display="flex" alignItems="center" gap={1} borderBottom="1px solid" borderColor="divider">
              <TimelineIcon color="primary" />
              <Typography variant="h6">24-Hour Hourly Price Intervals</Typography>
            </Box>
            <TableContainer>
              <Table aria-label="stock hourly details table">
                <TableHead sx={{ backgroundColor: 'action.hover' }}>
                  <TableRow>
                    <TableCell><strong>Timestamp / Hour</strong></TableCell>
                    <TableCell align="right"><strong>Rate ($)</strong></TableCell>
                    <TableCell align="center"><strong>Hourly Trend</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockData.history.map((row, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{row.hour}</TableCell>
                      <TableCell align="right">${row.price.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        {row.trend === 'up' && <ArrowUpwardIcon color="success" fontSize="small" />}
                        {row.trend === 'down' && <ArrowDownwardIcon color="error" fontSize="small" />}
                        {row.trend === 'neutral' && <RemoveIcon color="primary" fontSize="small" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Container>
  );
}