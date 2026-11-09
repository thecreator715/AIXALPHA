// ===== PONG (vs CPU or 2 players) =====
let state='title',p1,p2,ball,s1=0,s2=0,two=false,parts=[],trail=[],rally=0;
function serve(d){ball={x:W/2,y:H/2,vx:6*d,vy:(Math.random()-.5)*6,r:9};rally=0}
function reset(){p1={y:H/2};p2={y:H/2};s1=0;s2=0;serve(Math.random()<.5?1:-1)}
function update(){
 if(state!=='play'){if(hit('Enter')||hit('Space')){au();two=false;reset();state='play'}if(hit('Digit2')){au();two=true;reset();state='play'}return}
 if(hit('KeyP')){state='pause';return}
 const ph=90,sp=9;if(K.KeyW)p1.y-=sp;if(K.KeyS)p1.y+=sp;if(!two){if(K.ArrowUp)p1.y-=sp;if(K.ArrowDown)p1.y+=sp}
 if(two){if(K.ArrowUp)p2.y-=sp;if(K.ArrowDown)p2.y+=sp}else{const t=ball.vx>0?ball.y:H/2;p2.y+=Math.max(-5.2,Math.min(5.2,(t-p2.y)*.1))}
 p1.y=Math.max(ph/2,Math.min(H-ph/2,p1.y));p2.y=Math.max(ph/2,Math.min(H-ph/2,p2.y));
 trail.push({x:ball.x,y:ball.y});if(trail.length>12)trail.shift();
 ball.x+=ball.vx;ball.y+=ball.vy;if(ball.y<ball.r||ball.y>H-ball.r){ball.vy*=-1;ball.y=Math.max(ball.r,Math.min(H-ball.r,ball.y));tone(300,.04)}
 const pd=(p,x,dir)=>{if(ball.vx*dir<0&&Math.abs(ball.x-x)<ball.r+8&&Math.abs(ball.y-p.y)<ph/2+ball.r){const o=(ball.y-p.y)/(ph/2),sp2=Math.min(15,Math.hypot(ball.vx,ball.vy)*1.04);const a=o*1.0;ball.vx=Math.cos(a)*sp2*dir;ball.vy=Math.sin(a)*sp2;rally++;tone(440+rally*12,.06);for(let i=0;i<8;i++)parts.push({x:ball.x,y:ball.y,vx:(Math.random()-.3)*dir*4,vy:(Math.random()-.5)*4,l:20})}};
 pd(p1,40,1);pd(p2,W-40,-1);
 if(ball.x<-20){s2++;tone(160,.4,'sawtooth',.1,-80);serve(1)}if(ball.x>W+20){s1++;tone(660,.3,'square',.08,330);serve(-1)}
 if(s1>=7||s2>=7){state='over';saveHi(s1)}
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l--});parts=parts.filter(p=>p.l>0)}
function T(t,x,y,s,al,c){X.font='700 '+s+'px "Courier New",monospace';X.textAlign=al||'left';X.fillStyle=c||'#fff';X.fillText(t,x,y)}
function draw(){X.fillStyle='#000';X.fillRect(0,0,W,H);X.fillStyle='#333';for(let y=10;y<H;y+=30)X.fillRect(W/2-2,y,4,16);
 X.fillStyle='#fff';X.shadowColor='#fff';X.shadowBlur=12;if(p1)X.fillRect(32,p1.y-45,10,90);if(p2)X.fillRect(W-42,p2.y-45,10,90);
 trail.forEach((t,i)=>{X.globalAlpha=i/trail.length*.4;X.beginPath();X.arc(t.x,t.y,ball.r*(i/trail.length),0,6.283);X.fill()});X.globalAlpha=1;
 if(ball){X.beginPath();X.arc(ball.x,ball.y,ball.r,0,6.283);X.fill()}X.shadowBlur=0;parts.forEach(p=>{X.globalAlpha=p.l/20;X.fillRect(p.x,p.y,3,3)});X.globalAlpha=1;
 T(String(s1),W/2-80,90,72,'center');T(String(s2),W/2+80,90,72,'center');
 if(state==='title'){T('PONG',W/2,H/2-30,84,'center');T('ENTER = VS CPU   2 = TWO PLAYERS',W/2,H/2+30,24,'center','#9ca3af');T('W/S (P1)   UP/DOWN (P2 or P1 vs CPU)',W/2,H/2+64,18,'center','#9ca3af')}
 if(state==='over'){T(s1>s2?'YOU WIN':'CPU WINS',W/2,H/2,64,'center');T('ENTER TO PLAY AGAIN',W/2,H/2+44,22,'center')}if(state==='pause')T('PAUSED',W/2,H/2,60,'center')}
addEventListener('keydown',e=>{if(e.code==='KeyP'&&state==='pause')state='play'});
touchUI([[['▲','ArrowUp'],['▼','ArrowDown']],[['▶','Enter']]]);reset();state='title';run(update,draw);
