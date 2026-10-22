"""Score hits.jsonl against test.jsonl. Usage: python score.py test.jsonl hits.jsonl [label]

Recall: share of gold stories for a category that the classifier flags.
Wrong-hit rate: share of in-scope stories NOT in that category that get flagged anyway.
technology/science are merged (datasets disagree on the boundary); celebrity counts as entertainment.
"""
import json, sys
from collections import defaultdict
GROUP = {'science': 'technology', 'celebrity': 'entertainment'}
g = lambda c: GROUP.get(c, c)
tests = [json.loads(l) for l in open(sys.argv[1])]
hits = [json.loads(l) for l in open(sys.argv[2])]
label = sys.argv[3] if len(sys.argv) > 3 else ''
stats = defaultdict(lambda: [0, 0, 0, 0])  # pos, tp, neg, fp
for item, hit in zip(tests, hits):
    gold = {g(c) for c in item['gold']}
    for mode in ('headline', 'card'):
        flagged = {g(c) for c in hit[mode]}
        for cat in {g(c) for c in item['scope']}:
            s = stats[(item['set'], mode, cat)]
            if cat in gold:
                s[0] += 1; s[1] += cat in flagged
            else:
                s[2] += 1; s[3] += cat in flagged
summary = {}
print(f'{label:>10} {"set":5} {"mode":8} {"category":14} {"recall%":>8} {"wrong%":>7} {"n+":>6} {"n-":>6}')
for (st, mode, cat), (pos, tp, neg, fp) in sorted(stats.items()):
    r = 100 * tp / pos if pos else float('nan'); w = 100 * fp / neg if neg else float('nan')
    summary[f'{st}/{mode}/{cat}'] = {'recall': round(r, 1), 'wrong': round(w, 2), 'positives': pos, 'negatives': neg}
    print(f'{label:>10} {st:5} {mode:8} {cat:14} {r:8.1f} {w:7.2f} {pos:6} {neg:6}')
# Macro averages per mode across set/category pairs.
for mode in ('headline', 'card'):
    vals = [v for k, v in summary.items() if f'/{mode}/' in k]
    print(f'{label:>10} MACRO {mode:8} recall {sum(v["recall"] for v in vals)/len(vals):.1f}%  wrong {sum(v["wrong"] for v in vals)/len(vals):.2f}%')
if len(sys.argv) > 4: json.dump(summary, open(sys.argv[4], 'w'), indent=1)
