const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

const socket = io("https://stickman-fighter.onrender.com/"); // Connect to server

let players = {};
let localPlayer = null;

function resizeCanvas() {
    const canvas = document.getElementById("gameCanvas");
    const gameContainer = document.querySelector(".game-container");
    
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight - document.querySelector(".game-info").offsetHeight;
    
    // Ensure the canvas takes full width and height below the game info
    canvas.style.width = '100%';
    canvas.style.height = '100%';
}

// Call on load and window resize
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
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
        this.x = x || (canvas.width * 0.1);  // 10% from left
        this.y = y || (canvas.height * 0.7); // 70% from top
        this.velX = 0;
        this.velY = 0;

        // Dimensions
        this.width = 50;
        this.height = 80;
        this.color = color;

        // Movement properties
        this.speed = 5;
        this.gravity = 0.5;
        this.jumpPower = -10;
        
        // State tracking
        this.onGround = false;
        this.facing = 1; // 1 for right, -1 for left
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
                this.facing = -1;
                break;
            case "right":
                this.velX = this.speed;
                this.facing = 1;
                break;
        }
    }

    jump() {
        // Allow second jump only if already in jumping state
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
        ctx.fillStyle = this.color;
        
        // Enhanced Head - larger and more defined
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + 20, 20, 0, Math.PI * 2);
        ctx.fill();

        // More expressive Eyes
        ctx.fillStyle = "white";
        const eyeX = this.x + this.width/2 + (10 * this.facing);
        const eyeY = this.y + 15;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Body - thicker and more pronounced
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 40);
        ctx.lineTo(this.x + this.width/2, this.y + 65);
        ctx.stroke();

        // Arms - longer and more dynamic
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 45);
        ctx.lineTo(this.x + this.width/2 - 30, this.y + 55);
        ctx.moveTo(this.x + this.width/2, this.y + 45);
        ctx.lineTo(this.x + this.width/2 + 30, this.y + 55);
        ctx.stroke();

        // Legs - more pronounced stance
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 65);
        ctx.lineTo(this.x + this.width/2 - 25, this.y + 90);
        ctx.moveTo(this.x + this.width/2, this.y + 65);
        ctx.lineTo(this.x + this.width/2 + 25, this.y + 90);
        ctx.stroke();
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

    // Basic combo system
    addCombo(move) {
        const currentTime = Date.now();
        
        // Reset combo if too much time has passed
        if (currentTime - this.lastComboTime > 1000) {
            this.currentCombo = [];
        }

        this.currentCombo.push(move);
        this.lastComboTime = currentTime;

        // Check for specific combos
        this.checkCombos();
    }

    checkCombos() {
        const comboString = this.currentCombo.join(',');
        
        switch(comboString) {
            case 'punch,punch':
                console.log("Double Punch Combo!");
                this.score += 10;
                break;
            case 'kick,punch':
                console.log("Punch-Kick Combo!");
                this.score += 15;
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
    if (localPlayer) {
        // Movement
        if (keys['a']) localPlayer.move("left");
        if (keys['d']) localPlayer.move("right");
        if (keys[' ']) localPlayer.jump();
        if (keys['shift']) localPlayer.airDash();

        localPlayer.update();

        socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing  // Add facing direction
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

// Server-side socket handling (pseudo-code)
socket.on('playerMove', (playerData) => {
    players[socket.id] = {
        x: playerData.x,
        y: playerData.y,
        health: playerData.health,
        score: playerData.score,
        facing: playerData.facing  // Store and broadcast facing direction
    };
    io.emit('updatePlayers', players);
});

update();