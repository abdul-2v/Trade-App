#!/usr/bin/env python3
"""Extract public merchant POIs from Geofabrik county PBFs, not guessed coordinates."""
import argparse
import datetime
import json
import math
import re
import subprocess
import tempfile
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[1]
RULES = json.loads((ROOT / 'data/supplier-query-rules.json').read_text())
REGIONS = ['derbyshire','leicestershire','lincolnshire','northamptonshire','nottinghamshire','rutland',
           'herefordshire','shropshire','staffordshire','warwickshire','west-midlands','worcestershire']
BASE = 'https://download.geofabrik.de/europe/united-kingdom/england/'
BRAND = re.compile(RULES['brandPattern'], re.I)
SHOPS = set(RULES['shopTypes'])
TAGS = {'name','brand','operator','shop','trade','wholesale','shop:trade','addr:housenumber','addr:street',
        'addr:city','addr:town','addr:village','addr:suburb','addr:postcode','contact:phone','phone',
        'contact:website','website','opening_hours','disused','abandoned','closed','building','highway',
        'public_transport','railway','disused:shop'}
CLOSED = {'vacant','closed','disused','abandoned'}

def relevant(tags):
    shop = tags.get('shop','')
    if shop in CLOSED or any(tags.get(k)=='yes' for k in ('disused','abandoned','closed')) or any(tags.get(k) for k in ('highway','public_transport','railway','disused:shop')):
        return False
    name = tags.get('name') or tags.get('brand')
    if not name or not name.strip(): return False
    if not (shop or tags.get('trade') or tags.get('wholesale') or tags.get('building') in ('retail','warehouse','commercial','industrial')): return False
    return shop in SHOPS or bool(shop and (tags.get('trade') or tags.get('wholesale'))) or bool(BRAND.search(' '.join(tags.get(k,'') for k in ('name','brand','operator'))))

class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.records={}
    def add(self, obj, typ, ident, lat, lon):
        tags = {t.k:t.v for t in obj.tags if t.k in TAGS}
        if not relevant(tags): return
        if not (math.isfinite(lat) and math.isfinite(lon) and 49 <= lat <= 56 and -7 <= lon <= 3): return
        self.records[(typ,ident)]={'type':typ,'id':ident,'lat':round(lat,7),'lon':round(lon,7),'tags':tags}
    def node(self,n):
        if n.location.valid():
            self.add(n,'node',n.id,n.location.lat,n.location.lon)
    def way(self,w):
        if not relevant({t.k:t.v for t in w.tags if t.k in TAGS}): return
        coords=[(n.location.lat,n.location.lon) for n in w.nodes if n.location.valid()]
        if coords:
            # Same bounding-box centre convention used by Overpass "out center".
            a,b=zip(*coords)
            self.add(w,'way',w.id,(min(a)+max(a))/2,(min(b)+max(b))/2)
    def area(self,a):
        if a.from_way() or not relevant({t.k:t.v for t in a.tags if t.k in TAGS}): return
        coords=[(n.location.lat,n.location.lon) for ring in a.outer_rings() for n in ring if n.location.valid()]
        if coords:
            lats,lons=zip(*coords)
            self.add(a,'relation',a.orig_id(),(min(lats)+max(lats))/2,(min(lons)+max(lons))/2)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=str(ROOT/'data/TradeSupplierDirectory.ts'))
    parser.add_argument('--input-dir',type=Path,help='Use existing county PBFs (same names as Geofabrik).')
    parser.add_argument('--regions',nargs='+',default=REGIONS,help='Explicit Geofabrik England extract slugs.')
    parser.add_argument('--minimum',type=int,default=500,help='Minimum raw mapped records for this batch.')
    args=parser.parse_args()
    if not args.regions or len(set(args.regions))!=len(args.regions) or any(not re.fullmatch(r'[a-z]+(?:-[a-z]+)*',r) for r in args.regions):
        parser.error('Invalid or duplicate region slugs')
    all_records={}
    counts={}
    with tempfile.TemporaryDirectory() as tmp:
        for region in args.regions:
            path=(args.input_dir or Path(tmp))/(region+'-latest.osm.pbf')
            if not args.input_dir:
                subprocess.run(['curl','--fail','--location','--retry','3','--retry-delay','5','--max-time','300','-o',str(path),BASE+path.name],check=True)
            extract=Extract()
            extract.apply_file(str(path),locations=True,idx='flex_mem')
            counts[region]=len(extract.records)
            if counts[region]<1: raise RuntimeError(f'Unexpectedly sparse extract: {region}: {counts[region]}')
            all_records.update(extract.records)
            if not args.input_dir: path.unlink()
            print(region,counts[region],flush=True)
    if len(all_records)<args.minimum: raise RuntimeError('Incomplete supplier directory; refusing to replace previous data.')
    records=sorted(all_records.values(),key=lambda r:(r['type'],r['id']))
    out=Path(args.output)
    previous=out.read_text() if out.exists() else ''
    count_match=re.search(r'"count":(\d+)',previous)
    if count_match and len(records)<int(count_match.group(1))*.8: raise RuntimeError('Directory shrank by over 20%; investigate before replacing.')
    meta={'source':'OpenStreetMap / Geofabrik','license':'ODbL-1.0','regions':args.regions,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'count':len(records),'counts':counts}
    dump=lambda x:json.dumps(x,ensure_ascii=True,separators=(',',':'))
    # One record per line keeps Git diffs useful and avoids huge source lines.
    output='// Generated: ODbL 1.0; © OpenStreetMap contributors. See data/SUPPLIER_DATA.md.\n'
    output+='export type DirectoryElement={type:string;id:number;lat:number;lon:number;tags:Record<string,string>};\n'
    output+='export const directoryMetadata='+dump(meta)+';\n'
    output+='export const directoryElements:DirectoryElement[]=[\n'+',\n'.join(dump(r)+' as DirectoryElement' for r in records)+'\n];\n'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(output)
    print('Total unique OSM objects:',len(records),flush=True)

if __name__=='__main__': main()
