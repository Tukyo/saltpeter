import { CANVAS } from "./config";

import { Player } from "./defs";
import { PlayerState } from "./PlayerState";
import { RoomManager } from "./RoomManager";

import { AmmoReservesUIController } from "./player/AmmoReservesUIController";
import { ObjectsManager } from "./ObjectsManager";

export class CollisionsManager {
    constructor(
        private ammoReservesUIController: AmmoReservesUIController,
        private objectsManager: ObjectsManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private userId: string
    ) {}

    /**
     * Responsible for handling all collisions in the game. Routes to other collision functions.
     */
    public checkCollisions(delta: number): void {
        const minX = CANVAS.BORDER_MARGIN;
        const maxX = CANVAS.WIDTH - CANVAS.BORDER_MARGIN;
        const minY = CANVAS.BORDER_MARGIN;
        const maxY = CANVAS.HEIGHT - CANVAS.BORDER_MARGIN;

        this.playerState.myPlayer.transform.pos.x = Math.max(minX, Math.min(maxX, this.playerState.myPlayer.transform.pos.x));
        this.playerState.myPlayer.transform.pos.y = Math.max(minY, Math.min(maxY, this.playerState.myPlayer.transform.pos.y));

        this.checkObjectCollisions(delta);
        this.checkPlayersCollisions(delta);
    }

    /**
     * Checks for my player colliding with objects in the game. 
     */
    private checkObjectCollisions(delta: number): void {
        if (this.playerState.myPlayer.stats.health.value <= 0) return;

        const collisionRadius = this.getPlayerCollider(this.playerState.myPlayer, 5);

        this.objectsManager.ammoBoxes.forEach((ammoBox, boxId) => {
            if (ammoBox.isOpen) return;

            const dx = this.playerState.myPlayer.transform.pos.x - ammoBox.transform.pos.x;
            const dy = this.playerState.myPlayer.transform.pos.y - ammoBox.transform.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= collisionRadius) {
                // Calculate how much ammo can actually be picked up
                const currentReserve = this.playerState.myPlayer.actions.primary.magazine.currentReserve;
                const maxReserve = this.playerState.myPlayer.actions.primary.magazine.maxReserve;
                const actualAmmoAdded = Math.min(ammoBox.ammoAmount, maxReserve - currentReserve);

                // Only pick up if we can actually add ammo
                if (actualAmmoAdded > 0) {
                    this.playerState.myPlayer.actions.primary.magazine.currentReserve += actualAmmoAdded;

                    // Spawn UI bullets based on ACTUAL ammo added, not ammo box amount
                    this.ammoReservesUIController.spawnAmmoInReserveUI(actualAmmoAdded);

                    console.log(`Picked up ammo box! +${actualAmmoAdded} bullets. Inventory: ${this.playerState.myPlayer.actions.primary.magazine.currentReserve}/${this.playerState.myPlayer.actions.primary.magazine.maxReserve}`);

                    // Generate random lid physics
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 3;

                    ammoBox.isOpen = true;
                    ammoBox.lid.velocity = {
                        x: Math.cos(angle) * speed,
                        y: Math.sin(angle) * speed
                    };
                    ammoBox.lid.torque = (Math.random() - 0.5) * 0.3;

                    // Broadcast pickup with full box state
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'ammo-pickup',
                        ammoBoxId: boxId,
                        playerId: this.userId,
                        boxState: {
                            isOpen: true,
                            lid: ammoBox.lid
                        }
                    }));
                }
            }
        })
    }

    /**
     * Checks for collisions with other players, blocking movement.
     */
    private checkPlayersCollisions(delta: number): void {
        if (this.playerState.myPlayer.stats.health.value <= 0) return;

        this.playerState.players.forEach((player) => {
            if (player.stats.health.value <= 0) return;

            const dx = this.playerState.myPlayer.transform.pos.x - player.transform.pos.x;
            const dy = this.playerState.myPlayer.transform.pos.y - player.transform.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.getPlayerCollider(this.playerState.myPlayer) + this.getPlayerCollider(player);

            if (dist < minDist && dist > 0.01) { // Push myself away from the other player
                const overlap = minDist - dist;
                const pushX = (dx / dist) * overlap;
                const pushY = (dy / dist) * overlap;

                this.playerState.myPlayer.transform.pos.x += pushX;
                this.playerState.myPlayer.transform.pos.y += pushY;
            }
        });
    }

    /**
     * Returns the player collider, with padding if needed.
     */
    public getPlayerCollider(player: Player, padding?: number): number {
        let col = player.stats.size / 4

        if (padding && padding > 0) {
            col = (player.stats.size / 4) + padding
        }

        return col;
    }
}