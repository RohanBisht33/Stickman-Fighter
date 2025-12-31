// --- STICKMAN FIGHTER CLIENT ---
// Global State
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const welcomeScreen = document.getElementById("welcomeScreen");
const remotePlayers = {}; // Opponent instances
let localPlayer = null;
let isGameStarted = false;
let isPaused = false;
let isGameOver = false;

// UI Elements
const pauseMenu = document.getElementById('pauseMenu');
const rematchModal = document.getElementById('rematchModal');
const toastEl = document.getElementById('toast');

// --- UTILS ---
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function resizeCanvas() {
    const gameContainer = document.querySelector(".game-container");
    const gameInfo = document.querySelector(".game-info");
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight - gameInfo.offsetHeight;
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// --- STICKMAN CLASS ---
class Stickman {
    constructor(x, y, color, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.baseX = x; // for reset
        this.baseY = y;

        // Physics
        this.velX = 0;
        this.velY = 0;
        this.width = 100;
        this.height = 100;
        this.color = color;
        this.speed = 6; // slightly faster
        this.gravity = 0.6;
        this.jumpPower = -12;

        // State
        this.facing = 1;
        this.isGrounded = false;
        this.jumpsRemaining = 2;
        this.jumpCooldown = 0;
        this.health = 100;
        this.score = 0;
        this.username = "";

        // Dash
        this.canDash = true;
        this.isDashing = false;
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.lastDashInput = 0; // For double tap or hold logic

        // Combat
        this.isAttacking = false;
        this.attackType = null;
        this.attackFrame = 0;
        this.lastShotTime = 0;
        this.projectiles = [];

        // Animation
        this.walkFrame = 0;
    }

    reset() {
        this.x = this.baseX;
        this.y = this.baseY;
        this.velX = 0;
        this.velY = 0;
        this.health = 100;
        this.isAttacking = false;
        this.isDashing = false;
        this.projectiles = [];
    }

    update() {
        if (this.health <= 0) return;

        // --- DASH LOGIC (Hold Q) ---
        if (this.dashCooldown > 0) this.dashCooldown--;

        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.dashCooldown = 40; // Cooldown
                this.velX *= 0.1; // Stop momentum
            } else {
                this.velX = this.facing * 25; // Dash Speed
                this.velY = 0; // Float during dash
            }
        } else {
            // Normal Physics
            this.x += this.velX;
            this.velY += this.gravity;
            this.y += this.velY;
            this.velX *= 0.82; // Friction
        }

        // --- WALLS & FLOOR ---
        if (this.y + this.height >= canvas.height - 34) {
            this.y = canvas.height - 34 - this.height;
            this.velY = 0;
            this.isGrounded = true;
            this.jumpsRemaining = 2;
            this.canDash = true;
        } else {
            this.isGrounded = false;
        }

        if (this.x < 0) { this.x = 0; this.velX = 0; }
        if (this.x > canvas.width - this.width) { this.x = canvas.width - this.width; this.velX = 0; }

        if (this.jumpCooldown > 0) this.jumpCooldown--;

        this.updateProjectiles();
    }

    move(dir) {
        if (this.isDashing || this.isAttacking) return;
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

    startDash() {
        if (this.canDash && this.dashCooldown === 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = 8; // Duration
            this.canDash = false;
            // Air dash uses up resources? Maybe limit to 1 per air?
            if (!this.isGrounded) this.canDash = false;
        }
    }

    // --- COMBAT ACTIONS ---
    // Note: These methods initiate the action LOCALY and send to network
    // The visual/logic is shared.

    punch() {
        if (this.isAttacking) return;
        this.performAttack('punch');
        Network.send({ type: 'attack', attackType: 'punch' });
        this.checkHit(5, 100);
    }

    kick() {
        if (this.isAttacking) return;
        this.performAttack('kick');
        Network.send({ type: 'attack', attackType: 'kick' });
        this.checkHit(8, 120);
    }

    shoot() {
        if (Date.now() - this.lastShotTime < 500) return;

        const vx = 15 * this.facing;
        const startX = this.x + 50 + (30 * this.facing);
        const startY = this.y + 40;

        this.spawnProjectile(startX, startY, vx);
        Network.send({ type: 'attack', attackType: 'shoot', x: startX, y: startY, vx: vx });
        this.lastShotTime = Date.now();
    }

    // --- VISUAL EXECUTION ---
    performAttack(type) {
        this.isAttacking = true;
        this.attackType = type;
        this.attackFrame = 0;
        setTimeout(() => { this.isAttacking = false; }, type === 'kick' ? 400 : 300);
    }

    checkHit(damage, range) {
        const enemy = remotePlayers['opponent'];
        if (enemy) {
            // Hitbox Logic based on Facing Direction
            // Check if enemy is in FRONT of me
            const dx = enemy.x - this.x;
            const inFront = (this.facing === 1 && dx > -20) || (this.facing === -1 && dx < 20);

            const dist = Math.hypot((enemy.x + 50) - (this.x + 50), (enemy.y + 50) - (this.y + 50));

            if (dist < range && inFront) {
                // DEAL DAMAGE
                enemy.health = Math.max(0, enemy.health - damage);
                this.score += damage;
                Network.send({ type: 'hit', newHealth: enemy.health });

                checkWinCondition();
            }
        }
    }

    spawnProjectile(x, y, vx) {
        this.projectiles.push({ x: x, y: y, vx: vx, life: 60, damage: 15 });
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.life--;

            // Checking Local Player's projectiles vs Opponent
            if (this === localPlayer) {
                const enemy = remotePlayers['opponent'];
                if (enemy) {
                    if (p.x > enemy.x + 20 && p.x < enemy.x + 80 &&
                        p.y > enemy.y && p.y < enemy.y + 100) {
                        enemy.health = Math.max(0, enemy.health - p.damage);
                        Network.send({ type: 'hit', newHealth: enemy.health });
                        checkWinCondition();
                        p.life = 0;
                    }
                }
            }
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    draw(isLocal = false) {
        const scaleX = this.width / 50;
        const scaleY = this.height / 80;

        ctx.save();
        ctx.translate(this.x + 50, this.y + 50);
        ctx.scale(this.facing * scaleX, scaleY);

        // Procedural Animation
        let legL = 0, legR = 0, arm = 0;

        if (this.isDashing) {
            legL = 1.0; legR = 0.5; arm = 1.5; // Naruto run style
            ctx.globalAlpha = 0.7; // Ghost effect
        } else if (Math.abs(this.velX) > 0.5 && this.isGrounded) {
            this.walkFrame += 0.2;
            legL = Math.sin(this.walkFrame);
            legR = Math.sin(this.walkFrame + Math.PI);
            arm = -Math.sin(this.walkFrame);
        } else if (!this.isGrounded) {
            legL = 0.5; legR = -0.2; arm = -1.5; // Jump pose
        }

        // Combat Overrides
        let punchOffset = 0;
        if (this.isAttacking) {
            this.attackFrame += 0.25;
            if (this.attackType === 'punch') {
                punchOffset = 25 * Math.sin(this.attackFrame * Math.PI); // Jab
                arm = -1.5;
            } else if (this.attackType === 'kick') {
                legR = -1.5 * Math.sin(this.attackFrame * Math.PI); // High kick
            }
        }

        // --- DRAWING STICKMAN ---
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
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legL) * 20, 45 + Math.cos(legL) * 5); ctx.stroke(); // Back Right
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legR) * 20, 45 + Math.cos(legR) * 5); ctx.stroke(); // Front Left

        // Arms
        ctx.beginPath(); ctx.moveTo(0, -15);
        if (this.attackType === 'punch' && this.isAttacking) {
            ctx.lineTo(25 + punchOffset, -15);
        } else {
            ctx.lineTo(15, 10 + arm * 10);
        }
        ctx.stroke();

        ctx.restore();
        ctx.globalAlpha = 1;

        // Projectiles
        ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 3;
        for (let p of this.projectiles) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx * 1.5), p.y); ctx.stroke();
        }

        // Username
        ctx.fillStyle = "white"; ctx.font = "14px 'Orbitron'"; ctx.textAlign = "center";
        ctx.fillText(this.username, this.x + 50, this.y - 20);

        if (isLocal) {
            document.getElementById('localHealth').style.width = this.health + '%';
            document.getElementById('localScore').textContent = this.score;
        }
    }
}

// --- NETWORK (PeerJS) ---
const Network = {
    peer: null,
    conn: null,

    init(username, isHost, targetId) {
        // Generate short random ID for easier sharing
        const peerOpt = isHost ? {
            debug: 1,
            id: generateRoomCode() // Custom short ID
        } : { debug: 1 }; // Client gets auto ID

        this.peer = new Peer(isHost ? peerOpt.id : null, { debug: 1 });

        this.peer.on('open', (id) => {
            if (isHost) {
                document.getElementById('myRoomId').textContent = id;
                this.setupHost();
            } else {
                this.connect(targetId, username);
            }
        });
        this.peer.on('error', (err) => alert("Net Error: " + err.type));
    },

    setupHost() {
        this.peer.on('connection', (conn) => {
            this.handleConn(conn);
        });
    },

    connect(id, username) {
        const conn = this.peer.connect(id);
        conn.on('open', () => {
            this.handleConn(conn);
            this.send({ type: 'handshake', username: username });
        });
        conn.on('error', () => {
            alert("Could not find room!");
            location.reload();
        });
    },

    handleConn(conn) {
        this.conn = conn;
        conn.on('data', (data) => handleData(data));
        conn.on('close', () => {
            showToast("Opponent Left");
            // Maybe reset game state
        });

        // If Host, start game
        if (localPlayer.id === 'local_host') { // dumb check
            // actually rely on handshake
        }
    },

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }
};

function generateRoomCode() {
    // Generate a 4-char random uppsercase string
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function handleData(data) {
    if (!remotePlayers['opponent']) {
        remotePlayers['opponent'] = new Stickman(0, 0, "red", 'opponent');
    }
    const opp = remotePlayers['opponent'];

    switch (data.type) {
        case 'handshake':
            // Host receives this from joining Client
            opp.username = data.username;
            console.log("Received handshake from", data.username);

            if (localPlayer.id === 'local_host') {
                // Reply to Client so they can start!
                Network.send({
                    type: 'handshake_ack',
                    username: localPlayer.username
                });

                showToast(`${data.username} Joined!`);
                if (!isGameStarted) startGameUI();
            }
            break;

        case 'handshake_ack':
            // Client receives this from Host
            opp.username = data.username;
            console.log("Received handshake_ack from", data.username);

            showToast(`Connected to ${data.username}!`);
            if (!isGameStarted) startGameUI();
            break;

        case 'update':
            // Simple interpolation: Move towards target
            // But for simple twitch game, snapping with simple lerp on physics is easiest
            // Just update props for now
            opp.x = data.x;
            opp.y = data.y;
            opp.facing = data.facing;
            opp.velX = data.velX; // for animation
            opp.health = data.health;
            break;

        case 'attack':
            if (data.attackType === 'shoot') opp.spawnProjectile(data.x, data.y, data.vx);
            else opp.performAttack(data.attackType);
            break;

        case 'hit':
            if (localPlayer) {
                localPlayer.health = data.newHealth;
                checkWinCondition();
            }
            break;

        case 'rematch_req':
            if (confirm("Opponent wants a rematch. Accept?")) {
                resetGame();
                Network.send({ type: 'rematch_ack' });
            }
            break;
        case 'rematch_ack':
            resetGame();
            break;
    }
}

// --- GAME LOGIC ---
function checkWinCondition() {
    if ((localPlayer.health <= 0 || (remotePlayers['opponent'] && remotePlayers['opponent'].health <= 0)) && !isGameOver) {
        isGameOver = true;
        isPaused = true;

        const winner = localPlayer.health > 0 ? "YOU WIN" : "YOU LOSE";
        document.getElementById('winnerText').textContent = winner;

        setTimeout(() => {
            rematchModal.style.display = 'flex';
        }, 1000);
    }
}

function resetGame() {
    isGameOver = false;
    isPaused = false;
    rematchModal.style.display = 'none';

    localPlayer.reset();
    if (localPlayer.id === 'local_host') localPlayer.x = 100; else localPlayer.x = 800; // Reset positions

    if (remotePlayers['opponent']) remotePlayers['opponent'].reset();
}

function startGameUI() {
    welcomeScreen.style.display = 'none';
    document.getElementById('roomControls').style.display = 'none'; // Fade out
    isGameStarted = true;
    resizeCanvas();
    update();
}

// --- INPUT & LOOP ---
const keys = {};

window.addEventListener('keydown', (e) => {
    // Pause Logic
    if (e.key === 'Escape') {
        isPaused = !isPaused;
        pauseMenu.style.display = isPaused ? 'flex' : 'none';
    }

    if (isPaused || !isGameStarted) return;

    keys[e.key.toLowerCase()] = true;

    // Actions that shouldn't repeat on hold
    const k = e.key.toLowerCase();

    if (k === 'i') localPlayer.punch();
    if (k === 'o') localPlayer.kick();
    if (k === 'p') localPlayer.shoot();

    // Logic for Shift (Air Dash) or Q (Ground Dash)
    if (k === 'shift' && !localPlayer.isGrounded) localPlayer.startDash();
});

window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function update() {
    if (!isGameStarted) return;
    requestAnimationFrame(update);

    if (isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Environment
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    ctx.strokeStyle = '#4CAF50'; ctx.beginPath(); ctx.moveTo(0, canvas.height - 34); ctx.lineTo(canvas.width, canvas.height - 34); ctx.stroke();

    // Local Input Handle (Continuous)
    if (localPlayer) {
        if (keys['a']) localPlayer.move('left');
        else if (keys['d']) localPlayer.move('right');

        if (keys[' ']) localPlayer.jump();

        if (keys['q']) localPlayer.startDash(); // Hold/Press Q Check

        localPlayer.update();
        localPlayer.draw(true);

        // Sync
        Network.send({
            type: 'update',
            x: localPlayer.x,
            y: localPlayer.y,
            velX: localPlayer.velX,
            facing: localPlayer.facing,
            health: localPlayer.health
        });
    }

    if (remotePlayers['opponent']) {
        const opp = remotePlayers['opponent'];
        opp.update();
        opp.draw();
    }
}

// --- BUTTONS ---
document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    if (!name) return alert("Name Required");

    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('hostArea').style.display = 'block';

    // Setup Local Player as Host
    localPlayer = new Stickman(100, 300, "#58a6ff", 'local_host');
    localPlayer.username = name;

    Network.init(name, true);
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    if (!name) return alert("Name Required");

    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('joinArea').style.display = 'block';

    // Setup Local Player as Client
    localPlayer = new Stickman(800, 300, "#58a6ff", 'local_client');
    localPlayer.facing = -1;
    localPlayer.username = name;
});

document.getElementById('connectBtn').addEventListener('click', () => {
    const id = document.getElementById('destRoomId').value.toUpperCase(); // Code is upper
    const name = document.getElementById('usernameInput').value;
    if (!id) return;

    Network.init(name, false, id);
    document.getElementById('joinStatus').textContent = "Connecting...";
});


document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('myRoomId').textContent);
    showToast("Copied to Clipboard!");
});

document.getElementById('resumeBtn').addEventListener('click', () => {
    isPaused = false;
    pauseMenu.style.display = 'none';
});

document.getElementById('quitBtn').addEventListener('click', () => location.reload());

document.getElementById('rematchBtn').addEventListener('click', () => {
    document.getElementById('rematchStatus').textContent = "Waiting for confirm...";
    Network.send({ type: 'rematch_req' });
});
document.getElementById('exitMatchBtn').addEventListener('click', () => location.reload());