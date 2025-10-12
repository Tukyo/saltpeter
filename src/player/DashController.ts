import { NETWORK } from "../Config";

import { PlayerState } from "./PlayerState";
import { RoomManager } from "../RoomManager";
import { MoveController } from "./MoveController";
import { StaminaController } from "./StaminaController";

export class DashController {
    constructor(
        private moveController: MoveController,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private staminaController: StaminaController
    ) {}

    // #region [ Dash ]
    //
    /**
     * Start a dash when the assigned keybind is pressed.
     */
    public startDash(): void {
        if (this.playerState.isDashing || this.playerState.myPlayer.stats.health.value <= 0 || !this.moveController.isMoving()) return;

        const currentTime = Date.now(); // Cooldown check first
        if (currentTime < this.playerState.lastDashTime + this.playerState.myPlayer.actions.dash.cooldown) {
            console.log('Dash on cooldown');
            return;
        }

        // Input check
        let { inputX, inputY, inputLength } = this.moveController.getMoveInput();

        // Normalize input
        if (!this.moveController.isMoving()) {
            console.log('No movement input for dash');
            return;
        }

        inputX = inputX / inputLength;
        inputY = inputY / inputLength;

        if (!this.staminaController.requestStamina(this.playerState.myPlayer.actions.dash.drain)) {
            console.log('Not enough stamina to dash');
            return;
        }

        // Start dash
        this.playerState.isDashing = true;
        this.playerState.dashStartTime = currentTime;
        this.playerState.lastDashTime = currentTime;

        // Set dash velocity
        const dashSpeed = this.playerState.myPlayer.stats.speed * this.playerState.myPlayer.actions.dash.multiplier;
        this.playerState.playerVelocityX = inputX * dashSpeed;
        this.playerState.playerVelocityY = inputY * dashSpeed;

        console.log(`Dashing! Speed: ${dashSpeed}`);
    }

    /**
     * Process dash update loop when isDashing.
     */
    public updateDash(delta: number): void {
        if (!this.playerState.isDashing) return;

        const currentTime = Date.now();

        let newX = this.playerState.myPlayer.transform.pos.x + this.playerState.playerVelocityX * delta;
        let newY = this.playerState.myPlayer.transform.pos.y + this.playerState.playerVelocityY * delta;

        this.playerState.myPlayer.transform.pos.x = newX;
        this.playerState.myPlayer.transform.pos.y = newY;

        let moved = (this.playerState.playerVelocityX !== 0 || this.playerState.playerVelocityY !== 0);

        // Send position update if moved
        const distanceFromLastSent = Math.sqrt(
            (this.playerState.myPlayer.transform.pos.x - this.playerState.lastSentX) ** 2 +
            (this.playerState.myPlayer.transform.pos.y - this.playerState.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2 && currentTime - this.playerState.lastSentMoveTime >= NETWORK.MOVE_INTERVAL) {
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
            this.playerState.lastSentMoveTime = currentTime;
        }

        // Check if dash time is over
        if (currentTime >= this.playerState.dashStartTime + this.playerState.myPlayer.actions.dash.time) {
            this.playerState.isDashing = false;
            console.log('Dash ended');
        }
    }
    //
    // #endregion
}