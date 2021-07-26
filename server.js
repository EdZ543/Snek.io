var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var players = {};

var INIT_SECTIONS = 6;
var SPEED = 50;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  console.log('a user connected');

  players[socket.id] = {
    head: {
      x: Math.floor(Math.random() * 700) + 50,
      y: Math.floor(Math.random() * 500) + 50,
    },
    section: [],
    playerId: socket.id,
    color: Math.floor(Math.random() * 16777215).toString(16),
    score: 0
  }

  for (var i = 0; i < INIT_SECTIONS; i++) {
    if (i == 0) {
      players[socket.id].nodes[i] = { x: Math.floor(Math.random() * 700) + 50, y: Math.floor(Math.random() * 500) + 50 };
    } else {
      players[socket.id].nodes[i] = { x: players[socket.id].nodes[i - 1].x - SPEED, y: players[socket.id].nodes[i - 1].y };
    }
  }

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('disconnect', () => {
    console.log('user disconnected');

    delete players[socket.id];
    io.emit('unconnect', socket.id);
  });

  socket.on('gameOver', () => {
    delete players[socket.id];
    io.emit('unconnect', socket.id);
  });

  socket.on('playerMovement', function (movementData) {
    players[socket.id].nodes = movementData.nodes;
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });
});

server.listen(process.env.PORT || 8081, function () {
  console.log(`Listening on ${server.address().port}`);
});