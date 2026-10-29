import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReferenceDatePicker from './ReferenceDatePicker.tsx';

const TODAY = '2026-10-28';

/** Stubs the browser picker (jsdom has none) and returns the spy. */
function stubPicker() {
  const native = screen.getByTestId('reference-date-native') as HTMLInputElement;
  const showPicker = vi.fn();
  native.showPicker = showPicker;
  return { native, showPicker };
}

describe('ReferenceDatePicker', () => {
  it('shows no value until a date has been picked', () => {
    render(<ReferenceDatePicker value="" onChange={() => {}} max={TODAY} />);
    const field = screen.getByRole('textbox', { name: /reference date/i });
    expect(field).toHaveValue('');
    expect(field).not.toHaveAttribute('placeholder');
    expect(field).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Clear reference date' })).not.toBeInTheDocument();
  });

  it('displays a picked date as YYYY-MM-DD and offers to clear it', async () => {
    const onChange = vi.fn();
    render(<ReferenceDatePicker value="2026-10-20" onChange={onChange} max={TODAY} />);
    expect(screen.getByRole('textbox', { name: /reference date/i })).toHaveValue('2026-10-20');

    await userEvent.click(screen.getByRole('button', { name: 'Clear reference date' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('opens the native calendar, capped at max, when the field or its calendar button is clicked', async () => {
    render(<ReferenceDatePicker value="" onChange={() => {}} max={TODAY} />);
    const { native, showPicker } = stubPicker();
    expect(native).toHaveAttribute('type', 'date');
    expect(native).toHaveAttribute('max', TODAY);
    expect(native).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(screen.getByRole('textbox', { name: /reference date/i }));
    expect(showPicker).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    expect(showPicker).toHaveBeenCalledTimes(2);
  });

  it('clearing does not also open the calendar', async () => {
    render(<ReferenceDatePicker value="2026-10-20" onChange={() => {}} max={TODAY} />);
    const { showPicker } = stubPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Clear reference date' }));
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('falls back to focusing the native input where showPicker is unsupported', async () => {
    render(<ReferenceDatePicker value="" onChange={() => {}} max={TODAY} />);
    const native = screen.getByTestId('reference-date-native') as HTMLInputElement;
    delete (native as Partial<HTMLInputElement>).showPicker;
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    expect(native).toHaveFocus();
  });

  it('propagates the date picked in the native calendar', () => {
    const onChange = vi.fn();
    render(<ReferenceDatePicker value="" onChange={onChange} max={TODAY} />);
    // user-event can't drive the browser's picker; a change event is what it produces.
    fireEvent.change(screen.getByTestId('reference-date-native'), { target: { value: '2026-09-01' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-09-01');
  });

  it("propagates the native picker's own Clear as no date", () => {
    const onChange = vi.fn();
    render(<ReferenceDatePicker value="2026-09-01" onChange={onChange} max={TODAY} />);
    fireEvent.change(screen.getByTestId('reference-date-native'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('mirrors the current value into the native input so the calendar opens on it', () => {
    render(<ReferenceDatePicker value="2026-10-20" onChange={() => {}} max={TODAY} />);
    expect(screen.getByTestId('reference-date-native')).toHaveValue('2026-10-20');
  });

  it('marks the field invalid and shows the given error', () => {
    render(<ReferenceDatePicker value="2026-10-29" onChange={() => {}} max={TODAY} error="Cannot be after today (2026-10-28)." />);
    const field = screen.getByRole('textbox', { name: /reference date/i });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('Cannot be after today (2026-10-28).');
  });

  it('can be disabled, in which case nothing opens the calendar', async () => {
    render(<ReferenceDatePicker value={TODAY} onChange={() => {}} max={TODAY} disabled />);
    const { showPicker } = stubPicker();
    expect(screen.getByRole('textbox', { name: /reference date/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear reference date' })).toBeDisabled();
    await userEvent.click(screen.getByTestId('reference-date'));
    expect(showPicker).not.toHaveBeenCalled();
  });
});
