export const keys = {};
export const mobileKeys = {
    left: false, right: false, dash: false, jump: false,
    punch: false, kick: false, fire: false
};

export function setupInputs(localPlayerProvider) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        // We handle Pause/Escape in Main, but movement here
        keys[e.key.toLowerCase()] = true;

        const player = localPlayerProvider();
        if (!player) return;

        const k = e.key.toLowerCase();
        if (k === 'i') player.punch();
        if (k === 'o') player.kick();
        if (k === 'p') player.shoot();
        if (k === 'shift' && !player.isGrounded) player.startDash();
    });

    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Mobile
    setupMobileControls(localPlayerProvider);
}

function setupMobileControls(localPlayerProvider) {
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
            const player = localPlayerProvider();
            if (!player) return;

            if (['left', 'right', 'dash', 'jump'].includes(key)) {
                mobileKeys[key] = true;
                if (key === 'dash' && player.isGrounded) player.startDash();
            } else {
                if (key === 'jump') player.jump();
                if (key === 'punch') player.punch();
                if (key === 'kick') player.kick();
                if (key === 'fire') player.shoot();
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
