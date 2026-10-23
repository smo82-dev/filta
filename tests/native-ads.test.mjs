import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] };
// Controlled structures modelled on live observation (MSN en-nz, 22 Oct 2026: native-ad tiles are
// cs-responsive-card hosts with id="nativead-…", a bing.com/api/v2/mediation/tracking link and a
// separate "Sponsored" link) and on the common Taboola/Outbrain in-page widget pattern.
const html = `<title>Example News</title>
<script>
customElements.define('feed-card', class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = '<div class="content-card"><div class="text"><span class="attribution-text">' + (this.dataset.brand || 'Wire') + '</span>' +
      '<a class="heading" href="' + this.dataset.href + '">' + this.dataset.title + '</a>' + (this.dataset.ad ? '<a data-native-label class="native-label" href="' + this.dataset.href + '">Sponsored</a>' : '') + '</div></div>';
  }
});
</script>
<main>
<div class="river">
  <feed-card id="msn-ad" ad data-ad="1" data-brand="MyIQ" data-href="https://www.bing.com/api/v2/mediation/tracking?adUnit=1&amp;rlink=x" data-title="Take this 2-minute science-based personality test"></feed-card>
  <feed-card id="msn-story" data-href="/en-nz/news/national/council-approves-cycleway" data-title="Council approves new harbourside cycleway plan"></feed-card>
</div>
<div id="taboola-below-feed" class="trc_rbox_container">
  <div class="videoCube"><a href="https://shoes.example/offer?utm_source=taboola&amp;utm_medium=referral"><span class="video-title">Doctors stunned by this soft-soled shoe for knee pain</span></a><span class="branding">Comfort Shoes</span></div>
  <div class="videoCube"><a href="https://travel.example/deal?utm_source=taboola"><span class="video-title">These overwater villas are cheaper than you think</span></a><span class="branding">Travel Deals</span></div>
</div>
<article id="paid-utm"><h3><a href="https://brand.example/story?utm_medium=paid&amp;utm_campaign=x">Five reasons homeowners are switching to heat pumps</a></h3></article>
<article id="external-editorial"><h3><a href="https://www.rnz.co.nz/news/national/123/ferry-sailings-resume">Ferry sailings resume after weekend storm</a></h3></article>
<article id="about-taboola"><h3><a href="/business/markets/taboola-shares-rise">Taboola shares rise after strong quarterly earnings</a></h3></article>
<div class="trc-main"><article id="trc-layout"><h3><a href="/india-news/monsoon-session-begins">Parliament monsoon session begins with heated debate</a></h3></article></div>
<div class="ntv-news ob"><article id="ntv-layout"><h3><a href="/kenya/county-budget-approved">County assembly approves new budget for roads</a></h3></article></div>
<article id="promoted-captain"><h3><a href="/sport/league/promoted-to-captain">Young forward promoted to captain for weekend clash</a></h3></article>
</main>`;

test('native ads: ad-network links, ad widgets and lone disclosures count as sponsored; editorial stays, including publisher layouts named trc-main or ntv (NDTV, 23 Oct 2026)', { timeout: 90000 }, async t => {
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext(); const h = new WebExtensionHarness(context, root); await h.init();
    await context.route('http://news-fixture.test/native', r => r.fulfill({ contentType: 'text/html', body: html }));
    await h.prefs({ configured: true, enabled: true, filteredCategories: ['sponsored'], mode: 'hide' });
    const news = await h.loadNews(undefined, '/native');
    await t.test('MSN-style native ad host, Taboola tiles and paid-tracking card are hidden', async () => {
      await news.locator('#msn-ad').waitFor({ state: 'hidden', timeout: 4000 });
      await news.locator('#paid-utm').waitFor({ state: 'hidden', timeout: 4000 });
      await news.locator('.videoCube').first().waitFor({ state: 'hidden', timeout: 4000 });
      assert.equal(await news.locator('.videoCube:visible').count(), 0);
    });
    await t.test('editorial cards, including links to other publishers and stories about ad companies, stay', async () => {
      for (const id of ['#msn-story', '#external-editorial', '#about-taboola', '#promoted-captain', '#trc-layout', '#ntv-layout']) await news.locator(id).waitFor({ state: 'visible' });
      const status = await h.dispatch(news, { kind: 'PAGE_STATUS' }, {});
      assert.equal(status.filtered, 4);
    });
    await t.test('nothing is filtered when Sponsored is not selected', async () => {
      await h.prefs({ filteredCategories: ['business'] });
      await news.locator('#msn-ad').waitFor({ state: 'visible' });
      await news.locator('.videoCube').first().waitFor({ state: 'visible' });
    });
  } finally { await browser.close(); }
});
