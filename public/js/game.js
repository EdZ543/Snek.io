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
var NOM_SIZE = 10;
var WORLD_SIZE = 5000;

function preload() {
  this.load.image('background', 'assets/background.jpg')
}

function create() {
  background = this.add.tileSprite(0, 0, WORLD_SIZE, WORLD_SIZE, 'background').setOrigin(0.5, 0.5);

  var self = this;
  this.socket = io();
  this.otherPlayers = this.physics.add.group();
  this.noms = this.physics.add.group();
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
    for (var i = 0; i < self.otherPlayers.getChildren().length; i++) {
      if (playerId === self.otherPlayers.getChildren()[i].playerId) {
        self.otherPlayers.getChildren()[i].destroy();
        i--;
      }
    }
  });

  this.socket.on('playerMoved', function (playerInfo) {
    self.otherPlayers.getChildren().forEach((otherPlayer) => {
      if (playerInfo.playerId === otherPlayer.playerId) {
        otherPlayer.setPosition(playerInfo.nodes[otherPlayer.nodeId].x, playerInfo.nodes[otherPlayer.nodeId].y);
      }
    });
    console.log(self.otherPlayers.getChildren().length);
  });

  this.socket.on('scoreUpdate', (playerInfo) => {
  });

  this.socket.on('playerGrowed', (playerInfo) => {
    growOtherPlayer(self, playerInfo);
  });
  
  this.socket.on('nomCollection', (nomPos) => {
    for (var i = 0; i < self.noms.getChildren().length; i++) {
      if (nomPos.x === self.noms.getChildren()[i].x && nomPos.y === self.noms.getChildren()[i].y) {
        self.noms.getChildren()[i].destroy();
        i--;
      }
    }
  });
  
  this.socket.on('nomLocations', (noms) => {
    for (var i = 0; i < noms.length; i++) {
      var nom = self.add.circle(noms[i].x, noms[i].y, NOM_SIZE, Phaser.Display.Color.GetColor(255, 255, 255));
      self.physics.add.existing(nom);
      self.noms.add(nom);
    }
    this.physics.add.collider(this.nodes[0], this.noms, (node, nom) => {
      growPlayer(self);
      var nomPos = { x: nom.x, y: nom.y };
      this.socket.emit('nomCollected', nomPos);
      this.socket.emit('playerGrow', { x: this.nodes[this.nodes.length - 1].x, y: this.nodes[this.nodes.length - 1].y });
      nom.destroy();
    });
  })

  this.input.on('pointerdown', function (pointer) {
    if (SPEED == 5) {
      SPEED = 0;
    } else {
      SPEED = 5;
    }
  }, this);
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

    this.physics.add.collider(this.nodes[0], this.otherPlayers, () => {
      gameOver(this);
    });

    if (this.nodes[0].x - PLAYER_SIZE < -WORLD_SIZE/2 || this.nodes[0].x + PLAYER_SIZE > WORLD_SIZE/2 || this.nodes[0].y - PLAYER_SIZE < -WORLD_SIZE/2 || this.nodes[0].y + PLAYER_SIZE > WORLD_SIZE/2) {
      gameOver(this);
    }
  }

}

function addPlayer(self, playerInfo) {
  for (var i = 0; i < playerInfo.nodes.length; i++) {
    self.nodes[i] = self.add.circle(playerInfo.nodes[i].x, playerInfo.nodes[i].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
    if (i == 0) {
      self.physics.add.existing(self.nodes[i]);
    }
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

function gameOver(self) {
  self.cameras.main.stopFollow();
  for (var i = 0; i <self.nodes.length; i++) {
    self.nodes[i].setVisible(false);
  }
  self.nodes[0].body.checkCollision.none = true;
  self.socket.emit('playerDed')
}

function growPlayer(self) {
  self.nodes.push(self.add.circle(self.nodes[self.nodes.length - 1].x, self.nodes[self.nodes.length - 1].y, PLAYER_SIZE, self.nodes[self.nodes.length - 1].fillColor));
  for (var i = 0; i < SPACING; i++) {
    self.path.push({ x: self.nodes[self.nodes.length - 1].x - i, y: self.nodes[self.nodes.length - 1].y });
  }
}

function growOtherPlayer(self, playerInfo) {
  var otherNode = self.add.circle(playerInfo.nodes[playerInfo.nodes.length - 1].x, playerInfo.nodes[playerInfo.nodes.length - 1].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
  self.physics.add.existing(otherNode);
  otherNode.playerId = playerInfo.playerId;
  otherNode.nodeId = playerInfo.nodes.length - 1;
  self.otherPlayers.add(otherNode);
}