import { useCallback, useEffect, useMemo } from 'react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from './logic';

type Loader = (entries: QuotaFileEntry[]) => Promise<void>;

/** Batches share one queue because the existing batch loader rejects overlapping calls. */
export function createQuotaAutoLoadScheduler(now = Date.now) {
  const loadedAt = new Map<string, number>();
  let tail = Promise.resolve();
  return {
    load(
      entries: QuotaFileEntry[],
      loader: Loader,
      force = false,
      current = () => true,
      namespace = ''
    ) {
      const run = async () => {
        const targets = entries.filter((entry) => {
          const at = loadedAt.get(`${namespace}:${entry.type}:${getQuotaCacheKey(entry.file)}`);
          return force || at === undefined || now() - at >= 60_000;
        });
        for (let index = 0; index < targets.length && current(); index += 4) {
          const batch = targets.slice(index, index + 4);
          await loader(batch);
          if (!current()) return;
          batch.forEach((entry) => {
            loadedAt.set(`${namespace}:${entry.type}:${getQuotaCacheKey(entry.file)}`, now());
          });
        }
      };
      const result = tail.then(run);
      tail = result.catch(() => {});
      return result;
    },
  };
}

export function useQuotaAutoLoadAll(entries: QuotaFileEntry[], disabled: boolean, loader: Loader) {
  const session = useQuotaStore((state) => state.cacheGeneration);
  const scheduler = useMemo(() => createQuotaAutoLoadScheduler(), []);
  const refreshAll = useCallback(
    (targets: QuotaFileEntry[] = entries) =>
      scheduler.load(
        targets,
        loader,
        true,
        () => session === useQuotaStore.getState().cacheGeneration,
        String(session)
      ),
    [entries, loader, scheduler, session]
  );
  useEffect(() => {
    if (disabled) return;
    let active = true;
    void scheduler.load(
      entries,
      loader,
      false,
      () => active && session === useQuotaStore.getState().cacheGeneration,
      String(session)
    );
    return () => {
      active = false;
    };
  }, [disabled, entries, loader, scheduler, session]);
  return refreshAll;
}
