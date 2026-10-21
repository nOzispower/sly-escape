// Audit tests: progression, economy, saves, release flags, native save restore, every level boots.
// Run: NODE_PATH=/workspace/vt/node_modules node tests/audit.test.js [path-to-index.html]
const pp=require('puppeteer-core'),fs=require('fs');
const SRC=process.argv[2]||'/workspace/hole-game/index.html',DIR=require('path').dirname(SRC);
const REL=DIR+'/_audit_rel.html';fs.writeFileSync(REL,fs.readFileSync(SRC,'utf8').replace(/release:false,/,'release:true,'));
(async()=>{const br=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const R={},FAIL=[];const ok=(k,c,info)=>{R[k]=c?'ok':('FAIL '+JSON.stringify(info??''));if(!c)FAIL.push(k)};
const page=async(url,clear=true,pre)=>{const p=await br.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>m.type()==='error'&&p.errs.push(m.text()));
  await p.setViewport({width:390,height:844,deviceScaleFactor:1});if(pre)await p.evaluateOnNewDocument(pre);await p.goto('file://'+url);if(clear){await p.evaluate(()=>localStorage.clear());await p.reload()}return p};
// 1 fresh save + locks
let p=await page(SRC);
let r=await p.evaluate(()=>{const G=HG,S=G.save,st=G.store;return{coins:S.coins,unl:S.unlocked,c0:G.canPlay(0),c1:G.canPlay(1),w4:st.owns('worlds',4),w5:st.owns('worlds',5),head:st.owns('heads','default'),wolf:st.owns('heads','wolf'),ch:st.owns('chasers','default'),ninja:st.owns('chasers','ninja'),
  maps:G.MAPS.filter(m=>st.owns('maps',m.id)).length,mapLv:G.LEVELS.findIndex(L=>L.map),levels:G.LEVELS.length}});
ok('freshLocks',r.coins===0&&r.unl===1&&r.c0&&!r.c1&&r.w4&&!r.w5&&r.head&&!r.wolf&&r.ch&&!r.ninja&&r.maps===0,r);R.levels=r.levels;
// 2 progression through all 100 farm levels (buying worlds when needed) + stars/coins
r=await p.evaluate(()=>{const G=HG,S=G.save,st=G.store,bad=[];let coins=S.coins;
  for(let i=0;i<100;i++){if(!G.canPlay(i)){S.coins+=5000;const b=st.buy('worlds',Math.floor(i/10)+1);if(b!=='ok'){bad.push('buy'+i+b);break}}
    if(!G.canPlay(i)){bad.push('cant'+i);break}G.startLevel(i);G.step(1/60);G.eaten=G.total;G.hole.r=G.hole.tr=999;G.endLevel(true);
    const s=S.stars[i];if(!(s>=1&&s<=3))bad.push('stars'+i+':'+s);if(S.unlocked!==Math.min(100,i+2))bad.push('unl'+i+':'+S.unlocked);if(S.coins<0)bad.push('neg'+i)}
  return{bad,unl:S.unlocked,worlds:Object.keys(S.ownedWorlds).length}});
ok('farmProgression',r.bad.length===0&&r.unl===100,r);
// 3 economy edge cases
r=await p.evaluate(()=>{const G=HG,S=G.save,st=G.store;S.coins=599;const a=st.buy('maps','candy');const c1=S.coins;S.coins=600;const b=st.buy('maps','candy'),c2=S.coins,d=st.buy('maps','candy'),c3=S.coins;
  S.coins=10;const e=st.buy('heads','dragon');const f=st.buy('heads','nope');
  // map level unlock: first level only, then progression
  const mi=G.LEVELS.findIndex(L=>L.map==='candy');const m0=G.canPlay(mi),m1=G.canPlay(mi+1);G.startLevel(mi);G.step(1/60);G.eaten=G.total;G.hole.r=G.hole.tr=999;G.endLevel(true);const m1b=G.canPlay(mi+1);
  const lock=G.canPlay(G.LEVELS.findIndex(L=>L.map==='dino'));
  // prices match PRICES table
  const pm=Object.keys(G.MAPS.reduce((o,m)=>(o[m.id]=1,o),{})).filter(id=>st.price('maps',id)==null);
  return{a,c1,b,c2,d,c3,e,f,coinsAfter:S.coins,m0,m1,m1b,lock,unpricedMaps:pm}});
ok('economy',r.a==='short'&&r.c1===599&&r.b==='ok'&&r.c2===0&&r.d==='owned'&&r.c3===0&&r.e==='short'&&r.coinsAfter>=10&&r.m0&&!r.m1&&r.m1b&&!r.lock&&r.unpricedMaps.length===0,r);
// magnet never goes negative
r=await p.evaluate(()=>{const G=HG,S=G.save;G.startLevel(0);S.coins=5;const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='🧲');b&&b.click();return{c:S.coins,has:!!b}});
ok('magnetNoNegative',r.c===5,r);
// IAP double tap: only one gate at a time (test mode)
r=await p.evaluate(async()=>{const G=HG,S=G.save;const c0=S.coins;const p1=IAP.purchase('com.slyescape.coins.small'),p2=IAP.purchase('com.slyescape.coins.small');const r2=await Promise.race([p2,new Promise(r=>setTimeout(()=>r('pending'),300))]);return{r2,c0}});
ok('iapNoDoubleFlow',r.r2&&r.r2.error==='busy',r);
const e1=p.errs.slice();await p.close();
// 4 corrupt save -> backup
p=await page(SRC);await p.evaluate(()=>{HG.save.coins=777;HG.persist();localStorage.setItem('slyescape.v1','{broken');});await p.reload();
r=await p.evaluate(()=>({c:HG.save.coins,rec:HG.save.recovered,cor:!!localStorage.getItem('slyescape.v1.corrupt')}));ok('corruptRestoresBackup',r.c===777&&r.rec===1&&r.cor,r);
// garbage values sanitised
await p.evaluate(()=>{localStorage.setItem('slyescape.v1',JSON.stringify({coins:-50,unlocked:'abc',stars:[1],pricing:1}))});await p.reload();
r=await p.evaluate(()=>({c:HG.save.coins,u:HG.save.unlocked,s:Array.isArray(HG.save.stars)}));ok('sanitise',r.c===0&&r.u===1&&!r.s,r);const e2=p.errs.slice();await p.close();
// 5 release build: ?dev=1 ignored, coin shop hidden, IAP refuses without provider
p=await page(REL+'?dev=1');
r=await p.evaluate(async()=>{const G=HG;return{ua:G.FEATURES.unlockAll,cs:G.FEATURES.coinShop,c1:G.canPlay(1),dino:G.store.owns('maps','dino')}});
ok('releaseFlags',!r.ua&&!r.cs&&!r.c1&&!r.dino,r);const e3=p.errs.slice();await p.close();
// 6 native save restore when WebView storage was wiped (simulated Preferences adapter holding an older save with progress)
p=await page(SRC);await p.evaluate(()=>localStorage.clear());
r=await p.evaluate(async()=>{const nat={'slyescape.v1':JSON.stringify({v:2,pricing:1,unlocked:12,coins:345,best:{},stars:{},ownedMaps:{candy:true},ownedHeads:{default:true},ownedChasers:{},ownedWorlds:{},savedAt:1000})};
  sessionStorage.setItem('nat',nat['slyescape.v1']);await SaveIO.attach({get:k=>Promise.resolve(nat[k]??null),set:(k,v)=>{nat[k]=v;return Promise.resolve()}});return localStorage.getItem('slyescape.v1')});
await new Promise(r=>setTimeout(r,800));
r=await p.evaluate(()=>({c:HG.save.coins,u:HG.save.unlocked,candy:HG.store.owns('maps','candy')}));ok('nativeRestoreAfterWipe',r.c===345&&r.u===12&&r.candy,r);const e4=p.errs.slice();await p.close();
// 7 every level boots and renders a few frames
p=await page(SRC);r=await p.evaluate(()=>{const G=HG,bad=[];for(let i=0;i<G.LEVELS.length;i++){try{G.startLevel(i);for(let k=0;k<3;k++)G.step(1/60);if(!(G.total>0))bad.push(i+':empty');if(!(G.timeLeft>0))bad.push(i+':time')}catch(e){bad.push(i+':'+e.message)}}return bad});
ok('allLevelsBoot',r.length===0,r);const e5=p.errs.slice();await p.close();
const errs=[...e1,...e2,...e3,...e4,...e5].filter(e=>!/save corrupt/.test(e));ok('noJsErrors',errs.length===0,errs.slice(0,5));
fs.unlinkSync(REL);console.log(JSON.stringify(R,null,1));console.log(FAIL.length?'AUDIT FAIL: '+FAIL.join(', '):'AUDIT PASS');await br.close();process.exit(FAIL.length?1:0)})();
