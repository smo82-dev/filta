import type { ClassificationResult, Field, Story, StoryClassifier, Signal } from './types';
import { CATEGORIES, type CategoryDefinition } from './rules/categories';
import { normalise, storyFields } from './text';
const FIELD_WEIGHTS: Record<Field, number> = { headline: 1, description: 0.35, url: 0.25, section: 1.5, label: 1.5 };
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
    }));
  }
  async classify(story: Story): Promise<ClassificationResult> {
    const fields = Object.entries(storyFields(story)).map(([field, texts]) => [field, texts.map(normalise)] as [Field, string[]]);
    const headline = normalise(story.headline);
    const narrative = [headline, normalise(story.description ?? '')];
    let path: string[] = [];
    try { path = new URL(story.url ?? '').pathname.split('/').filter(Boolean).slice(0, -1).map(value => normalise(decodeURIComponent(value))); }
    catch { /* optional URL */ }
    const signals: Signal[] = [];
    const categories = this.compiled.map(category => {
      let score = 0;
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
          ? texts.some(text => text === key) : field === 'url' && path.includes(key));
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
