# FILTA 0.2.0 — UI, artwork and BBC continuation evidence

21 October 2026. Existing PR #1, existing development branch. This is an unpublished owner test build. No merge, store submission, signing-key creation or replacement extension identity.

## Implemented behaviour

- First-time users see three steps: all 14 unselected topic cards; Collapse or Hide with optional phrases; concise choices/privacy review and Start filtering. Nothing is persisted until successful completion. Saving errors retain the draft and allow retry.
- Returning users go directly to My Topics, How FILTA Filters, My Exceptions, Website Controls, or Advanced & Diagnostics. Run setup again reflects current form choices; cancel restores the saved baseline. Existing version-1 fields, including all domain/URL exceptions, global enable, debug, mode and phrases, survive. Edited-field patches preserve untouched feedback lists updated in another tab.
- The popup uses real per-page counts and site status, pause/resume, filtered-story review and Manage FILTA. Mode/global/advanced controls now live in settings. Unsupported, unconfigured, empty and globally disabled cases have distinct states.
- Original PNGs from root commit `a1c9246` are preserved in `branding/`; all four supplied icon sizes and the original 128 px UI image are packaged byte-for-byte. No drawing/resampling was needed. Source hashes: `branding/SHA256SUMS`.
- Keyboard-native controls, explicit checkbox names/descriptions, logical sequencing and heading focus, live save/error feedback, visible focus, minimum 46 px buttons, high-contrast text, responsive cards, text resizing, forced-colour support and reduced-motion rules.

## Exact BBC investigation

Source: ordinary HTTP response from `https://www.bbc.com/culture/film-tv`, captured 21 October 2026. The response includes all three owner examples. A local Chromium replay with all external requests aborted rediscovers **35 cards**. This is a current-source replay, not a native extension or fully live browser test.

All three examples were detected and extracted correctly, with their own descriptions and opaque `/news/articles/...` URLs. None had an extracted exact-card section. The baseline branch classifier gave both selected categories zero evidence. No default override or rendering defect explains these replayed misses: **classification was the confirmed failure stage**.

| Story | Baseline selected scores | Updated evidence | Outcome |
| --- | --- | --- | --- |
| Rivals producer / bonkbuster shows | Entertainment 0; Celebrity 0 | Producer + shows, Entertainment 4 | Collapse and Hide verified |
| Apu / The Simpsons / new voice | Entertainment 0; Celebrity 0 | Named programme + voice/character context, Entertainment 4 | Collapse and Hide verified |
| Selena Gomez / vaping / voice | Entertainment 0; Celebrity 0 | Contextual celebrity evidence 4; singing + voice from exact-card narrative, Entertainment 4 | Collapse and Hide verified |
| BBC closures / business sense | Entertainment 0; Celebrity 0 | Business 4; selected scores remain zero | Remains visible |

The engine now evaluates contextual combinations across the **same card’s headline and description**, preserving field boundaries so phrases cannot be invented by concatenation. This is shared classifier behaviour used across category definitions. No page-wide Culture/Entertainment label is inherited. Added production DOM regressions verify actual hidden nodes/placeholders, always-show precedence, site pause and recycled-card updates. Limited explicit programme/person vocabulary is explainable; it is not complete entity recognition.

The regression fixture retains four actual BBC card snippets and neutral enclosing wrappers. It does not establish whole-site precision/recall. The owner’s original browser state and overrides are unavailable, so the replay diagnosis cannot rule out an additional cause on that device.

## Fresh validation

| Check | Result |
| --- | --- |
| `npm run check` | Passed: **64 core + 72 browser tests**, strict TypeScript, production build and package audit |
| All-category challenge | 140 cases, 84 positive and 56 negative; no misses/false positives on this controlled set |
| Discovery / extraction / dynamic loading | Existing 61-card structural corpus, 75 publisher snippets, adapter metadata, mutation/recycled-URL, emergency/body protection and 600-card feed tests passed |
| New UI suite | First run, revisit, repeat/cancel, all-field legacy preservation, concurrent feedback, failed write/retry, popup controls, unsupported/global-off, keyboard, reduced motion and 360 px / 200% text sizing passed |
| Accessibility | Axe 4.11.1: no violations against tested WCAG 2 A/AA, 2.1 AA and 2.2 AA rules on all setup steps, topics, websites, advanced, active/unsupported popup and enlarged narrow layout. Manual keyboard sequencing and visual review also completed. Does not certify every WCAG criterion or assistive-technology/browser combination |
| Branding / package | PNG headers, 16/32/48/128 dimensions, source-copy SHA-256 equality, manifest/action paths and UI image presence passed. No N badge |
| Dependency audit | `npm audit`: zero vulnerabilities; axe is development-only, no production dependency or new permission |
| Archive | 14 packaged files, manifest at root; every ZIP entry equals its production `dist` file byte-for-byte |
| Publisher headline challenge | Rerun: 19 TP, 0 FP, 6 FN, 3 TN. Known opaque-name/context limitations remain; not independent accuracy estimation |
| Native installation | Attempted with lightweight Chromium 153.0.8010.0; no service worker appeared and the test timed out. **No native install, toolbar rendering or same-identity upgrade pass claimed** |
| Stuff | Current HTTP 200 response is a script-dependent shell; zero usable cards in network-blocked replay. Report remains unreproduced, not passed |
| Live publisher checks | Additional live-browser attempt interrupted by automatic approval review because publisher scripts attempted third-party telemetry. Partial results are excluded from acceptance evidence. No request was made to bypass this restriction |

Run `npm ci`, install a compatible Chromium using Playwright (or set `CHROMIUM_PATH`), then `npm run check` and `npm run package`. `npm run test:extension` is separate and needs an extension-capable browser. `scripts/inspect-current-publishers.mjs BBC_HTML STUFF_HTML` replays supplied HTTP responses with external requests aborted; run `npm test` first to generate its detector/core bundles.

## Screenshots of connected production UI

These use Chromium with a simulated WebExtension API and actual production HTML/CSS/JS, saved preferences and content engine. They are not mockups or native-toolbar proof.

| Screen | Capture |
| --- | --- |
| Choose topics | [onboarding-1-topics.png](ui/onboarding-1-topics.png) |
| Choose style / optional phrases | [onboarding-2-style.png](ui/onboarding-2-style.png) |
| Review and start | [onboarding-3-ready.png](ui/onboarding-3-ready.png) |
| Returning settings hub | [settings-my-topics.png](ui/settings-my-topics.png) |
| Website controls | [settings-websites.png](ui/settings-websites.png) |
| Active popup | [popup-active.png](ui/popup-active.png) |
| Paused popup | [popup-paused.png](ui/popup-paused.png) |
| Unsupported page | [popup-unsupported.png](ui/popup-unsupported.png) |
| Narrow / 200% text sizing | [onboarding-narrow-200-percent.png](ui/onboarding-narrow-200-percent.png) |

## Owner installation and remaining acceptance

Extract the development ZIP into a stable folder. In desktop Chrome open `chrome://extensions`, enable Developer mode, select Load unpacked and choose the extracted folder. Pin FILTA and inspect the authentic toolbar icon; complete setup and try the three BBC examples. Test Stuff when fully loaded and capture any misses through debug story review.

A separately loaded unpacked copy can receive a different ID/storage from the published extension. The manifest identity inputs, schema, storage key and existing release archives are unchanged, but this does not prove a same-identity store upgrade. Do not remove the existing installation or clear its storage to test preservation. Publication/signing and a real same-identity upgrade remain owner-controlled gates.
