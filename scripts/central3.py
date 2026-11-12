exec(open('/home/claude/hkmap/central.py').read())
from shapely.geometry import MultiPoint
from shapely.ops import voronoi_diagram

# ---- manual fixes to block kinds
KEEP_MARK = {'國際金融中心', '交易廣場', '置地廣場', '大館', '香港大會堂', '中環街市', '西港城', '太古廣場'}
for b in out:
    if b['n'] == '西港城': b['k'] = 'mark'
    if b['k'] == 'mark' and b['n'] not in KEEP_MARK: b['k'], b['n'] = 'buy', ''
    if b['k'] == 'gov' and b['n'] == '中區軍用碼頭' and b['m2'] > 60000: b['k'], b['n'] = 'buy', ''

# ---- developers (sound-alike names)
DEV = {
    '致地集團': ['遮打大廈', '歷山大廈', '太子大廈', '置地廣塲中庭', '告羅士打大廈', '約克大廈', '公爵大廈', '交易廣場第二座', '交易廣場第三座', '怡和大廈'],
    '常實集團': ['長江集團中心', '長江集團中心二期'],
    '新紅基地產': ['國際金融中心一期', '國際金融中心商場', '國際金融中心二期', '四季酒店', '四季匯'],
    '泰古地產': ['太古廣場三座', '太古廣場五座', '太古廣場'],
    '迅德集團': ['信德中心'],
    '九艙集團': ['會德豐大廈'],
}
MANUAL = [('怡和大廈', 114.1590, 22.2843), ('長江集團中心', 114.1604, 22.2796), ('國際金融中心二期', 114.1590, 22.2856)]
bl = [[zh(p['name']), g.buffer(0), p['type']] for p, g in blds if g.area > 40 and p['type'] not in ('roof',)]
for name, lon, lat in MANUAL:
    pt = P(Point(lon, lat))
    cand = [x for x in bl if not x[0] and x[1].distance(pt) < 80 and x[1].area > 600]
    if cand: min(cand, key=lambda x: x[1].distance(pt))[0] = name; print('manual', name, 'ok')
    else: print('manual', name, 'MISS')
dev_of = {n: d for d, ns in DEV.items() for n in ns}
btree = STRtree([x[1] for x in bl])


def bprice(area, an, prem): return min(240, max(4, round(area ** 0.75 * RATE[an] * prem * 0.022)))
# zones for far zoom: polygonize with main roads only
MAJ = {'motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link','primary_link','secondary_link'}
zcut = [g for p, g in roads if p['fclass'] in MAJ and p['bridge'] != 'T' and p['tunnel'] != 'T' and str(p['layer']) in ('0','None')]
zones = []
for f in polygonize(unary_union(zcut + [land.boundary] if land.geom_type == 'Polygon' else zcut + [g.boundary for g in land.geoms])):
    q = f.intersection(land)
    for g in (q.geoms if q.geom_type == 'MultiPolygon' else [q]):
        if g.geom_type == 'Polygon' and g.area > 200: zones.append(g)
ztree = STRtree(zones)
for b, c in zip(out, cells):
    if b['k'] == 'mark' and b['n'] == '置地廣場':
        ins = [x[0] for x in bl if c.contains(x[1].representative_point())]
        if '置地廣塲中庭' not in ins: b['k'], b['n'] = 'buy', ''
import numpy as np, copy
pairs = []
for b, c in zip(out, cells):
    if b['k'] not in ('buy',) or c.area < 25000: pairs.append((b, c)); continue
    pts_ = [x[1].representative_point() for x in bl if c.contains(x[1].representative_point())]
    n = max(2, round(c.area / 9000))
    n = min(n, len(pts_))
    if n < 2: pairs.append((b, c)); continue
    X = np.array([[p.x, p.y] for p in pts_]); rng = np.random.default_rng(3)
    C = X[rng.choice(len(X), n, replace=False)]
    for _ in range(25):
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([X[lab == i].mean(0) if (lab == i).any() else C[i] for i in range(n)])
    vor = voronoi_diagram(MultiPoint([Point(*p) for p in C]), envelope=c.buffer(100))
    for v in vor.geoms:
        g = v.intersection(c)
        for gg in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
            if gg.geom_type == 'Polygon' and gg.area > 800:
                nb_ = copy.deepcopy(b); nb_['m2'] = round(gg.area); nb_['g'] = [[round(x, 1), round(y, 1)] for x, y in gg.simplify(1.5).exterior.coords]
                pairs.append((nb_, gg))
for i, (b, c) in enumerate(pairs): b['id'] = i
print('after split', len(pairs))
L_out = []
for b, c in pairs:
    inside = [bl[i] for i in btree.query(c) if c.contains(bl[i][1].representative_point())]
    bsum = sum(x[1].area for x in inside) or 1
    devshare = {}
    for x in inside:
        if x[0] in dev_of: devshare[dev_of[x[0]]] = devshare.get(dev_of[x[0]], 0) + x[1].area
    dev = max(devshare, key=devshare.get) if devshare else ''
    k = b['k']
    big = max(inside, key=lambda x: x[1].area)[0] if inside else ''
    if k == 'buy' and dev and (devshare[dev] / bsum >= 0.35 or big in dev_of): k = 'dev'
    elif k != 'mark': dev = '' if k == 'buy' else dev
    named = sorted([x for x in inside if x[0]], key=lambda x: -x[1].area)
    nm = b['n'] if b['k'] != 'buy' else (named[0][0] if named else '')
    if k == 'dev': nm = max([x for x in inside if x[0] in dev_of and dev_of[x[0]] == dev], key=lambda x: x[1].area)[0]
    also = [x[0] for x in named if x[0] != nm][:3]
    if k == 'buy' and any(g_ in nm for g_ in GOVK + ['博物館', '文物館', '市政大廈', '圖書館']): k = 'gov'
    if k == 'buy' and any(g_ in nm for g_ in ['公園', '體育館', '遊樂場']) and not any(x in nm for x in ['花園大廈', '花園台']): k = 'park'
    prem = max([PREM.get(s, 1) for s in b['s']] + [1])
    price = bprice(c.area, b['a'], prem)
    if k == 'dev': price = round(price * 1.3)
    rp = c.representative_point()
    zi = [int(j) for j in ztree.query(rp) if zones[j].contains(rp)]
    L_out.append({'id': b['id'], 'blk': zi[0] if zi else -1, 'k': k, 'n': nm, 'also': also, 'dev': dev, 'a': b['a'], 's': b['s'][:2], 'm2': b['m2'], 'p': price,
                  'r': round(price * 0.06, 1), 'c': [round(rp.x, 1), round(rp.y, 1)], 'g': b['g']})
lpoly = [Polygon(l['g']) for l in L_out]; ltree = STRtree(lpoly)
for i, l in enumerate(L_out):
    l['nm'] = 1 if l['k'] in ('buy', 'dev') and any(L_out[j]['k'] == 'mark' for j in ltree.query(lpoly[i].buffer(25)) if j != i) else 0
# zone records
Z = []
for zi, z in enumerate(zones):
    mem = [l['id'] for l in L_out if l['blk'] == zi]
    if not mem: continue
    kinds = collections.Counter(L_out[i]['k'] for i in mem)
    area = collections.Counter(); [area.update({L_out[i]['a']: L_out[i]['m2']}) for i in mem]
    buyable = [i for i in mem if L_out[i]['k'] in ('buy', 'dev')]
    zk = 'buy' if buyable else kinds.most_common(1)[0][0]
    Z.append({'id': len(Z), 'k': zk, 'a': area.most_common(1)[0][0], 'lots': mem, 'n': '',
              'g': [[round(x, 1), round(y, 1)] for x, y in z.simplify(1.5).exterior.coords]})
    for i in mem: L_out[i]['blk'] = len(Z) - 1
orph = [l for l in L_out if l['blk'] == -1]
for l in orph:
    Z.append({'id': len(Z), 'k': l['k'] if l['k'] not in ('dev',) else 'buy', 'a': l['a'], 'lots': [l['id']], 'n': '', 'g': l['g']}); l['blk'] = len(Z) - 1
data['blocks'] = Z; data['lots'] = L_out; data['devs'] = list(DEV.keys())
s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open('/home/claude/hkmap/central3.json', 'w').write(s)
print('zones', len(Z), 'blocks', len(L_out), collections.Counter(l['k'] for l in L_out), len(s)//1024, 'KB')
print([(l['dev'], l['n']) for l in L_out if l['dev']])
ps = sorted(l['p'] for l in L_out if l['k'] == 'buy'); print('prices', ps[0], ps[len(ps)//4], ps[len(ps)//2], ps[3*len(ps)//4], ps[-1])
print('unnamed buy', sum(1 for l in L_out if l['k']=='buy' and not l['n']))
