/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for `work` to settle but never resolves/rejects before `ms` have elapsed.
 * Useful for keeping a loading state visible long enough to be perceived.
 */
export async function withMinimumDuration<T>(work: Promise<T>, ms: number): Promise<T> {
  const [outcome] = await Promise.all([
    work.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    ms > 0 ? delay(ms) : Promise.resolve(),
  ]);
  if (outcome.ok) return outcome.value;
  throw outcome.error;
}
