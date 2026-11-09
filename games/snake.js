// ===== SNAKE =====
const N=24,CS=30;let state='title',snake,dir,nd,food,score=0,tick=0,spd=9,parts=[],gold=null,gt=0;
W=N*CS+0;H=N*CS+60;fit();
function reset(){snake=[{x:12,y:12},{x:11,y:12},{x:10,y:12}];dir={x:1,y:0};nd=dir;score=0;spd=9;place();gold=null}
function free(){let p;do{p={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)}}while(snake.some(s=>s.x===p.x&&s.y===p.y));return p}
function place(){food=free()}
function boom(x,y,c){for(let i=0;i<12;i++){const a=Math.random()*6.28,s=1+Math.random()*2.5;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:28,c})}}
function update(){
 if(state!=='play'){if(hit('Enter')||hit('Space')){au();reset();state='play'}return}
 if(hit('KeyP')){state='pause';return}
 const d=(c,x,y)=>{if(hit(c)&&!(dir.x===-x&&dir.y===-y))nd={x,y}};d('ArrowUp',0,-1);d('KeyW',0,-1);d('ArrowDown',0,1);d('KeyS',0,1);d('ArrowLeft',-1,0);d('KeyA',-1,0);d('ArrowRight',1,0);d('KeyD',1,0);
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l--});parts=parts.filter(p=>p.l>0);
 if(gold&&--gt<=0)gold=null;
 if(++tick<60/spd)return;tick=0;dir=nd;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
 if(h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(s=>s.x===h.x&&s.y===h.y)){state='over';saveHi(score);tone(110,.6,'sawtooth',.1,-50);return}
 snake.unshift(h);
 if(h.x===food.x&&h.y===food.y){score+=10;spd=Math.min(18,spd+.35);boom(h.x*CS+CS/2,h.y*CS+CS/2,'#f87171');tone(660,.08,'square',.07,330);place();if(!gold&&Math.random()<.2){gold=free();gt=300}}
 else if(gold&&h.x===gold.x&&h.y===gold.y){score+=50;boom(h.x*CS+CS/2,h.y*CS+CS/2,'#fbbf24');tone(990,.2,'sine',.08,600);gold=null}
 else snake.pop();saveHi(score)}
function T(t,x,y,s,al,c){X.font='700 '+s+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.fillText(t,x,y)}
function draw(){X.fillStyle='#050a05';X.fillRect(0,0,W,H);X.save();X.translate(0,60);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){X.fillStyle=(x+y)%2?'#071307':'#091a09';X.fillRect(x*CS,y*CS,CS,CS)}
 if(snake){snake.forEach((s,i)=>{const t=1-i/snake.length*.55;X.fillStyle='rgb('+Math.round(40*t)+','+Math.round(220*t)+','+Math.round(90*t)+')';X.shadowColor='#22c55e';X.shadowBlur=i?0:12;X.fillRect(s.x*CS+2,s.y*CS+2,CS-4,CS-4)});X.shadowBlur=0;
  X.fillStyle='#000';const h=snake[0];X.fillRect(h.x*CS+8+dir.x*4,h.y*CS+8+dir.y*4,4,4);X.fillRect(h.x*CS+18+dir.x*4,h.y*CS+8+dir.y*4,4,4)}
 if(food){X.fillStyle='#f87171';X.shadowColor='#ef4444';X.shadowBlur=14;X.beginPath();X.arc(food.x*CS+CS/2,food.y*CS+CS/2,CS/2-4,0,6.283);X.fill();X.shadowBlur=0}
 if(gold){X.fillStyle='#fbbf24';X.shadowColor='#fbbf24';X.shadowBlur=16;X.beginPath();X.arc(gold.x*CS+CS/2,gold.y*CS+CS/2,CS/2-3+Math.sin(Date.now()/120)*2,0,6.283);X.fill();X.shadowBlur=0}
 parts.forEach(p=>{X.globalAlpha=p.l/28;X.fillStyle=p.c;X.fillRect(p.x,p.y,4,4)});X.globalAlpha=1;X.restore();
 T('SCORE '+score,16,38,26,'left','#4ade80');T('HI '+HI,W-16,38,26,'right','#fbbf24');
 if(state==='title'){X.fillStyle='rgba(0,0,0,.6)';X.fillRect(0,60,W,H);T('SNAKE',W/2,H/2-10,72,'center','#4ade80');T('ENTER / TAP TO START - ARROWS OR WASD',W/2,H/2+40,20,'center','#9ca3af')}
 if(state==='over'){X.fillStyle='rgba(0,0,0,.6)';X.fillRect(0,60,W,H);T('GAME OVER',W/2,H/2,64,'center','#f87171');T('ENTER TO RETRY',W/2,H/2+44,22,'center')}
 if(state==='pause'){T('PAUSED - P TO RESUME',W/2,H/2,40,'center')}}
addEventListener('keydown',e=>{if(e.code==='KeyP'&&state==='pause')state='play'});
touchUI([[['◀','ArrowLeft'],['▲','ArrowUp']],[['▼','ArrowDown'],['▶','ArrowRight']]]);reset();state='title';run(update,draw);
