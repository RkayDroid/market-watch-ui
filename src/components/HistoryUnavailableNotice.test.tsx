import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HistoryUnavailableNotice from './HistoryUnavailableNotice.tsx';

describe('HistoryUnavailableNotice', () => {
  it('explains why the chart and table are missing without raising an alert', () => {
    render(<HistoryUnavailableNotice />);
    expect(screen.getByRole('note')).toHaveTextContent(/does not provide historic prices/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
