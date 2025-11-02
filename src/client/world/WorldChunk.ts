import { Vec2 } from "../Types";
import { WorldConfig } from "./WorldConfig";

export class WorldChunk {
    // Store version/pos/size for runtime chunk updates
    public version: number = 0;
    public pos: Vec2 = { x: 0, y: 0 };
    public size: number = 0;
    
    public pixelData: Uint8Array; // (MaterialIndex << 2) | ColorVariantIndex
    public heightData: Uint8Array; // Baked height per pixel in [0..255] (0=low, 255=high)
    public waterData: Uint8Array;
    public chosenBiomeName: string;

    private worldConfig: WorldConfig;

    constructor(
        biomeName: string,
        sourcePixels: Uint8Array,
        sourceHeights: Uint8Array,
        sourceWater: Uint8Array,
        worldConfig: WorldConfig
    ) {
        this.pixelData = sourcePixels;
        this.heightData = sourceHeights;
        this.waterData = sourceWater;
        this.chosenBiomeName = biomeName;
        this.worldConfig = worldConfig;
    }

    /**
     * Returns the specific color of a pixel within a chunk.
     */
    public getColorAt(localX: number, localY: number, chunkSize: number): string {
        const index = localY * chunkSize + localX;
        const combinedIndex = this.pixelData[index];

        const materialIndex = combinedIndex >> 2;
        const colorVariantIndex = combinedIndex & 0b11;
        const material = Object.values(this.worldConfig.materials)[materialIndex];

        return material.colors[colorVariantIndex];
    }

    /**
     * Returns the height for a specific pixel within a chunk.
     */
    public getHeightAt(localX: number, localY: number, chunkSize: number): number {
        const index = localY * chunkSize + localX;

        return this.heightData[index] / 255;
    }

    /** 
     * Returns amount of water for a pixel in a specific chunk.
     */
    public getWaterAt(localX: number, localY: number, chunkSize: number): number {
        const index = localY * chunkSize + localX;

        return this.waterData[index] / 255;
    }
}