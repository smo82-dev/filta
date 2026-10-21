# Release validation — FILTA 0.2.0 owner test build

Validation date: 21 October 2026, Vanuatu time. PR #1 remains draft, open and unmerged. The Chrome Web Store release and `main` are unchanged.

## Readiness

The implementation is ready for independent code review and owner testing. **It is not cleared for Chrome Store submission.** Native installation/update checks, native toolbar rendering/signing verification, reproduction of the Stuff report and broader independent real-headline accuracy evaluation remain open.

## Latest continuation evidence

The connected onboarding, settings hub, popup and original branding are implemented. **64 core + 72 browser tests passed** in this continuation, together with strict TypeScript, build/package audit and a zero-vulnerability dependency audit. Axe checks reported no violations for the tested WCAG A/AA rules; this is not a complete accessibility certification. Screenshots and exact BBC stage evidence: [UX-AND-BBC.md](docs/validation-0.2.0/UX-AND-BBC.md).

The current BBC Film & TV HTTP response reproduced 35 discoveries; all three owner examples were correctly extracted but scored zero before the classification changes. New regressions verify classification, overrides and actual Collapse/Hide rendering. Stuff’s current HTTP response was a script-dependent shell with no usable cards. Additional live-browser validation was stopped by automatic approval review because publisher scripts attempted third-party telemetry. No completed live-site acceptance pass is claimed from that interrupted run. Historical publisher checks below are labelled evidence from the earlier checkpoint.

## A. Root causes and diagnosis

The source inspection and controlled baseline comparison demonstrate several distinct failure modes; they do not prove which one caused a particular missed Stuff card, because Stuff did not supply actual article cards during the accessible homepage attempts.

| Stage | Finding | Correction and evidence |
| --- | --- | --- |
| Eligibility | Unrecognised publishers could be excluded before discovery; initial 0.2 widening also needed guards on shared publisher app/shop routes. | Curated publisher eligibility, redirect domains and app/shop safeguards; opt-in and pause precedence retained. |
| Discovery | v0.1.1 depended on semantic articles and linked headings. Plain linked lists, accessibility headings, overlay links and wrapped links were missed. Compound wrappers could obscure their safe individual cards. | Structural/semantic discovery for complete single-story boundaries, linked anchor ownership, repeated-card caching and negative controls. 18/61 baseline discoveries versus 61/61 now. |
| Extraction | Broad wrapper selection could include credits or lose an enclosing link. Generic deduplication replaced adapter information, including exact-story labels, sometimes at an outer wrapper. | Exclude credit-only links; retain the complete anchor/card; merge richer metadata only across nested records with the exact same story URL. A dedicated adapter-versus-generic regression verifies Analysis survives at an outer boundary. |
| Classification | Sparse seed rules and weak URL weighting missed explicit publisher taxonomy, inflections and contextual combinations. Rule matching repeatedly normalised the same fields. | All 14 categories reviewed; explicit section/label/parent-path taxonomy, bounded word alternatives, negative context and precompiled normalisation. Custom whole-phrase matching is unchanged. |
| Decisions | Existing emergency/paused/always-show precedence was correct and must survive the overhaul. | Kept the engine and preference schema; cross-category Allow/Collapse/Hide and always-show checks pass. |
| Presentation/lifecycle | Recycled card URLs and metadata changes lost Show story state; URL-only navigation was missed; an unconditional review refresh could discard an editor mid-entry. | Retain a same-URL override, clear it for a recycled URL, listen for Navigation API entry changes, refresh review only when records change, restore/prune cards and remove listeners on stop. |

Debug-only status now separates discovery rejections, no-topic evidence, selected-topic matches and final action counts. Normal users receive one short zero-story message. No browsing data is persisted or sent anywhere.

## B. Implementation and preservation

- Generic discovery remains the foundation. BBC, Guardian and RNZ adapters remain small isolated supplements.
- Bounded local articleSection microdata and exact-URL-linked NewsArticle JSON-LD are supported. Structured metadata is parsed once per discovery pass and cached; unrelated page-level metadata never labels sibling articles.
- The original `version: 1` preference schema, storage key, category IDs, initial unselected topics, override precedence and native API boundary remain unchanged. Existing preference compatibility is exercised through the simulated storage/UI suite. Same-identity native upgrade testing remains unverified.
- Permissions remain exactly `storage` and `activeTab`, with existing top-frame HTTP(S) content-script declarations. No remote classifier, account, API call, analytics or runtime dependencies were added.
- The owner’s six PNG files are preserved byte-for-byte in `branding/`; manifest and action icons use all four supplied sizes. UI logo bytes match the supplied store icon. The shared UI stylesheet is redesigned; `public/content.css` and prior download archives are unchanged. No new artwork, signing identity or key is substituted. Native toolbar rendering and store-signing verification remain open.
- Manifest, package and lock versions are 0.2.0. The customer-facing product is FILTA with “Take control of your news feed.” Internal identifiers are retained.

## C. Publisher compatibility

The programme covers all **39 publishers** named in the brief, across the US, UK, Australia and New Zealand. Every publisher received an ordinary HTTP attempt. Browser attempts and development pipeline checks are recorded separately. Some returned access blocks, empty shells, redirects or timeouts.

There are **25 publishers with three saved source snippets each**: 75 sampled cards. All 75 are rediscovered by the final automated suite. These snippets include neutral repeated wrappers to preserve isolated-card context; they are not complete saved pages and their selection from discoverable cards biases recall. They must not be used as a whole-site recall claim.

During browser development checks, the production scanner and renderer with an in-memory platform adapter exercised per-category selection, Hide, Collapse, scroll and Pause on 15 publishers, with no observed render/decision mismatches. These were development checkpoints, not native MV3 execution or a final all-site certification. Not every scroll caused new stories to arrive.

See [the full 39-publisher table](docs/validation-0.2.0/COMPATIBILITY.md) and [machine-readable outcomes](docs/validation-0.2.0/compatibility.json).

**Stuff is not marked passed.** Its initial response was an app shell, and the rendered homepage showed loading placeholders without usable story links. The owner's mixed-topic filtering report remains unreproduced in this environment. The Press and The Post supplied actual rendered cards in separate attempts; this does not certify Stuff's homepage. No access control was bypassed.

## D. Detection and classification measurements

| Dataset | Baseline / outcome | Scope |
| --- | --- | --- |
| Labelled structural discovery | v0.1.1: 18/61 (29.5%); initial PR checkpoint: 32/61 (52.5%); final: 61/61 (100%); zero false positives | Controlled synthetic layouts with explicit protected non-card elements; exceeds the initial 95% target on this set only |
| Sampled publisher source snippets | 75/75 rediscovered, across 25 publishers | Saved-response/rendered snippets; not publisher-wide recall |
| Controlled category challenge | 140 binary cases: 84 positives, 56 negatives; 100% precision and recall on this set | Equal numbers of cases per category; synthetic/contextual challenge cases, partly informed implementation |
| Publisher headline challenge | 19 true positives, 0 false positives, 6 false negatives, 3 true negatives; 100% precision, 76% recall | 28 small, hand-labelled binary cases; investigation dataset, not independent accuracy estimation |

The publisher headline challenge is deliberately reported separately. Proper names with no topic label, opaque article URLs and ambiguous phrasing still produce misses. Science and Sponsored have no positive examples in this small real-headline sample, so their real-world recall cannot be calculated from it. No names were scraped into a large opaque lookup list to make the sample pass. Rule scores are explainable evidence, not probabilities.

| Category | Controlled TP / positives | Controlled FP / negatives | Publisher challenge TP / positives |
| --- | ---: | ---: | ---: |
| celebrity | 6 / 6 | 0 / 4 | 2 / 2 |
| crime | 6 / 6 | 0 / 4 | 3 / 3 |
| tragedy | 6 / 6 | 0 / 4 | 0 / 1 |
| sexual | 6 / 6 | 0 / 4 | 1 / 1 |
| war | 6 / 6 | 0 / 4 | Not measured |
| disaster | 6 / 6 | 0 / 4 | 2 / 2 |
| politics | 6 / 6 | 0 / 4 | 3 / 5 |
| sport | 6 / 6 | 0 / 4 | 2 / 2 |
| entertainment | 6 / 6 | 0 / 4 | 3 / 4 |
| opinion | 6 / 6 | 0 / 4 | 1 / 1 |
| business | 6 / 6 | 0 / 4 | 1 / 2 |
| technology | 6 / 6 | 0 / 4 | 1 / 2 |
| science | 6 / 6 | 0 / 4 | Not measured |
| sponsored | 6 / 6 | 0 / 4 | Not measured |

Raw measurements and remaining misses are stored in `docs/validation-0.2.0/`. Do not tune only to these examples or describe their perfect controlled scores as general accuracy.

## E. Verification

| Check | Result |
| --- | --- |
| Portable/core automated tests | 64 passed |
| Browser automated tests | 72 passed, including enclosing suites; real DOM/MutationObserver/UI with a simulated WebExtension API |
| Overall `npm run check` | Passed: tests, strict TypeScript, build, browser suites and package audit |
| Controlled performance | 600-card feed discovered completely; timing recorded in `performance.json`; bounded under the 10-second test budget. Existing incremental-cache regression verifies one initial full scan and cached small updates. |
| Package audit | Passed: required MV3 files, version consistency, minimal unchanged permissions, portable core, native API isolation, no network APIs/remote assets/eval |
| Dependency audit | `npm audit` reported zero vulnerabilities after development-only esbuild 0.28.2 update |
| ZIP | Built from production dist, manifest at archive root; archive entries compared byte-for-byte with dist |
| Original artwork/archives/preferences | Source and packaged icon hashes/dimensions verified; prior downloads unchanged; preference schema/storage unchanged; all-field compatibility and UI persistence tests pass |
| Native MV3 smoke test | Blocked/inconclusive. Lightweight Chromium produced no service worker. Full Chrome for Testing 151.0.7922.34 failed to launch because process singleton socket creation is disallowed in this execution environment. No native pass is claimed. |
| Windows/Edge/Android | Not physically tested here; native installation/update and Lemur remain owner/manual checks |

The current continuation used lightweight Chromium 153.0.8010.0 with Playwright. Its native smoke test timed out waiting for an extension service worker. The full Chrome singleton-socket failure above belongs to the earlier checkpoint; it was not rerun. Website resource loading and access varied; 200 responses containing “Site Unavailable” are treated as failures.

## F. Next acceptance steps

1. Review PR #1 and the changed detection/classification boundaries.
2. Load the test ZIP in an appropriate Chrome/Edge profile. A separate unpacked extension is a separate identity and does not prove a same-identity store upgrade preserves settings.
3. Reproduce Stuff's owner-observed misses with fully loaded real cards; inspect the debug discovery/classification/decision evidence for a missed headline.
4. Broaden independent labelled publisher sampling, especially opaque URLs/proper names and Science/Sponsored, before describing classification as reliably complete.
5. Verify native toolbar display of the packaged authentic icon and the existing store/signing identity; complete installation and same-identity update checks.

Do not merge, publish or submit to the Chrome Web Store until the owner authorises it after review.
