import type { DetectedStory, StoryDetector } from '../../core/types';
import { canonicalUrl, normalise } from '../../core/text';
import { extractMetadata, markers, metadataElement, ownedVisibleContent, scanCache, withStyleCache } from './labels';
import { structuredSections } from './structured';
export type Root = Document | HTMLElement | ShadowRoot;
// Web-component feeds (MSN and others) render cards inside open shadow roots,
// which querySelectorAll and closest() do not cross. These helpers walk the
// composed tree so protection and discovery behave the same inside and out.
export function composedParent(element: Element): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}
export function composedClosest(element: Element, selector: string): Element | null {
  for (let current: Element | null = element; current;) {
    const hit = current.closest(selector);
    if (hit) return hit;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}
// Content scripts may reach closed roots through the platform; tests and pages use open ones.
let shadowRootOf: (element: Element) => ShadowRoot | null = element => element.shadowRoot;
export function useShadowRootResolver(resolver: (element: Element) => ShadowRoot | null) { shadowRootOf = resolver; }
export function openShadowRoots(root: Root, limit = 4000): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  const visit = (scope: Document | Element | ShadowRoot) => {
    for (const element of scope.querySelectorAll('*')) {
      const shadow = shadowRootOf(element);
      if (!shadow || found.length >= limit) continue;
      found.push(shadow); visit(shadow);
    }
  };
  const own = root instanceof Element ? shadowRootOf(root) : null;
  if (own) { found.push(own); visit(own); }
  visit(root);
  return found;
}
const PROTECTED = 'nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"], [role="dialog"], [role="alert"], [role="menu"], form, [data-related], [data-recommendations], [data-news-filter-ui], [data-emergency], .article-body, .article__body, [itemprop="articleBody"]';
export const CARD = 'article, li, [class*="story"], [class*="card"], [class*="teaser"], [class*="fc-item"], [data-testid*="card"], [data-testid*="story"], [data-testid*="article"], [data-type="article"], [itemtype*="NewsArticle"]';
const HEADINGS = 'h2, h3, h4, h5, h6, [role="heading"], [itemprop="headline"], [data-testid*="headline"], [class*="headline"], [class*="heading"], [class*="title"]';
const NAVIGATION_URL = /\/(?:login|signin|subscribe|account|privacy|cookie|tag|tags|topic|topics|category|categories|profile|authors?|app)(?:\/|$)/i;
const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
const plausible = (value: string) => !/<[a-z][^>]*>/i.test(value) && value.length >= 12 && value.length <= 320 && /\s/.test(value);
export function nodes(root: Root, selector: string): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) all.unshift(root);
  return all;
}
export function headingLink(heading: HTMLElement): HTMLAnchorElement | null {
  return heading.closest<HTMLAnchorElement>('a[href]') ?? heading.querySelector<HTMLAnchorElement>('a[href]');
}
function linkUrl(link: HTMLAnchorElement, pageUrl: string): string {
  const href = link.getAttribute('href')?.trim();
  if (!href || href.startsWith('#')) return '';
  const memo = scanCache()?.urls, key = `${pageUrl} ${href}`;
  const cached = memo?.get(key);
  if (cached !== undefined) return cached;
  let url = '';
  try { url = canonicalUrl(new URL(href, pageUrl).href); } catch { /* malformed */ }
  memo?.set(key, url);
  return url;
}
function headlineAnchor(link: HTMLAnchorElement): boolean {
  const memo = scanCache()?.headlineAnchors;
  const cached = memo?.get(link);
  if (cached !== undefined) return cached;
  const value = isHeadlineAnchor(link);
  memo?.set(link, value);
  return value;
}
function isHeadlineAnchor(link: HTMLAnchorElement): boolean {
  let text = clean(link.textContent);
  for (const caption of link.querySelectorAll('figcaption, [class*="caption" i], [class*="credit" i]')) text = text.replace(clean(caption.textContent), '').trim();
  return !link.matches('[rel~="tag"], [download]') && !link.closest('p, time, button, [data-news-filter-ui]') &&
    plausible(text) && !/^(?:read more|view all|see all|subscribe|sign in|log in)\b/i.test(clean(link.textContent));
}
function storyLinks(element: HTMLElement, pageUrl: string): HTMLAnchorElement[] {
  return [...new Set([
    ...nodes(element, HEADINGS).map(headingLink).filter((x): x is HTMLAnchorElement => !!x),
    ...nodes(element, 'a[href]').filter((x): x is HTMLAnchorElement => x instanceof HTMLAnchorElement && headlineAnchor(x)),
  ])].filter(link => {
    if (!(link === element || element.contains(link)) || !ownedVisibleContent(link, element, false, true)) return false;
    const url = linkUrl(link, pageUrl);
    if (!url || NAVIGATION_URL.test(new URL(url).pathname)) return false;
    // Taxonomy, byline and related-story links are not competing story URLs.
    for (let current: HTMLElement | null = link; current && current !== element; current = current.parentElement) {
      if (metadataElement(current) && !current.querySelector(HEADINGS) && !current.matches(HEADINGS)) return false;
    }
    return true;
  });
}
export function protectedElement(element: HTMLElement): boolean {
  if (composedClosest(element, PROTECTED)) return true;
  if (composedClosest(element, '[itemtype$="/Person"], [itemprop="author"]')) return true;
  const header = composedClosest(element, 'header');
  if (header && !header.closest(CARD)) return true;
  return protectedChain(element);
}
// Marker-based protection holds for an element if it holds for any composed ancestor
// below <body>; memoise along the chain so shared ancestors are judged once per scan.
function protectedChain(element: HTMLElement): boolean {
  const memo = scanCache()?.protectedChain;
  const pending: HTMLElement[] = [];
  let result = false;
  for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== document.body; ancestor = composedParent(ancestor)) {
    const known = memo?.get(ancestor);
    if (known !== undefined) { result = known; break; }
    pending.push(ancestor);
    if (ownProtectedMarker(ancestor)) { result = true; break; }
  }
  // Every element walked shares the outcome: protected ancestors protect descendants.
  if (memo) for (const value of pending) memo.set(value, result);
  return result;
}
function ownProtectedMarker(ancestor: HTMLElement): boolean {
  // Custom elements carry their role in the tag name (responsive-header, site-nav-menu).
  if (ancestor.tagName.includes('-') && /(?:^|-)(header|footer|nav|navigation|menu|toolbar|banner|masthead|consent|cookie)(?:-|$)/i.test(ancestor.tagName)) return true;
  const value = markers(ancestor);
  return /(?:^|[-_\s])(cookie|consent|privacy|advert|advertisement|navigation|emergency|alert)(?:$|[-_\s])/i.test(value) ||
    /(?:^|[-_\s])(byline|toolbar|menu)(?:$|[-_\s])/i.test(value);
}
export interface DiscoveryDiagnostics { candidates: number; detected: number; rejected: Record<string, number> }
export interface ExtractionHints { headline: HTMLElement; link: HTMLAnchorElement; section?: string }
export function extractCard(element: HTMLElement, pageUrl: string, detector: string, hints?: ExtractionHints, rejected?: (reason: string) => void): DetectedStory<HTMLElement> | null {
  const reject = (reason: string) => { rejected?.(reason); return null; };
  if (!element.isConnected || protectedElement(element) || element.matches(HEADINGS)) return reject('protected-or-fragment');
  if (['BODY', 'MAIN', 'SECTION', 'HTML', 'HEADER', 'FOOTER', 'NAV', 'P'].includes(element.tagName)) return reject('page-container');
  // A reading view or a collection of multiple stories is never a card.
  if (element.querySelector('h1, [itemprop="articleBody"], .article-body, .article__body')) return reject('reading-view');
  if ([...element.querySelectorAll<HTMLElement>('article, li')].filter(child => ownedVisibleContent(child, element)).some(child =>
    nodes(child, HEADINGS).some(heading => !!headingLink(heading)) || nodes(child, 'a[href]').some(link => link instanceof HTMLAnchorElement && headlineAnchor(link)))) return reject('nested-story-boundary');
  const links = [...new Set([...(hints ? [hints.link] : []), ...storyLinks(element, pageUrl)])];
  const urls = new Set(links.map(link => linkUrl(link, pageUrl)).filter(Boolean));
  if (urls.size > 1) return reject('multiple-stories');
  let link = links.find(value => plausible(clean(value.textContent)) || value === hints?.link);
  // Overlay cards may keep headline text outside an empty, accessible story link.
  const headings = nodes(element, HEADINGS).filter(value => ownedVisibleContent(value, element, false, true) && plausible(clean(value.textContent)) && !value.querySelector(HEADINGS));
  if (!link && headings.length === 1) {
    const overlays = nodes(element, 'a[href]').filter((value): value is HTMLAnchorElement => value instanceof HTMLAnchorElement &&
      !value.matches('[rel~="tag"]') && !value.closest('p') && ownedVisibleContent(value, element) && !metadataElement(value) && !!linkUrl(value, pageUrl));
    if (new Set(overlays.map(value => linkUrl(value, pageUrl))).size === 1) link = overlays[0];
  }
  if (!link) return reject('no-headline-link');
  const headlineElement = hints?.headline ?? headings.find(heading => headingLink(heading) === link) ?? (headings.length === 1 ? headings[0] : undefined);
  const headline = clean(headlineElement?.textContent || link.textContent);
  if (!plausible(headline)) return reject('implausible-headline');
  if (element.querySelectorAll('p').length > 3 || clean(element.textContent).length > 1600) return reject('oversized');
  if (element.querySelector('form, input, select, [role="dialog"], [role="alert"]')) return reject('interactive-controls');
  const url = linkUrl(link, pageUrl);
  if (!url || url === canonicalUrl(pageUrl)) return reject('invalid-or-current-url');
  const parsed = new URL(url);
  if (NAVIGATION_URL.test(parsed.pathname)) return reject('navigation-url');
  if (parsed.pathname === '/' || !parsed.pathname.split('/').filter(Boolean).length) return reject('navigation-url');
  const lastSegment = parsed.pathname.split('/').filter(Boolean).at(-1) ?? '';
  try { if (headline.split(/\s+/).length <= 3 && normalise(headline) === normalise(decodeURIComponent(lastSegment))) return reject('section-landing-link'); } catch { /* optional URL hint */ }
  const descriptionElement = [...element.querySelectorAll<HTMLElement>('p, [itemprop="description"], [data-testid="card-description"], [class*="summary"], [class*="description"]')]
    .find(value => ownedVisibleContent(value, element) && !value.querySelector('h1,h2,h3,h4,h5,h6,article,aside,nav,footer,form,button,time,[data-ad-slot],[data-recommendations]'));
  const description = clean(descriptionElement?.textContent);
  const metadata = extractMetadata(element, headlineElement);
  // Native ads rarely repeat a disclosure on every tile; the ad network still shows in
  // the click URL, the widget around the tile, or a lone "Sponsored" link.
  const commercial = commercialDisclosure(element, link, pageUrl);
  if (commercial && !metadata.labels.some(label => normalise(label) === normalise(commercial))) metadata.labels.push(commercial);
  const section = clean(hints?.section || element.getAttribute('data-section') || element.getAttribute('data-category') ||
    element.querySelector('[itemprop="articleSection"]')?.getAttribute('content') || metadata.section || structuredSections(element.ownerDocument).get(url));
  const image = element.querySelector<HTMLImageElement>('img');
  let imageUrl: string | undefined;
  try {
    const src = image?.getAttribute('src') || image?.getAttribute('data-src');
    const resolved = src ? new URL(src, pageUrl) : undefined;
    if (resolved && ['http:', 'https:'].includes(resolved.protocol)) imageUrl = resolved.href;
  } catch { /* an image is optional; never fetch it */ }
  return { handle: element, detector, story: { headline, description: description || undefined, url,
    imageUrl, section: section.slice(0, 96) || undefined, labels: metadata.labels.length ? metadata.labels : undefined,
    sourceDomain: new URL(pageUrl).hostname } };
}
// Click and redirect endpoints that only ad networks use, and widgets that only carry
// paid placements. Ordinary links to other publishers are never treated as ads.
const AD_CLICK = /(?:^|\.)(?:taboola\.com|outbrain\.com|zemanta\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|adnxs\.com|criteo\.com|amazon-adsystem\.com|revcontent\.com|mgid\.com|nativo\.com|ntv\.io|sharethrough\.com|dianomi\.com|zergnet\.com|plista\.com|ligatus\.com|teads\.tv|smartadserver\.com|clickserve\.dartsearch\.net)$/i;
const AD_PATH = /^(?:www\.)?bing\.com\/(?:api\/v\d+\/mediation|aclick)|^beap\.gemini\.yahoo\.com\//i;
const PAID_UTM = /^(?:taboola|outbrain|zemanta|dianomi|revcontent|mgid|nativo|plista|ligatus|sharethrough)$/i;
const PAID_MEDIUM = /^(?:paid|cpc|ppc|native|nativead|native-ad|sponsored|paidsocial|paid[-_ ]?content)$/i;
// Only names the ad networks themselves use. Short tokens such as "trc", "ob" and "ntv" are ordinary
// publisher class names (NDTV wraps its whole front page in "trc-main"; NTV is a broadcaster), so
// Taboola counts only in its own underscore form ("trc_rbox") and Outbrain only as its widget names.
const NATIVE_WIDGET = /(?:^|[-_\s])(taboola|outbrain|ob-widget|ob-dynamic-rec-container|zergnet|dianomi|revcontent|mgid|nativo|plista|ligatus|nativead|native-ad|native_ad|nativeads)(?:$|[-_\s\d])|(?:^|\s)trc_(?:rbox|related|spotlight|vertical|horizontal|item|elastic)/i;
const DISCLOSURE = /^(?:sponsored|sponsored content|promoted|promoted content|paid content|paid post|paid partnership|partner content|advertisement|advertorial|ad|ads)$/i;
function commercialDisclosure(card: HTMLElement, link: HTMLAnchorElement, pageUrl: string): string | undefined {
  try {
    const target = new URL(link.getAttribute('href') ?? '', pageUrl);
    if (AD_CLICK.test(target.hostname) || AD_PATH.test(target.hostname + target.pathname)) return 'Sponsored (ad network link)';
    if (PAID_UTM.test(target.searchParams.get('utm_source') ?? '') || PAID_MEDIUM.test(target.searchParams.get('utm_medium') ?? '')) return 'Sponsored (paid tracking)';
  } catch { /* malformed links carry no evidence */ }
  // The widget wraps its tiles; a card's own id or class (often a slug) is not evidence.
  for (let current: HTMLElement | null = composedParent(card), depth = 0; current && current !== document.body && depth < 12; current = composedParent(current), depth++) {
    if (NATIVE_WIDGET.test(`${markers(current)} ${current.tagName}`) || current.hasAttribute('data-native-ad')) return 'Sponsored (native ad widget)';
  }
  const lone = [...card.querySelectorAll<HTMLElement>('a, span, div, p, small, [data-native-label]')].find(value =>
    value.hasAttribute('data-native-label') || !value.children.length && DISCLOSURE.test(clean(value.textContent)));
  // Record the publisher's own wording ("Paid Content"), so hide/always-show phrases keep their meaning.
  return lone && ownedVisibleContent(lone, card, true) ? clean(lone.textContent) || 'Sponsored' : undefined;
}
function candidateFor(seed: HTMLElement, pageUrl: string, extract: (element: HTMLElement) => DetectedStory<HTMLElement> | null, urlCache: Map<HTMLElement, Set<string>>, siblingCache: Map<HTMLElement, Map<string, number>>): HTMLElement | null {
  let parent: HTMLElement | null = seed.matches('a[href]') ? seed : seed.parentElement;
  let candidate: HTMLElement | null = null;
  for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
    if (protectedElement(parent) || ['BODY', 'MAIN', 'SECTION', 'HTML'].includes(parent.tagName)) break;
    let urls = urlCache.get(parent);
    if (!urls) { urls = new Set(storyLinks(parent, pageUrl).map(link => linkUrl(link, pageUrl)).filter(Boolean)); urlCache.set(parent, urls); }
    if (urls.size > 1) break;
    const named = parent.matches(CARD) || parent instanceof HTMLAnchorElement && !!parent.querySelector(HEADINGS);
    const siblings = parent.parentElement;
    let counts = siblings && siblingCache.get(siblings);
    if (siblings && !counts) {
      counts = new Map<string, number>();
      for (const child of siblings.children) { const key = `${child.tagName}:${child.className}`; counts.set(key, (counts.get(key) ?? 0) + 1); }
      siblingCache.set(siblings, counts);
    }
    const repeated = !named && (counts?.get(`${parent.tagName}:${parent.className}`) ?? 0) >= 2;
    if ((named || repeated) && extract(parent)) candidate = parent;
  }
  return candidate;
}
export function deduplicate(cards: DetectedStory<HTMLElement>[]): DetectedStory<HTMLElement>[] {
  // Publisher adapters run first; preserve their explicit extraction hints.
  const byHandle = new Map<HTMLElement, DetectedStory<HTMLElement>>();
  for (const card of cards) if (!byHandle.has(card.handle)) byHandle.set(card.handle, card);
  const unique = [...byHandle.values()];
  const complete = new Map<HTMLElement, DetectedStory<HTMLElement>>();
  for (const card of unique) {
    let outer = card;
    for (let parent = card.handle.parentElement; parent; parent = parent.parentElement) {
      const ancestor = byHandle.get(parent);
      if (ancestor && ancestor.story.url === card.story.url) outer = ancestor;
    }
    const previous = complete.get(outer.handle) ?? outer;
    // Keep the complete outer boundary and the richer inner card's exact-story metadata.
    const labels = [...new Set([...(previous.story.labels ?? []), ...(card.story.labels ?? [])])];
    complete.set(outer.handle, { ...previous,
      detector: card.detector === 'generic' ? previous.detector : card.detector,
      story: { ...previous.story, section: previous.story.section ?? card.story.section,
        description: previous.story.description ?? card.story.description,
        imageUrl: previous.story.imageUrl ?? card.story.imageUrl, labels: labels.length ? labels : undefined },
    });
  }
  return [...complete.values()];
}
export class GenericDetector implements StoryDetector<HTMLElement, Root> {
  diagnostics: DiscoveryDiagnostics = { candidates: 0, detected: 0, rejected: {} };
  detect(root: Root, pageUrl: string): DetectedStory<HTMLElement>[] {
    this.diagnostics = { candidates: 0, detected: 0, rejected: {} };
    structuredSections(root.ownerDocument ?? root as Document, true);
    const detected = withStyleCache(() => {
      const cards = this.detectScope(root, pageUrl);
      for (const shadow of openShadowRoots(root)) cards.push(...this.detectScope(shadow, pageUrl).map(card => promoteToHost(card, shadow, pageUrl)));
      return deduplicate(cards);
    });
    this.diagnostics.detected = detected.length;
    return detected;
  }
  private detectScope(root: Root, pageUrl: string): DetectedStory<HTMLElement>[] {
    const resultCache = new Map<HTMLElement, DetectedStory<HTMLElement> | null>();
    const urlCache = new Map<HTMLElement, Set<string>>();
    const siblingCache = new Map<HTMLElement, Map<string, number>>();
    const extract = (element: HTMLElement) => {
      if (!resultCache.has(element)) {
        this.diagnostics.candidates++;
        resultCache.set(element, extractCard(element, pageUrl, 'generic', undefined, reason => {
          this.diagnostics.rejected[reason] = (this.diagnostics.rejected[reason] ?? 0) + 1;
        }));
      }
      return resultCache.get(element)!;
    };
    const candidates = new Set(nodes(root, CARD).filter(element => element.tagName !== 'LI'));
    for (const seed of nodes(root, `${HEADINGS}, a[href]`)) {
      if (seed instanceof HTMLAnchorElement && !headlineAnchor(seed)) continue;
      const candidate = candidateFor(seed, pageUrl, extract, urlCache, siblingCache);
      if (candidate) candidates.add(candidate);
    }
    return [...candidates].map(extract).filter((value): value is DetectedStory<HTMLElement> => !!value);
  }
}
// A component whose shadow root holds exactly one story is itself the card: hide
// the host so the feed grid closes up, rather than leaving an empty tile behind.
function promoteToHost(card: DetectedStory<HTMLElement>, shadow: ShadowRoot, pageUrl: string): DetectedStory<HTMLElement> {
  const host = shadow.host;
  if (!(host instanceof HTMLElement) || protectedElement(host) || ['BODY', 'HTML', 'MAIN'].includes(host.tagName)) return card;
  const urls = new Set([...shadow.querySelectorAll<HTMLAnchorElement>('a[href]'), ...host.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .filter(link => headlineAnchor(link) || !!link.closest(HEADINGS) || !!link.querySelector(HEADINGS)).map(link => linkUrl(link, pageUrl)).filter(Boolean));
  if (urls.size !== 1 || !urls.has(card.story.url ?? '')) return card;
  if (openShadowRoots(shadow, 64).some(inner => inner.querySelector('a[href]'))) return card;
  return { ...card, handle: host };
}
