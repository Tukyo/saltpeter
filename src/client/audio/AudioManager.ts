import { WORLD } from "../Config";
import { ActiveAudio, AudioFileType, AudioMixer, AudioMixerName, AudioParams } from "../Types";

import { RoomManager } from "../RoomManager";
import { SettingsManager } from "../SettingsManager";
import { Utility } from "../Utility";

export class AudioManager {
    private audioContext: AudioContext;

    private buffers: Map<string, AudioBuffer> = new Map();
    private mixers: Map<AudioMixerName, GainNode> = new Map();

    private loops: Set<{ source: AudioBufferSourceNode; gain: GainNode; params: AudioParams }> = new Set();

    constructor(
        private roomManager: RoomManager,
        private settingsManager: SettingsManager,
        private utility: Utility
    ) {
        this.audioContext = new AudioContext();
        this.initMixers();
    }

    /**
     * Initializes mixers and sets gains based on stored settings.
     */
    private initMixers(): void {
        const mixer = this.settingsManager.getSettings().audio.mixer;

        for (const name in mixer) {
            const gain = this.audioContext.createGain();
            gain.connect(this.audioContext.destination);
            this.mixers.set(name as AudioMixerName, gain);
        }

        this.updateMixerGains();
    }

    /**
     * Updates the gain for all mixers.
     */
    public updateMixerGains(): void {
        for (const [name, gain] of this.mixers) {
            gain.gain.value = this.getMixerVolume(name);
        }
    }

    /**
     * Gets the volume for a specific mixer.
     */
    private getMixerVolume(name: AudioMixerName): number {
        const mixer = this.settingsManager.getSettings().audio.mixer;
        let total = 1.0;
        let current: AudioMixer | null = mixer[name];

        while (current !== null) {
            total *= current.volume;
            current = current.out ? mixer[current.out] : null;
        }

        return total;
    }

    /**
     * Preloads audio from the object passed.
     * 
     * The object should contain an array of sounds.
     */
    public async preloadAudio(sounds: any, extension: AudioFileType): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const key in sounds) {
            const value = sounds[key];

            if (Array.isArray(value)) {
                value.forEach(src => {
                    if (typeof src === 'string' && src.endsWith(extension)) {
                        promises.push(this.loadSound(src));
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                promises.push(this.preloadAudio(value, extension));
            }
        }

        await Promise.all(promises);
    }

    /**
     * Loads a specific sound and creates a buffer for the file.
     */
    private async loadSound(src: string): Promise<void> {
        if (this.buffers.has(src)) return;

        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.buffers.set(src, audioBuffer);
        } catch (error) {
            console.error(`Failed to load audio: ${src}`, error);
        }
    }

    /**
     * Triggers audio playback.
     */
    public playAudio(params: AudioParams): ActiveAudio | null {
        const buffer = this.buffers.get(params.src);
        if (!buffer) {
            console.warn(`Audio not loaded: ${params.src}`);
            return null;
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const category: AudioMixerName = params.output || "master";
        const mixerGain = this.mixers.get(category);
        if (!mixerGain) {
            console.warn(`No mixer found: ${category}`);
            return null;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const panNode = this.audioContext.createStereoPanner();

        source.buffer = buffer;
        source.loop = params.loop ?? false;

        if (params.pitch) {
            const pitch = this.utility.getRandomNum(params.pitch.min, params.pitch.max);
            source.playbackRate.value = Math.max(0.25, Math.min(4, pitch));
        }

        let volume = 1.0;
        if (params.volume) {
            volume = this.utility.getRandomNum(params.volume.min, params.volume.max);
        }

        const blend = params.spatial?.blend ?? 0;

        if (blend > 0 && params.spatial?.pos && params.listener) {
            const dx = params.spatial.pos.x - params.listener.x;
            const dy = params.spatial.pos.y - params.listener.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let distanceVolume: number;

            if (params.spatial.rolloff) {
                const rolloffType = params.spatial.rolloff.type || 'linear';
                const factor = params.spatial.rolloff.factor;
                const maxDistance = params.spatial.rolloff.distance;

                if (rolloffType === 'logarithmic') {
                    const referenceDistance = maxDistance * factor;
                    if (distance < referenceDistance) {
                        distanceVolume = 1.0;
                    } else {
                        const normalizedDistance = (distance - referenceDistance) / (maxDistance - referenceDistance);
                        distanceVolume = Math.max(0, 1 - Math.pow(normalizedDistance, 0.5));
                    }
                } else {
                    distanceVolume = Math.max(0, 1 - (distance / maxDistance) * factor);
                }
            } else {
                const maxDistance = Math.max(WORLD.WIDTH, WORLD.HEIGHT);
                distanceVolume = Math.max(0, 1 - (distance / maxDistance));
            }

            volume *= (1 - blend) + (distanceVolume * blend);

            // Calculate stereo pan
            const maxDistance = params.spatial.rolloff?.distance || Math.max(WORLD.WIDTH, WORLD.HEIGHT);
            const panValue = Math.max(-1, Math.min(1, dx / (maxDistance / 2)));
            panNode.pan.value = panValue;
        } else {
            panNode.pan.value = 0; // Center for non-spatial sounds
        }

        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(mixerGain);

        if (params.loop) {
            this.loops.add({ source, gain: gainNode, params });
        }

        source.onended = () => {
            const loopEntry = Array.from(this.loops).find(l => l.source === source);
            if (loopEntry) this.loops.delete(loopEntry);
            gainNode.disconnect();
        };

        let startOffset = 0;
        if (params.startTime) {
            startOffset = this.utility.getRandomNum(params.startTime.min, params.startTime.max);
        }

        let delayMs = 0;
        if (params.delay) {
            delayMs = this.utility.getRandomNum(params.delay.min, params.delay.max) * 1000;
        }

        const activeAudio: ActiveAudio = {
            setVolume: (v: number) => {
                gainNode.gain.value = Math.max(0, Math.min(1, v));
            },
            stop: () => {
                try {
                    source.stop();
                } catch (e) {
                    // Already stopped
                }
                const loopEntry = Array.from(this.loops).find(l => l.source === source);
                if (loopEntry) this.loops.delete(loopEntry);
            }
        };

        this.utility.safeTimeout(() => {
            try {
                source.start(0, startOffset);
            } catch (error) {
                console.warn('Audio play failed:', error);
            }
        }, delayMs);

        return activeAudio;
    }

    /**
     * Triggers audio playback over the network.
     */
    public playAudioNetwork(params: AudioParams): void {
        this.playAudio(params);
        this.roomManager.sendMessage(JSON.stringify({
            type: 'play-audio',
            params: params
        }));
    }

    /**
     * Refreshes all currently active loops.
     */
    public refreshActiveLoops(): void {
        const records = Array.from(this.loops);

        for (const record of records) {
            this.loops.delete(record);
            try {
                record.source.stop();
            } catch (e) {
                // Already stopped
            }
            this.playAudio(record.params);
        }
    }
}