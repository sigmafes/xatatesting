const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Socket.IO
const socket = io();

let clientId = null;
const otherPlayers = {};

socket.on('connect', ()=>{ clientId = socket.id; });
socket.on('state', players => {
  // replace otherPlayers except keep local player separate
  for(const id in otherPlayers) delete otherPlayers[id];
  for(const id in players){
    otherPlayers[id] = players[id];
  }
});

// name change UI
const nameInput = document.getElementById('nameInput');
const nameBtn = document.getElementById('nameBtn');
nameBtn.addEventListener('click', ()=>{
  const v = nameInput.value.trim();
  if(v.length>0){ socket.emit('setName', v); }
});

// Chat UI
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatBtn = document.getElementById('chatBtn');

function addChatMessage(name, text, me=false){
  if(!chatMessages) return;
  const el = document.createElement('div');
  el.className = 'chat-msg' + (me? ' me':'');
  el.innerText = `${name}: ${text}`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatBtn.addEventListener('click', ()=>{
  const name = (nameInput.value.trim() || player.name || 'Guest');
  const text = chatInput.value.trim();
  if(text.length===0) return;
  socket.emit('chat', {name, text});
  addChatMessage(name, text, true);
  chatInput.value = '';
});

// receive chat from server
socket.on('chat', msg => {
  if(!msg) return;
  addChatMessage(msg.name || 'Guest', msg.text || '');
});


const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Player
const player = {
  id: null,
  x: 80,
  y: 0,
  w: 32,
  h: 32,
  vx: 0,
  vy: 0,
  color: '#d83b3b',
  speed: 3.2,
  jumpPower: 9.5,
  onGround: false,
  name: ''
};

// Platforms: red platform near bottom (not touching floor) and a white platform 20px above it
// Red platform will kill player on contact. White platform sits above and is half width of red.
// red platform spans full canvas width
const redPlatform = { w: WIDTH, h: 20 };
redPlatform.x = 0;
redPlatform.y = HEIGHT - redPlatform.h - 40; // 40px margin from bottom

// white platform is larger now (75% of red width) and a bit taller
const whitePlatform = { w: Math.floor(redPlatform.w * 0.75), h: 28 };
whitePlatform.x = redPlatform.x + Math.floor((redPlatform.w - whitePlatform.w) / 2);
whitePlatform.y = redPlatform.y - 20 - whitePlatform.h; // 20px above red

const platforms = [ whitePlatform ]; // only the white platform is landable

// spawn point is centered above white platform
const spawn = {
  x: Math.floor(whitePlatform.x + whitePlatform.w/2 - 16),
  y: Math.floor(whitePlatform.y - 32)
};

const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()]=false; });

const gravity = 0.5;

function rectsIntersect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(){
  // if dead, don't process movement
  if(player.dead) return;
  // horizontal input A/D
  let left = keys['a'] || keys['arrowleft'];
  let right = keys['d'] || keys['arrowright'];
  let jump = keys['w'] || keys[' '] || keys['arrowup'];

  if(left){ player.vx = -player.speed; }
  else if(right){ player.vx = player.speed; }
  else { player.vx = 0; }

  // jump
  if(jump && player.onGround){ player.vy = -player.jumpPower; player.onGround = false; }

  // apply gravity
  player.vy += gravity;

  // apply velocities
  player.x += player.vx;
  player.y += player.vy;

  // simple world bounds
  if(player.x < 0) player.x = 0;
  if(player.x + player.w > WIDTH) player.x = WIDTH - player.w;
  if(player.y > HEIGHT) { // fell off -> respawn
    player.x = spawn.x; player.y = spawn.y; player.vx = 0; player.vy = 0;
    socket && socket.connected && socket.emit && socket.emit('respawn', {x:player.x, y:player.y});
  }

  // collision with platforms (very simple resolution)
  player.onGround = false;
  for(const p of platforms){
    const probe = {x:player.x, y:player.y, w:player.w, h:player.h};
    if(rectsIntersect(probe,p)){
      // determine overlap amounts
      const prevY = player.y - player.vy;
      const prevX = player.x - player.vx;

      // If we were above platform previously, land on top
      if(prevY + player.h <= p.y){
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if(prevY >= p.y + p.h){
        // hit from below
        player.y = p.y + p.h;
        player.vy = 0;
      } else {
        // horizontal collision, push out
        if(player.vx > 0) player.x = p.x - player.w;
        else if(player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }
  }
  // check collision with red platform separately (any contact kills)
  const redProbe = {x:player.x, y:player.y, w:player.w, h:player.h};
  if(rectsIntersect(redProbe, redPlatform)){
    if(!player.dead){
      player.dead = true;
      socket && socket.connected && socket.emit && socket.emit('setDead');
      // hide locally until respawn
      player.x = -9999; player.y = -9999; player.vx = 0; player.vy = 0;
      setTimeout(()=>{
        player.x = spawn.x; player.y = spawn.y; player.vx = 0; player.vy = 0; player.dead = false;
        socket && socket.connected && socket.emit && socket.emit('respawn', {x:player.x, y:player.y});
      }, 10000);
    }
  }

  // send update to server (only when not dead)
  if(!player.dead && socket && socket.connected){
    socket.emit('update', {x:player.x, y:player.y, w:player.w, h:player.h});
  }
}

function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);

  // draw white platform
  {
    const p = whitePlatform;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
  // draw red platform
  {
    const p = redPlatform;
    ctx.fillStyle = '#b30000';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#800000';
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
  // draw spawn marker above white platform (center)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(spawn.x + 16, spawn.y + 16, 6, 0, Math.PI*2);
  ctx.fill();

  // other players
  for(const id in otherPlayers){
    const p = otherPlayers[id];
    if(!p) continue;
    if(p.dead) continue;
    if(id === clientId) continue; // skip local; draw local after
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#2b6bd8';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#1a4a9a';
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    // name (white)
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(p.name || '', p.x, p.y - 6);
  }

  // player (red cube) - don't draw if dead
  if(!player.dead){
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.strokeStyle = '#7a0000';
    ctx.strokeRect(player.x, player.y, player.w, player.h);
  }
  // own name (white)
  const me = otherPlayers[clientId];
  const myName = (me && me.name) ? me.name : (player.name || '');
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial';
  ctx.fillText(myName, player.x, player.y - 6);

  // (no HUD text)
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }

// init
player.y = 0;
// attempt to set input placeholder to default name when server sends state
socket.on('state', players => {
  if(clientId && players && players[clientId] && players[clientId].name){
    player.name = players[clientId].name;
    if(nameInput && !nameInput.value) nameInput.placeholder = players[clientId].name;
  }
});

loop();

// Mobile / touch controls: show buttons on Android and wire events
const touchControls = document.getElementById('touchControls');
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const isAndroid = /Android/i.test(navigator.userAgent) || (/Android/i.test(navigator.platform || ''));
if(isAndroid && touchControls){
  touchControls.style.display = 'flex';

  // touch buttons act like holding A/D
  function setKey(k,v){ keys[k]=v; }

  touchLeft.addEventListener('pointerdown', e=>{ e.preventDefault(); setKey('a', true); });
  touchLeft.addEventListener('pointerup', e=>{ e.preventDefault(); setKey('a', false); });
  touchLeft.addEventListener('pointercancel', e=>{ e.preventDefault(); setKey('a', false); });

  touchRight.addEventListener('pointerdown', e=>{ e.preventDefault(); setKey('d', true); });
  touchRight.addEventListener('pointerup', e=>{ e.preventDefault(); setKey('d', false); });
  touchRight.addEventListener('pointercancel', e=>{ e.preventDefault(); setKey('d', false); });

  // tap the canvas to jump
  canvas.addEventListener('pointerdown', e=>{
    // if pointer down landed on a touch button, ignore (handled above)
    // otherwise trigger jump
    if(player.dead) return;
    if(player.onGround){ player.vy = -player.jumpPower; player.onGround = false; }
  });
}

// adjust GUI scale on Android only (do not change canvas size)
function adjustGuiScale(){
  if(!isAndroid) return;
  const nameboxEl = document.querySelector('.namebox');
  const chatEl = document.getElementById('chat');
  const controlsEl = document.getElementById('touchControls');
  // scale relative to canvas logical size
  const maxW = Math.max(100, window.innerWidth - 16);
  const maxH = Math.max(100, window.innerHeight - 16);
  const scale = Math.min(maxW / WIDTH, maxH / HEIGHT, 1);
  // scale GUI elements (so UI remains readable) using CSS transform
  [nameboxEl, chatEl, controlsEl].forEach(el => { if(el) el.style.transform = `scale(${scale})`; });
  // shrink the canvas visually by changing its CSS size while keeping internal resolution
  if(canvas){
    canvas.style.width = Math.floor(WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(HEIGHT * scale) + 'px';
    // remove previous transform-based scaling (if any)
    canvas.style.transform = '';
  }
}

if(isAndroid){
  adjustGuiScale();
  window.addEventListener('resize', adjustGuiScale);
  window.addEventListener('orientationchange', adjustGuiScale);
}
