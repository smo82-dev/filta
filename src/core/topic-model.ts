import type { CategoryId } from './types';
import { normalise } from './text';
import RAW_MODEL from './rules/topic-model.txt';
// A compact, local logistic-regression topic model (see scripts/topic-model/).
// It reads only the headline and card summary already on the page. Nothing is
// fetched or sent anywhere. Features must stay identical to train.py.
export interface TopicEvidence {
  category: CategoryId;
  /** Model margin minus its calibrated cut-off; > 0 means confident. */
  confidence: number;
  /** The few phrases that pushed hardest towards this topic. */
  phrases: string[];
}
interface CompiledModel { classes: CategoryId[]; bias: number[]; cut: number[]; weights: Map<string, [number, number][]> }
let compiled: CompiledModel | undefined;
function model(): CompiledModel {
  if (compiled) return compiled;
  // Parse lazily: pages that never classify a story never pay for the model.
  const raw = JSON.parse(RAW_MODEL) as { classes: CategoryId[]; bias: number[]; cut: number[]; weights: Record<string, string> };
  const weights = new Map<string, [number, number][]>();
  for (const [feature, packed] of Object.entries(raw.weights)) {
    weights.set(feature, packed.split(',').map(part => {
      const [index, weight] = part.split(':');
      return [Number(index), Number(weight)] as [number, number];
    }));
  }
  compiled = { classes: raw.classes, bias: raw.bias, cut: raw.cut, weights };
  return compiled;
}
function grams(text: string): Set<string> {
  const tokens = normalise(text).split(' ').filter(Boolean).map(token => /^\p{N}+$/u.test(token) ? '0' : token);
  const out = new Set(tokens);
  for (let i = 1; i < tokens.length; i++) out.add(`${tokens[i - 1]} ${tokens[i]}`);
  return out;
}
export function topicEvidence(headline: string, description?: string): TopicEvidence[] {
  const { classes, bias, cut, weights } = model();
  const features = new Map<string, number>();
  const head = grams(headline);
  for (const feature of head) features.set(feature, 1);
  if (description) for (const feature of grams(description)) if (!head.has(feature)) features.set(feature, 0.5);
  const scores = [...bias];
  const contributions: [string, number][][] = classes.map(() => []);
  for (const [feature, value] of features) {
    for (const [index, weight] of weights.get(feature) ?? []) {
      scores[index]! += value * weight;
      if (weight > 0) contributions[index]!.push([feature, value * weight]);
    }
  }
  const evidence = classes.map((category, index) => ({ category, confidence: scores[index]! - cut[index]!,
    phrases: contributions[index]!.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([phrase]) => phrase) }));
  // Part of the training data merges science and technology. When science is the
  // stronger reading (a telescope, a new species), do not also call it technology.
  const technology = evidence.find(value => value.category === 'technology');
  const science = evidence.find(value => value.category === 'science');
  if (technology && science && science.confidence > technology.confidence) technology.confidence = Math.min(technology.confidence, 0);
  return evidence;
}
