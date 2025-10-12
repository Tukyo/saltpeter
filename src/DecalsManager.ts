import { CANVAS, DECALS } from "./config";
import { Decal } from "./defs";
import { RoomManager } from "./RoomManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";

export class DecalsManager {
    public decals: Map<string, Decal> = new Map();

    constructor(
        private roomManager: RoomManager,
        private ui: UserInterface,
        private utility: Utility
    ) { }

    // #region [ Decals ]
    //
    /**
     * Create a decal and broadcast over the network.
     */
    public createDecal(x: number, y: number, decalId: string, params: typeof DECALS[keyof typeof DECALS] = DECALS.PROJECTILE): void {
        this.generateDecal(x, y, decalId, params);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-decal',
            decalId: decalId,
            x: x,
            y: y,
            params: params
        }));
    }

    /**
     * Create a decal locally when receiving a decal network message.
     */
    public createDecalNetwork(x: number, y: number, decalId: string, params: typeof DECALS[keyof typeof DECALS]): void {
        if (this.decals.has(decalId)) return; // Don't create duplicate decals

        this.generateDecal(x, y, decalId, params);
    }

    /**
     * Locally generate the decal and stamp it to the decal canvas.
     */
    public generateDecal(x: number, y: number, decalId: string, params: typeof DECALS[keyof typeof DECALS]): void {
        if (!this.ui.decalCtx) return;

        // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        // Use random values within MIN/MAX ranges
        const radius = params.RADIUS.MIN + Math.random() * (params.RADIUS.MAX - params.RADIUS.MIN);
        const density = params.DENSITY.MIN + Math.random() * (params.DENSITY.MAX - params.DENSITY.MIN);
        const opacity = params.OPACITY.MIN + Math.random() * (params.OPACITY.MAX - params.OPACITY.MIN);

        const numPixels = Math.floor((radius * radius * Math.PI) * density);

        const rgb = this.utility.hexToRgb(params.COLOR);
        if (!rgb) {
            console.error(`Invalid hex color: ${params.COLOR}`);
            return;
        }

        this.ui.decalCtx.save();
        this.ui.decalCtx.globalCompositeOperation = 'source-over';

        // Create scattered decal pixels around impact point
        for (let i = 0; i < numPixels; i++) {
            // Random position within decal radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const pixelX = x + Math.cos(angle) * distance;
            const pixelY = y + Math.sin(angle) * distance;

            // Skip if outside canvas
            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Random opacity with variation
            const pixelOpacity = opacity + (Math.random() - 0.5) * params.VARIATION;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, pixelOpacity));

            // Use custom color from params
            this.ui.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
            this.ui.decalCtx.fillRect(Math.floor(pixelX), Math.floor(pixelY), 1, 1);
        }

        this.ui.decalCtx.restore();

        // Store decal with params
        this.decals.set(decalId, { params, pos: { x, y } });
    }
    //
    // #endregion
}