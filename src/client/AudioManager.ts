import { CANVAS } from "./Config";

import { AudioPool } from "./AudioPool";
import { AudioParams } from "./Types";
import { RoomManager } from "./RoomManager";
import { SettingsManager } from "./SettingsManager";
import { Utility } from "./Utility";
import { AudioConfig } from "./AudioConfig";

export class AudioManager {
    private audioPool: AudioPool;

    constructor(
        private audioConfig: AudioConfig,
        private roomManager: RoomManager,
        private settingsManager: SettingsManager,
        private utility: Utility
    ) {
        this.audioPool = new AudioPool(
            this.audioConfig.settings.poolSize,
            this.audioConfig.settings.maxConcurrent
        );
    }

    // #region [ Playback ]
    //
    /**
     * Plays an audio source using the predefined pool for the audio source.
     */
    public playAudio(params: AudioParams): void {
        const audio = this.audioPool.getAudio(params.src);
        if (!audio) {
            console.warn(`Audio pool exhausted or max concurrent reached for: ${params.src}`);
            return;
        }

        // [ Volume ]
        let volume = 1.0;
        if (params.volume) {
            volume = params.volume.min + Math.random() * (params.volume.max - params.volume.min);
        }

        // [ 2D Spatial Audio ]
        const blend = params.spatial?.blend ?? 0;
        if (blend > 0 && params.spatial?.pos) {
            const dx = params.spatial.pos.x - params.listener.x;
            const dy = params.spatial.pos.y - params.listener.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let distanceVolume: number;

            if (params.spatial.rolloff) {
                const rolloffType = params.spatial.rolloff.type || 'linear';
                const factor = params.spatial.rolloff.factor;
                const maxDistance = params.spatial.rolloff.distance;

                if (rolloffType === 'logarithmic') {
                    // Factor determines reference distance as % of max distance
                    const referenceDistance = maxDistance * factor;

                    if (distance < referenceDistance) {
                        distanceVolume = 1.0;
                    } else {
                        const normalizedDistance = (distance - referenceDistance) / (maxDistance - referenceDistance);
                        distanceVolume = Math.max(0, 1 - Math.pow(normalizedDistance, 0.5));
                    }
                } else {
                    // Linear: factor is just multiplier on falloff curve
                    distanceVolume = Math.max(0, 1 - (distance / maxDistance) * factor);
                }
            } else {
                // Default: simple linear falloff using canvas dimensions as fallback
                const maxDistance = Math.max(CANVAS.WIDTH, CANVAS.HEIGHT); //TODO: Remove reliance on config
                distanceVolume = Math.max(0, 1 - (distance / maxDistance));
            }

            volume *= (1 - blend) + (distanceVolume * blend);
        }

        // [ Mixer ]
        const outputGroup = params.output?.toLowerCase() || null;
        const mixer = this.settingsManager.getSettings().audio.mixer;
        if (outputGroup && mixer[outputGroup as keyof typeof mixer] !== undefined) {
            volume *= mixer[outputGroup as keyof typeof mixer];
        }

        volume *= this.settingsManager.getSettings().audio.mixer.master;
        audio.volume = Math.max(0, Math.min(1, volume));

        // [ Pitch ]
        if (params.pitch) {
            const pitch = params.pitch.min + Math.random() * (params.pitch.max - params.pitch.min);
            audio.playbackRate = Math.max(0.25, Math.min(4, pitch));
        }

        // [ Loop ]
        if (params.loop !== undefined) {
            audio.loop = params.loop;
        }

        // [ Trigger Delay ]
        let delayMs = 0;
        if (params.delay) {
            delayMs = (params.delay.min + Math.random() * (params.delay.max - params.delay.min)) * 1000; // Convert to seconds
        }

        this.utility.safeTimeout(() => {
            audio.play().catch((error: unknown) => {
                console.warn('Audio play failed:', error);
            });
        }, delayMs);
    }

    /**
     * Syncs an audio trigger over the network.
     */
    public playAudioNetwork(params: AudioParams): void {
        this.playAudio(params);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'play-audio',
            params: params
        }));
    }
    //
    // #endregion

    // #region [ Preloading ]
    /**
     * Preloads all audio of a single filetype for the game.
     */
    public preloadAudioAssets(sfx: any, extension: string): void {
        this.preloadSFX(sfx, extension);
    }

    /**
     * Iterate through the passed audio object, and preload them for the session.
     */
    private preloadSFX(obj: any, extension: string): void {
        for (const key in obj) {
            const value = obj[key];

            if (Array.isArray(value)) {
                // If it's an array, assume it's an array of audio file paths
                value.forEach(src => {
                    if (typeof src === 'string' && (src.endsWith(extension))) { // All sound files should be .ogg
                        this.audioPool.preloadSound(src);
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                // If it's an object, recurse into it
                this.preloadSFX(value, extension);
            }
        }
    }
    //
    // #endregion
}