import { useMemo, useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { computePriceChartLayout, type ChartPoint, type PriceChartLayout } from '../charts/priceChartLayout.ts';
import { useElementWidth } from '../hooks/useElementWidth.ts';
import type { TrendPoint } from '../types/stock.ts';
import { describeCandle, formatPrice } from '../utils/format.ts';
import { EMBEDDED_PAPER_SX } from './embedded.ts';

export interface PriceChartProps {
  history: TrendPoint[];
  /** Fixed pixel width. When omitted the chart measures and fills its container. */
  width?: number;
  /** Pixel height of the SVG. */
  height?: number;
  title?: string;
  /** ISO-4217 code used to format prices; defaults to USD. */
  currency?: string;
  /** Render without its own border/background, for use inside a grouped panel. */
  embedded?: boolean;
}

export const DEFAULT_CHART_TITLE = 'Price Trend';

export const DEFAULT_CHART_WIDTH = 800;
export const DEFAULT_CHART_HEIGHT = 280;

const POINT_RADIUS = 3;
const ACTIVE_POINT_RADIUS = 5;
/* Tooltip geometry. Rows, top to bottom: close (centred, bold), high, low, timestamp. */
const TOOLTIP_PADDING = 6;
const TOOLTIP_HEADLINE_FONT = 13;
const TOOLTIP_ROW_FONT = 11;
const TOOLTIP_FOOTER_FONT = 10;
const TOOLTIP_HEADLINE_HEIGHT = 16;
const TOOLTIP_ROW_HEIGHT = 14;
const TOOLTIP_FOOTER_HEIGHT = 12;
/** Gap between a row's label ("High") and its right-aligned value. */
const TOOLTIP_COLUMN_GAP = 14;
const TOOLTIP_MIN_WIDTH = 96;
const TOOLTIP_HEIGHT =
  TOOLTIP_PADDING * 2 + TOOLTIP_HEADLINE_HEIGHT + TOOLTIP_ROW_HEIGHT * 2 + TOOLTIP_FOOTER_HEIGHT;

/**
 * Rough advance width of `text` at `fontSize` (SVG text can't be measured before it is
 * rendered, and not at all in jsdom). Digits and letters are ~0.56 em in Roboto, bold a
 * little wider; punctuation and spaces about half that.
 */
function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  const em = bold ? 0.62 : 0.56;
  let width = 0;
  for (const ch of text) width += /[\s.,:']/.test(ch) ? em * 0.45 : em;
  return width * fontSize;
}

/** Tooltip width that fits its widest row, so a six-figure price gets more room than a two-figure one. */
function tooltipWidth(point: ChartPoint, currency?: string): number {
  const headline = estimateTextWidth(formatPrice(point.price, currency), TOOLTIP_HEADLINE_FONT, true);
  const label = estimateTextWidth('High', TOOLTIP_ROW_FONT);
  const rows = Math.max(
    ...[point.high, point.low].map((v) => label + TOOLTIP_COLUMN_GAP + estimateTextWidth(formatPrice(v, currency), TOOLTIP_ROW_FONT)),
  );
  const footer = estimateTextWidth(point.label, TOOLTIP_FOOTER_FONT);
  return Math.ceil(Math.max(TOOLTIP_MIN_WIDTH, headline, rows, footer) + TOOLTIP_PADDING * 2);
}

/**
 * Position the tooltip above the point, flipping below when there is no room above and,
 * failing that (a plot shorter than the tooltip), clamping it inside the SVG.
 */
function tooltipPosition(layout: PriceChartLayout, x: number, y: number, width: number) {
  const { plot, height } = layout;
  let tx = x - width / 2;
  tx = Math.max(plot.left, Math.min(tx, plot.right - width));
  let ty = y - TOOLTIP_HEIGHT - 12;
  if (ty < plot.top) ty = y + 12;
  ty = Math.max(0, Math.min(ty, height - TOOLTIP_HEIGHT));
  return { tx, ty };
}

export default function PriceChart({
  history,
  width: fixedWidth,
  height = DEFAULT_CHART_HEIGHT,
  title = DEFAULT_CHART_TITLE,
  currency,
  embedded = false,
}: PriceChartProps) {
  const theme = useTheme();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [containerRef, measuredWidth] = useElementWidth<HTMLDivElement>(DEFAULT_CHART_WIDTH);
  const width = fixedWidth ?? measuredWidth;

  const layout = useMemo(() => computePriceChartLayout(history, { width, height }), [history, width, height]);

  const lineColor =
    layout.direction === 'down'
      ? theme.palette.error.main
      : layout.direction === 'up'
        ? theme.palette.success.main
        : theme.palette.primary.main;
  const gridColor = theme.palette.divider;
  const textColor = theme.palette.text.secondary;

  const { plot, points } = layout;
  const columnWidth = points.length > 1 ? (plot.right - plot.left) / (points.length - 1) : plot.right - plot.left;
  const active = activeIndex !== null ? points[activeIndex] : undefined;

  return (
    <Paper
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...(embedded ? EMBEDDED_PAPER_SX : {}) }}
      data-testid="price-chart-panel"
    >
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
        <ShowChartIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1">{title}</Typography>
      </Box>

      <Box sx={{ p: 1.5, flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <Box ref={containerRef} sx={{ width: '100%' }}>
          {points.length === 0 ? (
            <Typography color="textSecondary" data-testid="price-chart-empty">
              No price data to plot.
            </Typography>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              style={{ display: 'block', overflow: 'visible' }}
              role="img"
              aria-label={`${title}: ${points.length} price points`}
              data-testid="price-chart"
              data-direction={layout.direction}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id="price-chart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines + y-axis labels */}
              {layout.yTicks.map((tick) => (
                <g key={`y-${tick.value}`} data-testid="y-tick">
                  <line x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} stroke={gridColor} strokeDasharray="4 4" />
                  <text x={plot.left - 8} y={tick.y} dy="0.35em" textAnchor="end" fontSize={11} fill={textColor}>
                    {formatPrice(tick.value, currency)}
                  </text>
                </g>
              ))}

              {/* x-axis labels */}
              {layout.xTicks.map((tick) => (
                <text
                  key={`x-${tick.index}`}
                  data-testid="x-tick"
                  x={tick.x}
                  y={plot.bottom + 20}
                  textAnchor={tick.anchor}
                  fontSize={11}
                  fill={textColor}
                >
                  {tick.label}
                </text>
              ))}

              {/* Axes */}
              <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={gridColor} />
              <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke={gridColor} />

              {/* Series */}
              <path d={layout.areaPath} fill="url(#price-chart-area)" data-testid="price-area" />
              <path
                d={layout.linePath}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                data-testid="price-line"
              />

              {points.map((p) => (
                <g key={p.index}>
                  {/* Invisible hit area spanning the column so hover is forgiving */}
                  <rect
                    x={p.x - columnWidth / 2}
                    y={plot.top}
                    width={columnWidth}
                    height={plot.bottom - plot.top}
                    fill="transparent"
                    onMouseEnter={() => setActiveIndex(p.index)}
                    data-testid={`hit-${p.index}`}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={activeIndex === p.index ? ACTIVE_POINT_RADIUS : POINT_RADIUS}
                    fill={theme.palette.background.paper}
                    stroke={lineColor}
                    strokeWidth={2}
                    pointerEvents="none"
                    data-testid="price-point"
                    data-trend={p.trend}
                  >
                    <title>{describeCandle(p, currency)}</title>
                  </circle>
                </g>
              ))}

              {/* Tooltip */}
              {active && (
                <g data-testid="price-tooltip" pointerEvents="none">
                  <line x1={active.x} x2={active.x} y1={plot.top} y2={plot.bottom} stroke={lineColor} strokeOpacity={0.4} />
                  {(() => {
                    const width = tooltipWidth(active, currency);
                    const { tx, ty } = tooltipPosition(layout, active.x, active.y, width);
                    const left = tx + TOOLTIP_PADDING;
                    const right = tx + width - TOOLTIP_PADDING;
                    const centre = tx + width / 2;
                    // Baselines, top to bottom.
                    const headlineY = ty + TOOLTIP_PADDING + TOOLTIP_HEADLINE_HEIGHT - 4;
                    const rowY = (row: number) => headlineY + TOOLTIP_ROW_HEIGHT * (row + 1);
                    const footerY = ty + TOOLTIP_HEIGHT - TOOLTIP_PADDING - 1;
                    const rows: { key: 'high' | 'low'; name: string }[] = [
                      { key: 'high', name: 'High' },
                      { key: 'low', name: 'Low' },
                    ];
                    return (
                      <>
                        <rect
                          x={tx}
                          y={ty}
                          width={width}
                          height={TOOLTIP_HEIGHT}
                          rx={4}
                          fill={theme.palette.background.paper}
                          stroke={gridColor}
                        />
                        <text
                          x={centre}
                          y={headlineY}
                          fontSize={TOOLTIP_HEADLINE_FONT}
                          fontWeight="bold"
                          textAnchor="middle"
                          fill={theme.palette.text.primary}
                          data-testid="tooltip-close"
                        >
                          {formatPrice(active.price, currency)}
                        </text>
                        {rows.map((row, i) => (
                          <g key={row.key} data-testid={`tooltip-${row.key}`}>
                            <text x={left} y={rowY(i)} fontSize={TOOLTIP_ROW_FONT} fill={textColor}>
                              {row.name}
                            </text>
                            <text x={right} y={rowY(i)} fontSize={TOOLTIP_ROW_FONT} textAnchor="end" fill={theme.palette.text.primary}>
                              {formatPrice(active[row.key], currency)}
                            </text>
                          </g>
                        ))}
                        <text x={left} y={footerY} fontSize={TOOLTIP_FOOTER_FONT} fill={textColor} data-testid="tooltip-label">
                          {active.label}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
