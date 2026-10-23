# FILTA 0.2.0 — approved UX implementation map

Status: connected UI, branding and BBC regression implementation completed. Automated and visual evidence: [UX-AND-BBC.md](validation-0.2.0/UX-AND-BBC.md). Native installation/toolbar rendering, same-identity upgrade and Stuff live acceptance remain open.

## Preserve first
Keep the existing Manifest V3 extension identity, permissions, `GET_PREFS`, `PATCH_PREFS`, `SET_SITE`, `PAGE_STATUS`, `OPEN_REVIEW`, `Preferences` category IDs, storage key and rule precedence. Use the owner-provided original image files, not substitutes. Never reset configured users when adding an onboarding-completed marker. `configured` already denotes existing completion; distinguish explicit "Run setup again" UI state without wiping selected topics.

## Screen map
1. **Welcome / My Topics:** original logo + tagline; 14 accessible category cards reflecting saved selections. None preselected for new users. Back/Next.
2. **Filtering behaviour:** Collapse (recoverable inline) or Hide (fully removed) with clear short examples. Optional phrase controls collapsed behind "Add my own phrases". Back/Next.
3. **Ready to FILTA:** concise review of selected topics, behaviour, privacy, no account required. Save/start. Robust pending, success, error states; do not mark completion on failed persistence.
4. **Returning settings hub:** My Topics; How FILTA Filters; My Exceptions; Website Controls; Advanced Settings & Diagnostics. Clear save feedback; explicit rerun onboarding preserving existing settings.
5. **Toolbar popup:** authentic icon, product name, current host/eligibility, actual per-page filtered count, site pause/resume, View filtered stories, Manage FILTA. Advanced controls stay in settings. Keep accurate explanations for unsupported pages.

## Visual/accessibility rules
Use actual `branding/original-fullsize-logo-1254.png` and approved `icon-{16,32,48,128}.png`; manifest `icons` and `action.default_icon` must point to packaged files. Accessible names, focus-visible, status live regions, roughly 44px control targets, 4.5:1 normal-text contrast, keyboard sequencing, zoom, narrow-popup layout and reduced-motion support. Screen captures: onboarding 1–3, returning hub, popup active/paused and popup empty/unsupported.

## Filtering investigations
Use the BBC owner examples ("Rivals producer wants 'bonkbuster' shows to 'keep going forever'"; "Apu returns to The Simpsons with new voice after race row"; "Selena Gomez says vaping has affected her voice") as traceable test cases. For each inspect discovery, exact extracted card fields, scores/category, override precedence and actual presentation. Avoid classifying entire section as Entertainment. Extend fixtures across all fourteen categories; include Stuff.co.nz live-loaded pages, and label unavailable live checks as unverified.

## Acceptance
Run `npm run check`, `npm run package`, `npm audit`, packaging icon hash/size checks, onboarding and preference migration tests, keyboard/accessibility checks, and native installation if environment supports Chrome/Edge. Confirm store identity across upgrades; never publish or merge. Summarise actual evidence and failures rather than asserting general compatibility.
