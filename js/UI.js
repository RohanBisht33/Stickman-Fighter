export const UI = {
    toastEl: document.getElementById('toast'),
    settingsModal: document.getElementById('settingsModal'),
    pauseMenu: document.getElementById('pauseMenu'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    rematchModal: document.getElementById('rematchModal'),

    showToast(msg) {
        if (this.toastEl) {
            this.toastEl.textContent = msg;
            this.toastEl.classList.add('show');
            setTimeout(() => this.toastEl.classList.remove('show'), 3000);
        }
    },

    toggleSettings() {
        if (this.settingsModal) {
            const isVisible = this.settingsModal.style.display !== 'none';

            if (isVisible) {
                // Closing settings
                this.settingsModal.style.display = 'none';
                // If we were paused, show pause menu again
                // We need to know if we are paused. We can check the pause menu display style?
                // Or better, just ensure pause menu is visible if it was the context.
                // But toggleSettings is used from Main Menu too.
                // Simple fix: If we are closing settings, check if we are 'paused' in client?
                // For now, let's just Close. The user can hit Escape or Resume.
                // Actually, if opened from Pause Menu, we want to go back to Pause Menu?
                // Let's rely on the caller or just bring Pause Menu to front if active.
                if (window.isGamePaused) { // We can attach this state or check element
                    if (this.pauseMenu) this.pauseMenu.style.display = 'flex';
                }
            } else {
                // Opening settings
                this.settingsModal.style.display = 'flex';
                // Hide pause menu temporarily if it's open (layering fix)
                if (this.pauseMenu) this.pauseMenu.style.display = 'none';
            }
        }
    },

    togglePause(isPaused) {
        if (this.pauseMenu) {
            this.pauseMenu.style.display = isPaused ? 'flex' : 'none';
            // Also ensure settings is closed if we unpause
            if (!isPaused && this.settingsModal) this.settingsModal.style.display = 'none';

            // Expose state for UI helper
            window.isGamePaused = isPaused;
        }
    },

    showRematchScreen(winner) {
        if (this.rematchModal) {
            document.getElementById('winnerText').textContent = winner;
            document.getElementById('rematchStatus').textContent = "";
            document.getElementById('acceptRematchBtn').style.display = 'none';
            this.rematchModal.style.display = 'flex';
        }
    },

    hideRematchScreen() {
        if (this.rematchModal) this.rematchModal.style.display = 'none';
    },

    startGame() {
        if (this.welcomeScreen) this.welcomeScreen.style.display = 'none';
        const rc = document.getElementById('roomControls');
        if (rc) rc.style.display = 'none';
    }
};

// Bind UI buttons
export function setupUI(gameController) {
    document.getElementById('settingsBtn')?.addEventListener('click', () => UI.toggleSettings());
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => UI.toggleSettings());
    document.getElementById('pauseSettingsBtn')?.addEventListener('click', () => UI.toggleSettings());

    document.getElementById('resumeBtn')?.addEventListener('click', () => gameController.resume());
    document.getElementById('quitBtn')?.addEventListener('click', () => location.reload());

    document.getElementById('rematchBtn')?.addEventListener('click', () => {
        document.getElementById('rematchStatus').textContent = "Waiting for Opponent...";
        gameController.requestRematch();
    });

    document.getElementById('acceptRematchBtn')?.addEventListener('click', () => {
        gameController.acceptRematch();
    });

    document.getElementById('copyBtn')?.addEventListener('click', () => {
        const idText = document.getElementById('myRoomId')?.textContent;
        if (idText) {
            navigator.clipboard.writeText(idText).then(() => {
                UI.showToast("Room ID Copied!");
            }).catch(err => {
                prompt("Copy this ID:", idText);
            });
        }
    });
}
