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
for l in L:
    if land_wiped(l['c']): gone.add(l['id']); wiped_n += 1
for a_c, b_c in E['merge']:
    a, b = find(a_c), find(b_c)
    if not a or not b or a is b or a['id'] in gone or b['id'] in gone: miss.append((a_c, b_c)); continue
    u = unary_union([Polygon(a['g']).buffer(1), Polygon(b['g']).buffer(1)]).buffer(-1)
    if u.geom_type != 'Polygon': miss.append((a_c, b_c)); continue
    a['g'] = [[round(x, 1), round(y, 1)] for x, y in u.simplify(1).exterior.coords]
    a['m2'] += b['m2']; a['p'] += b['p']; a['r'] = round(a['p'] * 0.06, 1)
    rp = u.representative_point(); a['c'] = [round(rp.x, 1), round(rp.y, 1)]
    gone.add(b['id'])
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
kz = [z for z in data['blocks'] if z['lots']]; zm = {z['id']: i for i, z in enumerate(kz)}
for i, z in enumerate(kz): z['id'] = i
for l in keep: l['blk'] = zm.get(l['blk'], -1)
data['blocks'] = kz
for b in data.get('bld', []): b[3] = remap.get(b[3], -1)
data['key'] = key
data['edits'] = {'v': 1, 'lots': E['lots'], 'merge': [], 'erase': E['erase']}  # merges are baked in

tpl = open(f'{ROOT}/scripts/{key}-template.html').read()
pre, ui = open(f'{ROOT}/scripts/editor.js').read().split('//==UI==')
assert 'const M=__DATA__;' in tpl and tpl.count('<script>') == 1
tpl = tpl.replace('const M=__DATA__;', 'const M=__DATA__;preEdits(M);')
tpl = tpl.replace('<script>', '<script>' + pre + '</script>\n<script>', 1)
tpl = tpl.rstrip() + '\n<script>' + ui + '</script>\n'
out = tpl.replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':')), 1)
open(f'{ROOT}/prototypes/{key}-monopoly.html', 'w').write(out)
print(f'{key}: {len(keep)} lots, {wiped_n} wiped, {len(gone) - wiped_n} merged, {len(E["lots"])} lot edits, {len(E["erase"])} road strokes, not matched: {miss}')
