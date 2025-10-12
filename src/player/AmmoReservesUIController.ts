import { ReserveBulletParticle } from "../Types";
import { UserInterface } from "../UserInterface";

export class AmmoReservesUIController {
    private ammoReserveIcon: HTMLImageElement | null = null;
    private projectileIcon: HTMLImageElement | null = null;

    public reserveBulletParticles: ReserveBulletParticle[] = [];

    constructor(private ui: UserInterface) { }

    // [ Ammo Reserve Canvas ]
    //
    /**
     * Initializes the ammo reserve canvas in the HUD.
     */
    public initAmmoReserveCanvas(): void { // TODO: Unify where UI element references are stored
        this.ammoReserveIcon = new Image();
        this.ammoReserveIcon.src = '/assets/img/icon/inventory/ammobox.png';
        this.ammoReserveIcon.onload = () => {
            this.renderAmmoReserves();
        };

        this.projectileIcon = new Image();
        this.projectileIcon.src = '/assets/img/icon/inventory/9mm.png';

        // Start physics loop
        requestAnimationFrame(() => this.updateAmmoReservePhysics());
    }

    /**
     * When picking up ammo, this function spawns the casings in the player's ammo reserve UI.
     */
    public spawnAmmoInReserveUI(amount: number = 1): void {
        if (!this.ui.ammoReservesCtx || !this.projectileIcon) return;

        // Time between spawn for visual effect
        const spawnDelay = 100; // ms

        const { collisionHeight, collisionWidth, collisionX, collisionY } = this.getAmmoReserveCollisionZone();

        const x = collisionX + collisionWidth;
        const y = collisionY + collisionHeight / 2;

        for (let i = 0; i < amount; i++) {
            setTimeout(() => {
                const scale = 0.25;
                const bulletWidth = 11 * scale;
                const bulletHeight = 28 * scale;

                // Initial velocity: rightward, with a much wider angle and more random speed
                const speed = 2 + Math.random() * 8; // Speed between 2 and 10
                const angle = (Math.random() - 0.5) * (Math.PI / 3); // Angle between -30° and +30°
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                // Random rotation and torque
                const rotation = Math.random() * Math.PI * 2;
                const torque = (Math.random() - 0.5) * 0.1;

                this.reserveBulletParticles.push({
                    transform: {
                        pos: { x, y },
                        rot: rotation,
                    },
                    velocity: { x: vx, y: vy },
                    torque,
                    width: bulletWidth,
                    height: bulletHeight
                });
            }, i * spawnDelay);
        }
    }

    /**
     * Removes ammo from the reserves UI when ammo is taken from the player's reserves.
     */
    public removeAmmoFromReserveUI(amount: number = 1): void {
        const removeDelay = 100; // ms, match spawnBullet
        for (let i = 0; i < amount; i++) {
            setTimeout(() => {
                if (this.reserveBulletParticles.length > 0) {
                    this.reserveBulletParticles.shift();
                }
            }, i * removeDelay);
        }
    }

    /**
     * Processes ammo reserve physics for the projectiles in the ammo reserve UI.
     */
    private updateAmmoReservePhysics(): void {
        if (!this.ui.ammoReservesCtx || !this.ammoReserveIcon) return;

        // TODO: Add sleeping when they come to a stop and end simulation

        // Physics constants
        const friction = 0.9;
        const bounce = 0.5;

        const { collisionHeight, collisionWidth, collisionX, collisionY } = this.getAmmoReserveCollisionZone();

        // Clear
        this.ui.ammoReservesCtx.clearRect(0, 0, this.ui.ammoReservesCanvas!.width, this.ui.ammoReservesCanvas!.height);

        // Draw background box
        this.ui.ammoReservesCtx.drawImage(
            this.ammoReserveIcon,
            0, 0,
            this.ui.ammoReservesCanvas!.width,
            this.ui.ammoReservesCanvas!.height
        );

        // Update and draw bullets
        for (let bullet of this.reserveBulletParticles) {
            // Physics
            bullet.transform.pos.x += bullet.velocity.x;
            bullet.transform.pos.y += bullet.velocity.y;
            bullet.transform.rot += bullet.torque;

            bullet.velocity.x *= friction;
            bullet.velocity.y *= friction;
            bullet.torque *= friction;

            // Wall collisions
            // Left
            if (bullet.transform.pos.x - bullet.width / 2 < collisionX) {
                bullet.transform.pos.x = collisionX + bullet.width / 2;
                bullet.velocity.x *= -bounce;
            }
            // Right
            if (bullet.transform.pos.x + bullet.width / 2 > collisionX + collisionWidth) {
                bullet.transform.pos.x = collisionX + collisionWidth - bullet.width / 2;
                bullet.velocity.x *= -bounce;
            }
            // Top
            if (bullet.transform.pos.y - bullet.height / 2 < collisionY) {
                bullet.transform.pos.y = collisionY + bullet.height / 2;
                bullet.velocity.y *= -bounce;
            }
            // Bottom
            if (bullet.transform.pos.y + bullet.height / 2 > collisionY + collisionHeight) {
                bullet.transform.pos.y = collisionY + collisionHeight - bullet.height / 2;
                bullet.velocity.y *= -bounce;
            }
        }

        // Optional: bullet-bullet collisions (efficient, skip if <2 bullets)
        for (let i = 0; i < this.reserveBulletParticles.length; i++) {
            for (let j = i + 1; j < this.reserveBulletParticles.length; j++) {
                const a = this.reserveBulletParticles[i];
                const b = this.reserveBulletParticles[j];
                const dx = a.transform.pos.x - b.transform.pos.x;
                const dy = a.transform.pos.y - b.transform.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = (a.width + b.width) / 2;
                if (dist < minDist) {
                    // Simple elastic collision
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDist - dist;
                    const ax = Math.cos(angle) * overlap / 2;
                    const ay = Math.sin(angle) * overlap / 2;

                    a.transform.pos.x += ax;
                    a.transform.pos.y += ay;
                    b.transform.pos.x -= ax;
                    b.transform.pos.y -= ay;

                    // Swap velocities (1D along collision axis)
                    const va = a.velocity.x * Math.cos(angle) + a.velocity.y * Math.sin(angle);
                    const vb = b.velocity.x * Math.cos(angle) + b.velocity.y * Math.sin(angle);
                    const avg = (va + vb) / 2;
                    a.velocity.x += (avg - va) * bounce;
                    b.velocity.x += (avg - vb) * bounce;
                }
            }
        }

        // Draw bullets
        for (let bullet of this.reserveBulletParticles) {
            this.ui.ammoReservesCtx.save();
            this.ui.ammoReservesCtx.translate(bullet.transform.pos.x, bullet.transform.pos.y);
            this.ui.ammoReservesCtx.rotate(bullet.transform.rot);
            this.ui.ammoReservesCtx.drawImage(
                this.projectileIcon!,
                -bullet.width / 2,
                -bullet.height / 2,
                bullet.width,
                bullet.height
            );
            this.ui.ammoReservesCtx.restore();
        }

        requestAnimationFrame(() => this.updateAmmoReservePhysics());
    }

    /**
     * Renders the ammo reserves canvas.
     */
    private renderAmmoReserves(): void {
        if (!this.ui.ammoReservesCtx || !this.ammoReserveIcon || !this.ammoReserveIcon.complete) return;

        // Clear the canvas
        this.ui.ammoReservesCtx.clearRect(0, 0, this.ui.ammoReservesCanvas!.width, this.ui.ammoReservesCanvas!.height);

        // Draw the ammobox icon to fill the entire canvas
        this.ui.ammoReservesCtx.drawImage(
            this.ammoReserveIcon,
            0, 0,
            this.ui.ammoReservesCanvas!.width,
            this.ui.ammoReservesCanvas!.height
        );
    }

    /**
     * Returns the ammo reserves collision zone to help with physics calculations for rendered projectiles.
     */
    private getAmmoReserveCollisionZone(): { collisionHeight: number; collisionWidth: number; collisionX: number; collisionY: number } {
        const collisionWidth = 63;
        const collisionHeight = 27;
        const collisionX = (this.ui.ammoReservesCanvas!.width - collisionWidth) / 2 - 3;
        const collisionY = (this.ui.ammoReservesCanvas!.height - collisionHeight) / 2 - 1;

        const params = { collisionHeight, collisionWidth, collisionX, collisionY };

        return params;
    }
    //
    // #endregion
}