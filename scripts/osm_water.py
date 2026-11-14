"""Water polygons (rivers, nullahs, fishponds) from OpenStreetMap for a district, in game coordinates.

    python3 scripts/osm_water.py yuenlong 114.010 114.045 22.433 22.458
Writes data/<key>-water.json: {"w": [[x,y,x,y,...], ...]}
"""
import json, math, sys, os
import shapely
from shapely.geometry import shape, box

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda g: shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
BB = box(LON_A - .003, LAT_A - .003, LON_B + .003, LAT_B + .003)
src = '/home/claude/hkmap/dl/als/OpenStreetMap/gis_osm_water_a_free_1.geojson'
out = []
for f in json.load(open(src))['features']:
    g = shape(f['geometry'])
    if not g.intersects(BB): continue
    g = P(g.intersection(BB)).buffer(0)
    for q in (g.geoms if hasattr(g, 'geoms') else [g]):
        if q.geom_type == 'Polygon' and q.area > 30:
            out.append([round(v, 1) for xy in q.simplify(0.8).exterior.coords[:-1] for v in xy])
json.dump({'w': out}, open(f'{ROOT}/data/{key}-water.json', 'w'), separators=(',', ':'))
print(key, len(out), 'water polygons')
