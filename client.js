const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

const socket = io(); // Connect to server

let players = {};
let localPlayer = null;

class Stickman {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 50;
        this.color = color;
        this.speed = 5;
        this.velY = 0;
        this.gravity = 0.5;
        this.jumpPower = -10;
        this.onGround = false;
    }

    move(direction) {
        if (direction === "left") this.x -= this.speed;
        if (direction === "right") this.x += this.speed;
    }

    jump() {
        if (this.onGround) {
            this.velY = this.jumpPower;
            this.onGround = false;
        }
    }

    update() {
        this.velY += this.gravity;
        this.y += this.velY;

        if (this.y >= canvas.height - this.height) {
            this.y = canvas.height - this.height;
            this.velY = 0;
            this.onGround = true;
        }
    }

    draw(isLocalPlayer = false) {
        ctx.fillStyle = isLocalPlayer ? this.color : "red";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// Handle input
let keys = {};
window.addEventListener("keydown", (e) => { keys[e.key] = true; });
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

function update() {
    if (localPlayer) {
        if (keys["ArrowLeft"]) localPlayer.move("left");
        if (keys["ArrowRight"]) localPlayer.move("right");
        if (keys["ArrowUp"]) localPlayer.jump();

        localPlayer.update();

        socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y 
        });
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw local player
    if (localPlayer) {
        localPlayer.draw(true);
    }

    // Draw other players
    for (let id in players) {
        if (id !== socket.id) {
            let otherPlayer = new Stickman(players[id].x, players[id].y, "red");
            otherPlayer.draw();
        }
    }

    requestAnimationFrame(update);
}

socket.on("connect", () => {
    // Initialize local player when connected
    localPlayer = new Stickman(100, 300, "blue");
});

socket.on("updatePlayers", (serverPlayers) => {
    players = serverPlayers;
});

update();