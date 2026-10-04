import type { Field, Story } from './types';
export function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function matchesPhrase(text: string, phrase: string): boolean {
  const term = normalise(phrase);
  return !!term && (` ${normalise(text)} `).includes(` ${term} `);
}
export function storyFields(story: Story): Record<Field, string> {
  let url = story.url ?? '';
  try { url = decodeURIComponent(new URL(url).pathname); } catch { /* malformed URLs stay plain text */ }
  return { headline: story.headline, description: story.description ?? '', section: story.section ?? '', url };
}
export function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    url.search = '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}
export function normaliseDomain(value: string): string {
  return value.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}
export function domainMatches(host: string, configured: string): boolean {
  const domain = normaliseDomain(configured);
  const source = normaliseDomain(host);
  return !!domain && (source === domain || source.endsWith(`.${domain}`));
}
