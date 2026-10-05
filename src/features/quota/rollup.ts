import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  XaiQuotaState,
} from '@/types';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from './logic';
import type { QuotaCardState } from './providers';
import type { QuotaProviderType } from './providers/types';
import { QUOTA_TAB_ORDER } from './constants';
import {
  QUOTA_PROGRESS_HIGH_THRESHOLD,
  QUOTA_PROGRESS_MEDIUM_THRESHOLD,
} from './components/QuotaMeter';

export type QuotaWindowSummary = {
  id: string;
  label: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  remaining: number | null;
  resetAtMs: number | null;
};
export type QuotaByType = Partial<Record<QuotaProviderType, Record<string, QuotaCardState>>>;
const percent = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
const remaining = (used: number | null | undefined) => (used == null ? null : percent(100 - used));
const instant = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** A read-only presentation model over already normalized provider states. */
export function quotaWindowSummaries(
  type: QuotaProviderType,
  quota?: QuotaCardState
): QuotaWindowSummary[] {
  if (quota?.status !== 'success') return [];
  switch (type) {
    case 'claude':
    case 'codex':
      return (quota as ClaudeQuotaState | CodexQuotaState).windows.map((row) => ({
        ...row,
        remaining: remaining(row.usedPercent),
        resetAtMs: instant(row.resetAtMs),
      }));
    case 'antigravity':
      return (quota as AntigravityQuotaState).groups.flatMap((group) =>
        group.buckets.map((row) => ({
          id: `${group.id}:${row.id}`,
          label: `${group.label} · ${row.label}`,
          remaining: percent(row.remainingFraction * 100),
          resetAtMs: instant(row.resetAtMs),
        }))
      );
    case 'kimi':
      return (quota as KimiQuotaState).rows.map((row) => ({
        ...row,
        label: row.label ?? '',
        remaining:
          row.limit > 0 ? remaining((row.used / row.limit) * 100) : row.used > 0 ? 0 : null,
        resetAtMs: instant(row.resetAtMs),
      }));
    case 'xai': {
      const row = (quota as XaiQuotaState).billing;
      if (!row || row.mode !== 'billing') return [];
      return [
        {
          id: row.periodType,
          label: '',
          labelKey:
            row.periodType === 'weekly' ? 'xai_quota.weekly_limit' : 'xai_quota.monthly_credits',
          remaining: remaining(row.usagePercent),
          resetAtMs: instant(row.resetAtMs),
        },
      ];
    }
    case 'devin':
      return (quota as DevinQuotaState).windows.map((row) => ({
        ...row,
        label: row.label ?? '',
        labelKey: `devin_quota.${row.id}`,
        remaining: percent(row.remainingPercent),
        resetAtMs: instant(row.resetAtMs),
      }));
    case 'meta':
      return ((quota as MetaQuotaState).data?.windows ?? []).map((row) => ({
        id: row.id,
        label: '',
        labelKey: row.id === 'weekly' ? 'meta_quota.weekly' : 'meta_quota.window',
        remaining: remaining(row.usedPercent),
        resetAtMs: instant(row.resetAt == null ? null : row.resetAt * 1000),
      }));
  }
}

export type QuotaSegment = {
  key: string;
  remaining: number | null;
  level: 'green' | 'amber' | 'red' | 'unknown';
};
export type QuotaRollup = {
  type: QuotaProviderType;
  labelKey: string;
  remaining: number | null;
  capacity: number;
  segments: QuotaSegment[];
  soonestResetMs: number | null;
  secondary?: { labelKey: string; remaining: number | null };
};
const sumKnown = (values: (number | null)[]) => {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? Math.round(known.reduce((sum, value) => sum + value, 0)) : null;
};
export const formatRollupTotal = (rollup: Pick<QuotaRollup, 'remaining' | 'capacity'>) =>
  `${rollup.remaining === null ? '--' : `${rollup.remaining}%`} of ${rollup.capacity}%`;

export function buildProviderRollups(
  entries: QuotaFileEntry[],
  quotaByType: QuotaByType
): QuotaRollup[] {
  return QUOTA_TAB_ORDER.flatMap((type) => {
    const group = entries.filter((entry) => entry.type === type);
    if (!group.length) return [];
    const windows = group.map((entry) =>
      quotaWindowSummaries(type, quotaByType[type]?.[getQuotaCacheKey(entry.file)])
    );
    const hasFable =
      type === 'claude' && windows.some((rows) => rows.some((row) => row.id === 'seven-day-fable'));
    const headlines = windows.map((rows) => {
      if (type === 'antigravity')
        return rows
          .filter((row) => row.remaining !== null)
          .sort((a, b) => a.remaining! - b.remaining!)[0];
      if (type === 'kimi') return rows.find((row) => row.labelKey === 'kimi_quota.weekly_limit');
      if (type === 'claude') {
        return (
          rows.find((row) => row.id === 'seven-day-fable') ??
          rows.find((row) => row.id === 'seven-day')
        );
      }
      return rows.find((row) => row.id === 'weekly');
    });
    const resets = headlines.map((row) => row?.resetAtMs).filter((at): at is number => at != null);
    const segments: QuotaSegment[] = group.map((entry, i) => {
      const value = headlines[i]?.remaining ?? null;
      return {
        key: getQuotaCacheKey(entry.file),
        remaining: value,
        level:
          value === null
            ? 'unknown'
            : value >= QUOTA_PROGRESS_HIGH_THRESHOLD
              ? 'green'
              : value >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
                ? 'amber'
                : 'red',
      };
    });
    return [
      {
        type,
        labelKey:
          type === 'claude'
            ? hasFable
              ? 'claude_quota.seven_day_fable'
              : 'claude_quota.seven_day'
            : type === 'antigravity'
              ? 'quota_management.lowest_group'
              : 'quota_management.weekly_limit',
        remaining: sumKnown(segments.map((segment) => segment.remaining)),
        capacity: group.length * 100,
        segments,
        soonestResetMs: resets.length ? Math.min(...resets) : null,
        ...(hasFable
          ? {
              secondary: {
                labelKey: 'claude_quota.seven_day',
                remaining: sumKnown(
                  windows.map(
                    (rows) => rows.find((row) => row.id === 'seven-day')?.remaining ?? null
                  )
                ),
              },
            }
          : {}),
      },
    ];
  });
}
