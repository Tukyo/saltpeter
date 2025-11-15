import { AMMO_BOX, VIEWPORT, GAME, UI, WORLD } from "./Config";
import { CharacterLayer, DamageEntity, RenderCharacterParams } from "./Types";

import { Animator } from "./Animator";
import { CharacterManager } from "./CharacterManager";
import { ObjectsManager } from "./ObjectsManager";
import { UserInterface } from "./UserInterface";
import { LobbyManager } from "./LobbyManager";
import { PlayerConfig } from "./player/PlayerConfig";
import { Camera } from "./Camera";

export class RenderingManager {
    public characterImages: Map<string, HTMLImageElement> = new Map();
    public ammoBoxImages: { [layer: string]: HTMLImageElement } = {};

    constructor(
        private animator: Animator,
        private camera: Camera,
        private charManager: CharacterManager,
        private lobbyManager: LobbyManager,
        private objectsManager: ObjectsManager,
        private playerConfig: PlayerConfig,
        private ui: UserInterface,
        private userId: string,
    ) {
        this.initEventListeners();
    }

    // #region [ General ]
    //
    /**
     * Clear all canvas rendering context in the game.
     * 
     * / OR /
     * 
     * Pass the specific CanvasRenderingContext2D to clear.
     */
    public clearCtx(customCtx?: CanvasRenderingContext2D): void {
        if (customCtx) {
            customCtx.clearRect(0, 0, VIEWPORT.WIDTH, VIEWPORT.HEIGHT);
            return;
        }

        if (!this.ui.decalCtx || !this.ui.ctx) return;

        this.ui.ctx.clearRect(0, 0, VIEWPORT.WIDTH, VIEWPORT.HEIGHT);
        this.ui.decalCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    //
    // #endregion

    // #region [ Character ]
    //
    /**
     * Draws the corresponding character layers defined in the rig to create the player character.
     */
    public drawCharacter(params: RenderCharacterParams): void {
        const { player, context } = params;
        if (!context || !player) return;

        if ('stats' in player) {
            if (player.stats.health.value <= 0) return;
            this.renderUniqueEffects(params);
            if (player.flags.hidden) return;

            if (!this.camera.isVisible(player.transform.pos)) return;
            const screenPos = this.camera.worldToScreen(player.transform.pos);

            context.fillStyle = UI.TEXT_COLOR;
            context.font = UI.FONT;
            context.textAlign = 'center';

            const displayName = player.id === this.userId ? 'You' : player.id.substring(0, 6);
            context.fillText(
                displayName,
                screenPos.x,
                screenPos.y - this.playerConfig.default.data.idOffset
            );
        }

        // Main player
        this.drawCharacterLayers(params);
    }
    
    /**
     * Entrypoint for rendering of all character layers.
     */
    private drawCharacterLayers(params: RenderCharacterParams): void {
        const player = params.player;
        if (!player) return;

        this.drawCharacterLayer(params, 'body', player.rig.body);
        this.drawCharacterLayer(params, 'weapon', player.rig.weapon);
        this.drawCharacterLayer(params, 'head', player.rig.head);
        this.drawCharacterLayer(params, 'headwear', player.rig.headwear);

        if ('stats' in player) { this.drawUpgradeLayers(params); }
    }

    /**
     * Retrieves character assets and draws each layer using drawCharacterPart.
     */
    private drawCharacterLayer(params: RenderCharacterParams, layer: CharacterLayer, variant: string): void {
        if (!params) return;

        const assets = this.charManager.getCharacterAsset(layer, variant);

        if (typeof assets === 'string') {
            this.drawCharacterPart(params, assets, layer);
        }
        else if (Array.isArray(assets)) {
            assets.forEach((assetPath, index) => {
                this.drawCharacterPart(params, assetPath, layer, index);
            });
        }
    }

    /**
     * Handles the actual rendering for all player parts on each layer.
     */
    private drawCharacterPart(params: RenderCharacterParams, assetPath: string, partType: CharacterLayer, partIndex?: number): void {
        const { context, player } = params;
        if (!context || !player) return;

        let image = this.characterImages.get(assetPath);

        if (!image) {
            image = new Image();
            image.src = assetPath;
            this.characterImages.set(assetPath, image);

            image.onload = () => { this.renderLobbyPlayer(); };

            if (!image.complete) return;
        }

        if (!image.complete || image.naturalWidth === 0) return;

        // Determine draw size based on player type
        const drawSize = 'stats' in player
            ? GAME.CHARACTER_SIZE * (player.stats.size / GAME.CHARACTER_SIZE)
            : GAME.CHARACTER_SIZE * 0.35;

        // UPDATED: Get world position and convert to screen
        const worldX = player.transform?.pos?.x ?? 0;
        const worldY = player.transform?.pos?.y ?? 0;

        // Only apply camera offset for full players (not lobby)
        const shouldApplyCamera = 'stats' in player && player.transform.rot !== undefined;

        const posX = shouldApplyCamera ? this.camera.worldToScreen({ x: worldX, y: worldY }).x : worldX;
        const posY = shouldApplyCamera ? this.camera.worldToScreen({ x: worldX, y: worldY }).y : worldY;

        context.save();

        // Only apply rotation and animation for full players
        if (shouldApplyCamera) {
            const animationId = `${player.id}_${partType}_${partIndex || 0}`;
            const animationOffset = this.animator.characterOffsets?.get(animationId) || { x: 0, y: 0 };

            context.translate(posX, posY);
            context.rotate(player.transform.rot);
            context.translate(animationOffset.x, animationOffset.y);

            context.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
        } else {
            // Simple centered draw for lobby players
            context.drawImage(
                image,
                posX - drawSize / 2,
                posY - drawSize / 2,
                drawSize,
                drawSize
            );
        }

        context.restore();
    }
    //
    // #endregion

    // #region [ Uniques & Upgrades ]
    //
    /**
     * Draws the equipment and unique upgrades that have a character layer visual component.
     */
    private drawUpgradeLayers(params: RenderCharacterParams): void {
        const { player } = params;

        if ('unique' in player) {
            // Check unique upgrades
            player.unique.forEach(uniqueName => {
                const assetPath = this.charManager.getUpgradeVisual(uniqueName);
                if (assetPath) {
                    this.drawCharacterPart(params, assetPath, 'upgrades');
                }
            });

            // Check equipment upgrades
            player.equipment.forEach(equipmentName => {
                const assetPath = this.charManager.getUpgradeVisual(equipmentName);
                if (assetPath) {
                    this.drawCharacterPart(params, assetPath, 'upgrades');
                }
            });
        }
    }

    /**
     * Called in main rendering loop, used to override standard rendering when unique effects temporarily need to.
     */
    private renderUniqueEffects(params: RenderCharacterParams): void {
        const { player } = params;
        if (!player) return;

        if ('unique' in player) {
            if (player.unique.includes("spectral_image")) {
                this.renderSpectralImage(params);
            }
        }
    }

    /**
     * Renders the chosen player as a spectral image.
     */
    private renderSpectralImage(params: RenderCharacterParams): void {
        const { context, player } = params;
        if (!context || !player || !('stats' in player)) return;

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

        // Detect start of dash (flash out)
        if (!wasHidden && isHidden) {
            staticGhosts.flashes.push({
                x: player.transform.pos.x,
                y: player.transform.pos.y,
                t: now,
                type: 'start',
                playerId: player.id
            });
        }

        // Detect end of dash (flash in)
        if (wasHidden && !isHidden) {
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

            // Convert ghost world position to screen position
            const screenPos = this.camera.worldToScreen({ x: ghost.x, y: ghost.y });

            const alpha = ghost.type === 'start'
                ? 1 - (age / player.actions.dash.time)
                : (age / player.actions.dash.time);

            context.save();

            // Invert-style effect via difference + high saturation
            context.globalAlpha = alpha * 0.8;
            context.globalCompositeOperation = 'difference';
            context.filter = 'saturate(100) contrast(2)';

            const ghostPlayer = {
                ...player,
                transform: {
                    ...player.transform,
                    pos: { x: screenPos.x, y: screenPos.y } // Screen coordinates for rendering
                }
            };

            this.drawCharacterLayers({
                player: ghostPlayer,
                context: context
            });
            context.restore();
        }
    }
    //
    // #endregion

    // #region [ Lobby Rendering ]
    //
    /**
     * Renders lobby player in customization canvas via character rendering functions.
     */
    private renderLobbyPlayer(): void {
        if (!this.lobbyManager.inLobby) return;

        const myLobbyPlayer = this.lobbyManager.lobbyPlayers.get(this.userId);
        if (!myLobbyPlayer || !this.ui.charCustomizeCanvas) return;

        const ctx = this.ui.charCustomizeCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, this.ui.charCustomizeCanvas.width, this.ui.charCustomizeCanvas.height);

        this.drawCharacter({
            player: myLobbyPlayer,
            context: ctx
        });
    }
    //
    // #endregion

    // #region [ Objects ]
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
            if (!this.camera.isVisible(ammoBox.transform.pos)) return;

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
            const screenPos = this.camera.worldToScreen(ammoBox.transform.pos);

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
            this.ui.ctx.translate(screenPos.x, screenPos.y);
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
                this.ui.ctx.translate(screenPos.x + ammoBox.lid.pos.x, screenPos.y + ammoBox.lid.pos.y);
                this.ui.ctx.rotate((ammoBox.transform.rot || 0) + ammoBox.lid.rot);
                this.ui.ctx.drawImage(this.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
                this.ui.ctx.restore();
            }
        });
    }

    /**
     * Draws the rect of the projectile and renders it on the main canvas.
     */
    public drawProjectile(projectile: DamageEntity): void {
        if (!this.ui.ctx) return;
        if (!this.camera.isVisible(projectile.transform.pos)) return;

        // Convert world position to screen position
        const screenPos = this.camera.worldToScreen(projectile.transform.pos);

        // Calculate projectile direction
        const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
        const dirX = projectile.velocity.x / speed;
        const dirY = projectile.velocity.y / speed;

        // Calculate front and back points (in screen space)
        const frontX = screenPos.x + dirX * (projectile.length / 2);
        const frontY = screenPos.y + dirY * (projectile.length / 2);
        const backX = screenPos.x - dirX * (projectile.length / 2);
        const backY = screenPos.y - dirY * (projectile.length / 2);

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
    //
    // #endregion

    // #region [ Events ]
    //
    private initEventListeners(): void {
        window.addEventListener("customEvent_renderCharacter", () => this.renderLobbyPlayer());
    }
    //
    // #endregion
}