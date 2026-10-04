import { CATEGORY_IDS, type Preferences, type PreferencePatch } from './types';
import { canonicalUrl, normaliseDomain } from './text';
export function defaultPreferences(): Preferences {
  return { version: 1, configured: false, enabled: true, mode: 'collapse', filteredCategories: [],
    blockedKeywords: [], allowedKeywords: [], disabledDomains: [], enabledDomains: [],
    alwaysShowUrls: [], blockedUrls: [], debug: false };
}
function list(value: unknown, maxLength = 120): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string')
    .map(x => x.trim().slice(0, maxLength)).filter(Boolean))].slice(0, 500) : [];
}
export function sanitisePreferences(input: unknown): Preferences {
  const defaults = defaultPreferences();
  if (!input || typeof input !== 'object') return defaults;
  const data = input as Record<string, unknown>;
  const domains = (value: unknown) => list(value, 253).map(normaliseDomain)
    .filter(x => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x));
  return { version: 1,
    configured: data.configured === true,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    mode: data.mode === 'hide' ? 'hide' : 'collapse',
    filteredCategories: list(data.filteredCategories).filter((x): x is Preferences['filteredCategories'][number] => CATEGORY_IDS.includes(x as never)),
    blockedKeywords: list(data.blockedKeywords), allowedKeywords: list(data.allowedKeywords),
    disabledDomains: domains(data.disabledDomains), enabledDomains: domains(data.enabledDomains),
    alwaysShowUrls: list(data.alwaysShowUrls, 2048).map(canonicalUrl).filter(Boolean),
    blockedUrls: list(data.blockedUrls, 2048).map(canonicalUrl).filter(Boolean), debug: data.debug === true };
}
export function applyPreferencePatch(current: Preferences, patch: PreferencePatch): Preferences {
  return sanitisePreferences({ ...current, ...patch });
}
