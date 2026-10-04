import type { ClassificationResult, Field, Story, StoryClassifier, Signal } from './types';
import { CATEGORIES, type CategoryDefinition } from './rules/categories';
import { matchesPhrase, storyFields } from './text';
const FIELD_WEIGHTS: Record<Field, number> = { headline: 1, description: 0.35, url: 0.25, section: 1.5, label: 1.5 };
export class RuleBasedClassifier implements StoryClassifier {
  constructor(private readonly definitions: CategoryDefinition[] = CATEGORIES) {}
  async classify(story: Story): Promise<ClassificationResult> {
    const fields = storyFields(story);
    const signals: Signal[] = [];
    const categories = this.definitions.map(category => {
      let score = 0;
      for (const [field, texts] of Object.entries(fields) as [Field, string[]][]) {
        for (const rule of category.terms) {
          if (rule.fields && !rule.fields.includes(field)) continue;
          if (!texts.some(text => matchesPhrase(text, rule.term))) continue;
          const contribution = rule.weight * (category.fieldWeights?.[field] ?? FIELD_WEIGHTS[field]);
          score += contribution;
          signals.push({ category: category.id, field, term: rule.term, contribution, kind: 'term' });
        }
        // Context operates on meaningful text; a URL slug cannot neutralise a headline.
        if (field === 'headline' || field === 'description') {
          for (const rule of category.contexts ?? []) {
            if (!texts.some(text => matchesPhrase(text, rule.term))) continue;
            const contribution = rule.weight * (field === 'headline' ? 1 : 0.5);
            score += contribution;
            signals.push({ category: category.id, field, term: rule.term, contribution, kind: 'context' });
          }
        }
      }
      for (const combination of category.combinations ?? []) {
        if (!combination.terms.every(term => matchesPhrase(story.headline, term))) continue;
        score += combination.weight;
        signals.push({ category: category.id, field: 'headline', term: combination.terms.join(' + '), contribution: combination.weight, kind: 'combination' });
      }
      return { id: category.id, name: category.name, score: Math.round(Math.max(0, score) * 100) / 100, threshold: category.threshold };
    });
    return { categories, signals };
  }
}
