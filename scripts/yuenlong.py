import json, math, collections
from shapely.geometry import shape, box, Point, LineString, Polygon
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree
import shapely

OSM = '/home/claude/hkmap/dl/als/OpenStreetMap/'
LON_A, LON_B, LAT_A, LAT_B = 114.0100, 114.0450, 22.4330, 22.4580
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
def P(g): return shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
BB = box(LON_A, LAT_A, LON_B, LAT_B)

def load(f, keep=lambda p: True):
    out = []
    for ft in json.load(open(OSM + f))['features']:
        p = ft['properties']
        if not keep(p): continue
        g = shape(ft['geometry'])
        if g.intersects(BB.buffer(0.002)): out.append((p, P(g)))
    return out
zh = lambda n: (n or '').split(' ')[0] if n and any('一' <= ch <= '鿿' for ch in n.split(' ')[0]) else (n or '')

roads = load('gis_osm_roads_free_1.geojson')
landuse = load('gis_osm_landuse_a_free_1.geojson')
pois = load('gis_osm_pois_a_free_1.geojson')
pofw = load('gis_osm_pofw_a_free_1.geojson')
blds = load('gis_osm_buildings_a_free_1.geojson')
print('loaded', len(roads), len(landuse), len(pois), len(pofw), len(blds))
area_box = P(BB)

# land = everything mapped on land, smoothed
land = unary_union([g.buffer(0) for p, g in landuse] + [g.buffer(0) for p, g in blds] + [g.buffer(6) for p, g in roads if p['tunnel'] != 'T']).buffer(30).buffer(-30)
land = land.intersection(area_box)

CAR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian',
       'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
cut = [g for p, g in roads if (p['fclass'] in CAR or (p['fclass'] == 'service' and p['name'])) and p['bridge'] != 'T' and p['tunnel'] != 'T' and str(p['layer']) in ('0', 'None')]
EXTRA = []
for p_, g_ in landuse:
    if p_['fclass'] in ('park', 'recreation_ground', 'military') and g_.area > 1500: EXTRA.append(g_.buffer(0).boundary)
for p_, g_ in pois:
    if p_['fclass'] in ('park', 'zoo', 'town_hall', 'courthouse', 'police', 'fire_station', 'school', 'hospital', 'university') and g_.area > 1500: EXTRA.append(g_.buffer(0).boundary)
for p_, g_ in pofw:
    if g_.area > 300: EXTRA.append(g_.buffer(0).boundary)
bank = [(zh(p['name']), g) for p, g in load('gis_osm_pois_free_1.geojson') if p['fclass'] == 'bank' and p['name']]
for n_, g_ in bank: EXTRA.append(g_.buffer(15, cap_style=3).boundary)
EXTRA = [e.intersection(land.buffer(-2)) for e in EXTRA]
net = unary_union(cut + EXTRA + [b for b in ([land.boundary] if land.geom_type == 'Polygon' else [g.boundary for g in land.geoms])])
cells = []
for f in polygonize(net):
    q = f.intersection(land)
    for g in (q.geoms if q.geom_type == 'MultiPolygon' else [q]):
        if g.geom_type != 'Polygon' or g.area < 350: continue
        xs = list(g.minimum_rotated_rectangle.exterior.coords)
        e = sorted(math.dist(xs[i], xs[i + 1]) for i in range(4))
        if e[0] < 12: continue
        cells.append(g)
print('blocks', len(cells))

# classification layers
GOVK = ['邨', '墳場', '房屋署', '政府', '禮賓府', '立法會', '法院', '警', '消防', '軍營', '軍用', '郵政', '律政', '終審', '入境', '稅務', '海關', '屋宇']
gov, park, rel, land_mk, comm, green, farm = [], [], [], [], [], [], []
for p, g in landuse:
    n = p['name'] or ''
    if p['fclass'] in ('park', 'recreation_ground', 'grass'): park.append((n, g))
    if p['fclass'] in ('forest', 'scrub', 'heath'): green.append((n, g))
    if p['fclass'] in ('farmland', 'farmyard', 'orchard', 'meadow'): farm.append((n, g))
    if p['fclass'] == 'cemetery': gov.append((n or '墳場', g))
    if p['fclass'] == 'military' or any(k in n for k in GOVK): gov.append((n, g))
    if p['fclass'] in ('commercial', 'retail') and n and g.area > 6000: land_mk.append((n, g))
for p, g in pois:
    n, fc = p['name'] or '', p['fclass']
    if fc in ('park', 'zoo', 'garden', 'playground', 'dog_park') and g.area > 600: park.append((n, g))
    elif fc in ('town_hall', 'courthouse', 'police', 'fire_station', 'prison', 'post_office', 'library', 'embassy') or any(k in n for k in GOVK): gov.append((n, g))
    elif fc in ('school', 'hospital', 'university', 'college', 'kindergarten', 'community_centre', 'sports_centre', 'clinic'): comm.append((n, g))
    elif fc in ('mall', 'attraction', 'museum', 'arts_centre', 'theatre', 'market_place', 'monument') and n and g.area > 1500: land_mk.append((n, g))
for p, g in pofw: rel.append((p['name'] or '宗教場所', g))
for p, g in blds:
    n = p['name'] or ''
    if p['type'] in ('church', 'cathedral', 'temple', 'mosque', 'synagogue'): rel.append((n or '教堂', g))
    if p['type'] in ('government', 'civic', 'public') : gov.append((n, g))
print('banks found', [b[0] for b in bank])
allb = [g.buffer(0) for p, g in blds]
named_b = [(zh(p['name']), g) for p, g in blds if p['name'] and p['type'] not in ('roof', 'service')]

def share(cell, layer, thr):
    best = None
    for n, g in layer:
        try: a = cell.intersection(g.buffer(0)).area
        except Exception: continue
        if a / cell.area >= thr or (a > 250 and thr < 0.2 and cell.area < 7000):
            if not best or a > best[1]: best = (zh(n), a)
    return best

# streets
rtree = STRtree([g for p, g in roads])
RANK = {'motorway': 6, 'trunk': 6, 'primary': 5, 'secondary': 4, 'tertiary': 3}
AREAS = [('元朗市中心', 114.0300, 22.4445), ('元朗舊墟', 114.0360, 22.4495), ('朗屏', 114.0240, 22.4505), ('水邊圍', 114.0200, 22.4410), ('南邊圍', 114.0280, 22.4365), ('屏山', 114.0130, 22.4470), ('元朗東', 114.0420, 22.4430)]
AP = [(n, *P(Point(x, y)).coords[0]) for n, x, y in AREAS]
RATE = {'元朗市中心': 1.3, '元朗舊墟': 1.0, '朗屏': 0.9, '水邊圍': 0.9, '南邊圍': 0.7, '屏山': 0.6, '元朗東': 0.8}
PREM = {'青山公路－元朗段': 1.3, '教育路': 1.1, '元朗安寧路': 1.1, '鳳翔路': 1.05, '康樂路': 1.05, '馬田路': 1.05, '大棠路': 1.05, '擊壤路': 1.1, '谷亭街': 1.1, '水車館街': 1.05}
out = []
for k, c in enumerate(cells):
    ring = c.exterior.buffer(8)
    near = {}
    for i in rtree.query(ring):
        p, g = roads[i]
        n = zh(p['name'])
        if not n or p['fclass'] in ('footway', 'steps', 'path'): continue
        L = g.intersection(ring).length
        if L < 12: continue
        a = near.setdefault(n, [0, RANK.get(p['fclass'].replace('_link', ''), 2)]); a[0] += L
    streets = [s for s, v in sorted(near.items(), key=lambda kv: -(kv[1][0] * (1 + kv[1][1] * .25)))][:4]
    rp = c.representative_point()
    an = min(AP, key=lambda a: (a[1] - rp.x) ** 2 + (a[2] - rp.y) ** 2)[0]
    kind, label = 'buy', ''
    for kname, layer, thr in (('bank', bank, .0), ('rel', rel, .15), ('gov', gov, .3), ('park', park, .45), ('mark', land_mk, .35), ('comm', comm, .4)):
        if kname == 'bank':
            hit = [n for n, g in layer if c.contains(g.representative_point())]
            if hit: kind, label = 'bank', hit[0]; break
            continue
        s = share(c, layer, thr)
        if s and s[0] or (s and kname in ('park', 'gov')):
            kind, label = kname, s[0] or {'park': '休憩用地', 'gov': '政府用地'}[kname]; break
    cov = sum(c.intersection(g).area for g in allb if g.intersects(c)) / c.area
    fs = share(c, farm, .3)
    if kind == 'buy' and fs: label = '農地'
    elif kind == 'buy' and cov < 0.12 and c.area > 6000 and share(c, green, .4): kind, label = 'park', '綠化地帶'
    elif kind == 'buy' and cov < 0.05 and c.area > 6000: label = '空地'
    bnames = sorted(((n, c.intersection(g).area) for n, g in named_b if g.intersects(c)), key=lambda x: -x[1])
    bname = bnames[0][0] if bnames and bnames[0][1] > 150 else ''
    prem = max([PREM.get(s, 1) for s in streets] + [1])
    price = max(4, round(math.sqrt(c.area) * RATE[an] * prem * 0.18))
    ext = [[round(x, 1), round(y, 1)] for x, y in c.simplify(0.8).exterior.coords]
    out.append({'id': k, 'a': an, 's': streets, 'b': bname, 'k': kind, 'n': label, 'f': 1 if label in ('農地', '空地') else 0, 'm2': round(c.area), 'p': price, 'r': round(price * 0.06, 1),
                'c': [round(rp.x, 1), round(rp.y, 1)], 'g': ext})
print(collections.Counter(b['k'] for b in out))
for b in out:
    if b['k'] != 'buy': print(b['k'], b['n'], b['s'][:2], b['m2'])

# neighbours of landmarks get boost: mark adjacency
cpoly = [Polygon(b['g']) for b in out]
ctree = STRtree(cpoly)
for i, b in enumerate(out):
    b['nb'] = [int(j) for j in ctree.query(cpoly[i].buffer(30)) if j != i]

rd = []
for p, g in roads:
    fc = p['fclass']
    if fc in ('steps', 'path', 'track', 'bridleway', 'cycleway') or p['tunnel'] == 'T': continue
    if fc == 'footway' and p['bridge'] != 'T': continue
    if fc == 'service' and not p['name']: continue
    gg = g.intersection(area_box.buffer(60)).simplify(0.8)
    ls = [gg] if gg.geom_type == 'LineString' else [x for x in getattr(gg, 'geoms', []) if x.geom_type == 'LineString']
    k = {'motorway': 6, 'trunk': 6, 'primary': 5, 'secondary': 4, 'tertiary': 3}.get(fc.replace('_link', ''), 2)
    if '_link' in fc: k -= .5
    if fc == 'footway': k = 0
    if fc == 'pedestrian': k = 1
    L = [[[round(x, 1), round(y, 1)] for x, y in l.coords] for l in ls if len(l.coords) > 1]
    if L: rd.append({'n': zh(p['name']), 'k': k, 'b': 1 if p['bridge'] == 'T' else 0, 'l': L})
labs = []
for r in rd:
    if not r['n'] or r['k'] < 1: continue
    for l in r['l']:
        ls = LineString(l)
        if ls.length < 70: continue
        n = max(1, int(ls.length // 260))
        for i in range(n):
            f = (i + .5) / n; m = ls.interpolate(f, normalized=True); a = ls.interpolate(max(0, f - .04), normalized=True); b2 = ls.interpolate(min(1, f + .04), normalized=True)
            ang = math.degrees(math.atan2(b2.y - a.y, b2.x - a.x))
            ang = ang - 180 if ang > 90 else ang + 180 if ang < -90 else ang
            if any(x[0] == r['n'] and math.hypot(x[1] - m.x, x[2] - m.y) < 200 for x in labs): continue
            labs.append([r['n'], round(m.x, 1), round(m.y, 1), round(ang, 1), r['k']])
lg = [land] if land.geom_type == 'Polygon' else list(land.geoms)
ring = lambda r: [[round(x, 1), round(y, 1)] for x, y in r.coords]
landj = [[ring(g.exterior)] + [ring(i) for i in g.interiors] for g in lg if g.area > 2000]
bx = area_box.bounds
data = {'blocks': out, 'roads': rd, 'labels': labs, 'land': landj, 'bounds': [round(v) for v in bx], 'areas': [[n, round(x), round(y)] for n, x, y in AP]}
s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open('/home/claude/hkmap/yuenlong.json', 'w').write(s)
print('size', len(s) // 1024, 'KB', 'roads', len(rd), 'labels', len(labs))
