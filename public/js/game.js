var config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    parent: 'phaser-example',
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

var game = new Phaser.Game(config);

var SPACING = 30;
var ROTATION_SPEED = 1.5 * Math.PI;
var ROTATION_SPEED_DEGREES = Phaser.Math.RadToDeg(ROTATION_SPEED);
var TOLERANCE = 0.05 * ROTATION_SPEED;
var PLAYER_SIZE = 20;
var SPEED = 5;

function preload() {
  this.load.image('background', 'assets/background.jpg')
}

function create() {
  this.add.image(400, 300, 'background');
  var self = this;
  this.socket = io();
  this.otherPlayers = this.physics.add.group();
  this.nodes = [];
  this.path = [];
  
  this.socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
      if (players[id].playerId === self.socket.id) {
        addPlayer(self, players[id]);
      } else {
        addOtherPlayers(self, players[id]);
      }
    });
  });
  
  this.socket.on('newPlayer', (playerInfo) => {
    addOtherPlayers(self, playerInfo);
  });
  
  this.socket.on('unconnect', (playerId) => {
    self.otherPlayers.getChildren().forEach((otherPlayer) => {
      if (playerId === otherPlayer.playerId) {
        otherPlayer.destroy();
      }
    });
  });

  this.socket.on('playerMoved', function (playerInfo) {
    self.otherPlayers.getChildren().forEach((otherPlayer) => {
      if (playerInfo.playerId === otherPlayer.playerId) {
        otherPlayer.setPosition(playerInfo.nodes[otherPlayer.nodeId].x, playerInfo.nodes[otherPlayer.nodeId].y);
      }
    });
  });

}

function update() {
  if (this.nodes.length > 0) {
    for (var i = 0; i < this.nodes.length; i++) {
      if (i == 0) {
        this.input.activePointer.updateWorldPoint(this.cameras.main);
        var angleToPointer = Phaser.Math.Angle.Between(this.nodes[i].x, this.nodes[i].y, this.input.activePointer.worldX, this.input.activePointer.worldY);
        var angleDelta = Phaser.Math.Angle.Wrap(angleToPointer - this.nodes[i].rotation);
        
        if (Phaser.Math.Within(angleDelta, 0, TOLERANCE)) {
          this.nodes[i].rotation = angleToPointer;
          this.nodes[i].body.setAngularVelocity(0);
        } else {
          this.nodes[i].body.setAngularVelocity(Math.sign(angleDelta) * ROTATION_SPEED_DEGREES);
        }

        var xDir = Math.cos(this.nodes[i].rotation);
        var yDir = Math.sin(this.nodes[i].rotation);
        this.nodes[i].x += xDir * SPEED;
        this.nodes[i].y += yDir * SPEED;

        for (var j = 0; j < SPEED; j++) {
          var part = this.path.pop();
          part.x = this.nodes[i].x + xDir;
          part.y = this.nodes[i].y + yDir;
          this.path.unshift(part);
        }
      } else {
        this.nodes[i].x = this.path[i * SPACING].x;
        this.nodes[i].y = this.path[i * SPACING].y;
      }
    }
    
    this.socket.emit('playerMovement', { nodes: this.nodes });
  }
}

function addPlayer(self, playerInfo) {
  for (var i = 0; i < playerInfo.nodes.length; i++) {
    self.nodes[i] = self.add.circle(playerInfo.nodes[i].x, playerInfo.nodes[i].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
    self.physics.add.existing(self.nodes[i]);
  };

  self.cameras.main.startFollow(self.nodes[0]);
  
  for (var i = 0; i <= playerInfo.nodes.length * SPACING; i++) {
    self.path[i] = { x: playerInfo.nodes[0].x - i, y: playerInfo.nodes[0].y };
  }
}

function addOtherPlayers(self, playerInfo) {
  for (var i = 0; i < playerInfo.nodes.length; i++) {
    var otherPlayer = self.add.circle(playerInfo.nodes[i].x, playerInfo.nodes[i].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
    self.physics.add.existing(otherPlayer);
    otherPlayer.playerId = playerInfo.playerId;
    otherPlayer.nodeId = i;
    self.otherPlayers.add(otherPlayer);
  }
}