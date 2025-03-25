const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

const socket = io("https://stickman-fighter.onrender.com/"); // Connect to server

let players = {};
let localPlayer = null;

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
        this.width = 30;
        this.height = 50;
        this.color = color;

        // Movement properties
        this.speed = 5;
        this.gravity = 0.5;
        this.jumpPower = -10;
        
        // State tracking
        this.onGround = false;
        this.jumpsRemaining = 2;  // Double jump
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
                break;
            case "right":
                this.velX = this.speed;
                break;
        }
    }

    jump() {
        if (this.jumpsRemaining > 0) {
            this.velY = this.jumpPower;
            this.jumpsRemaining--;
            this.onGround = false;
        }
    }

    airDash() {
        if (this.canAirDash && !this.onGround) {
            const dashSpeed = 10;
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
            this.canAirDash = true;
        }

        // Screen boundaries
        this.x = Math.max(0, Math.min(this.x, canvas.width - this.width));
    }

    drawStickman() {
        ctx.fillStyle = this.color;
        
        // Head
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + 10, 10, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 20);
        ctx.lineTo(this.x + this.width/2, this.y + 40);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 25);
        ctx.lineTo(this.x + this.width/2 - 15, this.y + 30);
        ctx.moveTo(this.x + this.width/2, this.y + 25);
        ctx.lineTo(this.x + this.width/2 + 15, this.y + 30);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 40);
        ctx.lineTo(this.x + this.width/2 - 10, this.y + 50);
        ctx.moveTo(this.x + this.width/2, this.y + 40);
        ctx.lineTo(this.x + this.width/2 + 10, this.y + 50);
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
            score: localPlayer.score
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