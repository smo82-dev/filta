// Read-only HTTP snapshot investigation. Saved HTML replay is not a live browser session.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RuleBasedClassifier, defaultPreferences, evaluate } from '../tests/.generated/core.mjs';
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
const classifier = new RuleBasedClassifier();
const prefs = {...defaultPreferences(),configured:true,filteredCategories:['entertainment','celebrity']};
const report = [];
for (const [name,url,path] of [['bbc','https://www.bbc.com/culture/film-tv',process.argv[2] ?? '/tmp/filta-bbc.html'],['stuff','https://www.stuff.co.nz/',process.argv[3] ?? '/tmp/filta-stuff.html']]) {
 const page = await browser.newPage();
 await page.route('**/*',route=>route.abort());
 await page.setContent(await readFile(path,'utf8'));
 await page.addScriptTag({path:resolve('tests/.generated/detectors.js')});
 const cards = await page.evaluate(url => NFDetectors.deduplicate([...NFDetectors.SITE_ADAPTERS.filter(a=>a.matches(new URL(url).hostname)).flatMap(a=>a.detect(document,url)),...new NFDetectors.GenericDetector().detect(document,url)]).map(c=>({story:c.story,html:c.handle.outerHTML})),url);
 const examples=[];
 for (const card of cards.filter(c=>/Rivals producer|Apu returns|Selena Gomez says|BBC closures/.test(c.story.headline))) {
  const result=await classifier.classify(card.story);examples.push({...card,result,decision:evaluate(card.story,result,prefs)});
 }
 report.push({name,url,method:'Current HTTP response rendered locally; external resources blocked',detected:cards.length,examples,text:(await page.locator('body').innerText()).slice(0,400)});
 if(name==='bbc') {
  await mkdir('tests/fixtures/publishers',{recursive:true});
  await writeFile('tests/fixtures/publishers/bbc-owner-examples.html','<!doctype html><html lang="en"><title>BBC Film & TV cards — HTTP source 21 October 2026</title><main>'+examples.map((c,i)=>`<div id="owner-${i}">${c.html}</div>`).join('\n')+'</main></html>');
 }
 await page.close();
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/current-publishers.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(r=>({...r,examples:r.examples.map(c=>({headline:c.story.headline,description:c.story.description,section:c.story.section,categories:c.result.categories.filter(x=>x.score>0),action:c.decision.action}))})),null,2));await browser.close();
