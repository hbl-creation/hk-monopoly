"""Official place names (villages, areas) from the Lands Department "Geographic Name" dataset (CSDI), game coordinates.

    python3 scripts/geonames.py yuenlong 114.010 114.045 22.433 22.458
Writes data/<key>-geonames.json: {"g": [[type, name_tc, x, y], ...]}
"""
import json, math, sys, os, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574; M = 0.025
B = 'https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1648571595120_89752/MapServer/WFSServer?service=wfs&version=2.0.0&request=GetFeature&outputFormat=geojson&count=2000'
pts = json.load(urllib.request.urlopen(B + f'&typeNames=csdi:GEO_PLACE_NAME&srsName=EPSG:4326&bbox={LAT_A - M},{LON_A - M},{LAT_B + M},{LON_B + M},EPSG:4326', timeout=300))['features']
names, i = {}, 0
while True:  # name table (no geometry), joined by GEO_NAME_ID
    page = json.load(urllib.request.urlopen(B + f'&typeNames=csdi:PLACE_NAME&startIndex={i}', timeout=300))['features']
    for x in page:
        p = x['properties']; names.setdefault(p['GEO_NAME_ID'], []).append((p['NAME_STATUS'] != 'Official', p['NAME_TC']))
    i += 2000
    if len(page) < 2000: break
out = []
for f in pts:
    p = f['properties']; nm = sorted(names.get(p['GEO_NAME_ID'], []))
    if not nm: continue
    lon, lat = f['geometry']['coordinates'][:2]
    out.append([p['PLACE_TYPE'], nm[0][1], round((lon - LON0) * KX, 1), round((LAT0 - lat) * KY, 1)])
json.dump({'g': out}, open(f'{ROOT}/data/{key}-geonames.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(key, len(out), 'place names')
