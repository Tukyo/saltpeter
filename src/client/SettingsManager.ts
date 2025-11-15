import { GAME } from "./Config";
import { AudioMixerName, GameSettings } from "./Types";

import { CacheManager } from "./CacheManager";

import { AudioConfig } from "./audio/AudioConfig";
import { PlayerConfig } from "./player/PlayerConfig";

export class SettingsManager {
    private gameSettings: GameSettings

    constructor(private audioConfig: AudioConfig, private cacheManager: CacheManager, private playerConfig: PlayerConfig ) {
        this.gameSettings = this.initSettings();
    }

    /**
     * Initializes default options when the game starts.
     */
    public initSettings(): GameSettings {
        return { // [ IMPORTANT ] Keep track of the default game options here
            audio: {
                mixer: {
                    master: this.audioConfig.mixer.master,
                    ambience: this.audioConfig.mixer.ambience,
                    music: this.audioConfig.mixer.music,
                    sfx: this.audioConfig.mixer.sfx,
                    voice: this.audioConfig.mixer.voice
                }
            },
            controls: {
                keybinds: {
                    attack: GAME.CONTROLS.KEYBINDS.ATTACK,
                    dash: GAME.CONTROLS.KEYBINDS.DASH,
                    melee: GAME.CONTROLS.KEYBINDS.MELEE,
                    moveDown: GAME.CONTROLS.KEYBINDS.MOVE_DOWN,
                    moveLeft: GAME.CONTROLS.KEYBINDS.MOVE_LEFT,
                    moveRight: GAME.CONTROLS.KEYBINDS.MOVE_RIGHT,
                    moveUp: GAME.CONTROLS.KEYBINDS.MOVE_UP,
                    reload: GAME.CONTROLS.KEYBINDS.RELOAD,
                    sprint: GAME.CONTROLS.KEYBINDS.SPRINT,
                },
                gamepad: {
                    attack: GAME.CONTROLS.GAMEPAD.ATTACK,
                    dash: GAME.CONTROLS.GAMEPAD.DASH,
                    deadzone: GAME.CONTROLS.GAMEPAD.DEADZONE,
                    melee: GAME.CONTROLS.GAMEPAD.MELEE,
                    reload: GAME.CONTROLS.GAMEPAD.RELOAD,
                    sprint: GAME.CONTROLS.GAMEPAD.SPRINT
                }
            },
            character: {
                rig: {
                    body: this.playerConfig.default.rig.body,
                    head: this.playerConfig.default.rig.head,
                    headwear: this.playerConfig.default.rig.headwear,
                    weapon: this.playerConfig.default.rig.weapon
                }
            },
            graphics: {
                physics: {
                    ammoReserves: GAME.GRAPHICS.PHYSICS.AMMORESERVES
                },
                renderBackgroundParticles: GAME.GRAPHICS.BACKGROUND_PARTICLES,
                showStaticOverlay: GAME.GRAPHICS.STATIC_OVERLAY,
            }
        };
    }

    /**
     * Returns the currently stored gameSettings.
     */
    public getSettings(): GameSettings { return this.gameSettings }

    /**
     * Recursively updates any setting(s) passed within the stored gameSettings.
     */
    public updateSettings(settings: any): void {
        // Special handling for audio mixer updates
        if (settings.audio?.mixer) {
            const mixerUpdates = settings.audio.mixer;

            (Object.keys(mixerUpdates) as AudioMixerName[]).forEach((busName) => {
                const update = mixerUpdates[busName];

                if (update && typeof update.volume === "number") {
                    this.gameSettings.audio.mixer[busName].volume = update.volume;
                }
            });

            this.cacheManager.write('gameSettings', this.gameSettings);
            return;
        }

        // Fallback: normal deep merge for *non mixer* stuff
        const merge = (target: any, source: any): void => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };

        merge(this.gameSettings, settings);
        this.cacheManager.write('gameSettings', this.gameSettings);
    }


    /**
     * Loads the currently cached gameSettings from the cacheManager.
     */
    public async loadSettings(): Promise<void> {
        const cached = await this.cacheManager.read('gameSettings');
        if (cached) {
            this.gameSettings = cached;
        }
    }
}