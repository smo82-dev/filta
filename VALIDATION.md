# Release validation — News Filter 0.1.0

Validation performed 4 October 2026 (Pacific/Efate).

| Check | Result and scope |
| --- | --- |
| Portable engine tests | 37 passed, including the 13 category seeds |
| Chromium DOM/UI suite | 21 workflow checks passed; 22 tests including the enclosing suite |
| Browser used for DOM/UI | Headless Chromium 153.0.8010.0, Playwright 1.62.1 |
| Browser API boundary | Simulated WebExtension APIs; production content, adapter, worker, settings and popup code executed unchanged |
| TypeScript | Strict typecheck passed |
| Production build | Passed; four self-contained IIFE bundles, local HTML/CSS, Manifest V3 |
| Package audit | Passed: files exist, minimal permissions, browser APIs isolated, core has no DOM/browser coupling, no network API/remote asset/eval |
| Mobile UI | 360 px width inspected; no horizontal overflow; primary controls at least 44 px high |
| Native Chrome package creation | CRX3 created by Chrome for Testing 154.0.8037.92; signature and embedded ZIP checked |
| Native unpacked extension execution | Pending: full Chrome profile launch is blocked here by Unix-socket restrictions |
| Desktop Edge | Manual install/runtime/live-page checks pending |
| Android target | Lemur Browser – Extensions; no Android device/browser tested |
| Firefox / Safari | Not implemented |

The DOM/UI suite exercises the complete product workflow through a browser API simulator. This is stronger than a UI mock-up, but it is **not** evidence that native extension installation, MV3 background lifecycle or Android browser integration has passed.

Core tests cover scores, field weights, combinations, explicit hide/always-show keywords, category choices, contextual exceptions, emergency preservation, precedence, each action, URL exceptions, validation and asynchronous classifier substitution.

Browser checks cover generic extraction, three adapter fixtures, article-body rejection, incremental scan roots and caching, empty first-run choices, collapse explanations, immediate restoration, refresh persistence, popup counts/modes, Hide review, custom phrases, site/global pause, dynamic insertion, virtualised cards, original display/priority restoration, corrections, debug scores, unrelated-site gating, mobile layout and concurrent rule writes. No browser page errors were observed.

## Static real-site checks

BBC and Guardian homepage HTML was fetched and examined with website scripts and resource requests disabled. Snapshots are not distributed.

| Source | Result |
| --- | --- |
| BBC `/news` | 47 unique cards detected; BBC adapter found all 47; 21 had extractable image URLs |
| Guardian `/international` | 132 unique cards detected: 85 via the tuned overlay-card adapter, plus conservative generic sub-story detection; all 85 adapter cards had images |
| RNZ `/news` | Fetch unavailable in this environment; representative adapter fixture passed |

These counts are single-snapshot checks, not coverage guarantees or live-page layout verification. Compound main cards with unrelated sub-stories are intentionally left alone. Live hydration, consent variants, geographic editions and mobile layouts can change the DOM.

## Manual acceptance checklist

- Load the extracted release ZIP using **Load unpacked** in actual Chrome and Edge. Check the worker and extensions page for errors.
- Import the supplied CRX in Lemur on Android. Record browser/engine version, device/OS and any import or MV3 limitation.
- Start with no categories selected; explicitly select a topic and verify matching cards collapse on each supported live homepage.
- Expand **Why was this hidden?**, confirm the stated rule, restore a card, and add an always-show correction.
- Change to **Hide**; open story review from the popup and restore a fully hidden card.
- Add hide and always-show phrases; verify always-show precedence, refresh persistence and fresh dynamically inserted cards.
- Pause/resume the current site and globally; confirm navigation, consent controls and deliberately opened articles remain usable.
- On Android, check popup/settings opening, touch targets, text keyboard, scrolling, background/resume and persistence after restarting the browser.
- Check fixed-height/grid wrappers for gaps and unrelated sites for unintended activation. Use explicit domain opt-in where generic discovery lacks news context.

The source includes `npm run test:extension` for an automated native MV3 installation/storage/injection smoke test on a machine able to launch a full extension-capable Chrome for Testing/Chromium build.

## GitHub import verification

Before publishing the source and downloads to `smo82-dev/filta`, the 37 core tests, strict TypeScript check, production build, package audit and CRX signature audit were rerun successfully. Each desktop ZIP entry and each embedded CRX entry was compared with the current production `dist/` files. The source snapshot excludes dependencies, local browser profiles and all private signing keys. Browser DOM/UI results above are from the original MVP validation; that suite was not rerun for this documentation/import-only change because the downloaded browser executable was no longer present. Native desktop and Android checks remain pending.
