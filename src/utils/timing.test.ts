import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, withMinimumDuration } from './timing.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('delay', () => {
  it('resolves after the given time', async () => {
    const spy = vi.fn();
    void delay(500).then(spy);
    await vi.advanceTimersByTimeAsync(499);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalled();
  });
});

describe('withMinimumDuration', () => {
  it('holds a fast success until the minimum has elapsed', async () => {
    const spy = vi.fn();
    void withMinimumDuration(Promise.resolve('ok'), 1000).then(spy);
    await vi.advanceTimersByTimeAsync(999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledWith('ok');
  });

  it('holds a fast failure too, then rethrows the original error', async () => {
    const err = new Error('nope');
    const spy = vi.fn();
    void withMinimumDuration(Promise.reject(err), 1000).catch(spy);
    await vi.advanceTimersByTimeAsync(999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledWith(err);
  });

  it('does not add time to slow work', async () => {
    const spy = vi.fn();
    void withMinimumDuration(delay(3000).then(() => 'slow'), 1000).then(spy);
    await vi.advanceTimersByTimeAsync(2999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledWith('slow');
  });

  it('passes through immediately when the minimum is 0', async () => {
    vi.useRealTimers();
    await expect(withMinimumDuration(Promise.resolve(1), 0)).resolves.toBe(1);
  });
});
