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

function claudeFixture(windows: ClaudeQuotaState['windows'][]) {
  const entries: QuotaFileEntry[] = windows.map((_, index) => ({
    type: 'claude',
    file: { name: `claude-${index}.json` },
  }));
  const states: Record<string, ClaudeQuotaState> = Object.fromEntries(
    windows.map((rows, index) => [entries[index].file.name, { status: 'success', windows: rows }])
  );
  return buildProviderRollups(entries, { claude: states })[0];
}
const claudeWindow = (id: string, usedPercent: number | null, resetAtMs: number) => ({
  id,
  usedPercent,
  resetAtMs,
  label: '',
  resetLabel: '',
});

test('mixed Claude credentials prefer Fable and fall back individually to seven-day', () => {
  const rollup = claudeFixture([
    [claudeWindow('seven-day', 10, 500), claudeWindow('seven-day-fable', 42, 3000)],
    [claudeWindow('seven-day', 25, 1000)],
    [],
  ]);
  expect(rollup.labelKey).toBe('claude_quota.seven_day_fable');
  expect(formatRollupTotal(rollup)).toBe('133% of 300%');
  expect(rollup.segments.map(({ remaining, level }) => ({ remaining, level }))).toEqual([
    { remaining: 58, level: 'amber' },
    { remaining: 75, level: 'green' },
    { remaining: null, level: 'unknown' },
  ]);
  expect(rollup.soonestResetMs).toBe(1000);
  expect(rollup.secondary).toEqual({ labelKey: 'claude_quota.seven_day', remaining: 165 });
});

test('Claude without any Fable rows uses the seven-day label and omits the secondary line', () => {
  const rollup = claudeFixture([
    [claudeWindow('seven-day', 20, 3000)],
    [claudeWindow('seven-day', 100, 2000)],
  ]);
  expect(rollup.labelKey).toBe('claude_quota.seven_day');
  expect(formatRollupTotal(rollup)).toBe('80% of 200%');
  expect(rollup.segments.map((segment) => segment.remaining)).toEqual([80, 0]);
  expect(rollup.soonestResetMs).toBe(2000);
  expect(rollup).not.toHaveProperty('secondary');
});

test('an existing Fable row with unknown usage still takes precedence', () => {
  const rollup = claudeFixture([
    [claudeWindow('seven-day-fable', null, 3000), claudeWindow('seven-day', 20, 1000)],
  ]);
  expect(rollup.labelKey).toBe('claude_quota.seven_day_fable');
  expect(rollup.remaining).toBeNull();
  expect(rollup.soonestResetMs).toBe(3000);
  expect(rollup.secondary?.remaining).toBe(80);
});

test('Claude with neither window stays unknown and omits the secondary line', () => {
  const rollup = claudeFixture([[]]);
  expect(rollup.labelKey).toBe('claude_quota.seven_day');
  expect(formatRollupTotal(rollup)).toBe('-- of 100%');
  expect(rollup).not.toHaveProperty('secondary');
});
