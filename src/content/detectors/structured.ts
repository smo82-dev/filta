import { canonicalUrl } from '../../core/text';
// Exact-URL joins only: page-level article metadata must never bleed into sibling cards.
const cache = new WeakMap<Document, { signature: string; sections: Map<string, string> }>();
export function structuredSections(document: Document, refresh = false): Map<string, string> {
  const current = cache.get(document);
  if (current && !refresh) return current.sections;
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 32);
  const signature = document.baseURI + '\n' + scripts.map(script => (script.textContent ?? '').slice(0, 250_001)).join('\n');
  const previous = cache.get(document);
  if (previous?.signature === signature) return previous.sections;
  const sections = new Map<string, string>();
  let visited = 0;
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || ++visited > 2000) return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
    const node = value as Record<string, unknown>;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some(type => typeof type === 'string' && /^(?:NewsArticle|Article|ReportageNewsArticle|OpinionNewsArticle)$/.test(type))) {
      const main = node.mainEntityOfPage;
      const link = node.url ?? (typeof main === 'object' && main ? (main as Record<string, unknown>)['@id'] : main);
      const section = node.articleSection;
      if (typeof link === 'string' && typeof section === 'string' && section.length <= 96) {
        try { const url = canonicalUrl(new URL(link, document.baseURI).href); if (url) sections.set(url, section); } catch { /* optional metadata */ }
      }
    }
    Object.values(node).forEach(item => visit(item, depth + 1));
  }
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (text.length > 250_000) continue;
    try { visit(JSON.parse(text)); } catch { /* malformed publisher metadata is ignored */ }
  }
  cache.set(document, { signature, sections });
  return sections;
}
