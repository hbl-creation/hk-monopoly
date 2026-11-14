"""Background map around a district (not playable): roads, road names, land use, buildings, water.

    python3 scripts/context.py yuenlong 114.010 114.045 22.433 22.458 [margin_deg=0.015]

The district's own data covers only its download box; this fills a wider box around it so the map
doesn't end in blank space. Writes data/<key>-ctx.json in the game's coordinates.
Sources: Lands Department buildings (CSDI), DSD channels (CSDI) via osm_water.py, OpenStreetMap roads/land use.
"""
import json, math, sys, os, urllib.request
import shapely
from shapely.geometry import shape, box, LineString
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
M = float(sys.argv[6]) if len(sys.argv) > 6 else 0.025   # roads, land use
MB = 0  # no building outlines in the background (kept simple); set e.g. 0.015 to include them
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda g: shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
INNER, OUTER = box(LON_A, LAT_A, LON_B, LAT_B), box(LON_A - M, LAT_A - M, LON_B + M, LAT_B + M)
inner_m = P(INNER).buffer(60)   # the district's own roads already cover this
OSM = '/home/claude/hkmap/dl/als/OpenStreetMap/'
zh = lambda n: (n or '').split(' ')[0] if n and any('一' <= ch <= '鿿' for ch in n.split(' ')[0]) else (n or '')
flat = lambda g, t=0.8: [round(v, 1) for xy in g.simplify(t).exterior.coords[:-1] for v in xy]

def osm(f):
    for ft in json.load(open(OSM + f))['features']:
        g = shape(ft['geometry'])
        if g.intersects(OUTER): yield ft['properties'], P(g.intersection(OUTER))

# roads outside the district box, same format as the district's roads
rd = []
for p, g in osm('gis_osm_roads_free_1.geojson'):
    fc = p['fclass']
    if fc in ('steps', 'path', 'track', 'bridleway', 'cycleway', 'footway') or p['tunnel'] == 'T': continue
    if fc == 'service' and not p['name']: continue
    gg = g.difference(inner_m).simplify(1)
    ls = [gg] if gg.geom_type == 'LineString' else [x for x in getattr(gg, 'geoms', []) if x.geom_type == 'LineString']
    k = {'motorway': 6, 'trunk': 6, 'primary': 5, 'secondary': 4, 'tertiary': 3}.get(fc.replace('_link', ''), 2)
    if '_link' in fc: k -= .5
    if fc == 'pedestrian': k = 1
    L = [[[round(x, 1), round(y, 1)] for x, y in l.coords] for l in ls if len(l.coords) > 1 and l.length > 2]
    if L: rd.append({'n': zh(p['name']), 'k': k, 'b': 1 if p['bridge'] == 'T' else 0, 'l': L})
labs = []
for r in rd:
    if not r['n'] or r['k'] < 3: continue
    for l in r['l']:
        ls = LineString(l)
        if ls.length < 120: continue
        m = ls.interpolate(.5, normalized=True); a = ls.interpolate(.46, normalized=True); b = ls.interpolate(.54, normalized=True)
        ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x)); ang = ang - 180 if ang > 90 else ang + 180 if ang < -90 else ang
        if any(x[0] == r['n'] and math.hypot(x[1] - m.x, x[2] - m.y) < 300 for x in labs): continue
        labs.append([r['n'], round(m.x, 1), round(m.y, 1), round(ang, 1), r['k']])

# land use, simplified to a few map colours
KIND = {'park': 'park', 'recreation_ground': 'park', 'grass': 'park', 'forest': 'green', 'scrub': 'green', 'heath': 'green',
        'nature_reserve': 'green', 'farmland': 'farm', 'farmyard': 'farm', 'orchard': 'farm', 'meadow': 'farm',
        'residential': 'res', 'commercial': 'res', 'retail': 'res', 'industrial': 'ind', 'cemetery': 'green', 'military': 'gov'}
lu = []
for p, g in osm('gis_osm_landuse_a_free_1.geojson'):
    k = KIND.get(p['fclass'])
    if not k: continue
    for q in (g.geoms if hasattr(g, 'geoms') else [g]):
        if q.geom_type == 'Polygon' and q.area > 400: lu.append([k, flat(q, 2)])

# Lands Department buildings in the wider box (CSDI), the district box excluded (it has its own)
WFS = ('https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1637211194312_35158/MapServer/WFSServer'
       '?service=wfs&version=2.0.0&request=GetFeature&typeNames=csdi:Building&count=2000&startIndex={i}'
       f'&outputFormat=geojson&srsName=EPSG:4326&bbox={LAT_A - MB},{LON_A - MB},{LAT_B + MB},{LON_B + MB},EPSG:4326')
bld, i, inner_p = [], 0, P(INNER)
while MB > 0:
    page = json.load(urllib.request.urlopen(WFS.format(i=i), timeout=300))['features']
    for f in page:
        g = P(shape(f['geometry'])).buffer(0)
        for q in (g.geoms if hasattr(g, 'geoms') else [g]):
            if q.geom_type == 'Polygon' and q.area >= 8 and not inner_p.contains(q.representative_point()):
                bld.append([flat(q, 0.4), (f['properties'].get('BuildingNameTC') or '').strip(), f['properties'].get('Storeys') or 0, -1])
    i += 2000
    if len(page) < 2000: break

ob = P(OUTER).bounds
json.dump({'roads': rd, 'labels': labs, 'landuse': lu, 'bld': bld, 'bounds': [round(v) for v in ob]},
          open(f'{ROOT}/data/{key}-ctx.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(key, 'context:', len(rd), 'roads', len(labs), 'labels', len(lu), 'land-use areas', len(bld), 'buildings')
