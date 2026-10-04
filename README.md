# Filta — local-first News Filter MVP

A working Manifest V3 extension that detects individual news cards, classifies them using transparent local rules, and allows, collapses or hides them according to your choices. No topics are selected by default. Collapse is the initial mode.

The release ZIP contains the built extension; the source ZIP contains this project, tests and a `dist/` folder. No account, backend, AI API, key or subscription is needed. The extension has no runtime dependencies.

## Downloads — version 0.1.0

The extension currently appears in the browser as **News Filter**.

| Download | Use |
| --- | --- |
| [Desktop extension ZIP](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-0.1.0.zip) | Extract, then **Load unpacked** in desktop Chrome or Edge |
| [Android extension CRX](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-0.1.0.crx) | Import through Lemur Browser's local extension manager; this is not an APK |
| [Source ZIP](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-source-0.1.0.zip) | Source, tests, documentation and a built `dist/` folder |
| [SHA-256 checksums](downloads/SHA256SUMS.txt) | Verify the downloaded packages |

The source code lives at the repository root. The GitHub **Code → Download ZIP** button downloads the repository, rather than just the installable extension. Use the desktop extension ZIP above when installing. Android/Lemur still needs real-device testing; installation details follow below.

## Install and try it

### Chrome desktop

1. Extract `news-filter-0.1.0.zip` into a permanent folder. `manifest.json` should be directly inside that folder.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose that folder.
3. Open **Settings** from the extension. Choose topics or custom phrases, keep **Collapse** for initial testing, and select **Start filtering**. The settings tab also opens on first installation.
4. Open or refresh a BBC, The Guardian or RNZ news listing. Some uncertain cards will deliberately remain visible.
5. A matching card becomes a small replacement with **Show story** and **Why was this hidden?**. Expand the explanation for **Don’t hide stories like this** and add a phrase you want to always see.
6. The popup provides the current page count, **View filtered stories**, the Collapse/Hide switch, global enable, settings and per-site pause/resume.

Existing tabs opened before installation need a refresh to receive the content script. After an extension reload, refresh website tabs too. Chrome's protected pages and extension stores cannot be modified.

### Edge desktop

Open `edge://extensions`, enable **Developer mode**, select **Load unpacked** and choose the same extracted folder. Follow the Chrome workflow above. There is no separate Edge build.

Official installation references: [Chrome development basics](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) and [Edge sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

### Android target: Lemur Browser

The initial Android target is **Lemur Browser – Extensions**, package `com.lemurbrowser.exts`. Its [developer's Google Play listing](https://play.google.com/store/apps/details?id=com.lemurbrowser.exts) documents Chromium, Chrome/Edge extensions and local CRX import.

Use the supplied `news-filter-0.1.0.crx` in Lemur's extension manager/local import control. Enable developer mode if the installed version requires it, choose the CRX, review the access request, and enable the extension. Menu labels depend on Lemur's version. Open the extension settings, choose your rules, and try the same listing-page workflow. Settings open as a full tab, so they do not depend on a desktop options-page menu.

**No Android browser/device was available for testing here.** Lemur is the target, rather than a verified phone compatibility claim. Check that the installed Lemur release supports MV3 service workers, local CRX imports, popup controls, storage notifications and page messaging. If local import rejects the package, record the browser/version/error; do not assume a desktop ZIP can be loaded by every Android browser. Standard Chrome for Android does not load this extension.

## Behaviour and precedence

Each story is extracted once, scored and evaluated. The classifier considers its headline, summary, detected section and decoded URL path. Images are recorded as URLs where available, but the extension never fetches or renders them.

In priority order:

1. Recognised emergency information stays visible.
2. Unconfigured, globally disabled or paused filtering allows everything.
3. **Show story** restores that story for the current page.
4. Always-show phrases and exact URL exceptions override ordinary filtering.
5. An explicit page-only hide or a stored blocked URL applies the chosen mode.
6. A custom hide phrase applies the chosen mode.
7. A selected category with a score at or above its threshold applies the chosen mode.
8. Everything else stays visible.

Custom phrases match whole words, ignore case and normalise punctuation. Enter one phrase per line. They do not match query strings or URL fragments. A deliberate custom hide phrase is stronger than contextual category adjustments; add an always-show phrase to exempt it. Exact URL exceptions ignore query strings and fragments.

**Hide** removes the card from the visual layout without deleting its DOM node. Use **View filtered stories** to explain and restore it. Story review also offers **Include visible stories**, **Hide this story** and **Hide stories like this**. Page-only show/hide choices reset on refresh. “Stories like this” opens an editable phrase form; it updates the visible settings lists, rather than silently learning a broad rule. Exact persistent story exceptions can be entered in advanced settings.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/core/types.ts` | Portable Story, classifier, detector and decision contracts; no DOM types |
| `src/core/rules/categories.ts` | Category names, terms, combinations, exceptions and thresholds |
| `src/core/classifier.ts` | Asynchronous `StoryClassifier` rule/scoring implementation |
| `src/core/filter-engine.ts` | Preference evaluation, explicit precedence and pipeline contract |
| `src/core/preferences.ts` | Defaults and validation |
| `src/platform/contracts.ts` | Storage, messaging, tabs and permissions interfaces |
| `src/platform/chromium.ts` | All native Chromium API calls, in one adapter |
| `src/platform/background.ts` | MV3 worker; serialised local preference writes and page-count badges |
| `src/content/detectors/` | Generic DOM detector and isolated site adapters |
| `src/content/page-scanner.ts` | Incremental scanning, fingerprint cache and observer batching |
| `src/content/presentation.ts` | Reversible card display, explanations and feedback/review UI |
| `src/ui/`, `public/` | Touch-friendly popup, settings, styles and manifest |

The pipeline is **detect → extract → classify → evaluate preferences → render → optional correction**. `Story` contains plain data. The detector's generic handle contract is instantiated with `HTMLElement` only in the content layer. The page scanner retains classification results when preferences change; it reevaluates decisions without reclassifying unchanged stories.

## Detection and page safety

The generic detector looks for semantic articles, linked headings, named story/card containers and compact repeated structures. Candidates must contain a single identifiable story URL and a plausible headline. Containers with multiple story URLs, article bodies, H1 reading views, long text, forms or protected controls are rejected. Navigation, page headers, footer controls, consent/privacy/advertising containers and recognised emergency elements are protected.

BBC, The Guardian and RNZ have isolated adapters, with generic fallback. The Guardian adapter also recognises current fronts with a sibling overlay link and an unlinked `.card-headline`. Compound cards containing several different stories are deliberately skipped; sub-story cards may still be processed individually.

On other sites, detection requires news context in the domain, path, title or site metadata. Use **Detect news cards on this site** in the popup, or add a domain in advanced settings, to opt another site in. These conservative checks reduce activity on unrelated sites, but are heuristics rather than a perfect news-site classifier.

Dynamic additions are batched for 140 ms and scanned within changed subtrees. Unchanged Story fingerprints reuse cached classification. Headline and link changes in reused cards trigger reevaluation. Disconnected records are pruned; cards that become reading content are restored. The scanner yields between groups of 20 classifications. Preference edits and navigation may trigger a full discovery pass. Mutation observation ignores the extension's UI and its own display changes. Browser history navigation and DOM changes on routes are handled; a route change with no DOM mutation is outside the MVP's detection strategy.

Cards keep their original elements and inline display values/priorities. Replacements use Shadow DOM to isolate controls. Unexpected scanner errors restore filtered cards. Sites with fixed-height wrappers, unusual grids or compound cards may retain gaps; the extension does not rearrange entire page sections to fix them.

## Classification rules

There are 13 seed categories: Celebrity & Gossip, Crime, Death & Tragedy, Sexual Content, War & Conflict, Disaster, Politics, Sport, Entertainment, Opinion, Business, Technology and Science.

Term weights are multiplied by field weights: headline **1**, description **0.35**, URL path **0.25**, section **1.5**. Current thresholds are **4**. Each term counts once per field. Headline combinations add confidence, and contextual phrases subtract scores. Scores cannot go below zero. For example, “New technology could prevent road deaths” receives a technology signal and a tragedy exception. An incidental actor mention alone is below the celebrity threshold.

This is intentionally limited English rule matching, not natural-language understanding. Scores describe rule evidence, not calibrated probabilities. Current rules do not infer every name, euphemism, inflection, non-English term or subtle context. You can inspect contributions and correct mismatches.

To add or tune rules, edit `categories.ts`: add weighted terms, combinations, negative contexts or a threshold, then add a test. For a new category, also extend `CATEGORY_IDS` in `types.ts`; settings renders the definitions automatically. No categories become selected automatically.

## Add a site adapter

Implement `SiteAdapter` in `src/content/detectors/sites.ts` or an adjacent module. Define boundary-safe domain matching and `detect(root, pageUrl)`. Return `{ story, handle, detector }` records and register the adapter in `SITE_ADAPTERS`. Keep selectors and special extraction inside the adapter. Reuse `extractCard` safety checks and `deduplicate`; do not add site selectors to the classifier. Use extraction hints only after independently proving a container is one complete card. Add small synthetic fixture HTML and both positive and rejection checks.

## Privacy and permissions

All preferences use `storage.local`, not synchronised storage. Nothing is sent to a server or browser sync account. There is no telemetry, analytics, remote executable code, AI call, font CDN, external stylesheet or fetched image. Headlines and classifications stay in content-script memory and are discarded on navigation. Only preferences you choose, including domain and optional exact-URL exceptions, are persisted.

The manifest requests `storage` and `activeTab`. Declared HTTP(S) content-script matches allow automatic detection on news listings; browsers may describe that access as reading/changing website data. The code gates detection to recognised/opted-in news contexts and operates only in the top frame. There are no cookie, browsing-history, webRequest, debugger or network-blocking permissions. The extension-page CSP includes `connect-src 'none'`. Website resources continue to behave according to the original website; this extension only adjusts cards in the current browser view.

## Development, tests and packages

Use Node.js 22 or newer. A repository-specific [Replit development prompt](REPLIT-PROMPT.md) is included for future changes; the extension runs in the browser and does not need a hosted application.


```sh
npm ci
npm run test
npm run build
npx playwright install chromium
npm run test:browser
npm run audit:package
npm run package
```

`npm run check` combines the core tests, production build, DOM/UI checks and package audit. `test:browser` expects `npm run test` to have generated its test bundles and a current `dist/` build. `CHROMIUM_PATH` can select a compatible local executable instead of the Playwright-installed browser. For example on a POSIX shell:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:browser
CHROMIUM_PATH=/path/to/full/chrome npm run test:extension
```

`test:browser` runs real Chromium DOM, UI, MutationObserver and production JavaScript **with a simulated WebExtension API**. It covers detection fixtures, settings, popup, feedback, persistence, pause/resume, dynamic insertion, virtualised cards, cached classification, original-style restoration, reading-view safety, mobile-width layout and concurrent preference updates. It does not prove native unpacked installation. `test:extension` is a separate native MV3 smoke test using a full Chrome for Testing/Chromium browser, a fresh profile, the real worker/storage and automatic content-script injection. Desktop/headless builds without extension support cannot run that test.

`npm run package` creates `release/news-filter-0.1.0.zip` with `manifest.json` at its root. No build tools are included in the release. To create a local CRX3 for Lemur, use Chrome's **Pack extension** control, or:

```sh
CHROMIUM_PATH=/path/to/full/chrome npm run package:crx
npm run audit:crx
```

The CRX script retains a development signing key in `.signing/news-filter-development.pem` and reuses it for subsequent local packages. Keep the same key when updating an existing CRX installation so its extension identity and preferences are retained. The supplied release's signing key is a separate file, excluded from the source and extension ZIPs; restore it at that path before producing an update to the supplied CRX. The package audit checks permissions, referenced MV3 files, core portability, API isolation, remote assets, network APIs and executable-code restrictions. The CRX audit verifies the developer signature and embedded archive.

Enable **Debug mode** in advanced settings to outline detected cards. Story review can show extracted headlines, detector, category scores, matched signals and final decisions. Counts/cache activity are logged to the page console. Debug mode is off by default.

## Validation and remaining manual checks

See `VALIDATION.md` for the exact release checks and their limits. Core tests and Chromium DOM/UI checks pass. TypeScript and production/package checks pass. Static homepage HTML from BBC and The Guardian was also inspected without running website scripts; RNZ could not be fetched in this environment.

Native Chrome profile testing was blocked by this execution environment's Unix-socket restrictions. Native Chrome/Edge unpacked installation, Android Lemur CRX installation and real live-site layout/interaction checks remain manual. No Firefox, Safari, iPhone or iPad implementation is included.

Manually check install/setup, each adapter's actual desktop/mobile homepage, category collapse, explanations, restoration, Hide review, phrase precedence, site/global pause, refresh persistence, dynamic loading, normal article reading, consent/login/navigation controls, Android touch/keyboard and background/resume behaviour. Record browser version, OS, page URL and any layout problem. Test a domain opt-in and confirm unrelated websites stay inactive.

## Future portability

Firefox can reuse `/core` and the DOM pipeline with a Promise-based WebExtension platform adapter and Firefox-specific manifest/build output. Review background lifecycle and host permission behaviour before porting; no Firefox package is generated now.

Safari can reuse the same core and much of the content/UI code within Apple's macOS/iOS Web Extension packaging. Add a Safari adapter, native app packaging and device-specific tests for permissions, background messaging, popup/settings and mobile layout. No Safari wrapper is implemented now.

An optional semantic classifier can implement `StoryClassifier.classify(story): Promise<ClassificationResult>` and supply comparable scores/signals. Preference evaluation, explicit user precedence and DOM rendering remain separate. Local models, optional cloud services, semantic preference text and learning are future work, and are not included in this MVP.
