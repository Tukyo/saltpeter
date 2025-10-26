import { CANVAS, WORLD } from "./Config";
import { Vec2 } from "./Types";

import { PlayerState } from "./player/PlayerState";
import { Utility } from "./Utility";

export class Camera {
    public x: number = 0;
    public y: number = 0;
    private targetX: number = 0;
    private targetY: number = 0;

    public config = {
        followSpeed: 0.1,
        lookAhead: 100 //px
    }

    constructor(
        private playerState: PlayerState,
        private utility: Utility
    ) { }

    public update(delta: number): void {
        // Get player's forward direction
        const playerRot = this.playerState.myPlayer.transform.rot - Math.PI / 2; // Convert visual rotation to direction
        const forwardDir = this.utility.forward(playerRot);

        // Calculate look-ahead offset
        const offsetX = forwardDir.x * this.config.lookAhead;
        const offsetY = forwardDir.y * this.config.lookAhead;

        // Set camera target to follow player WITH directional offset
        this.targetX = (this.playerState.myPlayer.transform.pos.x + offsetX) - CANVAS.WIDTH / 2;
        this.targetY = (this.playerState.myPlayer.transform.pos.y + offsetY) - CANVAS.HEIGHT / 2;

        // Constrain camera to world bounds
        this.targetX = Math.max(0, Math.min(WORLD.WIDTH - CANVAS.WIDTH, this.targetX));
        this.targetY = Math.max(0, Math.min(WORLD.HEIGHT - CANVAS.HEIGHT, this.targetY));

        // Smooth camera movement
        this.x += (this.targetX - this.x) * this.config.followSpeed * delta;
        this.y += (this.targetY - this.y) * this.config.followSpeed * delta;
    }

    // Convert world coordinates to screen coordinates
    public worldToScreen(worldPos: Vec2): Vec2 {
        return {
            x: worldPos.x - this.x,
            y: worldPos.y - this.y
        };
    }

    // Convert screen coordinates to world coordinates
    public screenToWorld(screenPos: Vec2): Vec2 {
        return {
            x: screenPos.x + this.x,
            y: screenPos.y + this.y
        };
    }

    // Check if world position is visible on screen
    public isVisible(worldPos: Vec2, margin: number = 50): boolean {
        return worldPos.x >= this.x - margin &&
            worldPos.x <= this.x + CANVAS.WIDTH + margin &&
            worldPos.y >= this.y - margin &&
            worldPos.y <= this.y + CANVAS.HEIGHT + margin;
    }
}