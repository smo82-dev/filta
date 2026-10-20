import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] };
test('universal reliability: labelled discovery, extraction, decisions, SPA and large feeds', { timeout: 120000 }, async t => {
  const browser = await chromium.launch(launch);
  const context = await browser.newContext();
  const harness = new WebExtensionHarness(context, root); await harness.init();
  await context.route('http://news-fixture.test/universal', route => route.fulfill({ contentType: 'text/html', path: resolve(root, 'tests/fixtures/universal.html') }));
  let news;
  try {
    await t.test('labelled structural fixture meets 95% recall without modifying protected material', async () => {
      news = await context.newPage(); harness.id(news); await news.goto('http://news-fixture.test/universal');
      await news.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const metric = await news.evaluate(() => {
        const detector = new NFDetectors.GenericDetector(); const start = performance.now();
        const cards = detector.detect(document, location.href);
        const expected = [...document.querySelectorAll('[data-expected]')].map(card => card.id);
        const found = cards.map(card => card.handle.id);
        return { expected: expected.length, detected: found.length, tp: found.filter(id => expected.includes(id)).length,
          fp: found.filter(id => !expected.includes(id)), missed: expected.filter(id => !found.includes(id)), scanMs: performance.now() - start,
          cards: cards.map(card => ({ id: card.handle.id, story: card.story })), diagnostics: detector.diagnostics };
      });
      metric.recall = metric.tp / metric.expected; metric.precision = metric.tp / metric.detected;
      await mkdir('test-results', { recursive: true }); await writeFile('test-results/discovery.json', JSON.stringify(metric, null, 2));
      assert.ok(metric.recall >= .95, JSON.stringify(metric)); assert.deepEqual(metric.fp, []);
      assert.equal(metric.cards.find(card => card.id === 'structured').story.section, 'Markets');
      assert.equal(metric.cards.find(card => card.id === 'no-bleed').story.section, undefined);
      assert.equal(metric.cards.find(card => card.id === 'business-0').story.description, 'An update for local residents.');
      assert.ok(metric.diagnostics.rejected['multiple-stories'] > 0);
    });
    await t.test('adapter metadata survives generic deduplication at an outer story boundary', async () => {
      const page = await context.newPage();
      await page.setContent('<ul><li id="complete"><div data-format-theme="0"><a href="/world/2026/oct/20/report" data-link-name="news | card-@1 | media-picture"></a><h3 class="card-headline"><div>Analysis</div><span class="headline-text">Why a community project needs a careful approach</span></h3></div></li></ul>');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const cards = await page.evaluate(() => {
        const adapter = NFDetectors.SITE_ADAPTERS.find(adapter => adapter.id === 'guardian');
        return NFDetectors.deduplicate([...adapter.detect(document, 'https://theguardian.com/'), ...new NFDetectors.GenericDetector().detect(document, 'https://theguardian.com/')]).map(card => ({ id: card.handle.id, story: card.story }));
      });
      assert.equal(cards.length, 1); assert.equal(cards[0].id, 'complete');
      assert.equal(cards[0].story.section, 'Analysis'); assert.equal(cards[0].story.headline, 'Why a community project needs a careful approach');
      await page.close();
    });
    await t.test('all 14 categories filter complete cards in Collapse and Hide while other topics stay visible', async () => {
      const categories = ['celebrity','crime','tragedy','sexual','war','disaster','politics','sport','entertainment','opinion','business','technology','science','sponsored'];
      await harness.prefs({ configured: true, filteredCategories: categories, mode: 'collapse' });
      await news.addScriptTag({ path: resolve(root, 'dist/content.js') });
      await news.waitForFunction(() => document.querySelectorAll('[data-news-filter-ui=card]').length === 60);
      for (const id of ['no-bleed','reading','consent','ads','unsafe-group','navigation','footer']) assert.notEqual(await news.locator(`#${id}`).evaluate(el => getComputedStyle(el).display), 'none', id);
      await harness.prefs({ filteredCategories: ['business'], mode: 'hide' });
      await news.waitForFunction(() => document.querySelectorAll('[data-news-filter-ui=card]').length === 0);
      for (let i = 0; i < 4; i++) await news.locator(`#business-${i}`).waitFor({ state: 'hidden' });
      for (const cat of categories.filter(cat => cat !== 'business')) await news.locator(`#${cat}-0`).waitFor({ state: 'visible' });
      await harness.prefs({ allowedKeywords: ['Local developments'], filteredCategories: categories });
      await news.locator('#business-0').waitFor({ state: 'visible' });
      await harness.prefs({ enabled: false }); await news.locator('#structured').waitFor({ state: 'visible' });
    });
    await t.test('dynamic metadata, insertion, removal and plain linked cards are processed incrementally', async () => {
      await harness.prefs({ enabled: true, mode: 'collapse', filteredCategories: ['technology'], allowedKeywords: [] });
      await news.evaluate(() => { const el = document.createElement('div'); el.id = 'dynamic'; el.className = 'story-card'; el.innerHTML = '<span class="category">Tech</span><a href="/reports/dynamic">An unexpected development arrives during the day</a>'; document.querySelector('#feed').append(el); });
      await news.locator('#dynamic').waitFor({ state: 'hidden' });
      await news.evaluate(() => document.querySelector('#dynamic .category').textContent = 'Local');
      await news.locator('#dynamic').waitFor({ state: 'visible' });
      await news.evaluate(() => document.querySelector('#dynamic a').href = '/tech/dynamic');
      await news.locator('#dynamic').waitFor({ state: 'hidden' });
      await news.evaluate(() => document.querySelector('#dynamic').remove());
      await news.waitForFunction(() => !document.querySelector('#dynamic'));
      await news.waitForFunction(() => ![...document.querySelectorAll('[data-news-filter-ui=card]')].some(host => host.shadowRoot.textContent.includes('An unexpected development arrives during the day')));
      await news.waitForTimeout(250);
      assert.equal((await harness.dispatch(news, { kind: 'PAGE_STATUS' }, {})).detected, 61);
    });
    await t.test('Show story survives metadata changes, resets for recycled URLs and URL-only SPA navigation', async () => {
      const replacement = news.locator('#technology-0 + [data-news-filter-ui=card]');
      await replacement.getByRole('button', { name: 'Show story', exact: true }).click();
      await news.evaluate(() => document.querySelector('#technology-0').setAttribute('data-section', 'Technology'));
      await news.waitForTimeout(250); await news.locator('#technology-0').waitFor({ state: 'visible' });
      await news.evaluate(() => document.querySelector('#technology-0 a').href = '/reports/recycled');
      await news.locator('#technology-0').waitFor({ state: 'hidden' });
      await news.locator('#technology-0 + [data-news-filter-ui=card]').getByRole('button', { name: 'Show story', exact: true }).click();
      await news.evaluate(() => history.pushState({}, '', '/different-route'));
      await news.locator('#technology-0').waitFor({ state: 'hidden' });
    });
    await t.test('diagnostic counts are available only in debug mode and zero detection is understandable', async () => {
      assert.equal((await harness.dispatch(news, { kind: 'PAGE_STATUS' }, {})).diagnostics, undefined);
      await harness.prefs({ debug: true });
      const debug = (await harness.dispatch(news, { kind: 'PAGE_STATUS' }, {})).diagnostics;
      assert.ok(debug.selectedTopicMatches > 0); assert.ok(debug.noTopicEvidence > 0); assert.ok(debug.decisions.collapse > 0);
      await context.route('http://news-fixture.test/empty', route => route.fulfill({ contentType: 'text/html', body: '<title>Latest News</title><main></main>' }));
      await news.goto('http://news-fixture.test/empty'); await news.addScriptTag({ path: resolve(root, 'dist/content.js') });
      const popup = await harness.popup(news);
      assert.match(await popup.locator('#state').textContent(), /No news stories found/); await popup.close();
    });
    await t.test('600-card feed keeps discovery bounded; cache reuse is covered by the incremental-scanner regression', async () => {
      const page = await context.newPage();
      await page.setContent('<title>Large news feed</title><main>' + Array.from({ length: 600 }, (_, i) => `<div class="tile" id="large-${i}"><h3><a href="https://news.example/reports/${i}">Local report number ${i} describes a community project</a></h3></div>`).join('') + '</main>');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const timing = await page.evaluate(() => { const start = performance.now(); const cards = new NFDetectors.GenericDetector().detect(document, 'https://news.example/'); return { detected: cards.length, elapsedMs: performance.now() - start }; });
      assert.equal(timing.detected, 600); assert.ok(timing.elapsedMs < 10000, JSON.stringify(timing));
      await writeFile('test-results/performance.json', JSON.stringify(timing, null, 2)); await page.close();
    });
  } finally { await context.close(); await browser.close(); }
});
