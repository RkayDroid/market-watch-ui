import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingIndicator from './LoadingIndicator.tsx';

describe('LoadingIndicator', () => {
  it('announces fetching for the pending symbol', () => {
    render(<LoadingIndicator symbol="AAPL" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Fetching results for AAPL…');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('falls back to a generic message without a symbol', () => {
    render(<LoadingIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching results…');
  });
});
