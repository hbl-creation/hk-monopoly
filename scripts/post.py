import json, math
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
d = json.load(open('/home/claude/hkmap/ytm.json'))
LAT0, LON0 = 22.31, 114.17
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
P = lambda lon, lat: Point((lon - LON0) * KX, (LAT0 - lat) * KY)
RATE = {'尖沙咀': 2.4, '尖東': 2.1, '旺角': 2.2, '佐敦': 1.6, '油麻地': 1.5, '大角咀': 1.1, '太子': 1.4, '西九龍': 1.3, '京士柏': 1.2}
PREM = {'彌敦道': 1.5, '廣東道': 1.6, '西洋菜南街': 1.35, '亞皆老街': 1.15, '加連威老道': 1.2, '梳士巴利道': 1.4, '漢口道': 1.15, '花園街': 1.1, '通菜街': 1.15, '廟街': 1.1, '佐敦道': 1.1, '么地道': 1.1, '麼地道': 1.1, '山林道': 1.05, '金巴利道': 1.1}
POI = [('海港城','廣東道',114.1688,22.2965),('半島酒店','梳士巴利道',114.1717,22.2951),('1881','廣東道',114.1700,22.2948),('九龍公園','柯士甸道',114.1700,22.3010),('重慶大廈','彌敦道',114.1722,22.2966),('朗豪坊','砵蘭街',114.1685,22.3178),
('女人街','通菜街',114.1712,22.3185),('西洋菜街行人專用區','西洋菜南街',114.1700,22.3190),('波鞋街','花園街',114.1722,22.3205),('金魚街','通菜街',114.1705,22.3222),('旺角大球場','界限街',114.1735,22.3243),('雀仔街','園圃街',114.1728,22.3252),('花墟','花墟道',114.1735,22.3262),
('廟街夜市','廟街',114.1700,22.3065),('天后廟','眾坊街',114.1700,22.3100),('油麻地果欄','窩打老道',114.1660,22.3115),('K11 MUSEA','梳士巴利道',114.1745,22.2945),('伊利沙伯醫院','衛理道',114.1760,22.3090)]
blocks = d['blocks']
polys = [Polygon(b['g']) for b in blocks]
for b, pg in zip(blocks, polys):
    prem = max([PREM.get(s, 1) for s in b['s']] + [1])
    b['p'] = max(3, round(math.sqrt(pg.area) * RATE[b['a']] * prem * 0.14))
    b['r'] = round(b['p'] * 0.06, 1)
    b['poi'] = ''
for name, st, lon, lat in POI:
    pt = P(lon, lat)
    cand = [i for i in range(len(polys)) if st in blocks[i]['s'] and not blocks[i]['poi']]
    if not cand: print('MISS', name); continue
    best = min(cand, key=lambda i: polys[i].distance(pt))
    if polys[best].distance(pt) < 220:
        blocks[best]['poi'] = name
        blocks[best]['p'] = round(blocks[best]['p'] * 1.4)
        blocks[best]['r'] = round(blocks[best]['p'] * 0.07, 1)
lines = []
for r in d['roads']:
    if r['t']: continue
    for l in r['l']:
        if len(l) > 1: lines.append(LineString(l).buffer({6: 14, 5.5: 8, 5: 11, 4.5: 7, 4: 9}.get(r['k'], 6), cap_style=2))
land = unary_union([pg.buffer(4) for pg in polys] + lines).buffer(25).buffer(-22).simplify(2)
geoms = [land] if land.geom_type == 'Polygon' else list(land.geoms)
def ring(r): return [[round(x, 1), round(y, 1)] for x, y in r.coords]
d['land'] = [[ring(g.exterior)] + [ring(i) for i in g.interiors] for g in geoms if g.area > 3000]
json.dump(d, open('/home/claude/hkmap/ytm2.json', 'w'), ensure_ascii=False, separators=(',', ':'))
ps = sorted(b['p'] for b in blocks)
print('prices', ps[0], ps[len(ps) // 4], ps[len(ps) // 2], ps[3 * len(ps) // 4], ps[-1], 'total', sum(ps))
print([(b['poi'], b['a'], b['s'][:3], b['p'], round(polys[b['id']].distance(P(*[p for p in POI if p[0]==b['poi']][0][2:])))) for b in blocks if b['poi']])
