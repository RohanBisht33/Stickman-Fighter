export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 900;

export const CanvasState = {
    canvas: null,
    ctx: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0
};

// Initialize manually or on first resize
function initCanvas() {
    if (!CanvasState.canvas) {
        CanvasState.canvas = document.getElementById("gameCanvas");
        if (CanvasState.canvas) {
            CanvasState.ctx = CanvasState.canvas.getContext("2d");
        }
    }
}

export function resizeCanvas() {
    initCanvas();
    const canvas = CanvasState.canvas;
    if (!canvas) return;

    const container = document.querySelector(".game-container");
    const w = container?.clientWidth || window.innerWidth;
    const h = container?.clientHeight || window.innerHeight;

    canvas.width = w;
    canvas.height = h;

    CanvasState.scale = Math.min(
        w / GAME_WIDTH,
        h / GAME_HEIGHT
    );

    CanvasState.offsetX = (w - GAME_WIDTH * CanvasState.scale) / 2;
    CanvasState.offsetY = (h - GAME_HEIGHT * CanvasState.scale) / 2;
}

