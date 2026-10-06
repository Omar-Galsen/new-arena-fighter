'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),W=1200,H=720,TAU=Math.PI*2;
const forestImage=new Image();
forestImage.src='assets/emerald-arena.webp';
// Four walk + four attack frames per direction.
const zombieFrames={},zombieAttackFrames={};
for(const direction of ['down','up','left','right']){
 zombieFrames[direction]=Array.from({length:4},(_,i)=>{
  const image=new Image();
  image.src=`assets/sprites/zombie/walk/${direction}/${direction}_${String(i+1).padStart(2,'0')}.png`;
  return image;
 });
 zombieAttackFrames[direction]=Array.from({length:4},(_,i)=>{
  const image=new Image();
  image.src=`assets/sprites/zombie/attack/${direction}/${direction}_${String(i+1).padStart(2,'0')}.png`;
  return image;
 });
}
function zombieDirection(angle){
 return Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))
  ?(Math.cos(angle)>0?'right':'left'):(Math.sin(angle)>0?'down':'up');
}
function drawZombieSprite(o){
 const direction=zombieDirection(o.angle);
 const walkFrames=zombieFrames[direction];
 const attackFrames=zombieAttackFrames[direction];
 if(!walkFrames.every(image=>image.complete&&image.naturalWidth))return false;
 let frames=walkFrames,index=o.walking?Math.floor(o.walkTime*6)%4:0,attackProgress=0;
 const attackLength=o.boss?1.2:1;
 const attacking=o.wind>0||o.strikeHold>0;
 if(attacking){
  attackProgress=o.wind>0?clamp(1-o.wind/attackLength,0,1):1;
  index=Math.min(3,Math.floor(attackProgress*4));
  const attackImage=attackFrames[index];
  if(attackImage&&attackImage.complete&&attackImage.naturalWidth)frames=attackFrames;
 }
 const image=frames[index]&&frames[index].complete&&frames[index].naturalWidth?frames[index]:walkFrames[0];
 // Use one source scale for all crops so frames preserve their proportions.
 const scale=(o.boss?1.45:1)*68/image.naturalHeight;
 const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
 ctx.save();ctx.fillStyle='#09140c70';ctx.beginPath();
 ctx.ellipse(o.x,o.y+3,o.r+2,o.r*.42,0,0,TAU);ctx.fill();
 const hitKick=o.hit>0?6*Math.sin((o.hit/.18)*Math.PI):0;
 ctx.translate(-Math.cos(o.angle)*hitKick,-Math.sin(o.angle)*hitKick);
 if(attacking){
  // Make the attack unmistakable even on small screens: wind-up, forward lunge, impact hold.
  const lunge=o.strikeHold>0?14:Math.sin(attackProgress*Math.PI)*18;
  ctx.translate(Math.cos(o.angle)*lunge,Math.sin(o.angle)*lunge);
  if(attackProgress>.55||o.strikeHold>0){
   ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle='#f1d28a';ctx.lineWidth=o.boss?7:5;
   ctx.beginPath();ctx.arc(o.x+Math.cos(o.angle)*26,o.y-height*.48+Math.sin(o.angle)*15,o.boss?27:21,o.angle-.8,o.angle+.8);ctx.stroke();ctx.restore();
  }
 }
 if(o.hit>0)ctx.rotate(Math.sin(time*65)*.08);
 if(o.flash>0)ctx.filter='brightness(1.8) saturate(.6)';
 ctx.drawImage(image,o.x-width/2,o.y-height,width,height);ctx.restore();
 const barY=o.y-76*(o.boss?1.45:1);
 ctx.fillStyle='#142019';ctx.fillRect(o.x-22,barY,44,4);
 ctx.fillStyle=o.boss?'#bda16f':'#a1b478';
 ctx.fillRect(o.x-22,barY,44*clamp(o.hp/o.max,0,1),4);
 return true;
}

// Floor outline in canvas coordinates; artwork is aspect-fitted at (60,0), 1080 x 720.
const forestBoundary=[[427,108],[751,108],[924,173],[989,302],[956,425],[794,533],[416,533],[244,425],[211,310],[265,187]];
function constrainForest(o){
 for(let pass=0;pass<4;pass++)for(let i=0;i<forestBoundary.length;i++){
  const a=forestBoundary[i],b=forestBoundary[(i+1)%forestBoundary.length];
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  const nx=-dy/len,ny=dx/len,inside=(o.x-a[0])*nx+(o.y-a[1])*ny;
  if(inside<o.r+6){o.x+=nx*(o.r+6-inside);o.y+=ny*(o.r+6-inside);}
 }
}
const arenas=[
 {name:'Emerald Ruins',tag:'MOSS & STONE',floor:'#203931',tile:'#304b3c',edge:'#0d2524',accent:'#afcc80',rocks:[]},
 {name:'Sunken Sands',tag:'DUST & GOLD',floor:'#5b4732',tile:'#746045',edge:'#332b24',accent:'#e0b573',rocks:[[240,220,55],[960,220,55],[240,500,55],[960,500,55]]},
 {name:'Frost Citadel',tag:'ICE & ASH',floor:'#2f4553',tile:'#405b68',edge:'#192c3c',accent:'#a0d7df',rocks:[[360,190,40],[840,190,40],[360,530,40],[840,530,40]]}
];
let selected=0,active=0,state='menu',resumeState='play',wave=0,kills=0,best=0,conquered=[];
try{best=Number(localStorage.getItem('rift-best'))||0;conquered=JSON.parse(localStorage.getItem('rift-maps')||'[]');if(!Array.isArray(conquered))conquered=[];}catch{}
let player,enemies=[],effects=[],particles=[],delay=0,time=0,last=0,shake=0;
const keys=new Set();let moving=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function save(){try{localStorage.setItem('rift-best',String(best));localStorage.setItem('rift-maps',JSON.stringify(conquered));}catch{}}
function resetPlayer(){player={x:600,y:360,r:18,hp:100,stamina:100,angle:0,attack:0,spin:0,dodge:0,invincible:0,hit:0,hitAngle:0};}resetPlayer();
function mapButtons(){const box=$('#maps');box.replaceChildren();arenas.forEach((a,i)=>{const b=document.createElement('button');b.className=i===selected?'active':'';b.style.setProperty('--accent',a.accent);b.innerHTML=a.name+'<small>'+(conquered.includes(i)?'✓ CONQUERED':a.tag)+'</small>';b.onclick=()=>{selected=i;mapButtons();$('#start').textContent=selected===active&&wave>0&&resumeState==='play'?'Resume arena →':'Enter arena →';};box.append(b);});}
function openMap(){if(state==='map'){closeMap();return;}resumeState=state;state='map';keys.clear();selected=active;$('#overlay').hidden=false;$('.panel h1').textContent='Choose your arena.';$('.panel p').innerHTML='Each arena has its own layout. Entering another arena starts a new run.';mapButtons();$('#start').textContent=resumeState==='play'?'Resume arena →':'Enter arena →';}
function closeMap(){if(resumeState==='play'||resumeState==='paused'){state=resumeState;$('#overlay').hidden=true;} }
function start(){if(state==='map'&&selected===active&&resumeState==='play'){state='play';$('#overlay').hidden=true;return;}active=selected;resetPlayer();wave=0;kills=0;enemies=[];effects=[];particles=[];state='play';keys.clear();$('#overlay').hidden=true;$('#location').textContent='THE '+arenas[active].name.toUpperCase();nextWave();}
function nextWave(){wave++;delay=0;$('#banner').textContent='WAVE '+wave+' / 5'+(wave===5?' · ZOMBIE BRUTE':'');for(let i=0;i<3+wave*2;i++){const a=i*TAU/(3+wave*2);const boss=wave===5&&i===0;enemies.push({x:600+Math.cos(a)*(active===0?350:495),y:(active===0?320:360)+Math.sin(a)*(active===0?170:260),r:boss?32:17,hp:boss?240:42+wave*7,max:boss?240:42+wave*7,speed:boss?23:28+Math.min(wave,5)*2,walkPhase:i*1.7,walkTime:i*.17,walking:false,angle:0,cool:1.6+i*.2,wind:0,lockedX:0,lockedY:0,flash:0,hit:0,strikeHold:0,boss});if(active===0)constrainForest(enemies[enemies.length-1]);}}
function burst(x,y,color,n=12){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=40+Math.random()*150;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.3,color});}}
function move(o,dx,dy){if(active===0){o.x+=dx;o.y+=dy;constrainForest(o);return;}o.x=clamp(o.x+dx,65+o.r,W-65-o.r);o.y=clamp(o.y+dy,75+o.r,H-60-o.r);for(const [x,y,r] of arenas[active].rocks){let vx=o.x-x,vy=o.y-y,d=Math.hypot(vx,vy);if(d<r+o.r){if(d<.001){vx=1;vy=0;d=1;}o.x=x+vx/d*(r+o.r);o.y=y+vy/d*(r+o.r);}}}
function action(type){if(state!=='play')return;if(type==='dodge'){if(player.stamina>=25&&player.dodge<=0){player.stamina-=25;player.dodge=.19;player.invincible=.32;}return;}
 const spin=type==='spin';if(player.attack>0||player.dodge>0||(spin&&(player.stamina<40||player.spin>0)))return;
 player.attack=spin?.65:.3;if(spin){player.stamina-=40;player.spin=1.5;}
 effects.push({x:player.x,y:player.y,angle:player.angle,r:spin?125:98,life:.24,max:.24,spin});
 for(const e of enemies){const angle=Math.atan2(e.y-player.y,e.x-player.x);const diff=Math.atan2(Math.sin(angle-player.angle),Math.cos(angle-player.angle));if(distance(player,e)<(spin?125:98)+e.r&&(spin||Math.abs(diff)<1.15)){e.hp-=spin?48:28;e.flash=.15;e.hit=.18;move(e,Math.cos(angle)*23,Math.sin(angle)*23);burst(e.x,e.y,arenas[active].accent);shake=4;}}
 removeDead();}
function removeDead(){enemies=enemies.filter(e=>{if(e.hp>0)return true;kills++;player.stamina=Math.min(100,player.stamina+7);burst(e.x,e.y,'#eab27a',20);return false;});}
function end(won){state=won?'won':'dead';best=Math.max(best,kills);if(won&&!conquered.includes(active))conquered.push(active);save();resumeState=state;$('#overlay').hidden=false;$('.panel h1').textContent=won?'Arena conquered.':'The rift claims you.';$('.panel p').textContent=won?'Five waves defeated. Choose your next battleground.':'Defeated '+kills+' enemies. Dodge when the ground turns red, then counterattack.';$('#start').textContent=won?'Enter next arena →':'Fight again →';selected=won?(active+1)%arenas.length:active;mapButtons();keys.clear();}
function pause(){if(state==='play')state='paused';else if(state==='paused')state='play';keys.clear();$('#pause').textContent=state==='paused'?'Resume · P':'Pause · P';}
function update(dt){time+=dt;if(state!=='play')return;player.attack=Math.max(0,player.attack-dt);player.spin=Math.max(0,player.spin-dt);player.invincible=Math.max(0,player.invincible-dt);player.hit=Math.max(0,player.hit-dt);player.stamina=Math.min(100,player.stamina+18*dt);shake=Math.max(0,shake-dt*30);
 let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));const len=Math.hypot(dx,dy);moving=len>0;if(len){dx/=len;dy/=len;if(player.dodge<=0)player.angle=Math.atan2(dy,dx);}
 if(player.dodge>0){move(player,Math.cos(player.angle)*680*dt,Math.sin(player.angle)*680*dt);player.dodge-=dt;burst(player.x,player.y,'#9db7a4',1);}else move(player,dx*220*dt,dy*220*dt);
 if(keys.has('j'))action('slash');if(keys.has('k'))action('spin');if(keys.has(' '))action('dodge');
 for(const e of enemies){e.walking=false;e.flash=Math.max(0,e.flash-dt);e.hit=Math.max(0,e.hit-dt);e.strikeHold=Math.max(0,e.strikeHold-dt);e.cool-=dt;if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.strikeHold=.16;effects.push({x:e.lockedX,y:e.lockedY,r:e.boss?58:38,angle:0,life:.22,max:.22,spin:true,enemy:true});if(Math.hypot(player.x-e.lockedX,player.y-e.lockedY)<(e.boss?58:38)+player.r&&player.invincible<=0){player.hp-=e.boss?26:12;player.invincible=.65;player.hit=.28;player.hitAngle=e.angle;shake=8;burst(player.x,player.y,'#df8069',18);}e.cool=e.boss?2.4:1.9;}}else{const d=distance(player,e);e.angle=Math.atan2(player.y-e.y,player.x-e.x);if(d<(e.boss?70:56)&&e.cool<=0){e.wind=e.boss?1.2:1;e.lockedX=player.x;e.lockedY=player.y;}else if(d>(e.boss?56:40)){e.walking=true;e.walkTime+=dt;e.walkPhase+=dt*4;const pace=.8+.2*Math.sin(e.walkPhase);move(e,Math.cos(e.angle)*e.speed*pace*dt,Math.sin(e.angle)*e.speed*pace*dt);}}}
 // Separate enemies so a wave does not collapse into a single stack.
 for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i],b=enemies[j],d=distance(a,b),limit=a.r+b.r+3;if(d>0&&d<limit){const f=(limit-d)/d*.5;const dx=(a.x-b.x)*f,dy=(a.y-b.y)*f;move(a,dx,dy);move(b,-dx,-dy);}}
 effects.forEach(e=>e.life-=dt);effects=effects.filter(e=>e.life>0);particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;});particles=particles.filter(p=>p.life>0);
 if(player.hp<=0){player.hp=0;end(false);return;}if(!enemies.length){delay+=dt;$('#banner').textContent='WAVE CLEARED · RECOVERING';if(delay>2){player.hp=Math.min(100,player.hp+20);if(wave===5)end(true);else nextWave();}}
}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function floor(){const a=arenas[active];if(active===0&&forestImage.complete&&forestImage.naturalWidth){ctx.fillStyle='#0b1917';ctx.fillRect(0,0,W,H);ctx.drawImage(forestImage,60,0,1080,720);return;}ctx.fillStyle=a.edge;ctx.fillRect(0,0,W,H);ctx.fillStyle=a.floor;ctx.fillRect(55,65,1090,600);ctx.strokeStyle=a.tile;ctx.lineWidth=1;for(let y=65;y<665;y+=60){for(let x=55;x<1145;x+=70){ctx.strokeRect(x+(Math.floor(y/60)%2)*35,y,70,60);}}
 ctx.strokeStyle=a.accent+'55';ctx.lineWidth=3;ctx.strokeRect(65,75,1070,580);ctx.beginPath();ctx.arc(600,360,150,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(600,360,165,0,TAU);ctx.stroke();ctx.save();ctx.translate(600,360);ctx.rotate(Math.PI/4);ctx.strokeRect(-78,-78,156,156);ctx.restore();
 for(let i=0;i<45;i++){const x=(i*239%1060)+70,y=(i*137%550)+90;ctx.fillStyle=a.tile;ctx.fillRect(x,y,3+(i%4),2);}
 for(const [x,y,r] of a.rocks){circle(x+8,y+12,r+4,'#0005');circle(x,y,r,a.edge);circle(x-3,y-6,r*.83,a.tile);ctx.strokeStyle=a.accent+'55';ctx.beginPath();ctx.arc(x-3,y-6,r*.8,3.4,5.5);ctx.stroke();if(active===0){circle(x-16,y-16,12,'#587148');circle(x+13,y+6,8,'#587148');}}
 for(const [x,y] of [[80,90],[1120,90],[80,635],[1120,635]]){circle(x,y,17,'#17211d');circle(x,y,8,a.accent);circle(x,y,4,'#fff1b6');}}
// Upright shambling zombies, anchored at their feet to suit the arena artwork.
function zombie(o){
 if(drawZombieSprite(o))return;
 const scale=o.boss?1.45:1,phase=o.walkPhase||0;
 const step=o.walking?Math.sin(phase)*4:0,sway=o.walking?Math.sin(phase*.5)*2:0;
 const reach=o.wind>0?7:0,skin=o.flash>0?'#f2e9c9':o.boss?'#879074':'#9baa7b';
 ctx.save();ctx.translate(o.x,o.y);ctx.scale(scale,scale);
 ctx.fillStyle='#09140c70';ctx.beginPath();ctx.ellipse(0,3,19,8,0,0,TAU);ctx.fill();
 ctx.translate(sway,0);ctx.lineCap='round';
 // Alternating ragged trouser legs and feet.
 ctx.strokeStyle='#333d35';ctx.lineWidth=8;
 ctx.beginPath();ctx.moveTo(-7,-18);ctx.lineTo(-9,-4+step);ctx.moveTo(7,-18);ctx.lineTo(9,-4-step);ctx.stroke();
 ctx.fillStyle='#222c26';ctx.fillRect(-14,-4+step,11,5);ctx.fillRect(5,-4-step,11,5);
 // Torn jacket and asymmetrical shoulder line.
 ctx.fillStyle=o.boss?'#665448':'#566459';ctx.beginPath();ctx.moveTo(-13,-39);ctx.lineTo(10,-41);ctx.lineTo(15,-18);ctx.lineTo(5,-21);ctx.lineTo(0,-17);ctx.lineTo(-13,-21);ctx.closePath();ctx.fill();
 ctx.fillStyle='#343e32';ctx.fillRect(-3,-35,5,16);ctx.fillStyle='#927e61';ctx.fillRect(6,-28,5,7);
 const facing=Math.cos(o.angle)>=0?1:-1;
 // Reaching arms point toward the target; the attack still uses the red ground marker.
 ctx.strokeStyle=skin;ctx.lineWidth=6;
 ctx.beginPath();ctx.moveTo(-11,-35);ctx.lineTo(-16+facing*4,-24-step*.3);ctx.lineTo(facing*(20+reach),-24-step*.3);
 ctx.moveTo(10,-36);ctx.lineTo(15+facing*3,-30+step*.3);ctx.lineTo(facing*(24+reach),-31+step*.3);ctx.stroke();
 circle(facing*(20+reach),-24-step*.3,4,skin);circle(facing*(24+reach),-31+step*.3,4,skin);
 circle(2,-47,11,skin);ctx.fillStyle='#444d3b';ctx.fillRect(-6,-57,13,4);
 ctx.fillStyle='#202b23';ctx.fillRect(facing>0?3:-8,-49,4,3);ctx.fillRect(facing>0?5:-8,-42,6,3);
 ctx.fillStyle='#d3ce91';ctx.fillRect(facing>0?4:-7,-49,2,2);ctx.restore();
 ctx.fillStyle='#142019';ctx.fillRect(o.x-22,o.y-68*scale,44,4);
 ctx.fillStyle=o.boss?'#bda16f':'#a1b478';ctx.fillRect(o.x-22,o.y-68*scale,44*Math.max(0,o.hp/o.max),4);
}
function fighter(o,hero){if(!hero){zombie(o);return;}ctx.save();ctx.translate(o.x,o.y);circle(2,9,o.r+3,'#0006');
 if(hero&&o.hit>0){const kick=8*Math.sin((o.hit/.28)*Math.PI);ctx.translate(Math.cos(o.hitAngle)*kick,Math.sin(o.hitAngle)*kick);ctx.rotate(Math.sin(time*70)*.12);}
 if(hero&&o.invincible>0&&Math.floor(time*22)%2)ctx.globalAlpha=.4;const bob=hero&&moving?Math.sin(time*18)*3:Math.sin(time*3)*1.5;ctx.translate(0,bob);ctx.rotate(o.angle);if(hero){ctx.fillStyle='#b4c884';ctx.beginPath();ctx.moveTo(-8,-11);ctx.lineTo(-32,-17);ctx.lineTo(-25,17);ctx.lineTo(-8,11);ctx.fill();circle(0,0,17,'#22312d');circle(0,0,13,'#b5c9c2');ctx.fillStyle='#e3eee5';ctx.fillRect(3,-9,5,18);ctx.fillStyle='#526f77';ctx.fillRect(8,-6,4,12);ctx.fillStyle='#d5ddc6';ctx.fillRect(12,13,35,5);ctx.fillStyle='#c9a466';ctx.fillRect(18,8,4,15);circle(0,-18,8,'#708f7e');}else{circle(0,0,o.r,o.flash>0?'#fff0bb':o.boss?'#78435e':'#8d6354');circle(4,-6,o.r*.5,'#b29478');ctx.fillStyle='#f5b45e';ctx.fillRect(10,-9,5,5);ctx.fillRect(10,3,5,5);ctx.fillStyle='#ddcda0';ctx.beginPath();ctx.moveTo(-8,-o.r+3);ctx.lineTo(2,-o.r-12);ctx.lineTo(8,-o.r+6);ctx.fill();ctx.beginPath();ctx.moveTo(-8,o.r-3);ctx.lineTo(2,o.r+12);ctx.lineTo(8,o.r-6);ctx.fill();}ctx.restore();if(!hero){ctx.fillStyle='#121b18';ctx.fillRect(o.x-22,o.y-o.r-18,44,4);ctx.fillStyle=o.boss?'#d092b2':'#d69d78';ctx.fillRect(o.x-22,o.y-o.r-18,44*Math.max(0,o.hp/o.max),4);}}
function draw(){ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);floor();for(const e of enemies)if(e.wind>0){circle(e.lockedX,e.lockedY,e.boss?58:38,'#ed695540');ctx.strokeStyle='#fa9172';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.lockedX,e.lockedY,e.boss?58:38,0,TAU);ctx.stroke();}const actors=[...enemies,player].sort((a,b)=>a.y-b.y);for(const o of actors)fighter(o,o===player);for(const e of effects){ctx.globalAlpha=e.life/e.max;ctx.strokeStyle=e.enemy?'#ef755f':'#e6efb9';ctx.lineWidth=e.spin?12:18;ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-e.life/e.max*.25),e.spin?0:e.angle-1.1,e.spin?TAU:e.angle+1.1);ctx.stroke();}ctx.globalAlpha=1;for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);circle(p.x,p.y,2,p.color);}ctx.globalAlpha=1;ctx.restore();if(state==='paused'){ctx.fillStyle='#081512a0';ctx.fillRect(0,0,W,H);ctx.fillStyle='#eff2da';ctx.font='40px Georgia';ctx.textAlign='center';ctx.fillText('Paused · P to resume',600,360);}$('#hp').style.width=player.hp+'%';$('#hpText').textContent=Math.ceil(player.hp)+' / 100';$('#stamina').style.width=player.stamina+'%';$('#wave').textContent=String(wave).padStart(2,'0');$('#kills').textContent=kills;$('#best').textContent=best;$('#message').textContent=state==='play'?enemies.length+' enemies remaining · Spin '+(player.spin>0?player.spin.toFixed(1)+'s':'ready'):'Choose your battleground';}
function frame(now){const dt=Math.min((now-last)/1000,.033);last=now;update(dt);draw();requestAnimationFrame(frame);}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(!e.repeat){if(k==='p')pause();if(k==='m')openMap();}keys.add(k);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();if(state==='play')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);});for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>keys.delete(b.dataset.key));}
$('#start').onclick=start;$('#pause').onclick=pause;$('#mapButton').onclick=openMap;mapButtons();requestAnimationFrame(frame);
