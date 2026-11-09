// ===== SPACE INVADERS =====
let state='title',score=0,lives=3,level=1,ship,shots=[],bombs=[],inv=[],dir=1,mt=0,stepT=0,frame=0,parts=[],shields=[],ufo=null,ufoT=900,shootT=0;
function mkWave(){inv=[];const rows=5,cols=11;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)inv.push({x:150+c*58,y:130+r*48,t:r===0?2:r<3?1:0,alive:true});dir=1;mt=Math.max(6,32-level*3);stepT=0;bombs=[];shields=[];for(let s=0;s<4;s++){const bx=130+s*220,by=H-170;for(let i=0;i<8;i++)for(let j=0;j<5;j++){if((j===4&&(i>2&&i<5))||(i===0&&j===0)||(i===7&&j===0))continue;shields.push({x:bx+i*10,y:by+j*10,hp:3})}}}
function reset(){score=0;lives=3;level=1;ship={x:W/2};shots=[];parts=[];ufo=null;mkWave()}
const SPR=[['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'],['00100000100','10010001001','10111111101','11101110111','11111111111','01111111110','00100000100','01000000010'],['00001110000','01111111110','11111111111','11100100111','11111111111','00011011000','00110110110','11000000011']];
function drawSpr(sp,x,y,s,c){X.fillStyle=c;sp.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='1')X.fillRect(x-row.length*s/2+i*s,y-sp.length*s/2+j*s,s,s)})}
function boom(x,y,c){for(let i=0;i<14;i++){const a=Math.random()*6.28,s=1+Math.random()*3;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:26,c})}}
function update(){
 if(state!=='play'){if(hit('Enter')||hit('Space')){au();reset();state='play'}return}
 if(hit('KeyP')){state='pause';return}
 if(K.ArrowLeft||K.KeyA)ship.x-=6;if(K.ArrowRight||K.KeyD)ship.x+=6;ship.x=Math.max(30,Math.min(W-30,ship.x));
 if((hit('Space')||hit('KeyZ'))&&shots.length<2){shots.push({x:ship.x,y:H-70});tone(880,.1,'square',.06,-500)}
 shots.forEach(s=>s.y-=11);shots=shots.filter(s=>s.y>0);
 bombs.forEach(b=>b.y+=4+level*.25);bombs=bombs.filter(b=>b.y<H);
 const alive=inv.filter(i=>i.alive);if(!alive.length){level++;mkWave();return}
 if(++stepT>=Math.max(2,Math.round(mt*(alive.length/55)+2))){stepT=0;frame^=1;let edge=false;alive.forEach(i=>{if((dir>0&&i.x>W-50)||(dir<0&&i.x<50))edge=true});if(edge){dir*=-1;alive.forEach(i=>i.y+=22)}else alive.forEach(i=>i.x+=14*dir);tone(frame?110:90,.06,'square',.08)}
 if(--shootT<=0&&alive.length){shootT=Math.max(18,70-level*5);const cols={};alive.forEach(i=>{const k=Math.round(i.x);if(!cols[k]||cols[k].y<i.y)cols[k]=i});const ks=Object.keys(cols),c=cols[ks[Math.floor(Math.random()*ks.length)]];bombs.push({x:c.x,y:c.y+14})}
 if(--ufoT<=0&&!ufo){ufo={x:-30,v:3};ufoT=900+Math.random()*600}if(ufo){ufo.x+=ufo.v;if(ufo.x>W+40)ufo=null;else if(ufoT%12===0)tone(500+Math.random()*80,.08,'sine',.05)}
 for(let si=shots.length-1;si>=0;si--){const s=shots[si];let used=false;
  for(const i of inv){if(i.alive&&Math.abs(s.x-i.x)<22&&Math.abs(s.y-i.y)<16){i.alive=false;score+=[10,20,30][i.t];boom(i.x,i.y,['#4ade80','#38bdf8','#f472b6'][i.t]);noise(.15,.15,1500);used=true;break}}
  if(!used&&ufo&&Math.abs(s.x-ufo.x)<26&&Math.abs(s.y-30-100)<18){score+=100+Math.floor(Math.random()*3)*50;boom(ufo.x,130,'#f87171');ufo=null;used=true}
  if(!used)for(const sh of shields){if(sh.hp>0&&Math.abs(s.x-sh.x-5)<7&&Math.abs(s.y-sh.y-5)<8){sh.hp--;used=true;break}}
  if(used)shots.splice(si,1)}
 for(let bi=bombs.length-1;bi>=0;bi--){const b=bombs[bi];let used=false;for(const sh of shields)if(sh.hp>0&&Math.abs(b.x-sh.x-5)<7&&Math.abs(b.y-sh.y-5)<8){sh.hp--;used=true;break}
  if(!used&&Math.abs(b.x-ship.x)<22&&b.y>H-86&&b.y<H-50){lives--;boom(ship.x,H-70,'#fff');noise(.6,.25,900);bombs=[];if(lives<=0){state='over';saveHi(score)}used=true}if(used)bombs.splice(bi,1)}
 if(alive.some(i=>i.y>H-110)){state='over';saveHi(score)}saveHi(score);
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l--});parts=parts.filter(p=>p.l>0)}
function T(t,x,y,s,al,c){X.font='700 '+s+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.fillText(t,x,y)}
function draw(){X.fillStyle='#000';X.fillRect(0,0,W,H);
 for(let i=0;i<60;i++){X.fillStyle='rgba(255,255,255,'+(.2+(i%5)*.1)+')';X.fillRect((i*173)%W,(i*97+Date.now()/60*(1+i%3))%H,1.5,1.5)}
 inv.forEach(i=>{if(i.alive){X.shadowColor=['#4ade80','#38bdf8','#f472b6'][i.t];X.shadowBlur=8;drawSpr(SPR[i.t],i.x,i.y,3,['#4ade80','#38bdf8','#f472b6'][i.t]);X.shadowBlur=0}});
 shields.forEach(s=>{if(s.hp>0){X.fillStyle=['#14532d','#16a34a','#4ade80'][s.hp-1];X.fillRect(s.x,s.y,10,10)}});
 if(ship&&state!=='title'){X.fillStyle='#e5e7eb';X.shadowColor='#7dd3fc';X.shadowBlur=10;X.fillRect(ship.x-24,H-62,48,12);X.fillRect(ship.x-10,H-74,20,12);X.fillRect(ship.x-2,H-84,4,10);X.shadowBlur=0}
 X.fillStyle='#fff';shots.forEach(s=>X.fillRect(s.x-1.5,s.y,3,14));X.fillStyle='#fbbf24';bombs.forEach(b=>{X.fillRect(b.x-2,b.y,4,12)});
 if(ufo){X.fillStyle='#f87171';X.shadowColor='#f87171';X.shadowBlur=10;X.fillRect(ufo.x-22,115,44,12);X.fillRect(ufo.x-12,107,24,10);X.shadowBlur=0}
 parts.forEach(p=>{X.globalAlpha=p.l/26;X.fillStyle=p.c;X.fillRect(p.x,p.y,3,3)});X.globalAlpha=1;
 X.fillStyle='#4ade80';X.fillRect(0,H-40,W,2);T('SCORE '+score,20,36,24);T('HI '+HI,W/2,36,24,'center','#fbbf24');T('WAVE '+level,W-20,36,24,'right');for(let i=0;i<Math.max(0,lives-1);i++){X.fillStyle='#e5e7eb';X.fillRect(20+i*38,H-28,28,8)}
 if(state==='title'){T('SPACE INVADERS',W/2,H/2-20,68,'center','#4ade80');T('ENTER / TAP TO START - ARROWS MOVE - SPACE FIRE',W/2,H/2+36,20,'center','#9ca3af')}
 if(state==='over')T('GAME OVER - ENTER',W/2,H/2,52,'center','#f87171');if(state==='pause')T('PAUSED',W/2,H/2,60,'center')}
addEventListener('keydown',e=>{if(e.code==='KeyP'&&state==='pause')state='play'});
touchUI([[['◀','ArrowLeft'],['▶','ArrowRight']],[['●','Space']]]);reset();state='title';run(update,draw);
