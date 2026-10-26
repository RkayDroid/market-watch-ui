import { Box } from '@mui/material';
import type { StockDetails } from '../types/stock.ts';
import {
  describeCurrency,
  describeExchange,
  describeLanguage,
  formatMarket,
  formatPrice,
} from '../utils/format.ts';
import Tile from './Tile.tsx';

interface StockDetailCardsProps {
  details: StockDetails;
}

/** Minimum tile width; the grid fits as many per row as the viewport allows. */
export const DETAIL_TILE_MIN_WIDTH = 160;

/**
 * Responsive grid of reference-data tiles from `GET /stock/{symbol}`.
 * Only the symbol is guaranteed; every other tile appears when the field is present.
 */
export default function StockDetailCards({ details }: StockDetailCardsProps) {
  const { symbol, displayName, longName, sector, exchange, market, currency, language, fulldayPrice } = details;

  return (
    <Box
      data-testid="detail-tiles"
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: `repeat(auto-fill, minmax(${DETAIL_TILE_MIN_WIDTH}px, 1fr))`,
      }}
    >
      <Tile label="Symbol" testId="summary-symbol">
        {symbol}
      </Tile>

      {(displayName || longName) && (
        <Tile label="Company" testId="detail-company" secondary={displayName ? longName : undefined}>
          {displayName ?? longName}
        </Tile>
      )}

      {fulldayPrice !== undefined && (
        <Tile label="Full-day Price" testId="detail-fullday-price" secondary={currency}>
          {formatPrice(fulldayPrice, currency)}
        </Tile>
      )}

      {sector && (
        <Tile label="Sector" testId="detail-sector">
          {sector}
        </Tile>
      )}

      {exchange && (
        <Tile label="Exchange" testId="detail-exchange" secondary={describeExchange(exchange)}>
          {exchange}
        </Tile>
      )}

      {market && (
        <Tile label="Market" testId="detail-market" secondary={market}>
          {formatMarket(market)}
        </Tile>
      )}

      {currency && (
        <Tile label="Currency" testId="detail-currency" secondary={describeCurrency(currency)}>
          {currency}
        </Tile>
      )}

      {language && (
        <Tile label="Language" testId="detail-language" secondary={describeLanguage(language)}>
          {language}
        </Tile>
      )}
    </Box>
  );
}
