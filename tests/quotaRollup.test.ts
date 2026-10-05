import { expect, test } from 'bun:test';
import { buildProviderRollups, formatRollupTotal, type QuotaByType } from '@/features/quota/rollup';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { ClaudeQuotaState } from '@/types';

function fixture(type: 'claude' | 'codex', values: number[]) {
  const entries: QuotaFileEntry[] = values.map((_, i) => ({ type, file: { name: `${i}.json` } }));
  const states: Record<string, ClaudeQuotaState> = Object.fromEntries(
    values.map((value, i) => [
      `${i}.json`,
      {
        status: 'success',
        windows: [
          {
            id: type === 'claude' ? 'seven-day-fable' : 'weekly',
            label: '',
            resetLabel: '',
            usedPercent: 100 - value,
            resetAtMs: 10000 + i * 1000,
          },
        ],
      },
    ])
  );
  return buildProviderRollups(entries, { [type]: states } as QuotaByType)[0];
}
test('Claude headline sums every credential with matching levels and earliest reset', () => {
  const rollup = fixture('claude', [58, 100, 100, 51, 100]);
  expect(formatRollupTotal(rollup)).toBe('409% of 500%');
  expect(rollup.segments).toHaveLength(5);
  expect(rollup.segments.map((s) => s.level)).toEqual([
    'amber',
    'green',
    'green',
    'amber',
    'green',
  ]);
  expect(rollup.soonestResetMs).toBe(10000);
});
test('Codex weekly capacity includes exhausted credentials', () => {
  expect(formatRollupTotal(fixture('codex', [17, 0, 0]))).toBe('17% of 300%');
});
test('unknown credentials count toward capacity without inventing usage', () => {
  const rollup = buildProviderRollups([{ type: 'xai', file: { name: 'unknown.json' } }], {})[0];
  expect(formatRollupTotal(rollup)).toBe('-- of 100%');
  expect(rollup.segments[0].level).toBe('unknown');
  expect(rollup.soonestResetMs).toBeNull();
});
