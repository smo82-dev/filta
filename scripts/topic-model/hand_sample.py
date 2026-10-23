"""Re-draw the two hand-labelled evaluation samples (headlines are not redistributed).

Pools: AG News test split "World" stories and HuffPost 2018 stories from news-like sections.
Tuning sample: seed 11, 220 AG + 280 HuffPost (informed the rule vocabulary).
Fresh sample: seed 2026, 180 AG + 220 HuffPost, drawn after tuning, excluding the tuning sample.
Labels (row id -> W war, D disaster, T tragedy, C celebrity) live in
docs/validation-0.2.0/dev3/hand-labels-*.txt. Usage: python hand_sample.py DATA_DIR OUT_DIR
"""
import csv, json, random, re, sys
from pathlib import Path
data, out = Path(sys.argv[1]), Path(sys.argv[2])
KEEP = {'WORLD NEWS', 'ENTERTAINMENT', 'CRIME', 'WEIRD NEWS', 'GREEN', 'ENVIRONMENT', 'POLITICS', 'MEDIA', 'THE WORLDPOST', 'WORLDPOST', 'COMEDY', 'IMPACT', 'SPORTS'}
def ag_title(title):
    t = re.sub(r'\s*\((?:AP|AFP|Reuters|[A-Za-z.]+\.com|[A-Z][A-Za-z]+)\)$', '', title.replace('\\', ' ')).strip()
    return t.replace('#39;', "'").replace(' #36;', ' $')
def pools(exclude=frozenset(), drop_markup=False):
    ag = [('ag', ag_title(t)) for label, t, _ in csv.reader(open(data / 'ag/data/ag_news_csv/test.csv', newline='', encoding='utf8')) if label == '1']
    ag = [p for p in ag if p[1] not in exclude and not (drop_markup and '&lt;' in p[1])]
    hf = []
    for line in open(data / 'h_Noticias_PeakU/News_Category_Dataset_v2.json', encoding='utf8'):
        d = json.loads(line)
        if d['date'] >= '2018-01-01' and d['category'] in KEEP and len(d['headline']) > 12 and d['headline'] not in exclude: hf.append(('huff', d['headline']))
    return ag, hf
random.seed(11); ag, hf = pools()
tuning = random.sample(ag, 220) + random.sample(hf, 280); random.shuffle(tuning)
random.seed(2026); ag, hf = pools({h for _, h in tuning}, True)
fresh = random.sample(ag, 180) + random.sample(hf, 220); random.shuffle(fresh)
for name, rows in (('tuning', tuning), ('fresh', fresh)):
    (out / f'{name}.json').write_text(json.dumps([{'id': i, 'set': s, 'headline': h} for i, (s, h) in enumerate(rows)]))
