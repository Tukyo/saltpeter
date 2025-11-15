import { NETWORK } from "../Config";
import { AudioParams, CreateParticleParams, DeathDecal, DecalParams, EmitterParams, FootstepParams, LiquidFrictionTypes, PixelWaterData, PlayerHitParams, SetSliderParams, Vec2 } from "../Types";

import { DecalsManager } from "../DecalsManager";
import { GameState } from "../GameState";
import { LuckController } from "./LuckController";
import { MoveController } from "./MoveController";
import { ObjectsManager } from "../ObjectsManager";
import { PlayerState } from "./PlayerState";
import { ParticlesManager } from "../ParticlesManager";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";

import { AudioConfig } from "../audio/AudioConfig";
import { AudioManager } from "../audio/AudioManager";
import { World } from "../world/World";

export class PlayerController {

    // Footstep Configuration
    //
    private footstepInterval = 0;
    private lastFootstepTime = 0;
    private readonly FOOTSTEP_INTERVAL_MIN = 200; // ms - running
    private readonly FOOTSTEP_INTERVAL_MAX = 500; // ms - walking
    private readonly FOOTSTEP_SAMPLE_RADIUS = 8; // pixels around player
    //
    //

    private readonly MEDIUM_WATER_DEPTH = 0.35;
    private readonly DEEP_WATER_DEPTH = 0.6;
    private readonly POSITION_SAMPLE_INTERVAL = 250; // ms

    private lastSampleTime = 0;
    private lastWaterData: PixelWaterData | null = null;
    private lastFriction: number = 0;

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
        private utility: Utility,
        private world: World
    ) {
        this.setupEventListeners();
        this.initSwimDebugMenu();
    }

    private setupEventListeners(): void {
        window.addEventListener('customEvent_playerHitRelay', ((event: CustomEvent) => {
            console.log('Player hit event received:', event.detail.params);
            this.playerHit(event.detail.params);
        }) as EventListener);
    }

    public updatePlayerPosition(delta: number): void {
        if (!this.gameState.gameInProgress || this.playerState.myPlayer.stats.health.value <= 0)
            return;

        const now = Date.now();
        const { inputX, inputY } = this.moveController.getMoveInput();
        const isMoveInput = this.moveController.isMoveInput();
        const isMoving = this.moveController.isMoving();

        // Water sampling
        if (isMoving && now - this.lastSampleTime >= this.POSITION_SAMPLE_INTERVAL) {
            this.samplePlayerPosition(now);
        }

        this.applyEnvironmentalFriction(delta);

        // Movement logic
        if (this.playerState.isSwimming) {
            this.handleSwimming(delta, inputX, inputY, isMoveInput);
        } else if (!this.playerState.isDashing) {
            this.handleGroundMovement(delta, inputX, inputY, isMoveInput);
        }

        // Position update
        this.playerState.myPlayer.transform.pos.x += this.playerState.playerVelocityX * delta;
        this.playerState.myPlayer.transform.pos.y += this.playerState.playerVelocityY * delta;

        // Network + footsteps
        this.syncMovement(now);

        if (!this.playerState.isSwimming && this.moveController.isMoving()) {
            const speedRatio = Math.min(1, this.moveController.getMoveSpeed() / this.moveController.getMaxSpeed());
            this.footstepInterval =
                this.FOOTSTEP_INTERVAL_MAX -
                speedRatio * (this.FOOTSTEP_INTERVAL_MAX - this.FOOTSTEP_INTERVAL_MIN);

            if (now - this.lastFootstepTime >= this.footstepInterval) {
                this.footstep();
                this.lastFootstepTime = now;
            }
        }
    }

    private handleGroundMovement(delta: number, inputX: number, inputY: number, isMoveInput: boolean): void {
        // Sprinting logic
        const canSprint =
            this.playerState.isSprinting &&
            this.playerState.myPlayer.stats.stamina.value > 0 &&
            isMoveInput;

        const currentSpeed = canSprint
            ? this.playerState.myPlayer.stats.speed *
            this.playerState.myPlayer.actions.sprint.multiplier
            : this.playerState.myPlayer.stats.speed;

        // If sprinting but out of stamina, stop
        if (this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value <= 0) {
            this.playerState.isSprinting = false;
            console.log("Out of stamina, stopped sprinting");
        }

        if (isMoveInput) {
            const accel = this.playerState.myPlayer.physics.acceleration;
            const targetVX = inputX * currentSpeed;
            const targetVY = inputY * currentSpeed;

            this.playerState.playerVelocityX += (targetVX - this.playerState.playerVelocityX) * accel * delta;
            this.playerState.playerVelocityY += (targetVY - this.playerState.playerVelocityY) * accel * delta;
        }
    }

    private lastStrokeTime: number = 0;
    private strokePower: number = 0;
    private lastSwimDir: Vec2 = { x: 0, y: 0 };

    public STROKE_FORCE = 7.5;
    public STROKE_DECAY_RATE = 0.996;
    public STROKE_COOLDOWN = 0.8;
    public MAX_SWIM_SPEED = 3.5;

    // Drop this anywhere in PlayerController (or a debug-only file)
    private initSwimDebugMenu(): void {
        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.ctrlKey && e.code === "Numpad5") {
                this.toggleSwimDebugMenu();
            }
        });
    }

    private toggleSwimDebugMenu(): void {
        let panel = document.getElementById("swimDebugPanel");
        if (panel) {
            panel.remove();
            console.log("Swim Debug Menu closed");
            return;
        }

        panel = document.createElement("div");
        panel.id = "swimDebugPanel";
        panel.style.position = "fixed";
        panel.style.top = "20px";
        panel.style.right = "20px";
        panel.style.background = "rgba(0,0,0,0.8)";
        panel.style.color = "#fff";
        panel.style.padding = "10px";
        panel.style.zIndex = "9999";
        panel.style.fontFamily = "monospace";
        panel.style.fontSize = "12px";
        panel.style.border = "1px solid #555";
        panel.style.width = "200px";

        const settings = [
            { key: "STROKE_FORCE", min: 1, max: 200, step: 1 },
            { key: "STROKE_DECAY_RATE", min: 0.8, max: 0.999, step: 0.001 },
            { key: "STROKE_COOLDOWN", min: 0.1, max: 3, step: 0.05 },
            { key: "MAX_SWIM_SPEED", min: 1, max: 10, step: 0.1 },
        ];

        settings.forEach(setting => {
            const label = document.createElement("label");
            label.textContent = setting.key;
            label.style.display = "block";

            const input = document.createElement("input");
            input.type = "range";
            input.min = String(setting.min);
            input.max = String(setting.max);
            input.step = String(setting.step);
            // @ts-ignore
            input.value = String(this[setting.key]);

            const valueText = document.createElement("span");
            // @ts-ignore
            valueText.textContent = " " + this[setting.key];

            input.addEventListener("input", () => {
                const v = parseFloat(input.value);
                // @ts-ignore
                this[setting.key] = v;
                valueText.textContent = " " + v.toFixed(3);
                console.log(`Adjusted ${setting.key}: ${v}`);
            });

            panel.appendChild(label);
            panel.appendChild(input);
            panel.appendChild(valueText);
        });

        document.body.appendChild(panel);
        console.log("Swim Debug Menu opened");
    }


    private handleSwimming(delta: number, inputX: number, inputY: number, isMoveInput: boolean): void {
        this.playerState.isSprinting = false;
        this.playerState.isDashing = false;

        const now = performance.now(); // more precise than Date.now()

        if (isMoveInput) {
            this.lastSwimDir.x = inputX;
            this.lastSwimDir.y = inputY;

            // fire only once per cooldown window
            if (now - this.lastStrokeTime >= this.STROKE_COOLDOWN * 1000) {
                this.strokePower = this.STROKE_FORCE;
                this.lastStrokeTime = now;
                console.log("Swim stroke triggered | Power: " + this.strokePower);
            }
        } else {
            this.strokePower = 0;
            return;
        }

        // active stroke adds impulse + decays
        if (this.strokePower > 0) {
            this.playerState.playerVelocityX += this.lastSwimDir.x * this.strokePower * delta;
            this.playerState.playerVelocityY += this.lastSwimDir.y * this.strokePower * delta;
            this.strokePower *= Math.pow(this.STROKE_DECAY_RATE, delta * 60);
        }

        const vx = this.playerState.playerVelocityX;
        const vy = this.playerState.playerVelocityY;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > this.MAX_SWIM_SPEED) {
            const scale = this.MAX_SWIM_SPEED / speed;
            this.playerState.playerVelocityX *= scale;
            this.playerState.playerVelocityY *= scale;
        }
    }



    private syncMovement(now: number): void {
        const distance = Math.sqrt(
            (this.playerState.myPlayer.transform.pos.x - this.playerState.lastSentX) ** 2 +
            (this.playerState.myPlayer.transform.pos.y - this.playerState.lastSentY) ** 2
        );

        const isMoving = this.moveController.isMoving();

        if (isMoving && distance > 2 && now - this.playerState.lastSentMoveTime >= NETWORK.MOVE_INTERVAL) {
            this.roomManager.sendMessage(JSON.stringify({
                type: "player-move",
                transform: { pos: this.playerState.myPlayer.transform.pos }
            }));

            this.playerState.lastSentX = this.playerState.myPlayer.transform.pos.x;
            this.playerState.lastSentY = this.playerState.myPlayer.transform.pos.y;
            this.playerState.lastSentMoveTime = now;
        }
    }

private applyEnvironmentalFriction(delta: number): void {
    let appliedFriction = this.lastFriction;

    if (this.lastWaterData && this.lastWaterData.hasWater) {
        const depth = this.lastWaterData.waterLevel;

        if (depth >= this.DEEP_WATER_DEPTH) {
            // fully submerged → use water friction directly
            appliedFriction = LiquidFrictionTypes.Water;
        } else {
            // shallow / medium → increase drag temporarily
            const blend = this.utility.clamp(depth / this.DEEP_WATER_DEPTH, 0, 1);

            // inverted curve: shallow = strongest drag
            const shallowDragBoost = 1 - Math.pow(blend, 2);

            // compound land friction and extra shallow drag
            appliedFriction = this.lastFriction * (1 - 0.25 * shallowDragBoost);
        }
    }

    appliedFriction = this.utility.clamp(appliedFriction, 0.7, 1.0);

    const frictionFactor = Math.pow(appliedFriction, delta);
    this.playerState.playerVelocityX *= frictionFactor;
    this.playerState.playerVelocityY *= frictionFactor;
}



    private samplePlayerPosition(now: number): void {
        const playerPos = this.playerState.myPlayer.transform.pos;
        const samplePos: Vec2 = { x: Math.round(playerPos.x), y: Math.round(playerPos.y) };

        this.lastWaterData = this.world.getWaterData(samplePos); // TODO: Performance overhead, have to find another way
        this.lastSampleTime = now;

        const surface = this.world.getPhysicsAt(samplePos.x, samplePos.y);
        if (surface && "friction" in surface) {
            const value = (surface as { friction?: number }).friction;
            if (typeof value === "number") {
                this.lastFriction = value;
                console.log("Updated surface friction:", value);
            }
        }

        if (this.lastWaterData && this.lastWaterData.hasWater) {
            const inDeepWater = this.lastWaterData.waterLevel >= this.DEEP_WATER_DEPTH;
            if (inDeepWater && !this.playerState.isSwimming) {
                this.playerState.isSwimming = true;
                console.log("Entered swimming state, waterLevel: " + this.lastWaterData.waterLevel);
            } else if (!inDeepWater && this.playerState.isSwimming) {
                this.playerState.isSwimming = false;
                console.log("Exited swimming state, waterLevel: " + this.lastWaterData.waterLevel);
            }
        } else if (this.playerState.isSwimming) {
            this.playerState.isSwimming = false;
            console.log("Exited swimming state, no water detected");
        }
    }

    /**
     * Processes local hits to players. Sends network message for syncing.
     */
    public playerHit(params: PlayerHitParams): void {
        this.ui.updateSlider('health');

        if (params.target.id === this.userId) { // Random chance to play grunt when I'm hit
            if (this.utility.getRandomNum(0, 1) < 0.2) { // 20%
                const gruntParams: AudioParams = {
                    src: this.utility.getRandomInArray(this.audioConfig.resources.sfx.player.voice.voice_00.grunt), // TODO: Allow player to define gender
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
                src: this.utility.getRandomInArray(this.audioConfig.resources.sfx.impact.flesh.ranged), // TODO: User current body material && attack type hit
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
                particleParams: this.particlesManager.particlesConfig.goreParticles.blood.spray, // TODO: Get current blood type
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
                particleType: this.particlesManager.particlesConfig.goreParticles.blood.drip, // TODO: Get current blood type
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
        this.decalsManager.generateGore(gore);

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

    /**
     * Samples terrain and water around player and blends both materials for footstep audio.
     */
    private footstep(): void {
        const playerPos = this.playerState.myPlayer.transform.pos;
        const materialCounts = new Map<string, number>();
        const samplePoints = 8; // TODO: Optimize this

        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * Math.PI * 2;
            const sampleX = Math.round(playerPos.x + Math.cos(angle) * this.FOOTSTEP_SAMPLE_RADIUS);
            const sampleY = Math.round(playerPos.y + Math.sin(angle) * this.FOOTSTEP_SAMPLE_RADIUS);
            const mat = this.world.getMaterialAt(sampleX, sampleY);
            if (mat) materialCounts.set(mat.name, (materialCounts.get(mat.name) || 0) + 1);
        }

        // Determine dominant ground material
        let primaryMaterial: string | null = null;
        let maxCount = 0;
        materialCounts.forEach((count, matName) => {
            if (count > maxCount) {
                maxCount = count;
                primaryMaterial = matName;
            }
        });
        if (!primaryMaterial) return;

        // Use cached water data
        const cached = this.lastWaterData;
        const waterRatio = cached && cached.hasWater ? this.utility.clamp(cached.waterLevel, 0, 1) : 0;
        const isWet = waterRatio > 0.05;

        const moveSpeed = this.moveController.getMoveSpeed();
        const maxSpeed = this.moveController.getMaxSpeed();
        const speedRatio = Math.min(1, moveSpeed / maxSpeed);

        const context: FootstepParams = {
            pos: playerPos,
            material: primaryMaterial,
            waterRatio: waterRatio,
            isWet: isWet,
            speedRatio: speedRatio
        };

        this.footstepSound(context);
        this.footstepImpact(context);
    }


    /**
     * Plays a footstep sound with the provided context.
     */
    private footstepSound(params: FootstepParams): void {
        const { pos, material, waterRatio, isWet, speedRatio } = params;

        const footsteps = this.audioConfig.resources.sfx.player.locomotion.footsteps;
        const materialFootsteps = footsteps[material as keyof typeof footsteps];
        if (!materialFootsteps || !Array.isArray(materialFootsteps) || materialFootsteps.length === 0) return;

        // --- Unified volume & pitch scaling ---
        const baseVolumeMin = 0.001;
        const baseVolumeMax = 0.01;
        const speedInfluence = 0.075;
        const depthInfluence = 0.1;

        // Blend both influences — faster & deeper = louder
        const influence = speedInfluence * speedRatio + depthInfluence * waterRatio;
        const scaledMin = baseVolumeMin + influence;
        const scaledMax = baseVolumeMax + influence;

        const pitchMin = 0.95 + speedRatio * 0.03;
        const pitchMax = 1.05 + speedRatio * 0.03;

        const waterBlend = Math.min(1, waterRatio * 6);
        const groundVolumeScale = 1 - waterBlend;
        const waterVolumeScale = 0.5 + waterBlend * 0.5;

        const groundStartOffset = 0.04 * (1 - speedRatio);

        // Ground step
        if (waterRatio < this.MEDIUM_WATER_DEPTH) {
            const baseFootstep = this.utility.getRandomInArray(materialFootsteps);
            const baseParams: AudioParams = {
                src: baseFootstep,
                listener: pos,
                output: "sfx",
                pitch: { min: pitchMin, max: pitchMax },
                startTime: { min: groundStartOffset, max: groundStartOffset + 0.005 },
                volume: { min: scaledMin * groundVolumeScale, max: scaledMax * groundVolumeScale }
            };
            this.audioManager.playAudio(baseParams);
        }

        // Water layer
        if (isWet) {
            const waterFootsteps = footsteps.water;
            let splashArray: string[] = [];

            if (waterRatio > 0 && waterRatio < this.MEDIUM_WATER_DEPTH) splashArray = waterFootsteps.light;
            else if (waterRatio >= this.MEDIUM_WATER_DEPTH) splashArray = waterFootsteps.medium;

            if (splashArray.length > 0) {
                const waterStartOffset = 0.04 * speedRatio;
                const randomSplash = this.utility.getRandomInArray(splashArray);
                const splashParams: AudioParams = {
                    src: randomSplash,
                    listener: pos,
                    output: "sfx",
                    pitch: { min: pitchMin, max: pitchMax },
                    startTime: { min: waterStartOffset, max: waterStartOffset + 0.005 },
                    volume: { min: scaledMin * waterVolumeScale, max: scaledMax * waterVolumeScale },
                    delay: { min: 0.015, max: 0.02 }
                };
                this.audioManager.playAudio(splashParams);
            }
        }
    }

    private footstepImpact(params: FootstepParams): void {
        const { pos, material, speedRatio, waterRatio } = params;
        const force = (0.4 + speedRatio * 0.6) * (1 - waterRatio * 0.5);
        this.world.worldEdit.applyFootstepAt(pos, material, force);
    }
}