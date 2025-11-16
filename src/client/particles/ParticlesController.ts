import { Particle } from "../Types";

import { ParticlesManager } from "./ParticlesManager";
import { Utility } from "../Utility";

import { AudioConfig } from "../audio/AudioConfig";
import { AudioManager } from "../audio/AudioManager";

import { PlayerState } from "../player/PlayerState";

import { World } from "../world/World";

export class ParticlesController {
    constructor(
        private audioConfig: AudioConfig,
        private audioManager: AudioManager,
        private particlesManager: ParticlesManager,
        private playerState: PlayerState,
        private utility: Utility,
        private world: World,
    ) {
        this.particlesManager.addCollisionListener(this.onParticleCollision.bind(this));
    }

    private onParticleCollision(p: Particle): void {
        if (p.id.startsWith("shell_")) { // route shell casings
            this.handleShellCollision(p);
            return;
        }

        // future:
        // if (p.id.startsWith("blood_")) this.handleBloodCollision(p);
        // if (p.id.startsWith("spark_")) this.handleSparkCollision(p);
        // if (p.id.startsWith("debris_")) this.handleDebrisCollision(p);
        // ...
    }

    private handleShellCollision(p: Particle): void {
        const px = Math.round(p.pos.x);
        const py = Math.round(p.pos.y);

        const currentWeapon = this.playerState.myPlayer.inventory.primary;
        const shellSets = this.audioConfig.resources.sfx.weapon[currentWeapon].shell;
        if (!shellSets) return;

        // 1) Resolve environmental state (water → soft → hard)
        const water = this.world.getWaterData({ x: px, y: py });
        const mat = this.world.getMaterialAt(px, py);
        const isSoft = mat?.tags?.includes("soft") === true;

        let list: string[] = [];
        let volume = { min: 0, max: 0 };

        if (water && water.waterLevel > 0) {
            list = shellSets.water;
            volume = { min: 0.025, max: 0.1 };
        } else if (isSoft) {
            list = shellSets.soft;
            volume = { min: 0.025, max: 0.075 };
        } else {
            list = shellSets.hard;
            volume = { min: 0.2, max: 0.3 };
        }

        if (!list || list.length === 0) return;

        const shellSfx = this.utility.getRandomInArray(list);

        this.audioManager.playAudioNetwork({
            src: shellSfx,
            listener: { x: px, y: py },
            output: 'sfx',
            spatial: { blend: 1.0, pos: { x: px, y: py } },
            pitch: { min: 0.95, max: 1.125 },
            volume
        });
    }
}