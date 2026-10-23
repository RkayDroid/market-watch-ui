import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrendIndicator from './TrendIndicator.tsx';

describe('TrendIndicator', () => {
  it.each(['up', 'down', 'neutral'] as const)('renders an accessible %s icon', (trend) => {
    render(<TrendIndicator trend={trend} />);
    expect(screen.getByTitle(trend)).toBeInTheDocument();
  });
});
