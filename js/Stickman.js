import { GAME_WIDTH, GAME_HEIGHT, CanvasState } from './Render.js';
// Network is injected via setNetwork, no static import needed.

// UI helpers
const showToast = (msg) => {
    const el = document.getElementById('toast');
    if (el) {
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 3000);
    }
}

export class Stickman {
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
        this.dashInputLock = false;

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

    setNetwork(net) {
        this.network = net;
    }

    setOpponentProvider(fn) {
        this.getOpponent = fn;
    }

    setWinCallback(fn) {
        this.checkWin = fn;
    }

    registerComboInput(key) {
        // Only local
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
            if (this.network) this.network.send({ type: 'attack', attackType: 'combo_triple_punch' });
            this.comboKeys = [];
        } else if (seq.endsWith('ooo')) {
            showToast("SPIN KICK!");
            this.performAttack('combo_spin_kick');
            if (this.network) this.network.send({ type: 'attack', attackType: 'combo_spin_kick' });
            this.comboKeys = [];
        } else if (seq.endsWith('io')) {
            showToast("UPPERCUT!");
            this.performAttack('combo_uppercut');
            if (this.network) this.network.send({ type: 'attack', attackType: 'combo_uppercut' });
            this.comboKeys = [];
        }
    }

    update(inputs) {
        if (this.health <= 0) return;

        // --- INPUT HANDLING (Injectable) ---
        if (inputs) {
            const isHoldingDash = inputs.dash;
            if (isHoldingDash) {
                if (!this.dashInputLock && this.canDash && this.dashCooldown === 0 && !this.isDashing) {
                    this.startDash();
                    this.dashInputLock = true;
                }
            } else {
                this.dashInputLock = false;
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
                let dashSpeed = 45;
                if (!this.isGrounded) dashSpeed = 60;
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
            this.dashTimer = 15;
            this.canDash = false;

            let dashSpeed = 45;
            if (!this.isGrounded) dashSpeed = 60;
            this.velX = this.facing * dashSpeed;

            if (!this.isGrounded) this.canDash = false;
        }
    }

    punch() {
        if (this.isAttacking) return;
        this.performAttack('punch');
        if (this.network) this.network.send({ type: 'attack', attackType: 'punch' });
        this.checkHit(5, 120, 10);
        this.registerComboInput('i');
    }

    kick() {
        if (this.isAttacking) return;
        this.performAttack('kick');
        if (this.network) this.network.send({ type: 'attack', attackType: 'kick' });
        this.checkHit(8, 140, 20);
        this.registerComboInput('o');
    }

    shoot() {
        if (Date.now() - this.lastShotTime < 500) return;
        const vx = 20 * this.facing;
        const startX = this.x + 50 + (30 * this.facing);
        const startY = this.y + 40;
        this.spawnProjectile(startX, startY, vx);
        if (this.network) this.network.send({ type: 'attack', attackType: 'shoot', x: startX, y: startY, vx: vx });
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
        if (!this.getOpponent) return;
        const enemy = this.getOpponent();

        if (enemy) {
            const dx = enemy.x - this.x;
            const inFront = (this.facing === 1 && dx > -50) || (this.facing === -1 && dx < 50);
            const dist = Math.hypot((enemy.x + 50) - (this.x + 50), (enemy.y + 50) - (this.y + 50));

            if (dist < range && inFront) {
                enemy.health = Math.max(0, enemy.health - damage);
                this.score += damage;

                if (knockback > 0) {
                    enemy.velX = this.facing * knockback;
                    enemy.velY = -5;
                }

                if (this.network) {
                    this.network.send({
                        type: 'hit',
                        newHealth: enemy.health,
                        knockbackX: this.facing * knockback,
                        knockbackY: -5
                    });
                }

                if (this.checkWin) this.checkWin();
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

            // Host logic for hit detection could happen here too, but we keep it simple: 
            // Local player checks if THEIR hits landed
            if (this.network) { // Implicitly means this is a playable character checking against opponent
                const enemy = this.getOpponent ? this.getOpponent() : null;
                if (enemy) {
                    if (p.x > enemy.x + 20 && p.x < enemy.x + 80 &&
                        p.y > enemy.y && p.y < enemy.y + 100) {
                        enemy.health = Math.max(0, enemy.health - p.damage);

                        if (this.network) {
                            this.network.send({
                                type: 'hit',
                                newHealth: enemy.health,
                                knockbackX: p.vx > 0 ? 5 : -5,
                                knockbackY: -2
                            });
                        }
                        if (this.checkWin) this.checkWin();
                        p.life = 0;
                    }
                }
            }
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    draw(ctx, isLocal = false) {
        // const ctx = CanvasState.ctx; // REMOVED implicit dependency

        // Safety check for coordinates
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`Stickman ${this.id} has invalid coords:`, this.x, this.y);
            this.x = this.baseX || 100;
            this.y = this.baseY || 100;
        }

        const face = this.facing || 1;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.save();
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(face * 1.5, 1.5);

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
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.fillStyle = this.color;
        // Draw centered body
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
            ctx.beginPath(); ctx.moveTo(p.x - this.x, p.y - this.y); ctx.lineTo(p.x - this.x - (p.vx * 1.5), p.y - this.y); ctx.stroke();
        }

        ctx.fillStyle = "white"; ctx.font = "14px 'Orbitron'"; ctx.textAlign = "center";

        ctx.fillText(this.username, this.width / 2, -45);

        if (isLocal) {
            const hpBar = document.getElementById('localHealth');
            const scText = document.getElementById('localScore');
            if (hpBar) hpBar.style.width = this.health + '%';
            if (scText) scText.textContent = this.score;
        }

        ctx.restore();
    }
}
