import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root=resolve(import.meta.dirname,'..');
const shots=resolve(root,'docs/validation-0.2.0/ui');
const launch={headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']};
async function axe(page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);}
async function capture(page,name){await page.screenshot({path:resolve(shots,`${name}.png`),fullPage:true});}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#controls').disabled);}
test('guided setup, preference preservation, real popup interactions and accessibility', {timeout:120000}, async t=>{
 const browser=await chromium.launch(launch); const context=await browser.newContext({viewport:{width:1050,height:900}});
 const harness=new WebExtensionHarness(context,root);await harness.init();await mkdir(shots,{recursive:true});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 let settings,news;
 try{
 await t.test('first run has no preselected categories; all 14 are accessible and setup is a draft until completed',async()=>{
  settings=await harness.settings();await ready(settings);
  assert.equal(await settings.locator('input[name=category]').count(),14);assert.equal(await settings.locator('input[name=category]:checked').count(),0);
  assert.equal(await settings.locator('#hub-header').isVisible(),false);await axe(settings);await capture(settings,'onboarding-1-topics');
  await settings.getByLabel('Entertainment',{exact:false}).check();await settings.getByLabel('Celebrity & Gossip',{exact:false}).check();
  await settings.locator('#next').click();assert.equal(await settings.locator('#step-label').textContent(),'Step 2 of 3');
  assert.equal((await harness.dispatch(harness.worker,{kind:'GET_PREFS'},{})).configured,false);
  await settings.locator('#hide').check();await settings.locator('#phrases summary').click();
  await settings.locator('#allowedKeywords').fill('Vanuatu');await axe(settings);await capture(settings,'onboarding-2-style');
  await settings.locator('#next').click();assert.match(await settings.locator('#summary').innerText(),/Entertainment/);await axe(settings);await capture(settings,'onboarding-3-ready');
  await settings.locator('#back').click();assert.equal(await settings.locator('#hide').isChecked(),true);await settings.locator('#next').click();
  await settings.locator('#save').click();await settings.locator('#hub-header').waitFor();await ready(settings);
  // The completion message is a bold toast in the top-right corner that clears itself after 7 seconds.
  const toast=settings.locator('#status');await settings.waitForFunction(()=>document.querySelector('#status').textContent.includes('You’re ready'));
  const style=await toast.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {position:s.position,weight:Number(s.fontWeight),right:innerWidth-r.right,top:r.top};});
  assert.equal(style.position,'fixed');assert.ok(style.weight>=700);assert.ok(style.right<40&&style.top<40,JSON.stringify(style));
  await settings.waitForTimeout(6000);assert.match(await toast.textContent(),/You’re ready/);
  await settings.waitForFunction(()=>document.querySelector('#status').textContent==='',null,{timeout:3000});assert.equal(await toast.isVisible(),false);
  const p=await harness.dispatch(harness.worker,{kind:'GET_PREFS'},{});assert.equal(p.configured,true);assert.deepEqual(p.filteredCategories,['celebrity','entertainment']);assert.deepEqual(p.allowedKeywords,['Vanuatu']);assert.equal(p.mode,'hide');
 });
 await t.test('returning user skips onboarding; repeat setup and cancellation preserve preferences',async()=>{
  await settings.reload();await ready(settings);assert.equal(await settings.locator('#wizard-header').isVisible(),false);await capture(settings,'settings-my-topics');
  await settings.locator('#restart').click();assert.equal(await settings.locator('input[name=category]:checked').count(),2);
  await settings.locator('input[value=crime]').check();await settings.locator('#cancel').click();assert.equal(await settings.locator('input[value=crime]').isChecked(),false);
  await settings.locator('[data-section=websites]').click();await axe(settings);await capture(settings,'settings-websites');
  await settings.locator('#disabledDomains').fill('example.com');await settings.locator('#save').click();await ready(settings);
  await settings.locator('[data-section=advanced]').click();await settings.locator('#alwaysShowUrls').fill('https://example.com/news/keep');await settings.locator('#debug').check();await settings.locator('#save').click();await ready(settings);await axe(settings);
  await settings.locator('#restart').click();await settings.locator('#next').click();await settings.locator('#next').click();await settings.locator('#save').click();await ready(settings);
  const p=await harness.dispatch(harness.worker,{kind:'GET_PREFS'},{});assert.deepEqual(p.disabledDomains,['example.com']);assert.deepEqual(p.alwaysShowUrls,['https://example.com/news/keep']);assert.equal(p.debug,true);assert.equal(p.mode,'hide');
 });
 await t.test('unsaved untouched lists never overwrite feedback from another tab',async()=>{
  await settings.locator('[data-section=topics]').click();
  await harness.prefs({blockedUrls:['https://news.test/feedback']});
  await settings.locator('input[value=science]').check();await settings.locator('#save').click();await ready(settings);
  assert.deepEqual((await harness.dispatch(harness.worker,{kind:'GET_PREFS'},{})).blockedUrls,['https://news.test/feedback']);
 });
 await t.test('failed writes stay on the ready step, leave completion false and provide retry',async()=>{
  const c=await browser.newContext();const h=new WebExtensionHarness(c,root);await h.init();const p=await h.settings();await ready(p);await p.locator('#next').click();await p.locator('#next').click();
  const dispatch=h.dispatch.bind(h);h.dispatch=async(page,msg,sender)=>{if(msg.kind==='PATCH_PREFS')throw Error('Storage unavailable');return dispatch(page,msg,sender);};
  await p.locator('#save').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.error==='true');
  assert.equal(await p.locator('#ready').isVisible(),true);assert.equal((await dispatch(h.worker,{kind:'GET_PREFS'},{})).configured,false);
  h.dispatch=dispatch;await p.locator('#save').click();await p.locator('#hub-header').waitFor();await c.close();
 });
 await t.test('existing version-1 users retain all settings and see the hub immediately',async()=>{
  const c=await browser.newContext();const h=new WebExtensionHarness(c,root);await h.init();
  const original=await h.prefs({configured:true,filteredCategories:['sport','science'],enabled:false,mode:'hide',blockedKeywords:['football'],allowedKeywords:['Vanuatu'],disabledDomains:['news.test'],enabledDomains:['local.test'],alwaysShowUrls:['https://a.test/keep'],blockedUrls:['https://a.test/hide'],debug:true});
  const p=await h.settings();await ready(p);assert.equal(await p.locator('#hub-header').isVisible(),true);assert.equal(await p.locator('input[value=sport]').isChecked(),true);
  await p.locator('#save').click();await ready(p);assert.deepEqual(await h.dispatch(h.worker,{kind:'GET_PREFS'},{}),original);await c.close();
 });
 await t.test('popup counts, site pause/resume, review, manage, unsupported and global-off states',async()=>{
  await harness.prefs({configured:true,enabled:true,filteredCategories:['crime'],allowedKeywords:[],mode:'collapse'});news=await harness.loadNews();await news.locator('#crime').waitFor({state:'hidden'});
  const p=await harness.popup(news);await p.setViewportSize({width:360,height:650});assert.equal(await p.locator('#count').innerText(),'1');await axe(p);await capture(p,'popup-active');
  await p.locator('#pause').click();await news.locator('#crime').waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('#pause').textContent==='Resume this site');await capture(p,'popup-paused');
  await p.locator('#pause').click();await news.locator('#crime').waitFor({state:'hidden'});
  await p.locator('#review').click();await news.locator('[data-news-filter-ui=review]').waitFor();
  const p2=await harness.popup(news);const opened=context.waitForEvent('page');await p2.locator('#settings').click();const managed=await opened;await managed.waitForURL('**/settings.html');assert.match(managed.url(),/settings.html/);await ready(managed);assert.equal(await managed.locator('#hub-header').isVisible(),true);
  await harness.prefs({enabled:false});await p2.waitForFunction(()=>document.querySelector('#state').textContent.includes('off globally'));assert.equal(await p2.locator('#pause').isDisabled(),true);
  await news.goto('about:blank');await p2.reload();await p2.waitForFunction(()=>document.querySelector('#state').textContent.includes('Browser pages'));await axe(p2);await capture(p2,'popup-unsupported');await p2.close();
 });
 await t.test('keyboard order, reduced motion, narrow layout and 200% text sizing',async()=>{
  await settings.reload();await ready(settings);await settings.emulateMedia({reducedMotion:'reduce'});
  await settings.locator('#restart').click();await settings.locator('input[value=celebrity]').focus();await settings.keyboard.press('Space');await settings.keyboard.press('Tab');
  assert.equal(await settings.evaluate(()=>document.activeElement.value),'crime');
  await settings.setViewportSize({width:360,height:800});await settings.addStyleTag({content:':root{font-size:32px}'});
  assert.equal(await settings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await axe(settings);await capture(settings,'onboarding-narrow-200-percent');
 });
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
