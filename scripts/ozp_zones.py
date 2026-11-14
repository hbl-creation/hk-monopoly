"""Statutory zoning (Outline Zoning Plans) from the Town Planning Board for a district, in game coordinates.

    python3 scripts/ozp_zones.py yuenlong 114.010 114.045 22.433 22.458

Source: Planning Department / Town Planning Board, Statutory Planning Portal map service
(www.ozp.tpb.gov.hk, layer "Zoning"), the service behind the CSDI dataset "Digital Planning Data of
Statutory Plans". Used to classify land only — game planning limits stay game values (design doc).
Writes data/<key>-ozp.json: {"z": [[group, label, plan_no, [x,y,x,y,...]], ...]}
"""
import json, math, sys, os, urllib.request, urllib.parse
import shapely
from shapely.geometry import shape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda g: shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
M = 0.025
URL = 'https://www.ozp.tpb.gov.hk/arcgis2/rest/services/SPP3/OZP_PLAN/MapServer/1000/query?'
out, off = [], 0
while True:
    q = urllib.parse.urlencode({'geometry': f'{LON_A - M},{LAT_A - M},{LON_B + M},{LAT_B + M}', 'geometryType': 'esriGeometryEnvelope',
                                'inSR': 4326, 'outSR': 4326, 'spatialRel': 'esriSpatialRelIntersects', 'returnGeometry': 'true',
                                'outFields': 'OZP_PLAN_NO,ZONE_LABEL,ZONE_LABEL_GRP', 'resultOffset': off, 'resultRecordCount': 1000, 'f': 'geojson'})
    fs = json.load(urllib.request.urlopen(URL + q, timeout=300))['features']
    for f in fs:
        if not f['geometry']: continue
        g = P(shape(f['geometry'])).buffer(0); p = f['properties']
        for part in (g.geoms if hasattr(g, 'geoms') else [g]):
            if part.geom_type == 'Polygon' and part.area > 20:
                out.append([p['ZONE_LABEL_GRP'], p['ZONE_LABEL'], p['OZP_PLAN_NO'],
                            [round(v, 1) for xy in part.simplify(0.8).exterior.coords[:-1] for v in xy]])
    off += 1000
    if len(fs) < 1000: break
json.dump({'z': out}, open(f'{ROOT}/data/{key}-ozp.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(key, len(out), 'zone polygons')
