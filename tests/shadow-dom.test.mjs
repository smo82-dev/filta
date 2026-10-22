import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { WebExtensionHarness } from './helpers/webextension-harness.mjs';
const root = resolve(import.meta.dirname, '..');
const launch = { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] };
// Controlled structure modelled on web-component feeds (e.g. MSN): every card is a custom
// element whose open shadow root holds the headline link, nested inside a layout component's
// shadow root. Light-DOM querySelectorAll sees none of these links.
const html = `<title>Feed</title>
<script>
customElements.define('feed-card', class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = '<div class="content-card"><div class="text"><span class="attribution">Wire</span>' +
      '<a class="heading" href="' + this.dataset.href + '">' + this.dataset.title + '</a></div><button class="card-actions">More</button></div>';
  }
});
customElements.define('feed-layout', class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = '<div class="grid">' +
      '<feed-card id="crime-card" data-href="/news/national/man-charged" data-title="Man charged after stabbing at Auckland mall"></feed-card>' +
      '<feed-card id="food-card" data-href="/lifestyle/food/dinner-recipes" data-title="10 easy dinner recipes for busy weeknights"></feed-card>' +
      '<feed-card id="sport-card" data-href="/sport/league/warriors-hooker" data-title="Warriors lock down star hooker for another three seasons"></feed-card>' +
      '</div>';
  }
});
customElements.define('responsive-header', class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = '<div class="bar"><a id="header-link" class="heading" href="/news/live/police-manhunt">Police arrest murder suspect after manhunt</a></div>';
  }
});
</script>
<responsive-header></responsive-header>
<main><feed-layout id="feed"></feed-layout></main>`;

test('open shadow DOM feeds: discovery, complete-host filtering, late cards, protection and restore', { timeout: 90000 }, async t => {
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext(); const h = new WebExtensionHarness(context, root); await h.init();
    await context.route('http://news-fixture.test/components', r => r.fulfill({ contentType: 'text/html', body: html }));
    await h.prefs({ configured: true, enabled: true, filteredCategories: ['crime'], mode: 'collapse' });
    const news = await h.loadNews(undefined, '/components');
    await t.test('the card host, not its inner wrapper, is hidden so the grid closes up', async () => {
      await news.locator('#crime-card').waitFor({ state: 'hidden', timeout: 4000 });
      assert.equal(await news.locator('#crime-card').evaluate(el => el.style.getPropertyValue('display')), 'none');
      await news.locator('[data-news-filter-ui=card]').first().waitFor();
    });
    await t.test('unrelated cards and header components stay visible', async () => {
      for (const id of ['#food-card', '#sport-card', '#header-link']) await news.locator(id).waitFor({ state: 'visible' });
      const status = await h.dispatch(news, { kind: 'PAGE_STATUS' }, {});
      assert.equal(status.detected, 3); assert.equal(status.filtered, 1);
    });
    await t.test('a card added later inside the shadow feed is found and filtered', async () => {
      await news.evaluate(() => {
        const card = document.createElement('feed-card'); card.id = 'late-card';
        card.dataset.href = '/news/crime/teen-stabbed'; card.dataset.title = 'Teen stabbed outside Christchurch bar, police hunt attacker';
        document.querySelector('#feed').shadowRoot.querySelector('.grid').append(card);
      });
      await news.locator('#late-card').waitFor({ state: 'hidden', timeout: 4000 });
      assert.equal((await h.dispatch(news, { kind: 'PAGE_STATUS' }, {})).filtered, 2);
    });
    await t.test('Show story restores the complete host', async () => {
      await news.locator('[data-news-filter-ui=card]').first().getByRole('button', { name: 'Show story' }).click();
      await news.locator('#crime-card').waitFor({ state: 'visible' });
      assert.equal((await h.dispatch(news, { kind: 'PAGE_STATUS' }, {})).filtered, 1);
    });
    await t.test('pausing restores every shadow card', async () => {
      await h.prefs({ enabled: false });
      await news.locator('#late-card').waitFor({ state: 'visible' });
      assert.equal(await news.locator('[data-news-filter-ui=card]').count(), 0);
    });
  } finally { await browser.close(); }
});

test('publisher markup makes unlisted news sites eligible; shops stay ineligible', { timeout: 60000 }, async () => {
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage();
    const check = async (head, url) => {
      await page.setContent(`<html><head>${head}</head><body></body></html>`);
      await page.addScriptTag({ path: resolve(root, 'tests/.generated/detectors.js') });
      return page.evaluate(url => NFDetectors.eligiblePage(document, url, { enabledDomains: [] }), url);
    };
    assert.equal(await check('<title>Politics, Policy, Analysis</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsMediaOrganization","name":"Example"}</script>', 'https://www.example-politics.test/'), true);
    assert.equal(await check('<title>The Regional</title><meta name="news_keywords" content="council, roads">', 'https://www.the-regional.test/'), true);
    assert.equal(await check('<title>Front page</title><script type="application/ld+json">{"@type":["NewsArticle"],"headline":"x"}</script>', 'https://www.front-page.test/'), true);
    assert.equal(await check('<title>Shoes and boots</title><script type="application/ld+json">{"@type":"Product","name":"Boot"}</script>', 'https://www.boot-shop.test/'), false);
    assert.equal(await check('<title>Recipes</title>', 'https://www.recipes.test/'), false);
  } finally { await browser.close(); }
});
