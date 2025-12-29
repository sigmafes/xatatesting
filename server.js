const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

const players = {};

function randomId4(){
  return Math.random().toString(36).slice(2,6).toUpperCase();
}

io.on('connection', socket => {
  const id = socket.id;
  const name = `Guest_${randomId4()}`;
  players[id] = { id, x:80, y:0, w:32, h:32, name };

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

  socket.on('chat', msg => {
    // broadcast chat to everyone
    if(msg && typeof msg.text === 'string'){
      const out = { name: (msg.name || players[id].name || 'Guest'), text: msg.text };
      io.emit('chat', out);
    }
  });

  socket.on('disconnect', ()=>{
    delete players[id];
  });
});

// broadcast state at 20Hz
setInterval(()=>{
  io.emit('state', players);
}, 50);

const port = process.env.PORT || 3000;
server.listen(port, ()=>{
  console.log('Server listening on port', port);
});
