import type { Preferences, PreferencePatch } from '../core/types';
export interface Tab { id?: number; url?: string }
export interface PageStatus {
  domain: string; detected: number; filtered: number; active: boolean; eligible: boolean; configured: boolean;
}
export type Message =
  | { kind: 'GET_PREFS' }
  | { kind: 'PATCH_PREFS'; patch: PreferencePatch }
  | { kind: 'ADD_RULE'; list: 'allowedKeywords' | 'blockedKeywords' | 'alwaysShowUrls' | 'blockedUrls'; value: string }
  | { kind: 'SET_SITE'; domain: string; paused?: boolean; detect?: boolean }
  | { kind: 'PAGE_STATUS' }
  | { kind: 'OPEN_REVIEW' }
  | { kind: 'REPORT_COUNT'; count: number };
export interface StorageAdapter {
  read(): Promise<Preferences>;
  write(preferences: Preferences): Promise<void>;
  subscribe(listener: (preferences: Preferences) => void): () => void;
}
export interface MessageSender { tab?: Tab }
export interface MessagingAdapter {
  request<T>(message: Message): Promise<T>;
  listen(handler: (message: Message, sender: MessageSender) => unknown | Promise<unknown>): () => void;
}
export interface TabsAdapter {
  active(): Promise<Tab | undefined>;
  send<T>(tabId: number, message: Message): Promise<T>;
  open(path: string): Promise<void>;
}
export interface PermissionAdapter { contains(origins: string[]): Promise<boolean> }
export interface Platform {
  storage: StorageAdapter;
  messaging: MessagingAdapter;
  tabs: TabsAdapter;
  permissions: PermissionAdapter;
  installed(listener: (reason: string) => void): void;
  badge(tabId: number, count: number): Promise<void>;
}
