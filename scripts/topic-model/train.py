"""Train FILTA's local topic model: one-vs-rest logistic regression on headline/summary n-grams.

Features mirror src/core/topic-model.ts exactly:
  normalise -> NFKC, lowercase, non letter/digit runs to spaces; all-digit tokens become "0".
  unigrams and bigrams; headline features have value 1, summary-only features 0.5.
Output: a compact JSON model with per-class bias, calibrated decision cut-offs and sparse quantised weights.
Usage: python train.py out_model.json [--max-wrong 0.01]
"""
import json, re, sys, unicodedata, random
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.linear_model import LogisticRegression

HERE = Path(__file__).resolve().parent
CLASSES = ['sport', 'business', 'technology', 'science', 'politics', 'entertainment', 'crime']
def opt(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
MAX_WRONG = opt('--max-wrong', 0.01)
QUANT = opt('--quant', 2); PENALTY = opt('--penalty', 'l1'); C = opt('--C', 0.5); MIN_COUNT = opt('--min-count', 3); FLOOR = opt('--floor', 0.25)
TOKEN = re.compile(r'[^\W_]+', re.UNICODE)

def tokens(text):
    text = unicodedata.normalize('NFKC', text or '').lower()
    return ['0' if t.isdigit() else t for t in TOKEN.findall(text)]

def grams(text):
    t = tokens(text)
    return set(t) | {f'{a} {b}' for a, b in zip(t, t[1:])}

def features(headline, description):
    h = grams(headline)
    d = grams(description) - h if description else set()
    return {**{f: 1.0 for f in h}, **{f: 0.5 for f in d}}

def load(name):
    return [json.loads(l) for l in open(HERE / name)]

train = [i for i in load('train.jsonl') if not ('--no-bbc' in sys.argv and i['set'] == 'bbc')]
# Optional extra section-labelled rows (e.g. New Zealand headlines), repeated --extra-weight times.
# Each row names the classes it informs in 'scope'; it is a negative for every other class in scope.
if '--extra' in sys.argv:
    extra = [json.loads(l) for l in open(sys.argv[sys.argv.index('--extra') + 1])]
    train += extra * opt('--extra-weight', 1)
random.seed(7)
random.shuffle(train)
# Each training story is seen as a bare headline and as a card with its summary.
examples = []
for item in train:
    examples.append((item, features(item['headline'], '')))
    if item.get('description'): examples.append((item, features(item['headline'], item['description'])))

counts = Counter(f for _, fs in examples for f in fs)
vocab = {f: i for i, f in enumerate(sorted(f for f, c in counts.items() if c >= MIN_COUNT))}
print('examples', len(examples), 'vocab', len(vocab))

def matrix(rows):
    data, ind, ptr = [], [], [0]
    for fs in rows:
        for f, v in fs.items():
            j = vocab.get(f)
            if j is not None: ind.append(j); data.append(v)
        ptr.append(len(ind))
    return csr_matrix((data, ind, ptr), shape=(len(rows), len(vocab)), dtype=np.float32)

X = matrix([fs for _, fs in examples])
in_scope = lambda item, c: c in item['scope'] or (c == 'science' and item['set'] == 'huff') or (c == 'technology' and 'technology' in item['scope'])
model = {'version': 1, 'classes': CLASSES, 'bias': [], 'cut': [], 'weights': defaultdict(dict)}
# Hold out the last 10% of stories to calibrate decision cut-offs.
n_valid = len(examples) // 10
for k, c in enumerate(CLASSES):
    rows = [i for i, (item, _) in enumerate(examples) if in_scope(item, c)]
    # Science overlaps technology in AG/BBC; only HuffPost separates them.
    if c == 'science': rows = [i for i in rows if examples[i][0]['set'] == 'huff']
    y = np.array([c in examples[i][0]['gold'] for i in rows], dtype=np.int8)
    train_rows = [r for r in rows if r >= n_valid]; valid_rows = [r for r in rows if r < n_valid]
    ytr = np.array([c in examples[i][0]['gold'] for i in train_rows]); yva = np.array([c in examples[i][0]['gold'] for i in valid_rows])
    clf = LogisticRegression(C=C, penalty=PENALTY, max_iter=400, solver='liblinear', class_weight='balanced')
    clf.fit(X[train_rows], ytr)
    margin = clf.decision_function(X[valid_rows])
    neg = np.sort(margin[~yva])
    cut = float(neg[int(len(neg) * (1 - MAX_WRONG))]) if len(neg) else 0.0
    recall = float((margin[yva] > cut).mean())
    print(f'{c:14} train={len(train_rows):6} pos={ytr.sum():6} valid-recall@{MAX_WRONG:.1%}wrong={recall:.3f} cut={cut:.2f}')
    model['bias'].append(round(float(clf.intercept_[0]), 3)); model['cut'].append(round(cut, 3))
    w = clf.coef_[0]
    for f, j in vocab.items():
        if abs(w[j]) >= FLOOR: model['weights'][f][k] = round(float(w[j]), QUANT)

# Compact form: feature -> "classIndex:weight,classIndex:weight".
compact = {f: ','.join(f'{k}:{v:g}' for k, v in sorted(ws.items())) for f, ws in model['weights'].items()}
# Optional per-class cut raise, e.g. --cut-adjust crime=1 (benign police stories sit just above the cut).
for spec in (sys.argv[sys.argv.index('--cut-adjust') + 1].split(',') if '--cut-adjust' in sys.argv else []):
    name, value = spec.split('='); model['cut'][CLASSES.index(name)] = round(model['cut'][CLASSES.index(name)] + float(value), 3)
out = {'version': 1, 'classes': CLASSES, 'bias': model['bias'], 'cut': model['cut'], 'weights': compact}
Path(sys.argv[1]).write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False, sort_keys=True))
print('features kept', len(compact), 'bytes', Path(sys.argv[1]).stat().st_size)

def predict(fs):
    s = list(out['bias'])
    for f, v in fs.items():
        ws = compact.get(f)
        if not ws: continue
        for part in ws.split(','):
            k, w = part.split(':'); s[int(k)] += v * float(w)
    return [c for c, x, cut in zip(CLASSES, s, out['cut']) if x > cut]
if '--eval' in sys.argv:
    with open(sys.argv[sys.argv.index('--eval') + 1], 'w') as f:
        for item in load('test.jsonl'):
            f.write(json.dumps({'headline': predict(features(item['headline'], '')), 'card': predict(features(item['headline'], item.get('description', '')))}) + '\n')
