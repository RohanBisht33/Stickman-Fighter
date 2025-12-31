const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('usernameInput');
    const usernameError = document.getElementById('usernameError');
});
const welcomeScreen = document.getElementById("welcomeScreen");

// Global Game State
const remotePlayers = {}; // Opponent instances
let localPlayer = null;
let isGameStarted = false;

// --- UTILS ---
function validateUsername() {
    const username = document.getElementById('usernameInput').value.trim();
    if (username.length === 0) return false;
    return true;
}

function resizeCanvas() {
    const gameContainer = document.querySelector(".game-container");
    const gameInfo = document.querySelector(".game-info");

    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight - gameInfo.offsetHeight;

    canvas.style.width = '100%';
    canvas.style.height = '100%';
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

window.addEventListener("beforeunload", () => {
    // Optional: Notify peer of disconnect if possible
});

// --- STICKMAN CLASS ---
class Stickman {
    constructor(x, y, color, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;

        this.velX = 0;
        this.velY = 0;

        this.width = 100;
        this.height = 100;
        this.color = color;

        this.speed = 5;
        this.gravity = 0.5;
        this.jumpPower = -12; // Slightly higher jump

        this.facing = 1;
        this.isGrounded = true;
        this.jumpsRemaining = 2;
        this.jumpCooldown = 0;

        this.health = 100;
        this.score = 0;
        this.username = "";

        // Dash
        this.canDash = true;
        this.isDashing = false;
        this.dashCooldown = 0;
        this.dashDuration = 0;

        // Animation
        this.walkFrame = 0;
        this.isAttacking = false;
        this.attackType = null;
        this.attackFrame = 0;

        // Projectiles
        this.projectiles = [];
        this.lastShotTime = 0;
    }

    update() {
        // --- MOVEMENT & PHYSICS ---
        if (this.dashCooldown > 0) this.dashCooldown--;

        if (this.isDashing) {
            this.dashDuration--;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
                this.dashCooldown = 60;
                this.velX = 0;
            }
        } else {
            this.x += this.velX;
            this.velY += this.gravity;
            this.y += this.velY;

            // Friction
            this.velX *= 0.85;
        }

        // --- COLLISIONS ---
        // Floor
        if (this.y + this.height >= canvas.height - 34) {
            this.y = canvas.height - 34 - this.height;
            this.velY = 0;
            this.isGrounded = true;
            this.jumpsRemaining = 2;
            this.canDash = true;
        } else {
            this.isGrounded = false;
        }

        // Walls
        if (this.x < 0) { this.x = 0; this.velX = 0; }
        if (this.x > canvas.width - this.width) { this.x = canvas.width - this.width; this.velX = 0; }

        if (this.jumpCooldown > 0) this.jumpCooldown--;

        if (this.health <= 0) {
            // Die logic handled by Network/Game loop
        }
    }

    move(dir) {
        if (this.isDashing) return;
        if (dir === 'left') {
            this.velX = -this.speed;
            this.facing = -1;
        } else {
            this.velX = this.speed;
            this.facing = 1;
        }
    }

    jump() {
        if (this.jumpsRemaining > 0 && this.jumpCooldown === 0) {
            this.velY = this.jumpPower;
            this.jumpsRemaining--;
            this.jumpCooldown = 15;
            this.isGrounded = false;
        }
    }

    dash() {
        if (this.canDash && !this.isDashing && this.dashCooldown === 0) {
            this.isDashing = true;
            this.dashDuration = 10;
            this.velX = this.facing * 20;
            this.canDash = false;
        }
    }

    punch() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackType = 'punch';
        this.attackFrame = 0;

        // Broadcast
        Network.send({ type: 'attack', attackType: 'punch' });

        // Hit Detection
        this.checkMeleeHit(5, 100);

        setTimeout(() => { this.isAttacking = false; }, 300);
    }

    kick() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackType = 'kick';
        this.attackFrame = 0;

        // Broadcast
        Network.send({ type: 'attack', attackType: 'kick' });

        // Hit Detection (longer range)
        this.checkMeleeHit(8, 120);

        setTimeout(() => { this.isAttacking = false; }, 400);
    }

    checkMeleeHit(damage, range) {
        const enemy = remotePlayers['opponent'];
        if (enemy) {
            const dx = Math.abs((enemy.x + 50) - (this.x + 50));
            const dy = Math.abs((enemy.y + 50) - (this.y + 50));

            const isFacing = (this.facing === 1 && enemy.x > this.x) || (this.facing === -1 && enemy.x < this.x);

            if (dx < range && dy < 100 && isFacing) {
                // Determine Hit
                enemy.health = Math.max(0, enemy.health - damage);
                this.score += damage;

                // Inform Peer
                Network.send({ type: 'hit', newHealth: enemy.health });
            }
        }
    }

    shoot() {
        if (Date.now() - this.lastShotTime > 500) {
            const vx = 15 * this.facing;
            const startX = this.x + 50 + (30 * this.facing);
            const startY = this.y + 40;

            this.spawnProjectile(startX, startY, vx);

            Network.send({
                type: 'attack',
                attackType: 'shoot',
                x: startX,
                y: startY,
                vx: vx
            });
            this.lastShotTime = Date.now();
        }
    }

    spawnProjectile(x, y, vx) {
        this.projectiles.push({ x: x, y: y, vx: vx, life: 100, damage: 15 });
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.life--;

            // Local collision check (My projectiles hitting enemy)
            if (this === localPlayer) {
                const enemy = remotePlayers['opponent'];
                if (enemy) {
                    if (p.x > enemy.x && p.x < enemy.x + 100 &&
                        p.y > enemy.y && p.y < enemy.y + 100) {

                        enemy.health = Math.max(0, enemy.health - p.damage);
                        this.score += p.damage;
                        Network.send({ type: 'hit', newHealth: enemy.health });

                        p.life = 0; // Destroy projectile
                    }
                }
            }

            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    draw(isLocal = false) {
        const scaleX = this.width / 50;
        const scaleY = this.height / 80;

        ctx.save();
        ctx.translate(this.x + 50, this.y + 50);
        ctx.scale(this.facing * scaleX, scaleY);

        // --- PROCEDURAL ANIMATION ---
        let legAngle = 0;
        let armAngle = 0;
        let punchOffset = 0;
        let kickOffset = 0;

        // Walk
        if (Math.abs(this.velX) > 0.5 && this.isGrounded) {
            this.walkFrame += 0.2;
            legAngle = Math.sin(this.walkFrame) * 0.5;
            armAngle = -Math.sin(this.walkFrame) * 0.5;
        } else {
            this.walkFrame = 0;
        }

        // Attack
        if (this.isAttacking) {
            this.attackFrame += 0.2;
            if (this.attackType === 'punch') {
                punchOffset = 25 * Math.sin(this.attackFrame * Math.PI);
                armAngle = -1.5;
            } else if (this.attackType === 'kick') {
                kickOffset = -Math.PI / 3 * Math.sin(this.attackFrame * Math.PI);
            }
            if (this.attackFrame >= 1) this.attackFrame = 0;
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Head
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, -35, 12, 0, Math.PI * 2); ctx.fill();

        // Body
        ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(0, 15); ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legAngle + kickOffset) * 20, 45 + Math.cos(legAngle) * 5); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 15); ctx.lineTo(Math.sin(-legAngle) * 20, 45 + Math.cos(-legAngle) * 5); ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(0, -15);
        if (this.attackType === 'punch' && this.isAttacking) {
            ctx.lineTo(25 + punchOffset, -15);
        } else {
            ctx.lineTo(15, 10 + armAngle * 10);
        }
        ctx.stroke();

        ctx.restore();

        // Projectiles
        this.drawProjectiles();

        // Username & UI
        ctx.fillStyle = "white";
        ctx.font = "14px 'Orbitron'";
        ctx.textAlign = "center";
        ctx.fillText(this.username, this.x + 50, this.y - 20);

        if (isLocal) {
            updateUI(this);
        }
    }

    drawProjectiles() {
        ctx.strokeStyle = '#FFC107';
        ctx.lineWidth = 3;
        for (let p of this.projectiles) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - (p.vx * 1.5), p.y);
            ctx.stroke();
        }
    }
}

// --- UI UPDATE ---
function updateUI(player) {
    const healthBar = document.getElementById('localHealth');
    const scoreText = document.getElementById('localScore');

    if (healthBar) {
        healthBar.style.width = player.health + '%';
        healthBar.textContent = player.health + '%';
        healthBar.style.backgroundColor = player.health > 50 ? '#4CAF50' : '#F44336';
    }
    if (scoreText) scoreText.textContent = player.score;
}

// --- NETWORK MANAGER ---
const Network = {
    peer: null,
    conn: null,

    init(username, mode, targetId = null) {
        this.peer = new Peer(null, { debug: 1 });

        this.peer.on('open', (id) => {
            if (mode === 'host') {
                document.getElementById('myRoomId').textContent = id;
                document.getElementById('hostStatus').textContent = "Waiting for player...";
                this.setupHost();
            } else {
                this.connect(targetId, username);
            }
        });

        this.peer.on('error', (err) => { alert("Error: " + err.type); });
    },

    setupHost() {
        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.bindEvents();
            document.getElementById('hostStatus').textContent = "Connected! Starting...";
            setTimeout(() => startGame('host'), 1000);
        });
    },

    connect(id, username) {
        const conn = this.peer.connect(id);
        conn.on('open', () => {
            this.conn = conn;
            this.bindEvents();
            // Send handshake
            this.send({ type: 'handshake', username: username });
            document.getElementById('joinStatus').textContent = "Connected! Starting...";
            setTimeout(() => startGame('client'), 1000);
        });
        conn.on('error', () => alert("Connection Failed"));
    },

    bindEvents() {
        this.conn.on('data', (data) => handleData(data));
        this.conn.on('close', () => {
            alert("Peer disconnected");
            location.reload();
        });
    },

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }
};

function handleData(data) {
    if (!remotePlayers['opponent']) {
        // Create dummy opponent if not exists
        remotePlayers['opponent'] = new Stickman(0, 0, "red", 'opponent');
    }
    const opp = remotePlayers['opponent'];

    switch (data.type) {
        case 'update':
            // Interpolate or snap
            opp.x = data.x;
            opp.y = data.y;
            opp.facing = data.facing;
            opp.velX = data.velX; // for animation
            opp.username = data.username;
            opp.health = data.health;
            break;

        case 'attack':
            if (data.attackType === 'punch') opp.punch();
            else if (data.attackType === 'kick') opp.kick();
            else if (data.attackType === 'shoot') {
                opp.spawnProjectile(data.x, data.y, data.vx);
            }
            break;

        case 'hit':
            if (localPlayer) {
                localPlayer.health = data.newHealth;
                if (localPlayer.health <= 0) {
                    alert("You Died!");
                    location.reload();
                }
            }
            break;

        case 'handshake':
            opp.username = data.username;
            break;
    }
}

// --- INPUT & LOOP ---
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (!localPlayer) return;

    if (e.key.toLowerCase() === 'i') localPlayer.punch();
    if (e.key.toLowerCase() === 'o') localPlayer.kick();
    if (e.key.toLowerCase() === 'p') localPlayer.shoot();
    if (e.key.toLowerCase() === 'q') localPlayer.dash();
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function update() {
    if (!isGameStarted) {
        requestAnimationFrame(update);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Ground
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    ctx.beginPath(); ctx.moveTo(0, canvas.height - 34); ctx.lineTo(canvas.width, canvas.height - 34);
    ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 2; ctx.stroke();

    // Update Local
    if (localPlayer) {
        // Input
        if (keys['a']) localPlayer.move('left');
        else if (keys['d']) localPlayer.move('right');
        /*else localPlayer.velX = 0; */ // handled by friction in update

        if (keys[' '] || keys['w']) localPlayer.jump(); // Added W for jump

        localPlayer.update();
        localPlayer.draw(true);

        // Sync
        Network.send({
            type: 'update',
            x: localPlayer.x,
            y: localPlayer.y,
            velX: localPlayer.velX,
            facing: localPlayer.facing,
            health: localPlayer.health,
            username: localPlayer.username
        });
    }

    // Update Opponent
    if (remotePlayers['opponent']) {
        const opp = remotePlayers['opponent'];
        opp.update(); // Run physics so projectiles/gravity work
        opp.draw();
    }

    requestAnimationFrame(update);
}

// --- MENU HANDLERS ---
function startGame(role) {
    welcomeScreen.style.display = 'none';
    isGameStarted = true;
    resizeCanvas();

    const name = document.getElementById('usernameInput').value;

    if (role === 'host') {
        localPlayer = new Stickman(100, 300, "#58a6ff", 'local');
    } else {
        localPlayer = new Stickman(800, 300, "#58a6ff", 'local');
    }
    localPlayer.username = name;

    update();
}

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    if (!name) return alert("Enter Name");

    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('hostArea').style.display = 'block';

    Network.init(name, 'host');
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    if (!name) return alert("Enter Name");

    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('joinArea').style.display = 'block';
});

document.getElementById('connectBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    const id = document.getElementById('destRoomId').value.trim();
    if (!id) return;

    document.getElementById('joinStatus').textContent = "Connecting...";
    Network.init(name, 'join', id);
});

document.getElementById('copyBtn').addEventListener('click', () => {
    const id = document.getElementById('myRoomId').textContent;
    navigator.clipboard.writeText(id).then(() => alert("Copied!"));
});

document.getElementById('backBtn').addEventListener('click', () => location.reload());