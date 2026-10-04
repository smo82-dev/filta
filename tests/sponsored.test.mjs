import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RuleBasedClassifier, evaluate, defaultPreferences } from './.generated/core.mjs';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';

const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] };
const classifier = new RuleBasedClassifier();
const visible = (page, id) => page.locator(`#${id}`).waitFor({ state: 'visible' });
const hidden = (page, id) => page.locator(`#${id}`).waitFor({ state: 'hidden' });

test('sponsored content: shared extraction, safety, settings and dynamic filtering', { timeout: 120000 }, async t => {
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const harness = new WebExtensionHarness(context, root);
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await harness.init();
  let news;
  try {
    await t.test('generic extraction keeps short visible metadata, without broad card text or unrelated advertisements', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.goto('http://news-fixture.test/sponsored');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const cards = await page.evaluate(() => new NFDetectors.GenericDetector().detect(document, location.href)
        .map(card => ({ id: card.handle.id, story: card.story })));
      assert.equal(cards.length, 14);
      const byId = new Map(cards.map(card => [card.id, card.story]));
      assert.deepEqual(byId.get('sponsored').labels, ['SPONSORED']);
      assert.deepEqual(byId.get('paid').labels, ['Paid Content']);
      assert.deepEqual(byId.get('partner').labels, ['Partner Content']);
      assert.deepEqual(byId.get('presented').labels, ['Presented by Acme']);
      assert.deepEqual(byId.get('sponsored-by').labels, ['Sponsored by Acme']);
      assert.deepEqual(byId.get('aria-badge').labels, ['Advertisement']);
      assert.deepEqual(byId.get('editorial').labels, ['Rugby', 'Analysis', 'Politics', 'Live', 'Breaking']);
      assert.equal(byId.get('editorial').section, 'Rugby');
      const preferences = { ...defaultPreferences(), configured: true, filteredCategories: ['sponsored'], blockedKeywords: ['sponsored', 'advertisement', 'paid content', 'partner content'] };
      for (const id of ['clean', 'nested-ad', 'nested-related', 'hidden-labels', 'controls', 'incidental', 'long-label']) {
        const item = byId.get(id);
        assert.ok(item, id);
        assert.equal(evaluate(item, await classifier.classify(item), preferences).action, 'allow', id);
      }
      assert.ok(!byId.has('ambiguous')); assert.ok(!byId.has('reading'));
      assert.ok(!cards.some(card => card.id === 'feed' || !card.id));
      await page.close();
    });
    await t.test('shared extraction works through BBC, RNZ and Guardian adapters including overlay cards', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.goto('http://news-fixture.test/');
      await page.setContent(await readFile(resolve(root, 'tests/fixtures/adapters.html'), 'utf8'));
      await page.evaluate(() => {
        for (const id of ['bbc', 'rnz', 'guardian', 'guardian-overlay']) {
          const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'Paid Content';
          document.getElementById(id).append(badge);
        }
      });
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const cards = await page.evaluate(() => ['bbc', 'rnz', 'guardian'].flatMap(id =>
        NFDetectors.SITE_ADAPTERS.find(adapter => adapter.id === id)
          .detect(document, `https://${id === 'guardian' ? 'theguardian.com' : id === 'rnz' ? 'rnz.co.nz' : 'bbc.com'}/news`)
          .map(card => ({ id: card.handle.id, story: card.story }))));
      assert.deepEqual(cards.map(card => card.id).sort(), ['bbc', 'guardian', 'guardian-overlay', 'rnz']);
      for (const card of cards) {
        assert.ok(card.story.labels.includes('Paid Content'));
        assert.ok((await classifier.classify(card.story)).categories.find(x => x.id === 'sponsored').score >= 4);
      }
      await page.close();
    });
    await t.test('settings expose the unselected new category and category filtering explains/restores cards', async () => {
      const settings = await harness.settings();
      await settings.waitForFunction(() => !document.querySelector('#save').disabled);
      const choice = settings.getByRole('checkbox', { name: 'Sponsored & Paid Content', exact: true });
      assert.equal(await choice.isChecked(), false);
      await choice.check(); await settings.locator('#save').click();
      news = await harness.loadNews(undefined, '/sponsored');
      for (const id of ['sponsored', 'paid', 'partner', 'presented', 'sponsored-by', 'aria-badge']) await hidden(news, id);
      for (const id of ['clean', 'nested-ad', 'nested-related', 'hidden-labels', 'controls', 'incidental', 'long-label', 'editorial']) await visible(news, id);
      const replacement = news.locator('#sponsored + [data-news-filter-ui=card]');
      await replacement.getByText('Why was this hidden?', { exact: true }).click();
      assert.match(await replacement.locator('.box').textContent(), /Sponsored & Paid Content/);
      assert.match(await replacement.locator('details').textContent(), /sponsored.*label/i);
      await replacement.getByRole('button', { name: 'Show story', exact: true }).click(); await visible(news, 'sponsored');
      await settings.close(); await harness.loadNews(news, '/sponsored'); await hidden(news, 'sponsored');
    });
    await t.test('label-only hide phrases and always-show corrections keep precedence in both modes', async () => {
      await harness.prefs({ filteredCategories: [], blockedKeywords: ['sponsored'], allowedKeywords: [], mode: 'collapse' });
      await hidden(news, 'sponsored'); await hidden(news, 'sponsored-by'); await visible(news, 'paid');
      assert.match(await news.locator('#sponsored + [data-news-filter-ui=card]').locator('.box').textContent(), /hide phrase/i);
      await harness.prefs({ filteredCategories: ['sponsored'], blockedKeywords: ['sponsored'], allowedKeywords: ['SPONSORED'], mode: 'hide' });
      await visible(news, 'sponsored'); await hidden(news, 'paid');
      assert.equal(await news.locator('#paid + [data-news-filter-ui=card]').count(), 0);
      await visible(news, 'nested-ad'); await visible(news, 'nested-related');
      await harness.prefs({ filteredCategories: ['sport'], blockedKeywords: [], allowedKeywords: [] });
      await hidden(news, 'editorial'); await visible(news, 'sponsored'); await visible(news, 'paid');
    });
    await t.test('inserted labels, text/marker/visibility changes and new cards are rescanned without losing hidden badges', async () => {
      await harness.prefs({ filteredCategories: ['sponsored'], blockedKeywords: [], allowedKeywords: [], mode: 'collapse' });
      await hidden(news, 'paid');
      await news.evaluate(() => document.querySelector('#clean .card-label').textContent = 'Sponsored');
      await hidden(news, 'clean');
      await news.evaluate(() => document.querySelector('#paid [data-testid]').textContent = 'Local');
      await visible(news, 'paid');
      await news.evaluate(() => {
        const badge = document.querySelector('#paid [data-testid]'); badge.textContent = 'Paid Content'; badge.hidden = true;
      });
      await visible(news, 'paid');
      await news.evaluate(() => document.querySelector('#paid [data-testid]').hidden = false);
      await hidden(news, 'paid');
      await news.evaluate(() => document.querySelector('#incidental span').className = 'badge');
      await hidden(news, 'incidental');
      await news.evaluate(() => {
        const card = document.createElement('article'); card.id = 'dynamic-sponsored';
        card.innerHTML = '<span class="badge">Partner Content</span><h3><a href="/news/dynamic-story">A new story arrives after the initial page load</a></h3>';
        document.querySelector('#feed').append(card);
      });
      await hidden(news, 'dynamic-sponsored');
      await harness.prefs({ mode: 'hide' }); await hidden(news, 'sponsored');
      await harness.prefs({ mode: 'collapse' }); await hidden(news, 'sponsored');
      await news.locator('#sponsored + [data-news-filter-ui=card]').waitFor({ state: 'visible' });
      await harness.loadNews(news, '/sponsored'); await hidden(news, 'sponsored');
    });
    assert.deepEqual(errors, []); assert.deepEqual(harness.externalRequests, []);
  } finally { await context.close(); await browser.close(); }
});
