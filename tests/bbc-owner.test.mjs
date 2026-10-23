import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { RuleBasedClassifier, evaluate, defaultPreferences, CATEGORIES } from './.generated/core.mjs';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
test('BBC owner examples: real captured markup through discovery, extraction, classification and rendering', async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
 const context=await browser.newContext(); const harness=new WebExtensionHarness(context,root);await harness.init();
 await context.route('http://news-fixture.test/bbc-owner',route=>route.fulfill({contentType:'text/html',path:resolve(root,'tests/fixtures/publishers/bbc-owner-examples.html')}));
 const news=await harness.loadNews(undefined,'/bbc-owner');
 await news.addScriptTag({path:resolve(root,'tests/.generated/detectors.js')});
 const cards=await news.evaluate(()=>new NFDetectors.GenericDetector().detect(document,'https://www.bbc.com/culture/film-tv').map(c=>c.story));
 assert.equal(cards.length,4);
 const classifier=new RuleBasedClassifier();
 for (const story of cards) {
  const result=await classifier.classify(story);
  const prefs={...defaultPreferences(),configured:true,filteredCategories:['entertainment','celebrity']};
  const business=story.headline.includes('BBC closures');
  assert.equal(evaluate(story,result,prefs).action,business?'allow':'collapse',story.headline);
  assert.ok(story.description); assert.equal(story.section,undefined,'No page-wide Film & TV label inherited');
  assert.equal(evaluate(story,result,{...prefs,allowedKeywords:[story.headline]}).action,'allow');
  assert.equal(evaluate(story,result,{...prefs,disabledDomains:['bbc.com']}).action,'allow');
 }
 for (const mode of ['collapse','hide']) {
  await harness.prefs({configured:true,filteredCategories:['entertainment','celebrity'],mode});
  for (let i=1;i<4;i++) await news.locator(`#owner-${i} a`).waitFor({state:'hidden'});
  await news.locator('#owner-0 a').waitFor({state:'visible'});
  await news.waitForFunction(expected=>document.querySelectorAll('[data-news-filter-ui=card]').length===expected,mode==='collapse'?3:0);
  assert.equal((await harness.dispatch(news,{kind:'PAGE_STATUS'},{})).filtered,3);
 }
 await harness.prefs({allowedKeywords:['Selena Gomez']}); await news.locator('#owner-3 a').waitFor({state:'visible'});
 // Recycled cards must shed old decisions after their headline/summary change.
 await news.locator('#owner-1 h2').evaluate(el=>el.textContent='Community garden opens for local residents');
 await news.locator('#owner-1 p[data-testid=card-description]').evaluate(el=>el.textContent='Neighbours share vegetables and seedlings.');
 await news.locator('#owner-1 a').waitFor({state:'visible'});
 } finally {await browser.close();}
});
test('context combinations use exact-card headline and summary across categories without phrase-boundary fabrication',async()=>{
 const classifier=new RuleBasedClassifier();
 for(const category of CATEGORIES.filter(c=>c.combinations?.length)){
  const combo=category.combinations[0];
  const story={headline:`A report on ${combo.terms[0].split('|')[0]} arrives today`,description:`The report discusses ${combo.terms.slice(1).map(t=>t.split('|')[0]).join(' and ')}.`,sourceDomain:'news.test'};
  const result=await classifier.classify(story);
  assert.ok(result.signals.some(s=>s.category===category.id&&s.kind==='combination'&&s.field==='description'),category.id);
 }
 const result=await classifier.classify({headline:'This report describes a prime',description:'minister in a local play',sourceDomain:'news.test'});
 assert.equal(result.categories.find(c=>c.id==='politics').score<4,true);
});
