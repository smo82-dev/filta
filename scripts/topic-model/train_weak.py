"""Weakly supervised topic models for categories no public dataset labels (war, tragedy).

High-precision labelling functions mark training-period headlines/summaries (AG News train,
HuffPost 2012-2017; no BBC). A logistic regression then learns the vocabulary that travels with
them. Features are identical to train.py / src/core/topic-model.ts. The resulting classes are
merged into an existing compact model file.
Usage: python train_weak.py base_model.json out_model.json [--max-wrong 0.01] [--eval sample.json]
"""
import csv, json, re, sys, unicodedata, random
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.linear_model import LogisticRegression

HERE = Path(__file__).resolve().parent
DATA = Path(sys.argv[sys.argv.index('--data') + 1]) if '--data' in sys.argv else HERE.parent / 'data'
TOKEN = re.compile(r'[^\W_]+', re.UNICODE)
def opt(name, default): return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
MAX_WRONG = opt('--max-wrong', 0.01)
CLASSES_TO_TRAIN = opt('--classes', 'war,tragedy').split(',')

def tokens(text):
    text = unicodedata.normalize('NFKC', text or '').lower()
    return ['0' if t.isdigit() else t for t in TOKEN.findall(text)]
def grams(text):
    t = tokens(text); return set(t) | {f'{a} {b}' for a, b in zip(t, t[1:])}
def features(h, d):
    hg = grams(h); dg = grams(d) - hg if d else set()
    return {**{f: 1.0 for f in hg}, **{f: 0.5 for f in dg}}

# Labelling functions: decisive cue phrases, with figurative/neutral contexts that veto them.
CUES = {
    'celebrity': r'\b(?:baby|babies|pregnant|pregnancy|engaged|engagement|wedding|married|divorce|divorcing|split|splits|breakup|dating|romance|boyfriend|girlfriend|husband|hubby|wife|son|daughter|mom|dad|birthday|instagram|selfie|tattoo|outfit|hairstyle|shirtless|bikini|red carpet|feud|slams|claps back|shade|kiss|apologizes|sues|sued|arrested|meme|love|single|ex)\b',
    'war': r'\b(?:war|wars|warfare|troops|soldiers?|army|armed forces|military offensive|militants?|insurgents?|insurgency|rebels?|rebel forces|militia|militias|air ?strikes?|airstrikes?|missile strikes?|shelling|artillery|car bomb|suicide bomb(?:er|ing)|bombings?|ceasefire|truce|invasion|invaded|occupation forces|taliban|al[- ]qaeda|isis|islamic state|hezbollah|hamas|jihadists?|gunmen|hostages?|kidnapped|abducted|insurgent|peacekeepers|marines|warplanes|fighter jets|drone strikes?|front ?line|battlefield|guerrillas?|coup)\b',
    'tragedy': r'\b(?:killed|kills|killing|dead|dies|died|death|deaths|deadly|fatal|fatally|fatalities|murdered|murder|massacre|slain|funeral|mourns?|mourning|death toll|bodies|body found|drowned|drowning|perished|lost (?:his|her) life|passed away|obituary|suicide|shot dead|stabbed to death)\b',
}
VETO = {
    'celebrity': r'\b(?:box office|trailer|season finale|premiere date|review)\b',
    'war': r'\b(?:war on|trade war|price war|culture war|war of words|star wars|bidding war|turf war|console wars?|format war|browser wars?|war chest|warcraft|war room|army of|tory|soldier on|hostage to|coup de)\b',
    'tragedy': r'\b(?:dead heat|deadline|dead end|killer app|kills? (?:it|bill|deal|plan|proposal|feature)|death of the|deadly serious|to die for|die hard|walking dead|grateful dead|dead or alive|killing it|murder mystery|death metal|death star)\b',
}
def weak(text, cat, source=None):
    t = text.lower()
    # Gossip needs an entertainment story about a person's life; cues alone are too broad.
    if cat == 'celebrity' and source != 'ENTERTAINMENT': return False
    return bool(re.search(CUES[cat], t)) and not re.search(VETO[cat], t)

rows = []
for label, title, desc in csv.reader(open(DATA / 'ag/data/ag_news_csv/train.csv', newline='', encoding='utf8')):
    clean = lambda s: re.sub(r'\s+', ' ', s.replace('\\', ' ').replace('#39;', "'").replace(' #36;', ' $')).strip()
    rows.append((re.sub(r'\s*\([A-Za-z.]+\)$', '', clean(title)), re.sub(r'^[A-Za-z.]+(?:\.com)? - ', '', clean(desc))[:300], 'AG' + label))
for line in open(DATA / 'h_Noticias_PeakU/News_Category_Dataset_v2.json', encoding='utf8'):
    d = json.loads(line)
    if d['date'] < '2018-01-01' and len(d['headline']) > 12: rows.append((d['headline'], d['short_description'][:300], d['category']))
random.seed(5); random.shuffle(rows)

examples = []
for h, d, cat in rows:
    examples.append(((h, '', cat), features(h, '')))
    if d: examples.append(((h, d, cat), features(h, d)))
counts = Counter(f for _, fs in examples for f in fs)
vocab = {f: i for i, f in enumerate(sorted(f for f, c in counts.items() if c >= 4))}
def matrix(fss):
    data, ind, ptr = [], [], [0]
    for fs in fss:
        for f, v in fs.items():
            j = vocab.get(f)
            if j is not None: ind.append(j); data.append(v)
        ptr.append(len(ind))
    return csr_matrix((data, ind, ptr), shape=(len(fss), len(vocab)), dtype=np.float32)
X = matrix([fs for _, fs in examples])
base = json.loads(Path(sys.argv[1]).read_text())
classes, bias, cut, weights = list(base['classes']), list(base['bias']), list(base['cut']), dict(base['weights'])
n_valid = len(examples) // 10
for cat in CLASSES_TO_TRAIN:
    # The label uses the full text the example shows (headline, or headline + summary).
    y = np.array([weak(h + ' ' + d, cat, src) for (h, d, src), _ in examples])
    # Hide the cue words themselves, so the model must learn the context that travels with
    # them (places, actors, verbs). Rules still catch the cue words at runtime.
    cue = re.compile(CUES[cat]); veto = re.compile(VETO[cat])
    masked = np.array([j for f, j in vocab.items() if not cue.search(f) and not veto.search(f)])
    mask = np.zeros(len(vocab), dtype=np.float32); mask[masked] = 1
    Xm = X.multiply(mask).tocsr()
    clf = LogisticRegression(C=0.25, penalty='l1', solver='liblinear', class_weight='balanced', max_iter=400)
    clf.fit(Xm[n_valid:], y[n_valid:])
    margin = clf.decision_function(Xm[:n_valid]); yv = y[:n_valid]
    neg = np.sort(margin[~yv]); c = float(neg[int(len(neg) * (1 - MAX_WRONG))])
    print(f'{cat}: weak positives {y.mean():.3f}, valid recall vs weak labels {(margin[yv] > c).mean():.3f}, cut {c:.2f}')
    k = len(classes); classes.append(cat); bias.append(round(float(clf.intercept_[0]), 3)); cut.append(round(c, 3))
    w = clf.coef_[0]
    for f, j in vocab.items():
        if abs(w[j]) >= 0.1:
            weights[f] = (weights[f] + ',' if f in weights else '') + f'{k}:{round(float(w[j]), 1):g}'
out = {'version': 1, 'classes': classes, 'bias': bias, 'cut': cut, 'weights': weights}
Path(sys.argv[2]).write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False, sort_keys=True))
print('features', len(weights), 'bytes', Path(sys.argv[2]).stat().st_size)
