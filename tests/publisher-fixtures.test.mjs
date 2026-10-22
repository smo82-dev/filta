import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const fixtures = JSON.parse(await readFile(resolve(root, 'tests/fixtures/publishers/manifest.json'), 'utf8'));
test('captured publisher snippets: discovery and safe rendering (not whole-site recall)', { timeout: 120000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const context = await browser.newContext(); await context.route('**/*', route => route.abort());
  const page = await context.newPage();
  const results = [];
  try {
    for (const fixture of fixtures) await t.test(fixture.publisher, async () => {
      await page.setContent(await readFile(resolve(root, 'tests/fixtures/publishers', fixture.file), 'utf8'));
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const found = await page.evaluate(url => {
        const cards = NFDetectors.deduplicate([...(NFDetectors.SITE_ADAPTERS.find(adapter => adapter.matches(new URL(url).hostname))?.detect(document, url) ?? []), ...new NFDetectors.GenericDetector().detect(document, url)]);
        return cards.map(card => ({ url: card.story.url, headline: card.story.headline }));
      }, fixture.url);
      const missed = fixture.expectedUrls.filter(url => !found.some(card => card.url === url));
      results.push({ publisher: fixture.publisher, kind: fixture.kind, expected: fixture.expectedUrls.length, detected: found.length, missed });
      assert.deepEqual(missed, [], fixture.publisher); assert.equal(found.length, fixture.expectedUrls.length);
      assert.ok(found.every(card => !/^<img|AFP via Getty/.test(card.headline)));
    });
  } finally {
    await mkdir('test-results', { recursive: true }); await writeFile('test-results/publisher-fixtures.json', JSON.stringify(results, null, 2));
    await context.close(); await browser.close();
  }
});

test('captured publisher snippets: complete-card filtering, restoration and neighbour isolation', { timeout: 120000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const harness = new WebExtensionHarness(context, root); await harness.init();
  const page = await context.newPage(); harness.id(page);
  const results = [];
  try {
    for (const fixture of fixtures) await t.test(fixture.publisher, async () => {
      // All other publisher resources are blocked: offline snippet replay only.
      await page.unroute('**/*');
      await page.route('**/*', route => route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()
        ? route.fulfill({ contentType: 'text/html', path: resolve(root, 'tests/fixtures/publishers', fixture.file) }) : route.abort());
      await page.goto(fixture.url);
      const tagCards = async () => {
        await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
        return page.evaluate(url => {
        const cards = NFDetectors.deduplicate([...(NFDetectors.SITE_ADAPTERS.find(adapter => adapter.matches(new URL(url).hostname))?.detect(document, url) ?? []), ...new NFDetectors.GenericDetector().detect(document, url)]);
        cards.forEach((card, i) => card.handle.setAttribute('data-replay-card', String(i)));
        return cards.map(card => card.story);
        }, fixture.url);
      };
      const cards = await tagCards();
      assert.equal(cards.length, fixture.expectedUrls.length);
      const target = cards[0];
      await harness.prefs({ configured: true, enabled: true, filteredCategories: [], blockedUrls: [target.url], allowedKeywords: [], mode: 'collapse' });
      await page.addScriptTag({ path: resolve(root, 'dist/content.js') });
      await page.locator('[data-replay-card="0"]').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelectorAll('[data-news-filter-ui=card]').length === 1);
      // Snippets have no publisher CSS. Activate the real handler without
      // claiming native pointer/layout behaviour from this isolated replay.
      await page.locator('[data-news-filter-ui=card]').getByRole('button', { name: 'Show story', exact: true }).evaluate(button => button.click());
      await page.locator('[data-replay-card="0"]').waitFor({ state: 'visible' });
      // A new page clears show-once; verify Hide and restoring all cards on pause.
      await page.reload(); await tagCards(); await harness.prefs({ mode: 'hide' });
      await page.addScriptTag({ path: resolve(root, 'dist/content.js') });
      await page.locator('[data-replay-card="0"]').waitFor({ state: 'hidden' });
      for (let i = 1; i < cards.length; i++) await page.locator(`[data-replay-card="${i}"]`).waitFor({ state: 'visible' });
      assert.equal((await harness.dispatch(page, { kind: 'PAGE_STATUS' }, {})).filtered, 1);
      await harness.prefs({ enabled: false });
      await page.locator('[data-replay-card="0"]').waitFor({ state: 'visible' });
      results.push({ publisher: fixture.publisher, cards: cards.length, collapse: true, hide: true, restored: true });
      await page.unroute('**/*');
    });
    await writeFile('test-results/publisher-rendering.json', JSON.stringify({ provenance: 'Offline captured snippets; URL block tests isolate rendering, not semantic accuracy or live-site recall', results }, null, 2));
  } finally { await browser.close(); }
});
