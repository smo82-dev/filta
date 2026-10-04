import type { DetectedStory, StoryDetector } from '../../core/types';
import { domainMatches } from '../../core/text';
import { deduplicate, extractCard, nodes, type Root } from './generic';
export interface SiteAdapter extends StoryDetector<HTMLElement, Root> {
  id: string;
  domains: string[];
  matches(host: string): boolean;
}
class SelectorAdapter implements SiteAdapter {
  constructor(readonly id: string, readonly domains: string[], private readonly selector: string) {}
  matches(host: string) { return this.domains.some(domain => domainMatches(host, domain)); }
  detect(root: Root, pageUrl: string): DetectedStory<HTMLElement>[] {
    return deduplicate(nodes(root, this.selector).map(element => extractCard(element, pageUrl, this.id))
      .filter((value): value is DetectedStory<HTMLElement> => !!value));
  }
}
class GuardianAdapter extends SelectorAdapter {
  constructor() { super('guardian', ['theguardian.com'], '.fc-item, .dcr-card, li[data-link-name="trail"], article'); }
  override detect(root: Root, pageUrl: string): DetectedStory<HTMLElement>[] {
    const cards = super.detect(root, pageUrl);
    // Current Guardian fronts use a sibling overlay link rather than a linked heading.
    // Skip compound cards with sub-stories; hiding those could hide unrelated reporting.
    for (const headline of nodes(root, '.card-headline')) {
      const card = headline.closest<HTMLElement>('li, [data-format-theme]');
      if (!card || card.querySelectorAll('h2,h3,h4').length !== 1) continue;
      const links = card.querySelectorAll<HTMLAnchorElement>('a[href][data-link-name*="card-@"][data-link-name*="media-picture"]');
      if (links.length !== 1) continue;
      const story = extractCard(card, pageUrl, this.id, { headline, link: links[0]! });
      if (story) cards.push(story);
    }
    return deduplicate(cards);
  }
}
// All adapters use the same safety checks and fall back to the generic detector.
export const SITE_ADAPTERS: SiteAdapter[] = [
  new SelectorAdapter('bbc', ['bbc.com', 'bbc.co.uk'], '[data-testid$="-card"], [data-testid="card"], article'),
  new GuardianAdapter(),
  new SelectorAdapter('rnz', ['rnz.co.nz'], '.story, .story-card, .o-card, .c-card, article'),
];
