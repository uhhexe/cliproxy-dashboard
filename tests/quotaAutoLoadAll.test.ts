import { expect, test } from 'bun:test';
import { createQuotaAutoLoadScheduler } from '@/features/quota/useQuotaAutoLoadAll';
import type { QuotaFileEntry } from '@/features/quota/logic';

const entries: QuotaFileEntry[] = Array.from({ length: 10 }, (_, i) => ({
  type: 'claude',
  file: { name: `claude-${i}.json` },
}));

test('loads all credentials at most four at a time and skips fresh results', async () => {
  let now = 1000;
  const scheduler = createQuotaAutoLoadScheduler(() => now);
  let inFlight = 0;
  let peak = 0;
  let calls = 0;
  const loader = async (batch: QuotaFileEntry[]) => {
    await Promise.all(
      batch.map(async () => {
        calls++;
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
      })
    );
  };
  await scheduler.load(entries, loader);
  expect(calls).toBe(10);
  expect(peak).toBe(4);
  await scheduler.load(entries, loader);
  expect(calls).toBe(10);
  now += 60_000;
  await scheduler.load(entries, loader);
  expect(calls).toBe(20);
  await scheduler.load(entries, loader, true);
  expect(calls).toBe(30);
});

test('stops queued credentials when the session changes', async () => {
  const scheduler = createQuotaAutoLoadScheduler();
  let active = true;
  let calls = 0;
  await scheduler.load(
    entries,
    async (batch) => {
      calls += batch.length;
      active = false;
    },
    false,
    () => active
  );
  expect(calls).toBe(4);
});

test('serializes overlapping runs and deduplicates newly loaded credentials', async () => {
  const scheduler = createQuotaAutoLoadScheduler();
  let calls = 0;
  const loader = async (batch: QuotaFileEntry[]) => {
    calls += batch.length;
  };
  await Promise.all([scheduler.load(entries, loader), scheduler.load(entries, loader)]);
  expect(calls).toBe(10);
});
