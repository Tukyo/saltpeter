import { CANVAS, OBJECT_DEFAULTS } from "./Config";
import { CreateParticleParams, DeathDecal, DeathStamp, DecalParams, Emitter, EmitterParams, Particle, ParticleParams, PlayerHitParams, Shrapnel, ShrapnelPiece } from "./Types";

import { CharacterConfig } from "./CharacterConfig";
import { DecalsManager } from "./DecalsManager";
import { RenderingManager } from "./RenderingManager";
import { RoomManager } from "./RoomManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";

import { PlayerState } from "./player/PlayerState";
import { CollisionsManager } from "./CollisionsManager";
import { ParticlesConfig } from "./ParticlesConfig";

export class ParticlesManager {
    public particlesConfig: ParticlesConfig;

    public particles: Map<string, Particle> = new Map();
    public emitters: Map<string, Emitter> = new Map();
    public shrapnel: Map<string, ShrapnelPiece> = new Map();

    constructor(
        private charConfig: CharacterConfig,
        private collisionsManager: CollisionsManager,
        private decalsManager: DecalsManager,
        private playerState: PlayerState,
        private renderingManager: RenderingManager,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility
    ) {
        this.particlesConfig = new ParticlesConfig();
    }

    // #region [ Particles ]
    //
    // [ Basic Particles ]
    //
    /**
     * Creates particles with params. Entrypoint for all particle creations.
     */
    public createParticles(params: CreateParticleParams): void {
        this.generateParticles(params);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-particles',
            params: params
        }));
    }

    /**
     * Create a particles locally when receiving an 'add-particles' network message.
     */
    public createParticlesNetwork(params: CreateParticleParams): void {
        if (this.particles.has(params.id)) return; // Don't create duplicate particles

        this.generateParticles(params);
    }
    /**
     * Responsible for actual generation of particles locally.
     */
    public generateParticles(params: CreateParticleParams): void {
        const particleParams: ParticleParams = params.particleParams;

        const count = Math.floor(this.utility.getRandomNum(particleParams.count.min, particleParams.count.max));

        for (let i = 0; i < count; i++) {
            const lifetime = this.utility.getRandomNum(particleParams.lifetime.min, particleParams.lifetime.max);
            const speed = this.utility.getRandomNum(particleParams.speed.min, particleParams.speed.max);
            const size = this.utility.getRandomNum(particleParams.size.min, particleParams.size.max);
            const opacity = this.utility.getRandomNum(particleParams.opacity.min, particleParams.opacity.max);
            const torque = this.utility.getRandomNum(particleParams.torque.min, particleParams.torque.max);
            const noiseStrength = this.utility.getRandomNum(particleParams.noise.strength.min, particleParams.noise.strength.max);
            const noiseScale = this.utility.getRandomNum(particleParams.noise.scale.min, particleParams.noise.scale.max);
            const sizeOverLifetime = this.utility.getRandomNum(particleParams.sizeOverLifetime.min, particleParams.sizeOverLifetime.max);

            // Pick random color from array
            const chosenColor = this.utility.getRandomInArray(particleParams.colors);

            let angle;
            if (params.direction) {
                angle = Math.atan2(params.direction.y, params.direction.x) + (this.utility.getRandomNum(0, 1) - 0.5) * particleParams.spread;
            } else {
                angle = this.utility.getRandomNum(0, Math.PI * 2);
            }

            const particle: Particle = {
                age: 0,
                collide: particleParams.collide,
                color: chosenColor,
                fade: particleParams.fade,
                hasCollided: false,
                id: `${params.id}_${i}`,
                initialSize: size,
                lifetime: lifetime,
                maxOpacity: opacity,
                noiseScale: noiseScale,
                noiseStrength: noiseStrength,
                opacity: opacity,
                paint: particleParams.paint,
                pos: {
                    x: params.pos.x,
                    y: params.pos.y
                },
                size: size,
                stain: particleParams.stain,
                torque: torque,
                rotation: this.utility.getRandomNum(0, Math.PI * 2),
                sizeOverLifetime: sizeOverLifetime,
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                }
            };

            this.particles.set(particle.id, particle);
        }
    }

    /**
     * Handles updating of all particles in the game during the update loop.
     */
    public updateParticles(delta: number): void {
        const particlesToRemove: string[] = [];

        this.particles.forEach((particle, id) => {
            if (particle.noiseStrength > 0 && particle.noiseScale > 0) {
                const time = Date.now() * 0.001; // Use time for animation
                const noiseX = this.utility.simplexNoise2D(particle.pos.x / particle.noiseScale, time);
                const noiseY = this.utility.simplexNoise2D(particle.pos.y / particle.noiseScale, time + 100);

                particle.velocity.x += noiseX * particle.noiseStrength * delta;
                particle.velocity.y += noiseY * particle.noiseStrength * delta;
            }

            if (particle.sizeOverLifetime > 0) {
                const ageRatio = particle.age / particle.lifetime;
                particle.size = particle.initialSize * (1 + ageRatio * particle.sizeOverLifetime);
            }

            particle.pos.x += particle.velocity.x * delta;
            particle.pos.y += particle.velocity.y * delta;
            particle.age += 16.67 * delta;

            particle.rotation += (particle.torque * Math.PI / 180) * delta;

            if (particle.fade) {
                const ageRatio = particle.age / particle.lifetime;
                particle.opacity = particle.maxOpacity * (1 - ageRatio);
            }

            // Handle staining during extended collision life
            if (particle.hasCollided && particle.stain) {
                // Paint every frame during extended life
                this.stampParticle(particle);

                // Calculate how far we are through the extended life
                const extendedLifeRatio = (particle.age - (particle.lifetime - particle.lifetime * 0.5)) / (particle.lifetime * 0.5);

                if (extendedLifeRatio > 0) {
                    // Shrink particle during extended life
                    particle.size = Math.max(0.5, particle.size * (1 - extendedLifeRatio * 0.1));

                    // Fade opacity during extended life (from current opacity to 0)
                    particle.opacity = particle.opacity * (1 - extendedLifeRatio);
                }
            }

            const shouldRemove = particle.age >= particle.lifetime ||
                particle.pos.x < -10 || particle.pos.x > CANVAS.WIDTH + 10 ||
                particle.pos.y < -10 || particle.pos.y > CANVAS.HEIGHT + 10;

            if (shouldRemove) {
                // Handle collision for particles with COLLIDE property
                if (particle.collide && particle.age >= particle.lifetime &&
                    particle.pos.x >= 0 && particle.pos.x <= CANVAS.WIDTH &&
                    particle.pos.y >= 0 && particle.pos.y <= CANVAS.HEIGHT &&
                    !particle.hasCollided) {

                    // Simulate collision with ground/surface
                    particle.hasCollided = true;

                    // Reduce speed
                    const speedReduction = 0.875 + Math.random() * 0.1;
                    particle.velocity.x *= (1 - speedReduction);
                    particle.velocity.y *= (1 - speedReduction);

                    // Extend lifetime
                    const lifetimeExtension = particle.lifetime * 0.5;
                    particle.lifetime += lifetimeExtension;

                    // Don't remove this particle yet
                    return;
                }

                // Handle painting before removal (only for non-staining particles)
                if (particle.paint && !particle.stain && particle.age >= particle.lifetime &&
                    particle.pos.x >= 0 && particle.pos.x <= CANVAS.WIDTH &&
                    particle.pos.y >= 0 && particle.pos.y <= CANVAS.HEIGHT) {

                    this.stampParticle(particle);
                }

                particlesToRemove.push(id);
            }
        });

        particlesToRemove.forEach(id => this.particles.delete(id));
    }

    /**
     * Responsible for the actual rendering of particles spawned via emitters and particle functions.
     */
    public drawParticles(): void {
        if (!this.ui.ctx) return;

        this.particles.forEach(particle => {
            const rgb = this.utility.hexToRgb(particle.color);
            if (!rgb) return;

            if (!this.ui.ctx) return;
            this.ui.ctx.save();
            this.ui.ctx.globalAlpha = particle.opacity;

            // Apply rotation if torque exists
            if (particle.torque !== 0) {
                this.ui.ctx.translate(particle.pos.x + particle.size / 2, particle.pos.y + particle.size / 2);
                this.ui.ctx.rotate(particle.rotation);
                this.ui.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ui.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            } else {
                this.ui.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ui.ctx.fillRect(Math.floor(particle.pos.x), Math.floor(particle.pos.y), particle.size, particle.size);
            }

            this.ui.ctx.restore();
        });
    }
    //
    // #endregion

    // #region [ Persistence ]
    //
    /**
     * Stamps local particles onto the decal canvas.
     */
    private stampParticle(particle: Particle): void {
        if (!this.ui.decalCtx) return;

        const rgb = this.utility.hexToRgb(particle.color);
        if (!rgb) return;

        this.ui.decalCtx.save();
        this.ui.decalCtx.globalCompositeOperation = 'source-over';

        // Paint with rotation if particle had torque
        if (particle.torque !== 0) {
            this.ui.decalCtx.translate(particle.pos.x + particle.size / 2, particle.pos.y + particle.size / 2);
            this.ui.decalCtx.rotate(particle.rotation);
            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.ui.decalCtx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        } else {
            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.ui.decalCtx.fillRect(Math.floor(particle.pos.x), Math.floor(particle.pos.y), particle.size, particle.size);
        }

        this.ui.decalCtx.restore();

        const id = `stamp_${Date.now()}`;

        this.decalsManager.dynamicDecals.set(id, {
            params: null,
            pos: {
                x: particle.pos.x,
                y: particle.pos.y
            }
        });
    }
    //
    // #endregion

    // #region [ Emitters ]
    //
    /**
     * Creates a particle emitter in the game, and syncs this action via websocket message "particle-emitter".
     */
    public createEmitter(params: EmitterParams): void {
        this.generateEmitter(params); // Create an emitter locally

        // Broadcast to other clients
        const message: EmitterParams = {
            type: 'particle-emitter',
            id: params.id,
            interval: params.interval,
            lifetime: params.lifetime,
            offset: {
                x: params.offset.x,
                y: params.offset.y
            },
            pos: {
                x: params.pos.x,
                y: params.pos.y
            },
            particleType: params.particleType,
            playerId: params.playerId
        };
        this.roomManager.sendMessage(JSON.stringify(message));

        console.log(`Emitter created on ${params.playerId} for ${params.lifetime}ms`);
    }

    /**
     * Actual generation of the emitter object into the emitter mapping.
     */
    public generateEmitter(params: EmitterParams): void {
        // Calculate offset from center
        const offsetX = params.pos.x - params.offset.x;
        const offsetY = params.pos.y - params.offset.y;

        // Calculate direction (away from center towards hit point)
        const angle = Math.atan2(offsetY, offsetX);

        this.emitters.set(params.id, {
            age: 0,
            direction: angle,
            emissionInterval: params.interval,
            lastEmission: 0,
            lifetime: params.lifetime,
            offset: {
                x: offsetX,
                y: offsetY
            },
            particleType: params.particleType,
            playerId: params.playerId
        });
    }
    /**
     * Process all particle emitters in the game during the update loop.
     */
    public updateEmitters(delta: number): void {
        const emittersToRemove: string[] = [];

        this.emitters.forEach((emitter, emitterId) => {
            emitter.age += 16.67 * delta;

            const player = emitter.playerId === this.userId ? this.playerState.myPlayer : this.playerState.players.get(emitter.playerId);
            if (!player || player.stats.health.value <= 0) {
                emittersToRemove.push(emitterId);
                return;
            }

            // Calculate current world position
            const worldX = player.transform.pos.x + emitter.offset.x;
            const worldY = player.transform.pos.y + emitter.offset.y;

            if (emitter.age >= emitter.lastEmission + emitter.emissionInterval) {
                // Create directional spray with cone spread
                const coneSpread = Math.PI * 0.6; // 108 degree cone
                const randomSpread = (Math.random() - 0.5) * coneSpread;
                const angle = emitter.direction + randomSpread;

                // Variable speed for more natural spray
                const baseSpeed = 3;
                const speedVariation = (Math.random() - 0.5) * 4; // -2 to +2
                const finalSpeed = Math.max(0.5, baseSpeed + speedVariation);

                const particleParams: CreateParticleParams = {
                    id: `emitter_particles_${emitterId}_${emitter.age}`,
                    pos: {
                        x: worldX + (Math.random() - 0.5) * 8,
                        y: worldY + (Math.random() - 0.5) * 8
                    },
                    particleParams: emitter.particleType,
                    direction: {
                        x: Math.cos(angle) * finalSpeed,
                        y: Math.sin(angle) * finalSpeed
                    }
                }
                this.generateParticles(particleParams);

                emitter.lastEmission = emitter.age;
                emitter.emissionInterval = 120 + Math.random() * 180; // More consistent timing
            }

            // Remove expired emitters
            if (emitter.age >= emitter.lifetime) {
                const decalParams: DecalParams = {
                    id: `emitter_decal_${emitterId}`,
                    pos: {
                        x: worldX,
                        y: worldY
                    },
                    type: "parametric",
                    parametric: this.decalsManager.decalsConfig.decals.blood
                };
                this.decalsManager.generateDecal(decalParams);

                emittersToRemove.push(emitterId);
            }
        });

        emittersToRemove.forEach(id => this.emitters.delete(id));
    }
    //
    // #endregion

    // #region [ Gore ]
    //
    /**
     * Generates gore particles using the decals for the character object.
     */
    public generateGore(params: DeathDecal): void {
        const gorePool = [...this.charConfig.CHARACTER_DECALS.DEFAULT.GORE]; // TODO: Get current pool for gore
        for (let i = 0; i < params.gore.amount && gorePool.length > 0; i++) {
            const goreAsset = this.utility.getRandomInArray(gorePool);
            gorePool.splice(gorePool.indexOf(goreAsset), 1);
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(0, params.radius);

            const goreDecal: DeathStamp = {
                type: 'gore',
                src: goreAsset,
                transform: {
                    pos: {
                        x: params.pos.x + Math.cos(angle) * distance,
                        y: params.pos.y + Math.sin(angle) * distance
                    },
                    rot: this.utility.getRandomNum(0, Math.PI * 2),
                },
                scale: this.utility.getRandomNum(0.65, 1.05)
            };

            const decalId = `death_gore_${params.ownerId}_${Date.now()}_${i}`;
            this.stampGore(goreDecal);
            this.decalsManager.dynamicDecals.set(decalId, {
                params: null,
                pos: {
                    x: goreDecal.transform.pos.x,
                    y: goreDecal.transform.pos.y
                }
            });
        }

        const bloodPool = [...this.charConfig.CHARACTER_DECALS.DEFAULT.BLOOD]; // TODO: Get current pool for blood
        for (let i = 0; i < params.blood.amount && bloodPool.length > 0; i++) {
            const bloodAsset = this.utility.getRandomInArray(bloodPool);
            bloodPool.splice(bloodPool.indexOf(bloodAsset), 1);
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(0, params.radius * 0.7);

            const bloodDecal: DeathStamp = {
                type: 'blood',
                src: bloodAsset,
                transform: {
                    pos: {
                        x: params.pos.x + Math.cos(angle) * distance,
                        y: params.pos.y + Math.sin(angle) * distance
                    },
                    rot: this.utility.getRandomNum(0, Math.PI * 2),
                },
                scale: this.utility.getRandomNum(1.25, 1.45)
            };

            const decalId = `death_blood_${params.ownerId}_${Date.now()}_${i}`;
            this.stampGore(bloodDecal);
            this.decalsManager.dynamicDecals.set(decalId, {
                params: null,
                pos: {
                    x: bloodDecal.transform.pos.x,
                    y: bloodDecal.transform.pos.y
                }
            });
        }
    }

    /**
     * Persists gore on the decal canvas.
     */
    private stampGore(params: DeathStamp): void {
        if (!this.ui.decalCtx) return;

        let image = this.renderingManager.characterImages.get(params.src);

        if (!image) {
            image = new Image();
            image.src = params.src;
            this.renderingManager.characterImages.set(params.src, image);

            if (!image.complete) {
                image.onload = () => {
                    this.stampGore(params);
                };
                return;
            }
        }

        if (!image.complete || image.naturalWidth === 0) return;

        this.ui.decalCtx.save();
        this.ui.decalCtx.translate(params.transform.pos.x, params.transform.pos.y);
        this.ui.decalCtx.rotate(params.transform.rot);

        const drawSize = 32 * params.scale;
        this.ui.decalCtx.drawImage(
            image,
            -drawSize / 2,
            -drawSize / 2,
            drawSize,
            drawSize
        );

        this.ui.decalCtx.restore();
    }
    //
    // #endregion

    // #region [ Shrapnel ]
    //
    /**
     * Creates shrapnel pieces and sends network message with Shrapnel data.
     */
    public spawnShrapnel(params: Shrapnel): void {
        const pieces: ShrapnelPiece[] = [];

        // Generate all pieces locally
        for (let i = 0; i < params.amount; i++) {
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const speed = this.utility.getRandomNum(params.speed.min, params.speed.max);
            const lifetime = this.utility.getRandomNum(params.lifetime.min, params.lifetime.max);
            const size = this.utility.getRandomNum(params.size.min, params.size.max);
            const torque = this.utility.getRandomNum(params.torque.min, params.torque.max) * (Math.PI / 180); // Convert radians > deg

            const piece: ShrapnelPiece = {
                id: this.utility.generateUID(OBJECT_DEFAULTS.DATA.ID_LENGTH),
                image: params.images[i], // Already randomly selected in triggerUnique
                transform: {
                    pos: {
                        x: params.pos.x,
                        y: params.pos.y
                    },
                    rot: this.utility.getRandomNum(0, Math.PI * 2), // Random start rot
                },
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                },
                rotationSpeed: torque, // Random spin
                size: size,
                age: 0,
                lifetime: lifetime,
                ownerId: this.userId,
                damage: params.damage
            };

            pieces.push(piece);
            this.shrapnel.set(piece.id, piece);
        }

        // Send ONE message with all pieces
        this.roomManager.sendMessage(JSON.stringify({
            type: 'shrapnel-spawn',
            pieces: pieces
        }));

        console.log(`Spawned ${pieces.length} shrapnel pieces`);
    }

    /**
     * Generates shrapnel baed on received network message 'shrapnel-spawn' data.
     */
    public generateShrapnel(params: ShrapnelPiece[]): void {
        params.forEach(piece => {
            this.shrapnel.set(piece.id, piece);
        });

        console.log(`Received ${params.length} shrapnel pieces from network`);
    }

    /**
     * When shrapnel exists, handles updating of each piece via Client udpate loop.
     */
    public updateShrapnel(delta: number): void {
        if (this.shrapnel.size === 0) return;

        const shrapnelToRemove: string[] = [];

        this.shrapnel.forEach((piece, id) => {
            // Update physics
            piece.transform.pos.x += piece.velocity.x * delta;
            piece.transform.pos.y += piece.velocity.y * delta;
            piece.transform.rot += piece.rotationSpeed * delta;
            piece.age += 16.67 * delta;

            // Apply friction
            // TODO: Add world friction
            piece.velocity.x *= 0.98;
            piece.velocity.y *= 0.98;

            // Only owner checks collisions and deals damage
            if (piece.ownerId === this.userId) {
                // Check collision with all players
                this.playerState.players.forEach((player, playerId) => {
                    if (player.stats.health.value > 0) {
                        const dx = piece.transform.pos.x - player.transform.pos.x;
                        const dy = piece.transform.pos.y - player.transform.pos.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Collision detection (using player collider + shrapnel size for padding)
                        if (distance <= this.collisionsManager.getPlayerCollider(player, piece.size)) {
                            const actualDamage = Math.max(0, piece.damage - player.stats.defense);
                            const newHealth = Math.max(0, player.stats.health.value - actualDamage);
                            player.stats.health.value = newHealth;

                            // Remove this shrapnel piece after hit
                            shrapnelToRemove.push(id);
                            console.log(`Shrapnel hit ${playerId} for ${piece.damage} damage`);

                            const params: PlayerHitParams = {
                                target: player,
                                shooterId: this.userId,
                                damage: piece.damage,
                                newHealth: newHealth,
                                source: piece,
                                wasKill: newHealth <= 0
                            }
                            window.dispatchEvent(new CustomEvent("customEvent_playerHitRelay", { detail: { params } }));
                        }
                    }
                });
            }

            // Remove if lifetime expired or out of bounds
            if (piece.age >= piece.lifetime ||
                piece.transform.pos.x < 0 || piece.transform.pos.x > CANVAS.WIDTH ||
                piece.transform.pos.y < 0 || piece.transform.pos.y > CANVAS.HEIGHT) {

                // Stamp as decal if died in bounds
                if (piece.transform.pos.x >= 0 && piece.transform.pos.x <= CANVAS.WIDTH &&
                    piece.transform.pos.y >= 0 && piece.transform.pos.y <= CANVAS.HEIGHT) {
                    this.stampShrapnel(piece);
                }

                shrapnelToRemove.push(id);
            }
        });

        // Remove dead shrapnel
        shrapnelToRemove.forEach(id => this.shrapnel.delete(id));
    }

    /**
     * Draws the moving shrapnel to the canvas for rendering.
     */
    public drawShrapnel(): void {
        if (!this.ui.ctx || this.shrapnel.size === 0) return;

        this.shrapnel.forEach(piece => {
            if (!this.ui.ctx) return;

            let image = this.renderingManager.characterImages.get(piece.image);

            if (!image) {
                image = new Image();
                image.src = piece.image;
                this.renderingManager.characterImages.set(piece.image, image);

                if (!image.complete) { return; }
            }

            if (!image.complete || image.naturalWidth === 0) return;

            this.ui.ctx.save();
            this.ui.ctx.translate(piece.transform.pos.x, piece.transform.pos.y);
            this.ui.ctx.rotate(piece.transform.rot);

            this.ui.ctx.drawImage(
                image,
                -piece.size / 2,
                -piece.size / 2,
                piece.size,
                piece.size
            );

            this.ui.ctx.restore();
        });
    }

    /**
     * Stamps dead shrapnel to the decal canvas to persist visually.
     */
    private stampShrapnel(params: ShrapnelPiece): void {
        if (!this.ui.decalCtx) return;

        let image = this.renderingManager.characterImages.get(params.image);
        if (!image || !image.complete || image.naturalWidth === 0) return;

        this.ui.decalCtx.save();
        this.ui.decalCtx.translate(params.transform.pos.x, params.transform.pos.y);
        this.ui.decalCtx.rotate(params.transform.rot);

        this.ui.decalCtx.drawImage(
            image,
            -params.size / 2,
            -params.size / 2,
            params.size,
            params.size
        );

        this.ui.decalCtx.restore();

        // Register decal
        this.decalsManager.dynamicDecals.set(`shrapnel_${params.id}`, {
            params: null,
            pos: {
                x: params.transform.pos.x,
                y: params.transform.pos.y
            }
        });
    }
    //
    // #endregion

    public spawnMagazineDecal(): void {
        setTimeout(() => {
            const currentAmmo = this.playerState.myPlayer.actions.primary.magazine.currentAmmo;

            // Choose magazine sprite: empty if 0 ammo, full if > 0
            const magazineSrc = currentAmmo > 0 // TODO: Get current ranged weapon
                ? this.charConfig.MAGAZINE.GLOCK.FULL
                : this.charConfig.MAGAZINE.GLOCK.EMPTY;

            // Random position in small radius around player
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(8, 24);

            const x = this.playerState.myPlayer.transform.pos.x + Math.cos(angle) * distance;
            const y = this.playerState.myPlayer.transform.pos.y + Math.sin(angle) * distance;
            const rotation = this.utility.getRandomNum(0, Math.PI * 2);
            const scale = this.utility.getRandomNum(0.65, 0.75);

            const decalId = `magazine_${this.userId}_${Date.now()}`;

            const decalParams: DecalParams = {
                id: decalId,
                pos: { x, y },
                type: 'image',
                image: {
                    src: magazineSrc,
                    scale: scale,
                    rotation: rotation
                }
            };
            this.decalsManager.createDecal(decalParams);

            console.log(`Spawned ${currentAmmo > 0 ? 'full' : 'empty'} magazine at reload`);
        }, 150);
    }
}