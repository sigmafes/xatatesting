const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

const WIDTH = 800;
const HEIGHT = 450;

const players = {};
const boxes = {};

function randomId4(){
  return Math.random().toString(36).slice(2,6).toUpperCase();
}

io.on('connection', socket => {
  const id = socket.id;
  const name = `Guest_${randomId4()}`;
  players[id] = { id, x:80, y:0, w:32, h:32, name, dead: false, vx:0, vy:0 };

  // send full state on connect
  socket.emit('state', players);

  socket.on('update', data => {
    // update player's state (whitelist fields)
    if(!players[id]) players[id] = { id, x:80, y:0, w:32, h:32, name };
    players[id].x = data.x ?? players[id].x;
    players[id].y = data.y ?? players[id].y;
    players[id].w = data.w ?? players[id].w;
    players[id].h = data.h ?? players[id].h;
  });

  socket.on('setName', newName => {
    if(typeof newName === 'string' && newName.length > 0 && newName.length <= 32){
      players[id].name = newName;
    }
  });

  socket.on('setDead', ()=>{
    if(players[id]) players[id].dead = true;
  });

  socket.on('respawn', coords => {
    if(players[id]){
      players[id].dead = false;
      if(coords && typeof coords.x === 'number') players[id].x = coords.x;
      if(coords && typeof coords.y === 'number') players[id].y = coords.y;
    }
  });

  socket.on('chat', msg => {
    // broadcast chat to everyone
    if(msg && typeof msg.text === 'string'){
      const out = { name: (msg.name || players[id].name || 'Guest'), text: msg.text };
      io.emit('chat', out);
    }
  });

  socket.on('spawnBox', vec => {
    if(!players[id] || players[id].dead) return;
    const speed = 30; // increased x3
    const boxId = id + '_' + Date.now();
    const owner = id;
    const px = players[id].x + players[id].w/2 - 16;
    const py = players[id].y + players[id].h/2 - 16;
    const dx = (vec && typeof vec.dx === 'number') ? vec.dx : 1;
    const dy = (vec && typeof vec.dy === 'number') ? vec.dy : -0.2;
    boxes[boxId] = {
      id: boxId,
      owner,
      x: px + dx*20,
      y: py + dy*20,
      w: 32,
      h: 32,
      vx: dx * speed,
      vy: dy * speed,
      born: Date.now()
    };
  });

  socket.on('disconnect', ()=>{
    delete players[id];
  });
});

// broadcast state at 20Hz
// broadcast state + physics for boxes at 20Hz
setInterval(()=>{
  // simulate boxes
  const gravity = 0.5;
  // define platforms same as client
  const redPlatform = { x:0, w: WIDTH, h:20, y: HEIGHT - 20 - 40 };
  const whitePlatform = { w: Math.floor(redPlatform.w * 0.75), h:28 };
  whitePlatform.x = redPlatform.x + Math.floor((redPlatform.w - whitePlatform.w) / 2);
  whitePlatform.y = redPlatform.y - 20 - whitePlatform.h;

  const now = Date.now();
  for(const id in boxes){
    const b = boxes[id];
    // integrate
    b.vy += gravity;
    b.x += b.vx;
    b.y += b.vy;

    // lifetime
    if(now - b.born > 10000) { delete boxes[id]; continue; }

    // out of bounds
    if(b.x + b.w < -100 || b.x > WIDTH + 100 || b.y > HEIGHT + 200){ delete boxes[id]; continue; }

    // collide with white platform
    if(b.x < whitePlatform.x + whitePlatform.w && b.x + b.w > whitePlatform.x && b.y < whitePlatform.y + whitePlatform.h && b.y + b.h > whitePlatform.y){
      // simple resolution: if coming from above
      if(b.y + b.h - b.vy <= whitePlatform.y){
        b.y = whitePlatform.y - b.h;
        b.vy = 0;
        b.vx *= 0.6;
      } else {
        // horizontal collision
        b.vx = -b.vx * 0.3;
      }
    }

    // collide with players and push
    for(const pid in players){
      const p = players[pid];
      if(!p || p.dead) continue;
      if(b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y){
        // apply stronger horizontal push; add a small downward vertical nudge
        const pushX = b.vx * 1.2;
        // avoid giving a large upward velocity; instead apply a small downward nudge
        const pushY = Math.min(Math.abs(b.vy) * 0.15, 6);
        p.vx = (p.vx || 0) + pushX;
        p.vy = (p.vy || 0) + pushY;
        // nudge player's position so clients perceive immediate movement
        p.x += pushX * 0.6;
        p.y += pushY * 0.6;
        // separate box from player to avoid sticking
        if(b.vx > 0) b.x = p.x + p.w;
        else b.x = p.x - b.w;
        // damp box velocity a bit
        b.vx *= 0.5;
        b.vy *= 0.5;
      }
    }
  }

  io.emit('state', { players, boxes });
}, 50);

const port = process.env.PORT || 3000;
server.listen(port, ()=>{
  console.log('Server listening on port', port);
});
