"""Build a playable district page from generated data + Herbert's map edits.

    python3 scripts/build_html.py yuenlong [path/to/new-export.json]

- data/<key>3.json        generated map (from scripts/<key>3.py) — never hand-edited
- edits/<key>.json        master edit file (made in the page's 編輯地圖 mode)
- a new export, if given, is merged into the master edit file first
- writes prototypes/<key>-monopoly.html
"""
import json, sys, os, collections, math
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = sys.argv[1]
dp = f'{ROOT}/data/{key}4.json' if os.path.exists(f'{ROOT}/data/{key}4.json') else f'{ROOT}/data/{key}3.json'  # 4 = rebuilt on land lots
data = json.load(open(dp))
ep = f'{ROOT}/edits/{key}.json'
E = json.load(open(ep)) if os.path.exists(ep) else {}
for k in ('lots', 'merge', 'erase'): E.setdefault(k, [] if k != 'lots' else {})

if len(sys.argv) > 2:  # merge a fresh export: it carries every lot edit + stroke already, merges are added
    X = json.load(open(sys.argv[2]))
    E['lots'] = X.get('lots', {})
    E['erase'] = X.get('erase', [])
    seen = {json.dumps(m) for m in E['merge']}
    E['merge'] += [m for m in X.get('merge', []) if json.dumps(m) not in seen]
    os.makedirs(os.path.dirname(ep), exist_ok=True)
    json.dump(E, open(ep, 'w'), ensure_ascii=False, indent=1)

CO = json.load(open(f'{ROOT}/data/companies.json'))
OLD2NEW = {w: c['name'] for c in CO['major'] for w in c['was']}
for e in E['lots'].values():
    if e.get('dev') in OLD2NEW: e['dev'] = OLD2NEW[e['dev']]
wp = f'{ROOT}/data/{key}-water.json'
if os.path.exists(wp): data['water'] = json.load(open(wp))['w']  # rivers / ponds drawn on their own; outside-map colour is free
L = data['lots']
def find(c):
    best = min(L, key=lambda l: (l['c'][0] - c[0]) ** 2 + (l['c'][1] - c[1]) ** 2)
    return best if (best['c'][0] - c[0]) ** 2 + (best['c'][1] - c[1]) ** 2 < 400 else None
def apply(l, e):
    if e.get('t'): l['k'] = 'buy' if e['t'] == 'farm' else e['t']; l['f'] = 1 if e['t'] == 'farm' else 0
    for a in ('n', 'dev'):
        if a in e: l[a] = e[a]
    if e.get('p'): l['p'] = int(e['p']); l['r'] = round(l['p'] * 0.06, 1)

# land wiped with the 刪地 brush: a plot goes when the latest land stroke over its centre is a wipe
def seg_d(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) if L2 else 0
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
def stroke_hit(p, s):
    q = s[2]
    if len(q) == 1: return math.hypot(p[0] - q[0][0], p[1] - q[0][1]) < s[1]
    return any(seg_d(p, q[i - 1], q[i]) < s[1] for i in range(1, len(q)))
def land_wiped(p):
    h = False
    for s in E['erase']:
        if s[0] in ('L', 'R') and stroke_hit(p, s): h = s[0] == 'L'
    return h
# match lot edits on the generated geometry first, then merge, then apply edits to surviving lots
gone, miss = set(), []
targets = [(k, find([float(v) for v in k.split(',')]), e) for k, e in E['lots'].items()]
wiped_n = 0
if any(s[0] == 'L' for s in E['erase']):
    from shapely.geometry import LineString as _LS
    W = None
    for s_ in E['erase']:  # net wiped area, strokes in order (補地 strokes give land back)
        if s_[0] not in ('L', 'R'): continue
        q = s_[2]; g = (Point(q[0]) if len(q) == 1 else _LS(q)).buffer(s_[1])
        W = (g if W is None else W.union(g)) if s_[0] == 'L' else (W.difference(g) if W is not None else None)
    for l in L:  # a plot goes when its centre, or 40% of its area, was swept
        pg = Polygon(l['g']).buffer(0)
        if land_wiped(l['c']) or (W is not None and pg.intersection(W).area >= 0.4 * pg.area):
            gone.add(l['id']); wiped_n += 1
    # districts whose name point was wiped are deleted; their remaining plots join the nearest district
    dead = {a_[0] for a_ in data['areas'] if land_wiped([a_[1], a_[2]])}
    live_a = [a_ for a_ in data['areas'] if a_[0] not in dead]
    if dead and live_a:
        for l in L:
            if l['a'] in dead:
                l['a'] = min(live_a, key=lambda a_: (a_[1] - l['c'][0]) ** 2 + (a_[2] - l['c'][1]) ** 2)[0]
        for z in data['blocks']:
            if z.get('a') in dead:
                z['a'] = min(live_a, key=lambda a_: (a_[1] - z['g'][0][0]) ** 2 + (a_[2] - z['g'][0][1]) ** 2)[0]
        data['areas'] = live_a
        print('districts removed:', sorted(dead))
for cut in E.get('cut', []):  # whole areas cut off (e.g. 朗屏路以北), optionally only one district's plots
    cg = Polygon(cut['g']).buffer(0)
    for l in L:
        if l['id'] not in gone and cg.contains(Point(l['c'])) and (not cut.get('only') or l['a'] == cut['only']):
            gone.add(l['id']); wiped_n += 1
if E.get('cut'): E['erase'].append(['L', 0.1, [[1e6, 1e6]]])  # make the play-area trim run even without brush strokes
pairs = [(find(a_c), find(b_c), a_c, b_c) for a_c, b_c in E['merge']]  # resolve before shapes/centres change
todo = list(pairs)
while todo:  # repeat passes: a plot may only touch the group once others have joined it
    left = []
    for a, b, a_c, b_c in todo:
        if not a or not b or a is b or a['id'] in gone or b['id'] in gone: miss.append((a_c, b_c)); continue
        for r in (1, 3, 6, 10, 15):  # allow a lane / field path between plots
            u = unary_union([Polygon(a['g']).buffer(r), Polygon(b['g']).buffer(r)]).buffer(-r)
            if u.geom_type == 'Polygon': break
        if u.geom_type != 'Polygon': left.append((a, b, a_c, b_c)); continue
        a['g'] = [[round(x, 1), round(y, 1)] for x, y in u.simplify(1).exterior.coords]
        a['m2'] += b['m2']; a['p'] += b['p']; a['r'] = round(a['p'] * 0.06, 1)
        rp = u.representative_point(); a['c'] = [round(rp.x, 1), round(rp.y, 1)]
        gone.add(b['id'])
    if len(left) == len(todo): miss += [(x[2], x[3]) for x in left]; break
    todo = left
# government building footprints: attach to lots, fill in names players can recognise
bp = f'{ROOT}/data/{key}-bld.json'
if os.path.exists(bp):
    from shapely.strtree import STRtree
    import re
    live = [l for l in L if l['id'] not in gone]
    tree = STRtree([Polygon(l['g']) for l in live])
    names = collections.defaultdict(list)
    B = json.load(open(bp))['b']
    for b in B:
        xy = b[0]; poly = Polygon(list(zip(xy[0::2], xy[1::2]))); c = poly.representative_point()
        hits = [live[i] for i in tree.query(c) if Polygon(live[i]['g']).contains(c)]
        b.append(hits[0]['id'] if hits else -1)
        if hits and b[1]:
            base = re.sub(r'\s*(第?[0-9０-９A-ZＡ-Ｚ一二三四五六七八九十]+(座|期|號舖))+$', '', b[1]).strip() or b[1]
            names[hits[0]['id']].append((poly.area, base))
    cover = collections.Counter()
    for b in B:
        if b[3] >= 0: cover[b[3]] += Polygon(list(zip(b[0][0::2], b[0][1::2]))).area
    fixed = 0
    for l in live:  # OSM-only "farmland / empty" guesses that actually have buildings on them
        if l['k'] == 'buy' and l.get('f') and cover[l['id']] > 0.25 * l['m2']:
            l['f'] = 0; l['p'] = round(l['p'] / 0.45); l['r'] = round(l['r'] / 0.45, 1); fixed += 1
            if l['n'] in ('農地', '空地'): l['n'] = ''
        elif l['k'] == 'buy' and not l.get('f') and l['n'] == '空地' and cover[l['id']] > 0.12 * l['m2']: l['n'] = ''
    print('farmland/empty labels corrected by building cover:', fixed)
    for l in live:
        ns = []
        for _, n in sorted(names[l['id']], reverse=True):
            if n not in ns: ns.append(n)
        if not ns: continue
        if not l['n'] and l['k'] in ('buy', 'dev'): l['n'] = ns[0]
        l['also'] = [n for n in ns if n != l['n']][:4]
    data['bld'] = B
for k, l, e in targets:
    if l is None: miss.append(k)
    elif l['id'] not in gone: apply(l, e)

# renumber lots, fix zone membership + zone kind
keep = [l for l in L if l['id'] not in gone]
remap = {l['id']: i for i, l in enumerate(keep)}
for l in keep: l['id'] = remap[l['id']]
for z in data['blocks']:
    z['lots'] = [remap[i] for i in z['lots'] if i in remap]
    ks = collections.Counter(keep[i]['k'] for i in z['lots'])
    if z['lots']: z['k'] = 'buy' if ks['buy'] or ks['dev'] else ks.most_common(1)[0][0]
data['lots'] = keep
# ---- background map around the district (not playable) ----
cp = f'{ROOT}/data/{key}-ctx.json'
if os.path.exists(cp):
    CX = json.load(open(cp))
    data['roads'] += CX['roads']; data['labels'] += CX['labels']; data['ctxlu'] = CX['landuse']
    x0, y0, x1, y1 = CX['bounds']
    data['land'].append([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]])  # inland: the whole wider box is land
    data['ctxbounds'] = CX['bounds']
# ---- trim the map to the play area left after 刪地 (clean edge instead of brush marks) ----
trim_note = ''
if any(s[0] == 'L' for s in E['erase']):
    from shapely.geometry import LineString, box as sbox
    polys = [Polygon(l['g']).buffer(0) for l in keep]
    blob = unary_union([p.buffer(25) for p in polys]).buffer(-15)
    parts = sorted(blob.geoms if blob.geom_type == 'MultiPolygon' else [blob], key=lambda p: -p.area)
    main = [p for p in parts if p.area >= parts[0].area * 0.04]  # drop stray islands left by rough wiping
    play = unary_union([Polygon(p.exterior) for p in main])     # no holes inside the play area
    cl = unary_union([p.buffer(0) for p in polys]).buffer(160).buffer(-150)   # close bays/gaps between plots
    play = unary_union([play] + [Polygon(g.exterior) for g in (cl.geoms if hasattr(cl, 'geoms') else [cl]) if play.intersects(g)])
    gp = f'{ROOT}/data/{key}-gaplots.json'
    if os.path.exists(gp):  # government lots inside the play area that no plot covers yet -> new plots
        have = unary_union(polys).buffer(1)
        cand = []
        for q in json.load(open(gp))['g']:
            g = Polygon(list(zip(q[0::2], q[1::2]))).buffer(0)
            if g.area >= 15 and play.contains(g.representative_point()) and g.intersection(have).area < 0.3 * g.area:
                cand.append(g.difference(have))
        cu = unary_union(cand).buffer(1).buffer(-1) if cand else None
        added = 0
        for g in (cu.geoms if cu is not None and hasattr(cu, 'geoms') else ([cu] if cu is not None else [])):
            if g.geom_type != 'Polygon' or g.area < 60: continue
            rp = g.representative_point()
            nb = min(keep, key=lambda l: Polygon(l['g']).distance(rp))
            ppm = nb['p'] / max(1, nb['m2'])
            keep.append({'f': nb.get('f', 0) if nb['k'] == 'buy' else 0, 'id': len(keep), 'blk': nb['blk'], 'k': 'buy', 'n': '', 'also': [], 'dev': '',
                         'a': nb['a'], 's': nb['s'], 'm2': round(g.area), 'p': max(3, round(ppm * g.area)), 'r': max(0.1, round(ppm * g.area * 0.06, 1)),
                         'c': [round(rp.x, 1), round(rp.y, 1)], 'nm': 0, 'gap': 1,
                         'g': [[round(x, 1), round(y, 1)] for x, y in g.simplify(0.6).exterior.coords[:-1]]})
            data['blocks'][nb['blk']]['lots'].append(keep[-1]['id']) if 0 <= nb['blk'] < len(data['blocks']) else None
            polys.append(g); added += 1
        data['lots'] = keep
        print('gap lots added as plots:', added)
    stray = [l for l, p in zip(keep, polys) if not play.buffer(5).contains(p.representative_point())]
    if stray:
        sid = {l['id'] for l in stray}
        keep = [l for l in keep if l['id'] not in sid]
        rm2 = {l['id']: i for i, l in enumerate(keep)}
        for l in keep: l['id'] = rm2[l['id']]
        for z in data['blocks']: z['lots'] = [rm2[i] for i in z['lots'] if i in rm2]
        for b in data.get('bld', []): b[3] = rm2.get(b[3], -1)
        remap = {o: rm2[n] for o, n in remap.items() if n in rm2}
        data['lots'] = keep
    edge = play.buffer(35).simplify(2)                          # land shown around the plots
    def ring(g): return [[round(x, 1), round(y, 1)] for x, y in g.exterior.coords[:-1]]
    # outside the play area the real map stays (land, roads, buildings, water) and the page darkens it
    land = unary_union([Polygon(r[0]).buffer(0) for r in data['land']] + [edge])
    data['land'] = [[ring(p)] for p in (land.geoms if land.geom_type == 'MultiPolygon' else [land]) if p.geom_type == 'Polygon' and p.area > 50]
    data['play'] = [ring(p) for p in (edge.geoms if edge.geom_type == 'MultiPolygon' else [edge]) if p.geom_type == 'Polygon']
    # plots that were cut away stay as background shapes under the veil (not playable), so the map still reads
    if 'bld' in data:  # background is kept simple: building outlines only inside the play area
        data['bld'] = [b for b in data['bld'] if edge.contains(Point(b[0][0], b[0][1]))]
    if 'water' in data:  # keep water on land only (drops stray specks), inside and outside the play area
        lb = land.buffer(2); nw = []
        for w in data['water']:
            g = Polygon(list(zip(w[0::2], w[1::2]))).buffer(0).intersection(lb)
            for q in (g.geoms if hasattr(g, 'geoms') else [g]):
                if q.geom_type == 'Polygon' and q.area > 30: nw.append([round(v, 1) for xy in q.exterior.coords[:-1] for v in xy])
        data['water'] = nw
    x0, y0, x1, y1 = edge.bounds; m = 120
    data['bounds'] = [round(x0 - m), round(y0 - m), round(x1 + m), round(y1 + m)]
    nz = []  # redraw district outlines from their plots; a district split by a river/road becomes one zone per piece
    for z in data['blocks']:
        if not z['lots']: continue
        mem = [data['lots'][i] for i in z['lots']]
        u = unary_union([Polygon(l['g']).buffer(0) for l in mem])
        v = u.buffer(12).buffer(-12)
        pieces = list(v.geoms) if v.geom_type == 'MultiPolygon' else [v]
        for pc in pieces:
            sub = [l for l in mem if pc.buffer(3).contains(Polygon(l['g']).buffer(0).representative_point())]
            if not sub: continue
            z2 = dict(z); z2['lots'] = [l['id'] for l in sub]
            z2['g'] = [[round(x, 1), round(y, 1)] for x, y in pc.simplify(1.5).exterior.coords[:-1]]
            nz.append(z2)
    for i, z in enumerate(nz):
        z['id'] = i
        for li in z['lots']: data['lots'][li]['blk'] = i
    data['blocks'] = nz
    E['erase'] = [s for s in E['erase'] if s[0] not in ('L', 'R')]  # baked into the map now
    trim_note = f', trimmed to play area ({len(stray)} stray plots dropped)'
kz = [z for z in data['blocks'] if z['lots']]; zm = {z['id']: i for i, z in enumerate(kz)}
for i, z in enumerate(kz): z['id'] = i
for l in keep: l['blk'] = zm.get(l['blk'], -1)
data['blocks'] = kz
for b in data.get('bld', []): b[3] = remap.get(b[3], -1)
data['key'] = key
data['companies'] = json.load(open(f'{ROOT}/data/companies.json'))  # single owner list, from the design doc
import time
data['edits'] = {'v': 1, 'build': int(time.time()), 'lots': E['lots'], 'merge': [], 'erase': E['erase']}  # merges + land wipes are baked in

tpl = open(f'{ROOT}/scripts/{key}-template.html').read()
pre, ui = open(f'{ROOT}/scripts/editor.js').read().split('//==UI==')
assert 'const M=__DATA__;' in tpl and tpl.count('<script>') == 1
tpl = tpl.replace('const M=__DATA__;', 'const M=__DATA__;preEdits(M);')
tpl = tpl.replace('<script>', '<script>' + pre + '</script>\n<script>', 1)
tpl = tpl.rstrip() + '\n<script>' + ui + '</script>\n'
out = tpl.replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':')), 1)
open(f'{ROOT}/prototypes/{key}-monopoly.html', 'w').write(out)
print(f'{key}: {len(data["lots"])} lots, {wiped_n} wiped, {len(gone) - wiped_n} merged, {len(E["lots"])} lot edits, {len(E["erase"])} road strokes, not matched: {miss}{trim_note}')
