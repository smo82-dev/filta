import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
