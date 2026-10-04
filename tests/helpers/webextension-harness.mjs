// Browser API simulator for production JS. The DOM, observer, UI, adapter and
// background code are real; this does not prove native extension installation.
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
export class WebExtensionHarness {
  constructor(context, root) {
    this.context = context; this.root = root; this.store = {};
    this.pages = new Map(); this.activeId = undefined; this.worker = undefined;
    this.badges = new Map(); this.externalRequests = [];
  }
  async init() {
    await this.context.route('http://extension.test/**', async route => {
      const path = new URL(route.request().url()).pathname.slice(1) || 'settings.html';
      if (path.includes('..')) return route.abort();
      if (path === 'worker.html') return route.fulfill({ contentType: 'text/html', body: '<title>API harness background host</title>' });
      const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' }[extname(path)] ?? 'text/plain';
      await route.fulfill({ contentType, body: await readFile(resolve(this.root, 'dist', path)) });
    });
    await this.context.route('http://news-fixture.test/**', async route => {
      const file = new URL(route.request().url()).pathname.includes('reading') ? 'reading.html' : 'news.html';
      await route.fulfill({ contentType: 'text/html', body: await readFile(resolve(this.root, 'tests/fixtures', file)) });
    });
    await this.context.exposeBinding('nfNative', async ({ page }, request) => {
      const id = this.id(page);
      switch (request.op) {
        case 'get': return request.key in this.store ? { [request.key]: this.store[request.key] } : {};
        case 'set': {
          const changes = {};
          for (const [key, newValue] of Object.entries(request.values)) {
            changes[key] = { oldValue: this.store[key], newValue }; this.store[key] = newValue;
          }
          await Promise.all([...this.pages.values()].filter(p => !p.isClosed()).map(p =>
            p.evaluate(changes => globalThis.__nfEvents.storage.forEach(fn => fn(changes, 'local')), changes).catch(() => undefined)));
          return;
        }
        case 'message': return this.dispatch(this.worker, request.message, { tab: { id, url: page.url() } });
        case 'tabMessage': return this.dispatch(this.pages.get(request.id), request.message, {});
        case 'active': {
          const active = this.pages.get(this.activeId);
          return active ? [{ id: this.activeId, url: active.url() }] : [];
        }
        case 'create': {
          const p = await this.context.newPage(); this.id(p); await p.goto(request.url);
          return { id: this.id(p), url: p.url() };
        }
        case 'badge': this.badges.set(request.tabId, request.text); return;
        case 'badgeColor': return;
        case 'permission': return true;
        default: throw new Error(`Unknown mock API ${request.op}`);
      }
    });
    await this.context.addInitScript(() => {
      const events = { runtime: [], storage: [], installed: [] };
      const event = list => ({ addListener: fn => list.push(fn), removeListener: fn => { const index = list.indexOf(fn); if (index >= 0) list.splice(index, 1); } });
      globalThis.__nfEvents = events;
      globalThis.__nfDispatch = (message, sender) => new Promise((resolve, reject) => {
        let listening = false;
        for (const listener of events.runtime) {
          const result = listener(message, sender, resolve);
          if (result === true) listening = true;
        }
        if (!listening) reject(new Error('Could not establish connection. Receiving end does not exist.'));
      });
      const native = request => globalThis.nfNative(request);
      globalThis.chrome = {
        storage: { local: { get: key => native({ op: 'get', key }), set: values => native({ op: 'set', values }) }, onChanged: event(events.storage) },
        runtime: { sendMessage: message => native({ op: 'message', message }), getURL: path => `http://extension.test/${path}`,
          onMessage: event(events.runtime), onInstalled: event(events.installed) },
        tabs: { query: () => native({ op: 'active' }), sendMessage: (id, message) => native({ op: 'tabMessage', id, message }),
          create: ({ url }) => native({ op: 'create', url }) },
        permissions: { contains: () => native({ op: 'permission' }) },
        action: { setBadgeText: options => native({ op: 'badge', ...options }), setBadgeBackgroundColor: () => native({ op: 'badgeColor' }) },
      };
    });
    this.worker = await this.context.newPage(); this.id(this.worker);
    await this.worker.goto('http://extension.test/worker.html');
    await this.worker.addScriptTag({ path: resolve(this.root, 'dist/background.js') });
  }
  id(page) {
    for (const [id, value] of this.pages) if (value === page) return id;
    const id = this.pages.size + 1; this.pages.set(id, page); return id;
  }
  async dispatch(page, message, sender) {
    if (!page || page.isClosed()) throw new Error('Receiving end does not exist');
    return page.evaluate(({ message, sender }) => globalThis.__nfDispatch(message, sender), { message, sender });
  }
  async prefs(patch) { return this.dispatch(this.worker, { kind: 'PATCH_PREFS', patch }, {}); }
  async settings() {
    const page = await this.context.newPage(); this.id(page);
    await page.goto('http://extension.test/settings.html'); return page;
  }
  async loadNews(page, path = '/') {
    if (!page) { page = await this.context.newPage(); this.id(page); }
    this.activeId = this.id(page);
    await page.goto(`http://news-fixture.test${path}`);
    await page.addScriptTag({ path: resolve(this.root, 'dist/content.js') });
    await page.waitForFunction(() => globalThis.__nfEvents.runtime.length > 0);
    return page;
  }
  async popup(news) {
    this.activeId = this.id(news);
    const popup = await this.context.newPage(); this.id(popup);
    await popup.goto('http://extension.test/popup.html');
    await popup.waitForFunction(() => document.querySelector('#site')?.textContent === 'news-fixture.test');
    return popup;
  }
}
