import type { ClassificationResult, Field, Story, StoryClassifier, Signal } from './types';
import { CATEGORIES, type CategoryDefinition } from './rules/categories';
import { normalise, storyFields } from './text';
import { topicEvidence } from './topic-model';
const FIELD_WEIGHTS: Record<Field, number> = { headline: 1, description: 0.35, url: 0.25, section: 1.5, label: 1.5 };
const TAXONOMY_QUALIFIERS = new Set(['news', 'stories', 'story', 'content', 'and', 'the', 'latest', 'live', 'local', 'world', 'national',
  'international', 'nz', 'au', 'uk', 'us', 'election', 'elections', 'justice', 'reports', 'features', 'updates', 'topic', 'section',
  'state', 'federal', 'territory', 'india', 'asia', 'africa', 'europe', 'americas', 'pacific', 'global', 'other']);
const contains = (text: string, phrase: string) => !!phrase && (` ${text} `).includes(` ${phrase} `);
export class RuleBasedClassifier implements StoryClassifier {
  private readonly compiled;
  constructor(definitions: CategoryDefinition[] = CATEGORIES) {
    this.compiled = definitions.map(category => ({ ...category,
      terms: category.terms.map(rule => ({ ...rule, key: normalise(rule.term) })),
      contexts: (category.contexts ?? []).map(rule => ({ ...rule, key: normalise(rule.term) })),
      combinations: (category.combinations ?? []).map(rule => ({ ...rule,
        alternatives: rule.terms.map(term => term.split('|').map(normalise)) })),
      sectionKeys: (category.sections ?? []).map(normalise),
      disclosureKeys: (category.headlineDisclosures ?? []).map(normalise),
      supportKeys: (category.support?.cues ?? []).map(normalise),
      workKeys: (category.personFocus?.works ?? []).map(normalise),
    }));
    for (const category of this.compiled) for (const key of category.sectionKeys) if (!this.sectionOwner.has(key)) this.sectionOwner.set(key, category.id);
  }
  // Publisher taxonomy often qualifies a section: "politics_election-2026", "crime-and-justice",
  // "science-and-technology", "sponsored-stories", "NZ Politics". Accept the section name at either
  // end when every other word is a generic qualifier or another section name; slugs never qualify.
  private readonly sectionOwner = new Map<string, string>();
  private taxonomy(text: string, key: string): boolean {
    if (text === key) return true;
    const words = text.split(' ');
    // A byline label names the section first: "Analysis by Jane Smith", "Opinion by …".
    if (words.length <= 6 && text.startsWith(`${key} by `)) return true;
    if (words.length > 5 || !(text.startsWith(`${key} `) || text.endsWith(` ${key}`))) return false;
    const rest = (text.startsWith(`${key} `) ? text.slice(key.length + 1) : text.slice(0, -key.length - 1)).split(' ');
    // "crime and justice" names one topic; "science and technology" spans two, so it decides neither.
    return rest.every(word => TAXONOMY_QUALIFIERS.has(word) || /^\d+$/.test(word) || this.sectionOwner.get(word) === this.sectionOwner.get(key));
  }
  async classify(story: Story): Promise<ClassificationResult> {
    const fields = Object.entries(storyFields(story)).map(([field, texts]) => [field, texts.map(normalise)] as [Field, string[]]);
    const headline = normalise(story.headline);
    // A delimited leading disclosure is editorial metadata embedded in a title.
    // Do not upgrade incidental narrative mentions, quotes or undelimited words.
    const disclosure = story.headline.normalize('NFKC').trim().match(/^(?:\[([^\]]+)\]|([\p{L} ]+?)\s*[:|–—-])\s*\S/u);
    const disclosureKey = normalise(disclosure?.[1] ?? disclosure?.[2] ?? '');
    const narrative = [headline, normalise(story.description ?? '')];
    let path: string[] = [];
    try { path = new URL(story.url ?? '').pathname.split('/').filter(Boolean).slice(0, -1).map(value => normalise(decodeURIComponent(value))); }
    catch { /* optional URL */ }
    const signals: Signal[] = [];
    // Learned word evidence catches ordinary headlines no keyword list anticipates
    // ("Erstad's double lifts Angels to win"). Rules and exceptions still apply on top.
    const learned = new Map(topicEvidence(story.headline, story.description).map(value => [value.category, value]));
    const categories = this.compiled.map(category => {
      let score = 0;
      const evidence = learned.get(category.id);
      // Only a calibrated, confident prediction counts; it then carries the same weight as one decisive term.
      if (evidence && evidence.confidence > 0) {
        score += category.threshold;
        signals.push({ category: category.id, field: 'headline', term: `Topic model: ${evidence.phrases.join(', ')}`, contribution: category.threshold, kind: 'model' });
      }
      const focus = category.personFocus;
      const about = focus && learned.get(focus.from);
      if (focus && about && about.confidence > focus.minConfidence && !((learned.get(focus.unless)?.confidence ?? -1) > 0) &&
        !/^['‘“"][^'’”"]{3,}['’”"]/.test(story.headline.trim()) && !category.workKeys.some(key => contains(headline, key))) {
        score += focus.weight;
        signals.push({ category: category.id, field: 'headline', term: `Topic model (${focus.from}): story about a person (${about.phrases.join(', ')})`, contribution: focus.weight, kind: 'model' });
      }
      const support = category.support && learned.get(category.support.from);
      if (category.support && support && support.confidence > (category.support.minConfidence ?? 0)) {
        const cue = category.supportKeys.find(key => narrative.some(text => contains(text, key)));
        if (cue) {
          score += category.support.weight;
          signals.push({ category: category.id, field: 'headline', term: `Topic model (${category.support.from}) + “${cue}”`, contribution: category.support.weight, kind: 'model' });
        }
      }
      if (category.disclosureKeys.includes(disclosureKey)) {
        score += category.threshold;
        signals.push({ category: category.id, field: 'headline', term: `Disclosure: ${disclosureKey}`, contribution: category.threshold, kind: 'term' });
      }
      for (const [field, texts] of fields) {
        let fieldScore = 0;
        for (const rule of category.terms) {
          if (rule.fields && !rule.fields.includes(field)) continue;
          if (!texts.some(text => contains(text, rule.key))) continue;
          const contribution = rule.weight * (category.fieldWeights?.[field] ?? FIELD_WEIGHTS[field]);
          fieldScore += contribution;
          signals.push({ category: category.id, field, term: rule.term, contribution, kind: 'term' });
        }
        // Exact publisher taxonomy is contextual evidence, not an incidental slug keyword.
        const alias = category.sectionKeys.find(key => field === 'section' || field === 'label'
          ? texts.some(text => this.taxonomy(text, key)) : field === 'url' && path.some(segment => this.taxonomy(segment, key)));
        if (alias && fieldScore < category.threshold) {
          const contribution = category.threshold - fieldScore;
          fieldScore += contribution;
          signals.push({ category: category.id, field, term: `Topic: ${alias}`, contribution, kind: 'term' });
        }
        score += fieldScore;
        if (field === 'headline' || field === 'description') {
          for (const rule of category.contexts) {
            if (!texts.some(text => contains(text, rule.key))) continue;
            const contribution = rule.weight * (field === 'headline' ? 1 : 0.5);
            score += contribution;
            signals.push({ category: category.id, field, term: rule.term, contribution, kind: 'context' });
          }
        }
      }
      for (const combination of category.combinations) {
        // A card’s summary can supply the missing context for an opaque headline.
        // Keep fields separate so a phrase cannot be invented across their boundary.
        const inHeadline = combination.alternatives.every(terms => terms.some(term => contains(headline, term)));
        if (!inHeadline && !combination.alternatives.every(terms => terms.some(term => narrative.some(text => contains(text, term))))) continue;
        score += combination.weight;
        signals.push({ category: category.id, field: inHeadline ? 'headline' : 'description', term: combination.terms.join(' + '), contribution: combination.weight, kind: 'combination' });
      }
      return { id: category.id, name: category.name, score: Math.round(Math.max(0, score) * 100) / 100, threshold: category.threshold };
    });
    return { categories, signals };
  }
}
