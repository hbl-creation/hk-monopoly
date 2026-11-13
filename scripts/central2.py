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
    '置業集團': ['遮打大廈', '歷山大廈', '太子大廈', '置地廣塲中庭', '告羅士打大廈', '約克大廈', '公爵大廈', '交易廣場第二座', '交易廣場第三座', '怡和大廈'],
    '黃河集團': ['長江集團中心', '長江集團中心二期'],
    '新鴻記': ['國際金融中心一期', '國際金融中心商場', '國際金融中心二期', '四季酒店', '四季匯'],
    '太府地產': ['太古廣場三座', '太古廣場五座', '太古廣場'],
    '順德集團': ['信德中心'],
    '九龍及匯德峯': ['會德豐大廈'],
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

LOT_MIN = 260
lots = []
def lot_price(area, an, prem):
    return max(3, round(area ** 0.75 * RATE[an] * prem * 0.03))
for b, c in zip(out, cells):
    if b['k'] == 'mark' and b['n'] == '置地廣場':
        ins = [x[0] for x in bl if c.contains(x[1].representative_point())]
        if '置地廣塲中庭' not in ins: b['k'], b['n'] = 'buy', ''
for b, c in zip(out, cells):
    b['lots'] = []
    prem = max([PREM.get(s, 1) for s in b['s']] + [1])
    inside = [bl[i] for i in btree.query(c) if c.contains(bl[i][1].representative_point())]
    devs = [dev_of[x[0]] for x in inside if x[0] in dev_of]
    if b['k'] != 'buy' or len(inside) <= 1:
        nm = b['n'] if b['k'] != 'buy' else (inside[0][0] if inside and inside[0][0] else b['b'])
        d = devs[0] if devs else ''
        lots.append({'blk': b['id'], 'k': b['k'] if b['k'] != 'buy' else ('dev' if d else 'buy'), 'n': nm, 'dev': d, 'geom': c, 'an': b['a'], 'prem': prem, 's': b['s']})
        b['lots'].append(len(lots) - 1); continue
    seeds = MultiPoint([x[1].representative_point() for x in inside])
    vor = voronoi_diagram(seeds, envelope=c.buffer(50))
    parts = []
    for x in inside:
        rp = x[1].representative_point()
        cell = next((v for v in vor.geoms if v.contains(rp)), None)
        if cell is None: continue
        g = cell.intersection(c)
        if g.geom_type == 'MultiPolygon': g = max(g.geoms, key=lambda q: q.area)
        if g.geom_type == 'Polygon' and g.area > 5: parts.append({'g': g, 'names': [x[0]] if x[0] else [], 'big': x[1].area})
    # merge small parts into the neighbour sharing the longest edge
    changed = True
    while changed and len(parts) > 1:
        changed = False
        parts.sort(key=lambda q: q['g'].area)
        sm = parts[0]
        if sm['g'].area >= LOT_MIN and not (len(parts) > 14 and sm['g'].area < 700): break
        best, bl_len = None, 0
        for q in parts[1:]:
            L = sm['g'].boundary.intersection(q['g'].boundary.buffer(0.5)).length
            if L > bl_len: best, bl_len = q, L
        if best is None: break
        best['g'] = unary_union([best['g'], sm['g']]).buffer(0.01).buffer(-0.01)
        if best['g'].geom_type == 'MultiPolygon': best['g'] = max(best['g'].geoms, key=lambda q: q.area)
        best['names'] += sm['names']; best['big'] = max(best['big'], sm['big'])
        parts.remove(sm); changed = True
    for q in parts:
        nm = next((n for n in q['names'] if n), '')
        d = next((dev_of[n] for n in q['names'] if n in dev_of), '')
        lots.append({'blk': b['id'], 'k': 'dev' if d else 'buy', 'n': nm, 'dev': d, 'geom': q['g'], 'an': b['a'], 'prem': prem, 's': b['s']})
        b['lots'].append(len(lots) - 1)

# finalize lots
rtree2 = STRtree([g for p, g in roads])
L_out = []
for i, L in enumerate(lots):
    g = L['geom']
    near = {}
    for j in rtree2.query(g.exterior.buffer(9)):
        p, rg = roads[j]; n = zh(p['name'])
        if not n or p['fclass'] in ('footway', 'steps', 'path'): continue
        ln = rg.intersection(g.exterior.buffer(9)).length
        if ln > 8: near[n] = near.get(n, 0) + ln
    st = [s for s, _ in sorted(near.items(), key=lambda kv: -kv[1])][:2] or L['s'][:2]
    price = lot_price(g.area, L['an'], max([PREM.get(s, 1) for s in st] + [1]))
    if L['k'] == 'dev': price = round(price * 1.3)
    rp = g.representative_point()
    L_out.append({'id': i, 'blk': L['blk'], 'k': L['k'], 'n': L['n'], 'dev': L['dev'], 'a': L['an'], 's': st, 'm2': round(g.area), 'p': price,
                  'r': round(price * 0.06, 1), 'c': [round(rp.x, 1), round(rp.y, 1)],
                  'g': [[round(x, 1), round(y, 1)] for x, y in g.simplify(0.6).exterior.coords]})
# landmark neighbour boost at lot level
lpoly = [Polygon(l['g']) for l in L_out]
ltree = STRtree(lpoly)
for i, l in enumerate(L_out):
    l['nm'] = 1 if any(L_out[j]['k'] == 'mark' for j in ltree.query(lpoly[i].buffer(25)) if j != i) else 0
for b in out:
    b.pop('nb', None); b.pop('b', None); b.pop('p', None); b.pop('r', None)
    b['g'] = [[round(x, 1), round(y, 1)] for x, y in Polygon(b['g']).simplify(1.5).exterior.coords]
data['blocks'] = out
data['lots'] = L_out
data['devs'] = list(DEV.keys())
s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open('/home/claude/hkmap/central2.json', 'w').write(s)
print('lots', len(L_out), collections.Counter(l['k'] for l in L_out), 'size', len(s) // 1024, 'KB')
print('named lots', sum(1 for l in L_out if l['n']), 'dev lots', [(l['dev'], l['n']) for l in L_out if l['dev']])
ps = sorted(l['p'] for l in L_out if l['k'] == 'buy'); print('prices', ps[0], ps[len(ps)//4], ps[len(ps)//2], ps[3*len(ps)//4], ps[-1])
