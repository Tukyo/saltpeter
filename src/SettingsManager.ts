import { CacheManager } from "./CacheManager";
import { AUDIO, GAME } from "./Config";

import { GameSettings } from "./Types";

export class SettingsManager {
    private gameSettings: GameSettings

    constructor(private cacheManager: CacheManager) {
        this.gameSettings = this.initSettings();
    }

    /**
     * Initializes default options when the game starts.
     */
    public initSettings(): GameSettings {
        return { // [ IMPORTANT ] Keep track of the default game options here
            audio: {
                mixer: {
                    master: AUDIO.MIXER.MASTER,
                    interface: AUDIO.MIXER.INTERFACE,
                    music: AUDIO.MIXER.MUSIC,
                    sfx: AUDIO.MIXER.SFX,
                    voice: AUDIO.MIXER.VOICE
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