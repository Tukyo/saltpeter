import { CHARACTER_DECALS } from "./char";
import { CANVAS, DECALS, PARTICLES } from "./config";
import { DecalsManager } from "./DecalsManager";
import { Emitter, Particle, Vec2 } from "./defs";
import { PlayerState } from "./PlayerState";
import { RenderingManager } from "./RenderingManager";

import { RoomManager } from "./RoomManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";

export class ParticlesManager {
    public particles: Map<string, Particle> = new Map();
    public emitters: Map<string, Emitter> = new Map();

    constructor(
        private decalsManager: DecalsManager,
        private playerState: PlayerState,
        private renderdingManager: RenderingManager,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility
    ) { }

    // #region [ Particles ]
    //
    // [ Basic Particles ]
    //
    /**
     * Creates particles with params. Entrypoint for all particle creations.
     */
    public createParticles(x: number, y: number, particleId: string, params: typeof PARTICLES[keyof typeof PARTICLES], direction?: Vec2): void {
        this.generateParticles(x, y, particleId, params, direction);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-particles',
            particleId: particleId,
            x: x,
            y: y,
            params: params,
            direction: direction
        }));
    }

    /**
     * Responsible for actual generation of particles locally.
     */
    public generateParticles(x: number, y: number, particleId: string, params: typeof PARTICLES[keyof typeof PARTICLES], direction?: Vec2): void {
        const count = Math.floor(params.COUNT.MIN + Math.random() * (params.COUNT.MAX - params.COUNT.MIN));

        for (let i = 0; i < count; i++) {
            const lifetime = params.LIFETIME.MIN + Math.random() * (params.LIFETIME.MAX - params.LIFETIME.MIN);
            const speed = params.SPEED.MIN + Math.random() * (params.SPEED.MAX - params.SPEED.MIN);
            const size = params.SIZE.MIN + Math.random() * (params.SIZE.MAX - params.SIZE.MIN);
            const opacity = params.OPACITY.MIN + Math.random() * (params.OPACITY.MAX - params.OPACITY.MIN);
            const torque = params.TORQUE.MIN + Math.random() * (params.TORQUE.MAX - params.TORQUE.MIN);
            const noiseStrength = params.NOISE ? (params.NOISE.STRENGTH.MIN + Math.random() * (params.NOISE.STRENGTH.MAX - params.NOISE.STRENGTH.MIN)) : 0;
            const noiseScale = params.NOISE ? (params.NOISE.SCALE.MIN + Math.random() * (params.NOISE.SCALE.MAX - params.NOISE.SCALE.MIN)) : 0;
            const sizeOverLifetime = params.SIZE_OVER_LIFETIME ? (params.SIZE_OVER_LIFETIME.MIN + Math.random() * (params.SIZE_OVER_LIFETIME.MAX - params.SIZE_OVER_LIFETIME.MIN)) : 0;

            let angle;
            if (direction) {
                angle = Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * params.SPREAD;
            } else {
                angle = Math.random() * Math.PI * 2;
            }

            const particle = {
                age: 0,
                collide: params.COLLIDE,
                color: params.COLOR,
                fade: params.FADE,
                hasCollided: false,
                id: `${particleId}_${i}`,
                initialSize: size,
                lifetime: lifetime,
                maxOpacity: opacity,
                noiseScale: noiseScale,
                noiseStrength: noiseStrength,
                opacity: opacity,
                paint: params.PAINT,
                pos: {
                    x: x,
                    y: y
                },
                size: size,
                stain: params.STAIN,
                torque: torque,
                rotation: Math.random() * Math.PI * 2,
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
                this.stampParticle(`stain_${id}_${Date.now()}`, particle);

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

                    this.stampParticle(`stamp_${id}`, particle);
                }

                particlesToRemove.push(id);
            }
        });

        particlesToRemove.forEach(id => this.particles.delete(id));
    }
    //

    // [ Particle Persistence ]
    //
    /**
     * Stamps local particles onto the decal canvas.
     */
    private stampParticle(stampId: string, particle: any): void {
        if (!this.ui.decalCtx) return;

        const rgb = this.utility.hexToRgb(particle.color);
        if (!rgb) return;

        this.ui.decalCtx.save();
        this.ui.decalCtx.globalCompositeOperation = 'source-over';

        // Paint with rotation if particle had torque
        if (particle.torque !== 0) {
            this.ui.decalCtx.translate(particle.x + particle.size / 2, particle.y + particle.size / 2);
            this.ui.decalCtx.rotate(particle.rotation);
            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.ui.decalCtx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        } else {
            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.ui.decalCtx.fillRect(Math.floor(particle.x), Math.floor(particle.y), particle.size, particle.size);
        }

        this.ui.decalCtx.restore();

        this.decalsManager.decals.set(stampId, {
            params: null,
            pos: {
                x: particle.x,
                y: particle.y
            }
        });
    }
    //

    // [ Particle Emitters ]
    //
    /**
     * Creates a particle emitter in the game, and syncs this action via websocket message "particle-emitter".
     */
    public createEmitter(playerId: string, hitX: number, hitY: number, centerX: number, centerY: number): void {
        const emitterId = `particle_emitter_${playerId}_${Date.now()}`;
        const emitterLifetime = 1000 + Math.random() * 2000;

        this.generateEmitter(emitterId, playerId, hitX, hitY, centerX, centerY, emitterLifetime);

        // Broadcast to other clients
        this.roomManager.sendMessage(JSON.stringify({
            type: 'particle-emitter',
            emitterId: emitterId,
            playerId: playerId,
            hitX: hitX,
            hitY: hitY,
            centerX: centerX,
            centerY: centerY,
            lifetime: emitterLifetime
        }));

        console.log(`Emitter created on ${playerId} for ${emitterLifetime}ms`);
    }

    /**
     * Actual generation of the emitter object into the emitter mapping.
     */
    private generateEmitter(emitterId: string, playerId: string, hitX: number, hitY: number, centerX: number, centerY: number, lifetime: number): void {
        // Calculate offset from center
        const offsetX = hitX - centerX;
        const offsetY = hitY - centerY;

        // Calculate direction (away from center towards hit point)
        const angle = Math.atan2(offsetY, offsetX);

        this.emitters.set(emitterId, {
            age: 0,
            direction: angle,
            emissionInterval: 200 + Math.random() * 300,
            lastEmission: 0,
            lifetime: lifetime,
            offset: {
                x: offsetX,
                y: offsetY
            },
            playerId: playerId
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

                this.generateParticles( // Create particles locally
                    worldX + (Math.random() - 0.5) * 8,
                    worldY + (Math.random() - 0.5) * 8,
                    `emitter_particles_${emitterId}_${emitter.age}`,
                    PARTICLES.BLOOD_DRIP, // TODO: Make this dynamically passed
                    {
                        x: Math.cos(angle) * finalSpeed,
                        y: Math.sin(angle) * finalSpeed
                    }
                );

                emitter.lastEmission = emitter.age;
                emitter.emissionInterval = 120 + Math.random() * 180; // More consistent timing
            }

            // Remove expired emitters
            if (emitter.age >= emitter.lifetime) {
                this.decalsManager.generateDecal(worldX, worldY, `emitter_decal_${emitterId}`, DECALS.BLOOD);
                emittersToRemove.push(emitterId);
            }
        });

        emittersToRemove.forEach(id => this.emitters.delete(id));
    }
    // [ Gore ]
    //
    /**
     * Generates gore particles using the decals for the character object.
     */
    public generateGore(playerId: string, centerX: number, centerY: number, playerSize: number): void {
        // Sample unique gore assets
        const goreCount = 2 + Math.floor(Math.random() * 4); // 2-5 pieces
        const gorePool = [...CHARACTER_DECALS.GORE];
        for (let i = 0; i < goreCount && gorePool.length > 0; i++) {
            const idx = Math.floor(Math.random() * gorePool.length);
            const goreAsset = gorePool.splice(idx, 1)[0];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * playerSize;

            const goreDecal = {
                type: 'gore',
                assetPath: goreAsset,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                rotation: Math.random() * Math.PI * 2,
                scale: 0.65 + Math.random() * 0.4
            };

            const decalId = `death_gore_${playerId}_${Date.now()}_${i}`;
            this.stampGore(goreDecal);
            this.decalsManager.decals.set(decalId, {
                params: null,
                pos: {
                    x: goreDecal.x,
                    y: goreDecal.y
                }
            });
        }

        // Sample unique blood assets
        const bloodCount = 1 + Math.floor(Math.random() * 2); // 1-2 pieces
        const bloodPool = [...CHARACTER_DECALS.BLOOD];
        for (let i = 0; i < bloodCount && bloodPool.length > 0; i++) {
            const idx = Math.floor(Math.random() * bloodPool.length);
            const bloodAsset = bloodPool.splice(idx, 1)[0];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (playerSize * 0.7);

            const bloodDecal = {
                type: 'blood',
                assetPath: bloodAsset,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                rotation: Math.random() * Math.PI * 2,
                scale: 1.25 + Math.random() * 0.2
            };

            const decalId = `death_blood_${playerId}_${Date.now()}_${i}`;
            this.stampGore(bloodDecal);
            this.decalsManager.decals.set(decalId, {
                params: null,
                pos: {
                    x: bloodDecal.x,
                    y: bloodDecal.y
                }
            });
        }
    }

    /**
     * Persists gore on the decal canvas.
     */
    private stampGore(decalData: any): void { // TODO: Type protect
        if (!this.ui.decalCtx) return;

        let image = this.renderdingManager.characterImages.get(decalData.assetPath);

        if (!image) {
            image = new Image();
            image.src = decalData.assetPath;
            this.renderdingManager.characterImages.set(decalData.assetPath, image);

            if (!image.complete) {
                image.onload = () => {
                    this.stampGore(decalData);
                };
                return;
            }
        }

        if (!image.complete || image.naturalWidth === 0) return;

        this.ui.decalCtx.save();
        this.ui.decalCtx.translate(decalData.x, decalData.y);
        this.ui.decalCtx.rotate(decalData.rotation);

        const drawSize = 32 * decalData.scale;
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
}