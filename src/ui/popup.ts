import type { Preferences } from '../core/types';
import { domainMatches, normaliseDomain } from '../core/text';
import { chromiumPlatform } from '../platform/chromium';
import type { PageStatus, Tab } from '../platform/contracts';
import { element, errorMessage } from './shared';
const platform = chromiumPlatform();
let tab: Tab | undefined;
let preferences: Preferences;
let page: PageStatus | undefined;
const status = element('status');
const enabled = element<HTMLInputElement>('enabled');
const pause = element<HTMLButtonElement>('pause');
const review = element<HTMLButtonElement>('review');
const detect = element<HTMLButtonElement>('detect');
function draw() {
  if (!preferences) return;
  enabled.checked = preferences.enabled;
  element<HTMLInputElement>(preferences.mode).checked = true;
  element('setup').hidden = preferences.configured;
  const http = !!tab?.url && /^https?:/.test(tab.url);
  element('site').textContent = page?.domain || (http ? normaliseDomain(new URL(tab!.url!).hostname) : 'Open a news website');
  const sitePaused = page ? preferences.disabledDomains.some(domain => domainMatches(page!.domain, domain)) : false;
  element('state').textContent = !preferences.configured ? 'Choose your topics to begin'
    : !http ? 'Browser pages cannot be filtered'
    : !page ? 'Refresh this page to connect the filter'
    : !preferences.enabled ? 'Filtering is off globally'
    : sitePaused ? 'Filtering is paused on this site'
    : !page.eligible ? 'Generic detection is off on this site'
    : `Filtering this site: ON · ${page.detected} cards detected`;
  element('count').textContent = String(page?.filtered ?? 0);
  pause.disabled = !page || !preferences.configured;
  review.disabled = !page;
  pause.textContent = sitePaused ? 'Resume filtering on this site' : 'Pause on this site';
  detect.hidden = !page || page.eligible || !preferences.configured;
}
async function refreshPage() {
  if (tab?.id !== undefined) {
    try { page = await platform.tabs.send<PageStatus>(tab.id, { kind: 'PAGE_STATUS' }); }
    catch { page = undefined; }
  }
  draw();
}
async function patch(patch: Partial<Preferences>) {
  try { preferences = await platform.messaging.request<Preferences>({ kind: 'PATCH_PREFS', patch }); await refreshPage(); }
  catch (error) { status.textContent = errorMessage(error); draw(); }
}
enabled.addEventListener('change', () => { void patch({ enabled: enabled.checked }); });
for (const mode of ['collapse', 'hide'] as const) element<HTMLInputElement>(mode).addEventListener('change', () => { void patch({ mode }); });
pause.addEventListener('click', () => {
  if (!page) return;
  const matching = preferences.disabledDomains.find(domain => domainMatches(page!.domain, domain));
  void platform.messaging.request<Preferences>({ kind: 'SET_SITE', domain: matching ?? normaliseDomain(page.domain), paused: !matching })
    .then(prefs => { preferences = prefs; return refreshPage(); }).catch(error => { status.textContent = errorMessage(error); });
});
detect.addEventListener('click', () => {
  if (!page) return;
  void platform.messaging.request<Preferences>({ kind: 'SET_SITE', domain: normaliseDomain(page.domain), detect: true })
    .then(prefs => { preferences = prefs; return refreshPage(); }).catch(error => { status.textContent = errorMessage(error); });
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
  }).catch(error => { status.textContent = errorMessage(error); });
