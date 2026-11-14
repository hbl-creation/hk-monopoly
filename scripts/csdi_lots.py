"""Rebuild buyable plots from government land lots (Lands Department "Lot" dataset, CSDI Portal).

    python3 scripts/csdi_lots.py yuenlong 114.010 114.045 22.433 22.458

Reads  data/<key>3.json  (zones + plots generated from OpenStreetMap street blocks)
Writes data/<key>4.json  (same format; buy/dev plots now follow real lot boundaries)

- park / gov / school / church / landmark / bank plots keep their generated shape
- every other area is rebuilt from land lots: each lot goes to the zone it overlaps most,
  then neighbouring lots with the same character (normal / farmland / same developer) are
  grouped until the plot reaches a playable size; a lot is never cut in two
- unleased government land between lots (slopes, lanes, verges) is no longer a plot
- price, rent, district, streets, developer carry over from the old plots by overlap area
"""
import json, math, sys, os, urllib.request, collections
import shapely
from shapely.geometry import shape, Polygon, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key, LON_A, LON_B, LAT_A, LAT_B = sys.argv[1], *map(float, sys.argv[2:6])
LAT0, LON0 = (LAT_A + LAT_B) / 2, (LON_A + LON_B) / 2  # must match scripts/<key>.py
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda g: shapely.transform(g, lambda c: [[(x - LON0) * KX, (LAT0 - y) * KY] for x, y in c])
CACHE = f'/home/claude/hkmap/csdi/{key}-lots-raw.json'
WFS = ('https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1637217253134_22729/MapServer/WFSServer'
       '?service=wfs&version=2.0.0&request=GetFeature&typeNames=csdi:Lot&count=2000&startIndex={i}'
       f'&outputFormat=geojson&srsName=EPSG:4326&bbox={LAT_A},{LON_A},{LAT_B},{LON_B},EPSG:4326')
if not os.path.exists(CACHE):
    feats, i = [], 0
    while True:
        page = json.load(urllib.request.urlopen(WFS.format(i=i), timeout=300))['features']
        feats += page; i += 2000
        if len(page) < 2000: break
    os.makedirs(os.path.dirname(CACHE), exist_ok=True); json.dump(feats, open(CACHE, 'w'))
feats = json.load(open(CACHE))

data = json.load(open(f'{ROOT}/data/{key}3.json'))
old, zones = data['lots'], data['blocks']
OG = [Polygon(l['g']).buffer(0) for l in old]
ZG = [Polygon(z['g']).buffer(0) for z in zones]
otree, ztree = STRtree(OG), STRtree(ZG)
KEEP = {'park', 'gov', 'rel', 'comm', 'mark', 'bank'}
keep_ids = [l['id'] for l in old if l['k'] in KEEP]
keep_union = unary_union([OG[i] for i in keep_ids]).buffer(0.5)

# 1. project lots, drop the parts under kept plots, give each to the zone + old plot it overlaps most
G = []  # dicts: g, zone, char, attrs
unused = []  # every government lot (projected); the build uses the ones no plot covers to fill gaps in the play area
for f in feats:
    g = P(shape(f['geometry'])).buffer(0)
    if g.geom_type == 'Polygon' and g.area >= 15: unused.append([round(v, 1) for xy in g.simplify(0.4).exterior.coords[:-1] for v in xy])
    if g.is_empty or g.area < 3: continue
    g = g.difference(keep_union)
    parts = list(g.geoms) if g.geom_type in ('MultiPolygon', 'GeometryCollection') else [g]
    for q in parts:
        if q.geom_type != 'Polygon' or q.area < 3: continue
        ov = [(OG[i].intersection(q).area, i) for i in otree.query(q)]
        ov = [(a, i) for a, i in ov if a > 1 and old[i]['k'] not in KEEP]
        if not ov or sum(a for a, _ in ov) < q.area * 0.1:  # in a gap between old plots: borrow from the nearest one
            near = [(OG[i].distance(q), i) for i in otree.query(q.buffer(40)) if old[i]['k'] not in KEEP]
            if not near:
                continue  # outside the playable map
            ov = [(q.area, min(near)[1])]
        best = max(ov)[1]; o = old[best]
        zv = [(ZG[i].intersection(q).area, i) for i in ztree.query(q)]
        z = max(zv)[1] if zv else o['blk']
        char = ('dev', o['dev']) if o['k'] == 'dev' else ('farm',) if o.get('f') else ('buy',)
        G.append({'g': q, 'z': z, 'char': char, 'ov': ov})
print(len(feats), 'lots ->', len(G), 'pieces')

# 2. group neighbouring pieces with the same character, per zone, into playable plots
TARGET = {'buy': 3500, 'farm': 9000, 'dev': 12000}
MAXA = {'buy': 9000, 'farm': 20000, 'dev': 60000}
tree = STRtree([p['g'] for p in G])
nbr = collections.defaultdict(dict)
for i, p in enumerate(G):
    gb = p['g'].buffer(1.2)
    for j in tree.query(gb):
        if j <= i: continue
        q = G[j]
        if q['z'] != p['z'] or q['char'] != p['char']: continue
        s = gb.intersection(q['g'].buffer(1.2)).area
        if s > 2: nbr[i][j] = nbr[j][i] = s
grp = [-1] * len(G); groups = []
for i in sorted(range(len(G)), key=lambda i: -G[i]['g'].area):
    if grp[i] >= 0: continue
    t = G[i]['char'][0]; mem = [i]; grp[i] = len(groups); area = G[i]['g'].area
    while area < TARGET[t]:
        cand = {}
        for m in mem:
            for j, s in nbr[m].items():
                if grp[j] < 0: cand[j] = cand.get(j, 0) + s
        if not cand: break
        j = max(cand, key=cand.get)
        if area + G[j]['g'].area > MAXA[t]: break
        mem.append(j); grp[j] = len(groups); area += G[j]['g'].area
    groups.append(mem)
# fold tiny leftovers into a neighbouring group
for gi, mem in enumerate(groups):
    if not mem or sum(G[m]['g'].area for m in mem) >= 600: continue
    cand = {}
    for m in mem:
        for j, s in nbr[m].items():
            if grp[j] != gi: cand[grp[j]] = cand.get(grp[j], 0) + s
    if cand:
        tgt = max(cand, key=cand.get)
        for m in mem: grp[m] = tgt
        groups[tgt] += mem; groups[gi] = []

# 3. build plots, carry attributes from old plots by overlap
out = [dict(l) for l in old if l['k'] in KEEP]
for mem in groups:
    if not mem: continue
    u = unary_union([G[m]['g'].buffer(1.3) for m in mem]).buffer(-1.3)
    parts = list(u.geoms) if u.geom_type == 'MultiPolygon' else [u]
    for u in parts:  # a group that isn't one connected shape becomes one plot per piece
      if u.area < 40: continue
      pm = [m for m in mem if G[m]['g'].representative_point().within(u.buffer(1.5))] or mem
      w = collections.Counter()
      for m in pm:
        for a, i in G[m]['ov']: w[i] += a
      base = old[w.most_common(1)[0][0]]
      val = sum(old[i]['p'] * a / max(1, old[i]['m2']) for i, a in w.items())
      rent = sum(old[i]['r'] * a / max(1, old[i]['m2']) for i, a in w.items())
      rp = u.representative_point(); g = u.simplify(0.6)
      k = 'dev' if G[pm[0]]['char'][0] == 'dev' else 'buy'
      out.append({'f': 1 if G[pm[0]]['char'][0] == 'farm' else 0, 'id': 0, 'blk': G[pm[0]]['z'], 'k': k,
                  'n': base['n'] if k == 'dev' or base['n'] in ('農地', '空地') else '', 'also': [], 'dev': base['dev'] if k == 'dev' else '',
                  'a': base['a'], 's': base['s'], 'm2': round(u.area), 'p': max(3, round(val)), 'r': max(0.1, round(rent, 1)),
                  'c': [round(rp.x, 1), round(rp.y, 1)], 'nm': base.get('nm', 0), 'lots': len(pm),
                  'g': [[round(x, 1), round(y, 1)] for x, y in g.exterior.coords[:-1]]})
for i, l in enumerate(out): l['id'] = i
for z in zones: z['lots'] = []
for l in out:
    if 0 <= l['blk'] < len(zones): zones[l['blk']]['lots'].append(l['id'])
keepz = [z for z in zones if z['lots']]
for i, z in enumerate(keepz):
    z['id'] = i
    for li in z['lots']: out[li]['blk'] = i
zones = data['blocks'] = keepz
for z in zones:  # redraw district outline from its new plots (closing small lanes between them)
    u = unary_union([Polygon(out[i]['g']).buffer(0) for i in z['lots']])
    for r in (12, 25):
        v = u.buffer(r).buffer(-r)
        if v.geom_type == 'Polygon': break
    if v.geom_type != 'Polygon': v = max(v.geoms, key=lambda x: x.area)
    z['g'] = [[round(x, 1), round(y, 1)] for x, y in v.simplify(1.5).exterior.coords[:-1]]
for z in zones:
    ks = collections.Counter(out[i]['k'] for i in z['lots'])
    if z['lots']: z['k'] = 'buy' if ks['buy'] or ks['dev'] else ks.most_common(1)[0][0]
data['lots'] = out
json.dump(data, open(f'{ROOT}/data/{key}4.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'g': [u for u in unused if u]}, open(f'{ROOT}/data/{key}-gaplots.json', 'w'), separators=(',', ':'))
c = collections.Counter((l['k'], l['f']) for l in out)
print(f'{len(old)} old plots -> {len(out)} plots', dict(c))
print('buy plot m2 quartiles', sorted(l['m2'] for l in out if l['k'] == 'buy')[len(out) // 8 :: len(out) // 4][:4])
