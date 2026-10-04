import { chromiumPlatform } from '../platform/chromium';
import { PageScanner } from './page-scanner';
// Only the top-level HTTP(S) page; manifests exclude browser pages and frames.
if (window === window.top && ['http:', 'https:'].includes(location.protocol)) {
  const scanner = new PageScanner(chromiumPlatform());
  void scanner.start().catch(() => scanner.stop());
  window.addEventListener('pagehide', event => { if (!event.persisted) scanner.stop(); });
}
