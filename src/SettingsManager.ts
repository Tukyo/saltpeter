import { AUDIO, GAME } from "./config";

import { GameSettings } from "./defs";

export class SettingsManager {
    private gameSettings: GameSettings

    constructor() {
        this.gameSettings = this.initSettings();
    }

    /**
     * Initializes default options when the game starts.
     */
    // TODO: Abstract this so that it doesn't require the config, but instead uses it for reference
    public initSettings(): GameSettings { // TODO: Add ability to save/load to cache
        return { // [ IMPORTANT ] Keep track of the default game options here
            audio: {
                mixer: {
                    master: AUDIO.MIXER.MASTER,
                    sfx: AUDIO.MIXER.SFX
                }
            },
            controls: {
                keybinds: {
                    dash: GAME.CONTROLS.KEYBINDS.DASH,
                    melee: GAME.CONTROLS.KEYBINDS.MELEE,
                    moveDown: GAME.CONTROLS.KEYBINDS.MOVE_DOWN,
                    moveLeft: GAME.CONTROLS.KEYBINDS.MOVE_LEFT,
                    moveRight: GAME.CONTROLS.KEYBINDS.MOVE_RIGHT,
                    moveUp: GAME.CONTROLS.KEYBINDS.MOVE_UP,
                    reload: GAME.CONTROLS.KEYBINDS.RELOAD,
                    sprint: GAME.CONTROLS.KEYBINDS.SPRINT,
                }
            }
        };
    }

    public getSettings(): GameSettings { return this.gameSettings }
}