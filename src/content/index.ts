import { chromiumPlatform } from '../platform/chromium';
import { PageScanner } from './page-scanner';
import { useShadowRootResolver } from './detectors/generic';
// Only the top-level HTTP(S) page; manifests exclude browser pages and frames.
if (window === window.top && ['http:', 'https:'].includes(location.protocol)) {
  const platform = chromiumPlatform();
  if (platform.shadowRoot) useShadowRootResolver(platform.shadowRoot);
  const scanner = new PageScanner(platform);
  void scanner.start().catch(() => scanner.stop());
  window.addEventListener('pagehide', event => { if (!event.persisted) scanner.stop(); });
}
