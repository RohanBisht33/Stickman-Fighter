const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('usernameInput');
    const usernameError = document.getElementById('usernameError');
    const startButton = document.getElementById("startButton");
});
const welcomeScreen = document.getElementById("welcomeScreen");
const mobileControlsContainer = document.getElementById("mobile-controls");

let players = {};
let localPlayer = null;
let isGameStarted = false;
let isMobile = window.innerWidth <= 768;

function validateUsername() {
    const username = usernameInput.value.trim();
    
    // Clear previous error
    usernameError.textContent = '';
    
    // Validation rules
    if (username.length === 0) {
        usernameError.textContent = 'Please enter a username';
        return false;
    }
    
    if (username.length < 3) {
        usernameError.textContent = 'Username must be at least 3 characters';
        return false;
    }
    
    if (username.length > 12) {
        usernameError.textContent = 'Username must be 12 characters or less';
        return false;
    }
    
    // Optional: Check for valid characters
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(username)) {
        usernameError.textContent = 'Username can only contain letters, numbers, and underscores';
        return false;
    }
    
    return true;
}

// Real-time validation
usernameInput.addEventListener('input', validateUsername);


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

    // Prevent default touch behaviors
    [leftBtn, rightBtn, jumpBtn, punchBtn, kickBtn].forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default touch actions
        }, { passive: false });
    });

    // Touch event handlers with improved control
    function startMove(direction) {
        keys[direction] = true;
        // Optional: Add visual feedback
        document.getElementById(`mobile-${direction}`).classList.add('active');
    }

    function stopMove(direction) {
        keys[direction] = false;
        // Remove visual feedback
        document.getElementById(`mobile-${direction}`).classList.remove('active');
    }

    // Directional controls
    leftBtn.addEventListener('touchstart', () => startMove('a'), { passive: false });
    leftBtn.addEventListener('touchend', () => stopMove('a'), { passive: false });
    leftBtn.addEventListener('touchcancel', () => stopMove('a'), { passive: false });
    
    rightBtn.addEventListener('touchstart', () => startMove('d'), { passive: false });
    rightBtn.addEventListener('touchend', () => stopMove('d'), { passive: false });
    rightBtn.addEventListener('touchcancel', () => stopMove('d'), { passive: false });
    
    // Action buttons
    jumpBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.jump();
    }, { passive: false });
    
    punchBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.punch();
    }, { passive: false });
    
    kickBtn.addEventListener('touchstart', () => {
        if (localPlayer) localPlayer.kick();
    }, { passive: false });
}

// Add CSS for active state
const activeButtonStyle = `
.mobile-btn.active {
    background-color: #45a049;
    transform: scale(0.95);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = activeButtonStyle;
document.head.appendChild(styleSheet);

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
        this.spacePressed = false;
        
        // Combat properties
        this.health = 100;
        this.score = 0;
        
        // Animation and combo
        this.lastPunchTime = 0;
        this.lastKickTime = 0;


        this.currentCombo = [];
        this.lastComboTime = 0;
    }

    die() {
        // Reset to welcome screen
        welcomeScreen.style.display = 'block';
        isGameStarted = false;
        window.socket.disconnect();
        
        // Reset local player
        localPlayer = null;
        players = {};
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
        // Reset cooldown if key is released
        if (this.jumpCooldown > 0) {
            this.jumpCooldown--;
        }
    
        // Allow jump only when key is first pressed, not held
        if (keys[' '] && this.jumpsRemaining > 0 && this.jumpCooldown === 0) {
            this.velY = this.jumpPower;
            this.jumpsRemaining--;
            this.isGrounded = false;
            this.canAirDash = true;
            this.jumpCooldown = 10;
            keys[' '] = false; // Prevent continuous jumping
        }
        
        // Reset jump when player lands
        if (this.isGrounded) {
            this.jumpsRemaining = this.maxJumps;
            this.jumpCooldown = 0;
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
        if (this.health <= 0) {
            this.die();
        }
        // Screen boundaries
        for (let id in players) {
            if (id !== window.socket.id) {
                let enemy = players[id];
                
                // Check for horizontal collision
                if (Math.abs(this.x - enemy.x) < this.width) {
                    // Prevent horizontal overlap
                    if (this.x < enemy.x) {
                        this.x = enemy.x - this.width;
                    } else {
                        this.x = enemy.x + this.width;
                    }
                    this.velX = 0;
                }
                
                // Vertical collision prevention
                if (this.y + this.height > enemy.y && 
                    this.y < enemy.y + enemy.height &&
                    Math.abs(this.x - enemy.x) < this.width) {
                    // Push players apart vertically
                    if (this.y < enemy.y) {
                        this.y = enemy.y - this.height;
                    } else {
                        this.y = enemy.y + enemy.height;
                    }
                    this.velY = 0;
                }
            }
        }
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
    
    drawUsername() {
        if (this.username) {
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.username, this.x + this.width/2, this.y - 10);
        }
    }
    
    // Modify draw method to include username
    draw(isLocalPlayer = false) {
        this.drawStickman();
        this.drawUsername(); // Add username above stickman
        
        if (isLocalPlayer) {
            this.updateHealthDisplay();
            this.updateScoreDisplay();
        }
    }

    updateHealthDisplay = updateHealthDisplay;
    updateScoreDisplay = updateScoreDisplay;

    findOpponent() {
        let closest = null;
        let minDistance = 100;  // Increased attack range for more precise hit detection
        let maxDistance = 200;  // Maximum distance for attack
    
        for (let id in players) {
            if (id !== window.socket.id) { // Don't hit yourself
                let opponent = players[id];
                let distance = Math.abs(this.x - opponent.x);
    
                // Check if opponent is in the correct facing direction and within range
                if (distance < maxDistance && 
                    ((this.facing === 1 && opponent.x > this.x) || 
                     (this.facing === -1 && opponent.x < this.x))) {
                    closest = opponent;
                    break;
                }
            }
        }
        return closest;
    }
    
    punch() {
        // Prevent continuous damage by tracking last punch time
        const currentTime = Date.now();
        if (this.lastPunchTime && currentTime - this.lastPunchTime < 500) return;
        
        console.log("Punch!");
        let target = this.findOpponent();
        if (target) {
            target.health -= 10;
            this.score += 5;
            this.lastPunchTime = currentTime;
            
            console.log(`Punch opponent! New health: ${target.health}`);
            window.socket.emit("updateHealth", { id: target.id, health: target.health });
        }
    }
    
    kick() {
        // Prevent continuous damage by tracking last kick time
        const currentTime = Date.now();
        if (this.lastKickTime && currentTime - this.lastKickTime < 500) return;
        
        console.log("Kick!");
        let target = this.findOpponent();
        if (target) {
            target.health -= 15;
            this.score += 5;
            this.lastKickTime = currentTime;
            
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

function checkCollision(player, enemy) {
    return (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
    );
}

function update() {
    if (!isGameStarted) {
        requestAnimationFrame(update);
        return;
    }
    if (localPlayer) {
        let canMoveLeft = true;
        let canMoveRight = true;
        for (let id in players) {
            if (id !== window.socket.id && players[id].isGameStarted) {
                let enemy = players[id];
                let mirroredX = (canvas.width - enemy.x) - localPlayer.width;

                if (checkCollision(localPlayer, { x: mirroredX, y: enemy.y, width: 100, height: 100 })) {
                    if (localPlayer.x < mirroredX) {
                        canMoveRight = false; // Block right movement
                    } else {
                        canMoveLeft = false; // Block left movement
                    }
                }
            }
        }
        // Movement logic
        if (keys['a'] && canMoveLeft) localPlayer.move("left");
        if (keys['d'] && canMoveRight) localPlayer.move("right");
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
                let enemy = players[id];
                let mirroredX = (canvas.width - enemy.x) - localPlayer.width;

                let otherPlayer = new Stickman(mirroredX, enemy.y, "red");
                otherPlayer.facing = -enemy.facing;
                otherPlayer.velX = -enemy.velX;
                otherPlayer.draw();
            }
        }

    requestAnimationFrame(update);
}

startButton.addEventListener('click', () => {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    if (!validateUsername()) {
        e.preventDefault();
        return;
    }
    welcomeScreen.style.display = 'none';
    resizeCanvas();
    isGameStarted = true;
    window.socket = io("https://stickman-fighter.onrender.com"); // Connect to server

    window.socket.on("connect", () => {
        // Create local player with initial position
        localPlayer = new Stickman(100, canvas.height - 150, "blue");
        localPlayer.username = username; // Add username to player
        
        // Emit player move with game started flag
        window.socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing,
            username: username,
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