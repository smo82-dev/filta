import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleBasedClassifier, evaluate, defaultPreferences } from './.generated/core.mjs';
// The learned topic model is offline evidence for ordinary headlines that name no
// topic keyword. Independent accuracy figures live in docs/validation-0.2.0/topic-model.md.
const classifier = new RuleBasedClassifier();
const story = (headline, rest = {}) => ({ headline, sourceDomain: 'news.example', url: 'https://news.example/story/1', ...rest });
const prefs = (rest = {}) => ({ ...defaultPreferences(), configured: true, ...rest });
const flagged = async (headline, rest) => (await classifier.classify(story(headline, rest))).categories.filter(c => c.score >= c.threshold).map(c => c.id);

test('ordinary headlines without topic keywords reach their topic', async () => {
  for (const [headline, category] of [
    ['Cabrera Leads Red Sox Past Blue Jays 5-4', 'sport'],
    ["Erstad's Double Lifts Angels to Win", 'sport'],
    ['Warriors lock down star hooker for another three seasons', 'sport'],
    ['Kiwi dollar slides as Reserve Bank signals more cuts', 'business'],
    ['Oil prices bubble to record high', 'business'],
    ['Man charged after stabbing at Auckland mall', 'crime'],
    ['Netflix renews hit drama for a third season', 'entertainment'],
    ['Senate passes sweeping tax bill', 'politics'],
    ['Apple unveils new iPhone with faster chip', 'technology'],
    ['NASA mission finds water on distant planet', 'science'],
  ]) assert.ok((await flagged(headline)).includes(category), `${headline} -> ${category}`);
});

test('everyday lifestyle stories stay unflagged', async () => {
  for (const headline of ['10 easy dinner recipes for busy weeknights', 'How to keep your houseplants alive through winter',
    'Best beaches to visit this summer', 'Labour weekend scorcher: Chch set for 27C']) assert.deepEqual(await flagged(headline), [], headline);
});

test('model evidence is explained by the phrases that drove it and weighs one decisive term', async () => {
  const result = await classifier.classify(story('Cabrera Leads Red Sox Past Blue Jays 5-4'));
  const signal = result.signals.find(s => s.kind === 'model' && s.category === 'sport');
  assert.ok(signal, 'model signal present');
  assert.match(signal.term, /^Topic model: .*jays/);
  assert.equal(signal.contribution, result.categories.find(c => c.id === 'sport').threshold);
  // Unselected and non-confident categories add nothing.
  assert.ok(!result.signals.some(s => s.kind === 'model' && s.category === 'celebrity'));
});

test('science outranks technology where the training data merged them', async () => {
  const telescope = await flagged('Researchers build a telescope for a school project');
  assert.ok(!telescope.includes('technology'));
  assert.ok((await flagged('Microsoft patches critical Windows flaw')).includes('technology'));
});

test('model evidence never overrides always-show, pause, emergency information or contextual exceptions', async () => {
  const sport = story('Cabrera Leads Red Sox Past Blue Jays 5-4');
  const result = await classifier.classify(sport);
  assert.equal(evaluate(sport, result, prefs({ filteredCategories: ['sport'] })).action, 'collapse');
  assert.equal(evaluate(sport, result, prefs({ filteredCategories: ['sport'], allowedKeywords: ['red sox'] })).action, 'allow');
  assert.equal(evaluate(sport, result, prefs({ filteredCategories: ['sport'], disabledDomains: ['news.example'] })).action, 'allow');
  const warning = story('Tsunami warning issued after match abandoned');
  assert.equal(evaluate(warning, await classifier.classify(warning), prefs({ filteredCategories: ['sport', 'disaster'] })).action, 'allow');
  const prevention = await classifier.classify(story('Crime prevention grant helps neighbourhood watch'));
  assert.ok(prevention.categories.find(c => c.id === 'crime').score < 4);
});

test('Westminster-system politics vocabulary, without Labour Weekend or national parks', async () => {
  assert.ok((await flagged('Hipkins attacks coalition over cost of living')).includes('politics'));
  assert.ok((await flagged('Labour caucus backs leader after poll slump')).includes('politics'));
  assert.ok(!(await flagged('Labour weekend traffic builds on State Highway 1')).includes('politics'));
  assert.ok(!(await flagged('Visitors flock to national park after storm clean-up')).includes('politics'));
});

test('war, tragedy, disaster and celebrity: broader vocabulary, learned war context, figurative exceptions', async () => {
  for (const [headline, category] of [
    ['Militants kill hostage in overnight raid', 'war'],
    ['Car bomb kills 11 near government compound', 'war'],
    ['Rebels seize border town as ceasefire collapses', 'war'],
    ['Peacekeepers deployed after clashes displace thousands', 'war'],
    ['Eight children stabbed to death as they sleep', 'tragedy'],
    ['Commuter plane crashes, killing 54', 'tragedy'],
    ['Musicians mourn DJ after his death at 28', 'tragedy'],
    ['Strong quake hits island, aftershocks felt across region', 'disaster'],
    ['Typhoon lashes coast as thousands evacuate', 'disaster'],
    ['Reality star and her boyfriend split weeks before wedding', 'celebrity'],
    ['Kardashian sisters reunite on the red carpet', 'celebrity'],
  ]) assert.ok((await flagged(headline)).includes(category), `${headline} -> ${category}`);
  for (const [headline, category] of [
    ['A trade war could cost the party at the ballot box', 'war'],
    ['Overdose deaths fall in 14 states', 'tragedy'],
    ['What Ned Stark whispered during his Game of Thrones death', 'tragedy'],
    ['Poll shows candidates locked in a dead heat', 'tragedy'],
    ['Hurricanes name squad without injured captain', 'disaster'],
  ]) assert.ok(!(await flagged(headline)).includes(category), `${headline} must not be ${category}`);
});

test('New Zealand sport names, with ambiguous club names needing sporting context', async () => {
  for (const headline of ['Black Ferns name squad for Bledisloe decider', 'Crusaders beat Blues in Super Rugby thriller',
    'Hurricanes sign Wellington hooker on two-year contract', 'Phoenix coach eyes A-League playoff spot']) {
    assert.ok((await flagged(headline)).includes('sport'), headline);
  }
  for (const headline of ['Police chiefs meet over gang violence', 'Blues musician releases first album in a decade']) {
    assert.ok(!(await flagged(headline)).includes('sport'), headline);
  }
});
