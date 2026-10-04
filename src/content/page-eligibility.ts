import type { Preferences } from '../core/types';
import { domainMatches } from '../core/text';
import { SITE_ADAPTERS } from './detectors/sites';
export function eligiblePage(document: Document, pageUrl: string, preferences: Preferences): boolean {
  const url = new URL(pageUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (preferences.enabledDomains.some(domain => domainMatches(url.hostname, domain))) return true;
  if (SITE_ADAPTERS.some(adapter => adapter.matches(url.hostname))) return true;
  // Generic detection needs news context, rather than scanning shops or arbitrary web apps.
  const context = `${url.hostname} ${url.pathname} ${document.title} ${document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? ''}`;
  return /(?:\bnews\b|\bnewsroom\b|\bnewspaper\b|daily\s+post|journal|bulletin)/i.test(context);
}
