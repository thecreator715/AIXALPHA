// ===== TETRIS =====
const CW=32,BW=10,BH=20;W=CW*BW+300;H=CW*BH+40;fit();
const SH={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
const COL={I:'#22d3ee',O:'#facc15',T:'#a855f7',S:'#4ade80',Z:'#f87171',J:'#3b82f6',L:'#fb923c'};
let state='title',grid,cur,next,bag=[],score=0,lines=0,level=1,dropT=0,lockT=0,clr=[],clrT=0,parts=[],hold=null,canHold=true;
const nb=()=>{if(!bag.length)bag=Object.keys(SH).sort(()=>Math.random()-.5);return bag.pop()};
function mk(t){return{t,c:SH[t].map(p=>[p[0],p[1]]),x:3,y:0}}
function rot(c,t,d){if(t==='O')return c;const n=t==='I'?4:3;return c.map(([x,y])=>d>0?[n-1-y,x]:[y,n-1-x])}
function ok(c,x,y){return c.every(([cx,cy])=>{const gx=x+cx,gy=y+cy;return gx>=0&&gx<BW&&gy<BH&&(gy<0||!grid[gy][gx])})}
function reset(){grid=Array.from({length:BH},()=>Array(BW).fill(0));score=0;lines=0;level=1;bag=[];next=nb();hold=null;spawn()}
function spawn(){cur=mk(next);next=nb();canHold=true;if(!ok(cur.c,cur.x,cur.y)){state='over';saveHi(score);tone(110,.7,'sawtooth',.1,-60)}}
function lock(){cur.c.forEach(([x,y])=>{if(cur.y+y>=0)grid[cur.y+y][cur.x+x]=cur.t});const full=[];grid.forEach((r,i)=>{if(r.every(v=>v))full.push(i)});if(full.length){clr=full;clrT=14;score+=[0,100,300,500,800][full.length]*level;tone(520+full.length*120,.25,'square',.08,300);full.forEach(i=>{for(let x=0;x<BW;x++)for(let k=0;k<2;k++)parts.push({x:x*CW+CW/2,y:i*CW+CW/2,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,l:30,c:COL[grid[i][x]]})})}else{tone(180,.05);spawn()}}
function move(dx,dy){if(ok(cur.c,cur.x+dx,cur.y+dy)){cur.x+=dx;cur.y+=dy;return true}return false}
function update(){
 if(state!=='play'){if(hit('Enter')||hit('Space')){au();reset();state='play'}return}
 if(hit('KeyP')){state='pause';return}
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l--});parts=parts.filter(p=>p.l>0);
 if(clrT>0){if(--clrT===0){clr.sort((a,b)=>a-b).forEach(i=>{grid.splice(i,1);grid.unshift(Array(BW).fill(0))});lines+=clr.length;level=1+Math.floor(lines/10);clr=[];saveHi(score);spawn()}return}
 if(hit('ArrowLeft')||hit('KeyA'))move(-1,0);if(hit('ArrowRight')||hit('KeyD'))move(1,0);
 if(hit('ArrowUp')||hit('KeyW')||hit('KeyX')){const r=rot(cur.c,cur.t,1);for(const k of [0,-1,1,-2,2])if(ok(r,cur.x+k,cur.y)){cur.c=r;cur.x+=k;tone(400,.04);break}}
 if(hit('KeyZ')){const r=rot(cur.c,cur.t,-1);for(const k of [0,-1,1,-2,2])if(ok(r,cur.x+k,cur.y)){cur.c=r;cur.x+=k;break}}
 if(hit('KeyC')&&canHold){canHold=false;const h=hold;hold=cur.t;if(h){cur=mk(h)}else{cur=mk(next);next=nb()}}
 if(hit('Space')){while(move(0,1))score+=2;lock();return}
 const spd=Math.max(3,50-level*4);dropT++;if((K.ArrowDown||K.KeyS)&&dropT>2){dropT=spd;score+=1}
 if(dropT>=spd){dropT=0;if(!move(0,1)){lockT++;if(lockT>1){lockT=0;lock()}}else lockT=0}}
function cell(x,y,c,a){X.globalAlpha=a==null?1:a;X.fillStyle=c;X.fillRect(x+1,y+1,CW-2,CW-2);X.fillStyle='rgba(255,255,255,.28)';X.fillRect(x+1,y+1,CW-2,5);X.fillStyle='rgba(0,0,0,.25)';X.fillRect(x+1,y+CW-6,CW-2,5);X.globalAlpha=1}
function T(t,x,y,s,al,c){X.font='700 '+s+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.fillText(t,x,y)}
function mini(t,x,y){if(!t)return;SH[t].forEach(([cx,cy])=>{X.fillStyle=COL[t];X.fillRect(x+cx*20,y+cy*20,18,18)})}
function draw(){X.fillStyle='#07070d';X.fillRect(0,0,W,H);X.save();X.translate(10,20);X.fillStyle='#0d0d18';X.fillRect(0,0,CW*BW,CW*BH);X.strokeStyle='#161628';for(let i=0;i<=BW;i++){X.beginPath();X.moveTo(i*CW,0);X.lineTo(i*CW,CW*BH);X.stroke()}for(let j=0;j<=BH;j++){X.beginPath();X.moveTo(0,j*CW);X.lineTo(CW*BW,j*CW);X.stroke()}
 if(grid){grid.forEach((r,y)=>r.forEach((v,x)=>{if(v)cell(x*CW,y*CW,COL[v],clr.includes(y)&&clrT%4<2?.3:1)}));
  if(cur&&state!=='over'){let gy=cur.y;while(ok(cur.c,cur.x,gy+1))gy++;cur.c.forEach(([x,y])=>cell((cur.x+x)*CW,(gy+y)*CW,COL[cur.t],.2));cur.c.forEach(([x,y])=>cell((cur.x+x)*CW,(cur.y+y)*CW,COL[cur.t]))}}
 parts.forEach(p=>{X.globalAlpha=p.l/30;X.fillStyle=p.c;X.fillRect(p.x,p.y,4,4)});X.globalAlpha=1;X.restore();
 const px=CW*BW+40;T('SCORE',px,50,18,'left','#9ca3af');T(String(score),px,80,30);T('BEST',px,120,18,'left','#9ca3af');T(String(HI),px,150,26,'left','#fbbf24');T('LEVEL',px,190,18,'left','#9ca3af');T(String(level),px,220,30);T('LINES',px,260,18,'left','#9ca3af');T(String(lines),px,290,30);
 T('NEXT',px,340,18,'left','#9ca3af');mini(next,px,355);T('HOLD (C)',px,450,18,'left','#9ca3af');mini(hold,px,465);
 if(state!=='play'){X.fillStyle='rgba(0,0,0,.65)';X.fillRect(10,20,CW*BW,CW*BH)}
 if(state==='title'){T('TETRIS',10+CW*BW/2,260,56,'center','#22d3ee');T('ENTER / TAP TO START',10+CW*BW/2,310,20,'center');T('ARROWS MOVE/ROTATE  SPACE DROP  C HOLD',10+CW*BW/2,340,14,'center','#9ca3af')}
 if(state==='over'){T('GAME OVER',10+CW*BW/2,300,48,'center','#f87171');T('ENTER TO RETRY',10+CW*BW/2,340,20,'center')}if(state==='pause')T('PAUSED',10+CW*BW/2,320,48,'center')}
addEventListener('keydown',e=>{if(e.code==='KeyP'&&state==='pause')state='play'});
touchUI([[['◀','ArrowLeft'],['▶','ArrowRight']],[['⟳','ArrowUp'],['▼','ArrowDown'],['⤓','Space']]]);reset();state='title';run(update,draw);
