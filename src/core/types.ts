export const CATEGORY_IDS = [
  'celebrity', 'crime', 'tragedy', 'sexual', 'war', 'disaster', 'politics',
  'sport', 'entertainment', 'opinion', 'business', 'technology', 'science',
] as const;
export type CategoryId = typeof CATEGORY_IDS[number];
export type Action = 'allow' | 'collapse' | 'hide';
export type Field = 'headline' | 'description' | 'url' | 'section';
export interface Story {
  headline: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  section?: string;
  sourceDomain: string;
}
export interface Signal {
  category?: CategoryId;
  field: Field;
  term: string;
  contribution: number;
  kind: 'term' | 'combination' | 'context' | 'blocked' | 'allowed';
}
export interface CategoryScore { id: CategoryId; name: string; score: number; threshold: number }
export interface ClassificationResult { categories: CategoryScore[]; signals: Signal[] }
export interface StoryClassifier { classify(story: Story): Promise<ClassificationResult> }
export interface DetectedStory<THandle> { story: Story; handle: THandle; detector: string }
export interface StoryDetector<THandle, TRoot> {
  detect(root: TRoot, pageUrl: string): DetectedStory<THandle>[];
}
export interface Preferences {
  version: 1;
  configured: boolean;
  enabled: boolean;
  mode: 'collapse' | 'hide';
  filteredCategories: CategoryId[];
  blockedKeywords: string[];
  allowedKeywords: string[];
  disabledDomains: string[];
  enabledDomains: string[];
  alwaysShowUrls: string[];
  blockedUrls: string[];
  debug: boolean;
}
export type PreferencePatch = Partial<Omit<Preferences, 'version'>>;
export interface Decision {
  action: Action;
  reason: string;
  categories: CategoryScore[];
  signals: Signal[];
}
