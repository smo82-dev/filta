import { CATEGORIES } from '../core/rules/categories';
import type { Preferences, PreferencePatch } from '../core/types';
import { chromiumPlatform } from '../platform/chromium';
import { element, errorMessage, lines } from './shared';
const platform = chromiumPlatform();
let initial: Preferences;
const form = element<HTMLFormElement>('preferences');
const status = element('status');
const save = element<HTMLButtonElement>('save');
function populate(preferences: Preferences) {
  initial = preferences;
  element<HTMLInputElement>('enabled').checked = preferences.enabled;
  element<HTMLInputElement>('debug').checked = preferences.debug;
  element<HTMLInputElement>(preferences.mode).checked = true;
  const categories = element('categories'); categories.replaceChildren();
  for (const category of CATEGORIES) {
    const label = document.createElement('label'); label.className = 'choice';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = category.id;
    input.name = 'category'; input.checked = preferences.filteredCategories.includes(category.id);
    label.append(input, document.createTextNode(category.name)); categories.append(label);
  }
  for (const key of ['blockedKeywords', 'allowedKeywords', 'disabledDomains', 'enabledDomains', 'alwaysShowUrls', 'blockedUrls'] as const) {
    element<HTMLTextAreaElement>(key).value = preferences[key].join('\n');
  }
  element('intro').textContent = preferences.configured
    ? 'Choose the stories you see less of. Every decision stays on this device.'
    : 'Choose what you’d like to filter from news websites. No topics are selected for you.';
  save.textContent = preferences.configured ? 'Save preferences' : 'Start filtering';
}
function values(): PreferencePatch {
  const mode = element<HTMLInputElement>('hide').checked ? 'hide' : 'collapse';
  return { configured: true, enabled: element<HTMLInputElement>('enabled').checked, mode,
    filteredCategories: [...form.querySelectorAll<HTMLInputElement>('input[name="category"]:checked')].map(input => input.value as Preferences['filteredCategories'][number]),
    blockedKeywords: lines(element<HTMLTextAreaElement>('blockedKeywords').value),
    allowedKeywords: lines(element<HTMLTextAreaElement>('allowedKeywords').value),
    disabledDomains: lines(element<HTMLTextAreaElement>('disabledDomains').value),
    enabledDomains: lines(element<HTMLTextAreaElement>('enabledDomains').value),
    alwaysShowUrls: lines(element<HTMLTextAreaElement>('alwaysShowUrls').value),
    blockedUrls: lines(element<HTMLTextAreaElement>('blockedUrls').value),
    debug: element<HTMLInputElement>('debug').checked };
}
form.addEventListener('submit', event => {
  event.preventDefault(); save.disabled = true; status.textContent = 'Saving…';
  const changes: PreferencePatch = {};
  // Save only edited fields; preserve other tabs' feedback in untouched lists.
  for (const [key, value] of Object.entries(values())) {
    if (JSON.stringify(value) !== JSON.stringify(initial[key as keyof Preferences])) Object.assign(changes, { [key]: value });
  }
  void platform.messaging.request<Preferences>({ kind: 'PATCH_PREFS', patch: changes }).then(preferences => {
    populate(preferences); status.textContent = 'Saved. Open a news homepage; already open pages update automatically.';
  }).catch(error => { status.textContent = errorMessage(error); }).finally(() => { save.disabled = false; });
});
void platform.messaging.request<Preferences>({ kind: 'GET_PREFS' }).then(preferences => {
  populate(preferences); save.disabled = false;
}).catch(error => { status.textContent = errorMessage(error); });
