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

var SPEED = 100;
var ROTATION_SPEED = 1 * Math.PI;
var ROTATION_SPEED_DEGREES = Phaser.Math.RadToDeg(ROTATION_SPEED);
var TOLERANCE = 0.05 * ROTATION_SPEED;
var PLAYER_SIZE = 20;
var SECTION_SPACING = 10;

var velocityFromRotation = Phaser.Physics.Arcade.ArcadePhysics.prototype.velocityFromRotation;

function preload() {
  this.load.image('background', 'assets/background.jpg')
}

function create() {
  this.add.image(400, 300, 'background');
  var self = this;
  this.socket = io();
  this.otherPlayers = this.physics.add.group();
  this.section = [];
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
        if (otherPlayer.sectionId == -1) {
          otherPlayer.setPosition(playerInfo.head.x, playerInfo.head.y);
        } else {
          otherPlayer.setPosition(playerInfo.section[otherPlayer.sectionId].x, playerInfo.section[otherPlayer.sectionId].y);
        }
      }
    });
  });

}

function update() {
  if (this.head) {
    this.input.activePointer.updateWorldPoint(this.cameras.main);
    var angleToPointer = Phaser.Math.Angle.Between(this.head.x, this.head.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
    var angleDelta = Phaser.Math.Angle.Wrap(angleToPointer - this.head.rotation);
    
    if (Phaser.Math.Within(angleDelta, 0, TOLERANCE)) {
      this.head.rotation = angleToPointer;
      this.head.body.setAngularVelocity(0);
    } else {
      this.head.body.setAngularVelocity(Math.sign(angleDelta) * ROTATION_SPEED_DEGREES);
    }
    
    velocityFromRotation(this.head.rotation, SPEED, this.head.body.velocity);
    
    this.socket.emit('playerMovement', { x: this.head.x, y: this.head.y, section: this.section });
    
    var part = this.path.pop();
    part.x = this.head.x
    part.y = this.head.y;
    this.path.unshift(part);
    for (var i = 0; i < this.section.length; i++) {
      this.section[i].x = this.path[i * SECTION_SPACING].x;
      this.section[i].y = this.path[i * SECTION_SPACING].y;
    }

    this.physics.add.collider(this.head, this.otherPlayers, (head, otherPlayer) => {
      this.socket.emit('gameOver');
    });
  }
}

function addPlayer(self, playerInfo) {
  self.cameras.main.startFollow(self.head);
  
  for (var i = 0; i < playerInfo.section.length; i++) {
    self.section[i] = self.add.circle(playerInfo.section[i].x, playerInfo.section[i].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
  };
  
  for (var i = 0; i <= playerInfo.section.length * SECTION_SPACING; i++) {
    self.path[i] = {x: playerInfo.head.x, y: playerInfo.head.y};
  }
}

function addOtherPlayers(self, playerInfo) {
  var otherHead = self.add.circle(playerInfo.head.x, playerInfo.head.y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
  self.physics.add.existing(otherHead);
  otherHead.playerId = playerInfo.playerId;
  otherHead.sectionId = -1;
  self.otherPlayers.add(otherHead);
  
  for (var i = 0; i < playerInfo.section.length; i++) {
    var otherSection = self.add.circle(playerInfo.section[i].x, playerInfo.section[i].y, PLAYER_SIZE, Phaser.Display.Color.HexStringToColor(playerInfo.color).color);
    self.physics.add.existing(otherSection);
    otherSection.playerId = playerInfo.playerId;
    otherSection.sectionId = i;
    self.otherPlayers.add(otherSection);
  };
}