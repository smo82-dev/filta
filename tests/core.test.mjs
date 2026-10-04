import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleBasedClassifier, FilterEngine, evaluate, defaultPreferences, sanitisePreferences,
  applyPreferencePatch, matchesPhrase, canonicalUrl, domainMatches, CATEGORIES } from './.generated/core.mjs';
const classifier = new RuleBasedClassifier();
const story = (headline, rest = {}) => ({ headline, sourceDomain: 'news.example', url: 'https://news.example/story/123', ...rest });
const prefs = (rest = {}) => ({ ...defaultPreferences(), configured: true, ...rest });
const score = async (headline, category, rest) => (await classifier.classify(story(headline, rest))).categories.find(x => x.id === category).score;
const decision = async (item, preferences, override) => evaluate(item, await classifier.classify(item), preferences, override);
test('no categories selected at first run, default collapse, no action before setup', async () => {
  const defaults = defaultPreferences();
  assert.equal(defaults.mode, 'collapse'); assert.deepEqual(defaults.filteredCategories, []);
  assert.equal((await decision(story('Celebrity divorce dominates headlines'), { ...defaults, filteredCategories: ['celebrity'] })).action, 'allow');
});
test('every starter category has a working weighted seed signal', async t => {
  for (const definition of CATEGORIES) await t.test(definition.name, async () => {
    const result = await classifier.classify(story(`Latest ${definition.terms[0].term} news today`));
    const category = result.categories.find(x => x.id === definition.id);
    assert.ok(category.score >= category.threshold);
  });
});
test('headline, description, section and URL have different weights', async () => {
  assert.equal(await score('Technology transforms villages', 'technology'), 4);
  assert.equal(await score('A new development for villagers', 'technology', { description: 'technology' }), 1.4);
  assert.equal(await score('A new development for villagers', 'technology', { section: 'Technology' }), 6);
  assert.equal(await score('A new development for villagers', 'technology', { url: 'https://example.com/technology/story' }), 1);
});
test('combinations add confidence and signals remain explainable', async () => {
  const result = await classifier.classify(story('Police charged two people in an incident'));
  assert.equal(result.categories.find(x => x.id === 'crime').score, 5);
  assert.ok(result.signals.some(x => x.kind === 'combination' && x.term === 'police + charged'));
});
test('an incidental actor mention alone does not trigger celebrity gossip', async () => {
  assert.equal((await decision(story('Actor supports village clean water research'), prefs({ filteredCategories: ['celebrity'] }))).action, 'allow');
});
test('context: technology preventing deaths stays visible', async () => {
  const result = await classifier.classify(story('New technology could prevent road deaths'));
  assert.equal(result.categories.find(x => x.id === 'tragedy').score, 0);
  assert.equal(result.categories.find(x => x.id === 'technology').score, 4);
  assert.ok(result.signals.some(x => x.kind === 'context' && x.contribution < 0));
  assert.equal(evaluate(story('New technology could prevent road deaths'), result, prefs({ filteredCategories: ['tragedy'] })).action, 'allow');
});
test('context exclusions cover crime, disaster and figurative war', async () => {
  assert.equal(await score('Crime prevention programme begins locally', 'crime'), 0);
  assert.equal(await score('Disaster preparedness protects rural homes', 'disaster'), 0);
  assert.equal(await score('Price war lowers shopping costs', 'war'), 0);
});
test('a URL context cannot neutralise a fatal headline', async () => {
  assert.ok(await score('Three killed in fatal road crash', 'tragedy', { url: 'https://example.com/save-lives/new-story' }) >= 4);
});
test('repeated terms count once per field', async () => { assert.equal(await score('Crime crime crime headlines', 'crime'), 4); });
test('whole-word, punctuation, Unicode and case-insensitive matching', () => {
  assert.equal(matchesPhrase('ROYAL—FAMILY news', 'royal family'), true);
  assert.equal(matchesPhrase('Ｖａｎｕａｔｕ news', 'Vanuatu'), true);
  assert.equal(matchesPhrase('transport awards', 'sport'), false);
  assert.equal(matchesPhrase('transport awards', 'war'), false);
  assert.equal(matchesPhrase('Anything here', ''), false);
});
test('selected categories collapse and unselected categories allow', async () => {
  const item = story('Celebrity divorce dominates headlines');
  const filtered = await decision(item, prefs({ filteredCategories: ['celebrity'] }));
  assert.equal(filtered.action, 'collapse'); assert.equal(filtered.categories[0].name, 'Celebrity & Gossip');
  assert.ok(filtered.signals.some(x => x.term === 'celebrity' && x.field === 'headline'));
  assert.equal((await decision(item, prefs({ filteredCategories: ['sport'] }))).action, 'allow');
});
test('hide mode makes the same category decision with a different action', async () => {
  assert.equal((await decision(story('Murder investigation starts today'), prefs({ mode: 'hide', filteredCategories: ['crime'] }))).action, 'hide');
});
test('blocked custom phrase filters even without categories and explains its location', async () => {
  const result = await decision(story('A project opens in the village', { description: 'A royal family visit is planned' }), prefs({ blockedKeywords: ['royal family'] }));
  assert.equal(result.action, 'collapse'); assert.equal(result.signals[0].kind, 'blocked'); assert.equal(result.signals[0].field, 'description');
});
test('always-show keyword takes precedence over blocked phrases, selected categories and hide once', async () => {
  const item = story('Vanuatu murder investigation starts today');
  const result = await decision(item, prefs({ filteredCategories: ['crime'], blockedKeywords: ['murder'], allowedKeywords: ['Vanuatu'], mode: 'hide' }), 'hide');
  assert.equal(result.action, 'allow'); assert.equal(result.signals[0].kind, 'allowed');
});
test('URL paths are decoded and included in keyword matching, query strings are not', async () => {
  assert.equal((await decision(story('Village project launches this week', { url: 'https://example.com/community%20development/123' }), prefs({ blockedKeywords: ['community development'] }))).action, 'collapse');
  assert.equal((await decision(story('Village project launches this week', { url: 'https://example.com/123?source=murder' }), prefs({ blockedKeywords: ['murder'] }))).action, 'allow');
});
test('disabled globally or on a domain always allows, even for manual hide', async () => {
  const item = story('Crime report for the region', { sourceDomain: 'www.news.example' });
  assert.equal((await decision(item, prefs({ enabled: false }), 'hide')).action, 'allow');
  assert.equal((await decision(item, prefs({ filteredCategories: ['crime'], disabledDomains: ['news.example'] }), 'hide')).action, 'allow');
});
test('restore once allows a matching story and manual hide works when active', async () => {
  assert.equal((await decision(story('Crime report for the region'), prefs({ filteredCategories: ['crime'] }), 'show')).action, 'allow');
  assert.equal((await decision(story('Village project launches this week'), prefs(), 'hide')).action, 'collapse');
});
test('emergency information remains visible even when a matching rule asks to hide', async () => {
  assert.equal((await decision(story('Tsunami warning: evacuate now'), prefs({ mode: 'hide', blockedKeywords: ['tsunami'], filteredCategories: ['disaster'] }), 'hide')).action, 'allow');
});
test('exact URL exceptions are canonical and always-show beats blocked URLs', async () => {
  const url = 'https://news.example/story/123';
  assert.equal((await decision(story('Crime report for the region'), prefs({ alwaysShowUrls: [url], blockedUrls: [url], filteredCategories: ['crime'] }))).action, 'allow');
  assert.equal((await decision(story('Village project launches this week'), prefs({ blockedUrls: [url] }))).action, 'collapse');
});
test('preferences are validated, deduplicated and bounded; malformed values fail safely', () => {
  const result = sanitisePreferences({ mode: 'bad', enabled: 'true', filteredCategories: ['crime', 'invalid'],
    blockedKeywords: [' murder ', 'murder', '', 123], disabledDomains: ['WWW.News.Example', '../bad'], alwaysShowUrls: ['javascript:alert(1)'] });
  assert.equal(result.mode, 'collapse'); assert.deepEqual(result.filteredCategories, ['crime']);
  assert.deepEqual(result.blockedKeywords, ['murder']); assert.deepEqual(result.disabledDomains, ['news.example']);
  assert.deepEqual(result.alwaysShowUrls, []); assert.deepEqual(sanitisePreferences(null), defaultPreferences());
});
test('patching a field preserves existing preferences', () => {
  const next = applyPreferencePatch(prefs({ allowedKeywords: ['Vanuatu'] }), { mode: 'hide' });
  assert.deepEqual(next.allowedKeywords, ['Vanuatu']); assert.equal(next.mode, 'hide');
});
test('domain matching respects boundaries and subdomains', () => {
  assert.equal(domainMatches('www.news.example', 'news.example'), true);
  assert.equal(domainMatches('badnews.example', 'news.example'), false);
  assert.equal(domainMatches('news.example.evil.test', 'news.example'), false);
});
test('canonical URLs strip query/fragment and refuse non-web URLs', () => {
  assert.equal(canonicalUrl('https://example.com/story/?utm=1#top'), 'https://example.com/story');
  assert.equal(canonicalUrl('javascript:alert(1)'), '');
});
test('filter pipeline accepts an independent asynchronous classifier implementation', async () => {
  const engine = new FilterEngine({ classify: async () => ({ categories: [{ id: 'science', name: 'Science', score: 6, threshold: 4 }], signals: [] }) });
  const result = await engine.process(story('A new discovery is announced'), prefs({ filteredCategories: ['science'] }));
  assert.equal(result.decision.action, 'collapse');
});
