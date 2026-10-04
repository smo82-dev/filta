import type { ClassificationResult, Decision, Story } from '../core/types';
export interface StoryRecord {
  element: HTMLElement; story: Story; detector: string; fingerprint: string;
  classification: ClassificationResult; decision: Decision;
  override?: 'show' | 'hide';
}
export interface Feedback {
  show(record: StoryRecord): void;
  hide(record: StoryRecord): void;
  addKeyword(kind: 'allowedKeywords' | 'blockedKeywords', value: string): Promise<void>;
}
const UI_STYLE = `
:host{all:initial;display:block;font:14px/1.45 system-ui,sans-serif;color:#15392f;color-scheme:light}
*{box-sizing:border-box}button,input{font:inherit}button{min-height:44px;padding:8px 12px;border:1px solid #aec5bd;border-radius:8px;background:white;color:#15392f;cursor:pointer;text-align:left}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #287bdb;outline-offset:2px}
.box{background:#f2f7f4;border:1px solid #bfd3c8;border-radius:9px;padding:10px 12px;margin:4px 0;overflow-wrap:anywhere}
.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.label{font-weight:650;margin:0}p{margin:6px 0}details{margin-top:8px}summary{cursor:pointer;min-height:44px;padding:10px 0}
.actions details{flex:1;min-width:155px;margin:0}.actions details summary{border:1px solid #aec5bd;border-radius:8px;background:white;padding:10px;font-size:13px;line-height:22px}.actions details[open]{flex-basis:100%}
ul{padding-left:22px;margin:5px 0}input{width:100%;min-height:44px;border:1px solid #aec5bd;border-radius:6px;padding:8px;margin:8px 0}small{color:#466157}a{color:#146453}
.drawer{position:fixed;inset:12px 12px 12px auto;width:min(440px,calc(100vw - 24px));background:#fff;box-shadow:0 10px 50px #0005;border:1px solid #a8bfb5;border-radius:14px;overflow:auto;padding:16px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.top h2{margin:0;font-size:21px}.row{border-bottom:1px solid #d9e4de;padding:12px 0}.row h3{font-size:16px;margin:0 0 6px}label{display:flex;gap:9px;align-items:center;min-height:44px}label input{width:20px;min-height:20px;margin:0} .error{color:#a32929}
`;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (text !== undefined) value.textContent = text;
  return value;
}
function button(label: string, action: () => void): HTMLButtonElement {
  const value = node('button', label);
  value.type = 'button'; value.addEventListener('click', action);
  return value;
}
export function explanation(record: StoryRecord, debug = false): HTMLDetailsElement {
  const details = node('details');
  details.append(node('summary', debug ? 'Scores and matched signals' : 'Why was this hidden?'));
  details.append(node('p', record.decision.reason));
  for (const category of debug ? record.classification.categories.filter(value => value.score > 0) : record.decision.categories) {
    details.append(node('p', `${category.name}: score ${category.score} (threshold ${category.threshold})`));
  }
  const list = node('ul');
  for (const signal of debug ? record.classification.signals : record.decision.signals) {
    list.append(node('li', `“${signal.term}” in ${signal.field}${signal.kind === 'context' ? ' — contextual exception, lowers score' : ''} (${signal.contribution > 0 ? '+' : ''}${signal.contribution})`));
  }
  if (list.children.length) details.append(list);
  if (debug) details.append(node('small', `Detector: ${record.detector}. Final action: ${record.decision.action}.`));
  return details;
}
function keywordEditor(record: StoryRecord, kind: 'allowedKeywords' | 'blockedKeywords', feedback: Feedback): HTMLElement {
  const editor = node('div');
  editor.append(node('p', kind === 'allowedKeywords'
    ? 'Add a phrase to Always show. Any story containing it will stay visible.'
    : 'Add a phrase to Hide words/topics. Any matching story will be filtered, unless an always-show rule matches.'));
  const label = node('label', 'Word or phrase');
  const input = node('input');
  input.maxLength = 120; input.placeholder = 'For example: community development';
  input.setAttribute('aria-label', 'Word or phrase');
  label.append(input); editor.append(label);
  const status = node('p'); status.setAttribute('role', 'status');
  const save = button(kind === 'allowedKeywords' ? 'Save phrase and show story' : 'Save hide phrase', () => {
    const value = input.value.trim();
    if (!value) { status.textContent = 'Enter a word or phrase first.'; input.focus(); return; }
    save.disabled = true;
    void feedback.addKeyword(kind, value).then(() => {
      if (kind === 'allowedKeywords') feedback.show(record);
      editor.remove();
    }).catch(error => { status.textContent = String(error); save.disabled = false; });
  });
  editor.append(save, status); queueMicrotask(() => input.focus());
  return editor;
}
export class CardRenderer {
  private readonly originals = new Map<HTMLElement, { display: string; priority: string; host?: HTMLElement }>();
  constructor(private readonly feedback: Feedback) {}
  restore(element: HTMLElement) {
    const original = this.originals.get(element);
    if (!original) return;
    original.host?.remove();
    if (original.display) element.style.setProperty('display', original.display, original.priority);
    else element.style.removeProperty('display');
    this.originals.delete(element);
  }
  apply(record: StoryRecord, debug: boolean) {
    this.restore(record.element);
    record.element.toggleAttribute('data-news-filter-detected', debug);
    if (record.decision.action === 'allow') return;
    this.originals.set(record.element, { display: record.element.style.getPropertyValue('display'), priority: record.element.style.getPropertyPriority('display') });
    record.element.style.setProperty('display', 'none', 'important');
    if (record.decision.action === 'hide') return;
    const host = node('div'); host.setAttribute('data-news-filter-ui', 'card');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = node('style', UI_STYLE);
    const box = node('div'); box.className = 'box';
    const category = record.decision.categories.map(value => value.name).join(', ');
    box.append(node('p', `Story hidden: ${category || record.decision.reason}`));
    const actions = node('div'); actions.className = 'actions';
    const why = explanation(record);
    why.append(button('Don’t hide stories like this', () => {
      if (!box.querySelector('input')) box.append(keywordEditor(record, 'allowedKeywords', this.feedback));
    }));
    actions.append(button('Show story', () => this.feedback.show(record)), why);
    box.append(actions); shadow.append(style, box);
    record.element.after(host);
    this.originals.get(record.element)!.host = host;
  }
  clear() {
    for (const element of [...this.originals.keys()]) this.restore(element);
  }
}
export class StoryReview {
  private host?: HTMLElement;
  private includeVisible = false;
  constructor(private readonly getRecords: () => StoryRecord[], private readonly feedback: Feedback,
    private readonly debug: () => boolean) {}
  isOpen() { return !!this.host; }
  close() { this.host?.remove(); this.host = undefined; }
  open() {
    this.close();
    const host = node('div'); host.setAttribute('data-news-filter-ui', 'review');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    this.host = host;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(node('style', UI_STYLE));
    const drawer = node('section'); drawer.className = 'drawer'; drawer.style.pointerEvents = 'auto';
    drawer.setAttribute('aria-label', 'News Filter story review');
    drawer.tabIndex = -1;
    const top = node('div'); top.className = 'top';
    top.append(node('h2', 'Stories on this page'), button('Close', () => this.close()));
    drawer.append(top, node('p', 'Restore hidden stories, or add a phrase to your local rules.'));
    const label = node('label'); const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = this.includeVisible;
    checkbox.addEventListener('change', () => { this.includeVisible = checkbox.checked; this.open(); });
    label.append(checkbox, document.createTextNode('Include visible stories')); drawer.append(label);
    const records = this.getRecords().filter(record => this.includeVisible || record.decision.action !== 'allow');
    if (!records.length) drawer.append(node('p', 'No filtered stories on this page.'));
    for (const record of records) {
      const row = node('div'); row.className = 'row';
      row.append(node('h3', record.story.headline), node('small', `${record.decision.action === 'allow' ? 'Visible' : 'Filtered'} · ${record.decision.categories.map(x => x.name).join(', ') || record.decision.reason}`));
      const actions = node('div'); actions.className = 'actions';
      if (record.decision.action !== 'allow') actions.append(button('Show story', () => { this.feedback.show(record); this.open(); }));
      else actions.append(button('Hide this story', () => { this.feedback.hide(record); this.open(); }));
      actions.append(button(record.decision.action === 'allow' ? 'Hide stories like this' : 'Don’t hide stories like this', () => {
        if (!row.querySelector('input')) row.append(keywordEditor(record, record.decision.action === 'allow' ? 'blockedKeywords' : 'allowedKeywords', this.feedback));
      }));
      row.append(actions, explanation(record, this.debug())); drawer.append(row);
    }
    drawer.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
    shadow.append(drawer); document.documentElement.append(host); drawer.focus();
  }
}
