# FILTA 0.2.0 handover

- Branch: `feature/filta-0.2-universal-detection`; existing PR #1. Keep draft/open; never merge or publish without owner approval.
- Goal: systemic detection/filter reliability across all 14 topics. Sport is an example only. Stuff is the priority owner-reported case.
- Read `RELEASE_NOTES.md`, `VALIDATION.md`, and `docs/validation-0.2.0/COMPATIBILITY.md` before continuing. Current repository state is authoritative.
- New sources: exact-story structured metadata; safe generic linked/overlay/repeated cards; publisher metadata retained at deduplication; compiled local rules and taxonomy; lifecycle and diagnostics improvements.
- Verification: `CHROMIUM_PATH=/path/to/chromium npm run check`; `npm run package`; `npm audit`. Native `test:extension` requires a full extension-capable browser on an unrestricted desktop.
- Evidence: controlled structure/category tests, publisher source snippets and browser pipeline checks are distinct. Do not present synthetic or sampled-card results as publisher-wide accuracy.
- Open gates: reproduce Stuff misses with actual loaded cards; independently check real classification recall; native Chrome/Edge install/update; verify original published logo/icon/signing inputs, which are absent from this repository.
- Reuse existing evidence; rerun only checks affected by a change. Avoid rescanning publishers merely to restate completed results. Public page captures remain in ignored scratch/test-results, not in extension code.
