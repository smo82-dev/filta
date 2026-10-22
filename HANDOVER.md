# FILTA 0.2.0 development 3 handover

- Branch `claude/news-site-reliability`, based on PR #1 head `6bf8330`. Not merged; no publication.
- Diagnosis, changes, benchmark and limits: `docs/validation-0.2.0/DEV3.md`; raw before/after in `dev3/topic-benchmark.json`.
- Topic model: `src/core/topic-model.ts` + `src/core/rules/topic-model.txt`; retrain with `scripts/topic-model/` (prepare.py, train.py `--C 0.25 --floor 0.1 --quant 1 --min-count 4 --no-bbc`, score.py). Datasets are not committed.
- Shadow DOM: `openShadowRoots`, `composedClosest`, `composedParent` and host promotion in `src/content/detectors/generic.ts`; the scanner observes shadow roots and rescans from the host.
- Native ads (`commercialDisclosure` in generic.ts), closed shadow roots (`useShadowRootResolver`, `platform.shadowRoot`), per-scan memoisation (`withStyleCache`/`scanCache` in labels.ts).
- Weak war model: `scripts/topic-model/train_weak.py ship.json out.json --classes war` (cue words masked); hand-labelled evaluation: `hand_sample.py` + `docs/validation-0.2.0/dev3/hand-labels-*.txt`.
- Native tests run here: `node --test tests/native.test.mjs` (full Chromium with --load-extension).
- Open decision: training-data licences before a store release (see DEV3.md, THIRD_PARTY_NOTICES.md).
- Previous handover (development 2): `docs/validation-0.2.0/DEV2.md`.
