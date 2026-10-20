import { readFile, writeFile } from 'node:fs/promises';
import { RuleBasedClassifier } from '../tests/.generated/core.mjs';
const corpus = JSON.parse(await readFile('tests/fixtures/real-headline-holdout.json', 'utf8'));
const classifier = new RuleBasedClassifier();
const metrics = {}, misses = [];
for (const row of corpus.cases) {
  const result = (await classifier.classify(row.story)).categories.find(category => category.id === row.category);
  const matched = result.score >= result.threshold;
  const entry = metrics[row.category] ??= { tp: 0, fp: 0, tn: 0, fn: 0 };
  entry[matched ? row.expected ? 'tp' : 'fp' : row.expected ? 'fn' : 'tn']++;
  if (matched !== row.expected) misses.push({ publisher: row.publisher, category: row.category, headline: row.story.headline, expected: row.expected, score: result.score });
}
for (const entry of Object.values(metrics)) { entry.precision = entry.tp + entry.fp ? entry.tp / (entry.tp + entry.fp) : null; entry.recall = entry.tp + entry.fn ? entry.tp / (entry.tp + entry.fn) : null; }
const output = { provenance: corpus.provenance, samples: corpus.cases.length, categories: metrics, misses };
await writeFile('test-results/real-headline-holdout.json', JSON.stringify(output, null, 2)); console.log(JSON.stringify(output, null, 2));
