const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const welcomeScreen = document.getElementById("welcomeScreen");

const socket = io("https://stickman-fighter.onrender.com/"); // Connect to server

window.addEventListener("beforeunload", () => {
    socket.emit("playerInactive", { id: socket.id });
});

let players = {};
let localPlayer = null;
let isGameStarted = false;

function resizeCanvas() {
    const gameContainer = document.querySelector(".game-container");
    const gameInfo = document.querySelector(".game-info");
    
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight - gameInfo.offsetHeight;
    
    canvas.style.width = '100%';
    canvas.style.height = '100%';
}

// Call on load and window resize
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// Start game event listener
startButton.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    resizeCanvas();
    isGameStarted = true;
});

function updateHealthDisplay() {
    const healthFill = document.getElementById('localHealth');
    if (healthFill) {
        healthFill.style.width = `${this.health}%`;
        healthFill.textContent = `${this.health}%`;
        
        // Change color based on health
        if (this.health > 70) {
            healthFill.style.backgroundColor = '#4CAF50';
        } else if (this.health > 30) {
            healthFill.style.backgroundColor = '#FFC107';
        } else {
            healthFill.style.backgroundColor = '#F44336';
        }
    }
}

function updateScoreDisplay() {
    const scoreElement = document.getElementById('localScore');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${this.score}`;
    }
}

class Stickman {
    constructor(x, y, color) {
        // Position and movement
        this.x = x;
        this.y = y;
        this.velX = 0;
        this.velY = 0;

        // Dimensions
        this.width = 100;
        this.height = 100;
        this.color = color;

        // Movement properties
        this.speed = 5;
        this.gravity = 0.5;
        this.jumpPower = -10;
        
        // State tracking
        this.onGround = false;
        this.facing = -1; // 1 for right, -1 for left
        this.jumpsRemaining = 2;  // Double jump
        this.isJumping = false;
        this.canAirDash = true;
        
        // Combat properties
        this.health = 100;
        this.score = 0;
        
        // Animation and combo
        this.currentCombo = [];
        this.lastComboTime = 0;
    }

    move(direction) {
        switch(direction) {
            case "left":
                this.velX = -this.speed;
                this.facing = 1;
                break;
            case "right":
                this.velX = this.speed;
                this.facing = -1;
                break;
        }
    }

    jump() {
        if (this.jumpsRemaining > 0) {
            this.velY = this.jumpPower;
            this.jumpsRemaining--;
            this.onGround = false;
            this.isJumping = true;
        }
    }

    airDash() {
        if (this.canAirDash && !this.onGround) {
            const dashSpeed = 20;
            this.velX = this.velX > 0 ? dashSpeed : -dashSpeed;
            this.canAirDash = false;
        }
    }

    update() {
        // Horizontal movement
        this.x += this.velX;
        this.velX *= 0.8;  // Friction

        // Vertical movement
        this.velY += this.gravity;
        this.y += this.velY;

        // Ground collision
        if (this.y >= canvas.height - this.height) {
            this.y = canvas.height - this.height;
            this.velY = 0;
            this.onGround = true;
            this.jumpsRemaining = 2;
            this.isJumping = false;
            this.canAirDash = true;
        }

        // Screen boundaries
        this.x = Math.max(0, Math.min(this.x, canvas.width - this.width));
    }

    drawStickman() {
        const scaleX = this.width / 50;  // Default width was 50
        const scaleY = this.height / 80; // Default height was 80
    
        ctx.save();  
        ctx.translate(this.x, this.y);  
        ctx.scale(scaleX, scaleY);  
    
        ctx.fillStyle = this.color;
    
        // Head
        ctx.beginPath();
        ctx.arc(25, 20, 20, 0, Math.PI * 2);  // (Centered at 25, 20)
        ctx.fill();
    
        // Eyes
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(25 + (10 * (this.facing)), 15, 5, 0, Math.PI * 2);
        ctx.fill();
    
        // Pupil
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(25 + (10 * (this.facing)), 15, 2, 0, Math.PI * 2);
        ctx.fill();
    
        // Body
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(25, 40);
        ctx.lineTo(25, 65);
        ctx.stroke();
    
        // Arms
        ctx.beginPath();
        ctx.moveTo(25, 45);
        ctx.lineTo(25 - 30, 55);
        ctx.moveTo(25, 45);
        ctx.lineTo(25 + 30, 55);
        ctx.stroke();
    
        // Legs
        ctx.beginPath();
        ctx.moveTo(25, 65);
        ctx.lineTo(25 - 25, 90);
        ctx.moveTo(25, 65);
        ctx.lineTo(25 + 25, 90);
        ctx.stroke();
    
        ctx.restore();
    }

    draw(isLocalPlayer = false) {
        this.drawStickman();
        
        // Draw health and score for local player
        if (isLocalPlayer) {
            this.updateHealthDisplay();
            this.updateScoreDisplay();
        }
    }

    updateHealthDisplay = updateHealthDisplay;
    updateScoreDisplay = updateScoreDisplay;

    findOpponent() {
        let closest = null;
        let minDistance = 50;  // Adjust attack range
    
        for (let id in players) {
            if (id !== socket.id) { // Don't hit yourself
                let opponent = players[id];
                let distance = Math.abs(this.x - opponent.x);
    
                if (distance < minDistance) {
                    closest = opponent;
                    minDistance = distance;
                }
            }
        }
        return closest;
    }    

    punch() {
        console.log("Punch!");
        this.score += 5;
    
        let target = this.findOpponent();
        if (target) {
            target.health -= 5;
            console.log(`Punch opponent! New health: ${target.health}`);
    
            socket.emit("updateHealth", { id: target.id, health: target.health });
        }
    }

    kick() {
        console.log("Kick!");
        this.score += 5;
    
        let target = this.findOpponent();
        if (target) {
            target.health -= 5;
            console.log(`Kick opponent! New health: ${target.health}`);
    
            socket.emit("updateHealth", { id: target.id, health: target.health });
        }
    }

    addCombo(move) {
        const currentTime = Date.now();
        
        // Reset combo if too much time has passed
        if (currentTime - this.lastComboTime > 800) {
            this.currentCombo = [];
        }

        this.currentCombo.push(move);
        this.lastComboTime = currentTime;

        // Check for specific combos
        this.checkCombos();
    }

    checkCombos() {
        const comboString = this.currentCombo.join(',');
        let target = this.findOpponent();
        switch(comboString) {
            case 'punch,punch':
                console.log("Double Punch Combo!");
                if (target) {
                    target.health -= 15;
                    console.log(`punch-punch opponent! New health: ${target.health}`);
            
                    socket.emit("updateHealth", { id: target.id, health: target.health });
                }
                break;
            case 'kick,punch':
                console.log("Punch-Kick Combo!");
                if (target) {
                    target.health -= 20;
                    console.log(`Kick-punch opponent! New health: ${target.health}`);
            
                    socket.emit("updateHealth", { id: target.id, health: target.health });
                }
                break;
        }

        // Limit combo length
        if (this.currentCombo.length > 3) {
            this.currentCombo.shift();
        }
    }
}

// Handle input
let keys = {};
window.addEventListener("keydown", (e) => { 
    if (!isGameStarted) return; // Prevent input before game starts

    keys[e.key.toLowerCase()] = true;
    
    // Combo input
    if (localPlayer) {
        switch(e.key.toLowerCase()) {
            case 'j': localPlayer.addCombo('punch'); break;
            case 'k': localPlayer.addCombo('kick'); break;
        }
    }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function update() {
    if (!isGameStarted) {
        requestAnimationFrame(update);
        return;
    }

    if (localPlayer) {
        // Movement logic
        if (keys['a']) localPlayer.move("left");
        if (keys['d']) localPlayer.move("right");
        if (keys[' ']) localPlayer.jump();
        if (keys['shift']) localPlayer.airDash();
        if (keys['j']) localPlayer.punch();
        if (keys['k']) localPlayer.kick();

        localPlayer.update();

        socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing
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
            // Use server-provided facing direction
            otherPlayer.facing = players[id].facing || 1;
            otherPlayer.draw();
        }
    }

    requestAnimationFrame(update);
}

socket.on("connect", () => {
    // Create local player with initial position
    localPlayer = new Stickman(100, canvas.height - 150, "blue");
});

socket.on("updatePlayers", (serverPlayers) => {
    players = serverPlayers;
    delete players[socket.id]; // Remove local player from the list
});

// Reduce console logging
console.log = function() {};

update();