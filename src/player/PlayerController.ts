import { NETWORK } from "../Config";

import { GameState } from "../GameState";
import { ObjectsManager } from "../ObjectsManager";
import { ParticlesManager } from "../ParticlesManager";
import { PlayerState } from "./PlayerState";
import { RoomManager } from "../RoomManager";
import { MoveController } from "./MoveController";

export class PlayerController {
    constructor(
        private gameState: GameState,
        private moveController: MoveController,
        private objectsManager: ObjectsManager,
        private particlesManager: ParticlesManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private userId: string
    ) {}

    /**
     * Updates the local player's position and movement state.
     * 
     * Applies acceleration, friction, sprint multipliers, and stamina drain
     * based on current movement input. Sends position updates to the server
     * when movement exceeds the defined threshold or interval.
     * 
     * Does not process updates when game is not active, player is dead, or dashing.
     */
    public updatePlayerPosition(delta: number): void {
        if (!this.gameState.gameInProgress || this.playerState.myPlayer.stats.health.value <= 0 || this.playerState.isDashing) return;

        const now = Date.now();
        const { inputX, inputY } = this.moveController.getMoveInput();

        // [ Sprinting ]
        const canSprint = this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value > 0 && this.moveController.isMoving();
        const currentSpeed = canSprint ? this.playerState.myPlayer.stats.speed * this.playerState.myPlayer.actions.sprint.multiplier : this.playerState.myPlayer.stats.speed;
        if (this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value <= 0) { // Stop sprinting if out of stamina
            this.playerState.isSprinting = false;
            console.log('Out of stamina, stopped sprinting');
        }
        //

        const targetVelocityX = inputX * currentSpeed;
        const targetVelocityY = inputY * currentSpeed;

        this.playerState.playerVelocityX += (targetVelocityX - this.playerState.playerVelocityX) * this.playerState.myPlayer.physics.acceleration * delta;
        this.playerState.playerVelocityY += (targetVelocityY - this.playerState.playerVelocityY) * this.playerState.myPlayer.physics.acceleration * delta;

        if (!this.moveController.isMoving()) {
            this.playerState.playerVelocityX *= Math.pow(this.playerState.myPlayer.physics.friction, delta);
            this.playerState.playerVelocityY *= Math.pow(this.playerState.myPlayer.physics.friction, delta);
        }

        let newX = this.playerState.myPlayer.transform.pos.x + this.playerState.playerVelocityX * delta;
        let newY = this.playerState.myPlayer.transform.pos.y + this.playerState.playerVelocityY * delta;

        this.playerState.myPlayer.transform.pos.x = newX;
        this.playerState.myPlayer.transform.pos.y = newY;

        let moved = (this.playerState.playerVelocityX !== 0 || this.playerState.playerVelocityY !== 0);

        const distanceFromLastSent = Math.sqrt(
            (this.playerState.myPlayer.transform.pos.x - this.playerState.lastSentX) ** 2 +
            (this.playerState.myPlayer.transform.pos.y - this.playerState.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2 && now - this.playerState.lastSentMoveTime >= NETWORK.MOVE_INTERVAL) {
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
            this.playerState.lastSentMoveTime = now;
        }

        if (Math.abs(this.playerState.playerVelocityX) < 0.01) this.playerState.playerVelocityX = 0;
        if (Math.abs(this.playerState.playerVelocityY) < 0.01) this.playerState.playerVelocityY = 0;
    }

    /**
     * Record the player's own death when they are the targetId of a player-hit message and their health reaches 0.
     */
    public playerDeath(): void {
        console.log('I died! Waiting for round to end...');

        this.playerState.resetPlayerState();

        const ammoBox = this.objectsManager.spawnAmmoBox(10);
        this.objectsManager.ammoBoxes.set(ammoBox.id, ammoBox);

        this.particlesManager.generateGore(this.userId, this.playerState.myPlayer.transform.pos.x, this.playerState.myPlayer.transform.pos.y, this.playerState.myPlayer.stats.size);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-death',
            playerId: this.userId,
            x: this.playerState.myPlayer.transform.pos.x,
            y: this.playerState.myPlayer.transform.pos.y,
            size: this.playerState.myPlayer.stats.size,
            ammoBox: ammoBox
        }));
    }
}