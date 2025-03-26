const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('usernameInput');
    const usernameError = document.getElementById('usernameError');
    const startButton = document.getElementById("startButton");
});
const welcomeScreen = document.getElementById("welcomeScreen");

let players = {};
let localPlayer = null;
let isGameStarted = false;

//animation now
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
        this.isColliding = false;
        // Enhanced jump tracking
        this.maxJumps = 2;  // Maximum number of jumps
        this.jumpsRemaining = this.maxJumps;
        this.isGrounded = true;  // Clear grounded state
        this.jumpCooldown = 0;  // Prevent rapid jump spam
        this.canAirDash = true;
        this.spacePressed = false;
        
        //dash
        this.dashCooldown = 0;
        this.canDash = true; // Allow dash only when grounded
        this.dashDuration = 1; // Frames of dash
        this.isDashing = false;
        this.dashKeyHoldTime = 0;
        this.dashKeyThreshold = 100;
        
        // Combat properties
        this.health = 100;
        this.score = 0;
        this.username = "";
        
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
            this.canDash = false;
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
    Dash() {
        if (this.canDash && !this.isDashing && this.dashCooldown === 0) {
            const dashSpeed = 80;
            this.velX = this.facing * dashSpeed;
            this.isDashing = true;
            this.dashDuration = 10; // 10 frames of dash
            this.canDash = false;
        }
    }

    update() {

        if (keys['q']) {
            this.dashKeyHoldTime++;
        } else {
            this.dashKeyHoldTime = 0;
        }

        // Dash activation after holding key for specified duration
        if (this.dashKeyHoldTime >= this.dashKeyThreshold && this.canDash) {
            this.Dash();
            this.dashKeyHoldTime = 0; // Reset hold time
        }

        // Dash cooldown and duration management
        if (this.isDashing) {
            this.dashDuration--;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
                this.canDash = false;
                this.dashCooldown = 120; // 2 seconds cooldown at 30 fps
            }
        }

        // Cooldown management
        if (this.dashCooldown > 0) {
            this.dashCooldown--;
        }

        // Reset dash ability when grounded
        if (this.isGrounded) {
            this.canDash = true;
        }
        // Horizontal movement
        this.x += this.velX;
    
        // Wall collision with immediate bounce
        const wallWidth = 20; // Width of invisible walls
        const bounceStrength = 10; // Stronger bounce to be noticeable
    

        // Left wall bounce
        if (this.x < wallWidth && !this.isGrounded) {
            this.x = wallWidth;
            // Immediately reverse and amplify horizontal velocity
            this.velX = Math.abs(this.velX) * bounceStrength;
        }
        else if(this.x < wallWidth && this.isGrounded){
            this.x = wallWidth;
        }

        
        // Right wall bounce
        if (this.x > canvas.width - this.width - wallWidth && !this.isGrounded) {
            this.x = canvas.width - this.width - wallWidth;
            // Immediately reverse and amplify horizontal velocity
            this.velX = -Math.abs(this.velX) * bounceStrength;
        }
        else if(this.x > canvas.width - this.width - wallWidth && this.isGrounded){
            //this.x = wallWidth; for teleportation purposes
            this.x = canvas.width - this.width - wallWidth;
        }

        // Friction (apply after bounce to maintain bounce effect)
        this.velX *= 0.8;

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
            this.canDash = true;
            this.canAirDash = false;
        }
        
        if (this.health <= 0) {
            this.die();
        }
        // Screen boundaries
        for (let id in players) {
            if (id !== window.socket.id) {
                let enemy = players[id];
                let mirroredX = (canvas.width - enemy.x) - this.width;
                
                let enemyStickman = new Stickman(mirroredX, enemy.y, "red");
                
                // Only log collision, no movement restriction
                if (this.isColliding) {
                    // Collision detected, check for attack inputs
                    if (keys['j']) {
                        this.punch();
                    }
                    if (keys['k']) {
                        this.kick();
                    }
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
            ctx.fillStyle = 'yellow'; // More visible color
            ctx.font = '16px Arial'; // Larger font
            ctx.textAlign = 'center';
            ctx.fillText(this.username, this.x + this.width/2, this.y - 20); // Moved up a bit
        }
    }
    
    // Modify draw method to include username
    draw(isLocalPlayer = false) {
        if (this.isDashing) {
            ctx.globalAlpha = 0.3; // Make slightly transparent when dashing
        }
        this.drawUsername(); // Add username above stickman
        this.drawStickman();

        ctx.globalAlpha = 1;
        if (isLocalPlayer) {
            this.updateHealthDisplay();
            this.updateScoreDisplay();
        }
    }

    updateHealthDisplay = updateHealthDisplay;
    updateScoreDisplay = updateScoreDisplay;

    
    punch() {
        for (let id in players) {
            if (id !== window.socket.id) {
                players[id].health -= 10;
                players[id].score += 10;
                window.socket.emit("updateHealth", { id: id, health: players[id].health });
            }
        }
    }
    
    kick() {
        for (let id in players) {
            if (id !== window.socket.id) {
                players[id].health -= 10;
                players[id].score += 10;
                window.socket.emit("updateHealth", { id: id, health: players[id].health });
            }
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
document.addEventListener('DOMContentLoaded', () => {
    // Ensure keys object exists
    let keys = {};

    // Wrap event listeners to ensure they're only added after DOM is loaded
    window.addEventListener("keydown", (e) => { 
        if (!isGameStarted) return; // Prevent input before game starts

        // Safely handle key input
        const key = e.key ? e.key.toLowerCase() : '';
        keys[key] = true;

        // Combo input with null check
        if (localPlayer.isColliding) {
            switch(key) {
                case 'j': 
                    localPlayer.punch();
                    localPlayer.addCombo('punch');
                    break;
                case 'k': 
                    localPlayer.kick();
                    localPlayer.addCombo('kick');
                    break;
            }
        }
    });

    window.addEventListener("keyup", (e) => { 
        const key = e.key ? e.key.toLowerCase() : '';
        keys[key] = false; 
    });

    // Expose keys to global scope if needed
    window.keys = keys;
});

function checkCollision(player1, player2) {
    const hitboxReduction = 0.6; // Reduce hitbox size for more precise collision
    return (
        player1.x < player2.x + player2.width * hitboxReduction &&
        player1.x + player1.width * hitboxReduction > player2.x &&
        player1.y < player2.y + player2.height * hitboxReduction &&
        player1.y + player1.height * hitboxReduction > player2.y
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
                        localPlayer.isColliding = true;
                        canMoveRight = false; // Block right movement
                    } else if(localPlayer.x > mirroredX) {
                        localPlayer.isColliding = true;
                        canMoveLeft = false; // Block left movement
                    }
                    else if(localPlayer.x === mirroredX){
                        localPlayer.isColliding = true;
                        canMoveLeft = false;
                        canMoveRight = false;
                    }
                    else {
                        localPlayer.isColliding = false;
                    }
                }
            }
        }
        // Movement logic
        if (keys['a'] && canMoveLeft) localPlayer.move("left");
        if (keys['d'] && canMoveRight) localPlayer.move("right");
        if (keys[' ']) localPlayer.jump();
        if (keys['shift']) localPlayer.airDash();

        localPlayer.update();

        window.socket.emit("playerMove", { 
            x: localPlayer.x, 
            y: localPlayer.y,
            health: localPlayer.health,
            score: localPlayer.score,
            facing: localPlayer.facing,
            username: localPlayer.username,
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
                let normalizedY = (enemy.y / 475) * canvas.height; // Assuming 800 is the default height
                let otherPlayer = new Stickman(mirroredX, normalizedY, "red");

                otherPlayer.facing = -enemy.facing;
                otherPlayer.velX = -enemy.velX;

                otherPlayer.username = enemy.username;
                otherPlayer.draw();
            }
        }

    requestAnimationFrame(update);
}
    startButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        if (!validateUsername()) {
            alert('Invalid username');
            return;
        }
        
        welcomeScreen.style.display = 'none';
        resizeCanvas();
        isGameStarted = true;
        window.socket = io("https://stickman-fighter.onrender.com");
    
        window.socket.on("connect", () => {
            console.log("Connected to server, username:", username);
            
            // Create local player with initial position
            localPlayer = new Stickman(100, canvas.height - 150, "blue");
            localPlayer.username = username;
            
            // Emit player move with game started flag and username
            window.socket.emit("playerMove", { 
                x: localPlayer.x, 
                y: localPlayer.y,
                health: localPlayer.health,
                score: localPlayer.score,
                facing: localPlayer.facing,
                username: localPlayer.username, // Explicitly send username
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