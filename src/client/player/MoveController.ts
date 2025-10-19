import { ControlsManager } from "../ControlsManager";
import { SettingsManager } from "../SettingsManager";

export class MoveController {
    constructor(private controlsManager: ControlsManager, private settingsManager: SettingsManager) {}

    /**
     * Detects and returns the Vec2 movement input from the assigned keybinds.
     */
    public getMoveInput(): { inputX: number; inputY: number; inputLength: number } {
        let inputX = 0;
        let inputY = 0;

        if (this.controlsManager.getActiveKeys().has(this.settingsManager.getSettings().controls.keybinds.moveUp)) inputY -= 1;
        if (this.controlsManager.getActiveKeys().has(this.settingsManager.getSettings().controls.keybinds.moveDown)) inputY += 1;
        if (this.controlsManager.getActiveKeys().has(this.settingsManager.getSettings().controls.keybinds.moveLeft)) inputX -= 1;
        if (this.controlsManager.getActiveKeys().has(this.settingsManager.getSettings().controls.keybinds.moveRight)) inputX += 1;

        const inputLength = Math.sqrt(inputX * inputX + inputY * inputY);

        if (inputLength > 0) {
            inputX = inputX / inputLength;
            inputY = inputY / inputLength;
        }

        return { inputX, inputY, inputLength };
    }

    /**
     * Returns state based on if the player is currently moving or not.
     */
    public isMoving(): boolean {
        return this.getMoveInput().inputLength > 0;
    }
}