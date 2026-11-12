import json, sys
sys.path.insert(0, '/home/claude/hkmap')
from shapely.geometry import shape, Point, MultiPoint, mapping
from shapely.ops import unary_union, voronoi_diagram
import importlib.util
spec = importlib.util.spec_from_file_location('r', '/home/claude/hkmap/raster.py')
src = open('/home/claude/hkmap/raster.py').read()
D_src = src[src.index('D = ['):src.index('def geoms')]
ns = {}; exec(D_src, ns); D = ns['D']

def geoms(gj):
    out = []
    for ft in gj['features']:
        g = ft['geometry']
        out += [shape(x) for x in g['geometries']] if g['type'] == 'GeometryCollection' else [shape(g)]
    return out

feats = []
sid = 0
for di, (en, zh, subs) in enumerate(D):
    u = unary_union([g.buffer(0) for g in geoms(json.load(open(f'/root/hkmap/HKMap/json/{en}.json')))])
    u = u.simplify(0.0004, preserve_topology=True)
    pts = MultiPoint([(s[1], s[2]) for s in subs])
    vor = voronoi_diagram(pts, envelope=u.envelope.buffer(0.2))
    cells = list(vor.geoms)
    for k, s in enumerate(subs):
        p = Point(s[1], s[2])
        cell = next(c for c in cells if c.contains(p))
        part = cell.intersection(u)
        if part.is_empty:
            continue
        g = mapping(part)
        def rnd(o):
            if isinstance(o, (list, tuple)):
                if o and isinstance(o[0], float): return [round(o[0], 5), round(o[1], 5)]
                return [rnd(x) for x in o]
            return o
        feats.append({"type": "Feature", "properties": {"id": sid, "d": di, "dn": zh, "n": s[0]},
                      "geometry": {"type": g['type'], "coordinates": rnd(g['coordinates'])}})
        sid += 1
out = {"type": "FeatureCollection", "features": feats}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open('/home/claude/hkmap/subareas.json', 'w').write(s)
print(len(feats), 'features', len(s) // 1024, 'KB')
