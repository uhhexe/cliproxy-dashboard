import { beforeAll, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { QuotaLedger, QuotaResults } from '@/features/quota/components/QuotaLedger';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { ClaudeQuotaState } from '@/types';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
const entries: QuotaFileEntry[] = Array.from({ length: 5 }, (_, i) => ({
  type: 'claude',
  file: { name: `claude-tom${i}@lab.dev.json` },
}));
const quota: ClaudeQuotaState = {
  status: 'success',
  planType: 'plan_max',
  windows: [
    { id: 'seven-day', label: '7-day limit', usedPercent: 20, resetLabel: '' },
    { id: 'five-hour', label: '5-hour limit', usedPercent: 30, resetLabel: '' },
    { id: 'seven-day-fable', label: '7-day Fable 5', usedPercent: 42, resetLabel: '' },
  ],
};
const quotaFor = () => quota;
test('groups credentials with counts, masked names and ordered Claude columns', () => {
  const html = renderToStaticMarkup(createElement(QuotaLedger, { entries, quotaFor }));
  expect(html).toContain('Claude 5');
  expect(html).toContain('claude-t•••@l•••.dev.json');
  expect(html).not.toContain('tom0@lab');
  expect(html).toContain('Max');
  expect(html.indexOf('7-day Fable 5')).toBeLessThan(html.indexOf('5-hour limit'));
  expect(html.indexOf('5-hour limit')).toBeLessThan(html.indexOf('7-day limit'));
  expect(html).toContain('58%');
});
test('cards view renders the cards grid instead of ledger sections', () => {
  const html = renderToStaticMarkup(
    createElement(QuotaResults, {
      entries,
      quotaFor,
      viewMode: 'cards',
      cardsClassName: 'quota-grid',
      children: createElement('article', null, 'Credential card'),
    })
  );
  expect(html).toContain('class="quota-grid" data-quota-view="cards"');
  expect(html).toContain('Credential card');
  expect(html).not.toContain('<table>');
});
