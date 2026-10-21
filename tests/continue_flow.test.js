const pp=require('puppeteer-core');
(async()=>{const br=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const pg=await br.newPage();await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await pg.goto('file:///workspace/hole-game/index.html'+(process.argv[2]||''));await pg.evaluate(()=>localStorage.clear());await pg.reload();
const R={},W=ms=>new Promise(r=>setTimeout(r,ms)),ok=(k,c)=>{R[k]=c;if(!c)R.FAIL=(R.FAIL||[]).concat(k)};
const timeout=()=>pg.evaluate(()=>{const G=HG;G.timeLeft=0.02;for(let k=0;k<5&&G.state==='play';k++)G.step(1/60);return{st:G.state,on:document.getElementById('ctPanel').classList.contains('on'),over:G.over}});
await pg.evaluate(()=>{HG.save.coins=1000;HG.persist();HG.startLevel(2);for(let k=0;k<60;k++)HG.step(1/60)});
let t=await timeout();ok('pausedOnTimeout',t.st==='pause'&&t.on&&!t.over);
R.panel=await pg.$eval('#ctPanel',e=>e.innerText.replace(/\n+/g,' | '));
await pg.evaluate(()=>{HG.step(1/60);HG.step(1/60)});ok('frozenWhilePaused',await pg.evaluate(()=>HG.timeLeft===0&&HG.state==='pause'));
await pg.screenshot({path:'/workspace/hole-game/screenshot-continue.png'});
await pg.click('#ctYes');let a=await pg.evaluate(()=>({c:HG.save.coins,t:HG.timeLeft,st:HG.state,cd:document.getElementById('ctCount').classList.contains('on')}));
ok('continue1',a.c===950&&a.t===15&&a.st==='pause'&&a.cd);await W(700);await pg.screenshot({path:'/tmp/ct_count.png'});
await W(2000);a=await pg.evaluate(()=>{const F=HG.objs.find(o=>o.id==='farmer');return{st:HG.state,cool:F?F.cool:null,cd:document.getElementById('ctCount').classList.contains('on')}});
ok('resumed',a.st==='play'&&!a.cd&&(a.cool===null||a.cool>2));R.grace=a.cool;
t=await timeout();await pg.click('#ctYes');ok('continue2',await pg.evaluate(()=>HG.save.coins===850));await W(2800);
t=await timeout();await pg.click('#ctYes');ok('continue3',await pg.evaluate(()=>HG.save.coins===650&&HG.buyTime.used()===3));await W(2800);
t=await timeout();ok('max3ThenFail',t.st==='end'&&!t.on&&t.over&&await pg.$eval('#eTitle',e=>e.textContent).then(x=>{R.endTitle=x;return true}));
// decline
await pg.evaluate(()=>{HG.startLevel(2);HG.step(1/60)});t=await timeout();await pg.click('#ctNo');a=await pg.evaluate(()=>({st:HG.state,c:HG.save.coins,win:HG.over}));ok('noThanks',a.st==='end'&&a.c===650);
// ring expiry
await pg.evaluate(()=>{HG.startLevel(2);HG.step(1/60)});t=await timeout();await W(10800);ok('ringExpires',await pg.evaluate(()=>HG.state==='end'&&!document.getElementById('ctPanel').classList.contains('on')));
// not enough coins
await pg.evaluate(()=>{HG.save.coins=20;HG.persist();HG.startLevel(2);HG.step(1/60)});t=await timeout();
a=await pg.evaluate(()=>({get:getComputedStyle(document.getElementById('ctGet')).display,txt:document.getElementById('ctCoins').textContent,shop:FEATURES.coinShop}));R.short=a;
await pg.click('#ctYes');ok('shortNoCharge',await pg.evaluate(()=>HG.save.coins===20&&HG.state==='pause'));
if(a.shop){ok('getVisible',a.get!=='none');await pg.click('#ctGet');await W(300);a=await pg.evaluate(()=>({store:document.querySelector('.scr.on')?.id,tab:document.querySelector('.stTabs .on')?.dataset.t,st:HG.state}));ok('storeOpen',a.store==='sStore'&&a.tab==='coins'&&a.st==='pause');
  await W(11000);ok('ringPausedInStore',await pg.evaluate(()=>HG.state==='pause'));await pg.evaluate(()=>{HG.save.coins=80});await pg.click('#stBack');await W(300);
  a=await pg.evaluate(()=>({on:document.getElementById('ctPanel').classList.contains('on'),scr:document.querySelector('.scr.on')?.id||null}));ok('backToPanel',a.on&&!a.scr);
  await pg.click('#ctYes');ok('buyAfterShop',await pg.evaluate(()=>HG.save.coins===30));await W(2800);}
else ok('getHidden',a.get==='none');
await pg.click('#ctNo').catch(()=>{});await pg.evaluate(()=>{if(HG.state!=='end'){HG.timeLeft=0.02;for(let k=0;k<5;k++)HG.step(1/60);document.getElementById('ctNo').click()}});
// stars cap: win after a continue -> max 2 stars, bought time doesn't count toward the time-star
R.stars=await pg.evaluate(async()=>{const G=HG,o={};G.save.coins=500;G.save.stars={};
  G.startLevel(2);G.step(1/60);G.eaten=G.total;G.timeLeft=G.L.time*0.9;G.endLevel(true);o.plain=[document.getElementById('eStars').textContent,G.save.coins];
  G.startLevel(3);G.step(1/60);G.timeLeft=0.005;G.step(1/60);document.getElementById('ctYes').click();await new Promise(r=>setTimeout(r,2700));G.eaten=G.total;G.timeLeft=14;G.step(1/60);
  o.cont=[document.getElementById('eStars').textContent,document.getElementById('eMsg').innerHTML,G.save.stars[3],G.save.coins];return o});
ok('starCap',R.stars.plain[0]==='★★★'&&R.stars.cont[2]===2&&R.stars.cont[3]===500);
// bonus level (map) offers it too
R.bonus=await pg.evaluate(()=>{const G=HG;const li=G.LEVELS.findIndex(l=>l.map);G.startLevel(li);G.step(1/60);G.timeLeft=0.005;G.step(1/60);const on=G.state==='pause';document.getElementById('ctNo').click();return on&&G.state==='end'});ok('bonusOk',R.bonus);
// pre-level boost on Get Ready
await W(600);await pg.evaluate(()=>{HG.save.coins=100;HG.persist();HG.loadout.open(4)});await W(400);await pg.screenshot({path:'/tmp/ld_dbg.png'});R.ldVis=await pg.evaluate(()=>{const r=document.getElementById('ldBoost').getBoundingClientRect();return[document.querySelector('.scr.on')?.id,r.top,r.height]});
R.boostTxt=await pg.$eval('#ldBoost',e=>e.innerText.replace(/\n+/g,' | '));await pg.click('#ldBoost');await W(250);
ok('boostToggle',await pg.$eval('#ldBoost',e=>e.classList.contains('on')));await pg.screenshot({path:'/workspace/hole-game/screenshot-boost.png'});
await pg.click('#ldPlay');await W(500);a=await pg.evaluate(()=>({c:HG.save.coins,t:HG.timeLeft,L:HG.L.time,b:HG.buyTime.bought()}));ok('boostApplied',a.c===70&&a.t>a.L+9&&a.b===10);
a=await pg.evaluate(()=>{HG.endLevel(false);HG.startLevel(HG.li);return{c:HG.save.coins,t:HG.timeLeft,L:HG.L.time}});ok('retryNoBoost',a.c===70&&a.t===a.L);
a=await pg.evaluate(()=>{HG.loadout.open(4);return document.getElementById('ldBoost').classList.contains('on')});ok('boostResets',!a);
a=await pg.evaluate(()=>{HG.save.coins=10;HG.loadout.open(5);document.getElementById('ldBoost').click();return{on:document.getElementById('ldBoost').classList.contains('on'),modal:document.getElementById('stModal').classList.contains('on')}});ok('boostShort',!a.on);
console.log(R.FAIL?'CT FAIL':'CT PASS');console.log(JSON.stringify(R));console.log('ERRS',JSON.stringify(errs));await br.close()})();
