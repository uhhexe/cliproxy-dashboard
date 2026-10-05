import { useSyncExternalStore } from 'react';
import {
  QUOTA_SORT_MODES,
  QUOTA_VIEW_MODES,
  type QuotaViewMode,
  QUOTA_TAB_ORDER,
  type QuotaSortMode,
  type QuotaTabId,
} from './constants';

/** 额度页 UI 偏好：会话级持久化（sessionStorage），跨会话不携带。 */
export type QuotaUiState = {
  showEmails?: boolean;
  viewMode?: QuotaViewMode;
  tab?: QuotaTabId;
  sortMode?: QuotaSortMode;
};

const QUOTA_UI_STATE_KEY = 'quotaPage.uiState';
let unavailableStorageState: QuotaUiState | null = null;

const QUOTA_TAB_ID_SET = new Set<string>(['all', ...QUOTA_TAB_ORDER]);
const QUOTA_SORT_MODE_SET = new Set<string>(QUOTA_SORT_MODES);

export const isQuotaTabId = (value: unknown): value is QuotaTabId =>
  typeof value === 'string' && QUOTA_TAB_ID_SET.has(value);

export const isQuotaSortMode = (value: unknown): value is QuotaSortMode =>
  typeof value === 'string' && QUOTA_SORT_MODE_SET.has(value);

export const readQuotaUiState = (): QuotaUiState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(QUOTA_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuotaUiState;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...(typeof parsed.showEmails === 'boolean' ? { showEmails: parsed.showEmails } : {}),
      ...(QUOTA_VIEW_MODES.includes(parsed.viewMode as QuotaViewMode)
        ? { viewMode: parsed.viewMode }
        : {}),
      tab: isQuotaTabId(parsed.tab) ? parsed.tab : undefined,
      sortMode: isQuotaSortMode(parsed.sortMode) ? parsed.sortMode : undefined,
    };
  } catch {
    return unavailableStorageState;
  }
};

/**
 * Merge into whatever is already stored.
 *
 * Callers write one preference at a time — the tab strip knows nothing about
 * the sort control — so a whole-object write would silently drop the other
 * field every time either one changed.
 */
export const writeQuotaUiState = (state: QuotaUiState) => {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...readQuotaUiState(), ...state };
    window.sessionStorage.setItem(QUOTA_UI_STATE_KEY, JSON.stringify(next));
  } catch {
    // Keep controls usable even when browser storage is unavailable.
    unavailableStorageState = { ...readQuotaUiState(), ...state };
  }
  listeners.forEach((listener) => listener());
};

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getShowEmails = () => readQuotaUiState()?.showEmails ?? false;
export const useQuotaShowEmails = () => useSyncExternalStore(subscribe, getShowEmails, () => false);
