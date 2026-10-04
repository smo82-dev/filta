import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] };
async function visible(page, id) { await page.locator(`#${id}`).waitFor({ state: 'visible' }); }
async function hidden(page, id) { await page.locator(`#${id}`).waitFor({ state: 'hidden' }); }
test('Chromium: production DOM/UI with a simulated WebExtension API (native installation is separate)', { timeout: 120000 }, async t => {
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  const harness = new WebExtensionHarness(context, root);
  await harness.init();
  let news, settings;
  try {
    await t.test('generic detection extracts complete single cards and protects navigation, cookies, advertisements and emergencies', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.goto('http://news-fixture.test/');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const cards = await page.evaluate(() => new NFDetectors.GenericDetector().detect(document, location.href)
        .map(x => ({ id: x.handle.id, headline: x.story.headline, description: x.story.description, section: x.story.section })));
      assert.equal(cards.length, 8);
      assert.ok(cards.some(x => x.id === 'crime' && x.section === 'Crime' && x.description.startsWith('Police')));
      assert.ok(!cards.some(x => ['group', 'navigation', 'advertisement', 'cookie-banner', 'emergency-panel'].includes(x.id)));
      await page.close();
    });
    await t.test('BBC, Guardian and RNZ adapters detect their representative structures', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.setContent(await readFile(resolve(root, 'tests/fixtures/adapters.html'), 'utf8'));
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      const ids = await page.evaluate(() => NFDetectors.SITE_ADAPTERS.map((adapter, i) => {
        const hosts = ['bbc.com', 'theguardian.com', 'rnz.co.nz'];
        const cards = adapter.detect(document, `https://${hosts[i]}/`);
        return { id: adapter.id, matches: adapter.matches(hosts[i]), count: cards.length };
      }));
      assert.ok(ids.every(x => x.matches && x.count >= 1));
      const guardian = await page.evaluate(() => NFDetectors.SITE_ADAPTERS.find(x => x.id === 'guardian')
        .detect(document, 'https://theguardian.com/').map(x => ({ id: x.handle.id, image: x.story.imageUrl })));
      assert.ok(guardian.some(x => x.id === 'guardian-overlay' && x.image.endsWith('/photo.png')));
      assert.ok(!guardian.some(x => x.id === 'guardian-compound'));
      await page.close();
    });
    await t.test('article reading views and uncertain collection wrappers stay untouched', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.goto('http://news-fixture.test/reading');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      assert.equal(await page.evaluate(() => new NFDetectors.GenericDetector().detect(document, location.href).length), 0);
      await page.close();
    });
    await t.test('mutation batching caches existing stories and scans inserted subtrees rather than the whole page', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.goto('http://news-fixture.test/');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/scanner.js') });
      await page.evaluate(async () => {
        let classified = 0; const roots = [];
        const preferences = { version: 1, configured: true, enabled: true, mode: 'collapse', filteredCategories: [],
          blockedKeywords: [], allowedKeywords: [], disabledDomains: [], enabledDomains: [], alwaysShowUrls: [], blockedUrls: [], debug: false };
        const platform = { storage: { read: async () => preferences, subscribe: () => () => {} },
          messaging: { listen: () => () => {}, request: async () => undefined } };
        const scanner = new NFScanner.PageScanner(platform, { classify: async () => { classified++; return { categories: [], signals: [] }; } });
        const detect = scanner.generic.detect.bind(scanner.generic);
        scanner.generic.detect = (root, url) => { roots.push(root === document ? 'DOCUMENT' : root.id || root.tagName); return detect(root, url); };
        globalThis.cacheTest = { scanner, roots, count: () => classified };
        await scanner.start();
      });
      await page.waitForFunction(() => cacheTest.count() === 8);
      await page.evaluate(() => {
        const card = document.createElement('article'); card.id = 'cache-dynamic';
        card.innerHTML = '<h2><a href="/news/cache-dynamic">Local news story added after initial loading</a></h2>';
        document.querySelector('#feed').append(card);
      });
      await page.waitForFunction(() => cacheTest.count() === 9);
      await page.evaluate(() => document.querySelector('#community').append(document.createElement('span')));
      await page.waitForFunction(() => cacheTest.roots.length >= 3);
      const stats = await page.evaluate(() => ({ count: cacheTest.count(), fullScans: cacheTest.roots.filter(x => x === 'DOCUMENT').length }));
      assert.equal(stats.count, 9); assert.equal(stats.fullScans, 1);
      await page.evaluate(() => cacheTest.scanner.stop()); await page.close();
    });
    await t.test('first-run settings select nothing and filtering starts only after explicit setup', async () => {
      settings = await harness.settings();
      await settings.locator('#save').waitFor({ state: 'visible' });
      await settings.waitForFunction(() => !document.querySelector('#save').disabled);
      assert.equal(await settings.locator('input[name=category]:checked').count(), 0);
      news = await harness.loadNews(); await visible(news, 'crime');
      assert.equal((await harness.dispatch(news, { kind: 'PAGE_STATUS' }, {})).filtered, 0);
      for (const value of ['crime', 'celebrity', 'tragedy', 'disaster']) await settings.locator(`input[value=${value}]`).check();
      await settings.locator('#save').click();
      await hidden(news, 'crime'); await hidden(news, 'celebrity');
      await visible(news, 'technology'); await visible(news, 'emergency');
    });
    await t.test('collapse explains signals and restores a story immediately', async () => {
      const replacement = news.locator('#crime + [data-news-filter-ui=card]');
      await replacement.getByText('Why was this hidden?', { exact: true }).click();
      assert.match(await replacement.locator('details').textContent(), /murder.*headline/);
      await replacement.getByRole('button', { name: 'Show story', exact: true }).click();
      await visible(news, 'crime');
      assert.equal(await news.locator('#crime + [data-news-filter-ui=card]').count(), 0);
    });
    await t.test('preferences survive refresh; show-once overrides do not', async () => {
      await harness.loadNews(news); await hidden(news, 'crime');
      const current = await harness.dispatch(harness.worker, { kind: 'GET_PREFS' }, {});
      assert.ok(current.filteredCategories.includes('crime'));
    });
    await t.test('popup reports current page counts and switches Collapse to Hide', async () => {
      const popup = await harness.popup(news);
      assert.equal(await popup.locator('#count').textContent(), '2');
      await popup.locator('#hide').check();
      await hidden(news, 'crime');
      await news.waitForFunction(() => document.querySelectorAll('[data-news-filter-ui=card]').length === 0);
      assert.equal(await news.locator('#crime').count(), 1); // card has not been removed
      await popup.close();
    });
    await t.test('Hide mode review can explain and restore completely hidden stories', async () => {
      const popup = await harness.popup(news); await popup.locator('#review').click();
      const review = news.locator('[data-news-filter-ui=review]');
      await review.getByRole('heading', { name: 'Murder investigation opens after robbery' }).waitFor();
      const row = review.locator('.row').filter({ has: news.getByRole('heading', { name: 'Murder investigation opens after robbery' }) });
      await row.getByRole('button', { name: 'Show story', exact: true }).click();
      await visible(news, 'crime'); await review.getByRole('button', { name: 'Close', exact: true }).click();
      if (!popup.isClosed()) await popup.close();
    });
    await t.test('custom hide and always-show phrases apply live and retain precedence', async () => {
      await settings.reload(); await settings.waitForFunction(() => !document.querySelector('#save').disabled);
      await settings.locator('#blockedKeywords').fill('community development\ntechnology');
      await settings.locator('#allowedKeywords').fill('Vanuatu'); await settings.locator('#save').click();
      await hidden(news, 'technology'); await visible(news, 'community');
      await settings.locator('#allowedKeywords').fill('Vanuatu\ntechnology'); await settings.locator('#save').click();
      await visible(news, 'technology');
    });
    await t.test('site pause restores everything, survives refresh and resume reapplies rules', async () => {
      let popup = await harness.popup(news); await popup.locator('#pause').click();
      await visible(news, 'crime'); await visible(news, 'celebrity'); await popup.close();
      await harness.loadNews(news); await visible(news, 'crime');
      popup = await harness.popup(news);
      await popup.getByRole('button', { name: 'Resume filtering on this site' }).click();
      await hidden(news, 'crime'); await popup.close();
    });
    await t.test('global pause and resume apply immediately', async () => {
      const popup = await harness.popup(news); await popup.locator('#enabled').uncheck();
      await visible(news, 'crime'); await popup.locator('#enabled').check(); await hidden(news, 'crime'); await popup.close();
    });
    await t.test('dynamic insertion and virtualised headline changes are filtered and corrected', async () => {
      await news.evaluate(() => {
        const card = document.createElement('article'); card.id = 'dynamic';
        card.innerHTML = '<h2><a href="/news/dynamic-murder">Murder investigation reaches another village</a></h2><p>Police investigate.</p>';
        document.querySelector('#feed').append(card);
      });
      await hidden(news, 'dynamic');
      await news.evaluate(() => {
        document.querySelector('#dynamic h2 a').textContent = 'Vanuatu community development advances locally';
        document.querySelector('#dynamic h2 a').href = '/news/new-community-project';
      });
      await visible(news, 'dynamic');
    });
    await t.test('restoration preserves the original inline display and priority; reused article bodies fail open', async () => {
      await news.evaluate(() => {
        const card = document.createElement('article'); card.id = 'original-display';
        card.style.setProperty('display', 'flex', 'important');
        card.innerHTML = '<h2><a href="/news/robbery-report">Robbery investigation develops in the capital</a></h2>';
        document.querySelector('#feed').append(card);
      });
      await hidden(news, 'original-display');
      await harness.prefs({ enabled: false }); await visible(news, 'original-display');
      assert.deepEqual(await news.locator('#original-display').evaluate(el => [el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')]), ['flex', 'important']);
      await harness.prefs({ enabled: true }); await hidden(news, 'original-display');
      await news.evaluate(() => {
        const h1 = document.createElement('h1'); h1.textContent = 'Article body now open'; document.querySelector('#original-display').prepend(h1);
      });
      await visible(news, 'original-display');
    });
    await t.test('visible-story feedback uses understandable local phrases', async () => {
      await harness.prefs({ mode: 'collapse' });
      await harness.dispatch(news, { kind: 'OPEN_REVIEW' }, {});
      const review = news.locator('[data-news-filter-ui=review]');
      await review.getByLabel('Include visible stories').check();
      const row = review.locator('.row').filter({ hasText: 'Football team wins the final match' });
      await row.getByRole('button', { name: 'Hide stories like this', exact: true }).click();
      await row.getByLabel('Word or phrase').fill('football');
      await row.getByRole('button', { name: 'Save hide phrase', exact: true }).click();
      await news.waitForFunction(() => document.querySelector('a[href="/news/football"]').closest('.story-card').style.display === 'none');
      await review.getByRole('button', { name: 'Close', exact: true }).click();
    });
    await t.test('don’t-hide feedback stores an always-show phrase and applies to later cards', async () => {
      const replacement = news.locator('#celebrity + [data-news-filter-ui=card]');
      await replacement.getByText('Why was this hidden?', { exact: true }).click();
      await replacement.getByRole('button', { name: 'Don’t hide stories like this' }).click();
      await replacement.getByLabel('Word or phrase').fill('celebrity');
      await replacement.getByRole('button', { name: 'Save phrase and show story' }).click();
      await visible(news, 'celebrity');
      await harness.loadNews(news); await visible(news, 'celebrity');
    });
    await t.test('debug mode outlines detected cards and exposes scores without changing rules', async () => {
      await harness.prefs({ debug: true });
      await news.waitForFunction(() => document.querySelector('#technology').hasAttribute('data-news-filter-detected'));
      await harness.dispatch(news, { kind: 'OPEN_REVIEW' }, {});
      const review = news.locator('[data-news-filter-ui=review]'); await review.getByLabel('Include visible stories').check();
      const row = review.locator('.row').filter({ hasText: 'New technology could prevent road deaths' });
      await row.getByText('Scores and matched signals', { exact: true }).click();
      assert.match(await row.textContent(), /Final action: allow/);
      await review.getByRole('button', { name: 'Close', exact: true }).click();
    });
    await t.test('article body stays visible after deliberate navigation', async () => {
      await harness.loadNews(news, '/reading'); await visible(news, 'reading');
      assert.equal((await harness.dispatch(news, { kind: 'PAGE_STATUS' }, {})).detected, 0);
    });
    await t.test('unrelated websites are inactive until explicitly opted into detection', async () => {
      const page = await context.newPage(); harness.id(page);
      await page.setContent('<title>Example Shop</title><article id="product"><h2><a href="https://shop.example/product/crime-game">Crime mystery board game for sale</a></h2></article>');
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      assert.equal(await page.evaluate(() => NFDetectors.eligiblePage(document, 'https://shop.example/', { enabledDomains: [] })), false);
      assert.equal(await page.evaluate(() => NFDetectors.eligiblePage(document, 'https://shop.example/', { enabledDomains: ['shop.example'] })), true);
      await page.close();
    });
    await t.test('mobile-width settings, popup and explanation controls have no horizontal overflow', async () => {
      await harness.loadNews(news);
      await context.setDefaultTimeout(5000);
      await settings.setViewportSize({ width: 360, height: 800 }); await settings.reload();
      await settings.waitForFunction(() => !document.querySelector('#save').disabled);
      assert.ok(await settings.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const popup = await harness.popup(news); await popup.setViewportSize({ width: 360, height: 640 });
      await popup.waitForFunction(() => Number(document.querySelector('#count').textContent) > 0);
      assert.ok(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok((await popup.locator('#review').boundingBox()).height >= 44);
      await mkdir(resolve(root, 'test-results'), { recursive: true });
      await settings.screenshot({ path: resolve(root, 'test-results/settings-mobile.png'), fullPage: true });
      await popup.screenshot({ path: resolve(root, 'test-results/popup-mobile.png') });
      await popup.close();
      await news.setViewportSize({ width: 360, height: 800 });
      await news.screenshot({ path: resolve(root, 'test-results/collapse-mobile.png'), fullPage: true });
    });
    await t.test('concurrent feedback writes preserve both rules and there are no runtime page errors', async () => {
      await Promise.all([
        harness.dispatch(harness.worker, { kind: 'ADD_RULE', list: 'allowedKeywords', value: 'solar power' }, {}),
        harness.dispatch(harness.worker, { kind: 'ADD_RULE', list: 'allowedKeywords', value: 'village internet' }, {}),
      ]);
      const prefs = await harness.dispatch(harness.worker, { kind: 'GET_PREFS' }, {});
      assert.ok(prefs.allowedKeywords.includes('solar power') && prefs.allowedKeywords.includes('village internet'));
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); }
});
