import { normalise } from '../../core/text';

const SELECTOR = '[class], [data-testid], [data-component], [data-label], [data-kicker], [data-topic], [data-category], [data-sponsored], [data-partner], [aria-label], a[rel~="tag"]';
const METADATA = /(?:^|[-_\s])(kicker|badge|tag|label|category|section|topic|eyebrow|sponsored|sponsor|partner|promo|promoted|commercial|advertorial)(?:$|[-_\s])/i;
const UNRELATED = /(?:^|[-_\s])(related|recommendations?|recommended|suggestions?|navigation|menu|toolbar|controls?|share|social|timestamp|byline|author|cookie|consent|privacy|emergency|sr|visually|screen-reader)(?:$|[-_\s])/i;
const RELATED = /(?:^|[-_\s])(related|recommendations?|recommended|suggestions?)(?:$|[-_\s])/i;
const AD_CONTAINER = /(?:^|[-_\s])(ad|ads|advert|advertisement|advertising)(?:$|[-_\s])/i;
const EXCLUDED = 'nav, aside, footer, form, button, time, input, select, textarea, [role="button"], [role="toolbar"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="menu"], [role="dialog"], [role="alert"], [data-emergency], [data-news-filter-ui], [data-related], [data-recommendations], [data-ad-slot]';
const PROMOTIONAL_ARIA = /^(?:sponsored(?: by .+)?|paid content|paid post|partner content|promoted|advertisement|advertorial|brand partner|branded content|presented by(?: .+)?|commercial content|native advertising)$/i;
const clean = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
export function markers(element: HTMLElement): string {
  const cached = scan?.markers.get(element);
  if (cached !== undefined) return cached;
  const value = [element.className, element.id, element.getAttribute('data-testid'), element.getAttribute('data-component')]
    .join(' ').replace(/([a-z])([A-Z])/g, '$1 $2')
    // Feature flags describe a layout, not an author/byline region.
    .replace(/\b(?:with|has|without|no)[-_](?:byline|author)\b/gi, '');
  scan?.markers.set(element, value);
  return value;
}
export function metadataElement(element: HTMLElement): boolean {
  return METADATA.test(markers(element)) || element.matches('[data-label], [data-kicker], [data-topic], [data-category], [data-sponsored], [data-partner], a[rel~="tag"]') ||
    PROMOTIONAL_ARIA.test(clean(element.getAttribute('aria-label')));
}
// Discovery asks about the same ancestors thousands of times on a busy front page.
// Within one scan, layout does not change, so each element's own style is read once.
// The same ancestors are inspected tens of thousands of times on a busy front page
// (live Stuff: ~360,000 attribute reads per scan). Within one synchronous scan the
// DOM and layout do not change, so per-element facts are computed once.
export interface ScanCache { visible: Map<Element, boolean>; markers: Map<Element, string>; protectedChain: Map<Element, boolean>; headlineAnchors: Map<Element, boolean>; urls: Map<string, string> }
let scan: ScanCache | undefined;
export function scanCache(): ScanCache | undefined { return scan; }
export function withStyleCache<T>(run: () => T): T {
  const outer = scan;
  scan ??= { visible: new Map(), markers: new Map(), protectedChain: new Map(), headlineAnchors: new Map(), urls: new Map() };
  try { return run(); } finally { if (!outer) scan = undefined; }
}
function selfVisible(element: HTMLElement): boolean {
  const visibility = scan?.visible;
  let visible = visibility?.get(element);
  if (visible === undefined) {
    const style = getComputedStyle(element);
    visible = !(style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0');
    visibility?.set(element, visible);
  }
  return visible;
}
export function ownedVisibleContent(element: HTMLElement, card: HTMLElement, allowAdLabel = false, allowRelatedStory = false): boolean {
  for (let current: HTMLElement | null = element; current && current !== card; current = current.parentElement) {
    if (current.matches(EXCLUDED) || UNRELATED.test(markers(current)) &&
      !(RELATED.test(markers(current)) && allowRelatedStory)) return false;
    // A label for an embedded ad or a nested story does not describe this card.
    if (current !== element && current.matches('article, li')) return false;
    if (AD_CONTAINER.test(markers(current)) && (current !== element || !allowAdLabel)) return false;
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('inert')) return false;
    if (!selfVisible(current)) return false;
  }
  // Ignore our display:none on the complete card, so filtered cards can be rescanned.
  return !card.hidden && card.getAttribute('aria-hidden') !== 'true';
}
function usableLabel(element: HTMLElement, card: HTMLElement, headline?: HTMLElement): boolean {
  if (headline && element.contains(headline)) return false;
  if (element.matches('h1,h2,h3,h4,h5,h6') || element.querySelector('h1,h2,h3,h4,h5,h6,p,time,button,input,select,textarea,article,nav,aside,form')) return false;
  if (element.querySelector('a[href]') || element.matches('a[href]:not([rel~="tag"])') && !METADATA.test(markers(element))) return false;
  return ownedVisibleContent(element, card, true);
}

export function extractMetadata(card: HTMLElement, headline?: HTMLElement): { labels: string[]; section?: string } {
  // Never use card textContent as matching input. Only short, owned metadata leaves.
  const candidates = [...card.querySelectorAll<HTMLElement>(SELECTOR)]
    .filter(element => element instanceof HTMLElement && metadataElement(element)).slice(0, 64);
  const labels: string[] = [], seen = new Set<string>();
  let section: string | undefined;
  const add = (text: string) => {
    const key = normalise(text);
    if (!key || seen.has(key) || text.length > 96 || text.split(' ').length > 12 || labels.length === 8) return;
    seen.add(key); labels.push(text);
  };
  const attributeLabel = (element: HTMLElement) => {
    for (const key of ['data-label', 'data-kicker', 'data-topic', 'data-category', 'data-sponsored', 'data-partner']) {
      const value = element.getAttribute(key);
      if (value === null || /^(?:false|0|null|undefined)$/i.test(value.trim())) continue;
      if (key === 'data-sponsored' || key === 'data-partner') return 'Sponsored';
      if (value.trim() && !/^(?:true|1)$/i.test(value.trim())) return clean(value);
    }
    return '';
  };
  // Attributes on the exact story boundary describe that story; never consume
  // a surrounding section's attributes or the complete card's textContent.
  if (ownedVisibleContent(card, card)) add(attributeLabel(card));
  for (const element of candidates) {
    if (!usableLabel(element, card, headline) || candidates.some(other => other !== element && element.contains(other))) continue;
    let text = clean(element.textContent) || attributeLabel(element);
    // Accessible names may describe a visible icon badge, never the whole story link.
    if (!text && (METADATA.test(markers(element)) || element.querySelector('img,svg'))) text = clean(element.getAttribute('aria-label'));
    if (!text || text.length > 96 || text.split(' ').length > 12) continue;
    add(text);
    if (!section && (element.matches('a[rel~="tag"], [data-testid="card-topic"], [data-kicker], [data-topic], [data-category]') ||
      /(?:^|[-_\s])(category|section|kicker)(?:$|[-_\s])/i.test(markers(element)))) section = text;
    if (labels.length === 8) break;
  }
  return { labels, section };
}
