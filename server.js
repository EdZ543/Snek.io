var express = require('express');
const { SocketAddress } = require('net');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var players = {};
var noms = [];

var INIT_NODES = 6;
var NUM_NOMS = 100;
var WORLD_SIZE = 5000;
var BUFFER = 500;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

for (var i = 0; i < NUM_NOMS; i++) {
  noms[i] = {
    x: randInt(-WORLD_SIZE / 2 + BUFFER, WORLD_SIZE / 2 - BUFFER),
    y: randInt(-WORLD_SIZE / 2 + BUFFER, WORLD_SIZE / 2 - BUFFER),
  }
}

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  console.log('a user connected');

  players[socket.id] = {
    nodes: [],
    playerId: socket.id,
    color: Math.floor(Math.random() * 16777215).toString(16),
  }

  for (var i = 0; i < INIT_NODES; i++) {
    if (i == 0) {
      players[socket.id].nodes[i] = { x: randInt(-WORLD_SIZE / 2 + BUFFER, WORLD_SIZE / 2 - BUFFER), y: randInt(-WORLD_SIZE / 2 + BUFFER, WORLD_SIZE / 2 - BUFFER) };
    } else {
      players[socket.id].nodes[i] = { x: players[socket.id].nodes[i - 1].x, y: players[socket.id].nodes[i - 1].y };
    }
  }

  socket.emit('currentPlayers', players);
  socket.emit('nomLocations', noms);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('disconnect', () => {
    console.log('user disconnected');

    delete players[socket.id];
    io.emit('unconnect', socket.id);
  });

  socket.on('playerMovement', function (movementData) {
    for (var i = 0; i < players[socket.id].nodes.length; i++) {
      players[socket.id].nodes[i] = movementData.nodes[i];
    }
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  socket.on('playerDed', () => {
    io.emit('unconnect', socket.id);
  });

  socket.on('nomCollected', (nomPos, x, y) => {
    for (var i = 0; i < noms.length; i++) {
      if (noms[i] == nomPos) {
        delete noms[i];
        i--;
      }
    }
    socket.broadcast.emit('nomCollection', nomPos);
    io.emit('scoreUpdate', players[socket.id]);
  })
  
  socket.on('playerGrow', (playerInfo) => {
    players[socket.id].nodes.push({ x: playerInfo.x, y: playerInfo.y });
    socket.broadcast.emit('playerGrowed', players[socket.id]);
  });
});

server.listen(process.env.PORT || 8081, function () {
  console.log(`Listening on ${server.address().port}`);
});