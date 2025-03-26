const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const welcomeScreen = document.getElementById("welcomeScreen");
const mobileControlsContainer = document.getElementById("mobile-controls");

let players = {};
let localPlayer = null;
let isGameStarted = false;
let isMobile = window.innerWidth <= 768;


window.addEventListener("beforeunload", () => {
    window.socket.emit("playerInactive", { id: window.socket.id });
});

function resizeCanvas() {
    const gameContainer = document.querySelector(".game-container");
    const gameInfo = document.querySelector(".game-info");
    
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight - gameInfo.offsetHeight;
    
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Toggle mobile controls
    if (window.innerWidth <= 768) {
        isMobile = true;
        mobileControlsContainer.style.display = 'flex';
        setupMobileControls();
    } else {
        isMobile = false;
        mobileControlsContainer.style.display = 'none';
    }
}

function setupMobileControls() {
    const leftBtn = document.getElementById('mobile-left');
    const rightBtn = document.getElementById('mobile-right');
    const jumpBtn = document.getElementById('mobile-jump');
    const punchBtn = document.getElementById('mobile-punch');
    const kickBtn = document.getElementById('mobile-kick');

    // Touch event handlers
    function startMove(direction) {
        keys[direction] = true;
    }

    function stopMove(direction) {
        keys[direction] = false;
    }

    leftBtn.addEventListener('touchstart', () => startMove('a'), { passive: true });
    leftBtn.addEventListener('touchend', () => stopMove('a'), { passive: true });
    
    rightBtn.addEventListener('touchstart', () => startMove('d'), { passive: true });
    rightBtn.addEventListener('touchend', () => stopMove('d'), { passive: true });
    
    jumpBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.jump();
    }, { passive: true });
    
    punchBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.addCombo('punch');
    }, { passive: true });
    
    kickBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.addCombo('kick');
    }, { passive: true });

    // Optional: Add device orientation for mobile tilt controls
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

function handleOrientation(event) {
    if (!isMobile || !localPlayer) return;

    const beta = event.beta; // Front to back tilt
    const gamma = event.gamma; // Left to right tilt

    // Simple tilt-based movement
    if (gamma > 10) {
        localPlayer.move("right");
    } else if (gamma < -10) {
        localPlayer.move("left");
    }
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
        this.facing = 1; // 1 for right, -1 for left
        // Enhanced jump tracking
        this.maxJumps = 2;  // Maximum number of jumps
        this.jumpsRemaining = this.maxJumps;
        this.isGrounded = true;  // Clear grounded state
        this.jumpCooldown = 0;  // Prevent rapid jump spam
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
        // Debugging log
        console.log(`Jump attempted: Jumps Remaining: ${this.jumpsRemaining}, Grounded: ${this.isGrounded}, Cooldown: ${this.jumpCooldown}`);

        // Prevent multiple rapid jumps
        if (this.jumpCooldown > 0) return;

        // Check if we have jumps available
        if (this.jumpsRemaining > 0) {
            // Apply jump velocity
            this.velY = this.jumpPower;
            
            // Decrement jumps
            this.jumpsRemaining--;
            
            // Not grounded anymore
            this.isGrounded = false;
            this.canAirDash = true;
            
            // Set cooldown to prevent spam
            this.jumpCooldown = 10;
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
        // Reduce jump cooldown
        if (this.jumpCooldown > 0) {
            this.jumpCooldown--;
        }

        // Ground collision
        if (this.y + this.height >= canvas.height -50 ) {
            this.y = canvas.height - this.height -50 ;
            this.velY = 0;
            // Reset to grounded state
            this.isGrounded = true;
            this.jumpsRemaining = this.maxJumps;
            this.jumpCooldown = 0;
            this.canAirDash = false;
        }
        const wallWidth = 20; // Width of invisible walls
        
        // Left wall
        if (this.x < wallWidth) {
            this.x = wallWidth;
            this.velX = 0;
        }
        
        // Right wall
        if (this.x > canvas.width - this.width - wallWidth) {
            this.x = canvas.width - this.width - wallWidth;
            this.velX = 0;
        }

        // Screen boundaries
    }

    // Method to draw wall boundaries (for visual debugging)
    drawWalls() {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)'; // Semi-transparent red
        
        // Left wall
        ctx.fillRect(0, 0, 20, canvas.height);
        
        // Right wall
        ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);
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
        // Draw health and score for local player
        this.drawStickman();
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
            if (id !== window.socket.id) { // Don't hit yourself
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
    
            window.socket.emit("updateHealth", { id: target.id, health: target.health });
        }
    }

    kick() {
        console.log("Kick!");
        this.score += 5;
    
        let target = this.findOpponent();
        if (target) {
            target.health -= 5;
            console.log(`Kick opponent! New health: ${target.health}`);
    
            window.socket.emit("updateHealth", { id: target.id, health: target.health });
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
        if (target === null) return;
        switch(comboString) {
            case 'punch,punch':
                console.log("Double Punch Combo!");
                if (target) {
                    target.health -= 15;
                    console.log(`punch-punch opponent! New health: ${target.health}`);
            
                    window.socket.emit("updateHealth", { id: target.id, health: target.health });
                }
                break;
            case 'kick,punch':
                console.log("Punch-Kick Combo!");
                if (target) {
                    target.health -= 20;
                    console.log(`Kick-punch opponent! New health: ${target.health}`);
            
                    window.socket.emit("updateHealth", { id: target.id, health: target.health });
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

    else if (localPlayer) {
        // Movement logic
        if (keys['a']) localPlayer.move("left");
        if (keys['d']) localPlayer.move("right");
        if (keys[' ']) localPlayer.jump();
        if (keys['shift']) localPlayer.airDash();
        if (keys['j']) localPlayer.punch();
        if (keys['k']) localPlayer.kick();

        localPlayer.update();

        window.socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing,
            isGameStarted: true
        });
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill ground
    ctx.fillStyle = '#8B4513';  // Earthy brown color
    ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    
    // Optional: add a slightly darker border
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 34);
    ctx.lineTo(canvas.width, canvas.height - 34);
    ctx.strokeStyle = '#5D3A1A';  // Darker brown for border
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw local player
    if (localPlayer && isGameStarted) {
        localPlayer.draw(true);
    }

    // Draw other players
    
        for (let id in players) {
            if (id !== window.socket.id && players[id].isGameStarted) {
                console.log(window.socket.id);
                let otherPlayer = new Stickman(1400, players[id].y, "red");
                otherPlayer.facing = -players[id].facing;
                otherPlayer.draw();
            }
        }

    requestAnimationFrame(update);
}

startButton.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    resizeCanvas();
    isGameStarted = true;
    window.socket = io("https://stickman-fighter.onrender.com"); // Connect to server

    window.socket.on("connect", () => {
        // Create local player with initial position
        localPlayer = new Stickman(100, canvas.height - 150, "blue");
        
        // Emit player move with game started flag
        window.socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing,
            isGameStarted: true
        });
    });
    
    window.socket.on("updatePlayers", (serverPlayers) => {
        players = serverPlayers;
    });
    window.socket.on("disconnect", (id) => {
        delete players[id];
    });
});

// Reduce console logging
console.log = function() {};

update();