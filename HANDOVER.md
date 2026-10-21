# FILTA 0.2.0 handover

- Existing branch `feature/filta-0.2-universal-detection`, PR #1; leave draft, open and unmerged. No Chrome Store publication.
- Connected three-step setup, five-section settings hub and streamlined site popup implemented. Existing `configured` flag skips setup for returning users. Replay/cancel and edited-field patches preserve all stored lists; no new schema/key/permissions.
- Authentic source artwork is in `branding/`; packaged icon/logo hashes and PNG dimensions are audited. No artwork regeneration or signing changes.
- Three BBC owner misses are confirmed classification failures on captured current publisher markup, fixed and tested through actual renderer decisions. Exact-card headline/summary combinations now work across category definitions. No page-level Entertainment forcing.
- Fresh validation: `npm run check` passed (64 core + 72 browser tests), `npm run package`, zero-vulnerability `npm audit`, ZIP/dist byte comparison. Browser suites use a simulated WebExtension API, not native MV3. Axe runs from a development-only dependency.
- Evidence and screenshots: `docs/validation-0.2.0/UX-AND-BBC.md`. Prefer this and changed source over rereading old captures.
- Open gates: native toolbar/install and same-identity upgrade; Stuff with loaded cards; broader independent classification accuracy. Lightweight Chromium native test exposed no worker. Live browser validation was stopped for publisher third-party telemetry; use network-blocked source replays until an approved live-test method is available.
- Reproduce: `npm ci`, `npx playwright install chromium`, `npm run check`, `npm run package`; optionally set `CHROMIUM_PATH` for an available compatible browser. Native `npm run test:extension` requires an extension-capable desktop build.
