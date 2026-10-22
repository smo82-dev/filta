import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { CATEGORIES } from './.generated/core.mjs';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] };
// Controlled structural regressions; these are NOT captures of the owner's live Stuff DOM.
const reported = ['SPONSORED: The afterparty is the main event this year', 'SPONSORED: The forest Dilmah is fighting to save'];
const card = (id, content, attrs = '') => `<article id="${id}" ${attrs}>${content}</article>`;
const heading = (id, text) => `<h3><a href="/reports/${id}">${text}</a></h3>`;
const html = `<title>Cross-publisher News</title><main id="feed">
${reported.map((text, i) => card(`owner-${i}`, heading(`owner-${i}`, text))).join('')}
<div class="promotional-story-grid">${card('promo', '<span class="badge">Partner content</span>' + heading('promo', 'A local forest project welcomes new visitors'))}</div>
${card('taxonomy', '<a class="kicker" href="/life-and-style">Life and Style</a>' + heading('taxonomy', 'An update from a local community garden') + '<span class="badge">Sponsored</span>')}
${card('secondary', heading('secondary', 'A fresh local report for the community') + '<aside data-related><h4><a href="/other/story">Another related story about the election</a></h4></aside><span class="badge">Paid Content</span>')}
${card('attribute', heading('attribute', 'A community project attracts new visitors'), 'data-label="Sponsored"')}
${card('summary', heading('summary', 'New findings arrive from a community project') + '<p class="byline">By a local correspondent</p><p class="summary">Researchers discovered new findings in an experiment.</p>')}
${card('late', heading('late', 'A community event welcomes more local people') + '<span class="badge" data-label="Local"></span>')}
${card('negative', heading('negative', 'Council sponsored a community garden last year') + '<span hidden data-label="Sponsored"></span>', 'data-sponsored="false" data-partner="false"')}
<nav id="navigation">${card('nav-card', heading('nav-card', 'SPONSORED: A link inside the navigation'))}</nav>
<div id="reading" class="article-body"><h2><a href="/reports/body">SPONSORED: A sentence in the reading view</a></h2></div>
<div class="advertisement" id="ad"><a href="/reports/ad">SPONSORED: Advertising outside editorial cards</a></div>
</main>`;

test('systemic pipeline: disclosures, ownership, metadata, delayed updates and safe rendering', { timeout: 90000 }, async t => {
 const browser = await chromium.launch(launch);
 try {
  const context = await browser.newContext(); const h = new WebExtensionHarness(context, root); await h.init();
  await context.route('http://news-fixture.test/pipeline', r => r.fulfill({contentType:'text/html',body:html}));
  const news = await h.loadNews(undefined, '/pipeline');
  await news.addScriptTag({path:resolve(root,'tests/.generated/detectors.js')});
  const found = await news.evaluate(() => new NFDetectors.GenericDetector().detect(document, location.href).map(c => ({id:c.handle.id,story:c.story})));
  await t.test('reported headlines and ordinary publisher structures survive discovery and extract only owned fields', async () => {
   assert.deepEqual(found.map(c=>c.id).sort(), ['owner-0','owner-1','promo','taxonomy','secondary','attribute','summary','late','negative'].sort());
   assert.equal(found.find(c=>c.id==='summary').story.description, 'Researchers discovered new findings in an experiment.');
   assert.deepEqual(found.find(c=>c.id==='attribute').story.labels, ['Sponsored']);
  });
  for (const mode of ['collapse','hide']) await t.test(`actual ${mode} decisions preserve protected content and precedence`, async () => {
   await h.prefs({configured:true,filteredCategories:['sponsored','science'],mode});
   for (const id of ['owner-0','owner-1','promo','taxonomy','secondary','attribute','summary']) await news.locator(`#${id}`).waitFor({state:'hidden',timeout:3000});
   for (const id of ['negative','navigation','reading','ad','late']) await news.locator(`#${id}`).waitFor({state:'visible'});
   assert.equal((await h.dispatch(news,{kind:'PAGE_STATUS'},{})).filtered,7);
   assert.equal(await news.locator('[data-news-filter-ui=card]').count(),mode==='collapse'?7:0);
   await h.prefs({allowedKeywords:['afterparty']}); await news.locator('#owner-0').waitFor({state:'visible'});
   await h.prefs({allowedKeywords:[],disabledDomains:['news-fixture.test']}); await news.locator('#owner-1').waitFor({state:'visible'});
   await h.prefs({disabledDomains:[]});
  });
  await t.test('late attribute-only metadata, recycled cards and loss of story boundaries are re-evaluated', async () => {
   await news.locator('#late .badge').evaluate(e=>e.setAttribute('data-label','Paid Content'));
   await news.locator('#late').waitFor({state:'hidden',timeout:3000});
   await news.locator('#late .badge').evaluate(e=>e.setAttribute('data-label','Local'));
   await news.locator('#late').waitFor({state:'visible'});
   await news.locator('#owner-1 h3').evaluate(e=>e.textContent='A community garden opens to local residents');
   await news.locator('#owner-1').waitFor({state:'visible'});
   await news.locator('#attribute').evaluate(e=>e.setAttribute('role','navigation'));
   await news.locator('#attribute').waitFor({state:'visible',timeout:3000});
  });
  await mkdir('test-results',{recursive:true}); await writeFile('test-results/pipeline-traces.json',JSON.stringify({provenance:'Controlled DOM regressions, not live Stuff evidence',cards:found},null,2));
 } finally {await browser.close();}
});

test('14 topics across five publisher layout families: extraction through rendering with unrelated cards visible', {timeout:90000}, async () => {
 const browser = await chromium.launch(launch);
 try {
  const context = await browser.newContext(); const h = new WebExtensionHarness(context,root); await h.init();
  // BBC-style linked heading; RNZ-style kicker; Guardian-style overlay; list card; attribute-labelled teaser.
  const layouts = [
   (id,topic) => `<article id="${id}"><a href="/reports/${id}"><h2>Community report number ${id} is available today</h2></a><span class="badge">${topic}</span></article>`,
   (id,topic) => `<div class="story-card" id="${id}"><a class="kicker" href="/topics/local">${topic}</a>${heading(id,'A new community update arrives for local readers')}</div>`,
   (id,topic) => `<div class="card" id="${id}"><h3>Local people discuss a recent community update</h3><a href="/reports/${id}" aria-label="Read this story"></a><span data-topic="${topic}"></span></div>`,
   (id,topic) => `<ul><li id="${id}" data-section="${topic}">${heading(id,'A report from the community arrives this morning')}</li></ul>`,
   (id,topic) => `<div class="teaser" id="${id}" data-label="${topic}">${heading(id,'A fresh report provides an update for the community')}</div>`,
  ];
  const cards = CATEGORIES.flatMap(c=>layouts.map((layout,i)=>({id:`${c.id}-${i}`,html:layout(`${c.id}-${i}`,c.sections[0])})));
  await context.route('http://news-fixture.test/matrix',r=>r.fulfill({contentType:'text/html',body:`<title>Publisher layout News</title><main>${cards.map(c=>c.html).join('')}${card('unrelated',heading('unrelated','Local residents open a new community garden'))}</main>`}));
  const p=await h.loadNews(undefined,'/matrix');
  for(const mode of ['collapse','hide']) {
   await h.prefs({configured:true,filteredCategories:CATEGORIES.map(c=>c.id),mode});
   await p.waitForFunction(expected=>document.querySelectorAll('main [id]').length===expected,cards.length+1);
   for(const c of cards) await p.locator(`#${c.id}`).waitFor({state:'hidden',timeout:3000});
   await p.locator('#unrelated').waitFor({state:'visible'});
   assert.equal((await h.dispatch(p,{kind:'PAGE_STATUS'},{})).filtered,70);
   await h.prefs({filteredCategories:['sport']});
   for(const c of cards) await p.locator(`#${c.id}`).waitFor({state:c.id.startsWith('sport-')?'hidden':'visible'});
  }
 }finally{await browser.close();}
});
