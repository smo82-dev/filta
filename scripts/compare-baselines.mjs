// Baseline bundles are generated in test-results from read-only main/checkpoint worktrees.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage();
const results = {};
for (const name of ['main','checkpoint','current']) {
  await page.setContent(await readFile('tests/fixtures/universal.html','utf8'));
  await page.addScriptTag({ path: resolve(name === 'current' ? 'tests/.generated/detectors.js' : `test-results/${name}-detectors.js`) });
  results[name] = await page.evaluate(name => {
    const bundle = name === 'current' ? NFDetectors : BaselineDetectors;
    const cards = new bundle.GenericDetector().detect(document, 'http://news-fixture.test/');
    const expected = [...document.querySelectorAll('[data-expected]')];
    return { expected: expected.length, discovered: cards.length, correct: cards.filter(card => expected.includes(card.handle)).length };
  }, name);
}
await writeFile('test-results/discovery-baseline.json', JSON.stringify(results,null,2)); console.log(results); await browser.close();
