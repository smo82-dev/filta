// Run separately with a full Chrome for Testing/Chromium build that supports extensions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const root = resolve(import.meta.dirname, '..');
test('native MV3 unpacked installation, service worker, local storage and content injection', { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(tmpdir(), 'news-filter-native-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--no-sandbox', `--disable-extensions-except=${resolve(root, 'dist')}`, `--load-extension=${resolve(root, 'dist')}`] });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const settings = await context.newPage(); await settings.goto(`chrome-extension://${id}/settings.html`);
    await settings.waitForFunction(() => !document.querySelector('#save').disabled);
    assert.equal(await settings.locator('input[name=category]:checked').count(), 0);
    await settings.locator('input[value=crime]').check(); await settings.locator('#save').click();
    const fixture = await readFile(resolve(root, 'tests/fixtures/news.html'));
    await context.route('http://news-fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const news = await context.newPage(); await news.goto('http://news-fixture.test/');
    await news.locator('#crime').waitFor({ state: 'hidden' });
    await news.locator('#crime + [data-news-filter-ui=card]').getByRole('button', { name: 'Show story', exact: true }).click();
    await news.locator('#crime').waitFor({ state: 'visible' });
    await news.reload(); await news.locator('#crime').waitFor({ state: 'hidden' });
    assert.ok((await worker.evaluate(() => chrome.storage.local.get('newsFilterPreferences'))).newsFilterPreferences.filteredCategories.includes('crime'));
  } finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
});
