// --- STICKMAN FIGHTER CLIENT ---
// Global State
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const welcomeScreen = document.getElementById("welcomeScreen");
const remotePlayers = {};
let localPlayer = null;
let isGameStarted = false;
let isPaused = false;
let isGameOver = false;

// UI Elements
const pauseMenu = document.getElementById('pauseMenu');
const rematchModal = document.getElementById('rematchModal');
const toastEl = document.getElementById('toast');
const settingsModal = document.getElementById('settingsModal');

// --- CONSTANTS ---
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

// --- UTILS ---
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// Fixed Logical Resolution
function resizeCanvas() {
    // Set internal resolution to Fixed Game World
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);


// --- MOBILE CONTROLS ---
const mobileKeys = {
    left: false, right: false, dash: false, jump: false
};

function setupMobileControls() {
    const ids = ['btnLeft', 'btnRight', 'btnJump', 'btnDash', 'btnPunch', 'btnKick', 'btnFire'];
    const map = {
        'btnLeft': 'left', 'btnRight': 'right', 'btnJump': 'jump', 'btnDash': 'dash',
        'btnPunch': 'punch', 'btnKick': 'kick', 'btnFire': 'fire'
    };

    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const key = map[id];

        const down = (e) => {
            if (e.cancelable) e.preventDefault();
            if (!localPlayer) return;

            if (['left', 'right', 'dash', 'jump'].includes(key)) {
                mobileKeys[key] = true;
                if (key === 'dash' && localPlayer.isGrounded) localPlayer.startDash();
            } else {
                if (key === 'jump') localPlayer.jump();
                if (key === 'punch') localPlayer.punch();
                if (key === 'kick') localPlayer.kick();
                if (key === 'fire') localPlayer.shoot();
            }
        };

        const up = (e) => {
            if (e.cancelable) e.preventDefault();
            if (['left', 'right', 'dash', 'jump'].includes(key)) mobileKeys[key] = false;
        };

        btn.addEventListener('touchstart', down, { passive: false });
        btn.addEventListener('touchend', up, { passive: false });
        btn.addEventListener('mousedown', down);
        btn.addEventListener('mouseup', up);
    });
}
setupMobileControls();

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

        // Combat
        this.isAttacking = false;
        this.attackType = null;
        this.attackFrame = 0;
        this.lastShotTime = 0;
        this.projectiles = [];
        this.comboKeys = [];
        this.lastComboTime = 0;
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
        if (this !== localPlayer) return;

        const now = Date.now();
        if (now - this.lastComboTime > 1000) this.comboKeys = [];
        this.comboKeys.push(key);
        this.lastComboTime = now;
        if (this.comboKeys.length > 5) this.comboKeys.shift();
        this.checkCombos();
    }

    checkCombos() {
        const seq = this.comboKeys.join('');
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

        // --- INPUT HANDLING (Only for Local Player) ---
        if (this === localPlayer) {
            const isHoldingDash = keys['q'] || mobileKeys['dash'];
            if (isHoldingDash && this.canDash && this.dashCooldown === 0 && !this.isDashing) {
                this.startDash();
            }
        }

        // --- PHYSICS ---
        if (this.dashCooldown > 0) this.dashCooldown--;

        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.dashCooldown = 20;
                this.velX *= 0.3;
            } else {
                let dashSpeed = 40;
                if (!this.isGrounded) dashSpeed = 55;
                this.velX = this.facing * dashSpeed;
                this.velY = 0;
            }
        } else {
            this.x += this.velX;
            this.velY += this.gravity;
            this.y += this.velY;
            this.velX *= 0.82;
        }

        // --- WALLS (LOGICAL) ---
        const floorY = GAME_HEIGHT - 34 - this.height;
        if (this.y >= floorY) {
            this.y = floorY;
            this.velY = 0;
            this.isGrounded = true;
            this.jumpsRemaining = 2;
            this.canDash = true;
        } else {
            this.isGrounded = false;
        }

        if (this.x < 0) { this.x = 0; this.velX = 0; }
        if (this.x > GAME_WIDTH - this.width) { this.x = GAME_WIDTH - this.width; this.velX = 0; }

        if (this.jumpCooldown > 0) this.jumpCooldown--;

        this.updateProjectiles();
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

    startDash() {
        if (this.canDash) {
            this.isDashing = true;
            this.dashTimer = 12;
            this.canDash = false;
            if (!this.isGrounded) this.canDash = false;
        }
    }

    punch() {
        if (this.isAttacking) return;
        this.performAttack('punch');
        Network.send({ type: 'attack', attackType: 'punch' });
        this.checkHit(5, 120, 10);
        this.registerComboInput('i');
    }

    kick() {
        if (this.isAttacking) return;
        this.performAttack('kick');
        Network.send({ type: 'attack', attackType: 'kick' });
        this.checkHit(8, 140, 20);
        this.registerComboInput('o');
    }

    shoot() {
        if (Date.now() - this.lastShotTime < 500) return;
        const vx = 20 * this.facing;
        const startX = this.x + 50 + (30 * this.facing);
        const startY = this.y + 40;
        this.spawnProjectile(startX, startY, vx);
        Network.send({ type: 'attack', attackType: 'shoot', x: startX, y: startY, vx: vx });
        this.lastShotTime = Date.now();
    }

    performAttack(type) {
        this.isAttacking = true;
        this.attackType = type;
        this.attackFrame = 0;

        let duration = 300;
        if (type.startsWith('combo')) duration = 1200;
        else if (type === 'kick') duration = 500;
        else if (type === 'punch') duration = 400;

        setTimeout(() => { this.isAttacking = false; }, duration);
    }

    checkHit(damage, range, knockback = 0) {
        const enemy = remotePlayers['opponent'];
        if (enemy) {
            const dx = enemy.x - this.x;
            const inFront = (this.facing === 1 && dx > -50) || (this.facing === -1 && dx < 50);
            const dist = Math.hypot((enemy.x + 50) - (this.x + 50), (enemy.y + 50) - (this.y + 50));

            if (dist < range && inFront) {
                enemy.health = Math.max(0, enemy.health - damage);
                this.score += damage;

                // Recoil
                if (knockback > 0) {
                    enemy.velX = this.facing * knockback;
                    enemy.velY = -5;
                }

                Network.send({
                    type: 'hit',
                    newHealth: enemy.health,
                    knockbackX: this.facing * knockback,
                    knockbackY: -5
                });

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

            if (this === localPlayer) {
                const enemy = remotePlayers['opponent'];
                if (enemy) {
                    if (p.x > enemy.x + 20 && p.x < enemy.x + 80 &&
                        p.y > enemy.y && p.y < enemy.y + 100) {
                        enemy.health = Math.max(0, enemy.health - p.damage);
                        Network.send({
                            type: 'hit',
                            newHealth: enemy.health,
                            knockbackX: p.vx > 0 ? 5 : -5,
                            knockbackY: -2
                        });
                        checkWinCondition();
                        p.life = 0;
                    }
                }
            }
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    draw(isLocal = false) {
        // --- VISUAL FIX ---
        // Render at 1:1 Scale because Canvas is already sized to Logical Res (1280x720)
        // CSS handles the display scaling.

        ctx.save();
        ctx.translate(this.x + (this.width / 2), this.y + (this.height / 2));
        ctx.scale(this.facing, 1);

        let legL = 0, legR = 0, arm = 0;
        let bodyRot = 0;

        if (this.isDashing) {
            legL = 1.0; legR = 0.5; arm = 1.5;
            ctx.globalAlpha = 0.7;
        } else if (Math.abs(this.velX) > 0.5 && this.isGrounded) {
            this.walkFrame += 0.2;
            legL = Math.sin(this.walkFrame);
            legR = Math.sin(this.walkFrame + Math.PI);
            arm = -Math.sin(this.walkFrame);
        } else if (!this.isGrounded) {
            legL = 0.5; legR = -0.2; arm = -1.5;
        }

        let punchOffset = 0;
        if (this.isAttacking) {
            this.attackFrame += 0.05;
            if (this.attackType === 'punch') {
                punchOffset = 25 * Math.sin(this.attackFrame * Math.PI * 2);
                arm = -1.5;
            } else if (this.attackType === 'kick') {
                legR = -1.5 * Math.sin(this.attackFrame * Math.PI * 2);
            } else if (this.attackType === 'combo_triple_punch') {
                punchOffset = 30 * Math.sin(this.attackFrame * Math.PI * 8);
                arm = -1.5;
            } else if (this.attackType === 'combo_spin_kick') {
                bodyRot = this.attackFrame * Math.PI * 4;
                legR = -2.0;
            } else if (this.attackType === 'combo_uppercut') {
                arm = -2.5 * Math.sin(this.attackFrame * Math.PI);
            }
        }

        ctx.rotate(bodyRot);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.fillStyle = this.color;
        // Draw centered
        ctx.beginPath(); ctx.arc(0, -35, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(0, 15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legL) * 20, 45 + Math.cos(legL) * 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(Math.sin(legR) * 20, 45 + Math.cos(legR) * 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -15);
        if ((this.attackType === 'punch' || this.attackType === 'combo_triple_punch') && this.isAttacking) {
            ctx.lineTo(25 + punchOffset, -15);
        } else if (this.attackType === 'combo_uppercut' && this.isAttacking) {
            ctx.lineTo(20, -40);
        } else {
            ctx.lineTo(15, 10 + arm * 10);
        }
        ctx.stroke();

        ctx.restore();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 3;
        for (let p of this.projectiles) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx * 1.5), p.y); ctx.stroke();
        }

        ctx.fillStyle = "white"; ctx.font = "14px 'Orbitron'"; ctx.textAlign = "center";

        ctx.fillText(this.username, this.x + 50, this.y - 20);

        // Local UI Sync
        if (isLocal) {
            const hpBar = document.getElementById('localHealth');
            const scText = document.getElementById('localScore');
            if (hpBar) hpBar.style.width = this.health + '%';
            if (scText) scText.textContent = this.score;
        }
    }
}

// --- FULLSCREEN & NETWORK ---
function requestFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;
    const request = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    if (request) request.call(docEl);
}

document.addEventListener('touchstart', () => {
    if (!document.fullscreenElement && window.innerWidth < 1024) {
        requestFullScreen();
    }
}, { once: true });

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
            if (this.conn && this.conn.open) this.conn.close();
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
            if (localPlayer.id === 'local_host') {
                remotePlayers['opponent'] = null;
                resetGame();
            } else {
                alert("Host Closed Room");
                location.reload();
            }
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
            if (localPlayer.id === 'local_host') {
                Network.send({ type: 'handshake_ack', username: localPlayer.username });
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
            // MIRROR LOGIC:
            opp.x = GAME_WIDTH - data.x - opp.width;
            opp.y = data.y;
            opp.facing = -data.facing;
            opp.velX = -data.velX;
            opp.health = data.health;
            break;

        case 'attack':
            if (data.attackType === 'shoot') {
                opp.spawnProjectile(GAME_WIDTH - data.x, data.y, -data.vx);
            } else {
                opp.performAttack(data.attackType);
            }
            break;

        case 'hit':
            if (localPlayer) {
                localPlayer.health = data.newHealth;
                if (data.knockbackX) localPlayer.velX = -data.knockbackX;
                if (data.knockbackY) localPlayer.velY = data.knockbackY;
                checkWinCondition();
            }
            break;

        case 'rematch_req':
            document.getElementById('rematchStatus').textContent = "Opponent wants Rematch!";
            document.getElementById('acceptRematchBtn').style.display = 'block';
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
        document.getElementById('rematchStatus').textContent = "";
        document.getElementById('acceptRematchBtn').style.display = 'none';

        setTimeout(() => {
            rematchModal.style.display = 'flex';
        }, 1000);
    }
}

function resetGame() {
    isGameOver = false;
    isPaused = false;
    rematchModal.style.display = 'none';
    document.getElementById('acceptRematchBtn').style.display = 'none';

    localPlayer.reset();
    localPlayer.x = 100; // Left spawn (Mirrored)

    if (remotePlayers['opponent']) remotePlayers['opponent'].reset();
}

function startGameUI() {
    welcomeScreen.style.display = 'none';
    document.getElementById('roomControls').style.display = 'none';
    isGameStarted = true;
    resizeCanvas();
    // Force immediate first draw
    update();
}

// --- INPUT & LOOP ---
const keys = {};

window.addEventListener('keydown', (e) => {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Environment
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(0, GAME_HEIGHT - 34, GAME_WIDTH, 34);
    ctx.strokeStyle = '#4CAF50'; ctx.beginPath(); ctx.moveTo(0, GAME_HEIGHT - 34); ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 34); ctx.stroke();

    if (localPlayer) {
        if (keys['a'] || mobileKeys['left']) localPlayer.move('left');
        else if (keys['d'] || mobileKeys['right']) localPlayer.move('right');
        if (keys[' '] || mobileKeys['jump']) localPlayer.jump();

        localPlayer.update();
        localPlayer.draw(true);

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
document.getElementById('pauseSettingsBtn').addEventListener('click', () => { toggleSettings(); });

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
    localPlayer = new Stickman(100, 300, "#58a6ff", 'local_client');
    localPlayer.facing = 1;
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

document.getElementById('resumeBtn').addEventListener('click', () => { isPaused = false; pauseMenu.style.display = 'none'; });
document.getElementById('quitBtn').addEventListener('click', () => location.reload());
document.getElementById('rematchBtn').addEventListener('click', () => {
    document.getElementById('rematchStatus').textContent = "Waiting for Opponent...";
    Network.send({ type: 'rematch_req' });
});

document.getElementById('acceptRematchBtn').addEventListener('click', () => {
    resetGame();
    Network.send({ type: 'rematch_ack' });
});

document.getElementById('exitMatchBtn').addEventListener('click', () => location.reload());