# FILTA 0.2.0 — owner test build

Take control of your news feed.

This branch improves article discovery, topic evidence and dynamic updates across all fourteen existing categories. It remains a local-first Manifest V3 extension with the same permissions and preference schema. No topic is selected automatically.

## Development 3

- Add a local learned topic model for sport, business, technology, science, politics, entertainment and crime. On 14,041 held-out labelled headlines, stories caught in their topic rise from about 11% to 52% (headline only) and 68% (with summary). Explanations show the phrases used. Nothing leaves the browser.
- Find and filter stories inside open shadow DOM web components (for example MSN), hiding the complete component.
- Treat sites that declare standard news-publisher markup as news sites, even when their name never says "news".
- Add NZ/UK/AU political vocabulary, with Labour Weekend and national park exceptions.
- See `docs/validation-0.2.0/DEV3.md` for evidence, limits and the training-data licence decision.

## Changed

- Find plain linked compact cards, accessible headings, overlay cards, repeated tiles and complete linked-card boundaries.
- Keep compound collections, reading bodies, navigation, consent UI, author links and promotional widgets protected.
- Retain adapter metadata when generic discovery selects the same card or its complete outer wrapper.
- Read bounded card-local microdata and exact-URL-linked NewsArticle JSON-LD; never apply page-level metadata to unrelated stories.
- Recognise explicit publisher taxonomy across all categories, and add explainable contextual combinations and negative-context safeguards.
- Cache normalised classifier rules and discovery work; preserve original card styles and rule precedence.
- Handle Navigation API route changes, recycled URLs, badge mutations and detached cards; retain Show story for the same story after metadata changes.
- Show a short popup explanation when an eligible page yields no stories. Deeper stage counts remain debug-only and in memory.
- Restore the authentic FILTA gradient logo throughout the manifest, toolbar popup, settings and setup. Source artwork is preserved byte-for-byte in `branding/`.
- Add connected three-step onboarding and a five-section settings hub, with accessible topic cards and explicit save/retry feedback. Returning users retain all preferences and skip setup.
- Refine the popup around current-site status, filtered count, pause/resume, story review and Manage FILTA.
- Fix the owner’s three BBC misses with explainable contextual classification; allow combinations to use the same card’s headline and summary across categories. No page-wide topic forcing.
- Add automated accessibility, onboarding, returning-user, failed-save and BBC DOM/presentation regressions, plus review screenshots.
- Align manifest/package/lock versions and update the development-only esbuild dependency to the audited patch release.

## Owner testing and release gates

Extract `FILTA-0.2.0-development.zip` (or the `news-filter-0.2.0.zip` produced by `npm run package`), then load its folder using Chrome or Edge's **Load unpacked** control. Use a separate browser profile for a parallel preview of the published extension. A separately loaded unpacked extension can have a different ID and separate preferences; this is not a same-identity Chrome Store update.

Check several selected and unselected topics, always-show exceptions, Hide/Collapse, scrolling, navigation, normal article reading and restoring a story. Repeat on Stuff, RNZ, BBC and other sites you use. Record a missed headline, its URL, the chosen category and whether it appears in debug story review.

Native Chrome/Edge installation and same-identity update behaviour remain unverified because the full browser could not launch under this environment's socket restrictions. Stuff's mixed filtering report could not be reproduced here because its homepage rendered loading placeholders. Original artwork is now included and its packaged bytes and dimensions are verified. Native toolbar rendering and same-identity store upgrades remain manual acceptance gates. No signing key or new store identity has been created. Live browser validation was stopped by automatic approval review when publisher scripts attempted third-party telemetry; captured-source replays with external requests blocked are recorded separately.

The deterministic fixture results are strong regression evidence, not a real-world accuracy guarantee. A separate publisher headline challenge records remaining misses. Keep PR #1 draft and unmerged pending independent review and owner acceptance. Do not submit this build to the Chrome Web Store yet.
