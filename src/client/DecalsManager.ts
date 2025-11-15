import { WORLD } from "./Config";
import { DeathDecal, DeathStamp, Decal, DecalParams, ImageDecalParams, ParametricDecalParams, Vec2 } from "./Types";

import { Camera } from "./Camera";
import { CharacterConfig } from "./CharacterConfig";
import { DecalsConfig } from "./DecalsConfig";
import { RoomManager } from "./RoomManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";

import { PlayerState } from "./player/PlayerState";
import { RenderingManager } from "./RenderingManager";

export class DecalsManager {
    public decalsConfig: DecalsConfig;

    public dynamicDecals: Map<string, Decal> = new Map();
    public staticDecalData: ImageData | null = null;

    constructor(
        private camera: Camera,
        private charConfig: CharacterConfig,
        private playerState: PlayerState,
        private renderingManager: RenderingManager,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private userId: string,
        private utility: Utility
    ) {
        this.decalsConfig = new DecalsConfig();
    }

    /**
     * Clears static and dynamic decal data.
     */
    public clear(): void {
        this.dynamicDecals.clear();
        this.staticDecalData = null;
    }

    // #region [ Decals ]
    //
    /**
     * Create a decal and broadcast over the network.
     */
    public createDecal(params: DecalParams): void {
        this.generateDecal(params);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-decal',
            params: params
        }));
    }

    /**
     * Create a decal locally when receiving an 'add-decal' network message.
     */
    public createDecalNetwork(params: DecalParams): void {
        if (this.dynamicDecals.has(params.id)) return; // Don't create duplicate decals

        this.generateDecal(params);
    }

    /**
     * Locally generate the decal and stamp it to the decal canvas.
     */
    public generateDecal(params: DecalParams): void {
        if (!this.ui.decalCtx) return;

        const { x, y } = params.pos;

        // Check WORLD bounds
        if (x < 0 || x > WORLD.WIDTH || y < 0 || y > WORLD.HEIGHT) return;

        // Stamp decal at WORLD coordinates (no camera conversion needed)
        if (params.type === 'parametric' && params.parametric) {
            this.generateParametricDecal(params.pos, params.parametric);
        } else if (params.type === 'image' && params.image) {
            this.generateImageDecal(params.pos, params.image);
        }

        // Store decal with WORLD position
        this.dynamicDecals.set(params.id, { params, pos: { x, y } });
    }

    /**
     * Generate parametric pixel-based decal.
     * 
     * This type of decal does not use an image, but instead paints pixels based on parameters.
     */
    private generateParametricDecal(pos: Vec2, params: ParametricDecalParams): void {
        if (!this.ui.decalCtx) return;

        const radius = params.radius.min + Math.random() * (params.radius.max - params.radius.min);
        const density = params.density.min + Math.random() * (params.density.max - params.density.min);
        const opacity = params.opacity.min + Math.random() * (params.opacity.max - params.opacity.min);

        const numPixels = Math.floor((radius * radius * Math.PI) * density);

        this.ui.decalCtx.save();
        this.ui.decalCtx.globalCompositeOperation = 'source-over';

        for (let i = 0; i < numPixels; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const pixelX = pos.x + Math.cos(angle) * distance;
            const pixelY = pos.y + Math.sin(angle) * distance;

            // Check WORLD bounds (decal canvas is world-sized)
            if (pixelX < 0 || pixelX >= WORLD.WIDTH || pixelY < 0 || pixelY >= WORLD.HEIGHT) continue;

            // Pick random color from array
            const chosenColor = params.colors[Math.floor(Math.random() * params.colors.length)];
            const rgb = this.utility.hexToRgb(chosenColor);
            if (!rgb) continue;

            const pixelOpacity = opacity + (Math.random() - 0.5) * params.variation;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, pixelOpacity));

            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
            // Draw at world coordinates
            this.ui.decalCtx.fillRect(Math.floor(pixelX), Math.floor(pixelY), 1, 1);
        }

        this.ui.decalCtx.restore();
    }

    /**
     * Generate image-based decal (for magazines, gore, etc.).
     */
    private generateImageDecal(pos: Vec2, params: ImageDecalParams): void {
        if (!this.ui.decalCtx) return;

        let image = new Image();
        image.src = params.src;

        const drawImage = () => {
            if (!this.ui.decalCtx) return;
            if (!image.complete || image.naturalWidth === 0) return;

            this.ui.decalCtx.save();
            this.ui.decalCtx.translate(pos.x, pos.y);
            this.ui.decalCtx.rotate(params.rotation);

            const drawSize = 32 * params.scale;
            this.ui.decalCtx.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );

            this.ui.decalCtx.restore();
        };

        if (image.complete) {
            drawImage();
        } else {
            image.onload = drawImage;
        }
    }
    //
    // #endregion

    // #region [ Gore ]
    //
    /**
     * Generates gore particles using the decals for the character object.
     */
    public generateGore(params: DeathDecal): void {
        const gorePool = [...this.charConfig.characterDecals.default.gore]; // TODO: Get current pool for gore
        for (let i = 0; i < params.gore.amount && gorePool.length > 0; i++) {
            const goreAsset = this.utility.getRandomInArray(gorePool);
            gorePool.splice(gorePool.indexOf(goreAsset), 1);
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(0, params.radius);

            const goreDecal: DeathStamp = {
                type: 'gore',
                src: goreAsset,
                transform: {
                    pos: {
                        x: params.pos.x + Math.cos(angle) * distance,
                        y: params.pos.y + Math.sin(angle) * distance
                    },
                    rot: this.utility.getRandomNum(0, Math.PI * 2),
                },
                scale: this.utility.getRandomNum(0.65, 1.05)
            };

            const decalId = `death_gore_${params.ownerId}_${Date.now()}_${i}`;
            this.stampGore(goreDecal);
            this.dynamicDecals.set(decalId, {
                params: null,
                pos: {
                    x: goreDecal.transform.pos.x,
                    y: goreDecal.transform.pos.y
                }
            });
        }

        const bloodPool = [...this.charConfig.characterDecals.default.blood]; // TODO: Get current pool for blood
        for (let i = 0; i < params.blood.amount && bloodPool.length > 0; i++) {
            const bloodAsset = this.utility.getRandomInArray(bloodPool);
            bloodPool.splice(bloodPool.indexOf(bloodAsset), 1);
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(0, params.radius * 0.7);

            const bloodDecal: DeathStamp = {
                type: 'blood',
                src: bloodAsset,
                transform: {
                    pos: {
                        x: params.pos.x + Math.cos(angle) * distance,
                        y: params.pos.y + Math.sin(angle) * distance
                    },
                    rot: this.utility.getRandomNum(0, Math.PI * 2),
                },
                scale: this.utility.getRandomNum(1.25, 1.45)
            };

            const decalId = `death_blood_${params.ownerId}_${Date.now()}_${i}`;
            this.stampGore(bloodDecal);
            this.dynamicDecals.set(decalId, {
                params: null,
                pos: {
                    x: bloodDecal.transform.pos.x,
                    y: bloodDecal.transform.pos.y
                }
            });
        }
    }

    /**
     * Persists gore on the decal canvas.
     */
    private stampGore(params: DeathStamp): void {
        if (!this.ui.decalCtx) return;
        
        const worldPos = params.transform.pos;

        this.ui.decalCtx.save();
        this.ui.decalCtx.translate(worldPos.x, worldPos.y);
        this.ui.decalCtx.rotate(params.transform.rot);

        let image = this.renderingManager.characterImages.get(params.src);

        if (!image) {
            image = new Image();
            image.src = params.src;
            this.renderingManager.characterImages.set(params.src, image);

            if (!image.complete) {
                image.onload = () => {
                    this.stampGore(params);
                };
                return;
            }
        }

        if (!image.complete || image.naturalWidth === 0) return;

        const drawSize = 32 * params.scale;

        this.ui.decalCtx.drawImage(
            image,
            -drawSize / 2,
            -drawSize / 2,
            drawSize,
            drawSize
        );

        this.ui.decalCtx.restore();
    }
    //
    // #endregion

    // #region [ Baking ]
    //
    // TODO: Implement dynamic -> static decal baking as performance requires
    /**
     * Bake all current dynamic decals into static ImageData and clear the dynamic map.
     * This merges all decals into a single pixel buffer that gets composited once per frame.
     */
    private bakeDecals(): void {
        if (!this.ui.decalCtx) return;

        // Capture current decal canvas state as ImageData
        const currentBaked = this.ui.decalCtx.getImageData(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

        if (!this.staticDecalData) {
            // First bake - just store it
            this.staticDecalData = currentBaked;
        } else {
            // Merge new decals with existing baked data
            for (let i = 0; i < currentBaked.data.length; i += 4) {
                const alpha = currentBaked.data[i + 3];
                if (alpha > 0) {
                    // Composite new pixel over old (simple alpha blend)
                    const newAlpha = alpha / 255;
                    const oldAlpha = this.staticDecalData.data[i + 3] / 255;

                    this.staticDecalData.data[i] = currentBaked.data[i] * newAlpha + this.staticDecalData.data[i] * oldAlpha * (1 - newAlpha);
                    this.staticDecalData.data[i + 1] = currentBaked.data[i + 1] * newAlpha + this.staticDecalData.data[i + 1] * oldAlpha * (1 - newAlpha);
                    this.staticDecalData.data[i + 2] = currentBaked.data[i + 2] * newAlpha + this.staticDecalData.data[i + 2] * oldAlpha * (1 - newAlpha);
                    this.staticDecalData.data[i + 3] = Math.min(255, alpha + this.staticDecalData.data[i + 3]);
                }
            }
        }

        // Clear dynamic decals
        this.dynamicDecals.clear();
        this.ui.decalCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    /**
     * Render baked decals to the decal canvas (call at start of frame, before dynamic decals)
     */
    private renderBakedDecals(): void {
        if (!this.staticDecalData || !this.ui.decalCtx) return;
        this.ui.decalCtx.putImageData(this.staticDecalData, 0, 0);
    }
    //
    // #endregion

    // #region [ Weapon Magazine ]
    //
    /**
     * Spawns weapon magazine using createDecal function, also being broadcast over the network.
     */
    public spawnMagazineDecal(): void {
        setTimeout(() => {
            const currentAmmo = this.playerState.myPlayer.actions.primary.magazine.currentAmmo;
            const currentWeapon = this.playerState.myPlayer.inventory.primary;

            // Choose magazine sprite: empty if 0 ammo, full if > 0
            const magazineSrc = currentAmmo > 0
                ? this.charConfig.magazine[currentWeapon].full
                : this.charConfig.magazine[currentWeapon].empty;

            // Random position in small radius around player (WORLD coordinates)
            const angle = this.utility.getRandomNum(0, Math.PI * 2);
            const distance = this.utility.getRandomNum(8, 24);

            const x = this.playerState.myPlayer.transform.pos.x + Math.cos(angle) * distance;
            const y = this.playerState.myPlayer.transform.pos.y + Math.sin(angle) * distance;
            const rotation = this.utility.getRandomNum(0, Math.PI * 2);
            const scale = this.utility.getRandomNum(0.65, 0.75);

            const decalId = `magazine_${this.userId}_${Date.now()}`;

            const decalParams: DecalParams = {
                id: decalId,
                pos: { x, y }, // World coordinates
                type: 'image',
                image: {
                    src: magazineSrc,
                    scale: scale,
                    rotation: rotation
                }
            };
            this.createDecal(decalParams);

            console.log(`Spawned ${currentAmmo > 0 ? 'full' : 'empty'} magazine at reload`);
        }, 150);
    }
    //
    // #endregion
}