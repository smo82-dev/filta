// Extract a small representative sample from already captured publisher responses.
// Review the selection before committing; this does not establish site-wide recall.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve(process.argv[2] ?? 'test-results/publishers');
const sources = JSON.parse(await readFile(resolve(directory, 'inspection-results.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.route('**/*', route => route.abort());
const manifest = [];
await mkdir('tests/fixtures/publishers', { recursive: true });
for (const source of sources) {
  let recordsPath = `${source.slug}-cards.json`;
  if (!source.detected) {
    recordsPath = `${source.slug}-validated-cards.json`;
    try { if (!JSON.parse(await readFile(resolve(directory, recordsPath), 'utf8')).length) continue; } catch { continue; }
  }
  const records = JSON.parse(await readFile(resolve(directory, recordsPath), 'utf8')).filter(record => record.story.headline.split(/\s+/).length >= 5 && !/<[a-z][^>]*>/i.test(record.story.headline));
  if (records.length < 3) continue;
  const selected = [records[0], records[Math.floor(records.length / 3)], records[Math.floor(records.length * 2 / 3)]];
  const fixtures = [];
  for (const [index, record] of selected.entries()) {
    await page.setContent(record.html);
    const value = await page.evaluate(index => {
      document.querySelectorAll('script,style,noscript,iframe').forEach(el => el.remove());
      const root = document.body.firstElementChild; if (!root) return null;
      // Prefer a real article boundary over an accidentally captured section wrapper.
      const card = root;
      for (const element of [card, ...card.querySelectorAll('*')]) for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name) || ['srcset','data-props','props','data-uri','data-page','data-breakpoints'].includes(attribute.name) || attribute.value.length > 1500) element.removeAttribute(attribute.name);
      }
      card.id = `sample-${index}`; return card.outerHTML;
    }, index);
    if (value) fixtures.push({ html: value, expectedUrl: record.story.url, sample: record.story.headline });
  }
  const file = `${source.slug}.html`;
  await writeFile(`tests/fixtures/publishers/${file}`, `<!doctype html><html><head><meta charset="utf-8"><title>${source.publisher} saved news snippets</title></head><body><main>${fixtures.map(f => `<div class="fixture-snippet">${f.html}</div>`).join('\n')}</main></body></html>`.replace(/[ \t]+$/gm, ''));
  manifest.push({ publisher: source.publisher, region: source.region, url: source.finalUrl, requestedUrl: source.url, capturedAt: source.attemptedAt, kind: 'saved-response-snippets', scaffolding: 'Neutral repeated wrappers preserve isolated-card context; full original page layout is not reproduced', file, expectedUrls: fixtures.map(f => f.expectedUrl), samples: fixtures.map(f => f.sample) });
  console.log(`${source.publisher}: ${fixtures.map(f => f.sample.slice(0, 80)).join(' | ')}`);
}
await writeFile('tests/fixtures/publishers/manifest.json', JSON.stringify(manifest, null, 2));
await browser.close();
