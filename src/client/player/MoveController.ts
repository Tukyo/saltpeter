import { ControlsManager } from "../ControlsManager";
import { SettingsManager } from "../SettingsManager";
import { PlayerState } from "./PlayerState";

export class MoveController {
    private currentSpeed: number = 0;
    private maxSpeed: number = 0;

    constructor(private controlsManager: ControlsManager, private playerState: PlayerState, private settingsManager: SettingsManager) { }

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
     * Returns state based on if the player is currently pressing move buttons or not.
     */
    public isMoveInput(): boolean {
        return this.getMoveInput().inputLength > 0;
    }

    /**
     * Returns state based on if the player is currently moving or not.
     */
    public isMoving(): boolean {
        return Math.abs(this.playerState.playerVelocityX) > 0.01 || Math.abs(this.playerState.playerVelocityY) > 0.01;
    }

    /**
     * Sets and gets the stored move speed.
     */
    public getMoveSpeed(): number {
        return this.currentSpeed = Math.sqrt(this.playerState.playerVelocityX ** 2 + this.playerState.playerVelocityY ** 2);
    }

    /**
     * Sets and gets the stored max player move speed.
     */
    public getMaxSpeed(): number { // TODO: Probably need to hardcap this somehow
        return this.maxSpeed = this.playerState.myPlayer.stats.speed * this.playerState.myPlayer.actions.sprint.multiplier;
    }
}