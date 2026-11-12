"""Build a playable district page from generated data + Herbert's map edits.

    python3 scripts/build_html.py yuenlong [path/to/new-export.json]

- data/<key>3.json        generated map (from scripts/<key>3.py) — never hand-edited
- edits/<key>.json        master edit file (made in the page's 編輯地圖 mode)
- a new export, if given, is merged into the master edit file first
- writes prototypes/<key>-monopoly.html
"""
import json, sys, os, collections
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = sys.argv[1]
data = json.load(open(f'{ROOT}/data/{key}3.json'))
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

# match lot edits on the generated geometry first, then merge, then apply edits to surviving lots
gone, miss = set(), []
targets = [(k, find([float(v) for v in k.split(',')]), e) for k, e in E['lots'].items()]
for a_c, b_c in E['merge']:
    a, b = find(a_c), find(b_c)
    if not a or not b or a is b or a['id'] in gone or b['id'] in gone: miss.append((a_c, b_c)); continue
    u = unary_union([Polygon(a['g']).buffer(1), Polygon(b['g']).buffer(1)]).buffer(-1)
    if u.geom_type != 'Polygon': miss.append((a_c, b_c)); continue
    a['g'] = [[round(x, 1), round(y, 1)] for x, y in u.simplify(1).exterior.coords]
    a['m2'] += b['m2']; a['p'] += b['p']; a['r'] = round(a['p'] * 0.06, 1)
    rp = u.representative_point(); a['c'] = [round(rp.x, 1), round(rp.y, 1)]
    gone.add(b['id'])
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
print(f'{key}: {len(keep)} lots, {len(gone)} merged, {len(E["lots"])} lot edits, {len(E["erase"])} road strokes, not matched: {miss}')
