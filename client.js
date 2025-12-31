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
// Settings UI
const settingsModal = document.getElementById('settingsModal');

// --- UTILS ---
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function resizeCanvas() {
    const gameContainer = document.querySelector(".game-container");
    const gameInfo = document.querySelector(".game-info");
    const w = gameContainer ? gameContainer.clientWidth : window.innerWidth;
    const h = gameContainer ? (gameContainer.clientHeight - (gameInfo ? gameInfo.offsetHeight : 0)) : window.innerHeight;

    if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
    }
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// --- STICKMAN CLASS ---
class Stickman {
    constructor(x, y, color, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;

        // Physics
        this.velX = 0;
        this.velY = 0;
        this.width = 100;
        this.height = 100;
        this.color = color;
        this.speed = 6;
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

        // Combat & Combos
        this.isAttacking = false;
        this.attackType = null;
        this.attackFrame = 0;
        this.lastShotTime = 0;
        this.projectiles = [];

        this.comboKeys = [];
        this.lastComboTime = 0;

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
        this.comboKeys = [];
    }

    registerComboInput(key) {
        const now = Date.now();
        if (now - this.lastComboTime > 1000) {
            this.comboKeys = []; // Reset if too slow
        }
        this.comboKeys.push(key);
        this.lastComboTime = now;

        // Limit buffer
        if (this.comboKeys.length > 5) this.comboKeys.shift();

        this.checkCombos();
    }

    checkCombos() {
        const seq = this.comboKeys.join('');

        // Define Combos (i=punch, o=kick)
        if (seq.endsWith('iii')) {
            showToast("TRIPLE PUNCH!");
            this.performAttack('combo_triple_punch');
            Network.send({ type: 'attack', attackType: 'combo_triple_punch' });
            this.comboKeys = [];
        } else if (seq.endsWith('ooo')) {
            showToast("SPIN KICK!");
            this.performAttack('combo_spin_kick');
            Network.send({ type: 'attack', attackType: 'combo_spin_kick' });
            this.comboKeys = [];
        } else if (seq.endsWith('io')) {
            showToast("UPPERCUT!");
            this.performAttack('combo_uppercut');
            Network.send({ type: 'attack', attackType: 'combo_uppercut' });
            this.comboKeys = [];
        }
    }

    update() {
        if (this.health <= 0) return;

        // --- DASH LOGIC ---
        if (this.dashCooldown > 0) this.dashCooldown--;

        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.dashCooldown = 40;
                this.velX *= 0.1;
            } else {
                this.velX = this.facing * 25;
                this.velY = 0;
            }
        } else {
            this.x += this.velX;
            this.velY += this.gravity;
            this.y += this.velY;
            this.velX *= 0.82;
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
        if (this.isDashing) return; // Allow moving while attacking? No, restrictive
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
            this.dashTimer = 8;
            this.canDash = false;
            if (!this.isGrounded) this.canDash = false;
        }
    }

    punch() {
        if (this.isAttacking) return;
        this.performAttack('punch');
        Network.send({ type: 'attack', attackType: 'punch' });
        this.checkHit(5, 120); // slightly increased range
        this.registerComboInput('i');
    }

    kick() {
        if (this.isAttacking) return;
        this.performAttack('kick');
        Network.send({ type: 'attack', attackType: 'kick' });
        this.checkHit(8, 140);
        this.registerComboInput('o');
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

        let duration = 300;
        if (type.startsWith('combo')) duration = 1200; // SLOWER COMBOS
        else if (type === 'kick') duration = 500;
        else if (type === 'punch') duration = 400;

        setTimeout(() => { this.isAttacking = false; }, duration);
    }

    checkHit(damage, range) {
        const enemy = remotePlayers['opponent'];
        if (enemy) {
            // Hitbox Logic based on Facing Direction
            const dx = enemy.x - this.x;
            const inFront = (this.facing === 1 && dx > -50) || (this.facing === -1 && dx < 50);

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
        let bodyRot = 0;

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

        // Attack Anims - SLOWER
        let punchOffset = 0;
        if (this.isAttacking) {
            this.attackFrame += 0.05; // SIGNIFICANTLY SLOWER

            if (this.attackType === 'punch') {
                punchOffset = 25 * Math.sin(this.attackFrame * Math.PI * 2);
                arm = -1.5;
            } else if (this.attackType === 'kick') {
                legR = -1.5 * Math.sin(this.attackFrame * Math.PI * 2);
            } else if (this.attackType === 'combo_triple_punch') {
                // Fast flurry
                punchOffset = 30 * Math.sin(this.attackFrame * Math.PI * 8); // Was *3
                arm = -1.5;
            } else if (this.attackType === 'combo_spin_kick') {
                // Spin body
                bodyRot = this.attackFrame * Math.PI * 4; // Was *2
                legR = -2.0;
            } else if (this.attackType === 'combo_uppercut') {
                // Upward punch
                arm = -2.5 * Math.sin(this.attackFrame * Math.PI);
            }
        }

        // --- DRAWING STICKMAN ---
        ctx.rotate(bodyRot);

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
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legL) * 20, 45 + Math.cos(legL) * 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legR) * 20, 45 + Math.cos(legR) * 5); ctx.stroke();

        // Arms
        ctx.beginPath(); ctx.moveTo(0, -15);
        if ((this.attackType === 'punch' || this.attackType === 'combo_triple_punch') && this.isAttacking) {
            ctx.lineTo(25 + punchOffset, -15);
        } else if (this.attackType === 'combo_uppercut' && this.isAttacking) {
            ctx.lineTo(20, -40); // Upward
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
            const hpBar = document.getElementById('localHealth');
            const scText = document.getElementById('localScore');
            if (hpBar) hpBar.style.width = this.health + '%';
            if (scText) scText.textContent = this.score;
        }
    }
}

// --- NETWORK (PeerJS) ---
const Network = {
    peer: null,
    conn: null,

    init(username, isHost, targetId) {
        const peerOpt = isHost ? {
            debug: 1,
            id: generateRoomCode()
        } : { debug: 1 };

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
            location.reload(); // Simple handle for now
        });
    },

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }
};

function generateRoomCode() {
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
            opp.username = data.username;
            console.log("Received handshake from", data.username);

            if (localPlayer.id === 'local_host') {
                Network.send({
                    type: 'handshake_ack',
                    username: localPlayer.username
                });
                showToast(`${data.username} Joined!`);
                if (!isGameStarted) startGameUI();
            }
            break;

        case 'handshake_ack':
            opp.username = data.username;
            showToast(`Connected to ${data.username}!`);
            if (!isGameStarted) startGameUI();
            break;

        case 'update':
            // Interpolate?
            opp.x = data.x;
            opp.y = data.y;
            opp.facing = data.facing;
            opp.velX = data.velX;
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

        // Show after delay
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
    document.getElementById('roomControls').style.display = 'none';
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
        return;
    }

    if (isPaused || !isGameStarted) return;

    keys[e.key.toLowerCase()] = true;

    const k = e.key.toLowerCase();

    if (k === 'i') localPlayer.punch();
    if (k === 'o') localPlayer.kick();
    if (k === 'p') localPlayer.shoot();

    if (k === 'shift' && !localPlayer.isGrounded) localPlayer.startDash();
});

window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function update() {
    if (!isGameStarted) return;
    requestAnimationFrame(update);

    if (isPaused) return;

    // Safety
    if (canvas.width === 0) resizeCanvas();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Environment
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    ctx.strokeStyle = '#4CAF50'; ctx.beginPath(); ctx.moveTo(0, canvas.height - 34); ctx.lineTo(canvas.width, canvas.height - 34); ctx.stroke();

    // Local Input Handle (Continuous)
    if (localPlayer) {
        if (keys['a']) localPlayer.move('left');
        else if (keys['d']) localPlayer.move('right');

        if (keys[' ']) localPlayer.jump();

        if (keys['q']) localPlayer.startDash();

        localPlayer.update();
        localPlayer.draw(true);

        // Sync (Throttled?)
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

// --- MENUS & EVENTS ---
function toggleSettings() {
    const isVisible = settingsModal.style.display !== 'none';
    settingsModal.style.display = isVisible ? 'none' : 'flex';
}

document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
document.getElementById('pauseSettingsBtn').addEventListener('click', () => {
    // Hide pause menu, show settings
    toggleSettings();
});

// Settings Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value;
    if (!name) return alert("Name Required");

    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('hostArea').style.display = 'block';

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

    localPlayer = new Stickman(800, 300, "#58a6ff", 'local_client');
    localPlayer.facing = -1;
    localPlayer.username = name;
});

document.getElementById('connectBtn').addEventListener('click', () => {
    const id = document.getElementById('destRoomId').value.toUpperCase();
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