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

test('qualified publisher sections: politics_election-2026, crime-and-justice, sponsored-stories; combined sections decide neither', async () => {
  const at = (path, headline = 'A plain update from the region today') => flagged(headline, { url: `https://news.example/${path}/story-123` });
  assert.ok((await at('news/politics_election-2026')).includes('politics'));
  assert.ok((await at('news/crime-and-justice')).includes('crime'));
  assert.ok((await at('sponsored-stories')).includes('sponsored'));
  assert.ok((await at('nz-politics')).includes('politics'));
  const combined = await at('news/science-and-technology');
  assert.ok(!combined.includes('science') && !combined.includes('technology'));
  assert.ok(!(await at('news/crime-wave-hits-suburbs-hard')).includes('crime'), 'long slugs are not sections');
});

test('opinion leads, sexual offending vocabulary, conflict-zone attacks and technology words', async () => {
  assert.ok((await flagged('Analysis: The real roadblock to reform is not the Prime Minister')).includes('opinion'));
  assert.ok((await flagged('Some text', { url: 'https://news.example/commentisfree/2026/oct/23/piece' })).includes('opinion'));
  assert.ok((await flagged('Influencer pleads not guilty to raping teen')).includes('sexual'));
  assert.ok((await flagged('Russia bombs Kyiv as Ukraine fires drones towards Moscow')).includes('war'));
  assert.ok((await flagged('Remote-controlled robot nudges kitten to safety')).includes('technology'));
  assert.ok(!(await flagged('Redwood: The KGB agent who helped stop the Cold War turning hot')).includes('war'));
  assert.ok(!(await flagged('Opinion polls show the race tightening in the capital')).includes('opinion'));
});

test('international English-language vocabulary (live AP, ABC Australia, NDTV, Straits Times, 23 Oct 2026)', async () => {
  for (const [headline, category] of [
    ['Senate races to watch', 'politics'],
    ['Early voting boost', 'politics'],
    ['PM Modi Says Congress Hurts Dissent Movements', 'politics'],
    ['Prabowo vows Indonesia will not be frightened by MSCI', 'politics'],
    ['Canada and Turkey forge trade and defense deals as Carney looks beyond US', 'politics'],
    ['NAB staff speak out after mass job cuts revealed', 'business'],
    ['GovTech retrenches 38 employees in second wave of layoffs', 'business'],
    ['Lee Biscuits, maker of Marie biscuits, to end production, shutter factory', 'business'],
    ['Military uses of AI', 'technology'],
    ['Firms should act now to fix critical PHP vulnerabilities', 'technology'],
    ['Inside the Nanning Ponzi scheme: Why smart people get scammed', 'crime'],
    ['Disgraced former footballer to remain behind bars', 'crime'],
    ['Russia’s overnight barrage', 'war'],
    ['Asian Para Games Day 4 Live', 'sport'],
    ['Europe’s killer heat this summer claims 50,000 lives', 'disaster'],
  ]) assert.ok((await flagged(headline)).includes(category), `${headline} -> ${category}`);
  for (const [headline, category] of [
    ['Trump doubles down on support of Ramaswamy attack ad', 'war'],
    ['Affordable home scheme went from blessing to disaster, buyers say', 'disaster'],
  ]) assert.ok(!(await flagged(headline)).includes(category), `${headline} must not be ${category}`);
});

test('publisher labels: "Topic:Crime" and "Analysis by …" name the section', async () => {
  assert.ok((await flagged('Dozens arrested in raids', { labels: ['Topic:Crime'] })).includes('crime'));
  assert.ok((await flagged('Why the budget missed its mark', { labels: ['Analysis by Jane Smith'] })).includes('opinion'));
  assert.ok((await flagged('Quick hits from day five', { labels: ['Topic:Cricket'] })).includes('sport'));
});
