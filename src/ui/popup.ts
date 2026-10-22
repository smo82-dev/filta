import type { Preferences } from '../core/types';
import { domainMatches, normaliseDomain } from '../core/text';
import { chromiumPlatform } from '../platform/chromium';
import type { PageStatus, Tab } from '../platform/contracts';
import { element, errorMessage } from './shared';
const platform = chromiumPlatform();
let tab: Tab | undefined;
let preferences: Preferences;
let page: PageStatus | undefined;
let busy = false;
const status = element('status');
const pause = element<HTMLButtonElement>('pause');
const review = element<HTMLButtonElement>('review');
const detect = element<HTMLButtonElement>('detect');
function draw() {
  if (!preferences) return;
  element('setup').hidden = preferences.configured;
  element('settings').hidden = !preferences.configured;
  const http = !!tab?.url && /^https?:/.test(tab.url);
  const site = page?.domain || (http ? normaliseDomain(new URL(tab!.url!).hostname) : 'Open a news website');
  element('site').textContent = site;
  element('site').title = site;
  const sitePaused = page ? preferences.disabledDomains.some(domain => domainMatches(page!.domain, domain)) : false;
  element('state').textContent = !preferences.configured ? 'Choose your topics to begin'
    : !http ? 'Browser pages cannot be filtered'
    : !page ? 'Refresh this page to connect the filter'
    : !preferences.enabled ? 'Filtering is off globally'
    : sitePaused ? 'Filtering is paused on this site'
    : !page.eligible ? 'Generic detection is off on this site'
    : page.detected === 0 ? 'No news stories found yet'
    : 'Filtering is on';
  element('count').textContent = page ? String(page.filtered) : '—';
  element('detected').textContent = page ? `${page.detected} stories detected` : 'On this page';
  element('indicator').dataset.active = String(!!page?.active && page.eligible && preferences.enabled && !sitePaused && preferences.configured);
  pause.disabled = busy || !page || !preferences.configured || !preferences.enabled || !page.eligible;
  review.disabled = busy || !page || page.filtered === 0;
  pause.textContent = sitePaused ? 'Resume this site' : 'Pause this site';
  detect.hidden = !page || page.eligible || !preferences.configured;
}
async function refreshPage() {
  if (tab?.id !== undefined) {
    try { page = await platform.tabs.send<PageStatus>(tab.id, { kind: 'PAGE_STATUS' }); }
    catch { page = undefined; }
  }
  draw();
}
pause.addEventListener('click', () => {
  if (!page || busy) return;
  const matching = preferences.disabledDomains.find(domain => domainMatches(page!.domain, domain));
  busy = true; draw(); status.dataset.error = 'false'; status.textContent = 'Saving…';
  void platform.messaging.request<Preferences>({ kind: 'SET_SITE', domain: matching ?? normaliseDomain(page.domain), paused: !matching })
    .then(prefs => { preferences = prefs; status.textContent = matching ? 'Filtering resumed.' : 'Website paused.'; return refreshPage(); }).catch(error => { status.dataset.error = 'true'; status.textContent = `Could not save. ${errorMessage(error)}`; }).finally(() => { busy = false; draw(); });
});
detect.addEventListener('click', () => {
  if (!page) return;
  detect.disabled = true;
  void platform.messaging.request<Preferences>({ kind: 'SET_SITE', domain: normaliseDomain(page.domain), detect: true })
    .then(prefs => { preferences = prefs; return refreshPage(); }).catch(error => { status.textContent = errorMessage(error); }).finally(() => { detect.disabled = false; });
});
review.addEventListener('click', () => {
  if (tab?.id === undefined) return;
  void platform.tabs.send(tab.id, { kind: 'OPEN_REVIEW' }).then(() => window.close())
    .catch(error => { status.textContent = errorMessage(error); });
});
for (const id of ['settings', 'setup']) element(id).addEventListener('click', () => {
  void platform.tabs.open('settings.html').catch(error => { status.textContent = errorMessage(error); });
});
void Promise.all([platform.tabs.active(), platform.messaging.request<Preferences>({ kind: 'GET_PREFS' })])
  .then(async ([active, prefs]) => {
    tab = active; preferences = prefs; await refreshPage();
    platform.storage.subscribe(prefs => { preferences = prefs; void refreshPage(); });
    // Counts refresh only while the popup is open; no background polling.
    setInterval(() => { void refreshPage(); }, 1000);
  }).catch(error => {
    element('site').textContent = 'FILTA is unavailable';
    element('state').textContent = 'Open settings or try again';
    status.dataset.error = 'true'; status.textContent = errorMessage(error);
  });
