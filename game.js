const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Player
const player = {
  x: 80,
  y: 0,
  w: 32,
  h: 32,
  vx: 0,
  vy: 0,
  color: '#d83b3b',
  speed: 3.2,
  jumpPower: 9.5,
  onGround: false
};

// Simple platform (white) -- a floor and a raised platform
const platforms = [
  {x:0,y:HEIGHT-40,w:WIDTH,h:40},
  {x:200,y:HEIGHT-120,w:250,h:20},
  {x:520,y:HEIGHT-180,w:180,h:20}
];

const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()]=false; });

const gravity = 0.5;

function rectsIntersect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(){
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
  if(player.y > HEIGHT) { // fell off
    player.x = 80; player.y = 0; player.vx = 0; player.vy = 0;
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
}

function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);

  // background sky already via CSS; draw platform (white)
  for(const p of platforms){
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // player (red cube)
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.strokeStyle = '#7a0000';
  ctx.strokeRect(player.x, player.y, player.w, player.h);

  // HUD
  ctx.fillStyle = '#222';
  ctx.font = '14px Arial';
  ctx.fillText('Controles: A izquierda, D derecha, W saltar', 8, 20);
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }

// init
player.y = 0;
loop();
