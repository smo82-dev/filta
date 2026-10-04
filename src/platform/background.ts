import { chromiumPlatform } from './chromium';
import { applyPreferencePatch } from '../core/preferences';
import { normaliseDomain } from '../core/text';
import type { Preferences } from '../core/types';
const platform = chromiumPlatform();
// Serialise read/modify/write operations so two tabs' feedback cannot lose each other's rules.
let queue: Promise<unknown> = Promise.resolve();
function mutate(update: (current: Preferences) => Preferences): Promise<Preferences> {
  const result = queue.then(async () => {
    const next = update(await platform.storage.read());
    await platform.storage.write(next);
    return next;
  });
  queue = result.catch(() => undefined);
  return result;
}
platform.messaging.listen((message, sender) => {
  switch (message.kind) {
    case 'GET_PREFS': return platform.storage.read();
    case 'PATCH_PREFS': return mutate(current => applyPreferencePatch(current, message.patch));
    case 'ADD_RULE': {
      const validLists = ['allowedKeywords', 'blockedKeywords', 'alwaysShowUrls', 'blockedUrls'];
      if (!validLists.includes(message.list) || typeof message.value !== 'string') throw new Error('Invalid rule');
      return mutate(current => applyPreferencePatch(current, { [message.list]: [...current[message.list], message.value] }));
    }
    case 'SET_SITE': return mutate(current => {
      const domain = normaliseDomain(message.domain);
      const patch: { disabledDomains?: string[]; enabledDomains?: string[] } = {};
      if (typeof message.paused === 'boolean') patch.disabledDomains = message.paused
        ? [...current.disabledDomains, domain] : current.disabledDomains.filter(value => value !== domain);
      if (typeof message.detect === 'boolean') patch.enabledDomains = message.detect
        ? [...current.enabledDomains, domain] : current.enabledDomains.filter(value => value !== domain);
      return applyPreferencePatch(current, patch);
    });
    case 'REPORT_COUNT': {
      if (sender.tab?.id !== undefined && Number.isFinite(message.count)) {
        return platform.badge(sender.tab.id, Math.max(0, Math.round(message.count))).catch(() => undefined);
      }
      return Promise.resolve();
    }
    default: return undefined;
  }
});
platform.installed(reason => {
  if (reason === 'install') void platform.tabs.open('settings.html').catch(() => undefined);
});
