import { CANVAS, DECALS, OBJECT_DEFAULTS, PARTICLES, SFX, SHRAPNEL } from "../Config";

import { AmmoReservesUIController } from "./AmmoReservesUIController";
import { Animator } from "../Animator";
import { AudioManager } from "../AudioManager";
import { CollisionsManager } from "../CollisionsManager";
import { DecalsManager } from "../DecalsManager";
import { AttackType, EmitterParams, Projectile, ProjectileOverrides, SetSliderParams, Shrapnel, Vec2 } from "../Types";
import { GameState } from "../GameState";
import { LuckController } from "./LuckController";
import { ParticlesManager } from "../ParticlesManager";
import { PlayerState } from "./PlayerState";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";

export class CombatController {
    public projectiles: Map<string, Projectile> = new Map();

    constructor(
        private ammoReservesUIController: AmmoReservesUIController,
        private animator: Animator,
        private audioManager: AudioManager,
        private collisionsManager: CollisionsManager,
        private decalsManager: DecalsManager,
        private gameState: GameState,
        private luckController: LuckController,
        private particlesManager: ParticlesManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility
    ) { }

    // #region [ Attack ]
    /**
     * Entrypoint for triggering attacks based on type needed.
     */
    public triggerAttack(type: AttackType): void {
        switch (type) {
            case 'melee':
                this.startMelee();
                break;
            case 'ranged':
                this.startBurst();
                break;
            default:
                console.warn(`Unknown attack type: ${type}`);
                break;
        }
    }

    /**
     * Responsible for what happens during attack actions.
     */
    public updateAttack(delta: number): void {
        if (!this.gameState.gameInProgress || this.playerState.myPlayer.stats.health.value <= 0) return;

        const currentTime = Date.now();

        // Handle reload
        if (this.playerState.isReloading) {
            if (currentTime >= this.playerState.reloadStartTime + this.playerState.myPlayer.actions.primary.reload.time) { // Reload complete
                this.finishReload();
            }
            return; // Can't shoot while reloading
        }

        // Handle ongoing burst
        if (this.playerState.isBurstActive && currentTime >= this.playerState.nextBurstShotTime) {
            // Check if we still have ammo and haven't finished the intended burst amount
            const ammoNeeded = this.playerState.myPlayer.actions.primary.burst.amount;
            if (this.playerState.myPlayer.actions.primary.magazine.currentAmmo > 0 && this.playerState.currentBurstShot < ammoNeeded) {
                const angle = this.playerState.myPlayer.transform.rot - Math.PI / 2;
                const targetDir = { x: Math.cos(angle), y: Math.sin(angle) };

                const triggeredUniques = this.triggerBurstUniques();
                if (triggeredUniques.length === 0) {
                    this.launchProjectile(targetDir);
                }

                this.playerState.currentBurstShot++;
                this.playerState.myPlayer.actions.primary.magazine.currentAmmo--; // Use 1 ammo per shot in burst

                console.log(`Burst shot ${this.playerState.currentBurstShot}! Magazine: ${this.playerState.myPlayer.actions.primary.magazine.currentAmmo}/${this.playerState.myPlayer.actions.primary.magazine.size}, Inventory: ${this.playerState.myPlayer.actions.primary.magazine.currentReserve}/${this.playerState.myPlayer.actions.primary.magazine.maxReserve}`);

                if (this.playerState.currentBurstShot >= ammoNeeded || this.playerState.myPlayer.actions.primary.magazine.currentAmmo === 0) { // Burst complete (reached burst amount or out of ammo)
                    this.playerState.isBurstActive = false;
                    this.playerState.currentBurstShot = 0;
                } else { // Schedule next shot in burst
                    this.playerState.nextBurstShotTime = currentTime + this.playerState.myPlayer.actions.primary.burst.delay;
                }
            } else { // Out of ammo or reached burst limit
                this.playerState.isBurstActive = false;
                this.playerState.currentBurstShot = 0;
            }
        }
    }
    //
    // #endregion

    // #region [ Melee ]
    //
    /**
     * Checks if the player can melee or not.
     */
    public canMelee(): boolean {
        const now = Date.now(); 1
        return (
            !this.playerState.isMelee &&
            now >= this.playerState.lastMeleeTime + this.playerState.myPlayer.actions.melee.cooldown &&
            this.collisionsManager.collisionsEnabled(this.playerState.myPlayer) &&
            !this.playerState.isBurstActive &&
            !this.playerState.isReloading
        );
    }

    /**
     * Triggers a melee attack, using standard projectiles with special params.
     */
    private startMelee(): void {
        this.playerState.isMelee = true;
        this.playerState.lastMeleeTime = Date.now();

        this.playerState.myPlayer.rig.weapon = 'KNIFE'; //TODO: Use whatever currently unlocked melee weapon is equipped

        this.roomManager.sendMessage(JSON.stringify({
            type: 'weapon-change',
            playerId: this.userId,
            weapon: 'KNIFE' //TODO: Use whatever currently unlocked melee weapon is equipped
        }));

        // Calculate melee direction (use current rotation)
        const angle = this.playerState.myPlayer.transform.rot;
        const range = this.playerState.myPlayer.actions.melee.range;
        const size = this.playerState.myPlayer.actions.melee.size;

        // Use the same spawn offset as normal projectiles
        const spawnOffset = this.collisionsManager.getPlayerCollider(this.playerState.myPlayer) +
            this.playerState.myPlayer.actions.primary.projectile.size +
            this.playerState.myPlayer.actions.primary.offset;

        // Calculate spawn position at the tip of the weapon
        const spawnX = this.playerState.myPlayer.transform.pos.x + Math.cos(angle - Math.PI / 2) * spawnOffset;
        const spawnY = this.playerState.myPlayer.transform.pos.y + Math.sin(angle - Math.PI / 2) * spawnOffset;

        const velocity = {
            x: Math.cos(angle - Math.PI / 2) * range,
            y: Math.sin(angle - Math.PI / 2) * range
        };

        const meleeProjectile = {
            id: this.utility.generateUID(OBJECT_DEFAULTS.DATA.ID_LENGTH),
            transform: {
                pos: { x: spawnX, y: spawnY },
                rot: angle
            },
            timestamp: Date.now(),
            color: 'rgba(255, 255, 255, 0)',
            damage: this.playerState.myPlayer.actions.melee.damage,
            distanceTraveled: 0,
            length: size,
            ownerId: this.userId,
            range: range,
            size: size,
            velocity: velocity
        };

        this.projectiles.set(meleeProjectile.id, meleeProjectile);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'projectile-launch',
            projectile: meleeProjectile
        }));

        // Remove melee projectile after it has traveled its duration
        this.utility.safeTimeout(() => {
            this.projectiles.delete(meleeProjectile.id);
            this.playerState.isMelee = false;

            this.playerState.myPlayer.rig.weapon = 'GLOCK'; //TODO: Use whatever currently unlocked ranged primary is equipped

            this.roomManager.sendMessage(JSON.stringify({
                type: 'weapon-change',
                playerId: this.userId,
                weapon: 'GLOCK' //TODO: Use whatever currently unlocked ranged primary is equipped
            }));
        }, this.playerState.myPlayer.actions.melee.duration);
    }
    //
    // #endregion

    // #region [ Ranged ]
    //
    /**
     * Entrypoint for ranged attacks. When this is called, it starts the primary attack flow.
     */
    private startBurst(): void {
        if (this.playerState.isBurstActive || !this.collisionsManager.collisionsEnabled(this.playerState.myPlayer) || this.playerState.isReloading) return;

        const now = Date.now();
        if (now < this.playerState.lastShotTime + this.playerState.myPlayer.actions.primary.buffer) return;
        this.playerState.lastShotTime = now;

        // Check if we have enough ammo for the burst
        const ammoNeeded = this.playerState.myPlayer.actions.primary.burst.amount;
        const ammoToUse = Math.min(ammoNeeded, this.playerState.myPlayer.actions.primary.magazine.currentAmmo);

        if (ammoToUse === 0) {
            console.log('Out of ammo! Magazine empty.');

            this.animator.animateCharacterPart({
                playerId: this.userId,
                part: 'WEAPON',
                frames: {
                    0: { x: 0, y: 8 } // Slide held back
                },
                duration: 0,
                partIndex: 1
            }); // duration=0 means infinite/held

            this.audioManager.playAudioNetwork({
                src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.EMPTY), // TODO: Use current weapon
                listener: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y
                },
                output: 'sfx',
                pitch: { min: 0.975, max: 1.05 },
                spatial: {
                    blend: 1.0,
                    pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
                },
                volume: { min: 0.985, max: 1 }
            });
            return;
        }

        this.playerState.isBurstActive = true;
        this.playerState.currentBurstShot = 0;

        // Calculate direction from player's current rotation instead of mouse
        const angle = this.playerState.myPlayer.transform.rot - Math.PI / 2; // Subtract PI/2 to convert from visual rotation to direction
        const targetDir = { x: Math.cos(angle), y: Math.sin(angle) };

        const triggeredUniques = this.triggerBurstUniques();
        if (triggeredUniques.length === 0) {
            this.launchProjectile(targetDir);
        }

        this.playerState.currentBurstShot++;
        this.playerState.myPlayer.actions.primary.magazine.currentAmmo--; // Use 1 ammo per shot in burst

        // Blend in empty sound as magazine gets low
        // This is a local sound only, to help the player manage their ammo
        const ammoRatio = this.playerState.myPlayer.actions.primary.magazine.currentAmmo / this.playerState.myPlayer.actions.primary.magazine.size;
        const emptyBlend = 1 - ammoRatio; // 0 when full, 1 when empty

        if (emptyBlend > 0.5) { // Only play when below 50% ammo (half mag empty)
            const blendVolume = (emptyBlend - 0.5) * 2 * 0.5; // Remap 0.5-1.0 to 0-0.5 volume
            this.audioManager.playAudio({ // Play sound locally
                src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.EMPTY), // TODO: Use current weapon
                listener: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y
                },
                output: 'sfx',
                pitch: { min: 0.975, max: 1.05 },
                volume: { min: blendVolume, max: blendVolume }
            });
        }

        // If burst has more shots and we have ammo, schedule the next one
        if (this.playerState.myPlayer.actions.primary.burst.amount > 1 && this.playerState.myPlayer.actions.primary.magazine.currentAmmo > 0 && this.playerState.currentBurstShot < ammoToUse) {
            this.playerState.nextBurstShotTime = Date.now() + this.playerState.myPlayer.actions.primary.burst.delay;
        } else { // Burst complete
            this.playerState.isBurstActive = false;
            this.playerState.currentBurstShot = 0;

            if (this.playerState.myPlayer.actions.primary.magazine.currentAmmo === 0) {
                this.animator.animateCharacterPart({
                    playerId: this.userId,
                    part: 'WEAPON',
                    frames: {
                        0: { x: 0, y: 8 } // Slide held back
                    },
                    duration: 0,
                    partIndex: 1
                }); // duration=0 means infinite/held
            }
        }
    }

    /**
     * Calculates physics for projectile and adds them to mapping.
     */
    private launchProjectile(dir: Vec2, overrides?: ProjectileOverrides): void {
        console.log(`Fired shot!`);

        // Use the passed direction and normalize it
        const distance = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (distance === 0) return;

        const dirX = dir.x / distance;
        const dirY = dir.y / distance;

        // Animate weapon slide (glock_slide.png is index 1 in the WEAPON.GLOCK array)
        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'WEAPON',
            frames: {
                0: { x: 0, y: 0 },    // Start position
                0.5: { x: 0, y: 20 }, // Pull back slide
                1: { x: 0, y: 0 }     // Return to start
            },
            duration: 175,
            partIndex: 1
        });

        const canTriggerUnique = overrides?.canTriggerUnique ?? true;
        const projectileAmount = overrides?.amount ?? this.playerState.myPlayer.actions.primary.projectile.amount;
        const projectileColor = overrides?.color ?? this.playerState.myPlayer.actions.primary.projectile.color;
        const projectileDamage = overrides?.damage ?? this.playerState.myPlayer.actions.primary.projectile.damage;
        const projectileLength = overrides?.length ?? this.playerState.myPlayer.actions.primary.projectile.length;
        const projectileRange = overrides?.range ?? this.playerState.myPlayer.actions.primary.projectile.range;
        const projectileSize = overrides?.size ?? this.playerState.myPlayer.actions.primary.projectile.size;
        const projectileSpeed = overrides?.speed ?? this.playerState.myPlayer.actions.primary.projectile.speed;
        const projectileSpread = overrides?.spread ?? this.playerState.myPlayer.actions.primary.projectile.spread;

        // Calculate spawn offset
        const spawnOffset = this.collisionsManager.getPlayerCollider(this.playerState.myPlayer) + projectileSize + this.playerState.myPlayer.actions.primary.offset;
        const bulletSpawnX = this.playerState.myPlayer.transform.pos.x + dirX * spawnOffset;
        const bulletSpawnY = this.playerState.myPlayer.transform.pos.y + dirY * spawnOffset;
        const rightX = -dirY;
        const rightY = dirX;

        // TODO: Wrap all of these particles in some sort of defined type that contains this in one message

        this.particlesManager.createParticles( // Muzzle flash
            bulletSpawnX,
            bulletSpawnY,
            `muzzle_${Date.now()}`,
            PARTICLES.MUZZLE_FLASH,
            { x: dirX, y: dirY }
        );

        this.particlesManager.createParticles( // Muzzle smoke
            bulletSpawnX,
            bulletSpawnY,
            `smoke_${Date.now()}`,
            PARTICLES.SMOKE,
            { x: dirX * 0.3, y: dirY * 0.3 }
        );

        this.particlesManager.createParticles( // Shell casing
            bulletSpawnX - 5,
            bulletSpawnY - 5,
            `shell_${Date.now()}`,
            PARTICLES.SHELL_CASING,
            { x: rightX * 0.8 + dirX * -0.2, y: rightY * 0.8 + dirY * -0.2 } // Right + slightly back
        );

        this.audioManager.playAudioNetwork({
            src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.ATTACK), // TODO: Use current weapon
            listener: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            output: 'sfx',
            pitch: { min: 0.95, max: 1.125 },
            spatial: {
                blend: 1.0,
                pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y },
                rolloff: {
                    distance: Math.max(CANVAS.WIDTH, CANVAS.HEIGHT) * 2,
                    factor: 0.5,
                    type: 'logarithmic'
                }
            },
            volume: { min: 0.965, max: 1 }
        });

        this.audioManager.playAudioNetwork({
            src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.SHELL), // TODO: Use current weapon
            delay: { min: 0.25, max: 0.5 }, // Play with a short delay trigger to simulate the shell hitting the ground
            listener: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            output: 'sfx',
            pitch: { min: 0.95, max: 1.125 },
            spatial: {
                blend: 1.0,
                pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
            },
            volume: { min: 0.375, max: 0.85 }
        });

        // Create projectiles
        for (let i = 0; i < projectileAmount; i++) {
            if (this.playerState.myPlayer.unique.length > 0 && canTriggerUnique) {
                const shuffledUniques = this.utility.getShuffledArray(this.playerState.myPlayer.unique);

                for (const unique of shuffledUniques) {
                    if (this.luckController.luckRoll()) {
                        this.triggerUnique(unique);
                        break;
                    }
                }
            }

            const spread = (Math.random() - 0.5) * (projectileSpread / 100);
            const angle = Math.atan2(dirY, dirX) + spread;
            const dir = this.utility.forward(angle);

            const projectile: Projectile = {
                id: this.utility.generateUID(OBJECT_DEFAULTS.DATA.ID_LENGTH),
                transform: {
                    pos: {
                        x: this.playerState.myPlayer.transform.pos.x + Math.cos(angle) * spawnOffset,
                        y: this.playerState.myPlayer.transform.pos.y + Math.sin(angle) * spawnOffset,
                    },
                    rot: angle
                },
                timestamp: Date.now(),
                color: projectileColor,
                damage: projectileDamage,
                distanceTraveled: 0,
                length: projectileLength,
                ownerId: this.userId,
                range: projectileRange * 100, // Convert to px
                size: projectileSize,
                velocity: {
                    x: dir.x * projectileSpeed,
                    y: dir.y * projectileSpeed,
                },
            };

            this.projectiles.set(projectile.id, projectile);

            // Send projectile to other players
            this.roomManager.sendMessage(JSON.stringify({
                type: 'projectile-launch',
                projectile: projectile
            }));
        }
    }

    /**
     * Updates all projectiles in the game locally.
     */
    public updateProjectiles(delta: number): void {
        const projectilesToRemove: string[] = [];

        this.projectiles.forEach((projectile, id) => {
            // Update movement (with optional spatial targeting nudge)
            if (projectile.ownerId === this.userId) {
                if (this.playerState.myPlayer.unique.includes('spatial_targeting')) {
                    const aim = this.playerState.myPlayer.transform.rot - Math.PI / 2;
                    const dx = Math.cos(aim), dy = Math.sin(aim);
                    const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
                    const vx = projectile.velocity.x / speed, vy = projectile.velocity.y / speed;
                    const lerpFactor = 0.05;
                    const lx = vx + (dx - vx) * lerpFactor;
                    const ly = vy + (dy - vy) * lerpFactor;
                    const norm = Math.sqrt(lx ** 2 + ly ** 2);

                    projectile.velocity.x = (lx / norm) * speed;
                    projectile.velocity.y = (ly / norm) * speed;
                    projectile.transform.rot = Math.atan2(projectile.velocity.y, projectile.velocity.x);
                }
            }
            projectile.transform.pos.x += projectile.velocity.x * delta;
            projectile.transform.pos.y += projectile.velocity.y * delta;

            // Update distance traveled
            const frameDistance = Math.sqrt(
                projectile.velocity.x * projectile.velocity.x +
                projectile.velocity.y * projectile.velocity.y
            ) * delta;
            projectile.distanceTraveled += frameDistance;

            // Check collision with my player (only if I'm alive)
            if (this.collisionsManager.collisionsEnabled(this.playerState.myPlayer)) {
                const dx = projectile.transform.pos.x - this.playerState.myPlayer.transform.pos.x;
                const dy = projectile.transform.pos.y - this.playerState.myPlayer.transform.pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const playerCollider = this.collisionsManager.getPlayerCollider(this.playerState.myPlayer);
                const canDeflect = this.playerState.myPlayer.unique.includes('kinetic_brain') &&
                    distance <= playerCollider * 4 &&
                    distance > playerCollider + projectile.size &&
                    projectile.ownerId !== this.userId;

                if (canDeflect) {
                    if (this.luckController.luckRoll()) {
                        console.log('Kinetic Brain activated! Deflecting projectile.');

                        // Calculate normal from player center to projectile
                        const normal = {
                            x: (projectile.transform.pos.x - this.playerState.myPlayer.transform.pos.x) / distance,
                            y: (projectile.transform.pos.y - this.playerState.myPlayer.transform.pos.y) / distance
                        };

                        const speedReduction = this.utility.getRandomNum(0.85, 0.95);

                        // Reflect velocity off the normal
                        const reflected = this.utility.getReflection(projectile.velocity, normal);
                        projectile.velocity.x = reflected.x * speedReduction; // Slow down
                        projectile.velocity.y = reflected.y * 0.85;

                        // Change ownership
                        projectile.ownerId = this.userId;
                        projectile.color = this.playerState.myPlayer.actions.primary.projectile.color;

                        // Update rotation
                        projectile.transform.rot = Math.atan2(projectile.velocity.y, projectile.velocity.x);

                        // Broadcast deflection
                        this.roomManager.sendMessage(JSON.stringify({
                            type: 'projectile-deflect',
                            projectileId: projectile.id,
                            newOwnerId: this.userId,
                            velocity: projectile.velocity,
                            color: projectile.color
                        }));

                        return;
                    }
                }

                if (distance <= playerCollider + projectile.size) { // Projectile collided with my player
                    projectilesToRemove.push(id);

                    const actualDamage = Math.max(0, projectile.damage - this.playerState.myPlayer.stats.defense);
                    this.playerState.myPlayer.stats.health.value -= actualDamage;

                    const sliderLerpTime = 300; //TODO: Define UI lerping times globally
                    const healthSliderParams: SetSliderParams = {
                        sliderId: 'healthBar',
                        targetValue: this.playerState.myPlayer.stats.health.value,
                        maxValue: this.playerState.myPlayer.stats.health.max,
                        lerpTime: sliderLerpTime
                    }
                    this.utility.setSlider(healthSliderParams);

                    // 20% chance to play hit sound
                    if (this.utility.getRandomNum(0, 1) < 0.2) {
                        this.audioManager.playAudioNetwork({
                            src: this.utility.getRandomInArray(SFX.PLAYER.MALE.GRUNT), // TODO: Allow player to define gender
                            listener: {
                                x: this.playerState.myPlayer.transform.pos.x,
                                y: this.playerState.myPlayer.transform.pos.y
                            },
                            output: 'sfx',
                            pitch: { min: 0.95, max: 1.075 },
                            spatial: {
                                blend: 1.0,
                                pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
                            },
                            volume: { min: 0.9, max: 1 }
                        });
                    }

                    // Notify everyone I was hit
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-hit',
                        targetId: this.userId,
                        shooterId: projectile.ownerId,
                        damage: projectile.damage,
                        newHealth: this.playerState.myPlayer.stats.health.value,
                        projectileId: id
                    }));
                }
            }

            // Check collision with other players (for my projectiles only)
            if (projectile.ownerId === this.userId) {
                this.playerState.players.forEach((player, playerId) => {
                    if (this.collisionsManager.collisionsEnabled(player)) { // Only check collision if the player has collisions enabled
                        const dx2 = projectile.transform.pos.x - player.transform.pos.x;
                        const dy2 = projectile.transform.pos.y - player.transform.pos.y;
                        const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                        if (distance2 <= this.collisionsManager.getPlayerCollider(player) + projectile.size) { // My projectile hit another player!
                            projectilesToRemove.push(id);

                            const actualDamage = Math.max(0, projectile.damage - player.stats.defense);
                            const newHealth = Math.max(0, player.stats.health.value - actualDamage);
                            player.stats.health.value = newHealth;

                            // Create directional blood spray - spray backwards from projectile direction
                            const bloodDirection = {
                                x: -projectile.velocity.x / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2),
                                y: -projectile.velocity.y / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2)
                            };

                            this.decalsManager.createDecal(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, DECALS.BLOOD);
                            this.particlesManager.createParticles(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, PARTICLES.BLOOD_SPRAY, bloodDirection);


                            const emission: EmitterParams = {
                                id: `particle_emitter_${playerId}_${Date.now()}`,
                                interval: this.utility.getRandomNum(200, 400), // ms
                                lifetime: this.utility.getRandomNum(1000, 3000), // ms
                                offset: {
                                    x: player.transform.pos.x,
                                    y: player.transform.pos.y
                                },
                                particleType: PARTICLES.BLOOD_DRIP,
                                playerId: playerId,
                                pos: {
                                    x: projectile.transform.pos.x,
                                    y: projectile.transform.pos.y
                                }
                            };
                            this.particlesManager.createEmitter(emission);

                            this.audioManager.playAudioNetwork({
                                src: this.utility.getRandomInArray(SFX.IMPACT.FLESH.BULLET), // TODO: User current body material
                                listener: {
                                    x: this.playerState.myPlayer.transform.pos.x,
                                    y: this.playerState.myPlayer.transform.pos.y
                                },
                                output: 'sfx',
                                pitch: { min: 0.925, max: 1.15 },
                                spatial: {
                                    blend: 1.0,
                                    pos: { x: projectile.transform.pos.x, y: projectile.transform.pos.y }
                                },
                                volume: { min: 0.95, max: 1 }
                            });

                            if (newHealth <= 0) { // If they died, I get a kill
                                console.log(`I killed ${playerId}!`);

                                const me = this.ui.leaderboard.get(this.userId);
                                if (me) {
                                    me.kills++;
                                }

                                const other = this.ui.leaderboard.get(playerId);
                                if (other) {
                                    other.deaths++;
                                }

                                this.ui.updateLeaderboardDisplay(this.userId);
                            }

                            // Notify everyone about the hit
                            this.roomManager.sendMessage(JSON.stringify({
                                type: 'player-hit',
                                targetId: playerId,
                                shooterId: this.userId,
                                damage: projectile.damage,
                                newHealth: newHealth,
                                projectileId: id,
                                wasKill: newHealth <= 0
                            }));
                        }
                    }
                });
            }

            // Check if projectile should be removed (range/bounds)
            if (projectile.distanceTraveled >= projectile.range ||
                projectile.transform.pos.x < 0 || projectile.transform.pos.x > CANVAS.WIDTH ||
                projectile.transform.pos.y < 0 || projectile.transform.pos.y > CANVAS.HEIGHT) {

                projectilesToRemove.push(id);

                // Create burn mark where projectile expired (only for my projectiles)
                if (projectile.ownerId === this.userId) {
                    const triggeredUniques = this.triggerCollisionUniques(projectile.transform.pos);

                    // TODO: Catch the triggered uniques, and use that string array, might be a bouncing bullet or something that makes it not get destroyed yet

                    if (projectile.distanceTraveled >= projectile.range) {
                        this.decalsManager.createDecal(projectile.transform.pos.x, projectile.transform.pos.y, `impact_${id}`, DECALS.PROJECTILE);
                    }

                    this.particlesManager.createParticles(projectile.transform.pos.x, projectile.transform.pos.y, `sparks_${id}`, PARTICLES.SPARKS);


                    this.audioManager.playAudioNetwork({
                        src: this.utility.getRandomInArray(SFX.IMPACT.METAL.BULLET), // TODO: Use current projectile type
                        listener: {
                            x: this.playerState.myPlayer.transform.pos.x,
                            y: this.playerState.myPlayer.transform.pos.y
                        },
                        output: 'sfx',
                        pitch: { min: 0.95, max: 1.125 },
                        spatial: {
                            blend: 1.0,
                            pos: { x: projectile.transform.pos.x, y: projectile.transform.pos.y }
                        },
                        volume: { min: 0.965, max: 1 }
                    });

                    // Notify others to remove projectile
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'projectile-remove',
                        projectileId: id
                    }));
                }
            }
        });

        // Remove projectiles locally
        projectilesToRemove.forEach(id => {
            this.projectiles.delete(id);
        });
    }

    /**
     * Used to toggle auto fire
     */
    public toggleAutoFire(timestamp: number): void {
        this.playerState.canAutoFire = true;

        const cachedBuffer = this.playerState.myPlayer.actions.primary.buffer

        this.playerState.myPlayer.actions.primary.buffer *= 0.5; // TODO: Pass the buffer change

        console.log(`Auto-fire enabled until ${timestamp}`);

        this.utility.safeTimeout(() => {
            this.playerState.canAutoFire = false;
            this.playerState.myPlayer.actions.primary.buffer = cachedBuffer;
            console.log('Auto-fire disabled.');
        }, timestamp - Date.now()); // Duration of override
    } // TODO: Timestamp duration should be optional, if not passed toggle is permanent on/off
    //
    // #endregion

    // #region [ Uniques ]
    //
    /**
     * Manually triggers a specific unique effect when called.
     */
    private triggerUnique(unique: string, pos?: Vec2): void {
        if (unique === "cluster_module") {
            if (pos) {
                const amount = this.utility.getRandomInt(3, 6);
                const images: string[] = [];
                for (let i = 0; i < amount; i++) {
                    images.push(this.utility.getRandomInArray(SHRAPNEL.PIECE));
                }
                const shrapnel: Shrapnel = {
                    amount: amount,
                    damage: 1,
                    images: images,
                    lifetime: { // ms
                        min: 100,
                        max: 500
                    },
                    pos: {
                        x: pos.x,
                        y: pos.y
                    },
                    size: { // px^2
                        min: 8,
                        max: 14
                    },
                    speed: { // px/frame*(dt)
                        min: 10,
                        max: 15
                    },
                    torque: { // deg/frame*dt
                        min: -360,
                        max: 360
                    }
                }
                this.particlesManager.spawnShrapnel(shrapnel);
            }
        }

        if (unique === "projectile_array") {
            const amount = this.utility.getRandomInt(1, 3);
            for (let i = 0; i < amount; i++) {
                const dir = this.utility.getRandomDirection(360);

                const params: ProjectileOverrides = {
                    canTriggerUnique: false,
                    damage: this.playerState.myPlayer.actions.primary.projectile.damage / 2,
                    range: this.utility.getRandomNum((this.playerState.myPlayer.actions.primary.projectile.range / 2), this.playerState.myPlayer.actions.primary.projectile.range),
                    spread: this.utility.getRandomNum(this.playerState.myPlayer.actions.primary.projectile.spread, (this.playerState.myPlayer.actions.primary.projectile.spread * 2))
                }


                this.launchProjectile(dir, params);
            }
        }

        console.log(`Triggered Unique: ${unique}`)
    }

    /**
     * Responsible for processing possible unique triggers on burst. (Before launchProjectile is called...)
     */
    private triggerBurstUniques(): string[] {
        const triggered: string[] = [];

        if (this.playerState.myPlayer.unique.includes('muzzle_spliter')) {
            if (this.luckController.luckRoll()) {
                const baseAngle = this.playerState.myPlayer.transform.rot - Math.PI / 2;
                const angleOffset = 10 * (Math.PI / 180); // 10 degrees

                const dirA = { x: Math.cos(baseAngle - angleOffset), y: Math.sin(baseAngle - angleOffset) };
                const dirB = { x: Math.cos(baseAngle + angleOffset), y: Math.sin(baseAngle + angleOffset) };

                const baseParams: ProjectileOverrides = {
                    canTriggerUnique: false,
                    damage: this.playerState.myPlayer.actions.primary.projectile.damage,
                    range: this.playerState.myPlayer.actions.primary.projectile.range,
                    size: this.playerState.myPlayer.actions.primary.projectile.size,
                    speed: this.playerState.myPlayer.actions.primary.projectile.speed,
                    color: this.playerState.myPlayer.actions.primary.projectile.color,
                    length: this.playerState.myPlayer.actions.primary.projectile.length,
                    spread: this.playerState.myPlayer.actions.primary.projectile.spread
                };

                this.launchProjectile(dirA, baseParams);
                this.launchProjectile(dirB, baseParams);

                console.log(`Triggered burst unique: muzzle_spliter`);
                triggered.push('muzzle_spliter');
            }
        }

        return triggered;
    }

    /**
     * Responsible for checking specific uniques on collision.
     */
    private triggerCollisionUniques(pos?: Vec2): string[] {
        if (this.playerState.myPlayer.unique.length === 0) return [];

        const succeededUniques: string[] = [];

        for (const unique of this.playerState.myPlayer.unique) {
            if (unique === 'cluster_module') {
                const succeeded = this.luckController.luckRoll();

                if (succeeded) {
                    this.triggerUnique(unique, pos);
                    succeededUniques.push('cluster_module');
                }
            }
        }
        return succeededUniques;
    }
    //
    // #endregion

    // #region [ Reload ]
    //
    /**
     * Checks if the player can reload or not.
     */
    private canReload(): boolean {
        return (
            !this.playerState.isReloading &&
            this.playerState.myPlayer.actions.primary.magazine.currentAmmo < this.playerState.myPlayer.actions.primary.magazine.size &&
            this.playerState.myPlayer.actions.primary.magazine.currentReserve > 0 && !this.playerState.isMelee
        );
    }

    /**
     * Manual trigger for reload. Called when pressing the assigned keybind.
     */
    public startReload(): void {
        if (!this.canReload()) return;
        console.log(`Reloading...`);

        this.playerState.isReloading = true;
        this.playerState.reloadStartTime = Date.now();

        // Cancel any ongoing burst
        this.playerState.isBurstActive = false;
        this.playerState.currentBurstShot = 0;

        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'WEAPON',
            frames: {
                0: { x: 0, y: 8 } // Slide held back
            },
            duration: 0,
            partIndex: 1
        }); // duration=0 means infinite/held

        this.audioManager.playAudioNetwork({
            src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.RELOAD.START), // TODO: Use current weapon
            listener: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            output: 'sfx',
            pitch: { min: 0.975, max: 1.05 },
            spatial: {
                blend: 1.0,
                pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
            },
            volume: { min: 0.985, max: 1 }
        });
    }

    /**
     * Ends the reload loop, and updates visual state.
     */
    private finishReload(): void {
        const magazineSpace = this.playerState.myPlayer.actions.primary.magazine.size - this.playerState.myPlayer.actions.primary.magazine.currentAmmo;
        const ammoToReload = Math.min(magazineSpace, this.playerState.myPlayer.actions.primary.magazine.currentReserve);

        this.playerState.myPlayer.actions.primary.magazine.currentAmmo += ammoToReload;
        this.playerState.myPlayer.actions.primary.magazine.currentReserve -= ammoToReload;
        this.playerState.isReloading = false;

        this.ammoReservesUIController.removeAmmoFromReserveUI(ammoToReload);

        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'WEAPON',
            frames: {
                0: { x: 0, y: 20 }, // Start with slide back
                1: { x: 0, y: 0 } // Return to start
            },
            duration: 175,
            partIndex: 1
        });

        this.audioManager.playAudioNetwork({
            src: this.utility.getRandomInArray(SFX.WEAPON.GLOCK.RELOAD.END), // TODO: Use current weapon
            listener: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            output: 'sfx',
            pitch: { min: 0.975, max: 1.05 },
            spatial: {
                blend: 1.0,
                pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
            },
            volume: { min: 0.985, max: 1 }
        });

        console.log(`Reload complete...`);
    }
    //
    // #endregion
}