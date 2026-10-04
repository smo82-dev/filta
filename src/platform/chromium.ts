import type { Platform, Message, MessageSender, Tab } from './contracts';
import { sanitisePreferences } from '../core/preferences';
const STORAGE_KEY = 'newsFilterPreferences';
type Listener = (message: Message, sender: MessageSender, respond: (value: unknown) => void) => boolean | undefined;
interface NativeApi {
  storage: {
    local: { get(key: string): Promise<Record<string, unknown>>; set(values: Record<string, unknown>): Promise<void> };
    onChanged: { addListener(fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
      removeListener(fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void };
  };
  runtime: { sendMessage(message: Message): Promise<unknown>; getURL(path: string): string;
    onMessage: { addListener(fn: Listener): void; removeListener(fn: Listener): void };
    onInstalled: { addListener(fn: (details: { reason: string }) => void): void };
  };
  tabs: { query(query: { active: boolean; currentWindow: boolean }): Promise<Tab[]>;
    sendMessage(id: number, message: Message): Promise<unknown>; create(properties: { url: string }): Promise<Tab> };
  permissions: { contains(query: { origins: string[] }): Promise<boolean> };
  action: { setBadgeText(options: { tabId: number; text: string }): Promise<void>;
    setBadgeBackgroundColor(options: { tabId: number; color: string }): Promise<void> };
}
function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'error' in value) throw new Error(String(value.error));
  return value as T;
}
// The only native browser API access in the application. No polyfill or remote code.
export function chromiumPlatform(): Platform {
  const native = (globalThis as unknown as { chrome: NativeApi }).chrome;
  return {
    storage: {
      async read() { return sanitisePreferences((await native.storage.local.get(STORAGE_KEY))[STORAGE_KEY]); },
      async write(preferences) { await native.storage.local.set({ [STORAGE_KEY]: preferences }); },
      subscribe(listener) {
        const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEY]) listener(sanitisePreferences(changes[STORAGE_KEY].newValue));
        };
        native.storage.onChanged.addListener(handler);
        return () => native.storage.onChanged.removeListener(handler);
      },
    },
    messaging: {
      async request<T>(message: Message) { return unwrap<T>(await native.runtime.sendMessage(message)); },
      listen(handler) {
        const listener: Listener = (message, sender, respond) => {
          if (!message || typeof message !== 'object' || typeof message.kind !== 'string') return;
          let result: unknown;
          try { result = handler(message, sender); } catch (error) { respond({ error: String(error) }); return; }
          if (result === undefined) return;
          Promise.resolve(result).then(respond, error => respond({ error: String(error) }));
          return true;
        };
        native.runtime.onMessage.addListener(listener);
        return () => native.runtime.onMessage.removeListener(listener);
      },
    },
    tabs: {
      async active() { return (await native.tabs.query({ active: true, currentWindow: true }))[0]; },
      async send<T>(tabId: number, message: Message) { return unwrap<T>(await native.tabs.sendMessage(tabId, message)); },
      async open(path) { await native.tabs.create({ url: native.runtime.getURL(path) }); },
    },
    permissions: { contains(origins) { return native.permissions.contains({ origins }); } },
    installed(listener) { native.runtime.onInstalled.addListener(details => listener(details.reason)); },
    async badge(tabId, count) {
      await native.action.setBadgeBackgroundColor({ tabId, color: '#146453' });
      await native.action.setBadgeText({ tabId, text: count ? String(count) : '' });
    },
  };
}
