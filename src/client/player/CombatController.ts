import { GAME, SHRAPNEL, WORLD } from "../Config";
import { AttackType, AudioParams, CreateParticleParams, DecalParams, PlayerHitParams, DamageEntity, ProjectileOverrides, Shrapnel, Vec2 } from "../Types";

import { Animator } from "../Animator";
import { CollisionsManager } from "../CollisionsManager";
import { DecalsManager } from "../DecalsManager";
import { GameState } from "../GameState";
import { LuckController } from "./LuckController";
import { ParticlesManager } from "../ParticlesManager";
import { PlayerController, } from "./PlayerController";
import { PlayerState } from "./PlayerState";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";

import { AudioConfig } from "../audio/AudioConfig";
import { AudioManager } from "../audio/AudioManager";

import { World } from "../world/World";

export class CombatController {
    public projectiles: Map<string, DamageEntity> = new Map();

    constructor(
        private animator: Animator,
        private audioConfig: AudioConfig,
        private audioManager: AudioManager,
        private collisionsManager: CollisionsManager,
        private decalsManager: DecalsManager,
        private gameState: GameState,
        private luckController: LuckController,
        private particlesManager: ParticlesManager,
        private playerController: PlayerController,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility,
        private world: World
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

        this.playerState.myPlayer.rig.weapon = this.playerState.myPlayer.inventory.melee;

        this.roomManager.sendMessage(JSON.stringify({
            type: 'weapon-change',
            playerId: this.userId,
            weapon: this.playerState.myPlayer.inventory.melee
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

        const meleeProjectile: DamageEntity = {
            id: this.utility.generateUID(GAME.DATA.ID_LENGTH),
            transform: {
                pos: { x: spawnX, y: spawnY },
                rot: angle
            },
            timestamp: Date.now(),
            color: 'rgba(255, 255, 255, 0)', // Invisible
            damage: this.playerState.myPlayer.actions.melee.damage,
            distanceTraveled: 0,
            length: size,
            ownerId: this.userId,
            range: range,
            size: size,
            type: 'melee',
            velocity: velocity
        };

        this.projectiles.set(meleeProjectile.id, meleeProjectile);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'projectile-launch',
            projectile: meleeProjectile // TODO: Need to attach isMelee or something to read this in updateProjectiles to get if melee or ranged!
        }));

        // Remove melee projectile after it has traveled its duration
        this.utility.safeTimeout(() => {
            this.projectiles.delete(meleeProjectile.id);
            this.playerState.isMelee = false;

            this.playerState.myPlayer.rig.weapon = this.playerState.myPlayer.inventory.primary;

            this.roomManager.sendMessage(JSON.stringify({
                type: 'weapon-change',
                playerId: this.userId,
                weapon: this.playerState.myPlayer.inventory.primary
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

        const currentWeapon = this.playerState.myPlayer.inventory.primary;
        const emptySfx = this.utility.getRandomInArray(this.audioConfig.resources.sfx.weapon[currentWeapon].empty ?? [])

        const playerX = this.playerState.myPlayer.transform.pos.x;
        const playerY = this.playerState.myPlayer.transform.pos.y;

        if (ammoToUse === 0) {
            console.log('Out of ammo! Magazine empty.');

            this.animator.animateCharacterPart({
                playerId: this.userId,
                part: 'weapon',
                frames: {
                    0: { x: 0, y: 8 } // Slide held back
                },
                duration: 0,
                partIndex: 1
            }); // duration=0 means infinite/held

            if (!emptySfx) { console.warn(`No empty sound effects for ${currentWeapon}`); return; }

            this.audioManager.playAudioNetwork({
                src: emptySfx,
                listener: {
                    x: playerX,
                    y: playerY
                },
                output: 'sfx',
                pitch: { min: 0.975, max: 1.05 },
                spatial: {
                    blend: 1.0,
                    pos: { x: playerX, y: playerY }
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

        if (emptySfx) {
            if (emptyBlend > 0.5) { // Only play when below 50% ammo (half mag empty)
                const blendVolume = (emptyBlend - 0.5) * 2 * 0.5; // Remap 0.5-1.0 to 0-0.5 volume
                this.audioManager.playAudio({ // Play sound locally
                    src: emptySfx,
                    listener: {
                        x: playerX,
                        y: playerY
                    },
                    output: 'sfx',
                    pitch: { min: 0.975, max: 1.05 },
                    volume: { min: blendVolume, max: blendVolume }
                });
            }
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
                    part: 'weapon',
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

        const playerX = this.playerState.myPlayer.transform.pos.x;
        const playerY = this.playerState.myPlayer.transform.pos.y;

        const currentWeapon = this.playerState.myPlayer.inventory.primary;

        const dirX = dir.x / distance;
        const dirY = dir.y / distance;

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
        const baseAngle = Math.atan2(dirY, dirX);
        const spawnOffset = this.collisionsManager.getPlayerCollider(this.playerState.myPlayer) + projectileSize + this.playerState.myPlayer.actions.primary.offset;
        const bulletSpawnX = playerX + Math.cos(baseAngle) * spawnOffset;
        const bulletSpawnY = playerY + Math.sin(baseAngle) * spawnOffset;
        const rightX = -dirY;
        const rightY = dirX;

        // Animate weapon slide (glock_slide.png is index 1 in the weapon.glock array)
        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'weapon',
            frames: {
                0: { x: 0, y: 0 },    // Start position
                0.5: { x: 0, y: 20 }, // Pull back slide
                1: { x: 0, y: 0 }     // Return to start
            },
            duration: 175,
            partIndex: 1
        });

        // TODO: Wrap all of these particles in some sort of defined type that contains this in one message

        const muzzleParams: CreateParticleParams = {
            id: `muzzle_${Date.now()}`,
            pos: {
                x: bulletSpawnX,
                y: bulletSpawnY
            },
            particleParams: this.particlesManager.particlesConfig.weaponParticles[currentWeapon].muzzle.flash,
            direction: { x: dirX, y: dirY }
        }
        this.particlesManager.createParticles(muzzleParams);

        const smokeParams: CreateParticleParams = {
            id: `smoke_${Date.now()}`,
            pos: {
                x: bulletSpawnX,
                y: bulletSpawnY
            },
            particleParams: this.particlesManager.particlesConfig.weaponParticles[currentWeapon].muzzle.smoke,
            direction: { x: dirX * 0.3, y: dirY * 0.3 }
        }
        this.particlesManager.createParticles(smokeParams);

        const shellParams: CreateParticleParams = {
            id: `shell_${Date.now()}`,
            pos: {
                x: bulletSpawnX - 5,
                y: bulletSpawnY - 5
            },
            particleParams: this.particlesManager.particlesConfig.weaponParticles[currentWeapon].projectile.shell,
            direction: { x: rightX * 0.8 + dirX * -0.2, y: rightY * 0.8 + dirY * -0.2 } // Right + slightly back
        }
        this.particlesManager.createParticles(shellParams);

        this.audioManager.playAudioNetwork({
            src: this.utility.getRandomInArray(this.audioConfig.resources.sfx.weapon[currentWeapon].attack),
            listener: {
                x: playerX,
                y: playerY
            },
            output: 'sfx',
            pitch: { min: 0.95, max: 1.125 },
            spatial: {
                blend: 1.0,
                pos: { x: playerX, y: playerY },
                rolloff: {
                    distance: Math.max(WORLD.WIDTH, WORLD.HEIGHT) / 2, // TODO: Make more reliable distance attenuation, right now, just half of the world size
                    factor: 0.5,
                    type: 'logarithmic'
                }
            },
            volume: { min: 0.965, max: 1 }
        });

        const shellSfx = this.utility.getRandomInArray(this.audioConfig.resources.sfx.weapon[currentWeapon].shell ?? [])

        this.audioManager.playAudioNetwork({
            src: shellSfx, // TODO: Get soft or hard for this based on the ground it "hits"
            delay: { min: 0.25, max: 0.5 }, // Play with a short delay trigger to simulate the shell hitting the ground
            listener: {
                x: playerX,
                y: playerY
            },
            output: 'sfx',
            pitch: { min: 0.95, max: 1.125 },
            spatial: {
                blend: 1.0,
                pos: { x: playerX, y: playerY }
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

            const projectile: DamageEntity = {
                id: this.utility.generateUID(GAME.DATA.ID_LENGTH),
                transform: {
                    pos: {
                        x: bulletSpawnX,
                        y: bulletSpawnY,
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
                type: 'ranged',
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

        const myPlayer = this.playerState.myPlayer;
        const myPlayerX = myPlayer.transform.pos.x;
        const myPlayerY = myPlayer.transform.pos.y;
        const myStats = myPlayer.stats;

        this.projectiles.forEach((projectile, id) => {
            if (projectile.ownerId === this.userId) {
                if (myPlayer.unique.includes('spatial_targeting')) {
                    const aim = myPlayer.transform.rot - Math.PI / 2;
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

            const frameDistance = Math.sqrt( // Update distance traveled
                projectile.velocity.x * projectile.velocity.x +
                projectile.velocity.y * projectile.velocity.y
            ) * delta;
            projectile.distanceTraveled += frameDistance;

            // Check collision with my player (only if I'm alive)
            if (this.collisionsManager.collisionsEnabled(myPlayer)) {
                const dx = projectile.transform.pos.x - myPlayerX;
                const dy = projectile.transform.pos.y - myPlayerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const playerCollider = this.collisionsManager.getPlayerCollider(myPlayer);
                const canDeflect = myPlayer.unique.includes('kinetic_brain') &&
                    distance <= playerCollider * 4 &&
                    distance > playerCollider + projectile.size &&
                    projectile.ownerId !== this.userId;

                if (canDeflect) {
                    if (this.luckController.luckRoll()) {
                        console.log('Kinetic Brain activated! Deflecting projectile.');

                        // Calculate normal from player center to projectile
                        const normal = {
                            x: (projectile.transform.pos.x - myPlayerX) / distance,
                            y: (projectile.transform.pos.y - myPlayerY) / distance
                        };

                        const speedReduction = this.utility.getRandomNum(0.85, 0.95);

                        // Reflect velocity off the normal
                        const reflected = this.utility.getReflection(projectile.velocity, normal);
                        projectile.velocity.x = reflected.x * speedReduction; // Slow down
                        projectile.velocity.y = reflected.y * 0.85;

                        // Change ownership
                        projectile.ownerId = this.userId;
                        projectile.color = myPlayer.actions.primary.projectile.color;

                        // Update rotation
                        projectile.transform.rot = Math.atan2(projectile.velocity.y, projectile.velocity.x);

                        // Broadcast deflection
                        this.roomManager.sendMessage(JSON.stringify({
                            type: 'projectile-update',
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

                    const actualDamage = Math.max(0, projectile.damage - myStats.defense);
                    myStats.health.value = Math.max(0, myStats.health.value - actualDamage);

                    const myHealth = myStats.health.value;

                    const params: PlayerHitParams = {
                        target: myPlayer,
                        shooterId: projectile.ownerId,
                        damage: projectile.damage,
                        newHealth: myHealth,
                        source: projectile,
                        wasKill: myHealth <= 0
                    }
                    this.playerController.playerHit(params);
                }
            }

            // Check my projectile's collisions with other players
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

                            const params: PlayerHitParams = {
                                target: player,
                                shooterId: this.userId,
                                damage: projectile.damage,
                                newHealth: newHealth,
                                source: projectile,
                                wasKill: newHealth <= 0
                            }
                            this.playerController.playerHit(params);
                        }
                    }
                });
            }

            const shouldRemove = projectile.distanceTraveled >= projectile.range ||
                projectile.transform.pos.x < 0 || projectile.transform.pos.x > WORLD.WIDTH ||
                projectile.transform.pos.y < 0 || projectile.transform.pos.y > WORLD.HEIGHT;

            if (shouldRemove) {
                projectilesToRemove.push(id);

                if (projectile.ownerId === this.userId) { // Create burn mark where projectile expired for my projectiles
                    const impactX = projectile.transform.pos.x;
                    const impactY = projectile.transform.pos.y;

                    const triggeredUniques = this.triggerCollisionUniques(projectile.transform.pos);

                    // TODO: Catch the triggered uniques, and use that string array, might be a bouncing bullet or something that makes it not get destroyed yet

                    // Notify others to remove projectile
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'projectile-remove',
                        projectileId: id
                    }));

                    const inBounds = impactX >= 0 && impactX <= WORLD.WIDTH && impactY >= 0 && impactY <= WORLD.HEIGHT;
                    if (!inBounds) return;

                    const currentWeapon = myPlayer.inventory.primary;

                    if (projectile.distanceTraveled >= projectile.range) {
                        const decalParams: DecalParams = {
                            id: `impact_${id}`,
                            pos: {
                                x: impactX,
                                y: impactY
                            },
                            type: 'parametric',
                            parametric: this.decalsManager.decalsConfig.decals.projectile
                        };
                        this.decalsManager.createDecal(decalParams);
                    }

                    const sparksParams: CreateParticleParams = {
                        id: `sparks_${id}`,
                        pos: {
                            x: impactX,
                            y: impactY
                        },
                        particleParams: this.particlesManager.particlesConfig.weaponParticles[currentWeapon].projectile.sparks // TODO: Create material based particles on hit
                    }
                    this.particlesManager.createParticles(sparksParams);

                    const material = this.world.getMaterialAt(Math.round(impactX), Math.round(impactY)); // Snap to nearest pixel to avoid sub-pixel sampling errors 
                    if (!material) { console.warn('No material returned from hit.'); return; }

                    const matName = material.name.toLowerCase();
                    const impactSounds = this.audioConfig.resources.sfx.impact[matName];
                    if (!impactSounds) { console.warn('No impact sounds for:', matName); return; }

                    const impactSoundList = impactSounds[projectile.type];
                    if (!impactSoundList || impactSoundList.length <= 0) { console.warn('No impact soundlist for:', impactSounds); return; }

                    const sfxParams: AudioParams = {
                        src: this.utility.getRandomInArray(impactSoundList),
                        listener: {
                            x: myPlayerX,
                            y: myPlayerY
                        },
                        output: 'sfx',
                        pitch: { min: 0.95, max: 1.125 },
                        spatial: {
                            blend: 1.0,
                            pos: { x: impactX, y: impactY }
                        },
                        volume: { min: 0.965, max: 1 }
                    }
                    this.audioManager.playAudioNetwork(sfxParams);

                    this.world.worldEdit.requestCraterAt(projectile.transform.pos); // TODO: Update this functionality
                }
            }
        });

        projectilesToRemove.forEach(id => { this.projectiles.delete(id); }); // Remove projectiles locally
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
                    damage: this.playerState.myPlayer.actions.primary.projectile.damage * 0.1,
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

        if (this.playerState.myPlayer.unique.includes('muzzle_splitter')) {
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

                console.log(`Triggered burst unique: muzzle_splitter`);
                triggered.push('muzzle_splitter');
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

        this.decalsManager.spawnMagazineDecal();

        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'weapon',
            frames: {
                0: { x: 0, y: 8 } // Slide held back
            },
            duration: 0,
            partIndex: 1
        }); // duration=0 means infinite/held

        const currentWeapon = this.playerState.myPlayer.inventory.primary;
        const reloadStartSfx = this.utility.getRandomInArray(this.audioConfig.resources.sfx.weapon[currentWeapon].reload?.start ?? [])
        if (!reloadStartSfx) { console.warn(`No reload sounds for ${currentWeapon}`); return; }

        this.audioManager.playAudioNetwork({
            src: reloadStartSfx,
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
        console.log(`Reload complete...`);

        const magazineSpace = this.playerState.myPlayer.actions.primary.magazine.size - this.playerState.myPlayer.actions.primary.magazine.currentAmmo;
        const ammoToReload = Math.min(magazineSpace, this.playerState.myPlayer.actions.primary.magazine.currentReserve);

        this.playerState.myPlayer.actions.primary.magazine.currentAmmo += ammoToReload;
        this.playerState.myPlayer.actions.primary.magazine.currentReserve -= ammoToReload;
        this.playerState.isReloading = false;

        this.ui.ammoReservesUIController.removeAmmoFromReserveUI(ammoToReload);

        this.animator.animateCharacterPart({
            playerId: this.userId,
            part: 'weapon',
            frames: {
                0: { x: 0, y: 20 }, // Start with slide back
                1: { x: 0, y: 0 } // Return to start
            },
            duration: 175,
            partIndex: 1
        });

        const currentWeapon = this.playerState.myPlayer.inventory.primary;
        const reloadEndSfx = this.utility.getRandomInArray(this.audioConfig.resources.sfx.weapon[currentWeapon].reload?.end ?? [])
        if (!reloadEndSfx) { console.warn(`No reload sounds for ${currentWeapon}`); return; }

        this.audioManager.playAudioNetwork({
            src: reloadEndSfx,
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
    //
    // #endregion
}