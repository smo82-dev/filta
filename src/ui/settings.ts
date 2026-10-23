import { CATEGORIES } from '../core/rules/categories';
import type { Preferences, PreferencePatch } from '../core/types';
import { chromiumPlatform } from '../platform/chromium';
import { element, errorMessage, lines } from './shared';
const platform = chromiumPlatform();
let initial: Preferences;
let wizard = false, step = 0, section = 'topics', saving = false;
const form = element<HTMLFormElement>('preferences');
const controls = element<HTMLFieldSetElement>('controls');
const status = element('status');
const save = element<HTMLButtonElement>('save');
const descriptions: Record<string, string> = {
  celebrity: 'Famous faces & royal news', crime: 'Crime reports & court cases', tragedy: 'Loss & fatal incidents',
  sexual: 'Explicit & adult stories', war: 'Armed conflict & military action', disaster: 'Major natural disasters',
  politics: 'Government & elections', sport: 'Matches, teams & results', entertainment: 'Film, TV & music',
  opinion: 'Columns & commentary', business: 'Markets, money & companies', technology: 'Digital life & new tech',
  science: 'Research & discoveries', sponsored: 'Promotions & paid stories',
};
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
    const text = document.createElement('span'), name = document.createElement('strong'), description = document.createElement('span');
    name.id = `topic-${category.id}`; description.id = `description-${category.id}`;
    input.setAttribute('aria-labelledby', name.id); input.setAttribute('aria-describedby', description.id);
    name.textContent = category.name; description.className = 'description'; description.textContent = descriptions[category.id] ?? category.name;
    text.append(name, description); label.append(input, text); categories.append(label);
  }
  for (const key of ['blockedKeywords', 'allowedKeywords', 'disabledDomains', 'enabledDomains', 'alwaysShowUrls', 'blockedUrls'] as const) {
    element<HTMLTextAreaElement>(key).value = preferences[key].join('\n');
  }
}
function values(): PreferencePatch {
  return { configured: true, enabled: element<HTMLInputElement>('enabled').checked,
    mode: element<HTMLInputElement>('hide').checked ? 'hide' : 'collapse',
    filteredCategories: [...form.querySelectorAll<HTMLInputElement>('input[name="category"]:checked')].map(input => input.value as Preferences['filteredCategories'][number]),
    blockedKeywords: lines(element<HTMLTextAreaElement>('blockedKeywords').value),
    allowedKeywords: lines(element<HTMLTextAreaElement>('allowedKeywords').value),
    disabledDomains: lines(element<HTMLTextAreaElement>('disabledDomains').value),
    enabledDomains: lines(element<HTMLTextAreaElement>('enabledDomains').value),
    alwaysShowUrls: lines(element<HTMLTextAreaElement>('alwaysShowUrls').value),
    blockedUrls: lines(element<HTMLTextAreaElement>('blockedUrls').value),
    debug: element<HTMLInputElement>('debug').checked };
}
function summary() {
  const v = values(), list = element('summary'); list.replaceChildren();
  const topics = CATEGORIES.filter(c => v.filteredCategories?.includes(c.id)).map(c => c.name);
  for (const [key, value] of ([
    ['Your topics', topics.join(', ') || 'No topics selected'],
    ['Your style', v.mode === 'hide' ? 'Hide matching stories completely' : 'Collapse, with an option to show again'],
    ['Your phrases', `${v.blockedKeywords!.length} hide · ${v.allowedKeywords!.length} always show`],
    ['Filtering', v.enabled ? 'Enabled' : 'Paused globally — enable in Website Controls when ready'],
  ] as [string, string][])) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; list.append(dt, dd); }
}
function draw(focus = false) {
  element('wizard-header').hidden = !wizard; element('hub-header').hidden = wizard; element('restart').hidden = wizard;
  const visible = wizard ? step === 0 ? ['topics'] : step === 1 ? ['behaviour', 'exceptions'] : ['ready'] : [section];
  for (const id of ['topics', 'behaviour', 'exceptions', 'websites', 'advanced', 'ready']) element(id).hidden = !visible.includes(id);
  element('step-label').textContent = `Step ${step + 1} of 3`;
  document.querySelectorAll('.steps li').forEach((li, i) => { if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  document.querySelectorAll<HTMLButtonElement>('#hub-nav button').forEach(button => {
    if (button.dataset.section === section) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    button.disabled = saving;
  });
  element<HTMLButtonElement>('restart').disabled = saving;
  element('back').hidden = !wizard || step === 0; element('cancel').hidden = !wizard || !initial.configured;
  element('next').hidden = !wizard || step === 2; save.hidden = wizard && step !== 2;
  save.textContent = wizard ? 'Start filtering' : 'Save changes'; save.disabled = saving;
  controls.disabled = saving;
  if (wizard && step === 2) summary();
  if (focus) element(visible[0]!).querySelector<HTMLElement>('h2')?.focus();
}
// Save confirmations appear briefly in the top-right corner; errors stay until the next action.
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function announce(message: string, error = false) {
  clearTimeout(toastTimer); status.dataset.fading = 'false'; status.dataset.error = String(error); status.textContent = message;
  if (!error && message !== 'Saving…') toastTimer = setTimeout(() => {
    status.dataset.fading = 'true'; toastTimer = setTimeout(() => { status.textContent = ''; status.dataset.fading = 'false'; }, 400);
  }, 7000);
}
element('next').addEventListener('click', () => { if (!saving && step < 2) { step++; draw(true); } });
element('back').addEventListener('click', () => { if (!saving && step > 0) { step--; draw(true); } });
element('restart').addEventListener('click', () => { wizard = true; step = 0; announce(''); draw(true); });
element('cancel').addEventListener('click', () => { populate(initial); wizard = false; draw(true); });
document.querySelectorAll<HTMLButtonElement>('#hub-nav button').forEach(button => button.addEventListener('click', () => {
  section = button.dataset.section!; draw(true);
}));
form.addEventListener('submit', event => {
  event.preventDefault();
  if (saving || !initial || (wizard && step !== 2)) return;
  const changes: PreferencePatch = {};
  // Patch edited fields only: don't overwrite feedback from another tab.
  for (const [key, value] of Object.entries(values())) {
    if (JSON.stringify(value) !== JSON.stringify(initial[key as keyof Preferences])) Object.assign(changes, { [key]: value });
  }
  saving = true; draw(); announce('Saving…');
  void platform.messaging.request<Preferences>({ kind: 'PATCH_PREFS', patch: changes }).then(preferences => {
    const completed = wizard;
    populate(preferences); wizard = false;
    announce(completed ? 'You’re ready. Open a news website to start filtering.' : 'Saved. Your open news pages update automatically.');
    saving = false; draw(completed);
  }).catch(error => {
    saving = false; draw(); announce(`Could not save. ${errorMessage(error)}`, true); save.focus();
  });
});
void platform.messaging.request<Preferences>({ kind: 'GET_PREFS' }).then(preferences => {
  populate(preferences); wizard = !preferences.configured; element('loading').hidden = true; element('workspace').hidden = false; draw();
}).catch(error => { element('loading').textContent = `Could not load your preferences. ${errorMessage(error)} Reload this page to try again.`; });
