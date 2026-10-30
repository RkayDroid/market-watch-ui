import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PerformancePeriod } from '../types/performance.ts';
import PerformanceToolbar, { type PerformanceToolbarProps } from './PerformanceToolbar.tsx';

function Harness(props: Partial<PerformanceToolbarProps>) {
  const [period, setPeriod] = useState<PerformancePeriod>('DAY');
  const [referenceDate, setReferenceDate] = useState('');
  return (
    <PerformanceToolbar
      referenceDate={referenceDate}
      onReferenceDateChange={setReferenceDate}
      maxReferenceDate="2026-03-01"
      period={period}
      onPeriodChange={setPeriod}
      onAction={vi.fn()}
      {...props}
    />
  );
}

describe('PerformanceToolbar', () => {
  it('defaults to the Past Performance wording and test ids', async () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    expect(screen.getByTestId('past-performance-toolbar')).toContainElement(screen.getByTestId('period-selector'));
    await userEvent.click(screen.getByRole('button', { name: 'Performance' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fetch-performance')).toBeEnabled();
  });

  it('takes another label and ids for the comparison', async () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} actionLabel="Compare" testId="compare-toolbar" actionTestId="run-compare" />);
    expect(screen.getByTestId('compare-toolbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Performance' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('run-compare'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('disables everything while loading and blocks the action for a future reference date', () => {
    const { rerender } = render(<Harness loading />);
    expect(screen.getByRole('button', { name: 'Performance' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Week' })).toBeDisabled();

    rerender(<Harness referenceDate="2030-01-01" />);
    expect(screen.getByRole('button', { name: 'Performance' })).toBeDisabled();
  });
});
