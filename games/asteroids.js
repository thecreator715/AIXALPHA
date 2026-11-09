// ===== ASTEROIDS (Atari vector style) =====
const TAU=Math.PI*2,rnd=(a,b)=>a+Math.random()*(b-a),wrap=o=>{if(o.x<-40)o.x+=W+80;if(o.x>W+40)o.x-=W+80;if(o.y<-40)o.y+=H+80;if(o.y>H+40)o.y-=H+80};
let waiting=false,state='title',score=0,lives=3,level=1,nextLife=10000,ship,rocks=[],shots=[],ufoShots=[],ufo=null,parts=[],lines=[],beat=0,beatT=0,msg='',msgT=0,ufoT=0,scan=true,shake=0,respawnT=0,flicker=0;
const SIZE={3:46,2:24,1:12},PTS={3:20,2:50,1:100};
function rockShape(r){const n=11+Math.floor(Math.random()*4),p=[];for(let i=0;i<n;i++){const a=i/n*TAU,d=r*rnd(.72,1.18);p.push([Math.cos(a)*d,Math.sin(a)*d])}return p}
function mkRock(x,y,sz){const sp=rnd(.5,1.2)*(4-sz)*.75+ .35+level*.04,a=rnd(0,TAU);return{x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,sz,r:SIZE[sz],rot:rnd(0,TAU),vr:rnd(-.025,.025),shape:rockShape(SIZE[sz])}}
function newShip(){ship={x:W/2,y:H/2,vx:0,vy:0,a:-Math.PI/2,inv:150,thrust:false,dead:false}}
function startLevel(){rocks=[];const n=Math.min(4+level*2-2,13);for(let i=0;i<n;i++){let x,y;do{x=rnd(0,W);y=rnd(0,H)}while(Math.hypot(x-W/2,y-H/2)<200);rocks.push(mkRock(x,y,3))}ufoT=rnd(600,1100);msg='WAVE '+level;msgT=100}
function newGame(){score=0;lives=3;level=1;nextLife=10000;shots=[];ufoShots=[];ufo=null;parts=[];lines=[];newShip();startLevel();state='play';beat=0}
function boom(x,y,n,sp){for(let i=0;i<n;i++){const a=rnd(0,TAU),s=rnd(.3,1)*sp;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(25,55)})}}
function addScore(p){const was=score;score+=p;if(score>=nextLife){lives++;nextLife+=10000;tone(880,.3,'square',.08,440);msg='EXTRA SHIP';msgT=80}saveHi(score)}
function killShip(){if(ship.dead)return;ship.dead=true;noise(.9,.3,1200);boom(ship.x,ship.y,30,5);shake=14;for(let i=0;i<5;i++){const a=rnd(0,TAU);lines.push({x:ship.x,y:ship.y,vx:Math.cos(a)*rnd(.5,2),vy:Math.sin(a)*rnd(.5,2),a:rnd(0,TAU),vr:rnd(-.2,.2),len:rnd(8,16),life:90})}lives--;respawnT=120;if(lives<0){state='over';saveHi(score)}}
function breakRock(i,byPlayer){const r=rocks[i];rocks.splice(i,1);noise(r.sz===3?.5:r.sz===2?.35:.22,.22,r.sz===3?500:r.sz===2?900:1500);boom(r.x,r.y,r.sz*6,2.4);if(byPlayer)addScore(PTS[r.sz]);if(r.sz>1){rocks.push(mkRock(r.x,r.y,r.sz-1),mkRock(r.x,r.y,r.sz-1))}}
function fire(){if(shots.length>=4||ship.dead)return;const c=Math.cos(ship.a),s=Math.sin(ship.a);shots.push({x:ship.x+c*16,y:ship.y+s*16,vx:ship.vx+c*9,vy:ship.vy+s*9,life:55});tone(980,.12,'square',.06,-700)}
function spawnUfo(){const small=score>3500&&Math.random()<.55||score>9000;ufo={x:Math.random()<.5?-30:W+30,y:rnd(80,H-80),small,vx:0,t:0,dir:0};ufo.vx=(ufo.x<0?1:-1)*(small?2.2:1.5);ufo.dy=0}
function update(){
 if(hit('KeyP')&&(state==='play'||state==='pause'))state=state==='play'?'pause':'play';
 if(hit('KeyC'))scan=!scan;
 if(state==='title'||state==='over'){if(hit('Enter')||hit('Space')){au();newGame()}if(state==='title'){ if(!rocks.length)startLevel();rocks.forEach(o=>{o.x+=o.vx;o.y+=o.vy;o.rot+=o.vr;wrap(o)})}return}
 if(state==='pause')return;
 if(shake>0)shake*=.88;if(msgT>0)msgT--;
 if(!ship.dead){
  if(K.ArrowLeft||K.KeyA)ship.a-=.075;if(K.ArrowRight||K.KeyD)ship.a+=.075;
  ship.thrust=!!(K.ArrowUp||K.KeyW);
  if(ship.thrust){ship.vx+=Math.cos(ship.a)*.13;ship.vy+=Math.sin(ship.a)*.13;if((flicker++%4)===0)noise(.08,.05,400)}
  ship.vx*=.992;ship.vy*=.992;const sp=Math.hypot(ship.vx,ship.vy);if(sp>8){ship.vx*=8/sp;ship.vy*=8/sp}
  ship.x+=ship.vx;ship.y+=ship.vy;wrap(ship);if(ship.inv>0)ship.inv--;
  if(hit('Space')||hit('KeyZ'))fire();
  if(hit('ShiftLeft')||hit('KeyH')||hit('ArrowDown')){ship.x=rnd(60,W-60);ship.y=rnd(60,H-60);ship.vx=ship.vy=0;ship.inv=30;tone(200,.25,'sawtooth',.06,600);if(Math.random()<.14)killShip()}
 }else{respawnT--;if(respawnT<=0&&lives>=0){if(rocks.every(o=>Math.hypot(o.x-W/2,o.y-H/2)>130)){newShip()}else respawnT=10}}
 rocks.forEach(o=>{o.x+=o.vx;o.y+=o.vy;o.rot+=o.vr;wrap(o)});
 shots.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--;wrap(s)});shots=shots.filter(s=>s.life>0);
 ufoShots.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--;wrap(s)});ufoShots=ufoShots.filter(s=>s.life>0);
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.985;p.vy*=.985;p.life--});parts=parts.filter(p=>p.life>0);
 lines.forEach(l=>{l.x+=l.vx;l.y+=l.vy;l.a+=l.vr;l.life--});lines=lines.filter(l=>l.life>0);
 // collisions: shots vs rocks
 for(let si=shots.length-1;si>=0;si--){const s=shots[si];let used=false;for(let i=rocks.length-1;i>=0;i--){const r=rocks[i];if(Math.hypot(s.x-r.x,s.y-r.y)<r.r){shots.splice(si,1);breakRock(i,true);used=true;break}}
  if(!used&&ufo&&Math.hypot(s.x-ufo.x,s.y-ufo.y)<(ufo.small?12:20)){shots.splice(si,1);addScore(ufo.small?1000:200);noise(.6,.25,1400);boom(ufo.x,ufo.y,20,4);ufo=null}}
 // ship vs rocks / ufo / ufo shots
 if(!ship.dead&&ship.inv<=0){for(const r of rocks)if(Math.hypot(ship.x-r.x,ship.y-r.y)<r.r+9){killShip();break}
  if(!ship.dead&&ufo&&Math.hypot(ship.x-ufo.x,ship.y-ufo.y)<24){killShip();boom(ufo.x,ufo.y,20,4);ufo=null}
  if(!ship.dead)for(const s of ufoShots)if(Math.hypot(ship.x-s.x,ship.y-s.y)<10){killShip();break}}
 if(ufo){for(let i=rocks.length-1;i>=0;i--)if(Math.hypot(ufo.x-rocks[i].x,ufo.y-rocks[i].y)<rocks[i].r+14){breakRock(i,false);boom(ufo.x,ufo.y,16,4);ufo=null;break}}
 // ufo logic
 if(ufo){ufo.x+=ufo.vx;ufo.t++;if(ufo.t%70===0)ufo.dy=[-1.2,0,1.2][Math.floor(Math.random()*3)];ufo.y+=ufo.dy;if(ufo.t%(ufo.small?55:90)===0&&!ship.dead){let a=rnd(0,TAU);if(ufo.small){a=Math.atan2(ship.y-ufo.y,ship.x-ufo.x)+rnd(-.18,.18)*(score>12000?.4:1)}ufoShots.push({x:ufo.x,y:ufo.y,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2,life:90});tone(420,.12,'square',.05,-200)}
  if(ufo.t%14===0)tone(ufo.small?1100:700,.1,'sine',.04,ufo.small?200:-150);if(ufo.x<-60||ufo.x>W+60)ufo=null}
 else if(--ufoT<=0&&rocks.length>0){spawnUfo();ufoT=rnd(700,1300)}
 // heartbeat
 beatT--;if(beatT<=0&&!ship.dead){beat^=1;tone(beat?55:48,.1,'sine',.18);beatT=Math.max(18,70-Math.floor((1-rocks.length/Math.max(1,(4+level*2)*3))*40))}
 if(rocks.length===0&&!ufo&&!waiting){waiting=true;level++;ship.inv=120;shots=[];ufoShots=[];setTimeout(()=>{waiting=false;if(state==='play')startLevel()},900)}
}
function glow(c,w){X.strokeStyle=c;X.lineWidth=w||2;X.shadowColor=c;X.shadowBlur=8;X.lineJoin='round'}
function poly(pts,x,y,rot,close){X.beginPath();const cs=Math.cos(rot),sn=Math.sin(rot);pts.forEach((p,i)=>{const px=x+p[0]*cs-p[1]*sn,py=y+p[0]*sn+p[1]*cs;i?X.lineTo(px,py):X.moveTo(px,py)});if(close)X.closePath();X.stroke()}
function text(t,x,y,sz,al,c){X.font='700 '+sz+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.shadowColor='#fff';X.shadowBlur=7;X.fillText(t,x,y)}
function drawShip(s,x,y,a,th){glow('#fff',2);poly([[18,0],[-12,-10],[-7,0],[-12,10]],x,y,a,true);if(th&&Math.random()<.8){poly([[-8,-4],[-20-Math.random()*8,0],[-8,4]],x,y,a,false)}}
function draw(){
 X.save();X.fillStyle='#000';X.fillRect(0,0,W,H);
 if(shake>.5)X.translate(rnd(-shake,shake),rnd(-shake,shake));
 X.shadowBlur=0;
 // rocks
 rocks.forEach(r=>{glow('#fff',2);poly(r.shape,r.x,r.y,r.rot,true)});
 // ship
 if(state!=='over'&&ship&&!ship.dead&&state!=='title'){if(!(ship.inv>0&&Math.floor(ship.inv/6)%2))drawShip(ship,ship.x,ship.y,ship.a,ship.thrust)}
 // ufo
 if(ufo){glow('#fff',2);const k=ufo.small?.6:1;poly([[-22,4],[-12,-4],[12,-4],[22,4],[12,12],[-12,12]].map(p=>[p[0]*k,p[1]*k]),ufo.x,ufo.y,0,true);poly([[-12,-4],[-7,-12],[7,-12],[12,-4]].map(p=>[p[0]*k,p[1]*k]),ufo.x,ufo.y,0,false);poly([[-22,4],[22,4]].map(p=>[p[0]*k,p[1]*k]),ufo.x,ufo.y,0,false)}
 // shots
 X.fillStyle='#fff';X.shadowColor='#fff';X.shadowBlur=10;shots.forEach(s=>{X.fillRect(s.x-2,s.y-2,4,4)});ufoShots.forEach(s=>{X.fillRect(s.x-2,s.y-2,5,5)});
 parts.forEach(p=>{X.globalAlpha=Math.min(1,p.life/30);X.fillRect(p.x-1,p.y-1,2.5,2.5)});X.globalAlpha=1;
 lines.forEach(l=>{glow('#fff',2);X.globalAlpha=Math.min(1,l.life/40);X.beginPath();X.moveTo(l.x-Math.cos(l.a)*l.len/2,l.y-Math.sin(l.a)*l.len/2);X.lineTo(l.x+Math.cos(l.a)*l.len/2,l.y+Math.sin(l.a)*l.len/2);X.stroke();X.globalAlpha=1});
 X.restore();X.save();
 // HUD
 text(String(score).padStart(2,'0'),90,60,44,'right');text(String(HI).padStart(2,'0'),W/2,44,22,'center');
 for(let i=0;i<Math.max(0,lives);i++){glow('#fff',1.6);poly([[10,0],[-7,-6],[-4,0],[-7,6]],70+i*22,86,-Math.PI/2,true)}
 if(msgT>0&&state==='play')text(msg,W/2,H/2-120,36,'center');
 if(state==='title'){text('ASTEROIDS',W/2,H/2-60,84,'center');text('PRESS ENTER OR TAP TO START',W/2,H/2+30,26,'center');text('ARROWS / WASD: TURN + THRUST   SPACE: FIRE   SHIFT: HYPERSPACE',W/2,H/2+90,17,'center','#bbb');text('P PAUSE   M MUTE   C CRT',W/2,H/2+118,17,'center','#bbb')}
 if(state==='over'){text('GAME OVER',W/2,H/2-30,72,'center');text('PRESS ENTER TO PLAY AGAIN',W/2,H/2+40,26,'center')}
 if(state==='pause')text('PAUSED',W/2,H/2,64,'center');
 X.restore();
 if(scan){X.save();X.globalAlpha=.16;X.fillStyle='#000';for(let y=0;y<H;y+=3)X.fillRect(0,y,W,1);const g=X.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.85);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.55)');X.globalAlpha=1;X.fillStyle=g;X.fillRect(0,0,W,H);X.restore()}
}
touchUI([[['◀','ArrowLeft'],['▶','ArrowRight']],[['⚡','ShiftLeft'],['▲','ArrowUp'],['●','Space']]]);
startLevel();run(update,draw);
