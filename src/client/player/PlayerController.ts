import { NETWORK } from "../Config";
import { AudioParams, CreateParticleParams, DeathDecal, DecalParams, EmitterParams, PlayerHitParams, SetSliderParams, Vec2 } from "../Types";

import { LuckController } from "./LuckController";
import { MoveController } from "./MoveController";
import { PlayerState } from "./PlayerState";

import { AudioManager } from "../AudioManager";
import { DecalsManager } from "../DecalsManager";
import { GameState } from "../GameState";
import { ObjectsManager } from "../ObjectsManager";
import { ParticlesManager } from "../ParticlesManager";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";
import { AudioConfig } from "../AudioConfig";


export class PlayerController {
    constructor(
        private audioConfig: AudioConfig,
        private audioManager: AudioManager,
        private decalsManager: DecalsManager,
        private gameState: GameState,
        private luckController: LuckController,
        private moveController: MoveController,
        private objectsManager: ObjectsManager,
        private particlesManager: ParticlesManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('customEvent_playerHitRelay', ((event: CustomEvent) => {
            console.log('Player hit event received:', event.detail.params);
            this.playerHit(event.detail.params);
        }) as EventListener);
    }

    /**
     * Updates the local player's position and movement state.
     * 
     * Applies acceleration, friction, sprint multipliers, and stamina drain
     * based on current movement input. Sends position updates to the server
     * when movement exceeds the defined threshold or interval.
     * 
     * Does not process updates when game is not active, player is dead, or dashing.
     */
    public updatePlayerPosition(delta: number): void {
        if (!this.gameState.gameInProgress || this.playerState.myPlayer.stats.health.value <= 0 || this.playerState.isDashing) return;

        const now = Date.now();
        const { inputX, inputY } = this.moveController.getMoveInput();

        // [ Sprinting ]
        const canSprint = this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value > 0 && this.moveController.isMoving();
        const currentSpeed = canSprint ? this.playerState.myPlayer.stats.speed * this.playerState.myPlayer.actions.sprint.multiplier : this.playerState.myPlayer.stats.speed;
        if (this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value <= 0) { // Stop sprinting if out of stamina
            this.playerState.isSprinting = false;
            console.log('Out of stamina, stopped sprinting');
        }
        //

        // CHANGED: Apply friction always, before calculating acceleration
        this.playerState.playerVelocityX *= Math.pow(this.playerState.myPlayer.physics.friction, delta);
        this.playerState.playerVelocityY *= Math.pow(this.playerState.myPlayer.physics.friction, delta);

        // CHANGED: Only apply acceleration when there's input
        if (this.moveController.isMoving()) {
            const targetVelocityX = inputX * currentSpeed;
            const targetVelocityY = inputY * currentSpeed;

            this.playerState.playerVelocityX += (targetVelocityX - this.playerState.playerVelocityX) * this.playerState.myPlayer.physics.acceleration * delta;
            this.playerState.playerVelocityY += (targetVelocityY - this.playerState.playerVelocityY) * this.playerState.myPlayer.physics.acceleration * delta;
        }

        let newX = this.playerState.myPlayer.transform.pos.x + this.playerState.playerVelocityX * delta;
        let newY = this.playerState.myPlayer.transform.pos.y + this.playerState.playerVelocityY * delta;

        this.playerState.myPlayer.transform.pos.x = newX;
        this.playerState.myPlayer.transform.pos.y = newY;

        let moved = (this.playerState.playerVelocityX !== 0 || this.playerState.playerVelocityY !== 0);

        const distanceFromLastSent = Math.sqrt(
            (this.playerState.myPlayer.transform.pos.x - this.playerState.lastSentX) ** 2 +
            (this.playerState.myPlayer.transform.pos.y - this.playerState.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2 && now - this.playerState.lastSentMoveTime >= NETWORK.MOVE_INTERVAL) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    pos: {
                        x: this.playerState.myPlayer.transform.pos.x,
                        y: this.playerState.myPlayer.transform.pos.y
                    }
                }
            }));

            this.playerState.lastSentX = this.playerState.myPlayer.transform.pos.x;
            this.playerState.lastSentY = this.playerState.myPlayer.transform.pos.y;
            this.playerState.lastSentMoveTime = now;
        }

        if (Math.abs(this.playerState.playerVelocityX) < 0.01) this.playerState.playerVelocityX = 0;
        if (Math.abs(this.playerState.playerVelocityY) < 0.01) this.playerState.playerVelocityY = 0;
    }

    /**
     * Processes local hits to players. Sends network message for syncing.
     */
    public playerHit(params: PlayerHitParams): void {
        // Update health slider
        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
        const healthSliderParams: SetSliderParams = {
            sliderId: 'healthBar',
            targetValue: this.playerState.myPlayer.stats.health.value,
            maxValue: this.playerState.myPlayer.stats.health.max,
            lerpTime: sliderLerpTime
        }
        this.utility.setSlider(healthSliderParams);

        if (params.target.id === this.userId) { // Random chance to play grunt when I'm hit
            if (this.utility.getRandomNum(0, 1) < 0.2) { // 20%
                const gruntParams: AudioParams = {
                    src: this.utility.getRandomInArray(this.audioConfig.resources.sfx.player.male.grunt), // TODO: Allow player to define gender
                    listener: {
                        x: this.playerState.myPlayer.transform.pos.x,
                        y: this.playerState.myPlayer.transform.pos.y
                    },
                    output: 'voice',
                    pitch: { min: 0.95, max: 1.075 },
                    spatial: {
                        blend: 1.0,
                        pos: { x: this.playerState.myPlayer.transform.pos.x, y: this.playerState.myPlayer.transform.pos.y }
                    },
                    volume: { min: 0.9, max: 1 }
                }
                this.audioManager.playAudioNetwork(gruntParams);
            }
        } else { // The player hit was not me
            const sfxParams: AudioParams = {
                src: this.utility.getRandomInArray(this.audioConfig.resources.sfx.impact.flesh.bullet), // TODO: User current body material
                listener: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y
                },
                output: 'sfx',
                pitch: { min: 0.925, max: 1.15 },
                spatial: {
                    blend: 1.0,
                    pos: { x: params.source.transform.pos.x, y: params.source.transform.pos.y }
                },
                volume: { min: 0.95, max: 1 }
            }
            this.audioManager.playAudioNetwork(sfxParams);

            const decalParams: DecalParams = {
                id: `blood_${params.source.id}`,
                pos: {
                    x: params.source.transform.pos.x,
                    y: params.source.transform.pos.y
                },
                type: 'parametric',
                parametric: this.decalsManager.decalsConfig.decals.blood // TODO: Get current blood type
            };
            this.decalsManager.createDecal(decalParams);

            const bloodDirection: Vec2 = {
                x: -params.source.velocity.x / Math.sqrt(params.source.velocity.x ** 2 + params.source.velocity.y ** 2),
                y: -params.source.velocity.y / Math.sqrt(params.source.velocity.x ** 2 + params.source.velocity.y ** 2)
            };

            const particleParams: CreateParticleParams = {
                id: `blood_${params.source.id}`,
                pos: {
                    x: params.source.transform.pos.x,
                    y: params.source.transform.pos.y
                },
                particleParams: this.particlesManager.particlesConfig.particles.blood.spray, // TODO: Get current blood type
                direction: bloodDirection
            }
            this.particlesManager.createParticles(particleParams);

            const emission: EmitterParams = {
                id: `particle_emitter_${params.target.id}_${Date.now()}`,
                interval: this.utility.getRandomNum(200, 400), // ms
                lifetime: this.utility.getRandomNum(1000, 3000), // ms
                offset: {
                    x: params.target.transform.pos.x,
                    y: params.target.transform.pos.y
                },
                particleType: this.particlesManager.particlesConfig.particles.blood.drip, // TODO: Get current blood type
                playerId: params.target.id,
                pos: {
                    x: params.source.transform.pos.x,
                    y: params.source.transform.pos.y
                }
            };
            this.particlesManager.createEmitter(emission);

            if (params.newHealth <= 0) { // If they died, I get a kill
                console.log(`I killed ${params.target.id}!`);

                const me = this.ui.leaderboard.get(this.userId);
                if (me) { me.kills++; }

                const other = this.ui.leaderboard.get(params.target.id);
                if (other) { other.deaths++; }

                this.ui.updateLeaderboardDisplay(this.userId);
            }
        }

        const message = {
            type: 'player-hit',
            targetId: params.target.id,
            shooterId: params.shooterId,
            damage: params.damage,
            newHealth: params.newHealth,
            projectileId: params.source.id,
            wasKill: params.wasKill
        }
        this.roomManager.sendMessage(JSON.stringify(message));
    }

    /**
     * Record the player's own death when they are the targetId of a player-hit message and their health reaches 0.
     */
    public playerDeath(): void {
        const triggeredUniques = this.triggerUniques();

        console.log('I died! Waiting for round to end...');

        this.playerState.resetPlayerState();

        const ammoBox = this.objectsManager.spawnAmmoBox(10);
        this.objectsManager.ammoBoxes.set(ammoBox.id, ammoBox);

        const gore: DeathDecal = {
            gore: {
                amount: this.utility.getRandomInt(2, 5)
            },
            blood: {
                amount: this.utility.getRandomInt(1, 3)
            },
            ownerId: this.userId,
            pos: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            radius: this.playerState.myPlayer.stats.size
        }
        this.particlesManager.generateGore(gore);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-death',
            playerId: this.userId,
            x: this.playerState.myPlayer.transform.pos.x,
            y: this.playerState.myPlayer.transform.pos.y,
            size: this.playerState.myPlayer.stats.size,
            ammoBox: ammoBox
        }));
    }

    /**
     * Used to trigger player related uniques during specific states like death, etc.
     * 
     * Returns each unique that succeeds.
     */
    private triggerUniques(): string[] {
        if (this.playerState.myPlayer.unique.length === 0) return [];

        const succeededUniques: string[] = [];

        for (const unique of this.playerState.myPlayer.unique) {
            if (unique === 'phoenix_module') {
                const succeeded = this.luckController.luckRoll(1.5);

                if (succeeded) {
                    console.log('Phoenix Module activated!');

                    // Double damage permanently
                    this.playerState.myPlayer.actions.primary.projectile.damage *= 2;

                    // Remove phoenix module so it can't trigger again
                    const index = this.playerState.myPlayer.unique.indexOf('phoenix_module');
                    if (index > -1) {
                        this.playerState.myPlayer.unique.splice(index, 1);
                    }

                    succeededUniques.push('phoenix_module');
                }
            }
        }
        return succeededUniques;
    }
}