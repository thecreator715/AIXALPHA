// ===== BREAKOUT (arcade) =====
const COLS=['#ff3b3b','#ff9f1c','#ffe14d','#4ade80','#38bdf8','#a78bfa'];let state='title',score=0,lives=3,level=1,bricks=[],ball,pad,parts=[],powers=[],shake=0;
function mkBricks(){bricks=[];const rows=5+Math.min(level,3);for(let r=0;r<rows;r++)for(let c=0;c<14;c++)bricks.push({x:34+c*68,y:90+r*28,w:62,h:22,col:COLS[r%6],hp:r<2&&level>1?2:1})}
function reset(full){pad={x:W/2,w:130-Math.min(level*4,30),h:14};ball={x:W/2,y:H-70,vx:0,vy:0,r:8,stuck:true,sp:6+level*.35};if(full){score=0;lives=3;level=1;mkBricks()}}
function boom(x,y,c){for(let i=0;i<14;i++){const a=Math.random()*6.28,s=1+Math.random()*3;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:30,c})}}
function update(){
 if(state==='title'||state==='over'||state==='win'){if(hit('Enter')||hit('Space')){au();state='play';reset(true)}return}
 if(hit('KeyP'))state=state==='play'?'pause':'play';if(state==='pause')return;
 if(K.ArrowLeft||K.KeyA)pad.x-=10;if(K.ArrowRight||K.KeyD)pad.x+=10;pad.x=Math.max(pad.w/2,Math.min(W-pad.w/2,pad.x));
 if(ball.stuck){ball.x=pad.x;ball.y=H-70;if(hit('Space')||hit('Enter')){const a=-Math.PI/2+(Math.random()-.5)*.6;ball.vx=Math.cos(a)*ball.sp;ball.vy=Math.sin(a)*ball.sp;ball.stuck=false;tone(520,.08)}}
 else{
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-1;tone(300,.04)}if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx*=-1;tone(300,.04)}if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-1;tone(300,.04)}
  if(ball.vy>0&&ball.y+ball.r>=H-40&&ball.y<H-20&&Math.abs(ball.x-pad.x)<pad.w/2+ball.r){const o=(ball.x-pad.x)/(pad.w/2),a=-Math.PI/2+o*1.05;const sp=Math.min(ball.sp+score/4000,12);ball.vx=Math.cos(a)*sp;ball.vy=Math.sin(a)*sp;ball.y=H-40-ball.r;tone(440,.06,'square',.08)}
  for(const b of bricks){if(b.dead)continue;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){const ox=Math.min(ball.x+ball.r-b.x,b.x+b.w-(ball.x-ball.r)),oy=Math.min(ball.y+ball.r-b.y,b.y+b.h-(ball.y-ball.r));if(ox<oy)ball.vx*=-1;else ball.vy*=-1;b.hp--;if(b.hp<=0){b.dead=true;score+=10*level;boom(b.x+b.w/2,b.y+b.h/2,b.col);shake=3;if(Math.random()<.12)powers.push({x:b.x+b.w/2,y:b.y,t:Math.random()<.5?'W':'S'})}tone(600+Math.random()*300,.07,'square',.07);saveHi(score);break}}
  if(ball.y>H+20){lives--;tone(120,.5,'sawtooth',.1,-60);if(lives<0){state='over';saveHi(score)}else reset(false)}
  if(bricks.every(b=>b.dead)){level++;mkBricks();reset(false);tone(880,.4,'square',.08,440)}
 }
 powers.forEach(p=>{p.y+=3;if(p.y>H-44&&p.y<H-20&&Math.abs(p.x-pad.x)<pad.w/2){p.dead=true;if(p.t==='W')pad.w=Math.min(220,pad.w+50);else ball.sp=Math.max(4,ball.sp-1);tone(900,.2,'sine',.08,300)}});powers=powers.filter(p=>!p.dead&&p.y<H+20);
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.l--});parts=parts.filter(p=>p.l>0);if(shake>0)shake*=.8;
}
function T(t,x,y,s,al,c){X.font='700 '+s+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.fillText(t,x,y)}
function draw(){const g=X.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b1020');g.addColorStop(1,'#000');X.fillStyle=g;X.fillRect(0,0,W,H);X.save();if(shake>.5)X.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 bricks.forEach(b=>{if(b.dead)return;X.fillStyle=b.col;X.shadowColor=b.col;X.shadowBlur=8;X.fillRect(b.x,b.y,b.w,b.h);X.shadowBlur=0;X.fillStyle='rgba(255,255,255,.22)';X.fillRect(b.x,b.y,b.w,5);if(b.hp>1){X.strokeStyle='#fff';X.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4)}});
 if(pad){X.fillStyle='#e5e7eb';X.shadowColor='#7dd3fc';X.shadowBlur=14;X.fillRect(pad.x-pad.w/2,H-40,pad.w,pad.h);X.shadowBlur=0}
 if(ball){X.fillStyle='#fff';X.shadowColor='#fff';X.shadowBlur=16;X.beginPath();X.arc(ball.x,ball.y,ball.r,0,6.283);X.fill();X.shadowBlur=0}
 powers.forEach(p=>{X.fillStyle=p.t==='W'?'#4ade80':'#38bdf8';X.fillRect(p.x-12,p.y-8,24,16);T(p.t,p.x,p.y+5,14,'center','#000')});
 parts.forEach(p=>{X.globalAlpha=p.l/30;X.fillStyle=p.c;X.fillRect(p.x,p.y,3,3)});X.globalAlpha=1;X.restore();
 T('SCORE '+score,24,40,24);T('HI '+HI,W/2,40,24,'center','#fbbf24');T('LEVEL '+level,W-24,40,24,'right');for(let i=0;i<Math.max(0,lives);i++){X.fillStyle='#e5e7eb';X.fillRect(24+i*34,H-18,26,7)}
 if(state==='title'){T('BREAKOUT',W/2,H/2-20,76,'center');T('ENTER / TAP TO START  -  ARROWS OR A/D MOVE  -  SPACE LAUNCH',W/2,H/2+40,20,'center','#9ca3af')}
 if(state==='over')T('GAME OVER - ENTER',W/2,H/2+40,48,'center');if(state==='pause')T('PAUSED',W/2,H/2,60,'center')}
touchUI([[['◀','ArrowLeft'],['▶','ArrowRight']],[['●','Space']]]);mkBricks();reset(false);run(update,draw);
