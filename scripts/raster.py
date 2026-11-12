import json, glob, numpy as np
from shapely.geometry import shape, Point
from shapely.prepared import prep

D = [
 ("Central and Western","中西區",[("堅尼地城",114.128,22.282),("上環",114.150,22.286),("中環",114.158,22.281),("半山",114.150,22.276),("山頂",114.150,22.266)]),
 ("Wan Chai","灣仔",[("灣仔",114.173,22.278),("銅鑼灣",114.184,22.280),("跑馬地",114.183,22.268),("大坑",114.193,22.274)]),
 ("Eastern","東區",[("北角",114.200,22.291),("鰂魚涌",114.212,22.286),("筲箕灣",114.229,22.279),("柴灣",114.237,22.265),("小西灣",114.250,22.262)]),
 ("Southern","南區",[("薄扶林",114.137,22.258),("香港仔",114.155,22.248),("黃竹坑",114.170,22.246),("淺水灣",114.198,22.236),("赤柱",114.212,22.215),("石澳",114.250,22.232)]),
 ("Yau Tsim Mong","油尖旺",[("尖沙咀",114.172,22.298),("油麻地",114.170,22.311),("旺角",114.170,22.320),("大角咀",114.161,22.322)]),
 ("Sham Shui Po","深水埗",[("深水埗",114.162,22.331),("長沙灣",114.152,22.336),("石硤尾",114.168,22.335),("美孚",114.138,22.338)]),
 ("Kowloon City","九龍城",[("紅磡",114.185,22.305),("土瓜灣",114.190,22.316),("何文田",114.178,22.318),("九龍城",114.191,22.330),("九龍塘",114.178,22.336),("啟德",114.207,22.322)]),
 ("Wong Tai Sin","黃大仙",[("黃大仙",114.193,22.342),("鑽石山",114.203,22.340),("慈雲山",114.197,22.352),("樂富",114.186,22.339)]),
 ("Kwun Tong","觀塘",[("牛頭角",114.217,22.318),("觀塘",114.226,22.312),("藍田",114.236,22.307),("秀茂坪",114.231,22.322),("油塘",114.240,22.296)]),
 ("Kwai Tsing","葵青",[("葵涌",114.133,22.362),("荔景",114.127,22.349),("青衣",114.100,22.350),("貨櫃碼頭",114.122,22.332)]),
 ("Tsuen Wan","荃灣",[("荃灣",114.115,22.372),("深井",114.075,22.370),("馬灣",114.060,22.350),("大帽山",114.120,22.405)]),
 ("Tuen Mun","屯門",[("屯門市中心",113.976,22.393),("掃管笏",114.000,22.390),("龍鼓灘",113.905,22.390),("藍地",113.977,22.418)]),
 ("Yuen Long","元朗",[("元朗",114.030,22.445),("天水圍",114.003,22.460),("錦田",114.065,22.442),("流浮山",113.975,22.475),("八鄉",114.090,22.425),("米埔",114.040,22.492)]),
 ("North","北區",[("上水",114.125,22.503),("粉嶺",114.143,22.490),("沙頭角",114.220,22.540),("打鼓嶺",114.160,22.530),("古洞",114.100,22.500)]),
 ("Tai Po","大埔",[("大埔",114.165,22.450),("大埔滘",114.185,22.428),("林村",114.125,22.458),("船灣",114.230,22.470),("西貢北",114.300,22.480)]),
 ("Sha Tin","沙田",[("沙田",114.190,22.383),("大圍",114.176,22.372),("火炭",114.195,22.400),("馬鞍山",114.232,22.420),("石門",114.210,22.388)]),
 ("Sai Kung","西貢",[("西貢市",114.272,22.383),("將軍澳",114.260,22.307),("清水灣",114.290,22.272),("坑口",114.255,22.318),("西貢郊野",114.345,22.405)]),
 ("Islands","離島",[("東涌",113.945,22.285),("機場",113.915,22.310),("南大嶼",113.950,22.235),("大澳",113.865,22.255),("愉景灣",114.020,22.300),("長洲",114.028,22.208),("南丫島",114.122,22.212),("坪洲",114.040,22.287)]),
]

def geoms(gj):
    out=[]
    for ft in gj['features']:
        g=ft['geometry']
        if g['type']=='GeometryCollection':
            out+= [shape(x) for x in g['geometries']]
        else: out.append(shape(g))
    return out

polys=[]
for en,zh,subs in D:
    gs=geoms(json.load(open(f'HKMap/json/{en}.json')))
    from shapely.ops import unary_union
    u=unary_union([g.buffer(0) for g in gs])
    polys.append(prep(u))

LON0,LON1,LAT0,LAT1=113.83,114.45,22.15,22.57
W=200; H=int(round(W*(LAT1-LAT0)/(LON1-LON0)/np.cos(np.radians(22.36))))
print('grid',W,H)
grid=np.full((H,W),-1,int)
subid=[]; names=[]
for di,(en,zh,subs) in enumerate(D):
    for s in subs: names.append([di,s[0],s[1],s[2]])
base=[0]
for en,zh,subs in D: base.append(base[-1]+len(subs))
for y in range(H):
    lat=LAT1-(y+0.5)/H*(LAT1-LAT0)
    for x in range(W):
        lon=LON0+(x+0.5)/W*(LON1-LON0)
        p=Point(lon,lat)
        for di,pp in enumerate(polys):
            if pp.contains(p):
                subs=D[di][2]
                k=min(range(len(subs)),key=lambda i:(subs[i][1]-lon)**2*0.86+(subs[i][2]-lat)**2)
                grid[y,x]=base[di]+k
                break
# RLE encode: code char = chr(48+id+1), water = '0'
s=''; prev=None; cnt=0
def emit(c,n):
    return c+(str(n) if n>1 else '')
flat=[chr(49+v) if v>=0 else '0' for v in grid.flatten()]
out=[]
i=0
while i<len(flat):
    j=i
    while j<len(flat) and flat[j]==flat[i]: j+=1
    out.append((flat[i],j-i)); i=j
enc=''.join(c+(str(n) if n>1 else '')+(',' if n>1 else '') for c,n in out)
# simpler: use separators
enc='|'.join(f"{ord(c)-48}:{n}" if n>1 else f"{ord(c)-48}" for c,n in out)
print('land',int((grid>=0).sum()),'enclen',len(enc),'subs',len(names))
missing=[n[1] for idx,n in enumerate(names) if not (grid==idx).any()]
print('empty subs',missing)
json.dump({'W':W,'H':H,'rle':enc,'districts':[[zh] for en,zh,s in D],'subs':[[n[0],n[1]] for n in names],'bbox':[LON0,LON1,LAT0,LAT1]},open('hkgrid.json','w'),ensure_ascii=False)
