// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set initial canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Call resize initially and add listener
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game constants
const groundY = canvas.height - 50;

// Player state
let player = {
    x: 200,
    y: groundY - 110,
    radius: 20,
    speed: 5,
    dx: 0,
    dy: 0,
    armLength: 30,
    legLength: 40,
    bodyHeight: 50,
    isJumping: false,
    isCrouching: false,
    crouchOffset: 15,
    health: 100,
    weapon: null
};

// AI state
let ai = {
    x: 600,
    y: groundY - 110,
    radius: 20,
    speed: 4,
    dx: 0,
    dy: 0,
    armLength: 30,
    legLength: 40,
    bodyHeight: 50,
    isJumping: false,
    health: 100,
    weapon: {
        path: [
            { x: 0, y: 0 },
            { x: 40, y: -10 },
            { x: 60, y: 0 }
        ],
        angle: 0
    }
};

// Input handling
let keys = {};
let drawing = false;
let weaponPath = [];

// Event listeners
window.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    if (e.key === ' ' && !player.isJumping) {
        player.dy = -12;
        player.isJumping = true;
    }
    if (e.key === 'Control') {
        player.isCrouching = true;
    }
});

window.addEventListener('keyup', function(e) {
    keys[e.key] = false;
    if (e.key === 'Control') {
        player.isCrouching = false;
    }
});

canvas.addEventListener('mousedown', function(e) {
    if (!player.weapon) {
        drawing = true;
        weaponPath = [{ x: e.clientX, y: e.clientY }];
    }
});

canvas.addEventListener('mousemove', function(e) {
    if (drawing) {
        weaponPath.push({ x: e.clientX, y: e.clientY });
    } else if (player.weapon) {
        const dx = e.clientX - (player.x + player.armLength);
        const dy = e.clientY - (player.y + player.radius + 20);
        player.weapon.angle = Math.atan2(dy, dx);
    }
});

canvas.addEventListener('mouseup', function() {
    if (drawing && weaponPath.length > 2) {
        player.weapon = {
            path: weaponPath,
            angle: 0
        };
    }
    drawing = false;
});

// Game functions
function movePlayer() {
    // Horizontal movement
    player.dx = 0;
    if (keys['ArrowRight'] || keys['d']) player.dx = player.speed;
    if (keys['ArrowLeft'] || keys['a']) player.dx = -player.speed;
    
    player.x += player.dx;
    player.y += player.dy;

    // Apply gravity
    player.dy += 0.5;

    // Ground collision
    if (player.y >= groundY - 110) {
        player.y = groundY - 110;
        player.dy = 0;
        player.isJumping = false;
    }

    // Screen boundaries
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
}

function moveAI() {
    // Simple AI movement
    const distanceToPlayer = player.x - ai.x;
    if (Math.abs(distanceToPlayer) > 100) {
        ai.dx = Math.sign(distanceToPlayer) * ai.speed;
    } else {
        ai.dx = 0;
    }

    ai.x += ai.dx;
    
    // Random jumping
    if (!ai.isJumping && Math.random() < 0.02) {
        ai.dy = -12;
        ai.isJumping = true;
    }

    // Apply gravity
    ai.dy += 0.5;
    ai.y += ai.dy;

    if (ai.y >= groundY - 110) {
        ai.y = groundY - 110;
        ai.dy = 0;
        ai.isJumping = false;
    }

    // Update weapon angle to point at player
    if (ai.weapon) {
        const dx = player.x - ai.x;
        const dy = player.y - ai.y;
        ai.weapon.angle = Math.atan2(dy, dx);
    }
}

function drawGround() {
    ctx.fillStyle = '#3c3c3c';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
}

function drawCharacter(char, isAI = false) {
    ctx.fillStyle = isAI ? 'red' : 'black';
    ctx.strokeStyle = isAI ? 'red' : 'black';
    ctx.lineWidth = 4;

    // Draw head
    ctx.beginPath();
    ctx.arc(char.x, char.y, char.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw body
    ctx.beginPath();
    ctx.moveTo(char.x, char.y + char.radius);
    ctx.lineTo(char.x, char.y + char.radius + char.bodyHeight);
    ctx.stroke();

    // Draw arms
    ctx.beginPath();
    ctx.moveTo(char.x, char.y + char.radius + 10);
    ctx.lineTo(char.x - char.armLength, char.y + char.radius + 20);
    ctx.moveTo(char.x, char.y + char.radius + 10);
    ctx.lineTo(char.x + char.armLength, char.y + char.radius + 20);
    ctx.stroke();

    // Draw legs
    let legOffset = Math.sin(Date.now() / 100) * 10 * (char.dx !== 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(char.x, char.y + char.radius + char.bodyHeight);
    ctx.lineTo(char.x - char.legLength + legOffset, char.y + char.radius + char.bodyHeight + char.legLength);
    ctx.moveTo(char.x, char.y + char.radius + char.bodyHeight);
    ctx.lineTo(char.x + char.legLength - legOffset, char.y + char.radius + char.bodyHeight + char.legLength);
    ctx.stroke();

    // Draw weapon if equipped
    if (char.weapon) {
        drawWeapon(char);
    }

    // Draw health bar
    drawHealthBar(char, isAI);
}

function drawWeapon(char) {
    ctx.save();
    const weaponPivotX = char.x + char.armLength;
    const weaponPivotY = char.y + char.radius + 20;
    
    ctx.translate(weaponPivotX, weaponPivotY);
    ctx.rotate(char.weapon.angle);
    
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i < char.weapon.path.length - 1; i++) {
        ctx.moveTo(
            char.weapon.path[i].x - char.weapon.path[0].x,
            char.weapon.path[i].y - char.weapon.path[0].y
        );
        ctx.lineTo(
            char.weapon.path[i + 1].x - char.weapon.path[0].x,
            char.weapon.path[i + 1].y - char.weapon.path[0].y
        );
    }
    ctx.stroke();
    ctx.restore();
}

function drawHealthBar(char, isAI) {
    const barWidth = 50;
    const barHeight = 5;
    const barX = char.x - barWidth / 2;
    const barY = char.y - char.radius - 10;

    // Background
    ctx.fillStyle = 'red';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = 'green';
    ctx.fillRect(barX, barY, barWidth * (char.health / 100), barHeight);
}

function drawTempWeapon() {
    if (!drawing || weaponPath.length < 2) return;
    
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i < weaponPath.length - 1; i++) {
        ctx.moveTo(weaponPath[i].x, weaponPath[i].y);
        ctx.lineTo(weaponPath[i + 1].x, weaponPath[i + 1].y);
    }
    ctx.stroke();
}

function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update positions
    movePlayer();
    moveAI();

    // Draw everything
    drawGround();
    drawCharacter(player);
    drawCharacter(ai, true);
    drawTempWeapon();

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();