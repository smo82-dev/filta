# FILTA 0.2.0 development 3 handover

- Branch `claude/news-site-reliability`, based on PR #1 head `6bf8330`. Not merged; no publication.
- Diagnosis, changes, benchmark and limits: `docs/validation-0.2.0/DEV3.md`; raw before/after in `dev3/topic-benchmark.json`.
- Topic model: `src/core/topic-model.ts` + `src/core/rules/topic-model.txt`; retrain with `scripts/topic-model/` (prepare.py, train.py `--C 0.25 --floor 0.1 --quant 1 --min-count 4 --no-bbc`, score.py). Datasets are not committed.
- Shadow DOM: `openShadowRoots`, `composedClosest`, `composedParent` and host promotion in `src/content/detectors/generic.ts`; the scanner observes shadow roots and rescans from the host.
- Open decision: training-data licences before a store release (see DEV3.md).
- Previous handover (development 2): `docs/validation-0.2.0/DEV2.md`.
