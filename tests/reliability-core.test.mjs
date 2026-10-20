import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { RuleBasedClassifier, evaluate, defaultPreferences, CATEGORIES } from './.generated/core.mjs';
const classifier = new RuleBasedClassifier();
const prefs = changes => ({ ...defaultPreferences(), configured: true, ...changes });
const corpus = JSON.parse(await readFile(new URL('fixtures/classification-corpus.json', import.meta.url)));
test('balanced 14-category challenge corpus: separate classification and preference outcomes', async () => {
  const metrics = Object.fromEntries(CATEGORIES.map(category => [category.id, { tp: 0, fp: 0, tn: 0, fn: 0, misses: [] }]));
  for (const row of corpus.cases) {
    const result = await classifier.classify(row.story);
    const category = result.categories.find(item => item.id === row.category);
    const matched = category.score >= category.threshold;
    const entry = metrics[row.category]; entry[matched ? row.expected ? 'tp' : 'fp' : row.expected ? 'fn' : 'tn']++;
    if (matched !== row.expected) entry.misses.push(row.id);
    assert.equal(evaluate(row.story, result, prefs({})).action, 'allow', `unselected: ${row.id}`);
    for (const mode of ['collapse', 'hide']) {
      assert.equal(evaluate(row.story, result, prefs({ mode, filteredCategories: [row.category] })).action, matched ? mode : 'allow', row.id);
      assert.equal(evaluate(row.story, result, prefs({ mode, filteredCategories: [row.category], allowedKeywords: [row.story.headline] })).action, 'allow', `always-show: ${row.id}`);
    }
  }
  for (const entry of Object.values(metrics)) {
    entry.precision = entry.tp / (entry.tp + entry.fp || 1); entry.recall = entry.tp / (entry.tp + entry.fn || 1);
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/classification.json', JSON.stringify({ provenance: corpus.provenance, samples: corpus.cases.length, categories: metrics }, null, 2));
  for (const [category, entry] of Object.entries(metrics)) {
    assert.ok(entry.precision >= 0.95, `${category} precision: ${JSON.stringify(entry)}`);
    assert.ok(entry.recall >= 0.8, `${category} recall: ${JSON.stringify(entry)}`);
  }
});
test('taxonomy segments differ from incidental slug, query, fragment and substring mentions', async () => {
  for (const url of ['https://news.example/local/technology-festival', 'https://news.example/local/story?topic=tech#technology', 'https://news.example/biotechnology/story']) {
    const result = await classifier.classify({ headline: 'Neighbours gather for a local celebration', sourceDomain: 'news.example', url });
    assert.equal(evaluate({ headline: 'Neighbours gather for a local celebration', sourceDomain: 'news.example', url }, result, prefs({ filteredCategories: ['technology'] })).action, 'allow');
  }
});
test('normalised duplicate labels cannot accumulate weak evidence', async () => {
  const result = await classifier.classify({ headline: 'Neighbours gather for a local celebration', sourceDomain: 'news.example', labels: ['actor', 'ACTOR', 'ＡＣＴＯＲ'] });
  assert.equal(result.categories.find(category => category.id === 'celebrity').score, 1.5);
});
