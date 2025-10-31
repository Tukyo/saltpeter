import { CANVAS, WORLD } from "./Config";
import { Vec2 } from "./Types";

import { PlayerState } from "./player/PlayerState";
import { Utility } from "./Utility";

export class Camera {
    public pos: Vec2 = { x: 0, y: 0 }
    public targetPos: Vec2 = { x: 0, y: 0 }

    public config = {
        followSpeed: 0.1,
        lookAhead: 100 // Forward pixel offset based on player rotation
    }

    constructor(
        private playerState: PlayerState,
        private utility: Utility
    ) { }

    /**
     * Processes camera updates during gameplay.
     */
    public update(delta: number): void {
        // Get player's forward direction and convert rotation to direction
        const playerRot = this.playerState.myPlayer.transform.rot - Math.PI / 2;
        const forwardDir = this.utility.forward(playerRot);

        // Calculate look-ahead offset
        const offsetX = forwardDir.x * this.config.lookAhead;
        const offsetY = forwardDir.y * this.config.lookAhead;

        // Set camera target to follow player with directional offset
        this.targetPos.x = (this.playerState.myPlayer.transform.pos.x + offsetX) - CANVAS.WIDTH / 2;
        this.targetPos.y = (this.playerState.myPlayer.transform.pos.y + offsetY) - CANVAS.HEIGHT / 2;

        // Constrain camera to world bounds
        this.targetPos.x = Math.max(0, Math.min(WORLD.WIDTH - CANVAS.WIDTH, this.targetPos.x));
        this.targetPos.y = Math.max(0, Math.min(WORLD.HEIGHT - CANVAS.HEIGHT, this.targetPos.y));

        // Smooth camera movement
        this.pos.x += (this.targetPos.x - this.pos.x) * this.config.followSpeed * delta;
        this.pos.y += (this.targetPos.y - this.pos.y) * this.config.followSpeed * delta;
    }

    /**
     * Convert world coordinates to screen coordinates.
     */
    public worldToScreen(worldPos: Vec2): Vec2 {
        return {
            x: worldPos.x - this.pos.x,
            y: worldPos.y - this.pos.y
        };
    }

    /**
     * Convert screen coordinates to world coordinates.
     */
    public screenToWorld(screenPos: Vec2): Vec2 {
        return {
            x: screenPos.x + this.pos.x,
            y: screenPos.y + this.pos.y
        };
    }

    /**
     * Check if world position is visible on screen.
     */
    public isVisible(worldPos: Vec2, margin: number = 50): boolean {
        return worldPos.x >= this.pos.x - margin &&
            worldPos.x <= this.pos.x + CANVAS.WIDTH + margin &&
            worldPos.y >= this.pos.y - margin &&
            worldPos.y <= this.pos.y + CANVAS.HEIGHT + margin;
    }
}