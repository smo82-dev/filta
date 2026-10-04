import { RuleBasedClassifier } from '../core/classifier';
import { evaluate } from '../core/filter-engine';
import { defaultPreferences } from '../core/preferences';
import { domainMatches } from '../core/text';
import type { Preferences, StoryClassifier, DetectedStory } from '../core/types';
import type { Platform, PageStatus } from '../platform/contracts';
import { GenericDetector, deduplicate, type Root } from './detectors/generic';
import { SITE_ADAPTERS } from './detectors/sites';
import { eligiblePage } from './page-eligibility';
import { CardRenderer, StoryReview, type StoryRecord, type Feedback } from './presentation';
export class PageScanner {
  private preferences: Preferences = defaultPreferences();
  private records = new Map<HTMLElement, StoryRecord>();
  private pending = new Set<Root>();
  private timer?: ReturnType<typeof setTimeout>;
  private draining = false;
  private pageUrl = location.href;
  private generation = 0;
  private count = -1;
  private observer?: MutationObserver;
  private unsubscribers: (() => void)[] = [];
  private readonly generic = new GenericDetector();
  private readonly renderer: CardRenderer;
  private readonly review: StoryReview;
  constructor(private readonly platform: Platform, private readonly classifier: StoryClassifier = new RuleBasedClassifier()) {
    const feedback: Feedback = {
      show: record => {
        record.override = 'show'; this.apply(record); this.report();
        record.element.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
      },
      hide: record => { record.override = 'hide'; this.apply(record); this.report(); },
      addKeyword: async (list, value) => {
        const prefs = await platform.messaging.request<Preferences>({ kind: 'ADD_RULE', list, value });
        this.update(prefs);
      },
    };
    this.renderer = new CardRenderer(feedback);
    this.review = new StoryReview(() => this.liveRecords(), feedback, () => this.preferences.debug);
  }
  async start() {
    // Subscribe before reading, so a concurrent settings save cannot be missed.
    let changedDuringRead = false;
    this.unsubscribers.push(this.platform.storage.subscribe(prefs => { changedDuringRead = true; this.update(prefs); }));
    const initial = await this.platform.storage.read();
    if (!changedDuringRead) this.preferences = initial;
    this.unsubscribers.push(this.platform.messaging.listen(message => {
      if (message.kind === 'PAGE_STATUS') return this.status();
      if (message.kind === 'OPEN_REVIEW') { this.review.open(); return { ok: true }; }
      return undefined;
    }));
    this.observer = new MutationObserver(mutations => {
      if (location.href !== this.pageUrl) { this.navigate(); return; }
      if (!this.active() || !eligiblePage(document, this.pageUrl, this.preferences)) return;
      for (const mutation of mutations) {
        const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
        if (!target || target.closest('[data-news-filter-ui]')) continue;
        const changed = mutation.type !== 'childList' || [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
          !(node instanceof HTMLElement && node.hasAttribute('data-news-filter-ui')));
        if (!changed) continue;
        const card = target.closest<HTMLElement>('article, li, [class*="story"], [class*="card"], [class*="teaser"]');
        if (card || mutation.type !== 'childList') this.schedule(card ?? target);
        else for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
          if (node instanceof HTMLElement && !node.hasAttribute('data-news-filter-ui')) this.schedule(node);
          else if (node.nodeType === Node.TEXT_NODE) this.schedule(target);
        }
      }
    });
    this.observer.observe(document.body ?? document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['href', 'src', 'data-section'],
    });
    window.addEventListener('popstate', this.navigate);
    this.schedule(document);
    this.report();
  }
  private navigate = () => {
    this.generation++;
    this.renderer.clear();
    for (const record of this.records.values()) record.element.removeAttribute('data-news-filter-detected');
    this.records.clear(); this.review.close(); this.pending.clear();
    this.pageUrl = location.href; this.schedule(document); this.report();
  };
  private active() {
    return this.preferences.configured && this.preferences.enabled && !this.preferences.disabledDomains.some(domain => domainMatches(location.hostname, domain));
  }
  status(): PageStatus {
    const records = this.liveRecords();
    return { domain: location.hostname, detected: records.length, filtered: records.filter(x => x.decision.action !== 'allow').length,
      active: this.active(), eligible: eligiblePage(document, this.pageUrl, this.preferences), configured: this.preferences.configured };
  }
  private liveRecords() { return [...this.records.values()].filter(record => record.element.isConnected); }
  private update(prefs: Preferences) {
    this.preferences = prefs;
    for (const record of this.records.values()) this.apply(record);
    if (this.review.isOpen()) this.review.open();
    this.schedule(document); this.report();
  }
  private apply(record: StoryRecord) {
    record.decision = evaluate(record.story, record.classification, this.preferences, record.override);
    if (!eligiblePage(document, this.pageUrl, this.preferences)) record.decision = { action: 'allow', reason: 'This site is not enabled for detection', categories: [], signals: [] };
    this.renderer.apply(record, this.preferences.debug && this.active());
  }
  private schedule(root: Root) {
    if ([...this.pending].some(value => value === document || value instanceof HTMLElement && value.contains(root))) return;
    for (const value of this.pending) if (root === document || root instanceof HTMLElement && root.contains(value)) this.pending.delete(value);
    this.pending.add(root);
    if (!this.timer && !this.draining) this.timer = setTimeout(() => { this.timer = undefined; void this.drain(); }, 140);
  }
  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.size) {
        const roots = [...this.pending]; this.pending.clear();
        for (const [element] of this.records) if (!element.isConnected) { this.renderer.restore(element); this.records.delete(element); }
        if (!this.active() || !eligiblePage(document, this.pageUrl, this.preferences)) continue;
        const generation = this.generation;
        const adapter = SITE_ADAPTERS.find(value => value.matches(location.hostname));
        let batch: DetectedStory<HTMLElement>[] = [];
        for (const root of roots) batch.push(...(adapter?.detect(root, this.pageUrl) ?? []), ...this.generic.detect(root, this.pageUrl));
        batch = deduplicate(batch);
        let processed = 0;
        for (const candidate of batch) {
          if (generation !== this.generation) break;
          const fingerprint = JSON.stringify(candidate.story);
          const previous = this.records.get(candidate.handle);
          if (previous?.fingerprint === fingerprint) continue;
          // Remove narrower old records if hydration introduced a complete outer card.
          for (const [element] of this.records) if (element !== candidate.handle && candidate.handle.contains(element)) {
            this.renderer.restore(element); this.records.delete(element);
          }
          if (previous) this.renderer.restore(previous.element);
          const classification = await this.classifier.classify(candidate.story);
          if (generation !== this.generation || !candidate.handle.isConnected) continue;
          const record: StoryRecord = { element: candidate.handle, story: candidate.story, detector: candidate.detector,
            fingerprint, classification, decision: { action: 'allow', reason: '', categories: [], signals: [] } };
          this.records.set(candidate.handle, record); this.apply(record);
          if (++processed % 20 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        // A virtualised card that became navigation/reading content must immediately be restored.
        for (const [element, record] of this.records) {
          if (!roots.some(root => root === document || root === element || root.contains(element))) continue;
          if (!batch.some(card => card.handle === element)) {
            this.renderer.restore(element); element.removeAttribute('data-news-filter-detected'); this.records.delete(record.element);
          }
        }
        if (this.review.isOpen()) this.review.open();
        this.report();
        if (this.preferences.debug) console.debug('[News Filter]', { candidates: batch.length, classified: processed, cached: batch.length - processed, ...this.status() });
      }
    } catch (error) {
      // Fail open: never leave cards hidden if a scanning stage fails unexpectedly.
      this.renderer.clear(); this.records.clear(); this.report();
      if (this.preferences.debug) console.warn('[News Filter] scanning stopped safely', error);
    } finally {
      this.draining = false;
      if (this.pending.size) this.schedule(document);
    }
  }
  private report() {
    const count = this.status().filtered;
    if (this.count === count) return;
    this.count = count;
    void this.platform.messaging.request({ kind: 'REPORT_COUNT', count }).catch(() => undefined);
  }
  stop() {
    this.generation++; this.observer?.disconnect(); this.unsubscribers.forEach(fn => fn());
    window.removeEventListener('popstate', this.navigate);
    if (this.timer) clearTimeout(this.timer);
    this.pending.clear(); this.renderer.clear(); this.review.close();
    for (const record of this.records.values()) record.element.removeAttribute('data-news-filter-detected');
    this.records.clear();
  }
}
