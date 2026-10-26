import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PeriodSelector from './PeriodSelector.tsx';

describe('PeriodSelector', () => {
  it('renders the six periods as radios and marks the current one', () => {
    render(<PeriodSelector value="MONTH" onChange={() => {}} />);

    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['DAY', 'WEEK', 'MONTH', 'HALF_YEAR', 'YEAR', 'FIVE_YEAR']);
    expect(screen.getByRole('radio', { name: 'Day' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Six Months' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '5 Years' })).toBeInTheDocument();
    expect(screen.getByText('Period:')).toBeInTheDocument();
  });

  it('reports the chosen period through onChange', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="DAY" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Year' }));
    expect(onChange).toHaveBeenCalledWith('YEAR');

    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(onChange).toHaveBeenCalledTimes(1); // already selected → no change
  });

  it('can be disabled', () => {
    render(<PeriodSelector value="DAY" onChange={() => {}} disabled />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});
