import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementWidth } from './useElementWidth.ts';

function Probe() {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  return (
    <div ref={ref} data-testid="probe">
      {width}
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useElementWidth', () => {
  it('returns the fallback when the element cannot be measured (jsdom)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('640');
  });

  it('uses the measured width and reacts to resize notifications', () => {
    let notify: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 1000.4 } as DOMRect);

    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('1000');
    expect(observe).toHaveBeenCalledTimes(1);

    rect.mockReturnValue({ width: 512 } as DOMRect);
    act(() => notify?.());
    expect(screen.getByTestId('probe')).toHaveTextContent('512');

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
