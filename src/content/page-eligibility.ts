import type { Preferences } from '../core/types';
import { domainMatches } from '../core/text';
import { SITE_ADAPTERS } from './detectors/sites';
// Curated publisher coverage complements structural detection; neither runs on excluded shop/app pages.
const NEWS_PUBLISHERS = [
  'news.yahoo.com', 'yahoo.com', 'cnn.com', 'foxnews.com', 'nytimes.com', 'nbcnews.com',
  'cbsnews.com', 'abcnews.go.com', 'abcnews.com', 'usatoday.com', 'apnews.com',
  'reuters.com', 'washingtonpost.com', 'msn.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'news.sky.com', 'dailymail.co.uk', 'telegraph.co.uk',
  'independent.co.uk', 'thetimes.com', 'mirror.co.uk', 'thesun.co.uk',
  'ft.com', 'abc.net.au', 'news.com.au', '9news.com.au', 'nine.com.au', 'smh.com.au',
  'theage.com.au', 'sbs.com.au', '7news.com.au', 'theaustralian.com.au',
  'rnz.co.nz', 'stuff.co.nz', 'nzherald.co.nz', '1news.co.nz',
  'odt.co.nz', 'thepress.co.nz', 'thepost.co.nz', 'newsroom.co.nz',
  'thespinoff.co.nz', 'espn.com', 'skysports.com', 'theathletic.com',
  // Outside NZ/AU/UK/US (checked live on 23 Oct 2026 where noted, others are major English-language outlets).
  'aljazeera.com', 'ndtv.com', 'news24.com', 'straitstimes.com', 'channelnewsasia.com', 'timesofindia.indiatimes.com',
  'hindustantimes.com', 'thehindu.com', 'indianexpress.com', 'dawn.com', 'scmp.com', 'japantimes.co.jp', 'inquirer.net',
  'cbc.ca', 'ctvnews.ca', 'globalnews.ca', 'theglobeandmail.com', 'rte.ie', 'irishtimes.com', 'independent.ie',
  'nation.africa', 'citizen.digital', 'punchng.com', 'iol.co.za', 'timeslive.co.za', 'dw.com', 'france24.com', 'euronews.com',
  'fijitimes.com.fj', 'fbcnews.com.fj', 'solomonstarnews.com', 'postcourier.com.pg'
];
// Masthead words in a publisher's own domain name ("straitstimes", "nzherald", "chicagotribune").
const MASTHEAD = /(?:times|herald|tribune|gazette|chronicle|inquirer|courier|telegraph|observer|dispatch|guardian)/i;
export function eligiblePage(document: Document, pageUrl: string, preferences: Preferences): boolean {
  const url = new URL(pageUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (preferences.enabledDomains.some(domain => domainMatches(url.hostname, domain))) return true;
  // Shared publisher domains also host mail, shops, games and account portals.
  if (/^\/(?:mail|shopping|shop|store|games|account|login|signin|subscribe|weather|finance\/portfolio)(?:\/|$)/i.test(url.pathname) ||
    /^(?:mail|shopping|shop|store|games|account)\./i.test(url.hostname)) return false;
  if (SITE_ADAPTERS.some(adapter => adapter.matches(url.hostname))) return true;
  if (NEWS_PUBLISHERS.some(domain => domainMatches(url.hostname, domain))) return true;
  // Generic detection needs news context, rather than scanning shops or arbitrary web apps.
  const context = `${url.hostname} ${url.pathname} ${document.title} ${document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? ''}`;
  // "News24", "9News" and "newsday" name themselves with "news" joined to other characters.
  return /(?:\bnews\d*\b|\b\d+news\b|newsday|\bnewsroom\b|\bnewspaper\b|daily\s+post|journal|bulletin)/i.test(context) ||
    MASTHEAD.test(url.hostname) || publisherMarkup(document);
}
// Publishers declare themselves to news aggregators with standard markup. These
// signals hold on sites whose name and title never say "news" (Politico, The Verge,
// a regional paper), without opening FILTA up to shops or web apps.
const NEWS_TYPES = /"@type"\s*:\s*(?:\[[^\]]*)?"(?:NewsMediaOrganization|NewsArticle|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BackgroundNewsArticle|LiveBlogPosting)"/;
const markupCache = new WeakMap<Document, { key: string; news: boolean }>();
function publisherMarkup(document: Document): boolean {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 32);
  const key = `${document.URL}|${scripts.length}`;
  const cached = markupCache.get(document);
  if (cached?.key === key) return cached.news;
  const news = !!document.querySelector('meta[name="news_keywords" i], meta[name="googlebot-news" i], meta[name="syndication-source" i]') ||
    scripts.some(script => NEWS_TYPES.test((script.textContent ?? '').slice(0, 250_000)));
  markupCache.set(document, { key, news });
  return news;
}
