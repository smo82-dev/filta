import type { Preferences } from '../core/types';
import { domainMatches } from '../core/text';
import { SITE_ADAPTERS } from './detectors/sites';
// Curated publisher coverage complements structural detection; neither runs on excluded shop/app pages.
const NEWS_PUBLISHERS = [
  'yahoo.com', 'cnn.com', 'foxnews.com', 'nytimes.com', 'nbcnews.com',
  'cbsnews.com', 'abcnews.go.com', 'usatoday.com', 'apnews.com',
  'reuters.com', 'washingtonpost.com', 'msn.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'news.sky.com', 'dailymail.co.uk', 'telegraph.co.uk',
  'independent.co.uk', 'thetimes.com', 'mirror.co.uk', 'thesun.co.uk',
  'ft.com', 'abc.net.au', 'news.com.au', '9news.com.au', 'smh.com.au',
  'theage.com.au', 'sbs.com.au', '7news.com.au', 'theaustralian.com.au',
  'rnz.co.nz', 'stuff.co.nz', 'nzherald.co.nz', '1news.co.nz',
  'odt.co.nz', 'thepress.co.nz', 'thepost.co.nz', 'newsroom.co.nz',
  'thespinoff.co.nz', 'espn.com', 'skysports.com', 'theathletic.com'
];
export function eligiblePage(document: Document, pageUrl: string, preferences: Preferences): boolean {
  const url = new URL(pageUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (preferences.enabledDomains.some(domain => domainMatches(url.hostname, domain))) return true;
  if (SITE_ADAPTERS.some(adapter => adapter.matches(url.hostname))) return true;
  if (NEWS_PUBLISHERS.some(domain => domainMatches(url.hostname, domain))) return true;
  // Generic detection needs news context, rather than scanning shops or arbitrary web apps.
  const context = `${url.hostname} ${url.pathname} ${document.title} ${document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? ''}`;
  return /(?:\bnews\b|\bnewsroom\b|\bnewspaper\b|daily\s+post|journal|bulletin)/i.test(context);
}
