import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppNav from './AppNav.tsx';

describe('AppNav', () => {
  it('offers Analysis and Watchlist, marking the current view', () => {
    render(<AppNav current="watchlist" onChange={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Analysis', 'Watchlist']);
    expect(screen.getByRole('button', { name: 'Watchlist' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Analysis' })).not.toHaveAttribute('aria-current');
  });

  it('reports the chosen view', async () => {
    const onChange = vi.fn();
    render(<AppNav current="analysis" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Watchlist' }));
    expect(onChange).toHaveBeenCalledWith('watchlist');
  });
});
