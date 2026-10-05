import type { AuthFileItem } from '@/types';
import { normalizeRecentRequestAuthIndex } from '@/utils/recentRequests';
import { isDevinFile } from './validators';

const QUOTA_IDENTITY_SEPARATOR = '\0';

/**
 * Cache identity is filename-based for every existing provider. Devin alone can
 * expose multiple credential identities from one physical file, distinguished
 * by auth_index.
 */
export function getQuotaCacheKey(file: AuthFileItem): string {
  if (!isDevinFile(file)) return file.name;
  const authIndex = normalizeRecentRequestAuthIndex(file.authIndex);
  return `${file.name}${QUOTA_IDENTITY_SEPARATOR}${authIndex ?? ''}`;
}

/** Disambiguate same-name Devin cards without ever falling back to account (a secret). */
export function getQuotaDisplayName(file: AuthFileItem): string {
  if (!isDevinFile(file)) return file.name;
  const identity = file.email?.trim() || normalizeRecentRequestAuthIndex(file.authIndex);
  return identity ? `${file.name} · ${identity}` : file.name;
}

/** Resolve a cache identity back to the physical filename used by file mutations. */
export function getQuotaCacheFileName(key: string): string {
  const separatorIndex = key.indexOf(QUOTA_IDENTITY_SEPARATOR);
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex);
}

/** Presentation only: never use masked names as cache keys or API filenames. */
export function maskCredentialName(name: string, showEmails = false): string {
  if (showEmails) return name;
  return name.replace(/([^\s@]+)@([^\s@]+)/g, (_match, local: string, host: string) => {
    const prefix =
      local.match(/^(?:claude|codex|antigravity|kimi|xai|devin|meta|gemini)-/i)?.[0] ?? '';
    const first = local.slice(prefix.length, prefix.length + 1);
    const extension = host.endsWith('.json') ? '.json' : '';
    const domain = extension ? host.slice(0, -extension.length) : host;
    const dot = domain.lastIndexOf('.');
    const suffix = dot < 0 ? '' : domain.slice(dot);
    return `${prefix}${first}•••@${domain.charAt(0)}•••${suffix}${extension}`;
  });
}
