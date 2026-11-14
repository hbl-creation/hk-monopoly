// ===== 香港地產大富翁 · 第一章（元朗）試玩版遊戲層 =====
// 地圖繪製由 scripts/yuenlong-template.html 提供（build_ch1.py 喺生成時抄入），呢個檔只有遊戲規則同介面。
// 地圖數據（M）只讀：開局地塊、業主、用途、工程全部存喺遊戲狀態 S，唔會寫返入地圖。
// 公司名、屬性一律讀 data/companies.json（M.companies），唔好喺呢度寫死。
const CO=M.companies||{major:[],rivals:[],small:[],map_rival:{}};
const CFG={
  MONTHS:12,            // demo 長度（設計文件：第一章 5 年）
  START_CASH:50,        // 億
  START_PLOTS:4,        // 開局農地（元朗東，相連）
  LUK_PLOTS:4,          // 教學目標集團喺市中心嘅相連地塊
  UNLOCK:1.5,           // 年結身家 ≥ 開局 × 1.5，而且高過主要對手 → 解鎖第二章
  // ── 試玩版數值 DEMO VALUES：之後要 revisit（設計文件：審批 3–9 個月、工期 12–36 個月）──
  APPROVE_MONTHS:1,
  BUILD_MONTHS:{village:2,res:4,urban:4},
  // ────────────────────────────────────────────────────────────────────────────────
  ADJ_GAP:16,           // 兩塊地邊界相距少過呢個數（米）而且同一分區 → 當相鄰（共用邊界或隔一條細街）
  ZONE:['元朗東','南邊圍'],ZONE_MONTH:2,ZONE_UP:1.25,   // 政府公佈嘅發展區：區內農地先可以改住宅
  BANK:'東方銀行',FIN:'元合財務',BANK_RATE:.006,FIN_RATE:.018,BANK_LTV:.4,FIN_LIMIT:20,LOAN_STEP:5,
  TPB:'城審會',DC:'區諮會',LANDS:'土地事務署',PLAN:'發展規劃處',
  START_AT:null,LUK_AT:null   // 想指定開局地塊：填地塊中心座標陣列，例如 [[190.8,245.1],…]
};
// 用途轉換（倍數以改劃前地價 V 計）：land＝改劃後地價，補地價＝(land−1)×V×50%，build＝建築費，done＝完成後價值
const USES={
  village:{n:'村屋',from:'farm',land:3,build:1,done:4.2,yield:.010,need:'要同鄉紳合作（鄉紳關係 45 或以上）'},
  res:{n:'新市鎮住宅',from:'farm',land:5,build:3,done:11,yield:.012,need:'只限政府公佈嘅發展區'},
  urban:{n:'舊樓重建住宅',from:'urban',land:1.6,build:.8,done:3,yield:.012,need:'要先合併最少 2 塊相鄰地塊'}
};
for(const k in USES)USES[k].months=CFG.BUILD_MONTHS[k];
const PLANS={std:{n:'標準方案',d:'照規矩申請。'},fac:{n:'加社區設施',d:'審批機會 +15、民意 +4；可建樓面減少，完成價值 −7%。'},gov:{n:'同政府交易',d:'撥部分單位做公營房屋：審批機會 +30，但民意 −8、完成價值 −5%。'}};
const R_MAIN=CO.rivals.find(r=>r.name===(CO.map_rival||{})[M.key])||CO.rivals[0];
const R_SPEC=CO.rivals.find(r=>r!==R_MAIN&&/炒/.test((r.focus||'')+(r.style||'')))||CO.rivals[1];
const R_BRO=CO.rivals.find(r=>/大哥/.test(r.role||''))||CO.rivals[CO.rivals.length-1];
const MAJ=CO.major.filter(c=>String(c.chapter)==='1');
const LUK=CO.small[0];
const N={yc:R_MAIN.name,kw:R_SPEC.name,bro:R_BRO.name,luk:LUK.name,big:(MAJ[0]||CO.major[0]).name,big2:(MAJ[1]||CO.major[1]).name};
const WHO={me:{n:'你',c:'#D33F35'},yc:{n:N.yc,c:'#2E5C9A'},kw:{n:N.kw,c:'#D98A1E'},sold:{n:'散戶業主（已售出）',c:'#9A8F86'}};
CO.small.forEach((c,i)=>WHO['c'+i]={n:c.name,c:'#3F8F8A',small:1,co:c});
const rnd=()=>Math.random(),pick=a=>a[Math.floor(rnd()*a.length)],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const fmt=v=>{const a=Math.abs(v);if(a<.005)return'0 億';return(a>=100?Math.round(v).toLocaleString('en'):a>=10?(Math.round(v*10)/10).toFixed(1):(Math.round(v*100)/100).toFixed(2).replace(/0$/,''))+' 億'};
const m2=v=>Math.round(v).toLocaleString('en')+' 平方米';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// 銀行顯示名：地圖數據保留原名，遊戲畫面用設計文件嘅虛構名
const BANKS=M.lots.filter(l=>l.k==='bank'),DN={};BANKS.forEach((l,i)=>DN[l.n]=i?CFG.FIN:CFG.BANK);
gNM.querySelectorAll('text').forEach(t=>{const n=t.textContent.replace(/^\$ /,'');if(DN[n])t.textContent='$ '+DN[n]});
const dn=l=>DN[l.n]||l.n;
const lotName=l=>{const n=dn(l);return n&&n!=='空地'?n:(l.s&&l.s.length?l.s[0]+'旁':l.a)+(l.f?'農地':'地塊')};
// ── 相鄰關係（開頁時計一次）──
let BUY=[],ADJ={};
function indexMap(){BUY=M.lots.filter(l=>l.k==='buy');ADJ={};const G=CFG.ADJ_GAP;
  const bb=BUY.map(l=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const p of l.g){if(p[0]<a)a=p[0];if(p[1]<b)b=p[1];if(p[0]>c)c=p[0];if(p[1]>d)d=p[1]}return[a,b,c,d]});
  const sd=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=t<0?0:t>1?1:t;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
  const near=(A,B)=>{for(const p of A)for(let i=0;i<B.length;i++)if(sd(p,B[i],B[(i+1)%B.length])<G)return true;return false};
  BUY.forEach(l=>ADJ[l.id]=[]);
  for(let i=0;i<BUY.length;i++)for(let j=i+1;j<BUY.length;j++){const a=BUY[i],b=BUY[j],x=bb[i],y=bb[j];
    if(a.blk!==b.blk||x[0]>y[2]+G||y[0]>x[2]+G||x[1]>y[3]+G||y[1]>x[3]+G)continue;
    if(near(a.g,b.g)||near(b.g,a.g)){ADJ[a.id].push(b.id);ADJ[b.id].push(a.id)}}}
// ── 狀態 ──
let S=null,SEL=null,TAB=null;const HL=new Set();
const SAVE='hkm-ch1-save-'+M.key;
function save(){try{localStorage.setItem(SAVE,JSON.stringify(S))}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE)||'null');if(s&&s.v===2&&s.build===(M.edits||{}).build&&s.n===M.lots.length)return s}catch(e){}return null}
const siteOf=l=>S.sites[S.siteOf[l.id]];
const inZone=l=>S.zone&&l.f&&CFG.ZONE.includes(l.a);
const base=l=>l.p*S.idx*(S.pm[l.a]||1)*(inZone(l)?CFG.ZONE_UP:1);
function mult(st){if(!st||!st.use)return 1;const U=USES[st.use];
  if(st.st==='building')return 1+(U.land-1)*.5*(st.hag||1)+U.build;if(st.st==='done')return U.done*(st.k||1);return 1}
const val=l=>base(l)*mult(siteOf(l));
const lotsOf=who=>BUY.filter(l=>S.own[l.id]===who);
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const siteLots=st=>st.lots.map(i=>M.lots[i]);
const siteBase=st=>sum(siteLots(st),base),siteVal=st=>sum(siteLots(st),val),siteM2=st=>sum(siteLots(st),l=>l.m2);
const premium=(st,u)=>siteBase(st)*(USES[u||st.use].land-1)*.5*(st.hag||1);
const buildCost=(st,u)=>siteBase(st)*USES[u||st.use].build;
const kOf=(st,plan,cond)=>(st.lots.length>=3?1.1:1)*(plan==='fac'?.93:plan==='gov'?.95:1)*(cond?.92:1);
const opRent=()=>S.op>70?1.1:S.op<30?.9:1;
function rentOf(l){const o=S.own[l.id];if(!o||o==='sold')return 0;const st=siteOf(l);let r;
  if(st&&st.st==='done')r=val(l)*USES[st.use].yield;else if(st&&st.st==='building')r=0;else r=base(l)*(l.f?.002:.008);
  return r*opRent()*S.rentTmp}
const debtAll=()=>S.debt.bank+S.debt.fin;
function worth(who){const v=sum(lotsOf(who),val);
  if(who==='me')return S.cash-debtAll()+v;if(who==='yc')return S.R.yc.cash+v;if(who==='kw')return S.R.kw.cash-S.R.kw.debt+v;return v}
const OFFMAP=c=>(c.cash||5)*550+(c.aggressive||5)*40;   // 大集團「圖外資產」估算，只用嚟排名
const majWorth=c=>OFFMAP(c)*S.idx+sum(M.lots.filter(l=>l.k==='dev'&&l.dev===c.name),l=>l.p*S.idx);
const bankLimit=()=>Math.floor(sum(lotsOf('me'),val)*CFG.BANK_LTV);
function ranking(){const r=[{k:'me',n:'你嘅集團',w:worth('me'),me:1},{k:'yc',n:N.yc,w:worth('yc')},{k:'kw',n:N.kw,w:worth('kw')}];
  CO.small.forEach((c,i)=>{const w=worth('c'+i);if(w>0)r.push({k:'c'+i,n:c.name,w,small:1})});
  MAJ.forEach(c=>r.push({k:c.name,n:c.name,w:majWorth(c),big:1}));r.push({k:'bro',n:N.bro,w:OFFMAP(R_BRO)*S.idx,big:1,bro:1});
  return r.sort((a,b)=>b.w-a.w)}
function log(t,high){S.log.unshift({m:S.m,t});if(high)S.high.push({m:S.m,t})}
// ── 開局 ──
function cluster(ok,n,seedScore){const c=BUY.filter(l=>ok(l)&&!S.own[l.id]).sort((a,b)=>seedScore(a)-seedScore(b));
  for(const s of c){const set=[s],seen=new Set([s.id]);
    for(let i=0;i<set.length&&set.length<n;i++)for(const j of ADJ[set[i].id]){const l=M.lots[j];if(!seen.has(j)&&ok(l)&&!S.own[j]){seen.add(j);set.push(l);if(set.length>=n)break}}
    if(set.length>=n)return set}
  return c.slice(0,n)}
const areaC=a=>{const x=(M.areas||[]).find(v=>v[0]===a);return x?[x[1],x[2]]:[0,0]};
const dist=(l,c)=>Math.hypot(l.c[0]-c[0],l.c[1]-c[1]);
const byCentres=cs=>cs.map(c=>BUY.slice().sort((a,b)=>dist(a,c)-dist(b,c))[0]).filter(Boolean);
function newGame(){
  S={v:2,build:(M.edits||{}).build,n:M.lots.length,m:1,cash:CFG.START_CASH,debt:{bank:0,fin:0},rate:CFG.BANK_RATE,idx:1,pm:{},own:{},sites:{},siteOf:{},sid:1,
    op:50,gen:50,zone:false,R:{yc:{cash:(R_MAIN.cash||4)*5.5,hate:0},kw:{cash:(R_SPEC.cash||6)*5.5,debt:0,buy:{},distress:0,last:1}},
    did:{},nego:{},log:[],high:[],deck:[],used:[],tut:0,stats:{rent:0,interest:0,bought:0,sales:0,done:0,fees:0},start:0,rank0:{},rentTmp:1,appMod:0,loanCut:0,over:false,
    hikeM:5+Math.floor(rnd()*3)};
  const fz=CFG.ZONE[0],cz=areaC(fz);
  const mine=CFG.START_AT?byCentres(CFG.START_AT):cluster(l=>l.f&&l.a===fz&&l.p<=4&&l.m2>=1500,CFG.START_PLOTS,l=>dist(l,cz));
  mine.forEach(l=>S.own[l.id]='me');
  const cc=areaC('元朗市中心');
  const luk=CFG.LUK_AT?byCentres(CFG.LUK_AT):cluster(l=>!l.f&&l.a==='元朗市中心'&&l.p>=4&&l.p<=8,CFG.LUK_PLOTS,l=>dist(l,cc));
  luk.forEach(l=>S.own[l.id]='c0');
  const home=BUY.some(l=>l.f&&l.a==='元朗舊墟')?'元朗舊墟':'南邊圍',hc=areaC(home);
  cluster(l=>l.f&&l.a===home&&l.p<=5,5,l=>dist(l,hc)).forEach(l=>S.own[l.id]='yc');
  shuffle(BUY.filter(l=>!S.own[l.id]&&l.p<=8)).slice(0,2).forEach(l=>{S.own[l.id]='kw';S.R.kw.buy[l.id]=base(l)});
  CO.small.forEach((c,i)=>{if(!i)return;const farm=rnd()<.55,seed=pick(BUY.filter(l=>!S.own[l.id]&&l.p<=10&&!!l.f===farm&&(!farm||CFG.ZONE.concat(home).includes(l.a))));
    if(seed)cluster(l=>!!l.f===farm&&l.p<=12,1+Math.floor(rnd()*4),l=>dist(l,seed.c)).forEach(l=>S.own[l.id]='c'+i)});
  S.start=worth('me');ranking().forEach(r=>S.rank0[r.k]=r.w);
  log(`你帶住 ${fmt(S.cash)}現金同 ${mine.length} 塊${fz}農地開局。`);
  SEL=null;TAB=null;HL.clear();closeCard();closeSheet();paintAll();refresh();fit();intro()}
// ── 地圖着色 ──
function lotClass(l){const o=S.own[l.id]||'',st=siteOf(l);
  return'lot'+(o?' o-'+(WHO[o]&&WHO[o].small?'sm':o):'')+(st&&st.st?' s-'+st.st:'')+(st&&st.lots.length>1&&!st.st?' mg':'')+(!o&&l.k==='buy'&&inZone(l)?' zn':'')+(HL.has(l.id)?' hl':'')}
function paintLot(id){const e=lotEl[id],l=M.lots[id];if(e&&l)e.setAttribute('class',lotClass(l))}
// 縮到最細（分區）時地塊唔會畫出嚟：另外畫一層「有業主嘅地」，等玩家喺全區圖都見到自己同對手嘅地
const gOwn=el('g',{'pointer-events':'none'});gBlk.after(gOwn);
function drawOwn(){gOwn.innerHTML='';if(!S)return;BUY.forEach(l=>{if(S.own[l.id])el('polygon',{points:pts(l.g),class:lotClass(l),'vector-effect':'non-scaling-stroke'},gOwn)})}
const _applyOwn=apply;apply=function(){_applyOwn();gOwn.style.display=LOD===1?'':'none'};
function paintBlock(bid){const b=M.blocks[bid];if(!b||b.k!=='buy'||!blkEl[bid])return;const sh={},tot=b.lots.reduce((s,i)=>s+M.lots[i].m2,0)||1;
  b.lots.forEach(i=>{const l=M.lots[i],o=S.own[i]||(l.k==='dev'?'dev':'');if(o&&o!=='sold')sh[o]=(sh[o]||0)+l.m2/tot});
  let fill=baseFill(b);const top=Object.entries(sh).sort((a,c)=>c[1]-a[1])[0];
  if(top){const c=top[0]==='dev'?'#5B3F8C':WHO[top[0]].c;fill=mix(fill,c,Math.min(.55,top[1]*.9))}blkEl[bid].setAttribute('fill',fill)}
const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),mix=(a,b,t)=>{const A=hex(a),B=hex(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
function paintAll(){M.lots.forEach(l=>paintLot(l.id));M.blocks.forEach(b=>paintBlock(b.id));drawOwn()}
function paintLots(ls){const bs=new Set();ls.forEach(l=>{paintLot(l.id);bs.add(l.blk)});bs.forEach(b=>paintBlock(b));drawOwn()}
[['me','#D33F35','#8E241D'],['yc','#2E5C9A','#173A6A']].forEach(([k,a,b])=>{const p=el('pattern',{id:'pb-'+k,width:26,height:26,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},defs);
  el('rect',{width:26,height:26,fill:a},p);el('rect',{width:10,height:26,fill:'#fff',opacity:.6},p)});
// ── 介面小工具 ──
let toastT=0;function toast(t){const e=$('toast');e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,2600)}
function modal(o){$('mB').innerHTML=(o.k?`<div class="mk">${o.k}</div>`:'')+(o.t?`<h2>${o.t}</h2>`:'')+(o.h||'');const B=$('mBtns');B.innerHTML='';
  (o.b||[{l:'繼續',c:'primary'}]).forEach(b=>{const e=document.createElement('button');e.innerHTML=b.l;if(b.c)e.className=b.c;if(b.dis)e.disabled=true;
    e.onclick=()=>{if(!b.keep)closeModal();b.f&&b.f()};B.appendChild(e)});
  $('modal').className=o.cls||'';$('modal').hidden=false;document.body.classList.add('mo');$('mB').scrollTop=0;if(o.after)o.after()}
function closeModal(){$('modal').hidden=true;document.body.classList.remove('mo')}
const row=(k,v)=>`<div class="row"><span>${k}</span><b>${v}</b></div>`;
const meter=(v,lo,hi)=>`<div class="meter"><i style="width:${clamp(v,0,100)}%;background:${v<lo?'#C2452F':v>hi?'#2E8B57':'#B78716'}"></i><u style="left:${lo}%"></u><u style="left:${hi}%"></u></div>`;
function focusLots(ls,sel){if(!ls.length)return;HL.clear();ls.forEach(l=>HL.add(l.id));const g=ls.flatMap(l=>l.g);closeSheet();zoomTo(g);
  setTimeout(()=>{paintLots(ls);if(sel!==false)select(ls[0].id)},420);setTimeout(()=>{HL.clear();paintLots(ls)},5200)}
// ── 買賣 ──
function askPrice(l){const o=S.own[l.id],b=val(l),st=siteOf(l);
  if(!o)return b*(l.f?(S.gen>=60?.9:S.gen<35?1.15:1):1);
  if(st&&st.st)return null;
  if(o==='yc')return b*1.5;if(o==='kw')return b*(S.R.kw.distress>0?.8:1.3);if(WHO[o]&&WHO[o].small)return b*1.2;return null}
function take(l,from){if(from==='yc'||from==='kw'){const st=siteOf(l);if(st){st.lots.forEach(i=>delete S.siteOf[i]);delete S.sites[st.id]}delete S.R.kw.buy[l.id]}S.own[l.id]='me';S.stats.bought++}
function buy(l){const o=S.own[l.id],p=askPrice(l);if(p===null||S.cash<p)return;S.cash-=p;
  const G=(R_MAIN.grudge||6)/6;
  if(o==='yc'){S.R.yc.cash+=p;S.R.yc.hate+=3*G;S.gen=clamp(S.gen-3,0,100);log(`你以 ${fmt(p)}由${N.yc}手上收購「${lotName(l)}」。村口嘅阿伯開始用另一種眼神望你。`)}
  else if(o==='kw'){S.R.kw.cash+=p;log(`你以 ${fmt(p)}向${N.kw}買入「${lotName(l)}」。對方職員全程冇停過撳計數機。`)}
  else if(o){log(`你以 ${fmt(p)}向${WHO[o].n}買入「${lotName(l)}」。`)}
  else{if(ADJ[l.id].some(i=>S.own[i]==='yc'))S.R.yc.hate+=1.2*G;log(`你以 ${fmt(p)}買入「${lotName(l)}」。`)}
  take(l,o);toast(`已買入「${lotName(l)}」`);paintLots([l]);refresh()}
function sellRaw(l){const st=siteOf(l),ls=st?siteLots(st):[l];if(st&&st.st)return;const p=sum(ls,base)*.9;
  modal({k:'放售',t:`放售${ls.length>1?'成個地盤（'+ls.length+' 塊）':'「'+lotName(l)+'」'}？`,h:`<p>即時套現 <b>${fmt(p)}</b>（市值九折）。賣咗就冇得反悔，地產代理嘅佣金亦唔會退。</p>`,
    b:[{l:'賣',c:'primary',f:()=>{S.cash+=p;if(st){st.lots.forEach(i=>delete S.siteOf[i]);delete S.sites[st.id]}ls.forEach(x=>delete S.own[x.id]);log(`你以 ${fmt(p)}放售「${lotName(l)}」${ls.length>1?'等 '+ls.length+' 塊地':''}。`);closeCard();paintLots(ls);refresh()}},{l:'唔賣'}]})}
// 小型業主：整間收購（教學流程：資料卡 → 提出收購 → 議價 → 完成）
function negotiate(k){const c=WHO[k].co,ls=lotsOf(k),V=sum(ls,val),ng=S.nego[k]||0;
  const offers=[[.95,30,'壓價'],[1.1,70,'市價加一成'],[1.3,100,'爽快價']];
  modal({k:'集團資料卡',t:c.name,h:`<p class="dim">${esc(c.role||'小型業主')}。唔擴張、唔競投、唔記仇，淨係收租。</p>
    <div class="box">${row('持有地塊',ls.length+' 塊')}${row('總面積',m2(sum(ls,l=>l.m2)))}${row('物業市值',fmt(V))}${row('每月租金',fmt(sum(ls,rentOf)))}</div>
    <p>提出整間收購，一次過接收全部地塊。${ng?'<br><b>今個月已經傾過一次，對方唔會再聽低過上次嘅價。</b>':''}</p>`,
    b:offers.map(([x,p,n],i)=>({l:`${n} ${fmt(V*x)}<small>成功機會 ${p}%</small>`,c:i===1?'primary':'',dis:S.cash<V*x||i<ng,f:()=>{
      if(rnd()*100<p){S.cash-=V*x;ls.forEach(l=>take(l,k));paintLots(ls);
        log(`你以 ${fmt(V*x)}收購成間${c.name}，接收 ${ls.length} 塊地。老闆簽完名即刻訂咗去溫哥華嘅單程機票。`,1);
        modal({k:'收購完成',t:`${c.name}而家係你嘅`,h:`<p>成交價 ${fmt(V*x)}，接收 ${ls.length} 塊地。老闆簽完名，即刻訂咗去溫哥華嘅單程機票。</p><p class="dim">相鄰嘅地塊可以合併成一個地盤，一齊發展。</p>`,b:[{l:'睇返啲地',c:'primary',f:()=>focusLots(ls)}]});refresh()}
      else{S.nego[k]=i+1;modal({k:'議價失敗',t:'「我要返去問下屋企人」',h:`<p>${c.name}老闆收起你份報價，話要「返去問下屋企人」。佢屋企人喺你出價嗰刻已經坐喺隔籬。</p><p class="dim">今個月要出高啲先有得傾。</p>`,b:[{l:'再出價',c:'primary',f:()=>negotiate(k)},{l:'遲啲先'}]});refresh()}}})).concat([{l:'遲啲先'}])})}
// ── 合併 ──
function mergeSet(l){const ok=x=>S.own[x.id]==='me'&&!!x.f===!!l.f&&x.blk===l.blk&&!(siteOf(x)&&siteOf(x).st);
  if(!ok(l))return[l];const set=[l],seen=new Set([l.id]);
  for(let i=0;i<set.length;i++)for(const j of ADJ[set[i].id]){const x=M.lots[j];if(!seen.has(j)&&ok(x)){seen.add(j);set.push(x)}}return set}
function doMerge(l){const set=mergeSet(l),fee=sum(set,val)*.01;if(S.cash<fee)return;S.cash-=fee;S.stats.fees+=fee;
  let retry=0;set.forEach(x=>{const o=siteOf(x);if(o){retry=Math.max(retry,o.retry||0);o.lots.forEach(i=>delete S.siteOf[i]);delete S.sites[o.id]}});
  const st={id:S.sid++,owner:'me',lots:set.map(x=>x.id),st:null,retry};S.sites[st.id]=st;set.forEach(x=>S.siteOf[x.id]=st.id);
  log(`你將 ${set.length} 塊相鄰地塊合併成一個地盤（${m2(siteM2(st))}），法律及測量費 ${fmt(fee)}。${set.length>=3?'三塊或以上，地積比 +10%。':''}`);
  toast(`已合併 ${set.length} 塊地`);paintLots(set);refresh()}
function ensureSite(l){let st=siteOf(l);if(!st){st={id:S.sid++,owner:'me',lots:[l.id],st:null};S.sites[st.id]=st;S.siteOf[l.id]=st.id}return st}
// ── 改變用途申請 ──
function chance(st,use,plan){let c=use==='village'?45+(S.gen-50)+(S.op-50)*.3:use==='res'?40+(S.op-50)*.8+(S.gen-50)*.25:50+(S.op-50)*.7;
  if(plan==='fac')c+=15;if(plan==='gov')c+=30;c+=(st.retry||0)*8+S.appMod+(st.cm||0);if(S.op<30)c*=.5;if(S.op>70)c+=8;return clamp(Math.round(c),5,95)}
function useBlock(st,u){const ls=siteLots(st),U=USES[u];
  if(u==='village'&&S.gen<45)return'鄉紳關係未夠 45，村代表唔肯「合作」';
  if(u==='res'&&!S.zone)return'政府未公佈發展區';
  if(u==='res'&&!ls.every(l=>CFG.ZONE.includes(l.a)))return'呢度唔喺發展區入面';
  if(u==='urban'&&ls.length<2)return'地盤太細，要先合併最少 2 塊';
  return''}
const APP_FEE=.3;
function applyModal(l){const st=ensureSite(l),farm=!!l.f,uses=Object.keys(USES).filter(u=>USES[u].from===(farm?'farm':'urban'));
  let use=uses.find(u=>!useBlock(st,u))||uses[0],plan='std';
  const draw=()=>{const V=siteBase(st),blk=useBlock(st,use);
    modal({k:'改變用途申請 · 試玩版數值',t:`${lotName(l)}${st.lots.length>1?'（'+st.lots.length+' 塊合併地盤）':''}`,cls:'tall',
      h:`<p class="dim">流程：${CFG.DC}諮詢 → ${CFG.TPB}審批（${CFG.APPROVE_MONTHS} 個月）→ ${CFG.LANDS}補地價 → 動工。現時地價 ${fmt(V)}，地盤 ${m2(siteM2(st))}。</p>
      <div class="opts">${uses.map(u=>{const U=USES[u],b=useBlock(st,u),k=kOf(st,plan),pr=premium(st,u),bc=buildCost(st,u),dv=V*U.done*k;
        return`<button class="opt${u===use?' on':''}" data-u="${u}"><b>${farm?'農地':'舊樓'} → ${U.n}</b><span class="pill">${b?'未符合':'機會約 '+chance(st,u,plan)+'%'}</span>
        <small>${b?'✕ '+b:U.need}</small>
        <small>補地價 ${fmt(pr)}　建築費 ${fmt(bc)}　工期 ${U.months} 個月</small>
        <small>完成後估值 <b>${fmt(dv)}</b>　預計賺 <b>${fmt(dv-V-pr-bc)}</b></small></button>`}).join('')}</div>
      <div class="plans">${Object.keys(PLANS).filter(p=>p!=='gov'||use!=='village').map(p=>`<button class="plan${p===plan?' on':''}" data-p="${p}"><b>${PLANS[p].n}</b><small>${PLANS[p].d}</small></button>`).join('')}</div>
      ${st.retry?`<p class="dim">之前被否決過 ${st.retry} 次；修改方案再申請，機會每次 +8。</p>`:''}`,
      b:[{l:`遞交申請（費用 ${fmt(APP_FEE)}）`,c:'primary',dis:!!blk||S.cash<APP_FEE,f:()=>submit(st,use,plan)},{l:'取消'}],
      after:()=>{document.querySelectorAll('#mB .opt').forEach(e=>e.onclick=()=>{use=e.dataset.u;if(use==='village'&&plan==='gov')plan='std';draw()});
        document.querySelectorAll('#mB .plan').forEach(e=>e.onclick=()=>{plan=e.dataset.p;draw()})}})};draw()}
function submit(st,use,plan){S.cash-=APP_FEE;S.stats.fees+=APP_FEE;st.st='applied';st.use=use;st.plan=plan;st.due=S.m+CFG.APPROVE_MONTHS-1;
  let d=use==='res'?-2:use==='urban'?-3:0;if(plan==='fac')d+=4;if(plan==='gov')d-=8;S.op=clamp(S.op+d,0,100);
  const nm=lotName(M.lots[st.lots[0]]);
  log(`你為「${nm}」遞交改做${USES[use].n}嘅申請（${PLANS[plan].n}）。${CFG.DC}諮詢期間收到 3 份意見書，其中 2 份係投訴隔籬裝修。${d?'民意 '+(d>0?'+':'')+d+'。':''}`);
  toast('已遞交申請，月底有結果');paintLots(siteLots(st));refresh()}
const REJ={res:[()=>`${CFG.TPB}以「與鄉郊特色不配合」為由否決申請。同一份會議紀錄第 7 項，${N.big}隔籬嗰幅地獲批起 30 層住宅。`,()=>`${CFG.TPB}委員認為方案「交通配套不足」，否決申請。委員散會之後，喺元朗公路塞咗四十五分鐘。`],
  village:[()=>`村代表交咗意見書，寫明「村民強烈反對」，申請被否決。簽名嗰版有十二個名，筆跡得一款。`,()=>`${CFG.TPB}話村屋方案「欠缺整體規劃」，否決申請。隔籬嗰排冇申請過嘅鐵皮屋就繼續有整體規劃咁企喺度。`],
  urban:[()=>`${CFG.TPB}話重建會「破壞社區網絡」，否決申請。該社區網絡目前由三間地產舖同一間找換店組成。`]};
function approve(st,cond){st.st='approved';st.k=kOf(st,st.plan,cond);delete st.cm}
function resolve(st,rep){const c=chance(st,st.use,st.plan),r=rnd()*100,nm=lotName(M.lots[st.lots[0]]),U=USES[st.use];
  if(r<c){approve(st);const t=`✔ ${CFG.TPB}批准「${nm}」改做${U.n}。新聞稿形容審批過程「嚴謹、公開、透明」，全文共兩行。`;rep.lines.push(t);log(t,1)}
  else if(r<c+12){st.st='cond';const t=`◐ ${CFG.TPB}有條件批准「${nm}」：要加建公共設施同降低高度（完成價值 −8%）。接受定放棄，你話事。`;rep.lines.push(t);log(t)}
  else{st.st=null;st.retry=(st.retry||0)+1;delete st.cm;const t='✕ 「'+nm+'」：'+pick(REJ[st.use])();rep.lines.push(t);log(t,1)}}
function haggle(st){st.hagged=1;if(rnd()<.55){st.hag=.8;log(`${CFG.LANDS}同意將補地價減兩成。對方表示「絕對唔係先例」，呢句說話佢哋今年講咗四十次。`);toast('議價成功：補地價 −20%')}
  else{st.wait=S.m;log(`${CFG.LANDS}話補地價「需要再研究」。研究期間，你今個月動唔到工。`);toast('議價失敗：今個月動唔到工')}refresh()}
function startBuild(st){const cost=premium(st)+buildCost(st);if(S.cash<cost)return;S.cash-=cost;st.paid=cost;st.st='building';st.left=USES[st.use].months;
  if(st.use==='village')S.gen=clamp(S.gen+3,0,100);if(st.use==='res')S.gen=clamp(S.gen-4,0,100);
  log(`「${lotName(M.lots[st.lots[0]])}」動工起${USES[st.use].n}，補地價連建築費共 ${fmt(cost)}，工期 ${st.left} 個月。`,1);toast('動工！');paintLots(siteLots(st));refresh()}
const saleF=()=>.9+S.op/250;
function sellDone(st){const p=siteVal(st)*saleF(),ls=siteLots(st);
  modal({k:'分拆出售',t:`一次過賣晒「${lotName(ls[0])}」？`,h:`<p>現時民意 ${Math.round(S.op)}，買家肯俾估值嘅 ${Math.round(saleF()*100)}%：套現 <b>${fmt(p)}</b>。賣咗之後呢個地盤唔再收租。</p><p class="dim">樓書會寫「尊尚生活、傲視元朗」。實際傲視嘅係隔籬個貨櫃場。</p>`,
    b:[{l:`賣晒，套現 ${fmt(p)}`,c:'primary',f:()=>{S.cash+=p;S.stats.sales+=p;st.owner='sold';ls.forEach(l=>S.own[l.id]='sold');
      log(`你將「${lotName(ls[0])}」嘅${USES[st.use].n}分拆出售，套現 ${fmt(p)}。開售首日，排頭位嗰位係地產代理請嚟嘅。`,1);closeCard();paintLots(ls);refresh()}},{l:'繼續收租'}]})}
// ── 地塊資料卡 ──
function select(id){SEL=id;closeSheet();gSel.setAttribute('points',pts(M.lots[id].g));$('deed').hidden=false;renderCard()}
function closeCard(){SEL=null;gSel.setAttribute('points','');$('deed').hidden=true}
function renderCard(){if(SEL===null)return;const l=M.lots[SEL];if(!l){closeCard();return}const dh=$('dh');let body='',btn=[];
  const B=(label,fn,cls,dis)=>{btn.push({label,fn,cls,dis})};
  if(l.k==='buy'){const o=S.own[l.id],st=siteOf(l),U=st&&st.use?USES[st.use]:null,done=st&&st.st==='done';
    const type=done?U.n:l.f?'農地':String(l.z||'').startsWith('V')?'鄉村屋地':'市區物業';
    dh.style.background=o?WHO[o].c:l.f?'#7C8A2E':'#B78716';
    $('dTag').textContent=l.a+' · '+type+(inZone(l)&&!done?' · 發展區':'');$('dSt').textContent=lotName(l);$('dSub').textContent=l.n&&l.s?l.s.join(' × '):'';
    const merged=st&&st.lots.length>1;
    body=row(merged?`地盤（${st.lots.length} 塊）`:'佔地',m2(merged?siteM2(st):l.m2))+row(merged?'地盤市值':'市值',fmt(merged?siteVal(st):val(l)))+
      (o&&o!=='sold'?row('每月租金',fmt(merged?sum(siteLots(st),rentOf):rentOf(l))):'')+row('業主',o?WHO[o].n:'未有業主');
    if(!o){const p=askPrice(l);body+=`<div class="note">${l.f?(S.gen>=60?'鄉紳關係好，收地平一成。':S.gen<35?'鄉紳關係差，村民坐地起價，貴一成半。':'')+(inZone(l)?'發展區內農地，可以申請改做住宅。':'農地可以同鄉紳合作起村屋。'):'現成物業，買入即收租；合併相鄰地塊可以重建。'}</div>`;
      B(`買入 ${fmt(p)}`,()=>buy(l),'primary',S.cash<p)}
    else if(o==='me'){
      if(!st||!st.st){const set=mergeSet(l),cur=st?st.lots.length:1;
        if(st&&st.retry)body+=`<div class="note">申請被否決過 ${st.retry} 次，可以修改方案再申請。</div>`;
        if(set.length>cur){const fee=sum(set,val)*.01;B(`合併相鄰 ${set.length} 塊（費用 ${fmt(fee)}）`,()=>doMerge(l),'primary',S.cash<fee)}
        B('遞交改變用途申請',()=>applyModal(l),set.length>cur?'':'primary');B(`放售 ${fmt(sum(st?siteLots(st):[l],base)*.9)}`,()=>sellRaw(l))}
      else if(st.st==='applied')body+=`<div class="status">📨 ${CFG.TPB}審批中：改做${U.n}（${PLANS[st.plan].n}），機會約 ${chance(st,st.use,st.plan)}%。撳「下個月」就有結果。</div>`;
      else if(st.st==='cond'){body+=`<div class="status">◐ 有條件批准：要加建公共設施同降低高度，完成價值 −8%。</div>`;
        B('接受條件',()=>{approve(st,1);log(`你接受咗${CFG.TPB}嘅附帶條件。`);paintLots(siteLots(st));refresh()},'primary');B('放棄申請',()=>{st.st=null;paintLots(siteLots(st));refresh()})}
      else if(st.st==='approved'){const pr=premium(st),bc=buildCost(st),dv=siteBase(st)*U.done*st.k,wait=st.wait===S.m;
        body+=`<div class="status">✔ 已獲批改做${U.n}。${wait?CFG.LANDS+'仲「研究緊」，下個月先動得工。':''}</div>`+row('補地價'+(st.hag?'（已議價）':''),fmt(pr))+row('建築費',fmt(bc))+row('工期',U.months+' 個月')+row('完成後估值',fmt(dv));
        B(`動工（共 ${fmt(pr+bc)}）`,()=>startBuild(st),'primary',wait||S.cash<pr+bc);if(!st.hagged)B('同'+CFG.LANDS+'議價',()=>haggle(st))}
      else if(st.st==='building')body+=`<div class="status">🏗 興建${U.n}中，仲有 ${st.left} 個月完工。工期內唔收租。</div>`+row('完成後估值',fmt(siteBase(st)*U.done*st.k));
      else if(done){body+=`<div class="status">🏠 ${U.n}已落成，收租中。</div>`;B(`分拆出售 ${fmt(siteVal(st)*saleF())}`,()=>sellDone(st),'primary')}}
    else if(o==='sold')body+=`<div class="note">單位已經賣晒俾散戶，業主立案法團第一次開會就嘈咗三個鐘。</div>`;
    else if(WHO[o].small){const p=askPrice(l);body+=`<div class="note">${WHO[o].n}：${esc(WHO[o].co.role||'小型業主')}。可以逐塊買（市價 ×1.2），或者整間收購。</div>`;
      B('資料卡／整間收購',()=>negotiate(o),'primary');B(`淨係買呢塊 ${fmt(p)}`,()=>buy(l),'',S.cash<p)}
    else{const p=askPrice(l),R=o==='yc'?R_MAIN:R_SPEC;
      body+=`<div class="note">${R.name}：${esc(R.style||'')}。${st&&st.st?'呢度有工程進行緊，對方唔賣。':o==='kw'&&S.R.kw.distress>0?'對方資金緊張，肯蝕讓（市價八折）。':o==='yc'?'硬收購要俾市價 1.5 倍，而且會結怨。':'炒家開價：市價 1.3 倍。'}</div>`;
      if(p!==null)B(`收購 ${fmt(p)}`,()=>buy(l),'primary',S.cash<p)}}
  else if(l.k==='dev'){const c=CO.major.find(x=>x.name===l.dev);dh.style.background='#5B3F8C';$('dTag').textContent=l.a+' · 大地產商物業';$('dSt').textContent=lotName(l);$('dSub').textContent=l.dev||'';
    body=row('佔地',m2(l.m2))+row('市值',fmt(l.p*S.idx))+`<div class="note">${c?esc(c.style)+'。弱點：'+esc(c.weakness)+'。':''}大集團嘅物業今章唔放售——你暫時未夠班同佢哋傾。</div>`}
  else if(l.k==='bank'){dh.style.background='#1F7A66';$('dTag').textContent='銀行 · 非賣品';$('dSt').textContent=dn(l);$('dSub').textContent=(l.s||[]).join(' × ');
    body=`<div class="note">入去借錢、還錢。</div>`;B('入銀行',()=>{closeCard();openSheet('bank')},'primary')}
  else{const K=KIND[l.k]||KIND.gov;dh.style.background=K.head||'#6B717C';$('dTag').textContent=K.tag+' · 非賣品';$('dSt').textContent=l.n||K.tag;$('dSub').textContent=(l.s||[]).join(' × ');
    body=row('佔地',m2(l.m2))+`<div class="note">${{park:'公眾休憩用地，唔可以買賣。',gov:'政府或公共機構用地，唔可以買賣。',rel:'宗教場所，唔可以買賣。',comm:'學校、醫院同社區設施，唔可以買賣。',mark:'地標唔放售。'}[l.k]||''}</div>`}
  $('dBody').innerHTML=body+'<div class="act"></div>';const A=$('dBody').querySelector('.act');
  btn.forEach(b=>{const e=document.createElement('button');e.textContent=b.label;if(b.cls)e.className=b.cls;e.disabled=!!b.dis;e.onclick=b.fn;A.appendChild(e)})}
// ── 分頁 ──
const TABS={proj:'你嘅項目',riv:'對手同排名',rel:'民意同鄉紳',bank:'銀行',log:'記錄'};
function openSheet(t){closeCard();TAB=t;$('sheet').hidden=false;renderSheet();document.querySelectorAll('#dock [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t))}
function closeSheet(){TAB=null;$('sheet').hidden=true;document.querySelectorAll('#dock [data-tab]').forEach(b=>b.classList.remove('on'))}
const ST_LABEL={applied:'審批中',cond:'有條件批准',approved:'已批，未動工',building:'施工中',done:'收租中'};
function renderSheet(){if(!TAB)return;$('shT').textContent=TABS[TAB];const B=$('shB');let h='';
  if(TAB==='proj'){const mine=lotsOf('me'),seen=new Set(),items=[];
    mine.forEach(l=>{const st=siteOf(l);if(st){if(seen.has(st.id))return;seen.add(st.id);items.push({l,st})}else items.push({l})});
    const w=worth('me');
    h=`<div class="box">${row('現金',fmt(S.cash))}${row('物業市值',fmt(sum(mine,val)))}${row('貸款',fmt(debtAll()))}${row('身家',fmt(w))}${row('開局身家',fmt(S.start))}${row('解鎖第二章要',fmt(S.start*CFG.UNLOCK)+' 而且贏'+N.yc)}</div>`;
    h+=items.length?items.sort((a,b)=>(b.st&&b.st.st?1:0)-(a.st&&a.st.st?1:0)).map(({l,st})=>`<button class="item" data-go="${l.id}"><b>${esc(lotName(l))}${st&&st.lots.length>1?' 等 '+st.lots.length+' 塊':''}</b>
      <span class="chip ${st&&st.st?'c-'+st.st:''}">${st&&st.st?ST_LABEL[st.st]+(st.st==='building'?' · 仲有 '+st.left+' 個月':''):st&&st.lots.length>1?'已合併':l.f?'農地':'收租'}</span>
      <small>${l.a} · ${st&&st.use&&st.st?USES[st.use].n+' · ':''}市值 ${fmt(st?siteVal(st):val(l))}</small></button>`).join(''):'<p class="dim">你乜都冇。大哥會好開心。</p>'}
  else if(TAB==='riv'){const bar=(k,v)=>`<div class="attr"><span>${k}</span><div><i style="width:${v*10}%"></i></div><b>${v}</b></div>`;
    const card=(k,R,extra)=>{const ls=lotsOf(k);return`<div class="rcard" style="--c:${WHO[k].c}"><div class="rh"><b>${R.name}</b><span>${esc(R.role||'')}</span></div>
      <p>${esc(R.style||'')}　<span class="dim">弱點：${esc(R.weakness||'')}</span></p>${bar('資金',R.cash)}${bar('進取',R.aggressive)}${bar('狡猾',R.cunning)}${bar('記仇',R.grudge)}
      ${row('身家（估算）',fmt(worth(k)))}${row('地塊',ls.length+' 塊')}${extra}${ls.length?`<button class="lnk" data-who="${k}">喺地圖睇佢啲地 ›</button>`:''}</div>`};
    const hate=S.R.yc.hate;
    h=card('yc',R_MAIN,row('對你嘅仇恨',(hate<2?'未有':hate<5?'開始留意你':hate<8?'針對你':'不共戴天')+`（${hate.toFixed(1)}）`))+
      card('kw',R_SPEC,row('狀態',S.R.kw.distress>0?'資金緊張，蝕讓中（八折）':'睇升市就追入')+row('借貸',fmt(S.R.kw.debt)));
    h+=`<h3>資產排名</h3>${rankTable(ranking())}<h3>小型業主</h3>`+CO.small.map((c,i)=>{const n=lotsOf('c'+i).length;return n?`<button class="item" data-who="c${i}"><b>${c.name}</b><span class="chip">${n} 塊</span><small>${esc(c.role||'')} · 市值 ${fmt(worth('c'+i))}</small></button>`:''}).join('')}
  else if(TAB==='rel'){const act=k=>{const a=ACTS[k];return`<button class="item" data-act="${k}" ${S.did[k]||S.cash<a.c?'disabled':''}><b>${a.n}</b><span class="chip">${a.g==='op'?'民意':'鄉紳'} +${a.d}</span><small>費用 ${fmt(a.c)}${S.did[k]?' · 今個月做過':''}</small></button>`};
    h=`<div class="box"><div class="mh"><b>民意</b><span>${Math.round(S.op)} / 100</span></div>${meter(S.op,30,70)}
      <p class="dim">${S.op<30?'低過 30：審批機會減半，租金 −10%。':S.op>70?'高過 70：申請易批，租金 +10%。':'30 以下審批機會減半；70 以上易批、租金 +10%。分拆出售嘅價錢亦跟民意。'}</p></div>${act('hall')}${act('space')}
      <div class="box"><div class="mh"><b>鄉紳及村代表</b><span>${Math.round(S.gen)} / 100</span></div>${meter(S.gen,30,60)}
      <p class="dim">${S.gen<30?'低過 30：村民隨時封路，工程停工。':S.gen>=60?'60 以上：收農地平一成，村屋申請易批。':'45 以上先可以合作起村屋；60 以上收農地平一成；30 以下村民會封路。每個月自動回落返 50。'}</p></div>${act('feast')}${act('temple')}`}
  else if(TAB==='bank'){const lim=Math.max(0,bankLimit()-S.loanCut),st=CFG.LOAN_STEP;
    const bk=(k,name,rate,limit,desc)=>{const d=S.debt[k],room=Math.max(0,limit-d);return`<div class="box"><div class="mh"><b>${name}</b><span>月息 ${(rate*100).toFixed(2)}%</span></div><p class="dim">${desc}</p>
      ${row('已借',fmt(d))}${row('仲可以借',fmt(room))}<div class="act"><button class="primary" data-bor="${k}" ${room<st?'disabled':''}>借 ${st} 億</button><button data-rep="${k}" ${d<=0||S.cash<Math.min(st,d)?'disabled':''}>還 ${fmt(Math.min(st,d||st))}</button></div></div>`};
    h=bk('bank',CFG.BANK,S.rate,lim,'地區銀行：利息低，但只肯借你物業市值嘅四成。')+bk('fin',CFG.FIN,CFG.FIN_RATE,CFG.FIN_LIMIT,'財務公司：乜都借，利息係銀行三倍。現金見紅會自動喺度透支。')+`<p class="dim">利息每個月自動喺現金扣；年結計身家時貸款會扣返。</p>`}
  else if(TAB==='log'){let m=0;h=S.log.map(e=>(e.m!==m?(m=e.m,`<h3>第 ${m} 個月</h3>`):'')+`<p class="lg">${esc(e.t)}</p>`).join('')}
  B.innerHTML=h;
  B.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>{const l=M.lots[+e.dataset.go],st=siteOf(l);focusLots(st?siteLots(st):[l])});
  B.querySelectorAll('[data-who]').forEach(e=>e.onclick=()=>focusLots(lotsOf(e.dataset.who)));
  B.querySelectorAll('[data-act]').forEach(e=>e.onclick=()=>doAct(e.dataset.act));
  B.querySelectorAll('[data-bor]').forEach(e=>e.onclick=()=>{const k=e.dataset.bor;S.debt[k]+=CFG.LOAN_STEP;S.cash+=CFG.LOAN_STEP;log(`你向${k==='bank'?CFG.BANK:CFG.FIN}借咗 ${CFG.LOAN_STEP} 億。`);refresh()});
  B.querySelectorAll('[data-rep]').forEach(e=>e.onclick=()=>{const k=e.dataset.rep,v=Math.min(CFG.LOAN_STEP,S.debt[k]);S.debt[k]-=v;S.cash-=v;log(`你還咗 ${fmt(v)}俾${k==='bank'?CFG.BANK:CFG.FIN}。`);refresh()})}
function rankTable(r){return`<div class="rank">${r.map((x,i)=>{const d=x.w-(S.rank0[x.k]||x.w),p=S.rank0[x.k]?d/S.rank0[x.k]*100:0;
  return`<div class="rk${x.me?' me':''}${x.big?' big':''}"><i>${i+1}</i><b>${x.n}${x.big?'<small>'+(x.bro?'大哥 · 圖外資產':'連圖外資產')+'</small>':''}</b><span>${fmt(x.w)}</span><em class="${p>=.5?'up':p<=-.5?'dn':''}">${Math.abs(p)<.5?'—':(p>0?'▲':'▼')+Math.abs(p).toFixed(0)+'%'}</em></div>`}).join('')}</div>`}
const ACTS={hall:{g:'op',n:'資助社區中心',c:3,d:12,x:()=>'社區中心剪綵嗰日，你個名刻喺牌匾第一行，字體大過中心個名。'},
  space:{g:'op',n:'開放公眾休憩空間',c:1,d:5,x:()=>'你將一幅空地開放俾街坊。入口告示牌列明 14 項「不准」。'},
  feast:{g:'gen',n:'請鄉紳飲宴',c:.3,d:6,x:()=>'席間你敬咗十二次酒，其中十次敬錯人。村長話你「有心」。'},
  temple:{g:'gen',n:'捐錢重修祠堂',c:2,d:15,x:()=>`祠堂牆上多咗塊雲石碑。你排喺「樂捐芳名」第二位，第一位係${N.yc}。`}};
function doAct(k){const a=ACTS[k];if(S.did[k]||S.cash<a.c)return;S.cash-=a.c;S.stats.fees+=a.c;S.did[k]=1;if(a.g==='op')S.op=clamp(S.op+a.d,0,100);else S.gen=clamp(S.gen+a.d,0,100);
  const t=a.x();log(`${a.n}（${fmt(a.c)}）：${t}`);toast(`${a.g==='op'?'民意':'鄉紳關係'} +${a.d}`);refresh()}
// ── HUD／教學 ──
function hud(){const w=worth('me'),d=(w/S.start-1)*100;$('hM').textContent=S.over?'年結':`第 ${S.m} 月 / ${CFG.MONTHS}`;
  $('hCash').textContent=fmt(S.cash).replace(' 億','');$('hWorth').textContent=fmt(w).replace(' 億','');
  $('hDelta').textContent=(d>=0?'▲':'▼')+Math.abs(d).toFixed(0)+'%';$('hDelta').className=d>=0?'up':'dn';
  $('hOp').textContent=Math.round(S.op);$('hOp').className=S.op<30?'dn':S.op>70?'up':'';$('hGen').textContent=Math.round(S.gen);$('hGen').className=S.gen<30?'dn':S.gen>=60?'up':'';
  $('next').textContent=S.over?'睇年報':S.m>=CFG.MONTHS?'年結 ›':'下個月 ›'}
const TUT=[
  {t:`收購${N.luk}`,d:`${N.luk}老闆想退休，手上有幾塊市中心地。撳佢嘅地 →「資料卡／整間收購」→ 揀個價。`,go:()=>focusLots(lotsOf('c0')),ok:()=>!lotsOf('c0').length},
  {t:'合併相鄰地塊',d:'撳你啱啱收購嘅地 →「合併相鄰地塊」。相連嘅地合埋先起得大，三塊或以上仲有地積比獎勵。',go:()=>focusLots(lotsOf('me').filter(l=>!l.f)),ok:()=>Object.values(S.sites).some(s=>s.owner==='me'&&s.lots.length>1)},
  {t:'遞交改變用途申請',d:`揀一個合併咗嘅地盤，或者返去你嘅農地 →「遞交改變用途申請」。農地起村屋要鄉紳關係 45 以上；改住宅要等政府公佈發展區（下個月）。`,go:()=>focusLots(lotsOf('me').filter(l=>l.f)),ok:()=>Object.values(S.sites).some(s=>s.owner==='me'&&s.st)},
  {t:'撳「下個月」',d:'審批結果、工程進度、租金、利息同對手行動，全部喺月底結算。',go:null,ok:()=>S.m>1}];
function coach(){const c=$('coach');if(S.over||S.tut>=TUT.length){c.hidden=true;return}
  while(S.tut<TUT.length&&TUT[S.tut].ok())S.tut++;if(S.tut>=TUT.length){c.hidden=true;toast('教學完成，之後靠你自己');return}
  const T=TUT[S.tut];c.hidden=false;$('coT').textContent=`教學 ${S.tut+1}/${TUT.length} · ${T.t}`;$('coD').textContent=T.d;$('coGo').hidden=!T.go;$('coGo').onclick=T.go}
function refresh(){hud();renderCard();renderSheet();coach();save()}
// ── 月結 ──
function finishSite(st,rep){st.st='done';const ls=siteLots(st),nm=lotName(ls[0]);
  if(st.owner==='me'){S.stats.done++;const t=`🏠 「${nm}」嘅${USES[st.use].n}落成，估值 ${fmt(siteVal(st))}。可以收租，或者分拆出售。`;rep.lines.push(t);log(t,1)}
  else{const p=siteVal(st);S.R.yc.cash+=p;st.owner='sold';ls.forEach(l=>S.own[l.id]='sold');const t=`${N.yc}喺「${nm}」起嘅村屋賣晒，套現 ${fmt(p)}。買家全部「碰巧」同村長同姓。`;rep.riv.push(t);log(t)}
  paintLots(ls)}
function settle(){const rep={m:S.m,lines:[],riv:[]},inc={};
  BUY.forEach(l=>{const o=S.own[l.id];if(o&&o!=='sold')inc[o]=(inc[o]||0)+rentOf(l)});
  rep.inc=inc.me||0;S.cash+=rep.inc;S.stats.rent+=rep.inc;S.R.yc.cash+=inc.yc||0;S.R.kw.cash+=inc.kw||0;
  rep.int=S.debt.bank*S.rate+S.debt.fin*CFG.FIN_RATE;S.cash-=rep.int;S.stats.interest+=rep.int;S.R.kw.cash-=S.R.kw.debt*S.rate*1.5;
  let block=S.gen<30&&rnd()<.4;
  Object.values(S.sites).forEach(st=>{
    if(st.st==='building'){if(block&&st.owner==='me'){block=false;S.gen=clamp(S.gen+2,0,100);const t=`🚧 村民喺「${lotName(M.lots[st.lots[0]])}」地盤門口擺咗三張摺凳同一把太陽傘，工程停咗一個月。警方表示「正了解事件」。`;rep.lines.push(t);log(t,1)}
      else if(--st.left<=0)finishSite(st,rep)}
    else if(st.st==='applied'&&st.owner==='me'&&st.due<=S.m){resolve(st,rep);paintLots(siteLots(st))}});
  if(S.cash<0){const need=-S.cash;S.debt.fin+=need;S.cash=0;const t=`💸 現金見紅，${CFG.FIN}「主動」幫你透支 ${fmt(need)}（月息 ${(CFG.FIN_RATE*100).toFixed(1)}%）。佢哋個客戶經理識得你屋企地址。`;rep.lines.push(t);log(t);
    if(S.debt.fin>CFG.FIN_LIMIT+15){const raw=lotsOf('me').filter(l=>!siteOf(l)||!siteOf(l).st).sort((a,b)=>val(a)-val(b))[0];
      if(raw){const st=siteOf(raw);if(st){st.lots.forEach(i=>delete S.siteOf[i]);delete S.sites[st.id]}const p=base(raw)*.75;S.debt.fin-=Math.min(S.debt.fin,p);delete S.own[raw.id];paintLots([raw]);
        const t2=`🔨 ${CFG.FIN}嘅同事好有禮貌咁上門，將「${lotName(raw)}」以七五折拍賣抵債。`;rep.lines.push(t2);log(t2,1)}}}
  S.gen+=S.gen>50?-1:S.gen<50?1:0;S.R.yc.hate=Math.max(0,S.R.yc.hate-.3);
  S.rentTmp=1;S.appMod=0;S.did={};S.nego={};return rep}
function rivals(rep){const Y=S.R.yc,K=S.R.kw,mine=new Set(lotsOf('me').map(l=>l.id));
  // 主要對手（地頭蟲）：靠鄉事關係平價收農地，喺自己地隔籬同你隔籬擴張，夠錢就起村屋賣
  const ycl=lotsOf('yc'),ycs=new Set(ycl.map(l=>l.id));
  if(!Object.values(S.sites).some(s=>s.owner==='yc'&&s.st==='building')){const raw=ycl.filter(l=>l.f&&!siteOf(l));
    if(raw.length){const set=[raw[0]],seen=new Set([raw[0].id]);for(let i=0;i<set.length&&set.length<3;i++)for(const j of ADJ[set[i].id]){const x=M.lots[j];if(!seen.has(j)&&ycs.has(j)&&x.f&&!siteOf(x)&&set.length<3){seen.add(j);set.push(x)}}
      const cost=sum(set,base)*2*.8;if(Y.cash>=cost+1){Y.cash-=cost;const st={id:S.sid++,owner:'yc',lots:set.map(x=>x.id),st:'building',use:'village',k:.9,left:CFG.APPROVE_MONTHS+USES.village.months};S.sites[st.id]=st;set.forEach(x=>S.siteOf[x.id]=st.id);paintLots(set);
        rep.riv.push(`${N.yc}喺「${lotName(set[0])}」一帶起村屋。審批快到申請表上面啲墨都未乾。`)}}}
  if(rnd()<(R_MAIN.aggressive||6)/10+(Y.hate>=5?.2:0)){const areas=new Set(ycl.map(l=>l.a));
    const c=BUY.filter(l=>!S.own[l.id]&&l.f&&base(l)*.9<=Y.cash-3);
    if(c.length){const sc=l=>(ADJ[l.id].some(i=>ycs.has(i))?3:0)+(Y.hate>=3&&ADJ[l.id].some(i=>mine.has(i))?1+Y.hate/2:0)+(areas.has(l.a)?1:0)-base(l)/8+rnd()*1.5;
      const l=c.sort((a,b)=>sc(b)-sc(a))[0];Y.cash-=base(l)*.9;S.own[l.id]='yc';paintLots([l]);
      rep.riv.push(ADJ[l.id].some(i=>mine.has(i))?`${N.yc}搶先買入你隔籬嘅「${lotName(l)}」。村長話：「先到先得。同埋佢係我契仔。」`:`${N.yc}買入「${lotName(l)}」。賣家話本來唔賣，但「畀面」。`)}}
  if(Y.hate>=5&&rnd()<(R_MAIN.cunning||7)/10*.45){const app=Object.values(S.sites).find(s=>s.owner==='me'&&s.st==='applied');
    if(app){app.cm=(app.cm||0)-15;rep.riv.push(`有人喺村口派傳單，話你個項目會「影響風水同埋 Wi-Fi」。傳單用${N.yc}寫字樓部影印機印。你嘅申請機會 −15。`)}
    else{S.gen=clamp(S.gen-5,0,100);rep.riv.push(`${N.yc}老闆同村長打咗成晚麻雀。你個名喺枱面出現咗好多次，冇一次係好嘢。鄉紳關係 −5。`)}}
  // 炒家：見升就追、借到盡；加息或者辣招就要蝕讓
  const kwl=lotsOf('kw').filter(l=>!siteOf(l)),up=S.idx>=K.last-1e-9;K.last=S.idx;
  const sellK=(l,f)=>{const p=base(l)*f;K.cash+=p;delete S.own[l.id];delete K.buy[l.id];const r=Math.min(K.debt,Math.max(0,K.cash-2));K.debt-=r;K.cash-=r;paintLots([l]);return p};
  if(K.distress>0){const s=kwl.sort((a,b)=>base(a)-base(b)).slice(0,2);if(s.length){s.forEach(l=>sellK(l,.8));rep.riv.push(`${N.kw}被銀行追數，八折斬倉賣走 ${s.length} 塊地。老闆喺社交平台出帖：「長線投資，無懼波動。」`)}K.distress--}
  else{kwl.forEach(l=>{if(K.buy[l.id]&&base(l)/K.buy[l.id]>=1.1){const g=base(l)-K.buy[l.id];sellK(l,1);rep.riv.push(`${N.kw}高位出貨「${lotName(l)}」，賺 ${fmt(g)}。`)}});
    if(up){const eq=worth('kw');let n=Math.max(1,Math.round((R_SPEC.aggressive||9)/4)),got=[];
      const c=BUY.filter(l=>!S.own[l.id]&&base(l)<=12).map(l=>[l,(inZone(l)?3:0)+(ADJ[l.id].some(i=>mine.has(i))?2:0)+rnd()*2-base(l)/10]).sort((a,b)=>b[1]-a[1]);
      for(const [l] of c){if(!n)break;const p=base(l),room=K.cash+Math.max(0,eq*1.5-K.debt);if(p>room)continue;if(K.cash>=p)K.cash-=p;else{K.debt+=p-K.cash;K.cash=0}S.own[l.id]='kw';K.buy[l.id]=p;got.push(l);n--}
      if(got.length){paintLots(got);rep.riv.push(`${N.kw}追入 ${got.map(l=>'「'+lotName(l)+'」').join('、')}${got.some(l=>ADJ[l.id].some(i=>mine.has(i)))?'，其中有啲啱啱好喺你隔籬':''}。錢係借返嚟嘅，信心係自己嘅。`)}}}
  rep.riv.forEach(t=>log(t))}
function nextMonth(){if(S.over){annual();return}closeCard();closeSheet();const rep=settle();rivals(rep);S.m++;
  const net=rep.inc-rep.int;
  const h=`<div class="box">${row('租金收入','+'+fmt(rep.inc))}${row('貸款利息','−'+fmt(rep.int))}${row('本月淨額',(net>=0?'+':'−')+fmt(Math.abs(net)))}${row('現金',fmt(S.cash))}</div>`+
    (rep.lines.length?'<h3>你嘅項目</h3>'+rep.lines.map(t=>`<p class="lg">${esc(t)}</p>`).join(''):'')+
    '<h3>對手動向</h3>'+(rep.riv.length?rep.riv.map(t=>`<p class="lg">${esc(t)}</p>`).join(''):'<p class="lg dim">今個月對手按兵不動。通常唔係好事。</p>');
  if(S.m>CFG.MONTHS){S.over=true;S.m=CFG.MONTHS;refresh();modal({k:`第 ${rep.m} 個月結算`,t:'十二個月到期',h,cls:'tall',b:[{l:'睇年報',c:'primary',f:annual}]});return}
  refresh();modal({k:`第 ${rep.m} 個月結算`,t:net>=0?'收支平穩':'入不敷支',h,cls:'tall',b:[{l:'繼續',c:'primary',f:()=>showEvent(drawEvent())}]})}
// ── 事件卡（黑色幽默；規則同數值寫實，文案諷刺）──
const allIdx=f=>{S.idx*=f};
const EV={
  zone:{t:'元朗東、南邊圍劃入新發展區',x:()=>`${CFG.PLAN}公佈將${CFG.ZONE.join('同')}劃做「新發展區」，區內農地可以申請改劃做住宅。消息公佈前一個星期，區內農地成交量「碰巧」升咗三倍。`,
    fx:()=>{S.zone=true;paintAll();return`發展區內農地即時升值 ${Math.round((CFG.ZONE_UP-1)*100)}%，並可以申請「農地 → 新市鎮住宅」。地圖上金色虛線係區內未有業主嘅農地。`}},
  hike:{t:'銀行加息',x:()=>`美國聯儲局打咗個乞嗤，${CFG.BANK}即日加息。銀行經理話會同客戶「共渡時艱」——你負責渡，佢負責艱。`,
    fx:()=>{S.rate+=.0015;allIdx(.96);S.R.kw.distress=2;return`${CFG.BANK}月息升至 ${(S.rate*100).toFixed(2)}%，全區地價跌 4%。${N.kw}槓桿太高，開始蝕讓（佢啲地八折有交易）。`}},
  cut:{t:'放寬按揭',x:()=>'政府放寬按揭成數，市民終於可以借多啲錢，買貴啲嘅樓。專家形容為「上車良機」，一如過去二十年嘅每一日。',fx:()=>{allIdx(1.05);return'全區地價升 5%。'}},
  flood:{t:'黑雨水浸',x:()=>'一場黑雨，元朗多處水浸。你嘅農地變咗魚塘，地產代理即晚改廣告：「罕有臨海地段」。',fx:()=>{S.rentTmp=.5;return'今個月租金收入減半。'},
    ch:[{l:'捐 1 億救災',dis:()=>S.cash<1,f:()=>{S.cash-=1;S.op=clamp(S.op+6,0,100);return'你捐咗一億，支票放大咗做背景板。民意 +6。'}},{l:'唔關我事',f:()=>{S.op=clamp(S.op-3,0,100);return'你冇出聲。街坊留意到你冇出聲。民意 −3。'}}]},
  poon:{t:'議員嘅盆菜宴',x:()=>`${CFG.DC}議員邀請你贊助地區盆菜宴，席開八十圍。佢強調呢個「純粹係社區關懷」，然後順手遞上報價單。`,
    ch:[{l:'贊助 1.5 億',dis:()=>S.cash<1.5,f:()=>{S.cash-=1.5;S.op=clamp(S.op+8,0,100);S.gen=clamp(S.gen+4,0,100);return'你個名印喺每張枱嘅枱卡上面，蘿蔔下面仲有一張。民意 +8，鄉紳關係 +4。'}},{l:'婉拒',f:()=>{S.op=clamp(S.op-4,0,100);return'議員表示「完全理解」，然後喺下次會議提出要「加強監察區內發展商」。民意 −4。'}}]},
  press:{t:'《元朗日日報》踢爆',x:()=>'報紙頭版踢爆區內有農地變咗貨櫃場。記者打嚟問係咪你塊地，你話唔係。記者話佢仲未講係邊塊。',
    ch:[{l:'請記者飲茶（0.5 億）',dis:()=>S.cash<.5,f:()=>{S.cash-=.5;if(rnd()<.5)return'記者飲完茶，報道改咗做「發展商積極回應」。冇事發生。';S.op=clamp(S.op-8,0,100);return'飲茶過程俾隔籬枱影低，第二日變咗頭版續集。民意 −8。'}},{l:'開記者會澄清',f:()=>{S.op=clamp(S.op-2,0,100);return'你開咗四十分鐘記者會。新聞標題淨係用咗你抹汗嗰張相。民意 −2。'}}]},
  wed:{t:'村代表嫁女',x:()=>'村代表嫁女，全村擺酒。你收到請帖，帖上面已經印好你嘅人情金額。',
    ch:[{l:'照做人情（0.8 億）',dis:()=>S.cash<.8,f:()=>{S.cash-=.8;S.gen=clamp(S.gen+10,0,100);return'你坐主家席。新娘唔識你，但佢老豆識你個戶口。鄉紳關係 +10。'}},{l:'唔去',f:()=>{S.gen=clamp(S.gen-8,0,100);return'你張空櫈成晚擺喺主家席正中。鄉紳關係 −8。'}}]},
  tpb:{t:`${CFG.TPB}嘅標準`,x:()=>`${CFG.TPB}以「與鄉郊特色不配合」為由，一日內否決咗三宗小型申請。同一日，${N.big}一幅地獲批起 30 層住宅，理由係「配合整體規劃」。`,fx:()=>{S.appMod-=10;return'今個月所有申請嘅審批機會 −10。'}},
  rail:{t:'新鐵路站「研究中」',a:()=>pick(Object.keys(BUY.reduce((o,l)=>(o[l.a]=1,o),{}))),x:a=>`政府宣佈研究喺${a}興建新鐵路站，預計 2045 年落成，「視乎進度」。附近地價即日反映咗 2045 年嘅樂觀情緒。`,fx:a=>{S.pm[a]=(S.pm[a]||1)*1.12;paintAll();return`${a}地價升 12%。`}},
  emig:{t:'又一波移民潮',x:()=>'又一批街坊移民。搬屋公司生意好到要加價，你嘅租客就好到要求減租。',fx:()=>{allIdx(.95);return'全區地價跌 5%。'}},
  talent:{t:'人才輸入計劃',x:()=>'政府宣佈引入大批專才。專才發現月薪一半要用嚟交租，表示充分感受到香港嘅國際水平。',fx:()=>{allIdx(1.03);S.rentTmp=1.3;return'全區地價升 3%，今個月租金收入 +30%。'}},
  block:{t:'風水問題',cond:()=>Object.values(S.sites).some(s=>s.owner==='me'&&s.st==='building'),x:()=>'村民話你架泥頭車壓親條村嘅龍脈。風水師已經到場，並即場報價：每條龍脈 0.5 億。',
    ch:[{l:'俾 0.5 億「安龍」',dis:()=>S.cash<.5,f:()=>{S.cash-=.5;S.gen=clamp(S.gen+5,0,100);return'法事做咗二十分鐘，龍脈即時康復。鄉紳關係 +5。'}},{l:'唔信呢套',f:()=>{const s=Object.values(S.sites).find(s=>s.owner==='me'&&s.st==='building');if(s)s.left++;S.gen=clamp(S.gen-5,0,100);return'村民封咗路口一個月。工期 +1 個月，鄉紳關係 −5。'}}]},
  nano:{t:'「精品宅」熱潮',x:()=>'市場興起 120 呎「精品宅」，樓書形容為「擁抱極簡」。有買家表示，終於可以瞓喺床上面煮飯。',fx:()=>{allIdx(1.02);S.op=clamp(S.op-3,0,100);return'全區地價升 2%，市民對發展商嘅觀感差咗：民意 −3。'}},
  bro:{t:'大哥嘅封面故事',x:()=>`大哥以${N.bro}主席身份登上財經雜誌封面，談「家族傳承」。內文有一句提到你：「細佬喺元朗發展農業，我哋全家都好支持。」`,fx:()=>{S.loanCut+=5;return`${CFG.BANK}經理睇完篇訪問，將你嘅信貸額調低 5 億，理由係「農業前景審慎」。`}},
  cow:{t:'社區成員',cond:()=>lotsOf('me').some(l=>l.f),x:()=>'你塊農地上面嘅流浪牛，被保育團體認定為「社區成員」。搬走佢哋要先做諮詢，諮詢要時間，時間要錢。',
    ch:[{l:'起牛棚（0.3 億）',dis:()=>S.cash<.3,f:()=>{S.cash-=.3;S.op=clamp(S.op+5,0,100);return'牛棚落成，仲有冷氣。有街坊問可唔可以租。民意 +5。'}},{l:'夜晚「請」佢哋走',f:()=>{if(rnd()<.35){S.op=clamp(S.op-10,0,100);return'成個過程俾人用手機直播，觀看人數高過你個樓盤宣傳片。民意 −10。'}return'第二朝啲牛唔見咗。冇人問，你亦冇講。'}}]},
  spicy:{t:'政府出辣招',x:()=>'政府推出新一輪辣招遏抑炒風。炒家表示非常震驚，並喺記者會完結後即刻成立咗三間新公司。',fx:()=>{allIdx(.95);S.R.kw.distress=Math.max(S.R.kw.distress,2);return`全區地價跌 5%。${N.kw}被迫減磅，佢啲地八折有交易。`}}
};
function drawEvent(){if(S.m===CFG.ZONE_MONTH)return'zone';if(S.m===S.hikeM&&!S.used.includes('hike'))return'hike';
  if(!S.deck.length)S.deck=shuffle(Object.keys(EV).filter(k=>k!=='zone'&&!S.used.includes(k)));
  const i=S.deck.findIndex(k=>!EV[k].cond||EV[k].cond());return i<0?null:S.deck.splice(i,1)[0]}
function showEvent(id){if(!id){refresh();return}const e=EV[id];S.used.push(id);const a=e.a?e.a():null,txt=e.x(a),k=`第 ${S.m} 個月 · 事件`;
  const fin=r=>{log(`【${e.t}】${r}`,id==='zone'||id==='hike');refresh();modal({k,t:e.t,cls:'event',h:`<p>${txt}</p><div class="fx">${r}</div>`,b:[{l:'繼續',c:'primary'}]})};
  const fxT=e.fx?e.fx(a):'';
  if(e.ch){refresh();modal({k,t:e.t,cls:'event',h:`<p>${txt}</p>${fxT?`<div class="fx">${fxT}</div>`:''}`,b:e.ch.map((c,i)=>({l:c.l,c:i?'':'primary',dis:c.dis&&c.dis(),f:()=>fin((fxT?fxT+' ':'')+c.f())}))})}
  else fin(fxT)}
// ── 年報 ──
function annual(){const r=ranking(),w=worth('me'),yc=worth('yc'),g=(w/S.start-1)*100,c1=w>=S.start*CFG.UNLOCK,c2=w>yc,bust=w<S.start,ok=c1&&c2;
  const pos=r.findIndex(x=>x.me)+1,local=r.filter(x=>!x.big),lp=local.findIndex(x=>x.me)+1;
  const verdict=bust?['敗家','身家跌穿開局水平。律師樓通知你：信託基金嘅下一期，要「再研究」。']:ok?['解鎖第二章：荃灣、荔枝角','你由元朗打咗出嚟。下一站：工廈活化。']:['守得住，但未達標','未夠資格去下一章。可以重玩第一章，但唔可以跳過。'];
  const bro=bust?'「細佬，我早就同老豆講過。」':ok?'「細佬做得唔錯。」大哥對住鏡頭笑，隻手握實咗枝筆。':'「元朗好好，空氣好。叫佢慢慢嚟。」';
  modal({k:`年報 · 元朗 · 遊戲內第一年`,t:verdict[0],cls:'report',
    h:`<p class="lead">${verdict[1]}</p>
    <div class="kpis"><div><i>年結身家</i><b>${fmt(w)}</b></div><div><i>全年變化</i><b class="${g>=0?'up':'dn'}">${g>=0?'+':'−'}${Math.abs(g).toFixed(0)}%</b></div><div><i>元朗排名</i><b>${lp} / ${local.length}</b></div></div>
    <h3>解鎖第二章嘅條件</h3>
    <div class="chk ${c1?'y':'n'}">${c1?'✔':'✕'} 身家達開局 ${CFG.UNLOCK} 倍（${fmt(S.start*CFG.UNLOCK)}）——你有 ${fmt(w)}</div>
    <div class="chk ${c2?'y':'n'}">${c2?'✔':'✕'} 身家高過${N.yc}（${fmt(yc)}）</div>
    <div class="chk ${bust?'n':'y'}">${bust?'✕':'✔'} 冇跌穿開局身家（${fmt(S.start)}）</div>
    <h3>各集團資產排名</h3><p class="dim">你喺全部集團入面排第 ${pos}。大集團連埋地圖以外嘅資產計。</p>${rankTable(r)}
    <h3>你嘅一年</h3><div class="box">${row('買入地塊',S.stats.bought+' 塊')}${row('落成項目',S.stats.done+' 個')}${row('賣樓收入',fmt(S.stats.sales))}${row('租金收入',fmt(S.stats.rent))}${row('利息支出',fmt(S.stats.interest))}${row('各種費用同「人情」',fmt(S.stats.fees))}${row('年結民意／鄉紳',Math.round(S.op)+' ／ '+Math.round(S.gen))}</div>
    <h3>大事回顧</h3>${S.high.length?S.high.slice(-10).map(e=>`<p class="lg"><b>${e.m} 月</b>　${esc(e.t)}</p>`).join(''):'<p class="dim">今年冇乜大事。對地產商嚟講，呢個本身就係大事。</p>'}
    <h3>${N.bro}主席評語</h3><p class="quote">${bro}</p>
    <p class="dim">試玩版數值：審批 ${CFG.APPROVE_MONTHS} 個月、村屋 ${USES.village.months} 個月、住宅 ${USES.res.months} 個月。正式版會跟設計文件。</p>`,
    b:[{l:'再玩一次',c:'primary',f:()=>newGame()},{l:'睇返地圖'}]})}
// ── 開場／選單 ──
function intro(){const P=[
  ['中環，四十八樓',`老豆喺${N.bro}頂樓宣佈退休。成個集團——寫字樓、商場、董事局同埋個泊車位——全部交俾大哥。`],
  ['你嗰份',`律師讀到你個名：元朗農地 ${lotsOf('me').length} 塊，另加現金 ${fmt(CFG.START_CASH)}。大哥拍拍你膊頭：「細佬，田園生活好健康㗎。」`],
  ['元朗',`你企喺自己塊地上面。隔籬係貨櫃場，對面係${N.yc}嘅地盤，遠處係${N.big2}嘅屋苑。有隻牛望住你，冇俾意見。`],
  ['十二個月',`買地、合併、改用途、起樓。年尾交年報：身家要有開局嘅 ${CFG.UNLOCK} 倍，仲要贏過${N.yc}，先有資格去下一章。跌穿開局身家，就係敗家。`]];
  let i=0;const go=()=>modal({k:`第一章 · 元朗　${i+1} / ${P.length}`,t:P[i][0],cls:'story',h:`<p>${P[i][1]}</p>`,b:[{l:i<P.length-1?'下一頁':'開始',c:'primary',f:()=>{if(++i<P.length)go();else refresh()}},...(i<P.length-1?[{l:'跳過'}]:[])]});go()}
function help(){modal({k:'玩法簡介',t:'點樣玩',cls:'tall',h:`<p><b>每回合一個月。</b>行動唔限次數，夠錢就得；撳「下個月」先結算。</p>
  <p><b>賺錢主線：</b>買地 → 合併相鄰地塊 → 遞交改變用途申請 → 等${CFG.TPB}審批 → 補地價、起樓 → 收租或者分拆出售。</p>
  <p><b>農地 → 村屋：</b>要鄉紳關係 45 以上，快，賺得少。<br><b>農地 → 住宅：</b>只限政府公佈嘅發展區，賺得多，要民意。<br><b>舊樓重建：</b>市區地塊合併最少 2 塊。</p>
  <p><b>民意</b>影響審批機會、租金同賣樓價。<b>鄉紳關係</b>影響收農地價錢、村屋審批，太差會封路。</p>
  <p><b>對手：</b>${N.yc}（藍）會搶農地同你隔籬嘅地；${N.kw}（橙）見升市就追入，加息就蝕讓。</p>
  <p class="dim">試玩版數值：審批 ${CFG.APPROVE_MONTHS} 個月、村屋工期 ${USES.village.months} 個月、住宅 ${USES.res.months} 個月（設計文件：審批 3–9 個月、工期 12–36 個月）。地價未按政府數據重新定價。</p>`,b:[{l:'明白',c:'primary'}]})}
function legend(){const it=(c,t,x)=>`<div class="lgd"><i style="background:${c}${x||''}"></i>${t}</div>`;
  modal({k:'地圖圖例',t:'顏色代表乜',h:`<div class="lgds">${it('#D33F35','你嘅地')}${it('#8E1F18','你落成嘅項目')}${it('repeating-linear-gradient(45deg,#D33F35 0 4px,#f1b3ae 4px 8px)','施工中')}${it('#2E5C9A',N.yc)}${it('#D98A1E',N.kw)}${it('#7DB5AE','小型業主')}${it('#5B3F8C','大地產商')}${it('#B9ADA3','已賣俾散戶')}${it('#DDE3B4','農地')}${it('#FBFAF6','市區可買地',';border:1px solid #bbb')}${it('#DDE3B4','發展區內農地',';outline:2px dashed #B78716;outline-offset:-2px')}${it('#A9D18E','公園')}${it('#C3C6CC','政府')}${it('#B8D3EC','學校醫院')}${it('#1F7A66','銀行')}</div><p class="dim">黑色虛線框＝申請中或者已批未動工。縮細睇分區，撳一下放大逐塊睇。</p>`,b:[{l:'收到',c:'primary'}]})}
function menu(){modal({k:'選單',t:'香港地產大富翁',h:`<p class="dim">第一章 · 元朗 · 試玩版（${CFG.MONTHS} 個月）。進度自動存喺呢部機。</p>`,cls:'menu',
  b:[{l:'玩法簡介',f:help},{l:'地圖圖例',f:legend},{l:'重新開始',f:()=>modal({k:'重新開始',t:'由頭嚟過？',h:'<p>而家嘅進度會冇咗。</p>',b:[{l:'重新開始',c:'primary',f:()=>newGame()},{l:'取消'}]})},{l:'✎ 編輯地圖',f:()=>$('edBtn')&&$('edBtn').click()},{l:'返回遊戲',c:'primary'}]})}
// 「全區」：對準可玩範圍（紅框），預留頂部資料列同底部分頁列
fit=function(){const r=svg.getBoundingClientRect(),P=(M.play||[]).flat();let x0=bx0,y0=by0,x1=bx1,y1=by1;
  if(P.length){x0=y0=1e9;x1=y1=-1e9;P.forEach(q=>{if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1]})}
  const wide=r.width>=900,top=wide?20:70,bot=wide?20:90,uw=r.width-24,uh=Math.max(120,r.height-top-bot-24),u=Math.max((x1-x0)/uw,(y1-y0)/uh);
  vb.w=r.width*u;vb.h=r.height*u;vb.x=(x0+x1)/2-vb.w/2;vb.y=(y0+y1)/2-(top+(r.height-top-bot)/2)*u;apply()};
// ── 啟動 ──
$('next').onclick=nextMonth;$('menuBtn').onclick=menu;$('demoTag').onclick=help;$('dX').onclick=closeCard;$('shX').onclick=closeSheet;
$('coSkip').onclick=()=>{S.tut=TUT.length;refresh()};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>TAB===b.dataset.tab&&b.closest('#dock')?closeSheet():openSheet(b.dataset.tab));
$('zin').onclick=()=>zoomAt(.6);$('zout').onclick=()=>zoomAt(1.6);$('fit').onclick=fit;
addEventListener('resize',apply);
indexMap();
S=load();
if(S){paintAll();refresh();fit()}else newGame();
