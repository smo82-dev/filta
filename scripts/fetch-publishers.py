import urllib.request, concurrent.futures, json, pathlib, datetime, re
import sys
root=pathlib.Path(__file__).resolve().parent.parent
catalogue=json.loads((root/'tests/fixtures/publishers/catalogue.json').read_text())
urls=[(x['region'],x['publisher'],x['url']) for x in catalogue]
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else root/'test-results/publishers');out.mkdir(exist_ok=True)
def fetch(v):
 region,name,url=v; slug=re.sub('[^a-z0-9]+','-',name.lower()).strip('-'); item=dict(region=region,publisher=name,url=url,slug=slug,attemptedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; FILTACompatibility/0.2; local development validation)'})
  with urllib.request.urlopen(req,timeout=25) as r:
   data=r.read(10000000);item.update(status=r.status,finalUrl=r.url,bytes=len(data));(out/(slug+'.html')).write_bytes(data)
 except Exception as e:item['error']=str(e)
 return item
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 results=list(pool.map(fetch,urls))
(out/'fetch-results.json').write_text(json.dumps(results,indent=2));print(json.dumps([{k:v for k,v in r.items() if k!='attemptedAt'} for r in results],indent=2))
