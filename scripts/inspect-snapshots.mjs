// Developer-only, offline inspection. Saved responses are not live-browser evidence.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve(process.argv[2] ?? 'test-results/publishers');
const results = JSON.parse(await readFile(resolve(directory, 'fetch-results.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const context = await browser.newContext({ javaScriptEnabled: true });
await context.route('**/*', route => route.abort());
for (const result of results) {
  if (result.error) continue;
  const page = await context.newPage();
  const html = await readFile(resolve(directory, `${result.slug}.html`), 'utf8');
  await page.setContent(html.replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, ''), { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: resolve('tests/.generated/detectors.js') });
  const details = await page.evaluate(url => {
    const start = performance.now();
    const adapter = NFDetectors.SITE_ADAPTERS.find(adapter => adapter.matches(new URL(url).hostname));
    const cards = NFDetectors.deduplicate([...(adapter?.detect(document, url) ?? []), ...new NFDetectors.GenericDetector().detect(document, url)]);
    return { title: document.title, headings: document.querySelectorAll('h2,h3,h4').length, anchors: document.querySelectorAll('a[href]').length,
      detected: cards.length, scanMs: Math.round(performance.now() - start),
      samples: cards.slice(0, 12).map(card => ({ headline: card.story.headline, section: card.story.section, url: card.story.url, tag: card.handle.tagName, class: card.handle.className })),
      cards: cards.map(card => ({ story: card.story, html: card.handle.outerHTML })) };
  }, result.finalUrl);
  const cards = details.cards; delete details.cards;
  Object.assign(result, details);
  await writeFile(resolve(directory, `${result.slug}-cards.json`), JSON.stringify(cards, null, 2));
  console.log(`${result.publisher}: ${result.detected} cards / ${result.headings} headings / ${result.scanMs} ms`);
  await page.close();
}
await writeFile(resolve(directory, 'inspection-results.json'), JSON.stringify(results, null, 2));
await browser.close();
