import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  MetaQuotaState,
  XaiQuotaState,
} from '@/types';
import { getTypeLabel } from '@/features/authFiles/constants';
import { getQuotaCacheKey, getQuotaDisplayName, maskCredentialName } from '@/utils/quota/identity';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { useQuotaShowEmails } from '../uiState';
import { QUOTA_TAB_ORDER, type QuotaViewMode } from '../constants';
import { quotaWindowSummaries, type QuotaWindowSummary } from '../rollup';
import type { QuotaFileEntry } from '../logic';
import type { QuotaCardState } from '../providers';
import type { QuotaProviderType } from '../providers/types';
import { QuotaMeter } from './QuotaMeter';
import type { QuotaClassMap } from '../types';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaLedger.module.scss';

const meterClasses = bodyStyles as unknown as QuotaClassMap;
const claudeColumns = [
  { id: 'seven-day-fable', labelKey: 'claude_quota.seven_day_fable' },
  { id: 'five-hour', labelKey: 'claude_quota.five_hour' },
  { id: 'seven-day', labelKey: 'claude_quota.seven_day' },
];
function planLabel(type: QuotaProviderType, quota: QuotaCardState | undefined, t: TFunction) {
  if (quota?.status !== 'success') return null;
  if (type === 'claude') {
    const plan = (quota as ClaudeQuotaState).planType;
    return plan ? t(`claude_quota.${plan}`) : null;
  }
  if (type === 'codex') {
    const plan = (quota as CodexQuotaState).planType;
    return plan ? t(`codex_quota.plan_${plan}`, { defaultValue: plan }) : null;
  }
  if (type === 'antigravity') {
    const subscription = (quota as AntigravityQuotaState).subscription;
    return subscription?.plan
      ? t(`antigravity_subscription.plan_${subscription.plan.replace('-', '_')}`, {
          defaultValue: subscription.tierName ?? subscription.plan,
        })
      : null;
  }
  if (type === 'devin') return (quota as DevinQuotaState).plan;
  if (type === 'meta') return (quota as MetaQuotaState).data?.planName;
  if (type === 'xai') return (quota as XaiQuotaState).billing?.planLabel;
  return null;
}
export type QuotaLedgerProps = {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  onRefresh?: (entry: QuotaFileEntry) => void;
  canRefresh?: boolean;
};
export function QuotaLedger({
  entries,
  quotaFor,
  onRefresh,
  canRefresh = false,
}: QuotaLedgerProps) {
  const { t, i18n } = useTranslation();
  const showEmails = useQuotaShowEmails();
  const now = useNow();
  const label = (row: Pick<QuotaWindowSummary, 'labelKey' | 'label' | 'labelParams'>) =>
    row.labelKey ? t(row.labelKey, row.labelParams ?? {}) : row.label;
  return (
    <div className={styles.ledger}>
      {QUOTA_TAB_ORDER.map((type) => {
        const group = entries.filter((entry) => entry.type === type);
        if (!group.length) return null;
        const rows = group.map((entry) => ({
          entry,
          quota: quotaFor(entry),
          windows: quotaWindowSummaries(type, quotaFor(entry)),
        }));
        const columns =
          type === 'claude'
            ? claudeColumns.map((row) => ({ ...row, label: '' }))
            : [
                ...new Map(
                  rows.flatMap((row) => row.windows).map((window) => [window.id, window])
                ).values(),
              ];
        return (
          <section key={type} className={styles.provider}>
            <h2>
              {getTypeLabel(t, type)} {group.length}
            </h2>
            <div
              className={styles.scroll}
              tabIndex={0}
              role="region"
              aria-label={getTypeLabel(t, type)}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('quota_management.credential')}</th>
                    {columns.map((column) => (
                      <th scope="col" key={column.id}>
                        {label(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ entry, quota, windows }) => {
                    const name = maskCredentialName(getQuotaDisplayName(entry.file), showEmails);
                    const plan = planLabel(type, quota, t);
                    return (
                      <tr key={getQuotaCacheKey(entry.file)}>
                        <th scope="row">
                          <span className={styles.name} title={name}>
                            {name}
                          </span>
                          {plan && <span className={styles.plan}>{plan}</span>}
                          {quota?.status !== 'success' && (
                            <span className={styles.status} role="status">
                              {t(
                                `${type}_quota.${quota?.status === 'loading' ? 'loading' : quota?.status === 'error' ? 'load_failed' : 'idle'}`,
                                { message: t('common.unknown_error') }
                              )}
                            </span>
                          )}
                          {onRefresh && (
                            <button
                              type="button"
                              className={styles.refresh}
                              disabled={
                                !canRefresh ||
                                quota?.status === 'loading' ||
                                Boolean(entry.file.disabled)
                              }
                              aria-label={`${t('auth_files.quota_refresh_single')} ${name}`}
                              onClick={() => onRefresh(entry)}
                            >
                              {t('auth_files.quota_refresh_single')}
                            </button>
                          )}
                        </th>
                        {columns.map((column) => {
                          const window = windows.find((item) => item.id === column.id);
                          const reset = buildResetDisplay(
                            null,
                            window?.resetAtMs,
                            now,
                            i18n.resolvedLanguage
                          );
                          return (
                            <td key={column.id}>
                              <div className={styles.percent}>
                                {window?.remaining == null
                                  ? '--'
                                  : `${Math.round(window.remaining)}%`}
                              </div>
                              <QuotaMeter
                                percent={window?.remaining ?? null}
                                classes={meterClasses}
                              />
                              {reset ? (
                                <div className={styles.reset}>
                                  {reset.relative && `${reset.relative} · `}
                                  {reset.absolute}
                                </div>
                              ) : (
                                <div className={styles.reset}>
                                  {t('quota_management.no_reset_pending')}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Shared branch for the live page and server rendering coverage. */
export function QuotaResults({
  viewMode,
  children,
  cardsClassName,
  ...props
}: QuotaLedgerProps & {
  viewMode: QuotaViewMode;
  children: ReactNode;
  cardsClassName: string;
}) {
  return viewMode === 'ledger' ? (
    <QuotaLedger {...props} />
  ) : (
    <div className={cardsClassName} data-quota-view="cards">
      {children}
    </div>
  );
}
