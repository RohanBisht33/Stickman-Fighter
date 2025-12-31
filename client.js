import { GAME_WIDTH, GAME_HEIGHT, CanvasState, resizeCanvas } from './js/Render.js';
import { NetworkManager } from './js/Network.js';
import { Stickman } from './js/Stickman.js';
import { setupInputs, keys, mobileKeys } from './js/Input.js';
import { UI, setupUI } from './js/UI.js';

// --- MAIN GAME CONTROLLER ---
const Network = new NetworkManager();

let localPlayer = null;
let remotePlayers = {};
let isGameStarted = false;
let isPaused = false;
let isGameOver = false;

// --- INITIALIZATION ---
window.addEventListener('load', () => {
    resizeCanvas();
    setupInputs(() => localPlayer);
    setupUI({
        resume: () => { isPaused = false; UI.togglePause(false); },
        requestRematch: () => Network.send({ type: 'rematch_req' }),
        acceptRematch: () => {
            resetGame();
            Network.send({ type: 'rematch_ack' });
        }
    });

    // Menu Buttons
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        console.log('Create Room button clicked');
        const name = document.getElementById('usernameInput').value;
        if (!name) return alert("Name Required");

        console.log('Creating room for:', name);
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('roomControls').style.display = 'block';
        document.getElementById('hostArea').style.display = 'block';

        localPlayer = new Stickman(100, 300, "#58a6ff", 'local_host');
        localPlayer.username = name;
        localPlayer.setNetwork(Network);
        localPlayer.setOpponentProvider(() => remotePlayers['opponent']); // Provider pattern
        localPlayer.setWinCallback(checkWinCondition);

        console.log('Initializing network...');
        Network.init(name, true, null);
        Network.onData = handleData;
        console.log('Network initialized');
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
        localPlayer.setNetwork(Network);
        localPlayer.setOpponentProvider(() => remotePlayers['opponent']);
        localPlayer.setWinCallback(checkWinCondition);
    });

    document.getElementById('connectBtn').addEventListener('click', () => {
        const id = document.getElementById('destRoomId').value.toUpperCase();
        const name = document.getElementById('usernameInput').value;
        if (!id) return;
        Network.init(name, false, id);
        Network.onData = handleData;
        document.getElementById('joinStatus').textContent = "Connecting...";
    });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        isPaused = !isPaused;
        UI.togglePause(isPaused);
    }
});


// --- GAME LOOP ---
function update() {
    if (!isGameStarted) return;
    requestAnimationFrame(update);

    if (isPaused) return;
    // Check resize occasionally or rely on event
    // CanvasState.width/height are updated in resizeCanvas

    const ctx = CanvasState.ctx;
    ctx.clearRect(0, 0, CanvasState.canvas.width, CanvasState.canvas.height);

    // 1. Draw Environment (ABSOLUTE)
    const visualFloorY = CanvasState.offsetY + (GAME_HEIGHT - 34) * CanvasState.scale + 28;
    const visualFloorH = 34 * CanvasState.scale;

    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, visualFloorY, CanvasState.canvas.width, visualFloorH + 1000);
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2 * CanvasState.scale;
    ctx.beginPath();
    ctx.moveTo(0, visualFloorY);
    ctx.lineTo(CanvasState.canvas.width, visualFloorY);
    ctx.stroke();

    // 2. Transformed World
    ctx.save();
    ctx.translate(CanvasState.offsetX, CanvasState.offsetY);
    ctx.scale(CanvasState.scale, CanvasState.scale);

    if (localPlayer) {
        if (keys['a'] || mobileKeys['left']) localPlayer.move('left');
        else if (keys['d'] || mobileKeys['right']) localPlayer.move('right');
        if (keys[' '] || mobileKeys['jump']) localPlayer.jump();

        // Pass dash input state if needed for lock logic, though we handled it in Stickman.update
        // Actually Input.js updates mobileKeys directly, Stickman reads it.
        // We need to pass the current input state to update() if we want dependency injection,
        // but Stickman reads global keys currently? 
        // In my Stickman module refactor, I made it check `inputs`.
        // Let's pass the combined inputs.

        const currentInputs = { ...keys, ...mobileKeys };
        localPlayer.update(currentInputs);
        localPlayer.draw(ctx, true);

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
        opp.update(); // Remote player update mainly for projectiles? 
        // Remote physics are usually just interpolation or naive position setting.
        // For simplicity, we assume they are just visual puppets updated by network,
        // BUT they might have local projectiles to update.
        opp.draw(ctx);
    }

    ctx.restore();
}

// --- NETWORK HANDLERS ---
function handleData(data) {
    if (!remotePlayers['opponent']) {
        remotePlayers['opponent'] = new Stickman(0, 0, "red", 'opponent');
        // Remote players don't need network sender usually, unless they reflect hits?
        // But here we might just receive data.
    }
    const opp = remotePlayers['opponent'];

    switch (data.type) {
        case 'handshake':
            opp.username = data.username;
            if (localPlayer.id === 'local_host') {
                Network.send({ type: 'handshake_ack', username: localPlayer.username });
                UI.showToast(`${data.username} Joined!`);
                if (!isGameStarted) startGameUI();
            }
            break;

        case 'handshake_ack':
            opp.username = data.username;
            UI.showToast(`Connected to ${data.username}!`);
            if (!isGameStarted) startGameUI();
            break;

        case 'update':
            // MIRROR LOGIC
            opp.x = GAME_WIDTH - data.x - opp.width;
            opp.y = data.y;
            opp.facing = -data.facing;
            opp.velX = -data.velX;
            opp.health = data.health;
            break;

        case 'attack':
            if (data.attackType === 'shoot') {
                // Mirror logic for X and Velocity
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

function startGameUI() {
    UI.startGame();
    document.getElementById('roomControls').style.display = 'none';
    isGameStarted = true;
    resizeCanvas();
    update();
}

function resetGame() {
    isGameOver = false;
    isPaused = false;
    UI.hideRematchScreen();
    document.getElementById('acceptRematchBtn').style.display = 'none';

    localPlayer.reset();
    localPlayer.x = 100;
    if (remotePlayers['opponent']) remotePlayers['opponent'].reset();
}

function checkWinCondition() {
    if ((localPlayer.health <= 0 || (remotePlayers['opponent'] && remotePlayers['opponent'].health <= 0)) && !isGameOver) {
        isGameOver = true;
        isPaused = true;
        const winner = localPlayer.health > 0 ? "YOU WIN" : "YOU LOSE";
        UI.showRematchScreen(winner);
    }
}