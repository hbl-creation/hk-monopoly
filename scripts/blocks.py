import json, math
from shapely.geometry import shape, LineString, Polygon, MultiPolygon, box, mapping
from shapely.ops import unary_union, polygonize, transform
from shapely.strtree import STRtree

SRC = '/home/claude/hkmap/dl/hks/content/projects/duality-of-hk/data/'
LAT0, LON0 = 22.31, 114.17
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
def proj(x, y, z=None): return ((x - LON0) * KX, (LAT0 - y) * KY)

def geoms(gj):
    out = []
    for ft in gj['features']:
        g = ft['geometry']
        out += [shape(x) for x in g['geometries']] if g['type'] == 'GeometryCollection' else [shape(g)]
    return out
dist = unary_union([g.buffer(0) for g in geoms(json.load(open('/root/hkmap/HKMap/json/Yau Tsim Mong.json')))])
dist = transform(proj, dist)
dist = max(dist.geoms, key=lambda g: g.area) if dist.geom_type == 'MultiPolygon' else dist

SKIP = {'footway', 'steps', 'path', 'track', 'proposed', 'construction', None}
RANK = {'motorway': 6, 'trunk': 6, 'primary': 5, 'secondary': 4, 'tertiary': 3, 'unclassified': 2, 'residential': 2, 'pedestrian': 2, 'living_street': 2, 'service': 1}
roads = []
bb = dist.bounds
for n in ['sino', 'eur', 'mixed']:
    for f in json.load(open(SRC + n + '.geojson'))['features']:
        p = f['properties']; hw = p.get('highway')
        if f['geometry']['type'] != 'LineString' or hw in SKIP: continue
        g = transform(proj, shape(f['geometry']))
        if not g.intersects(box(*bb).buffer(50)): continue
        zh = p.get('name:zh') or p.get('name:zh-Hant') or p.get('name:yue-Hant') or (p.get('name', '').split(' ')[0])
        base = hw.replace('_link', '')
        roads.append({'g': g, 'zh': zh, 'en': p.get('name:en', ''), 'hw': hw, 'rank': RANK.get(base, 2) - (0.5 if '_link' in hw else 0),
                      'bridge': p.get('bridge') == 'yes' or p.get('layer', 0) not in (0, None, '0'), 'tunnel': p.get('tunnel') == 'yes'})
print('roads', len(roads))
ground = [r for r in roads if not r['tunnel'] and not (r['rank'] >= 6 and r['bridge'])]
net = unary_union([r['g'] for r in ground] + [dist.exterior])
polys = [p.intersection(dist) for p in polygonize(net)]
cells = []
for p in polys:
    for q in (p.geoms if p.geom_type == 'MultiPolygon' else [p]):
        if q.geom_type != 'Polygon' or q.area < 900: continue
        mrr = q.minimum_rotated_rectangle; xs = list(mrr.exterior.coords)
        e = sorted([math.dist(xs[i], xs[i + 1]) for i in range(4)])
        if e[0] < 18: continue
        if q.area > 400000: continue
        cells.append(q)
print('blocks', len(cells))

tree = STRtree([r['g'] for r in roads])
AREAS = [('尖沙咀', 114.172, 22.298), ('佐敦', 114.170, 22.305), ('油麻地', 114.170, 22.312), ('旺角', 114.169, 22.319), ('大角咀', 114.161, 22.322), ('太子', 114.168, 22.3255), ('西九龍', 114.160, 22.303), ('京士柏', 114.176, 22.311), ('尖東', 114.178, 22.298)]
AP = [(n, *proj(x, y)) for n, x, y in AREAS]
RATE = {'尖沙咀': 2.4, '尖東': 2.1, '旺角': 2.2, '佐敦': 1.6, '油麻地': 1.5, '大角咀': 1.1, '太子': 1.4, '西九龍': 1.3, '京士柏': 1.2}
PREMIUM = {'彌敦道': 1.6, '廣東道': 1.8, '西洋菜南街': 1.4, '亞皆老街': 1.2, '山林道': 1.1, '加連威老道': 1.25, '梳士巴利道': 1.5, '金巴利道': 1.15, '漢口道': 1.2, '花園街': 1.15, '通菜街': 1.2, '登打士街': 1.1, '廟街': 1.15, '上海街': 1.05, '佐敦道': 1.15, '柯士甸道': 1.1, '么地道': 1.15, '加拿分道': 1.1}
out = []
for k, q in enumerate(cells):
    ring = q.exterior.buffer(9)
    near = {}
    for idx in tree.query(ring):
        r = roads[idx]
        if not r['zh']: continue
        L = r['g'].intersection(ring).length
        if L < 15: continue
        a = near.setdefault(r['zh'], [0, r['rank'], r['en']]); a[0] += L; a[1] = max(a[1], r['rank'])
    streets = sorted(near.items(), key=lambda kv: -(kv[1][0] * (1 + kv[1][1] * 0.25)))
    c = q.representative_point()
    area_n = min(AP, key=lambda a: (a[1] - c.x) ** 2 + (a[2] - c.y) ** 2)[0]
    prem = max([PREMIUM.get(s, 1) for s, _ in streets] + [1])
    front = max([v[1] for _, v in streets] + [1])
    gfa = q.area * 9
    price = gfa * 10.764 * 1.2e4 * RATE[area_n] * prem * (1 + 0.04 * front) / 1e8
    price = max(3, round(price))  # HK$ 億 (game value)
    names = [s for s, _ in streets[:5]]
    ext = [[round(x, 1), round(y, 1)] for x, y in q.simplify(1.2).exterior.coords]
    out.append({'id': k, 'a': area_n, 's': names, 'm2': round(q.area), 'p': price, 'r': round(price * 0.04, 1), 'c': [round(c.x, 1), round(c.y, 1)], 'g': ext})

def line_out(r):
    g = r['g'].intersection(dist.buffer(150)).simplify(1.5)
    if g.is_empty: return None
    ls = [g] if g.geom_type == 'LineString' else [x for x in getattr(g, 'geoms', []) if x.geom_type == 'LineString']
    return [[[round(x, 1), round(y, 1)] for x, y in l.coords] for l in ls if len(l.coords) > 1]
rd = []
for r in roads:
    L = line_out(r)
    if L: rd.append({'n': r['zh'], 'k': r['rank'], 't': 1 if r['tunnel'] else 0, 'b': 1 if r['bridge'] else 0, 'l': L})
# label positions: longest piece per major street name
lab = {}
for r in roads:
    if r['rank'] < 3 or r['tunnel'] or not r['zh']: continue
    g = r['g'].intersection(dist)
    for l in ([g] if g.geom_type == 'LineString' else [x for x in getattr(g, 'geoms', []) if x.geom_type == 'LineString']):
        if l.length > lab.get(r['zh'], (0,))[0]:
            mid = l.interpolate(0.5, normalized=True); a = l.interpolate(0.45, normalized=True); b = l.interpolate(0.55, normalized=True)
            ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
            if ang > 90: ang -= 180
            if ang < -90: ang += 180
            lab[r['zh']] = (l.length, round(mid.x, 1), round(mid.y, 1), round(ang, 1), r['rank'])
labels = [[n, v[1], v[2], v[3], v[4]] for n, v in lab.items() if v[0] > 250]
land = [[round(x, 1), round(y, 1)] for x, y in dist.simplify(3).exterior.coords]
data = {'blocks': out, 'roads': rd, 'labels': labels, 'land': land, 'bounds': [round(v) for v in dist.bounds], 'areas': [[n, round(x), round(y)] for n, x, y in AP]}
s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open('/home/claude/hkmap/ytm.json', 'w').write(s)
print('blocks out', len(out), 'roads', len(rd), 'labels', len(labels), len(s) // 1024, 'KB')
import collections; print(collections.Counter(b['a'] for b in out)); print(sorted(b['p'] for b in out)[::40])
print([ (b['a'], b['s'], b['p']) for b in out[:8]])
