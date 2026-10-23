// Real publisher DOM, production scanner/renderer, in-memory platform adapter.
// Not a native-extension or semantic-accuracy claim; no signed-in profiles.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve(process.argv[2] ?? 'test-results/publishers');
const sources = JSON.parse(await readFile(resolve(directory, 'fetch-results.json'), 'utf8'));
const names = process.argv.slice(3);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const results = [];
async function run(source) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  await context.route('**/*', route => ['image','media','font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
  const page = await context.newPage();
  const deadline = setTimeout(() => { void context.close().catch(() => undefined); }, 45000);
  const result = { publisher: source.publisher, slug: source.slug, url: source.url, checkedAt: new Date().toISOString() };
  const failedRequests = []; page.on('requestfailed', request => { if (failedRequests.length < 15) failedRequests.push({ url: request.url().split('?')[0], error: request.failure()?.errorText }); });
  try {
    const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    result.status = response?.status(); result.finalUrl = page.url();
    if (response && response.status() >= 400) result.error = `Access response ${response.status()}; stopped`;
    else {
      // A shell or access response is never recorded as a compatibility pass.
      await page.waitForFunction(() => [...document.querySelectorAll('h2,h3,h4,a[href]')].some(el => (el.textContent ?? '').trim().length > 35 && !el.closest('nav,header,footer')), { timeout: 15000 }).catch(() => undefined);
      await page.addScriptTag({ path: resolve('tests/.generated/detectors.js') });
      const snapshot = await page.evaluate(() => {
        const cards = NFDetectors.deduplicate([...(NFDetectors.SITE_ADAPTERS.find(a => a.matches(location.hostname))?.detect(document, location.href) ?? []), ...new NFDetectors.GenericDetector().detect(document, location.href)]);
        return { title: document.title, headings: document.querySelectorAll('h2,h3,h4').length, detected: cards.length, cards: cards.map(card => ({ story: card.story, html: card.handle.outerHTML })) };
      });
      result.title = snapshot.title; result.initialDetected = snapshot.detected; result.headings = snapshot.headings;
      await writeFile(resolve(directory, `${source.slug}-validated-cards.json`), JSON.stringify(snapshot.cards, null, 2));
      await writeFile(resolve(directory, `${source.slug}-validated.html`), await page.content());
      if (snapshot.detected) {
        await page.addScriptTag({ path: resolve('tests/.generated/scanner.js') });
        await page.evaluate(async () => {
          let prefs = { version: 1, configured: true, enabled: true, mode: 'collapse', filteredCategories: [], blockedKeywords: [], allowedKeywords: [], disabledDomains: [], enabledDomains: [], alwaysShowUrls: [], blockedUrls: [], debug: false };
          let update;
          const scanner = new NFScanner.PageScanner({ storage: { read: async () => prefs, subscribe: callback => { update = callback; return () => {}; } }, messaging: { request: async () => undefined, listen: () => () => {} } });
          globalThis.filtaValidation = { scanner, set: patch => { prefs = { ...prefs, ...patch }; update(prefs); } }; await scanner.start();
        });
        await page.waitForFunction(() => filtaValidation.scanner.status().detected > 0, { timeout: 10000 });
        result.byCategory = await page.evaluate(() => {
          const counts = {};
          for (const category of ['celebrity','crime','tragedy','sexual','war','disaster','politics','sport','entertainment','opinion','business','technology','science','sponsored']) { filtaValidation.set({ filteredCategories: [category] }); counts[category] = filtaValidation.scanner.status().filtered; }
          filtaValidation.set({ mode: 'hide', filteredCategories: Object.keys(counts) });
          return counts;
        });
        result.hide = await page.evaluate(() => filtaValidation.scanner.status());
        result.renderMismatches = await page.evaluate(() => [...filtaValidation.scanner.records.values()].filter(record => record.decision.action !== 'allow' && getComputedStyle(record.element).display !== 'none').length);
        await page.evaluate(() => filtaValidation.set({ mode: 'collapse' }));
        result.collapse = await page.evaluate(() => filtaValidation.scanner.status());
        await page.mouse.wheel(0, 2200); await page.waitForTimeout(1200);
        result.afterScroll = await page.evaluate(() => filtaValidation.scanner.status());
        await page.evaluate(() => filtaValidation.set({ enabled: false }));
        result.pause = await page.evaluate(() => filtaValidation.scanner.status());
        await page.evaluate(() => filtaValidation.scanner.stop());
      }
      await page.screenshot({ path: resolve(directory, `${source.slug}-validated.png`) });
    }
  } catch (error) { result.error = error.message; }
  result.failedRequests = failedRequests;
  results.push(result);
  await writeFile(resolve(directory, 'pipeline-bounded-results.json'), JSON.stringify(results, null, 2));
  console.log(`${source.publisher}: ${result.initialDetected ?? '-'} found; ${result.hide?.filtered ?? '-'} hidden; ${result.error ?? ''}`);
  clearTimeout(deadline);
  await context.close().catch(() => undefined);
}
const queue = sources.filter(source => !names.length || names.includes(source.slug));
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await run(queue.shift()); }));
await browser.close();
