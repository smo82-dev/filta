"""Prepare train/test splits from public labelled news datasets.

Test sets: AG News official test split, BBC 30% hash split, HuffPost 2018 (temporal hold-out).
Writes train.jsonl and test.jsonl with {set, gold:[categories], neg:bool, headline, description}.
"""
import csv, json, hashlib, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
OUT = Path(__file__).resolve().parent
csv.field_size_limit(10**9)

def clean(s):
    s = s.replace('\\', ' ').replace(' #36;', ' $').replace('#39;', "'").replace('quot;', '"')
    s = re.sub(r'&lt;.*?&gt;', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def bucket(text, n=10):
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % n

rows = {'train': [], 'test': []}

# AG News: 1 World, 2 Sports, 3 Business, 4 Sci/Tech.
AG = {'1': [], '2': ['sport'], '3': ['business'], '4': ['technology']}
for split in ('train', 'test'):
    with open(DATA / 'ag/data/ag_news_csv' / f'{split}.csv', newline='', encoding='utf8') as f:
        for label, title, desc in csv.reader(f):
            head = re.sub(r'\s*\((?:AP|AFP|Reuters|[A-Za-z.]+\.com|[A-Z][A-Za-z]+)\)$', '', clean(title))
            desc = re.sub(r'^[A-Za-z.]+(?:\.com)? - ', '', clean(desc))
            desc = re.sub(r'^[A-Z][A-Z ,.]+\([^)]*\) - ', '', desc)
            # World is unlabelled for politics/war etc., so it is a negative only for sport/business/tech.
            rows[split].append({'set': 'ag', 'gold': AG[label], 'scope': ['sport', 'business', 'technology'],
                                'headline': head, 'description': desc[:300]})

# BBC 2004-5 articles: first line is the headline, then the standfirst.
BBC = {'business': ['business'], 'entertainment': ['entertainment'], 'politics': ['politics'],
       'sport': ['sport'], 'tech': ['technology']}
with open(DATA / 'bbc/dataset/dataset.csv', newline='', encoding='utf8', errors='replace') as f:
    reader = csv.reader(f); next(reader)
    for news, kind in reader:
        lines = [x.strip() for x in news.split('\n') if x.strip()]
        if not lines or kind.strip() not in BBC: continue
        item = {'set': 'bbc', 'gold': BBC[kind.strip()], 'scope': ['sport', 'business', 'technology', 'politics', 'entertainment'],
                'headline': lines[0], 'description': (lines[1] if len(lines) > 1 else '')[:300]}
        rows['test' if bucket(lines[0]) < 3 else 'train'].append(item)

# HuffPost 2012-2018. Ambiguous editorial buckets are excluded rather than treated as negatives.
HUFF = {'CRIME': ['crime'], 'ENTERTAINMENT': ['entertainment'], 'POLITICS': ['politics'], 'SPORTS': ['sport'],
        'BUSINESS': ['business'], 'MONEY': ['business'], 'TECH': ['technology'], 'SCIENCE': ['science']}
CLEAN_NEG = {'WELLNESS', 'TRAVEL', 'STYLE & BEAUTY', 'PARENTING', 'HEALTHY LIVING', 'FOOD & DRINK', 'HOME & LIVING',
             'PARENTS', 'WEDDINGS', 'STYLE', 'TASTE', 'FIFTY', 'RELIGION', 'EDUCATION', 'COLLEGE'}
for line in open(DATA / 'h_Noticias_PeakU/News_Category_Dataset_v2.json', encoding='utf8'):
    d = json.loads(line)
    cat = d['category']
    if cat not in HUFF and cat not in CLEAN_NEG: continue
    head = clean(d['headline'])
    if len(head) < 12: continue
    item = {'set': 'huff', 'gold': HUFF.get(cat, []), 'scope': ['crime', 'entertainment', 'politics', 'sport', 'business', 'technology', 'science'],
            'cat': cat, 'headline': head, 'description': clean(d['short_description'])[:300]}
    rows['test' if d['date'] >= '2018-01-01' else 'train'].append(item)

for split, items in rows.items():
    with open(OUT / f'{split}.jsonl', 'w') as f:
        for item in items: f.write(json.dumps(item) + '\n')
    from collections import Counter
    print(split, len(items), Counter(i['set'] for i in items), Counter(g for i in items for g in i['gold']))
