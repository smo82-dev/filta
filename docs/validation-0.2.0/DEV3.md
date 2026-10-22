# FILTA 0.2.0 development 3 — why news sites failed, and what changed

## Diagnosis

Three independent causes, measured rather than assumed:

1. **Classification recall was the main failure.** On 14,041 held-out, publicly labelled headlines (AG News test split, BBC News, HuffPost 2018), the rule keywords flagged only **10.5%** of stories in their own topic from the headline, **11.9%** with the card summary. Typical misses: *"Cabrera Leads Red Sox Past Blue Jays 5-4"*, *"Kiwi dollar slides as Reserve Bank signals more cuts"*. No keyword list can enumerate these. Live NZ front pages (Stuff, NZ Herald) expose no section or label metadata on most cards, so the headline is usually all FILTA has.
2. **Web-component feeds were invisible.** On msn.com/en-nz every story lives inside open shadow roots (427 components, 0 light-DOM links). FILTA detected 0 stories.
3. **Eligibility relied on the word "news".** Unlisted publishers whose domain, title and site name never say *news* were skipped entirely.

Discovery on conventional pages was already good: live Stuff and NZ Herald front pages covered 95% and 100% of visible headline links (misses were quiz/topic landing pages).

## Changes

- **Local learned topic model** (`src/core/topic-model.ts`, `src/core/rules/topic-model.txt`, 613 KB, parsed lazily on first classification). One-vs-rest logistic regression over headline/summary words and word pairs for sport, business, technology, science, politics, entertainment and crime. Only a calibrated, confident prediction counts, and it weighs exactly one decisive term; contextual exceptions, always-show, pause, emergency information and every existing rule still apply. Explanations show the phrases that drove it (e.g. *Topic model: sox, jays, blue jays*). Nothing is fetched or sent.
- Science outranks technology when the model reads a story as both (part of the training data merges them).
- Westminster-system politics vocabulary (NZ/UK/AU parties, MPs, ministers, Beehive, select committee…) with *Labour Weekend*, *Labour Day*, *labour market*, *national park/team* exceptions. The model is US-centric here.
- **Open shadow DOM discovery** for detection, protection and observation. A component whose shadow root holds exactly one story is filtered as a whole (the host), so grids close up. Custom elements named as headers, footers, navigation, menus, banners or consent stay protected.
- **Publisher-markup eligibility**: schema.org NewsMediaOrganization/NewsArticle family, `news_keywords`, `googlebot-news`, `syndication-source`. Shops and apps stay ineligible.
- **Native ads as sponsored**: ad-network click/redirect endpoints (Taboola, Outbrain, DoubleClick, Bing native-ad mediation…), paid `utm` tracking, native-ad widget containers around a tile, and a card element whose whole text is a disclosure ("Sponsored", "Paid Content", "Ad"). The publisher's own wording is recorded as the label. A card's own id/class never counts as a widget.
- **Closed shadow roots** through `chrome.dom.openOrClosedShadowRoot`, provided by the platform layer (chrome.* stays confined to `platform/chromium.ts`).
- **War, tragedy, disaster, celebrity**: broader vocabulary and inflections (insurgents, militia, car bomb, terror plot; kills, massacre, death toll; quake, typhoon, landslide; Kardashian, red carpet), casualty/attack/storm-impact combinations, and figurative exceptions (*trade war*, *dead heat*, *Game of Thrones* death, *deaths fall*). A **weakly supervised war model** learns conflict context with the cue words hidden during training. Celebrity uses learned entertainment evidence when the story is about a person rather than a work (no film/show/album/chart words, not led by a quoted title, not topical late-night comedy, not politics), or comes with a personal-life cue (baby, split, engaged, tattoo, feud…).
- NZ/AU sport names (Super Rugby, Black Ferns, Bledisloe, America's Cup, A-League…); club names that are ordinary words (Blues, Chiefs, Hurricanes, Phoenix) count only beside sporting language.
- **Faster discovery**: per-scan memoisation of element markers, protection chains, visibility, headline-link checks and URL parsing.

## Evidence

Benchmark (`dev3/topic-benchmark.json`). The training scripts are in `scripts/topic-model/`. BBC data was **not** used for training (copyright, research-only), so the BBC rows are fully independent.

| Macro average | Before recall | After recall | Before wrong | After wrong |
| --- | --- | --- | --- | --- |
| Headline only | 10.5% | **52.6%** | 0.49% | 1.54% |
| Headline + summary | 11.9% | **68.0%** | 0.54% | 1.69% |

BBC (independent, card): sport 4% → 94%, technology 8% → 79%, entertainment 26% → 73%, business 12% → 61%, politics 8% → 31%. The datasets give each story one label, so many "wrong" hits are really multi-topic stories (*"Harvey Weinstein Turns Himself In To Police"* is labelled entertainment but is crime; *"Oil prices bubble to record high"* is labelled world/tech but is business).

Real 2026 headline challenge (unchanged 28 cases): 19 TP / 0 FP / 6 FN → **22 TP / 1 FP / 3 FN**. The new false positive is *"Labour weekend scorcher… as sporting events attract thousands"* (sport).

Live browser probes (owner's Chrome, 22 Oct 2026, detection only, no filtering):
- MSN en-nz: 0 → 28 stories (86% of visible headline links; misses are live score tickers and weather); after scrolling, 69 stories of which exactly the 4 `nativead-*` tiles are sponsored.
- Stuff front page: 131 stories, 9 sponsored cards caught by their own "Sponsored" label; **full scan 1.12 s → 0.47 s** (old and new code timed on the same page, same 131 stories). A profile showed ~360,000 attribute reads per scan before memoisation.

**War, tragedy, disaster, celebrity** (no public dataset labels these). Two samples of held-out headlines (AG News test "World" + HuffPost 2018 news sections) were hand-labelled by Claude; labels in `dev3/hand-labels-*.txt`, samples regenerated by `scripts/topic-model/hand_sample.py`. The first sample informed the vocabulary, so the **fresh sample (400 headlines, drawn afterwards)** is the unbiased figure:

| Fresh sample | Before (recall) | After (recall) | After (precision) |
| --- | --- | --- | --- |
| War & Conflict (59) | 8% | **56%** | 80% |
| Death & Tragedy (33) | 42% | **70%** | 92% |
| Disaster (9) | 22% | **44%** | 80% |
| Celebrity & Gossip (37) | 3% | **49%** | 75% |

A weak tragedy model and a weak celebrity model were also tried and rejected (tragedy: +6 points recall for −18 points precision; celebrity: 14% recall at 64% precision). The person-focus celebrity rule was tuned on the first sample only (31% → 51% at 93% precision) and then checked once on the fresh sample.

**Today's headlines (live, 23 October 2026).** Headline and URL as FILTA sees them were collected in the owner's Chrome and hand-labelled across all topics (Claude's judgement; the headlines are not committed). Precision is over all topic decisions.

| Live front pages | Headlines | Version | Recall | Precision |
| --- | --- | --- | --- | --- |
| Stuff, NZ Herald, RNZ (tuning) | 193 | PR #1 → dev3 → dev3 + live fixes | 52% → 64% → 76% | 83% → 80% → 82% |
| 1News, BBC, Guardian (validation) | 137 | PR #1 → dev3 → dev3 + live fixes | 25% → 43% → **45%** | 85% → 75% → **76%** |

The 45% validation figure is unbiased. Three gaps it exposed were then fixed (Guardian `commentisfree` and "Analysis:" leads for Opinion; rape/sexual-abuse vocabulary for Sexual Content; election-poll language), lifting that set to 53% at 78% precision; that number is no longer independent. Fixes from the live tuning set: qualified publisher sections (`politics_election-2026`, `crime-and-justice`, `sponsored-stories`, `nz-politics`; combined sections such as `science-and-technology` decide neither topic; long slugs never count), attacks near current conflict zones, robots/hacking/AI/video-game vocabulary, "body found", and "Cold War" as history. NZ Herald's `sponsored-stories` cards were missed before and are caught now. Earlier benchmarks are unchanged (14,041 headlines 52.9% / 68.2%; fresh hand-labelled sample as above).

**Newer training data.** The shipped model is trained on HuffPost News Category v3 (2012–2022) plus AG News, excluding January–May 2018 so every comparison above stays held out. Validating the procedure on the newest year (trained to June 2021, tested July 2021 – September 2022): headline-only macro recall 46.6% → 50.1%, wrong hits 1.31% → 1.20% (sport 75% → 78%, entertainment 50% → 55%, technology 35% → 65%). The crime cut-off is raised by 1 so benign police stories ("Police volunteer at a village clean up") are not crime; crime headline recall on HuffPost 2018 is 59% (rules alone: 13%).

Native MV3 smoke test: the packaged ZIP loaded unpacked in full Chromium (Playwright 1.56, `--load-extension`), with a real service worker and `chrome.storage`. With Sport selected, *"Warriors lock down star hooker…"* and *"Cabrera Leads Red Sox…"* collapsed (neither contains a sport keyword); the recipe card stayed visible. This is not the Chrome toolbar or a same-identity store upgrade.

Python training features and the TypeScript runtime agree on 28,082 of 28,082 test predictions.

Tests: 75 core, **122 of 122 browser** and 2 of 2 **native** tests passing. New suites: shadow DOM (host filtering, late cards, header protection, Show story, pause), publisher-markup eligibility, native ads, closed shadow roots (real extension in Chromium; fails with the resolver disabled), topic model and the four expanded categories. The existing native install test, which earlier environments could not run, passes here. One existing expectation changed on purpose: an unmarked card element reading exactly "Sponsored" is now a label (`sponsored.test.mjs`, *incidental*), because live Stuff marks sponsored cards that way. The accessibility suites (`ui`, `popup-layout`) ran through a local stand-in for `@axe-core/playwright` using axe-core 3.3.2 vendored in Chromium DevTools, because the npm registry is unreachable here; that axe version has fewer WCAG 2.2 rules than the pinned 4.11. The package audit passes.

## Limits and open decisions

- **Training-data licences — decide before any store release.** Credits are in `THIRD_PARTY_NOTICES.md`, shipped in the extension as `THIRD_PARTY_NOTICES.txt`. HuffPost is CC BY 4.0 (credit given). AG News carries research/non-commercial terms: for a paid or commercial release confirm them or retrain without AG News.
- Celebrity (~49%) and disaster (~44%) remain the weakest topics. Gossip headlines often name a person the model has never seen. Sexual content, opinion and sponsored remain rule/label based.
- Training headlines date from 2004–2022 and are mostly US-centric. Recall on NZ politics and new names will be lower than the benchmark.
- Cross-origin iframes (some third-party ad widgets) remain out of reach. In the owner's browser the Stuff Taboola panel was empty and no ad iframes loaded, so live Taboola/Outbrain tiles were not observed; that path is covered by controlled tests only.
- The hand labels are one annotator's judgement, not an independent panel.
- The model adds about 0.7 MB to `content.js` (ZIP 285 KB).

ZIP: `news-filter-0.2.0.zip` from `npm run package`, version_name `0.2.0 development 3`, 16 entries identical to `dist/`.
