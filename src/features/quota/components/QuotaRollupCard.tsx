import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { getTypeLabel } from '@/features/authFiles/constants';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import type { QuotaRollup } from '../rollup';
import styles from './QuotaRollupCard.module.scss';

export function QuotaRollupCard({ rollup }: { rollup: QuotaRollup }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const total = t('quota_management.rollup_total', {
    remaining: rollup.remaining === null ? '--' : `${rollup.remaining}%`,
    capacity: rollup.capacity,
  });
  return (
    <article className={styles.card}>
      <h2>{getTypeLabel(t, rollup.type)}</h2>
      <div className={styles.headline}>
        <span>{t(rollup.labelKey)}</span>
        <strong>{total}</strong>
      </div>
      <div className={styles.segments} role="img" aria-label={total}>
        {rollup.segments.map((segment) => (
          <span key={segment.key} className={styles.segment} data-level={segment.level}>
            <span style={{ width: `${segment.remaining ?? 0}%` }} />
          </span>
        ))}
      </div>
      {rollup.soonestResetMs !== null && (
        <p className={styles.reset}>
          {formatRelativeInstant(rollup.soonestResetMs, now, i18n.resolvedLanguage)} ·{' '}
          {formatInstantShort(rollup.soonestResetMs)}
        </p>
      )}
      {rollup.secondary && (
        <Collapsible label={t('quota_management.show')}>
          {t(rollup.secondary.labelKey)}{' '}
          {rollup.secondary.remaining === null ? '--' : `${rollup.secondary.remaining}%`}
        </Collapsible>
      )}
    </article>
  );
}
