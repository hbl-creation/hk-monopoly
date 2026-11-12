"""Download + project Lands Department building footprints (CSDI Portal) for a district.

    python3 scripts/csdi_buildings.py yuenlong 114.010 114.045 22.433 22.458

Source: Lands Department "Building" dataset via CSDI Portal WFS (free for commercial and
non-commercial use under the CSDI Portal terms; attribution shown in the game page).
Writes data/<key>-bld.json: {"b": [[ring xy (metres, game coords), name_tc, storeys], ...]}
"""
import json, math, re, sys, os, urllib.request
import shapely
from shapely.geometry import shape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda g: shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
WFS = ('https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1637211194312_35158/MapServer/WFSServer'
       '?service=wfs&version=2.0.0&request=GetFeature&typeNames=csdi:Building&count=2000&startIndex={i}'
       f'&outputFormat=geojson&srsName=EPSG:4326&bbox={LAT_A},{LON_A},{LAT_B},{LON_B},EPSG:4326')
feats, i = [], 0
while True:
    page = json.load(urllib.request.urlopen(WFS.format(i=i), timeout=300))['features']
    feats += page; i += 2000
    if len(page) < 2000: break
out = []
for f in feats:
    p = f['properties']
    if p.get('Status') not in (None, 'Active'): continue
    g = P(shape(f['geometry'])).buffer(0)
    polys = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
    for q in polys:
        if q.area < 8: continue
        q = q.simplify(0.4)
        nm = (p.get('BuildingNameTC') or '').strip()
        out.append([[round(v, 1) for xy in q.exterior.coords[:-1] for v in xy], nm, p.get('Storeys') or 0])
json.dump({'b': out}, open(f'{ROOT}/data/{key}-bld.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(key, len(feats), 'features ->', len(out), 'footprints,', sum(1 for b in out if b[1]), 'named')
