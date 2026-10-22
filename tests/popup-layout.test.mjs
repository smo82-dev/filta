import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root=resolve(import.meta.dirname,'..');
const shots=resolve(root,'docs/validation-0.2.0/popup-dev2');
const launch={headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']};
async function metrics(p){return p.evaluate(()=>{
 const d=document.documentElement,b=document.body;
 return {width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,viewport:{width:innerWidth,height:innerHeight},overflowX:d.scrollWidth>innerWidth,overflowY:d.scrollHeight>innerHeight,
 buttons:[...document.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>{const r=document.createRange();r.selectNodeContents(b);return {id:b.id,lines:r.getClientRects().length,height:b.getBoundingClientRect().height};}),
 site:{height:document.querySelector('#site').getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(document.querySelector('#site')).lineHeight)}};
});}
async function axe(p){const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(a.violations.map(v=>v.id),[]);}
test('compact toolbar: all states, no normal scroll/wrap, keyboard, narrow and doubled text', {timeout:90000}, async t=>{
 const browser=await chromium.launch(launch);const context=await browser.newContext({viewport:{width:360,height:520}});
 try{
  const h=new WebExtensionHarness(context,root);await h.init();await mkdir(shots,{recursive:true});
  await h.prefs({configured:true,enabled:true});const news=await h.loadNews();
  let state={domain:'www.stuff.co.nz',detected:72,filtered:29,active:true,eligible:true,configured:true};
  const dispatch=h.dispatch.bind(h);h.dispatch=async(p,msg,sender)=>msg.kind==='PAGE_STATUS'?state:dispatch(p,msg,sender);
  const p=await context.newPage();h.id(p);h.activeId=h.id(news);
  const results=[];
  async function open(){await p.goto('http://extension.test/popup.html');await p.waitForFunction(()=>document.querySelector('#site').textContent!=='Connecting…');}
  async function check(name){const m=await metrics(p);results.push({name,...m});assert.equal(m.overflowX,false,name);assert.equal(m.overflowY,false,name);assert.ok(m.height<=460,`${name}: ${m.height}`);assert.ok(m.site.height<=m.site.lineHeight+1,name);for(const b of m.buttons){assert.equal(b.lines,1,`${name} ${b.id}`);assert.ok(b.height>=44,`${name} ${b.id}`);}await axe(p);await p.screenshot({path:resolve(shots,`${name}.png`),clip:{x:0,y:0,width:360,height:Math.ceil(m.height)}});}
  await t.test('active example with 29 filtered / 72 detected stays compact',async()=>{await open();assert.equal(await p.locator('#count').innerText(),'29');assert.equal(await p.locator('#detected').innerText(),'72 stories detected');await check('active');});
  await t.test('paused, no-cards, globally off, detection disabled and first-run states',async()=>{
   await h.prefs({disabledDomains:['stuff.co.nz']});await open();assert.equal(await p.locator('#pause').innerText(),'Resume this site');await check('paused');
   await h.prefs({disabledDomains:[]});state={...state,detected:0,filtered:0};await open();assert.ok(await p.locator('#review').isDisabled());await check('no-cards');
   await h.prefs({enabled:false});await open();assert.ok(await p.locator('#pause').isDisabled());await check('global-off');
   await h.prefs({enabled:true});state={...state,eligible:false,active:false};await open();assert.ok(await p.locator('#detect').isVisible());assert.equal(await p.locator('#indicator').getAttribute('data-active'),'false');await check('detection-disabled');
   await h.prefs({configured:false});await open();assert.ok(await p.locator('#setup').isVisible());await check('first-run');await h.prefs({configured:true});
  });
  await t.test('unsupported pages, connection failures and save errors remain usable',async()=>{
   await news.goto('about:blank');state=undefined;await open();await check('unsupported');
   await news.goto('http://news-fixture.test/');await open();assert.match(await p.locator('#state').innerText(),/Refresh/);await check('disconnected');
   state={domain:'www.stuff.co.nz',detected:72,filtered:29,active:true,eligible:true,configured:true};await open();
   h.dispatch=async(page,msg,sender)=>{if(msg.kind==='SET_SITE')throw Error('Storage unavailable. Try again.');return msg.kind==='PAGE_STATUS'?state:dispatch(page,msg,sender);};
   await p.locator('#pause').click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Could not save'));assert.equal(await p.locator('#pause').isDisabled(),false);await check('save-error');
   h.dispatch=async(page,msg,sender)=>{if(msg.kind==='GET_PREFS')throw Error('Storage unavailable. Try again.');return msg.kind==='PAGE_STATUS'?state:dispatch(page,msg,sender);};
   await open();assert.match(await p.locator('#site').innerText(),/unavailable/);await check('load-error');
   h.dispatch=async(page,msg,sender)=>msg.kind==='PAGE_STATUS'?state:dispatch(page,msg,sender);
  });
  await t.test('long hostname truncates visually while retaining full accessible text; keyboard follows actions',async()=>{
   state={...state,domain:'a-very-long-publisher-subdomain.with-a-long-name.example.com'};await open();assert.equal(await p.locator('#site').getAttribute('title'),state.domain);assert.equal(await p.locator('#site').innerText(),state.domain);await check('long-hostname');
   await p.locator('#pause').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'review');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'settings');
  });
  await t.test('280px width and 200% text reflow preserve readable actions without horizontal clipping',async()=>{
   await p.setViewportSize({width:280,height:600});await p.emulateMedia({reducedMotion:'reduce'});await open();let m=await metrics(p);assert.equal(m.overflowX,false);assert.equal(m.overflowY,false);await axe(p);
   await p.addStyleTag({content:':root{font-size:200%}'});m=await metrics(p);assert.equal(m.overflowX,false);assert.ok(m.buttons.every(b=>b.height>=44));await axe(p);results.push({name:'narrow-200-percent',...m});
   await p.screenshot({path:resolve(shots,'narrow-200-percent.png'),fullPage:true});
   await p.setViewportSize({width:360,height:600});m=await metrics(p);assert.equal(m.overflowX,false);results.push({name:'desktop-200-percent',...m});
   await p.screenshot({path:resolve(shots,'desktop-200-percent.png'),fullPage:true});
  });
  await writeFile(resolve(root,'test-results/popup-layout.json'),JSON.stringify(results,null,2));
 }finally{await browser.close();}
});
