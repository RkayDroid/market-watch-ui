import { useMemo, useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { computePriceChartLayout, type PriceChartLayout } from '../charts/priceChartLayout.ts';
import { useElementWidth } from '../hooks/useElementWidth.ts';
import type { HourlyPrice } from '../types/stock.ts';

export interface PriceChartProps {
  history: HourlyPrice[];
  /** Fixed pixel width. When omitted the chart measures and fills its container. */
  width?: number;
  /** Pixel height of the SVG. */
  height?: number;
  title?: string;
}

export const DEFAULT_CHART_WIDTH = 800;
export const DEFAULT_CHART_HEIGHT = 280;

const POINT_RADIUS = 3;
const ACTIVE_POINT_RADIUS = 5;
const TOOLTIP_WIDTH = 150;
const TOOLTIP_HEIGHT = 40;

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/** Position the tooltip above the point, flipping/clamping so it stays inside the plot. */
function tooltipPosition(layout: PriceChartLayout, x: number, y: number) {
  const { plot } = layout;
  let tx = x - TOOLTIP_WIDTH / 2;
  tx = Math.max(plot.left, Math.min(tx, plot.right - TOOLTIP_WIDTH));
  let ty = y - TOOLTIP_HEIGHT - 12;
  if (ty < plot.top) ty = y + 12;
  return { tx, ty };
}

export default function PriceChart({
  history,
  width: fixedWidth,
  height = DEFAULT_CHART_HEIGHT,
  title = '24-Hour Price Trend',
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
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
              aria-label={`${title}: ${points.length} hourly price points`}
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
                    {formatPrice(tick.value)}
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
                    <title>{`${p.hour}: ${formatPrice(p.price)}`}</title>
                  </circle>
                </g>
              ))}

              {/* Tooltip */}
              {active && (
                <g data-testid="price-tooltip" pointerEvents="none">
                  <line x1={active.x} x2={active.x} y1={plot.top} y2={plot.bottom} stroke={lineColor} strokeOpacity={0.4} />
                  {(() => {
                    const { tx, ty } = tooltipPosition(layout, active.x, active.y);
                    return (
                      <>
                        <rect
                          x={tx}
                          y={ty}
                          width={TOOLTIP_WIDTH}
                          height={TOOLTIP_HEIGHT}
                          rx={4}
                          fill={theme.palette.background.paper}
                          stroke={gridColor}
                        />
                        <text x={tx + 8} y={ty + 16} fontSize={11} fill={textColor}>
                          {active.hour}
                        </text>
                        <text x={tx + 8} y={ty + 32} fontSize={13} fontWeight="bold" fill={theme.palette.text.primary}>
                          {formatPrice(active.price)}
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
