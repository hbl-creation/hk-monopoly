// Map edit mode, injected into every district page by scripts/build_html.py.
// Part 1 (PRE) runs before the game script; part 2 (UI) after it.
function edNorm(E){E=E||{};E.v=1;E.lots=E.lots||{};E.merge=E.merge||[];E.erase=E.erase||[];return E}
function edFind(Md,c){let best=null,bd=400;for(const l of Md.lots){const d=(l.c[0]-c[0])**2+(l.c[1]-c[1])**2;if(d<bd){bd=d;best=l}}return best}
function edApply(l,e){if(e.t){l.k=e.t==='farm'?'buy':e.t;l.f=e.t==='farm'?1:0}
  if(e.n!==undefined)l.n=e.n;if(e.dev!==undefined)l.dev=e.dev;if(e.p){l.p=+e.p;l.r=Math.round(l.p*0.6)/10}}
const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
const hit=(p,s)=>{const q=s[2];if(q.length===1)return Math.hypot(p[0]-q[0][0],p[1]-q[0][1])<s[1];for(let i=1;i<q.length;i++)if(segD(p,q[i-1],q[i])<s[1])return true;return false};
// latest stroke of the given kinds that covers p decides: wipe ('e' roads / 'L' land) or restore ('r' / 'R')
const wiped=(p,E,kinds)=>{let h=false;for(const s of E.erase)if(kinds.includes(s[0])&&hit(p,s))h=s[0]==='e'||s[0]==='L';return h};
function dropWiped(Md,E){if(!E.erase.some(s=>s[0]==='L'))return;
  const keep=Md.lots.filter(l=>!wiped(l.c,E,'LR'));if(keep.length===Md.lots.length)return;
  const remap={};keep.forEach((l,i)=>{remap[l.id]=i;l.id=i});Md.lots=keep;
  Md.blocks.forEach(b=>b.lots=b.lots.filter(i=>i in remap).map(i=>remap[i]));
  const kb=Md.blocks.filter(b=>b.lots.length),bm={};kb.forEach((b,i)=>{bm[b.id]=i;b.id=i});Md.blocks=kb;
  keep.forEach(l=>l.blk=l.blk in bm?bm[l.blk]:-1);(Md.bld||[]).forEach(b=>{b[3]=b[3] in remap?remap[b[3]]:-1})}
function preEdits(Md){let E=null;try{E=JSON.parse(localStorage.getItem('hkm-edits-'+Md.key)||'null')}catch(e){}
  const emb=Md.edits||{};if(E&&emb.build&&E.build!==emb.build)E=null;  // map was rebuilt with your edits baked in
  E=edNorm(E||JSON.parse(JSON.stringify(emb)));E.build=emb.build;window.EDITS=E;
  for(const k in E.lots){const l=edFind(Md,k.split(',').map(Number));if(l)edApply(l,E.lots[k])}dropWiped(Md,E)}
//==UI==
(function(){
const E=window.EDITS,KEY='hkm-edits-'+M.key,save=()=>{try{localStorage.setItem(KEY,JSON.stringify(E))}catch(e){}};
document.head.insertAdjacentHTML('beforeend',`<style>
#edBtn{position:fixed;right:24px;top:466px;z-index:30;height:38px;padding:0 12px;border-radius:19px;border:1px solid rgba(29,37,48,.14);background:#fff;font:600 13px inherit;color:#1D2530;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}
body.editing #edBtn{background:#1D2530;color:#fff}
#edBar{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:40;display:none;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);
 background:#fff;border:1px solid rgba(29,37,48,.14);border-radius:14px;padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,.14);font-size:13px}
body.editing #edBar{display:flex}
#edBar button,#edPanel button{height:32px;padding:0 10px;border-radius:9px;border:1px solid rgba(29,37,48,.16);background:#fff;font:inherit;cursor:pointer;color:#1D2530}
#edBar button.on{background:#1D2530;color:#fff;border-color:#1D2530}
#edBar .sep{width:1px;height:22px;background:rgba(29,37,48,.15);margin:0 2px}
#edMsg{color:#5E6672;min-width:0}
#edPanel{position:fixed;left:24px;top:150px;z-index:40;width:250px;display:none;background:#fff;border:1px solid rgba(29,37,48,.14);border-radius:14px;padding:12px;box-shadow:0 6px 24px rgba(0,0,0,.14);font-size:13px}
#edPanel label{display:block;margin:6px 0 2px;color:#5E6672}
#edPanel input,#edPanel select{width:100%;box-sizing:border-box;height:32px;border:1px solid rgba(29,37,48,.2);border-radius:8px;padding:0 8px;font:inherit}
#edPanel .row{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
#edPanel .pri{background:#D33F35;color:#fff;border-color:#D33F35}
body.editing.brush #map{cursor:none}
body.editing #deed{display:none!important}
@media (max-width:640px){#edPanel{right:12px;left:12px;width:auto;top:auto;bottom:12px}#edBtn{top:auto;bottom:84px}}
</style>`);
document.body.insertAdjacentHTML('beforeend',`<button id="edBtn">✎ 編輯地圖</button>
<div id="edBar" role="toolbar" aria-label="地圖編輯工具">
 <button data-t="pan" class="on" title="拖動地圖；撳一下街區就可以改">✋ 移動／改地</button>
 <button data-t="erase" title="喺路上面掃過就擦走">🧽 擦路</button>
 <button data-t="restore" title="掃返擦咗嘅路出嚟">🖌 補路</button>
 <button data-t="wipe" title="掃過多餘嘅土地就刪走（連街區、建築物）">🗑 刪地</button>
 <button data-t="unwipe" title="掃返刪咗嘅土地出嚟">🌱 補地</button>
 <label>筆刷 <input id="edBr" type="range" min="6" max="70" value="22" style="width:80px;vertical-align:middle"></label>
 <span class="sep"></span>
 <button id="edUndo">↶ 復原</button><button id="edExp">⬇ 匯出</button><button id="edImp">⬆ 匯入</button><button id="edClr">清除全部</button>
 <span class="sep"></span><span id="edMsg"></span>
 <input id="edFile" type="file" accept=".json,application/json" hidden>
</div>
<div id="edPanel" aria-live="polite">
 <b id="edTitle"></b><div id="edSub" style="color:#5E6672;font-size:12px"></div>
 <label>類型</label><select id="edT"><option value="buy">可買</option><option value="farm">農地</option><option value="dev">大地產商物業</option>
  <option value="park">公園／休憩用地</option><option value="gov">政府用地</option><option value="rel">宗教場所</option><option value="comm">學校及醫院</option>
  <option value="mark">地標（非賣品）</option><option value="bank">銀行</option></select>
 <label>名稱</label><input id="edN" placeholder="例如：合益廣場">
 <label>業主集團（揀咗就會變集團物業）</label><select id="edD"></select><input id="edD2" placeholder="新地產商名稱" style="display:none;margin-top:4px">
 <label>市值（億）</label><input id="edP" type="number" min="1" step="1">
 <label>備註（俾 Claude 睇）</label><input id="edNote" placeholder="例如：沿條巷一開二">
 <div class="row"><button class="pri" id="edOk">套用</button><button id="edMerge">同另一塊合併</button><button id="edX">收起</button></div>
</div>`);
const msg=t=>{$('edMsg').textContent=t};
// outside the playable map: neutral slate instead of sea blue; real water is drawn as its own layer
const OFFMAP='#4E5A63',WATER='#BCD7E3';document.head.insertAdjacentHTML('beforeend',`<style>body{background:${OFFMAP}!important}</style>`);
[...svg.children].filter(e=>e.tagName==='rect'&&e.getAttribute('fill')==='#BCD7E3').forEach(e=>e.setAttribute('fill',OFFMAP));
// holes in the land outline are unmapped gaps, not water: fill them; real water comes from M.water
// outside the play area: the map still shows, under a dark veil, so players see it can't be played
// playable area highlighted like a sales-territory map: outside stays a normal map, lightly washed out,
// the territory gets a bold outline
if(M.play){const B=8000,veil=el('path',{d:`M${bx0-B} ${by0-B}H${bx1+B}V${by1+B}H${bx0-B}Z`+M.play.map(r=>'M'+pts(r)+'Z').join(''),
  'fill-rule':'evenodd',fill:'rgba(250,248,243,.5)','pointer-events':'none'});
  const edge=el('g',{'pointer-events':'none',fill:'none'}),ed=M.play.map(r=>'M'+pts(r)+'Z').join('');
  el('path',{d:ed,stroke:'rgba(211,63,53,.25)','stroke-width':9,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'},edge);
  el('path',{d:ed,stroke:'#B5352C','stroke-width':2.5,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'},edge);
  const top=()=>[veil,edge,gSel,typeof gMg!=='undefined'?gMg:null,typeof cursor!=='undefined'?cursor:null];
  const lift=()=>top().forEach(g=>g&&svg.appendChild(g));setTimeout(lift,0);
  new MutationObserver(()=>{if(!top().includes(svg.lastElementChild))lift()}).observe(svg,{childList:true});
  if(M.ctx){const gC=el('g',{'pointer-events':'none'});svg.insertBefore(gC,gBlk);  // cut-away plots as background
    el('path',{d:M.ctx.map(r=>'M'+pts(r)+'Z').join(''),fill:'#F4F1EA',stroke:'#CFC9B9','stroke-width':1,'vector-effect':'non-scaling-stroke'},gC)}}
if(M.ctxlu){const LUC={park:'#CFE3B8',green:'#C3D8AC',farm:'#E4E7C6',res:'#EEEAE2',ind:'#E6E1EA',gov:'#E1E1E1'},gL=el('g',{'pointer-events':'none'});
  gLand.after(gL);const by={};M.ctxlu.forEach(([k,q])=>{let d='M'+q[0]+' '+q[1];for(let i=2;i<q.length;i+=2)d+='L'+q[i]+' '+q[i+1];by[k]=(by[k]||'')+d+'Z'});
  Object.entries(by).forEach(([k,d])=>el('path',{d,fill:LUC[k]},gL))}
// statutory zoning: green belt / open space land that has no plot is drawn green and labelled
if(M.zfree){const gZ=el('g',{'pointer-events':'none'});svg.insertBefore(gZ,gBlk);const by={};
  M.zfree.forEach(([k,q])=>{let d='M'+q[0]+' '+q[1];for(let i=2;i<q.length;i+=2)d+='L'+q[i]+' '+q[i+1];by[k]=(by[k]||'')+d+'Z'});
  if(by.gb)el('path',{d:by.gb,fill:'#BFD6A6'},gZ);if(by.o)el('path',{d:by.o,fill:'#CFE3B8'},gZ);
  const gZL=el('g',{'pointer-events':'none'});svg.insertBefore(gZL,gNM);(M.zlab||[]).forEach(([n,x,y])=>{const t=el('text',{x,y,class:'zl'},gZL);t.textContent=n});
  document.head.insertAdjacentHTML('beforeend','<style>.zl{fill:#4F6B3C;text-anchor:middle;dominant-baseline:middle;font-weight:600;letter-spacing:.1em;paint-order:stroke;stroke:rgba(255,255,255,.7);stroke-width:3px;stroke-linejoin:round}</style>');
  const _ap2=apply;apply=function(){_ap2();const u=vb.w/Math.max(1,svg.getBoundingClientRect().width);gZL.setAttribute('font-size',Math.max(11,13)*u)};apply()}
const ZN={'R(A)':'住宅（甲類）','R(B)':'住宅（乙類）','R(C)':'住宅（丙類）','R(D)':'住宅（丁類）','R(E)':'住宅（戊類）','V':'鄉村式發展','AGR':'農業','G/IC':'政府、機構或社區','O':'休憩用地','GB':'綠化地帶','OU':'其他指定用途','CDA':'綜合發展區','U':'未決定用途','CA':'自然保育區','C':'商業','I':'工業','OS':'露天貯物','R(A)':'住宅（甲類）'};
const zname=z=>{if(!z)return'';const g=z.replace(/\d+$/,'').replace(/\(\d+\)$/,'');const k=Object.keys(ZN).find(k=>z.startsWith(k));return (k?ZN[k]:'')+' '+z};
const NOLOT='#BDB8AD';  // land that isn't a plot (lanes, slopes, government land): darker = not buyable
gLand.innerHTML='';M.land.forEach(r=>el('path',{d:'M'+pts(r[0])+'Z',fill:NOLOT},gLand));
if(M.water){const gW=el('g',{'pointer-events':'none',mask:'url(#lmask)'});svg.insertBefore(gW,gBlk);let d='';
  M.water.forEach(q=>{d+='M'+q[0]+' '+q[1];for(let i=2;i<q.length;i+=2)d+='L'+q[i]+' '+q[i+1];d+='Z'});
  el('path',{d,fill:WATER,stroke:'#9CC1D2','stroke-width':.8,'vector-effect':'non-scaling-stroke'},gW)}
// developers already in the game (sound-alike names); new ones typed in are added for this session
// owners from the game design doc (香港地產遊戲設計文件): 大地產商 / 虛構對手 / 小型業主
// read from data/companies.json (embedded by build_html.py) — edit names there, not here
const CO=M.companies||{major:[],rivals:[],small:[]};
const DEVG=[['大地產商',CO.major.map(c=>c.name)],['虛構對手',CO.rivals.map(c=>c.name)],['小型業主',CO.small.map(c=>c.name)]];
const DEVS=DEVG.flatMap(g=>g[1]);
// government building footprints (Lands Department via CSDI): drawn from street level, names at closest zoom
const gBld=el('g',{'pointer-events':'none',mask:'url(#lmask)'});svg.insertBefore(gBld,gBO);let gBN=null,bldBuilt=false;
function buildBld(){if(bldBuilt||!M.bld)return;bldBuilt=true;let d='';
  M.bld.forEach(b=>{const q=b[0];d+='M'+q[0]+' '+q[1];for(let i=2;i<q.length;i+=2)d+='L'+q[i]+' '+q[i+1];d+='Z'});
  el('path',{d,fill:'rgba(70,60,45,.16)',stroke:'rgba(70,60,45,.45)','stroke-width':.7,'vector-effect':'non-scaling-stroke'},gBld);
  gBN=el('g',{'pointer-events':'none',mask:'url(#lmask)'});svg.insertBefore(gBN,gNM);const seen={};
  M.bld.filter(b=>b[1]).forEach(b=>{const q=b[0];let x=0,y=0;const n=q.length/2;for(let i=0;i<q.length;i+=2){x+=q[i];y+=q[i+1]}
    x/=n;y/=n;const nm=b[1].replace(/\s*(第?[0-9０-９A-ZＡ-Ｚ一二三四五六七八九十]+(座|期))+$/,'')||b[1];const near=(seen[nm]||[]).some(([a,c])=>Math.hypot(a-x,c-y)<45);if(near)return;(seen[nm]=seen[nm]||[]).push([x,y]);
    const t=el('text',{x,y,class:'bn'},gBN);t.textContent=nm})}
document.head.insertAdjacentHTML('beforeend','<style>.bn{fill:#4A4336;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:2.5px;stroke-linejoin:round;font-weight:500}#attrib{position:fixed;right:8px;bottom:4px;z-index:5;font-size:10px;color:#6B6F76;background:rgba(255,255,255,.7);padding:1px 6px;border-radius:6px}</style>');
document.body.insertAdjacentHTML('beforeend','<div id="attrib">建築物數據：地政總署（CSDI 空間數據共享平台）· 道路：© OpenStreetMap</div>');
const _ap=apply;apply=function(){_ap();const u=vb.w/Math.max(1,svg.getBoundingClientRect().width);if(LOD>=2)buildBld();
  gBld.style.display=LOD>=2?'':'none';if(gBN){const sh=LOD===3&&u<0.35;gBN.style.display=sh?'':'none';gBN.setAttribute('font-size',8.5*u);if(gLN)gLN.style.display=LOD===3&&!sh?'':'none'}};
apply();
// road mask: black strokes hide roads, white strokes bring them back (later strokes win)
const BIG=6000,mk=el('mask',{id:'rmask',maskUnits:'userSpaceOnUse',x:bx0-BIG,y:by0-BIG,width:bx1-bx0+2*BIG,height:by1-by0+2*BIG},defs);
el('rect',{x:bx0-BIG,y:by0-BIG,width:bx1-bx0+2*BIG,height:by1-by0+2*BIG,fill:'#fff'},mk);
const gS=el('g',{fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},mk);
const dOf=q=>q.length===1?`M${q[0][0]} ${q[0][1]}l.01 0`:'M'+pts(q);
const lk=el('mask',{id:'lmask',maskUnits:'userSpaceOnUse',x:bx0-BIG,y:by0-BIG,width:bx1-bx0+2*BIG,height:by1-by0+2*BIG},defs);
el('rect',{x:bx0-BIG,y:by0-BIG,width:bx1-bx0+2*BIG,height:by1-by0+2*BIG,fill:'#fff'},lk);
const gS2=el('g',{fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},lk);
const drawStroke=s=>{const black=s[0]==='e'||s[0]==='L',a={d:dOf(s[2]),stroke:black?'#000':'#fff','stroke-width':s[1]*2};
  const p=el('path',a,gS);if(s[0]==='L'||s[0]==='R'){p.l2=el('path',a,gS2)}return p};
E.erase.forEach(drawStroke);
const setL=g=>g&&g.setAttribute('mask','url(#lmask)');
const setMask=g=>g&&g.setAttribute('mask','url(#rmask)');
setMask(rG.major);setMask(rG.minor);setMask(rG.foot);
[gLand,gBlk,gLot,gBO,gNM,gLN].forEach(setL);const _bln=buildLotNames;buildLotNames=function(){_bln();setL(gLN)};
const _bm=buildMinor,_bf=buildFoot;buildMinor=function(){_bm();setMask(rG.minor)};buildFoot=function(){_bf();setMask(rG.foot)};
function updLabels(){gRL.querySelectorAll('text').forEach(t=>{const p=[+t.getAttribute('x'),+t.getAttribute('y')];t.style.visibility=wiped(p,E,'erLR')?'hidden':''})}
updLabels();
// merges: dashed outline so they're visible before the build joins them
const gMg=el('g',{fill:'none',stroke:'#D33F35','stroke-width':2.5,'stroke-dasharray':'7 5','vector-effect':'non-scaling-stroke','pointer-events':'none'});
function drawMerges(){gMg.innerHTML='';E.merge.forEach(([a,b])=>[a,b].forEach(c=>{const l=edFind(M,c);if(l)el('polygon',{points:pts(l.g),'vector-effect':'non-scaling-stroke'},gMg)}))}
drawMerges();
// state
let on=false,tool='pan',cur=null,selL=null,mergeFrom=null;const hist=[];
const cursor=el('circle',{r:0,fill:'rgba(211,63,53,.12)',stroke:'#D33F35','stroke-width':1.5,'vector-effect':'non-scaling-stroke','pointer-events':'none',display:'none'});
const brushing=()=>on&&tool!=='pan';
const radius=()=>+$('edBr').value*vb.w/svg.getBoundingClientRect().width;
const r1=v=>Math.round(v*10)/10;
function setTool(t){tool=t;document.querySelectorAll('#edBar [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  document.body.classList.toggle('brush',brushing());cursor.setAttribute('display','none');
  msg({erase:'喺路上面掃過就擦走（只擦路同路名，唔影響街區）',restore:'掃過擦咗嘅路就補返',wipe:'掃過多餘嘅土地就刪走；街區中心被掃到就會成塊移除',unwipe:'掃過刪咗嘅土地就補返',pan:'拖動地圖，撳一下街區就可以改'}[t])}
document.querySelectorAll('#edBar [data-t]').forEach(b=>b.onclick=()=>setTool(b.dataset.t));
$('edBtn').onclick=()=>{on=!on;document.body.classList.toggle('editing',on);if(on){closeCard();setTool('pan');if(LOD<2)zoomAt(svg.getBoundingClientRect().width/vb.w)}
  else{document.body.classList.remove('brush');cursor.setAttribute('display','none');hidePanel()}};
// brush painting (capture phase so the map doesn't pan)
svg.addEventListener('pointerdown',e=>{if(!brushing()||e.button>0)return;e.stopImmediatePropagation();e.preventDefault();svg.setPointerCapture(e.pointerId);
  cur=[{erase:'e',restore:'r',wipe:'L',unwipe:'R'}[tool],r1(radius()),[toSvg(e.clientX,e.clientY).map(r1)]];cur.el=drawStroke(cur)},true);
svg.addEventListener('pointermove',e=>{if(!brushing())return;const p=toSvg(e.clientX,e.clientY),r=radius();
  cursor.setAttribute('display','');cursor.setAttribute('cx',p[0]);cursor.setAttribute('cy',p[1]);cursor.setAttribute('r',r);
  const bad=tool==='erase'||tool==='wipe';cursor.setAttribute('stroke',bad?'#D33F35':'#1F7A66');cursor.setAttribute('fill',bad?'rgba(211,63,53,.12)':'rgba(31,122,102,.12)');
  if(!cur)return;e.stopImmediatePropagation();const q=cur[2],last=q[q.length-1];
  if(Math.hypot(p[0]-last[0],p[1]-last[1])>cur[1]/3){q.push(p.map(r1));cur.el.setAttribute('d',dOf(q));if(cur.el.l2)cur.el.l2.setAttribute('d',dOf(q))}},true);
function updLots(){M.lots.forEach(l=>{const e=lotEl[l.id];if(e)e.style.display=wiped(l.c,E,'LR')?'none':''})}
function endStroke(e){if(!cur)return;e.stopImmediatePropagation();const s=cur;cur=null;delete s.el;E.erase.push(s);hist.push({t:'erase'});save();updLabels();
  if(s[0]==='L'||s[0]==='R')updLots();
  msg({e:'已擦走條路',r:'已補返條路',L:'已刪走呢幅地（重新載入後遊戲入面都會消失）',R:'已補返呢幅地'}[s[0]])}
svg.addEventListener('pointerup',endStroke,true);svg.addEventListener('pointercancel',endStroke,true);
svg.addEventListener('pointerleave',()=>cursor.setAttribute('display','none'));
// lot editing
const typeOf=l=>l.k==='buy'&&l.f?'farm':l.k;
const snap=l=>({k:l.k,f:l.f,n:l.n,dev:l.dev,p:l.p,r:l.r});
function repaint(l){const e=lotEl[l.id];if(e)e.setAttribute('fill',l.k==='buy'?baseFill(l):kindFill(l.k));paintLot(l.id);if(l.blk>=0&&M.blocks[l.blk])paintBlock(l.blk)}
const _sel=select;select=function(id){if(on){pickLot(id);return}_sel(id)};
function pickLot(id){const l=M.lots[id];
  if(mergeFrom!==null&&mergeFrom!==id){const a=M.lots[mergeFrom];E.merge.push([a.c,l.c]);hist.push({t:'merge'});
    const prev=snap(l),key=l.c.join(',');hist.push({t:'lot',id,key,prev,old:E.lots[key]});
    E.lots[key]={t:typeOf(a),n:a.n,dev:a.dev};edApply(l,E.lots[key]);repaint(l);mergeFrom=null;save();drawMerges();msg('已標記合併（重新生成地圖時會真正合併）');pickLot(a.id);return}
  mergeFrom=null;selL=l;gSel.setAttribute('points',pts(l.g));
  $('edTitle').textContent=l.n||'未命名街區';$('edSub').textContent=`#${l.id} · ${l.a} · ${l.m2.toLocaleString()} 平方米 · ${(l.s||[]).join(' × ')}`+(l.z?`\n法定分區：${zname(l.z)}`:'');$('edSub').style.whiteSpace='pre-line';
  const ed=E.lots[l.c.join(',')]||{};
  $('edT').value=typeOf(l);$('edN').value=l.n||'';$('edD').value=l.dev||'';$('edP').value=l.p;$('edNote').value=ed.note||'';
  const extra=[...new Set(M.lots.map(x=>x.dev).filter(d=>d&&!DEVG.some(g=>g[1].includes(d))).concat(DEVS.filter(d=>!DEVG.some(g=>g[1].includes(d)))))],devs=DEVS.concat(extra);
  $('edD').innerHTML='<option value="">（唔適用）</option>'+DEVG.map(([g,l])=>`<optgroup label="${g}">${l.map(d=>`<option>${d}</option>`).join('')}</optgroup>`).join('')
    +(extra.length?`<optgroup label="其他">${extra.map(d=>`<option>${d}</option>`).join('')}</optgroup>`:'')+'<option value="__new">＋ 新增地產商…</option>';
  $('edD').value=l.dev&&devs.includes(l.dev)?l.dev:'';$('edD2').style.display='none';$('edD2').value='';
  $('edPanel').style.display='block'}
function hidePanel(){$('edPanel').style.display='none';gSel.setAttribute('points','');selL=null;mergeFrom=null}
$('edX').onclick=hidePanel;
$('edD').onchange=()=>{const n=$('edD').value==='__new';$('edD2').style.display=n?'':'none';if(n)$('edD2').focus();else if($('edD').value)$('edT').value='dev'};
$('edOk').onclick=()=>{const l=selL;if(!l)return;const key=l.c.join(','),t=$('edT').value;
  const dv=$('edD').value==='__new'?$('edD2').value.trim():$('edD').value;if(dv&&dv!=='__new'&&!DEVS.includes(dv))DEVS.push(dv);
  const e={t:dv&&t!=='dev'&&(t==='buy'||t==='farm')?'dev':t,n:$('edN').value.trim(),dev:(dv&&(t==='dev'||t==='buy'||t==='farm'))?dv:(t==='dev'?'大地產商':''),p:Math.max(1,Math.round(+$('edP').value||l.p))};
  const note=$('edNote').value.trim();if(note)e.note=note;
  hist.push({t:'lot',id:l.id,key,prev:snap(l),old:E.lots[key]});E.lots[key]=e;edApply(l,e);repaint(l);save();
  $('edTitle').textContent=l.n||'未命名街區';msg('已套用（名稱標籤重新載入後更新）')};
$('edMerge').onclick=()=>{if(!selL)return;mergeFrom=selL.id;msg('撳隔籬嗰塊街區嚟合併')};
$('edUndo').onclick=()=>{const h=hist.pop();if(!h){msg('冇嘢可以復原');return}
  if(h.t==='erase'){const s=E.erase.pop();const p=gS.lastChild;if(p){if(p.l2)p.l2.remove();p.remove()}updLabels();if(s&&(s[0]==='L'||s[0]==='R'))updLots()}
  else if(h.t==='merge'){E.merge.pop();drawMerges()}
  else if(h.t==='lot'){const l=M.lots[h.id];Object.assign(l,h.prev);if(h.old)E.lots[h.key]=h.old;else delete E.lots[h.key];repaint(l);
    if(hist.length&&hist[hist.length-1].t==='merge'){const m=hist.pop();E.merge.pop();drawMerges()}}
  save();msg('已復原')};
$('edExp').onclick=()=>{const s=JSON.stringify(E);try{navigator.clipboard&&navigator.clipboard.writeText(s)}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'application/json'}));a.download=M.key+'-edits.json';a.click();
  msg(`已下載 ${M.key}-edits.json，傳俾 Claude 就得`)};
$('edImp').onclick=()=>$('edFile').click();
$('edFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const x=edNorm(JSON.parse(await f.text()));x.build=(M.edits||{}).build;localStorage.setItem(KEY,JSON.stringify(x));location.reload()}catch(err){msg('檔案讀唔到')}};
$('edClr').onclick=()=>{if(!confirm('清除你喺呢部電腦未傳俾 Claude 嘅編輯？（已經做入地圖嘅唔會受影響）'))return;try{localStorage.removeItem(KEY)}catch(e){}location.reload()};
})();
