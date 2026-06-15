/**
 * batch.ts — shared concurrency utility.
 *
 * Splits an array into chunks and runs each chunk in parallel
 * via Promise.allSettled (so one failure doesn't stop the batch).
 * Returns a flat array of settled results.
 */

export interface BatchResult<T> {
  value?: T;
  error?: Error;
}

export async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<BatchResult<R>[]> {
  const results: BatchResult<R>[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      chunk.map((item, j) => fn(item, i + j))
    );
    for (const s of settled) {
      if (s.status === "fulfilled") results.push({ value: s.value });
      else results.push({ error: s.reason as Error });
    }
  }

  return results;
}
