import type { DetectedStory, StoryDetector } from '../../core/types';
import { canonicalUrl } from '../../core/text';
export type Root = Document | HTMLElement;
const PROTECTED = 'nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"], [role="dialog"], [role="alert"], [role="menu"], form, [data-news-filter-ui], [data-emergency], .article-body, .article__body, [itemprop="articleBody"]';
const CARD = 'article, li, [class*="story"], [class*="card"], [class*="teaser"], [class*="fc-item"], [data-testid*="card"]';
const HEADINGS = 'h2, h3, h4, [data-testid="card-headline"], [class*="headline"], [class*="heading"]';
const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
export function nodes(root: Root, selector: string): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) all.unshift(root);
  return all;
}
export function headingLink(heading: HTMLElement): HTMLAnchorElement | null {
  return heading.closest<HTMLAnchorElement>('a[href]') ?? heading.querySelector<HTMLAnchorElement>('a[href]');
}
function linkUrl(link: HTMLAnchorElement, pageUrl: string): string {
  try { return canonicalUrl(new URL(link.getAttribute('href') ?? '', pageUrl).href); }
  catch { return ''; }
}
function storyLinks(element: HTMLElement): HTMLAnchorElement[] {
  return [...new Set(nodes(element, HEADINGS).map(headingLink).filter((x): x is HTMLAnchorElement => !!x))];
}
export function protectedElement(element: HTMLElement): boolean {
  if (element.closest(PROTECTED)) return true;
  const header = element.closest('header');
  if (header && !header.closest(CARD)) return true;
  for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
    if (/(?:^|[-_\s])(cookie|consent|privacy|advert|advertisement|navigation|emergency|alert)(?:$|[-_\s])/i
      .test(`${ancestor.className} ${ancestor.id}`)) return true;
  }
  return false;
}
export interface ExtractionHints { headline: HTMLElement; link: HTMLAnchorElement }
export function extractCard(element: HTMLElement, pageUrl: string, detector: string, hints?: ExtractionHints): DetectedStory<HTMLElement> | null {
  if (!element.isConnected || protectedElement(element)) return null;
  if (['BODY', 'MAIN', 'SECTION', 'HTML', 'HEADER', 'FOOTER', 'NAV'].includes(element.tagName)) return null;
  // A reading view or a collection of multiple stories is never a card.
  if (element.querySelector('h1, [itemprop="articleBody"], .article-body, .article__body')) return null;
  const links = [...new Set([...(hints ? [hints.link] : []), ...storyLinks(element)])];
  const urls = new Set(links.map(link => linkUrl(link, pageUrl)).filter(Boolean));
  if (urls.size !== 1) return null;
  const link = links.find(value => clean(value.textContent).length >= 12 || value === hints?.link);
  if (!link) return null;
  const headlineElement = hints?.headline ?? nodes(element, HEADINGS).find(heading => headingLink(heading) === link);
  const headline = clean(headlineElement?.textContent || link.textContent);
  if (headline.length < 12 || headline.length > 320 || !headline.includes(' ')) return null;
  if (element.querySelectorAll('p').length > 3 || clean(element.textContent).length > 1600) return null;
  if (element.querySelector('form, input, select, [role="dialog"], [role="alert"]')) return null;
  const url = linkUrl(link, pageUrl);
  if (!url || url === canonicalUrl(pageUrl)) return null;
  const parsed = new URL(url);
  if (/\/(?:login|signin|subscribe|account|privacy|cookie|tag|tags|category|categories)\/?$/i.test(parsed.pathname)) return null;
  if (parsed.pathname === '/' || parsed.pathname.split('/').filter(Boolean).length === 0) return null;
  const description = clean(element.querySelector('p, [data-testid="card-description"], [class*="summary"], [class*="description"]')?.textContent);
  const section = clean(element.getAttribute('data-section') || element.querySelector('[rel="tag"], [data-testid="card-topic"], [class*="category"], [class*="section-label"], [class*="kicker"]')?.textContent);
  const image = element.querySelector<HTMLImageElement>('img');
  let imageUrl: string | undefined;
  try {
    const src = image?.getAttribute('src') || image?.getAttribute('data-src');
    const resolved = src ? new URL(src, pageUrl) : undefined;
    if (resolved && ['http:', 'https:'].includes(resolved.protocol)) imageUrl = resolved.href;
  } catch { /* an image is optional; never fetch it */ }
  return { handle: element, detector, story: { headline, description: description || undefined, url,
    imageUrl, section: section || undefined, sourceDomain: new URL(pageUrl).hostname } };
}
function candidateFor(heading: HTMLElement, pageUrl: string): HTMLElement | null {
  let parent = heading.parentElement;
  for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
    if (protectedElement(parent) || ['BODY', 'MAIN', 'SECTION', 'HTML'].includes(parent.tagName)) break;
    const links = storyLinks(parent);
    if (links.length > 1 && new Set(links.map(x => linkUrl(x, pageUrl))).size > 1) break;
    const namedCard = parent.matches(CARD);
    const repeated = !namedCard && parent.parentElement && [...parent.parentElement.children].filter(sibling =>
      sibling.tagName === parent!.tagName && sibling.className === parent!.className).length >= 2;
    if ((namedCard || repeated) && extractCard(parent, pageUrl, 'generic')) return parent;
  }
  return null;
}
export function deduplicate(cards: DetectedStory<HTMLElement>[]): DetectedStory<HTMLElement>[] {
  const unique = [...new Map(cards.map(card => [card.handle, card])).values()];
  // Prefer a complete outer card when wrappers refer to the same single story.
  return unique.filter(card => !unique.some(other => other !== card && other.handle.contains(card.handle)));
}
export class GenericDetector implements StoryDetector<HTMLElement, Root> {
  detect(root: Root, pageUrl: string): DetectedStory<HTMLElement>[] {
    const candidates = new Set(nodes(root, 'article'));
    for (const heading of nodes(root, HEADINGS)) {
      const candidate = candidateFor(heading, pageUrl);
      if (candidate) candidates.add(candidate);
    }
    return deduplicate([...candidates].map(element => extractCard(element, pageUrl, 'generic'))
      .filter((value): value is DetectedStory<HTMLElement> => !!value));
  }
}
