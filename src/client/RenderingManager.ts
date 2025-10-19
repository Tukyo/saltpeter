import { AMMO_BOX, CANVAS, GAME, PLAYER_DEFAULTS, UI } from "./Config";
import { CharacterLayer, Player, Projectile } from "./Types";

import { Animator } from "./Animator";
import { CharacterManager } from "./CharacterManager";
import { ObjectsManager } from "./ObjectsManager";
import { UserInterface } from "./UserInterface";

export class RenderingManager {
    public characterImages: Map<string, HTMLImageElement> = new Map();
    public ammoBoxImages: { [layer: string]: HTMLImageElement } = {};

    constructor(
        private animator: Animator,
        private charManager: CharacterManager,
        private objectsManager: ObjectsManager,
        private ui: UserInterface,
    ) { }

    /**
     * Clear all canvas rendering context in the game.
     * 
     * / OR /
     * 
     * Pass the specific CanvasRenderingContext2D to clear.
     */
    public clearCtx(customCtx?: CanvasRenderingContext2D): void {
        if (customCtx) {
            customCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
            return;
        }

        if (!this.ui.decalCtx || !this.ui.ctx) return;

        this.ui.ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        this.ui.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
    }

    // [ Character ]
    //
    /**
     * Draws the corresponding character layers defined in the rig to create the player character.
     */
    public drawCharacter(player: Player, isMe: boolean = false): void {
        if (!this.ui.ctx) return;
        if (player.stats.health.value <= 0) return;

        // Static ghost memory (attached per instance)
        const staticGhosts = (this as any)._spectralGhosts ??= {
            lastHidden: new Map<string, boolean>(),
            flashes: [] as {
                x: number;
                y: number;
                t: number;
                type: 'start' | 'end';
                playerId: string;
            }[]
        };

        const now = Date.now();
        const wasHidden = staticGhosts.lastHidden.get(player.id) ?? false;
        const isHidden = player.flags.hidden;
        const isSpectral = player.unique.includes("spectral_image");

        // Detect start of dash (flash out)
        if (!wasHidden && isHidden && isSpectral) {
            staticGhosts.flashes.push({
                x: player.transform.pos.x,
                y: player.transform.pos.y,
                t: now,
                type: 'start',
                playerId: player.id
            });
        }

        // Detect end of dash (flash in)
        if (wasHidden && !isHidden && isSpectral) {
            staticGhosts.flashes.push({
                x: player.transform.pos.x,
                y: player.transform.pos.y,
                t: now,
                type: 'end',
                playerId: player.id
            });
        }

        staticGhosts.lastHidden.set(player.id, isHidden);

        // Render ghost flashes
        for (const ghost of staticGhosts.flashes) {
            if (ghost.playerId !== player.id) continue;
            const age = now - ghost.t;
            if (age > player.actions.dash.time) continue;

            const alpha = ghost.type === 'start'
                ? 1 - (age / player.actions.dash.time)
                : (age / player.actions.dash.time);

            this.ui.ctx.save();

            // Invert-style effect via difference + high saturation
            this.ui.ctx.globalAlpha = alpha * 0.8;
            this.ui.ctx.globalCompositeOperation = 'difference';
            this.ui.ctx.filter = 'saturate(100) contrast(2)';

            const ghostPlayer = {
                ...player,
                transform: {
                    ...player.transform,
                    pos: { x: ghost.x, y: ghost.y }
                }
            };

            this.drawCharacterLayers(ghostPlayer);
            this.ui.ctx.restore();
        }

        if (isHidden) return;

        // Main player
        this.drawCharacterLayers(player);

        this.ui.ctx.fillStyle = UI.TEXT_COLOR;
        this.ui.ctx.font = UI.FONT;
        this.ui.ctx.textAlign = 'center';

        const displayName = isMe ? 'You' : player.id.substring(0, 6);
        this.ui.ctx.fillText(
            displayName,
            player.transform.pos.x,
            player.transform.pos.y - PLAYER_DEFAULTS.VISUAL.ID_DISPLAY_OFFSET
        );
    }

    /**
     * Entrypoint for rendering of all character layers.
     */
    private drawCharacterLayers(player: Player): void {
        this.drawCharacterLayer(player, 'BODY', player.rig.body);
        this.drawCharacterLayer(player, 'WEAPON', player.rig.weapon);
        this.drawCharacterLayer(player, 'HEAD', player.rig.head);
        this.drawCharacterLayer(player, 'HEADWEAR', player.rig.headwear);
        this.drawUpgradeLayers(player);
    }

    /**
     * Retrieves character assets and draws each layer using drawCharacterPart.
     */
    private drawCharacterLayer(player: Player, layer: CharacterLayer, variant: string): void {
        if (!this.ui.ctx) return;

        const assets = this.charManager.getCharacterAsset(layer, variant);

        if (typeof assets === 'string') {
            this.drawCharacterPart(player, assets, layer);
        }
        else if (Array.isArray(assets)) {
            assets.forEach((assetPath, index) => {
                this.drawCharacterPart(player, assetPath, layer, index);
            });
        }
    }

    /**
     * Handles the actual rendering for all player parts on each layer.
     */
    private drawCharacterPart(player: Player, assetPath: string, partType: CharacterLayer, partIndex?: number): void {
        if (!this.ui.ctx) return;

        let image = this.characterImages.get(assetPath);

        if (!image) {
            image = new Image();
            image.src = assetPath;
            this.characterImages.set(assetPath, image);
            if (!image.complete) return;
        }

        if (!image.complete || image.naturalWidth === 0) return;

        const drawSize = GAME.CHARACTER_SIZE * (player.stats.size / GAME.CHARACTER_SIZE);

        // Check for animation offset
        const animationId = `${player.id}_${partType}_${partIndex || 0}`;
        const animationOffset = this.animator.characterOffsets?.get(animationId) || { x: 0, y: 0 };

        this.ui.ctx.save();

        // Apply rotation if it exists
        if (player.transform.rot !== undefined) {
            this.ui.ctx.translate(player.transform.pos.x, player.transform.pos.y);
            this.ui.ctx.rotate(player.transform.rot);

            // Apply animation offset
            this.ui.ctx.translate(animationOffset.x, animationOffset.y);

            this.ui.ctx.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
        } else {
            this.ui.ctx.drawImage(
                image,
                player.transform.pos.x - drawSize / 2 + animationOffset.x,
                player.transform.pos.y - drawSize / 2 + animationOffset.y,
                drawSize,
                drawSize
            );
        }

        this.ui.ctx.restore();
    }

    /**
     * Draws the equipment and unique upgrades that have a character layer visual component.
     */
    private drawUpgradeLayers(player: Player): void {
        // Check unique upgrades
        player.unique.forEach(uniqueName => {
            const assetPath = this.charManager.getUpgradeVisual(uniqueName);
            if (assetPath) {
                this.drawCharacterPart(player, assetPath, 'UPGRADES');
            }
        });

        // Check equipment upgrades
        player.equipment.forEach(equipmentName => {
            const assetPath = this.charManager.getUpgradeVisual(equipmentName);
            if (assetPath) {
                this.drawCharacterPart(player, assetPath, 'UPGRADES');
            }
        });
    }
    //

    // [ Objects ]
    //
    /**
     * Draws object entities on the canvas.
     */
    public drawObjects(): void {
        if (!this.ui.ctx) return;

        //TODO: Use this function to draw all 'objects' in the scene.

        // Ammo Boxes
        this.objectsManager.ammoBoxes.forEach(ammoBox => {
            if (!this.ui.ctx) return;

            // Load and cache images
            if (!this.ammoBoxImages) this.ammoBoxImages = {};
            const layers: (keyof typeof AMMO_BOX)[] = ['BASE', 'BULLETS', 'LID'];
            layers.forEach(layer => {
                if (!this.ammoBoxImages[layer]) {
                    const img = new Image();
                    img.src = AMMO_BOX[layer];
                    this.ammoBoxImages[layer] = img;
                }
            });

            if (!layers.every(layer => this.ammoBoxImages[layer]?.complete && this.ammoBoxImages[layer]?.naturalWidth > 0)) return;

            const scale = 35;
            const x = ammoBox.transform.pos.x;
            const y = ammoBox.transform.pos.y;

            // Update lid physics if open
            if (ammoBox.isOpen) {
                ammoBox.lid.velocity.x *= 0.85;
                ammoBox.lid.velocity.y *= 0.85;
                ammoBox.lid.torque *= 0.85;

                ammoBox.lid.pos.x += ammoBox.lid.velocity.x;
                ammoBox.lid.pos.y += ammoBox.lid.velocity.y;
                ammoBox.lid.rot += ammoBox.lid.torque;
            }

            this.ui.ctx.save();
            this.ui.ctx.translate(x, y);
            this.ui.ctx.rotate(ammoBox.transform.rot || 0);

            // Draw body
            this.ui.ctx.drawImage(this.ammoBoxImages['BASE'], -scale / 2, -scale / 2, scale, scale);

            // Draw bullets only if NOT open
            if (!ammoBox.isOpen) {
                this.ui.ctx.drawImage(this.ammoBoxImages['BULLETS'], -scale / 2, -scale / 2, scale, scale);
                // Draw closed lid here
                this.ui.ctx.drawImage(this.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
            }

            this.ui.ctx.restore();

            // Draw flying lid separately if open
            if (ammoBox.isOpen) {
                this.ui.ctx.save();
                this.ui.ctx.translate(x + ammoBox.lid.pos.x, y + ammoBox.lid.pos.y);
                this.ui.ctx.rotate((ammoBox.transform.rot || 0) + ammoBox.lid.rot);
                this.ui.ctx.drawImage(this.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
                this.ui.ctx.restore();
            }
        });
    }

    /**
     * Draws the rect of the projectile and renders it on the main canvas.
     */
    public drawProjectile(projectile: Projectile): void {
        if (!this.ui.ctx) return;

        // Calculate projectile direction
        const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
        const dirX = projectile.velocity.x / speed;
        const dirY = projectile.velocity.y / speed;

        // Calculate front and back points
        const frontX = projectile.transform.pos.x + dirX * (projectile.length / 2);
        const frontY = projectile.transform.pos.y + dirY * (projectile.length / 2);
        const backX = projectile.transform.pos.x - dirX * (projectile.length / 2);
        const backY = projectile.transform.pos.y - dirY * (projectile.length / 2);

        // Draw the capsule body (rectangle)
        this.ui.ctx.fillStyle = projectile.color;
        this.ui.ctx.strokeStyle = projectile.color;
        this.ui.ctx.lineWidth = projectile.size;
        this.ui.ctx.lineCap = 'round';

        this.ui.ctx.beginPath();
        this.ui.ctx.moveTo(backX, backY);
        this.ui.ctx.lineTo(frontX, frontY);
        this.ui.ctx.stroke();
    }
}