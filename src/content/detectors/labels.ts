import { normalise } from '../../core/text';

const SELECTOR = '[class], [data-testid], [data-component], [data-label], [data-kicker], [data-topic], [data-category], [data-sponsored], [data-partner], [aria-label], a[rel~="tag"]';
const METADATA = /(?:^|[-_\s])(kicker|badge|tag|label|category|section|topic|eyebrow|sponsored|sponsor|partner|promo|promoted|commercial|advertorial)(?:$|[-_\s])/i;
const UNRELATED = /(?:^|[-_\s])(related|recommendations?|recommended|suggestions?|navigation|menu|toolbar|controls?|share|social|timestamp|byline|author|cookie|consent|privacy|emergency|sr|visually|screen-reader)(?:$|[-_\s])/i;
const AD_CONTAINER = /(?:^|[-_\s])(ad|ads|advert|advertisement|advertising)(?:$|[-_\s])/i;
const EXCLUDED = 'nav, aside, footer, form, button, time, input, select, textarea, [role="button"], [role="toolbar"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="menu"], [role="dialog"], [role="alert"], [data-emergency], [data-news-filter-ui], [data-related], [data-recommendations], [data-ad-slot]';
const PROMOTIONAL_ARIA = /^(?:sponsored(?: by .+)?|paid content|paid post|partner content|promoted|advertisement|advertorial|brand partner|branded content|presented by(?: .+)?|commercial content|native advertising)$/i;
const clean = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
function markers(element: HTMLElement): string {
  return [element.className, element.id, element.getAttribute('data-testid'), element.getAttribute('data-component')]
    .join(' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}
function metadataElement(element: HTMLElement): boolean {
  return METADATA.test(markers(element)) || element.matches('[data-label], [data-kicker], [data-topic], [data-category], [data-sponsored], [data-partner], a[rel~="tag"]') ||
    PROMOTIONAL_ARIA.test(clean(element.getAttribute('aria-label')));
}
export function ownedVisibleContent(element: HTMLElement, card: HTMLElement, allowAdLabel = false): boolean {
  for (let current: HTMLElement | null = element; current && current !== card; current = current.parentElement) {
    if (current.matches(EXCLUDED) || UNRELATED.test(markers(current))) return false;
    // A label for an embedded ad or a nested story does not describe this card.
    if (current !== element && current.matches('article, li')) return false;
    if (AD_CONTAINER.test(markers(current)) && (current !== element || !allowAdLabel)) return false;
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('inert')) return false;
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') return false;
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
  for (const element of candidates) {
    if (!usableLabel(element, card, headline) || candidates.some(other => other !== element && element.contains(other))) continue;
    let text = clean(element.textContent);
    // Accessible names may describe a visible icon badge, never the whole story link.
    if (!text && (METADATA.test(markers(element)) || element.querySelector('img,svg'))) text = clean(element.getAttribute('aria-label'));
    if (!text || text.length > 96 || text.split(' ').length > 12) continue;
    const key = normalise(text);
    if (!key || seen.has(key)) continue;
    seen.add(key); labels.push(text);
    if (!section && (element.matches('a[rel~="tag"], [data-testid="card-topic"], [data-kicker], [data-topic], [data-category]') ||
      /(?:^|[-_\s])(category|section|kicker)(?:$|[-_\s])/i.test(markers(element)))) section = text;
    if (labels.length === 8) break;
  }
  return { labels, section };
}
