# Release validation — News Filter 0.1.1

Validation performed 4 October 2026. Version 0.1.1 adds shared story-label extraction and **Sponsored & Paid Content**, without changing user rule precedence or default topic choices.

| Check | Result and scope |
| --- | --- |
| Portable engine tests | 60 passed, including all 14 category seeds, 17 sponsored disclosure variants and existing scoring/precedence/context checks |
| Chromium DOM/UI suite | 26 workflow checks passed; 28 tests including the two enclosing suites |
| Browser used for DOM/UI | Headless Chromium 153.0.8010.0, Playwright 1.62.1 |
| Browser API boundary | Simulated WebExtension APIs; production content, adapter, worker, settings and popup code executed unchanged |
| TypeScript | Strict typecheck passed |
| Production build | Passed; four self-contained IIFE bundles, local HTML/CSS, Manifest V3 0.1.1 |
| Package audit | Passed: referenced files, minimal permissions, browser API isolation, portable core, no network API/remote asset/eval |
| Mobile UI | Existing 360 px checks pass with the additional category; no horizontal overflow |
| Desktop ZIP | Versioned package created successfully; all entries match current production dist bytes |
| Android CRX3 | Signed locally with the existing development key; developer signature, unchanged public-key identity, embedded ZIP and manifest version verified |
| Native unpacked extension execution | Inconclusive: available Chromium timed out before a service worker appeared; the unchanged 0.1.0 package also produced no worker in a baseline check |
| Chrome/Edge live pages | Manual installation, native runtime and live-site layout checks pending |
| Android target | Lemur Browser – Extensions; no Android device/browser tested |
| Firefox / Safari | Not implemented |

`npm run check` passed: core tests, TypeScript/build, both browser suites and package audit. `npm run package` and `npm run audit:crx` passed. `git diff --check` passed.

The available Chromium's native `--pack-extension` attempt did not produce a package and was stopped. The downloadable CRX was instead signed from the production ZIP using Node's local crypto API, the original CRX identity and the same private signing key. No private key is included in the repository or archives. The full Chrome/Chromium CLI packaging script remains available and now times out after 30 seconds if the selected executable cannot pack an extension.

The DOM/UI suite is evidence for DOM extraction, rule evaluation and user controls; it does not prove native MV3 installation, service-worker lifecycle or Android browser compatibility. The native smoke test includes sponsored-category checks, but its available-browser launch did not reach those assertions. No live Stuff homepage was validated in this environment.

## Sponsored-content regression coverage

Core tests cover case-insensitive Sponsored, Paid Content, Partner Content, Presented by, Sponsored by and all other seed disclosures; label-only hide/always-show phrases; whole-word boundaries; no phrase spanning separate labels; duplicate evidence; conservative narrative/URL weighting; Allow/Collapse/Hide; emergency, pause, temporary overrides and URL exceptions; and preservation of existing topic choices.

A Stuff-style fixture contains separate badges, accessible icon metadata, editorial labels, site-wide and adjacent ad banners, embedded ad/recommendation text, hidden badges, controls/timestamps, oversized metadata, ambiguous collections and an article reading view. Tests verify that unrelated material cannot become labels or summaries, and that uncertain containers are rejected. No story-card boundary safety check was weakened.

The five added Chromium workflow checks cover shared generic extraction, BBC/RNZ/Guardian adapters (including Guardian overlay cards), settings selection and explanations/restoration, phrase/category precedence in both modes, and dynamic insertion plus badge text/class/hidden-state changes on already filtered cards. The original 21 workflow checks also pass, covering Sport and other existing rules, caches, feedback, persistence, pause/resume, reading safety and mobile controls.

## Static real-site checks

During the original 0.1.0 validation, BBC and Guardian homepage HTML was fetched and examined with website scripts and resource requests disabled. Snapshots are not distributed.

| Source | Result |
| --- | --- |
| BBC `/news` | 47 unique cards detected; BBC adapter found all 47; 21 had extractable image URLs |
| Guardian `/international` | 132 unique cards detected: 85 via the tuned overlay-card adapter, plus conservative generic sub-story detection; all 85 adapter cards had images |
| RNZ `/news` | Fetch unavailable in this environment; representative adapter fixture passed |

These counts are single-snapshot checks, not coverage guarantees or live-page layout verification. Compound main cards with unrelated sub-stories are intentionally left alone. Live hydration, consent variants, geographic editions and mobile layouts can change the DOM.

## Manual acceptance checklist

1. In desktop Chrome and Edge, update the unpacked folder using `news-filter-0.1.1.zip`, click **Reload** in the extensions page, and refresh news tabs. Existing preferences should remain; the new category should initially be unselected.
2. On **Stuff.co.nz**, test **Sport** filtering. Remove conflicting always-show phrases first and opt the domain into detection if the popup says it is not enabled.
3. Test `sponsored` in **Hide words/topics** with the sponsored category unselected. A card's separate Sponsored badge should cause filtering even when the headline, summary and URL do not contain the word.
4. Clear that custom hide phrase, select **Sponsored & Paid Content**, and check Paid Content, Partner Content, Presented by and Sponsored by cards. Nearby site-wide ad banners, normal stories and deliberately opened article bodies must remain unchanged.
5. Check **Why was this hidden?**, the label signal, **Show story**, Collapse/Hide and hidden-story review. Add an always-show phrase matching a headline or label and confirm it overrides sponsored filtering.
6. Refresh, pause/resume, and scroll/load more stories. Check newly inserted and changed cards. CSS-only label visibility changes without a tracked mutation may need a refresh.
7. Repeat representative checks on RNZ, BBC and Guardian, including navigation, consent/login controls, mobile widths and fixed-height layouts. Record browser version, OS, page URL and badge markup for any missed card.
8. Import the same-identity 0.1.1 CRX in Lemur on Android and check updates, touch controls, keyboard, background/resume and persistence. Android remains unverified.

Use `npm run test:extension` with a full extension-capable Chrome for Testing/Chromium executable on a machine that supports native extension loading. The current headless runtime's lack of a worker was also observed with the previous release and is not a demonstrated sponsored-feature regression.
