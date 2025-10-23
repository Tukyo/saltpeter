import { CANVAS } from "./Config";
import { Decal, DecalParams, ImageDecalParams, ParametricDecalParams, Vec2 } from "./Types";

import { RoomManager } from "./RoomManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";
import { DecalsConfig } from "./DecalsConfig";

export class DecalsManager {
    public decalsConfig: DecalsConfig;

    public dynamicDecals: Map<string, Decal> = new Map();
    public staticDecalData: ImageData | null = null;

    constructor(
        private roomManager: RoomManager,
        private ui: UserInterface,
        private utility: Utility
    ) {
        this.decalsConfig = new DecalsConfig();
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
        
        const { x, y } = params.pos; // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        // Handle different decal types
        if (params.type === 'parametric' && params.parametric) {
            this.generateParametricDecal(params.pos, params.parametric);
        } else if (params.type === 'image' && params.image) {
            this.generateImageDecal(params.pos, params.image);
        }

        // Store decal
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

            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Pick random color from array
            const chosenColor = params.colors[Math.floor(Math.random() * params.colors.length)];
            const rgb = this.utility.hexToRgb(chosenColor);
            if (!rgb) continue;

            const pixelOpacity = opacity + (Math.random() - 0.5) * params.variation;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, pixelOpacity));

            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
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
        const currentBaked = this.ui.decalCtx.getImageData(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

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
        this.ui.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
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
}