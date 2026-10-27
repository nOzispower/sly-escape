// Leaderboard (mock backend): nickname filter, queue/offline retry, best-only upsert, end-of-map board, leaderboards screen.
// Run: NODE_PATH=/workspace/vt/node_modules node tests/leaderboard.test.js [shotsDir]
const pp=require('puppeteer-core'),path=require('path');const SHOTS=process.argv[2];
(async()=>{const b=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:360,height:740,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto('file://'+path.resolve(__dirname,'../index.html')+'?lbmock=1');await p.evaluate(()=>{localStorage.clear()});await p.reload();
const fail=[];const ok=(c,m)=>{if(!c)fail.push(m)};const shot=async n=>{if(SHOTS)await p.screenshot({path:SHOTS+'/'+n+'.png'})};const wait=ms=>new Promise(r=>setTimeout(r,ms));
// 1. nickname filter
const nk=await p.evaluate(()=>{const c=SlyScores.nickCheck;return[c('Sly Fox 7').ok,c('ab').ok,c('f4ck3r').ok,c('FUCK').ok,c('<script>').ok,c('x'.repeat(15)).ok,c('Cassie').ok,c('Hello Kitty').ok,c('S h i t').ok]});
ok(JSON.stringify(nk)===JSON.stringify([true,false,false,false,false,false,true,true,false]),'nick filter '+JSON.stringify(nk));
// 2. last levels only + map ids
const mk=await p.evaluate(()=>[SlyScores.mapKey(8),SlyScores.mapKey(9),SlyScores.mapKey(19),SlyScores.mapKey(129),SlyScores.maps().length]);
ok(mk[0]===null&&mk[1]==='farm1'&&mk[2]==='farm2'&&mk[3]==='ocean'&&mk[4]===20,'map keys '+JSON.stringify(mk));
// seed other players
await p.evaluate(()=>{SlyScores.mock.seed('farm1',[['ZippyOtter42',4210,'default'],['CosmicCat',3880],['LuckyLlama11',3300],['Brave Puffin',2950],['SunnyGecko',2600],['HappyFox',2210],['Jolly Moose',1980],['SwiftKoala',1500],['FuzzyPanda',1210],['Badger99',900],['Tiny',300]])});
// 3. win the map's last level with no nickname -> join prompt, score queued
await p.evaluate(()=>{const G=HG;G.startLevel(9);G.score=3500;G.endLevel(true)});await wait(900);
ok(await p.evaluate(()=>!!document.querySelector('#lbEnd')&&/nickname/.test(document.querySelector('#lbEndList').textContent)),'join prompt on end screen');
ok(await p.evaluate(()=>SlyScores.pending('farm1')),'queued until nickname');
await shot('1_end_join');
await p.evaluate(()=>[...document.querySelectorAll('#lbEndList button')][0].click());await wait(200);
await p.evaluate(()=>{document.getElementById('lbNickIn').value='SlyGuy7'});await shot('2_nick');
await p.evaluate(()=>{document.getElementById('lbNickIn').value='poop head'});await p.evaluate(()=>document.getElementById('lbNickOk').click());
ok(await p.evaluate(()=>/friendlier/.test(document.getElementById('lbNickEr').textContent)),'nick dialog rejects rude name');
await p.evaluate(()=>{document.getElementById('lbNickIn').value='SlyGuy7';document.getElementById('lbNickOk').click()});await wait(600);
const end=await p.evaluate(()=>({rows:document.querySelectorAll('#lbEnd .lbRow').length,me:document.querySelector('#lbEnd .lbRow.me')?.textContent,line:document.getElementById('lbEndMe').textContent,q:SlyScores.pending('farm1')}));
ok(end.rows===10&&/SlyGuy7/.test(end.me||'')&&/#3 of 12/.test(end.line)&&!end.q,'end board '+JSON.stringify(end));
await shot('3_end_board');
// 4. lower score does not replace best; higher does
await p.evaluate(async()=>{SlyScores.submit('farm1',1000);await SlyScores.flush()});let r=await p.evaluate(()=>SlyScores.getMyRank('farm1'));ok(r.score===3500,'keeps best');
// 5. offline: queue, then retry when back online
await p.evaluate(()=>{SlyScores.mock.offline=true;SlyScores.submit('farm1',5000)});await wait(100);ok(await p.evaluate(()=>SlyScores.pending('farm1')),'queued offline');
r=await p.evaluate(async()=>{SlyScores.mock.offline=false;await SlyScores.flush();return SlyScores.getMyRank('farm1')});ok(r.score===5000&&r.rank===1&&!(await p.evaluate(()=>SlyScores.pending('farm1'))),'uploaded after reconnect '+JSON.stringify(r));
// 6. persisted queue survives reload
await p.evaluate(()=>{SlyScores.mock.offline=true;SlyScores.submit('ocean',777)});await wait(1500);await p.reload();await wait(500);
ok(await p.evaluate(()=>SlyScores.pending('ocean')&&SlyScores.nick==='SlyGuy7'),'queue+nick persist');
// 7. leaderboards screen
await p.evaluate(async()=>{await SlyScores.flush();document.getElementById('bLB').click()});await wait(700);
const lb=await p.evaluate(()=>({on:document.getElementById('sLB').classList.contains('on'),tabs:document.querySelectorAll('#lbMaps button').length,rows:document.querySelectorAll('#lbList .lbRow').length,me:document.getElementById('lbMeLine').textContent}));
ok(lb.on&&lb.tabs===20&&lb.rows===12&&/#1 of 12/.test(lb.me),'leaderboards screen '+JSON.stringify(lb));
await shot('4_leaderboards');
await p.evaluate(()=>[...document.querySelectorAll('#lbMaps button')].find(b=>b.dataset.id==='ocean').click());await wait(400);
ok(await p.evaluate(()=>document.querySelectorAll('#lbList .lbRow').length===1),'ocean tab shows the uploaded ocean score');
// 8. settings nickname button
ok(await p.evaluate(()=>/SlyGuy7/.test(document.getElementById('setNick').textContent)),'settings shows nickname');
// 9. a non-final level win does not submit
await p.evaluate(()=>{const G=HG;G.startLevel(3);G.score=99999;G.endLevel(true)});await wait(700);ok(await p.evaluate(()=>!document.getElementById('lbEnd')&&!SlyScores.pending('farm1')),'no board on normal levels');
ok(!errs.length,'js errors '+errs.join('|'));
console.log(fail.length?'LB FAIL\n'+fail.join('\n'):'LB PASS');await b.close();if(fail.length)process.exitCode=1})();
// Supabase adapter wire format (requests intercepted, no network)
(async()=>{await new Promise(r=>setTimeout(r,300));const b=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();const seen=[];
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith('https://demo.supabase.co/')){if(r.method()!=='OPTIONS')seen.push({u,h:r.headers(),b:r.postData()});const fn=u.split('/').pop();
  r.respond({status:fn==='submit_score'?200:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','access-control-allow-methods':'POST,GET,OPTIONS'},body:fn==='submit_score'?'3500':fn==='get_top'?'[{"rank":1,"nickname":"A","score":3500,"head_id":"default","is_me":true}]':'[{"rank":1,"score":3500,"total":1}]'})}else r.continue()});
await p.goto('file://'+path.resolve(__dirname,'../index.html'));
const r=await p.evaluate(async()=>{localStorage.clear();SlyScores.config.url='https://demo.supabase.co';SlyScores.config.anonKey='anon-key';SlyScores.setNick('Tester');SlyScores.submit('ocean',3500);await new Promise(r=>setTimeout(r,300));
  return {top:await SlyScores.getTop('ocean'),me:await SlyScores.getMyRank('ocean'),q:SlyScores.pending('ocean'),be:SlyScores.backend.name}});
const sub=seen.find(s=>s.u.endsWith('/rest/v1/rpc/submit_score'));const body=sub&&JSON.parse(sub.b);
const good=r.be==='supabase'&&!r.q&&r.top[0].is_me&&r.me.rank===1&&sub&&sub.h.apikey==='anon-key'&&!sub.h.authorization&&body.p_map==='ocean'&&body.p_score===3500&&body.p_nick==='Tester'&&/^[0-9a-f-]{36}$/.test(body.p_player)&&seen.some(s=>s.u.endsWith('/rpc/get_top'))&&seen.some(s=>s.u.endsWith('/rpc/my_rank'));
console.log(good?'LB SUPABASE-ADAPTER PASS':'LB SUPABASE-ADAPTER FAIL '+JSON.stringify({r,body,n:seen.length}));await b.close();if(!good)process.exitCode=1})();
