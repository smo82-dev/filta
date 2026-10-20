# FILTA 0.2.0 — owner test build

Take control of your news feed.

This branch improves article discovery, topic evidence and dynamic updates across all fourteen existing categories. It remains a local-first Manifest V3 extension with the same permissions and preference schema. No topic is selected automatically.

## Changed

- Find plain linked compact cards, accessible headings, overlay cards, repeated tiles and complete linked-card boundaries.
- Keep compound collections, reading bodies, navigation, consent UI, author links and promotional widgets protected.
- Retain adapter metadata when generic discovery selects the same card or its complete outer wrapper.
- Read bounded card-local microdata and exact-URL-linked NewsArticle JSON-LD; never apply page-level metadata to unrelated stories.
- Recognise explicit publisher taxonomy across all categories, and add explainable contextual combinations and negative-context safeguards.
- Cache normalised classifier rules and discovery work; preserve original card styles and rule precedence.
- Handle Navigation API route changes, recycled URLs, badge mutations and detached cards; retain Show story for the same story after metadata changes.
- Show a short popup explanation when an eligible page yields no stories. Deeper stage counts remain debug-only and in memory.
- Use FILTA and the approved tagline. Existing CSS, artwork inputs and previous installation archives are preserved.
- Align manifest/package/lock versions and update the development-only esbuild dependency to the audited patch release.

## Owner testing and release gates

Extract `news-filter-0.2.0.zip`, then load its folder using Chrome or Edge's **Load unpacked** control. Use a separate browser profile for a parallel preview of the published extension. A separately loaded unpacked extension can have a different ID and separate preferences; this is not a same-identity Chrome Store update.

Check several selected and unselected topics, always-show exceptions, Hide/Collapse, scrolling, navigation, normal article reading and restoring a story. Repeat on Stuff, RNZ, BBC and other sites you use. Record a missed headline, its URL, the chosen category and whether it appears in debug story review.

Native Chrome/Edge installation and same-identity update behaviour remain unverified because the full browser could not launch under this environment's socket restrictions. Stuff's mixed filtering report could not be reproduced here because its homepage rendered loading placeholders. The repository and prior archives contain no original logo image or manifest icon entries; verify the published package's artwork and signing identity before any store submission. No replacement artwork or signing key has been created.

The deterministic fixture results are strong regression evidence, not a real-world accuracy guarantee. A separate publisher headline challenge records remaining misses. Keep PR #1 draft and unmerged pending independent review and owner acceptance. Do not submit this build to the Chrome Web Store yet.
