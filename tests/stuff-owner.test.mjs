import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { RuleBasedClassifier, evaluate, defaultPreferences } from './.generated/core.mjs';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root=resolve(import.meta.dirname,'..');
const reported=['SPONSORED: The afterparty is the main event this year','SPONSORED: The forest Dilmah is fighting to save'];
test('Stuff owner rendered cards: exact discovery, field evidence, decisions and both rendering modes', {timeout:60000}, async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext();
  await context.route('**/*',r=>/^http:\/\/(extension|news-fixture)\.test\//.test(r.request().url())?r.fallback():r.abort());
  const h=new WebExtensionHarness(context,root);await h.init();
  await context.route('http://news-fixture.test/stuff-owner',r=>r.fulfill({contentType:'text/html',path:resolve(root,'tests/fixtures/publishers/stuff-owner-rendered.html')}));
  const page=await h.loadNews(undefined,'/stuff-owner');
  await page.addScriptTag({path:resolve(root,'tests/.generated/detectors.js')});
  const stories=await page.evaluate(()=>new NFDetectors.GenericDetector().detect(document,'https://www.stuff.co.nz/life-and-style').map(c=>c.story));
  assert.equal(stories.length,4);
  const classifier=new RuleBasedClassifier();const prefs={...defaultPreferences(),configured:true,filteredCategories:['sponsored']};
  const traces=[];
  for(const story of stories){
   const classification=await classifier.classify(story);const decision=evaluate(story,classification,prefs);
   assert.equal(decision.action,reported.includes(story.headline)?'collapse':'allow',story.headline);
   traces.push({story,score:classification.categories.find(c=>c.id==='sponsored'),signals:classification.signals.filter(s=>s.category==='sponsored'),decision});
  }
  for(const mode of ['collapse','hide']){
   await h.prefs({...prefs,mode});
   for(let i=0;i<4;i++)await page.locator(`[data-owner-index="${i}"] article`).waitFor({state:i<2?'hidden':'visible'});
   await page.waitForFunction(n=>document.querySelectorAll('[data-news-filter-ui=card]').length===n,mode==='collapse'?2:0);
   assert.equal((await h.dispatch(page,{kind:'PAGE_STATUS'},{})).filtered,2);
  }
  await h.prefs({allowedKeywords:['afterparty']});await page.locator('[data-owner-index="0"] article').waitFor({state:'visible'});
  await h.prefs({allowedKeywords:[],enabled:false});await page.locator('[data-owner-index="1"] article').waitFor({state:'visible'});
  await mkdir('test-results',{recursive:true});await writeFile('test-results/stuff-owner-traces.json',JSON.stringify({provenance:'Rendered DOM read from owner open Stuff tab on 2026-10-22; offline replay with external requests blocked; updated extension not installed in that browser',traces},null,2));
 }finally{await browser.close();}
});
