import type { ClassificationResult, Decision, Field, Preferences, Story, StoryClassifier, Signal } from './types';
import { canonicalUrl, domainMatches, matchesPhrase, storyFields } from './text';
export function isEmergencyInformation(story: Story): boolean {
  return ['evacuation order', 'evacuate now', 'tsunami warning', 'emergency alert', 'cyclone warning',
    'flood warning', 'shelter in place', 'boil water notice', 'urgent safety notice']
    .some(term => matchesPhrase(story.headline, term));
}
function keywordSignals(story: Story, words: string[], kind: 'blocked' | 'allowed'): Signal[] {
  const fields = storyFields(story);
  return words.flatMap(term => (Object.entries(fields) as [Field, string[]][])
    .filter(([, texts]) => texts.some(text => matchesPhrase(text, term)))
    .map(([field]) => ({ field, term, contribution: kind === 'blocked' ? 10 : -10, kind })));
}
export function evaluate(story: Story, classification: ClassificationResult, preferences: Preferences,
  sessionOverride?: 'show' | 'hide'): Decision {
  const allow = (reason: string, signals: Signal[] = []): Decision => ({ action: 'allow', reason, categories: [], signals });
  // Explicit precedence: safety > paused/unconfigured > show once > always-show > hide once > blocked > categories.
  if (isEmergencyInformation(story)) return allow('Emergency information is left visible');
  if (!preferences.configured || !preferences.enabled) return allow('Filtering is off');
  if (preferences.disabledDomains.some(domain => domainMatches(story.sourceDomain, domain))) return allow('Filtering is paused on this site');
  if (sessionOverride === 'show') return allow('You restored this story for this page');
  const url = canonicalUrl(story.url ?? '');
  const allowed = keywordSignals(story, preferences.allowedKeywords, 'allowed');
  if (allowed.length) return allow('An always-show phrase matched', allowed);
  if (url && preferences.alwaysShowUrls.includes(url)) return allow('You chose to always show this story');
  const filtered = classification.categories.filter(category => preferences.filteredCategories.includes(category.id) && category.score >= category.threshold);
  const blocked = keywordSignals(story, preferences.blockedKeywords, 'blocked');
  if (sessionOverride === 'hide' || (url && preferences.blockedUrls.includes(url))) {
    return { action: preferences.mode, reason: 'You chose to hide this story', categories: [], signals: [] };
  }
  if (blocked.length) return { action: preferences.mode, reason: 'A hide phrase matched', categories: filtered, signals: blocked };
  if (filtered.length) return { action: preferences.mode, reason: 'A selected topic matched', categories: filtered,
    signals: classification.signals.filter(signal => filtered.some(category => category.id === signal.category)) };
  return allow('No selected rule matched');
}
export class FilterEngine {
  constructor(private readonly classifier: StoryClassifier) {}
  async process(story: Story, preferences: Preferences, sessionOverride?: 'show' | 'hide') {
    const classification = await this.classifier.classify(story);
    return { classification, decision: evaluate(story, classification, preferences, sessionOverride) };
  }
}
