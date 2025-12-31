import { GAME_WIDTH, GAME_HEIGHT, CanvasState, resizeCanvas } from './js/Render.js';
import { Stickman } from './js/Stickman.js';
import { setupInputs, keys, mobileKeys } from './js/Input.js';

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- TEST CLIENT MAIN ---
let localPlayer = null;
let remotePlayers = {};
let isGameStarted = false;
let hasLoggedOnce = false;
let frameCount = 0;
let hasRuntimeErrorShown = false;

// Initialize IMMEDIATELY (Module is deferred automatically)
try {
    console.log("Initializing Test Mode (Immediate)...");

    // Force Canvas Init
    resizeCanvas();
    if (!CanvasState.canvas) throw new Error("Canvas not found in DOM");

    // 1. Initialize Local Player
    localPlayer = new Stickman(200, 300, "#58a6ff", 'local_testing');
    localPlayer.username = "Tester";
    localPlayer.setOpponentProvider(() => remotePlayers['opponent']);

    // 2. Initialize Dummy Opponent
    remotePlayers['opponent'] = new Stickman(800, 300, "red", 'opponent_dummy');
    remotePlayers['opponent'].username = "Dummy";
    remotePlayers['opponent'].facing = -1;

    // 3. Inputs
    setupInputs(() => localPlayer);

    // 4. Start Game Loop
    isGameStarted = true;

    // Force Mobile Controls Visuals if Mobile
    if (window.innerWidth < 1024) {
        const mobCtrl = document.getElementById('mobileControls');
        if (mobCtrl) mobCtrl.style.display = 'flex';
    }

    // Start Loop
    update();

} catch (err) {
    alert("TEST MODE ERROR: " + err.message + "\n" + err.stack);
    console.error(err);
}


// Debugging flags
// let hasLoggedOnce = false; // Already declared at top
// let hasRuntimeErrorShown = false; // Already declared at top

function update() {
    if (hasRuntimeErrorShown) return; // Stop loop on error

    requestAnimationFrame(update);
    const ctx = CanvasState.ctx;

    try {
        // Safety check
        if (!ctx) {
            if (!hasLoggedOnce) console.log("Waiting for Context...");
            resizeCanvas();
            return;
        }

        if (!hasLoggedOnce) {
            console.log("First Frame Render:");
            console.log("Canvas Dims:", CanvasState.canvas.width, CanvasState.canvas.height);
            console.log("World Constants:", GAME_WIDTH, GAME_HEIGHT);
            console.log("Scale/Offset:", CanvasState.scale, CanvasState.offsetX, CanvasState.offsetY);
            console.log("Player:", localPlayer);
            hasLoggedOnce = true;
        }

        // 0. Fill Background explicitly (No Clear)
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, CanvasState.canvas.width, CanvasState.canvas.height);

        // 1. Draw Environment (ABSOLUTE)
        const visualFloorY = CanvasState.offsetY + (GAME_HEIGHT - 34) * CanvasState.scale + 28;
        const visualFloorH = 34 * CanvasState.scale;

        ctx.fillStyle = '#222';
        ctx.fillRect(0, visualFloorY, CanvasState.canvas.width, visualFloorH + 1000);

        // Draw debugging floor line
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

        // Debug Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        if (localPlayer) {
            if (keys['a'] || mobileKeys['left']) localPlayer.move('left');
            else if (keys['d'] || mobileKeys['right']) localPlayer.move('right');
            if (keys[' '] || mobileKeys['jump']) localPlayer.jump();

            const currentInputs = { ...keys, ...mobileKeys };
            localPlayer.update(currentInputs);
            localPlayer.draw(ctx, true); // Pass ctx
        }

        if (remotePlayers['opponent']) {
            const opp = remotePlayers['opponent'];
            opp.update();
            opp.draw(ctx); // Pass ctx
        }

        ctx.restore();

        frameCount++;
        // if(frameCount % 120 === 0) console.log("Frame " + frameCount + " rendered");

    } catch (e) {
        hasRuntimeErrorShown = true;
        console.error(e);
        alert("RUNTIME ERROR:\n" + e.message + "\n" + e.stack);
    }
}
