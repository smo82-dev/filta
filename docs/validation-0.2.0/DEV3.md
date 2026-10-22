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
- Per-scan cache of element visibility in discovery (no change in results; speed effect not measured on live pages).

## Evidence

Benchmark (`dev3/topic-benchmark.json`). The training scripts are in `scripts/topic-model/`. BBC data was **not** used for training (copyright, research-only), so the BBC rows are fully independent.

| Macro average | Before recall | After recall | Before wrong | After wrong |
| --- | --- | --- | --- | --- |
| Headline only | 10.5% | **52.2%** | 0.49% | 1.59% |
| Headline + summary | 11.9% | **67.9%** | 0.54% | 1.69% |

BBC (independent, card): sport 4% → 94%, technology 8% → 79%, entertainment 26% → 73%, business 12% → 61%, politics 8% → 31%. The datasets give each story one label, so many "wrong" hits are really multi-topic stories (*"Harvey Weinstein Turns Himself In To Police"* is labelled entertainment but is crime; *"Oil prices bubble to record high"* is labelled world/tech but is business).

Real 2026 headline challenge (unchanged 28 cases): 19 TP / 0 FP / 6 FN → **21 TP / 1 FP / 4 FN**. The new false positive is *"Labour weekend scorcher… as sporting events attract thousands"* (sport).

Live browser probes (owner's Chrome, 22 Oct 2026, detection only, no filtering): MSN 0 → 28 stories (86% of visible headline links; misses are live score tickers and weather).

Native MV3 smoke test: the packaged ZIP loaded unpacked in full Chromium (Playwright 1.56, `--load-extension`), with a real service worker and `chrome.storage`. With Sport selected, *"Warriors lock down star hooker…"* and *"Cabrera Leads Red Sox…"* collapsed (neither contains a sport keyword); the recipe card stayed visible. This is not the Chrome toolbar or a same-identity store upgrade.

Python training features and the TypeScript runtime agree on 28,082 of 28,082 test predictions.

Tests: 71 core (6 new topic-model tests) and 104 of 106 browser tests passing, including a new shadow-DOM suite (host filtering, late cards, header protection, Show story, pause) and publisher-markup eligibility. Both fail on the previous build. The 2 remaining browser files (`ui`, `popup-layout`) could not run here because `@axe-core/playwright` could not be installed; their code is unchanged. The package audit passes.

## Limits and open decisions

- **Training-data licences — decide before any store release.** The model was trained on the HuffPost News Category Dataset (Misra, CC BY 4.0) and AG News (academic, non-commercial terms). For a public or commercial release, confirm AG News terms or retrain on HuffPost alone (`train.py` with only HuffPost rows), and credit HuffPost per CC BY.
- No model for celebrity, tragedy, war, disaster, sexual content, opinion or sponsored; these remain rule based. Sponsored and opinion are label-driven, which suits rules.
- Training headlines date from 2004–2018 and are mostly US-centric. Recall on NZ politics and new names will be lower than the benchmark.
- Closed shadow roots and cross-origin iframes (most third-party native-ad widgets) remain out of reach.
- The model adds about 0.6 MB to `content.js` (ZIP 246 KB).

ZIP: `news-filter-0.2.0.zip` from `npm run package`, version_name `0.2.0 development 3`, 15 entries identical to `dist/`.
