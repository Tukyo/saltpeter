import { CANVAS, WORLD } from "./Config";
import { Camera } from "./Camera";
import { UserInterface } from "./UserInterface";
import { ControlsManager } from "./ControlsManager";

// Material definition
type Material = {
    name: string;
    type: 'terrain' | 'mineral' | 'surface' | 'liquid';
    colors: string[];
}

// Biome definition
type Biome = {
    name: string;
    height: number;
    materials: {
        material: string;
        weight: number;
        blend: number;
    }[];
}

// Serializable world generation data
export type WorldGenData = {
    seed: number;
}

const MATERIALS: Material[] = [
    // TERRAIN
    { name: "grass", type: "terrain", colors: ["#3a5f3e", "#4a6f4e", "#5a7f5e", "#6a8f6e"] },
    { name: "dirt", type: "terrain", colors: ["#5b3a1f", "#6b4a2f", "#7b5a3f", "#8b6a4f"] },
    { name: "sand", type: "terrain", colors: ["#b2a280", "#c2b290", "#d2c2a0", "#e2d2b0"] },
    { name: "gravel", type: "terrain", colors: ["#606060", "#707070", "#808080", "#909090"] },
    { name: "stone", type: "terrain", colors: ["#707070", "#808080", "#909090", "#a0a0a0"] },
    { name: "snow", type: "terrain", colors: ["#ffffff", "#e6eef5", "#dfe8f2", "#cfdceb"] },
    { name: "ice", type: "terrain", colors: ["#a9d5ff", "#8fc5ff", "#6fb5ff", "#5aa4f2"] },

    // MINERAL
    { name: "coal", type: "mineral", colors: ["#0a0a0a", "#1a1a1a", "#2a2a2a", "#3a3a3a"] },
    { name: "iron", type: "mineral", colors: ["#7b3716", "#8b4726", "#9b5736", "#ab6746"] },
    { name: "gold", type: "mineral", colors: ["#eec700", "#fed700", "#ffe700", "#fff74c"] },
    { name: "silver", type: "mineral", colors: ["#b0b0b0", "#c0c0c0", "#d0d0d0", "#e0e0e0"] },
    { name: "copper", type: "mineral", colors: ["#a86323", "#b87333", "#c88343", "#d89353"] },

    // SURFACE
    { name: "wood", type: "surface", colors: ["#7b3503", "#8b4513", "#9b5523", "#ab6533"] },
    { name: "concrete", type: "surface", colors: ["#2a2a2a", "#3a3a3a", "#4a4a4a", "#5a5a5a"] },
    { name: "metal", type: "surface", colors: ["#4a4a4a", "#6a6a6a", "#7a7a7a", "#8a8a8a"] },
    { name: "asphalt", type: "surface", colors: ["#1b1b1b", "#2b2b2b", "#3b3b3b", "#4b4b4b"] },

    // LIQUIDS
    { name: "water", type: "liquid", colors: ["#1a2f6e", "#1f3f8a", "#2450a6", "#2d6bc9"] }
];

// Ensure all materials have 4 colors. (Metal was missing a color, fixed above.)

const BIOMES: Biome[] = [
    {
        name: "desert",
        height: 0.1,
        materials: [
            { material: "sand", weight: 7, blend: 0.9 },
            { material: "stone", weight: 2, blend: 0.3 },
            { material: "gravel", weight: 1, blend: 0.4 }
        ]
    },
    {
        name: "plains",
        height: 0.3,
        materials: [
            { material: "grass", weight: 6, blend: 0.8 },
            { material: "dirt", weight: 3, blend: 0.6 },
            { material: "stone", weight: 1, blend: 0.3 }
        ]
    },
    {
        name: "grassland",
        height: 0.45,
        materials: [
            { material: "grass", weight: 7, blend: 0.8 },
            { material: "dirt", weight: 2, blend: 0.6 },
            { material: "gravel", weight: 1, blend: 0.4 }
        ]
    },
    {
        name: "cliffs",
        height: 0.7,
        materials: [
            { material: "stone", weight: 6, blend: 0.3 },
            { material: "gravel", weight: 3, blend: 0.5 },
            { material: "dirt", weight: 1, blend: 0.6 }
        ]
    },
    {
        name: "mountains",
        height: 0.9,
        materials: [
            { material: "stone", weight: 2, blend: 0.3 },
            { material: "gravel", weight: 1, blend: 0.4 },
            { material: "snow", weight: 4, blend: 0.8 },
            { material: "ice", weight: 3, blend: 0.9 }
        ]
    }
];

class WorldChunk {
    pixelData: Uint8Array; // (MaterialIndex << 2) | ColorVariantIndex
    heightData: Uint8Array; // Baked height per pixel in [0..255] (0=low, 255=high)
    private officialBiomeName: string;

    constructor(chunkSize: number, biomeName: string, sourcePixels: Uint8Array, sourceHeights: Uint8Array) {
        this.pixelData = sourcePixels;
        this.heightData = sourceHeights;
        this.officialBiomeName = biomeName;
    }

    getColorAt(localX: number, localY: number, chunkSize: number): string {
        const index = localY * chunkSize + localX;
        const combinedIndex = this.pixelData[index];
        const materialIndex = combinedIndex >> 2;
        const colorVariantIndex = combinedIndex & 0b11;
        const material = MATERIALS[materialIndex];
        return material.colors[colorVariantIndex];
    }

    getHeightAt(localX: number, localY: number, chunkSize: number): number {
        const index = localY * chunkSize + localX;
        return this.heightData[index] / 255;
    }

    getBiomeName(): string {
        return this.officialBiomeName;
    }
}

export class World {
    private chunks: Map<string, WorldChunk> = new Map();
    private chunkBiomes: Map<string, Biome> = new Map();
    private hoveredChunk: string | null = null;

    private worldCanvas: HTMLCanvasElement | null = null;
    private worldCtx: CanvasRenderingContext2D | null = null;

    private isGenerated = false;
    private currentSeed = 0;

    private config = {
        generation: {
            seed: 0,
            biomeNoiseScale: 0.01,
            biomeNoiseIntensity: 1.0,
            materialNoiseScale: 0.25,
            detailNoiseScale: 1.0,
            colorVariation: 0.75,
            octaves: 6.0,
            persistence: 0.5,
            cellSize: 8.0,
            heightCurve: 1.0,
            seaLevel: 0.18,
        },
        chunk: { size: 64 },
        grid: {
            enabled: false,
            lineWidth: 1,
            chunkBorderColor: "#a1a1a1",
            worldBorderColor: "#9747ff",
            biomeBorderColor: "#ff4343",
            borderWidth: 3
        }
    };

    constructor(
        private camera: Camera,
        private controlsManager: ControlsManager,
        private ui: UserInterface
    ) {
        window.addEventListener("keydown", e => {
            if (e.ctrlKey && (e.code === "KeyG" || e.key === "g" || e.key === "G")) {
                e.preventDefault();
                this.config.grid.enabled = !this.config.grid.enabled;
                if (!this.config.grid.enabled) this.hoveredChunk = null;
                console.log(`🔲 Grid ${this.config.grid.enabled ? "enabled" : "disabled"}`);
            }
            if (e.ctrlKey && e.code === "Quote") {
                e.preventDefault();
                console.log("🔄 Regenerating world...");
                this.clear();
                this.generateWorld();
            }
        });
    }

    // #region [ General ]
    //
    /**
     * Initializes the world canvas.
     */
    private initCanvas(): void {
        if (this.worldCanvas) return;
        this.worldCanvas = document.createElement("canvas");
        this.worldCanvas.width = WORLD.WIDTH;
        this.worldCanvas.height = WORLD.HEIGHT;
        const ctx = this.worldCanvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get world canvas context");
        this.worldCtx = ctx;
    }

    /**
     * Clears all of the world data for a fresh slate.
     */
    public clear(): void {
        this.chunks.clear();
        this.chunkBiomes.clear();
        this.isGenerated = false;
        if (this.worldCtx && this.worldCanvas) {
            this.worldCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        }
    }

    //
    // #endregion

    // #region [ Generation ]
    //
    /**
     * Generates the world and renders all chunks to canvas.
     */
    public async generateWorld(): Promise<WorldGenData> {
        await this.showConfigPopup();
        console.log("🌍 HOST: Generating new world...");

        this.initCanvas();

        const seed = Date.now();
        this.currentSeed = seed;
        this.config.generation.seed = seed;
        this.chunkBiomes.clear();
        this.chunks.clear();

        // Phase 1: high-res cells → world pixel data + heightmap
        const { worldPixelData, worldHeightData, cellBiomeGrid } = this.generateCells(seed);

        // Phase 2: bake into runtime chunks (pixels + height)
        this.bakeChunksFromCells(seed, worldPixelData, worldHeightData, cellBiomeGrid);

        this.isGenerated = true;
        console.log(`🌍 HOST: World generated - ${this.chunks.size} chunks (chunkSize=${this.config.chunk.size}), seed: ${seed}`);
        return { seed };
    }

    /**
     * Generates a world based on the seed retrieved from a network message.
     */
    public generateWorldNetwork(worldData: WorldGenData): void {
        console.log(`🌍 CLIENT: Receiving world from host with seed: ${worldData.seed}`);
        this.initCanvas();

        const seed = worldData.seed;
        this.currentSeed = seed;
        this.config.generation.seed = seed;
        this.chunkBiomes.clear();
        this.chunks.clear();

        const { worldPixelData, worldHeightData, cellBiomeGrid } = this.generateCells(seed);
        this.bakeChunksFromCells(seed, worldPixelData, worldHeightData, cellBiomeGrid);

        this.isGenerated = true;
        console.log(`🌍 CLIENT: World loaded - ${this.chunks.size} chunks (chunkSize=${this.config.chunk.size})`);
    }

    private generateCells(seed: number): {
        worldPixelData: Uint8Array;
        worldHeightData: Uint8Array;
        cellBiomeGrid: number[][];
    } {
        const cellSize = this.config.generation.cellSize;
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);

        const worldPixelData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT);
        const worldHeightData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT);
        const cellBiomeGrid: number[][] = Array.from({ length: cellsY }, () => new Array<number>(cellsX).fill(0));

        for (let cellY = 0; cellY < cellsY; cellY++) {
            for (let cellX = 0; cellX < cellsX; cellX++) {

                // === [ SAMPLE RAW HEIGHT FROM NOISE ] ============================
                const baseHeight = this.smoothNoise(
                    (cellX + 0.5) * this.config.generation.biomeNoiseScale,
                    (cellY + 0.5) * this.config.generation.biomeNoiseScale,
                    seed
                );

                // Clamp raw just to be safe
                let adjustedHeight = baseHeight;
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1;

                // === [ APPLY CONTRAST / INTENSITY AROUND MIDPOINT 0.5 ] ==========
                //
                // biomeNoiseIntensity > 1 exaggerates lows/highs
                // biomeNoiseIntensity < 1 flattens toward 0.5
                //
                const mid: number = 0.5;
                adjustedHeight = mid + (adjustedHeight - mid) * this.config.generation.biomeNoiseIntensity;

                // Clamp again
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1;

                // === [ APPLY GLOBAL BIAS CURVE ] ================================
                //
                // heightCurve > 1 biases toward 0 (more low biomes),
                // heightCurve < 1 biases toward 1 (more high biomes)
                //
                adjustedHeight = Math.pow(adjustedHeight, this.config.generation.heightCurve);

                // Final clamp into [0..1]
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1;

                // === [ SEA LEVEL CHECK ] ========================================
                //
                // Cells below seaLevel are water cells.
                //
                const isWater = adjustedHeight < this.config.generation.seaLevel;

                // Pick biome using the adjusted/baked height
                const biome = this.pickBiomeForHeight(adjustedHeight);
                const biomeIndex = BIOMES.indexOf(biome);
                cellBiomeGrid[cellY][cellX] = biomeIndex;

                // === [ WRITE OUT ALL PIXELS IN THIS CELL ] ======================
                const startX = cellX * cellSize;
                const startY = cellY * cellSize;

                for (let ly = 0; ly < cellSize; ly++) {
                    for (let lx = 0; lx < cellSize; lx++) {
                        const worldX = startX + lx;
                        const worldY = startY + ly;
                        if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                        // We'll compute what material + color ends up here,
                        // then encode it into worldPixelData.
                        let outMaterialIndex: number;
                        let outColorIndex: number;

                        if (isWater) {
                            // WATER BRANCH
                            const waterMatIndex = MATERIALS.findIndex(m => m.name === "water");
                            const fallbackIndex = waterMatIndex >= 0 ? waterMatIndex : 0;

                            // give water some subtle variation
                            const waterDetailNoise = this.smoothNoise(
                                worldX * this.config.generation.detailNoiseScale,
                                worldY * this.config.generation.detailNoiseScale,
                                seed + 5000
                            );

                            const waterMat = MATERIALS[fallbackIndex];
                            const variantCount = waterMat.colors.length;
                            const chosenVariant = Math.floor(waterDetailNoise * variantCount);

                            outMaterialIndex = fallbackIndex;
                            outColorIndex = chosenVariant;
                        } else {
                            // LAND BRANCH
                            const pixelInfo = this.getPixelData(worldX, worldY, seed, biome);

                            let landMatIndex = MATERIALS.findIndex(m => m.name === pixelInfo.material.name);
                            if (landMatIndex < 0) landMatIndex = 0; // safety

                            outMaterialIndex = landMatIndex;
                            outColorIndex = pixelInfo.materialColorIndex;
                        }

                        // Pack material index + color variant into single byte
                        const combined = (outMaterialIndex << 2) | outColorIndex;

                        const idx = worldY * WORLD.WIDTH + worldX;
                        worldPixelData[idx] = combined;

                        // Store final adjustedHeight (0..1 mapped to 0..255)
                        worldHeightData[idx] = Math.round(adjustedHeight * 255);
                    }
                }
            }
        }

        return { worldPixelData, worldHeightData, cellBiomeGrid };
    }

    private pickBiomeForHeight(h: number): Biome {
        let best = BIOMES[0];
        let bestDist = Math.abs(h - best.height);
        for (let i = 1; i < BIOMES.length; i++) {
            const d = Math.abs(h - BIOMES[i].height);
            if (d < bestDist) { best = BIOMES[i]; bestDist = d; }
        }
        return best;
    }

    private bakeChunksFromCells(
        seed: number,
        worldPixelData: Uint8Array,
        worldHeightData: Uint8Array,   // NEW
        cellBiomeGrid: number[][]
    ): void {
        const chunkSize = this.config.chunk.size;
        const chunksX = Math.ceil(WORLD.WIDTH / chunkSize);
        const chunksY = Math.ceil(WORLD.HEIGHT / chunkSize);

        const cellSize = this.config.generation.cellSize;
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);

        for (let cx = 0; cx < chunksX; cx++) {
            for (let cy = 0; cy < chunksY; cy++) {
                const chunkPixels = new Uint8Array(chunkSize * chunkSize);
                const chunkHeights = new Uint8Array(chunkSize * chunkSize); // NEW

                for (let y = 0; y < chunkSize; y++) {
                    for (let x = 0; x < chunkSize; x++) {
                        const worldX = cx * chunkSize + x;
                        const worldY = cy * chunkSize + y;
                        if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                        const gi = worldY * WORLD.WIDTH + worldX;
                        const li = y * chunkSize + x;

                        chunkPixels[li] = worldPixelData[gi];
                        chunkHeights[li] = worldHeightData[gi]; // NEW
                    }
                }

                // Dominant biome in this runtime chunk (vote by overlapping cells)
                const biomeCounts: Record<number, number> = {};
                const startCellX = Math.floor((cx * chunkSize) / cellSize);
                const endCellX = Math.floor(((cx + 1) * chunkSize - 1) / cellSize);
                const startCellY = Math.floor((cy * chunkSize) / cellSize);
                const endCellY = Math.floor(((cy + 1) * chunkSize - 1) / cellSize);

                for (let cby = startCellY; cby <= endCellY; cby++) {
                    if (cby < 0 || cby >= cellsY) continue;
                    for (let cbx = startCellX; cbx <= endCellX; cbx++) {
                        if (cbx < 0 || cbx >= cellsX) continue;
                        const idx = cellBiomeGrid[cby][cbx];
                        biomeCounts[idx] = (biomeCounts[idx] || 0) + 1;
                    }
                }

                let dominantIdx = 0, max = -1;
                for (const k in biomeCounts) {
                    const c = biomeCounts[k as any];
                    if (c > max) { max = c; dominantIdx = parseInt(k, 10); }
                }
                const dominantBiome = BIOMES[dominantIdx] || BIOMES[0];

                const worldChunk = new WorldChunk(chunkSize, dominantBiome.name, chunkPixels, chunkHeights);
                const key = `${cx},${cy}`;
                this.chunks.set(key, worldChunk);
                this.chunkBiomes.set(key, dominantBiome);

                this.renderChunk(cx, cy, worldChunk);
            }
        }
    }

    /**
     * Runs the full noise pipeline for a specific world pixel (x, y), 
     * constrained by the parent Chunk's Official Biome.
     * * NOTE: The 'biome' is now passed in and is NOT calculated via noise here.
     */
    public getPixelData(
        worldX: number,
        worldY: number,
        seed: number,
        biome: Biome
    ): { material: Material; materialColorIndex: number; biome: Biome } {
        const materialNoise = this.smoothNoise(
            worldX * this.config.generation.materialNoiseScale,
            worldY * this.config.generation.materialNoiseScale,
            seed + 1000
        );

        let selectedMaterial: Material = MATERIALS[0];
        const totalWeight = biome.materials.reduce((s, m) => s + m.weight, 0);
        let target = materialNoise * totalWeight;

        for (const entry of biome.materials) {
            target -= entry.weight;
            if (target <= 0) {
                selectedMaterial = MATERIALS.find(m => m.name === entry.material) || MATERIALS[0];
                break;
            }
        }

        const detailNoise = this.smoothNoise(
            worldX * this.config.generation.detailNoiseScale,
            worldY * this.config.generation.detailNoiseScale,
            seed + 3000
        );
        const colorIdx = Math.floor(detailNoise * selectedMaterial.colors.length);

        return { material: selectedMaterial, materialColorIndex: colorIdx, biome };
    }

    /**
     * Vary color based on noise
     */
    private varyColor(hexColor: string, noise: number): string {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const variation = this.config.generation.colorVariation;
        const factor = 1 + (noise - 0.5) * variation;
        const nr = Math.max(0, Math.min(255, Math.floor(r * factor)));
        const ng = Math.max(0, Math.min(255, Math.floor(g * factor)));
        const nb = Math.max(0, Math.min(255, Math.floor(b * factor)));
        return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    }

    //
    // #endregion

    // #region [ Rendering ]
    //
    /**
     * Renders the world to the world canvas within the camera bounds.
     */
    public drawWorld(): void {
        if (!this.ui.ctx || !this.worldCanvas || !this.isGenerated) return;
        this.ui.ctx.drawImage(
            this.worldCanvas,
            this.camera.x, this.camera.y,
            CANVAS.WIDTH, CANVAS.HEIGHT,
            0, 0,
            CANVAS.WIDTH, CANVAS.HEIGHT
        );
    }

    /**
     * Renders the world chunk borders.
     */
    public drawGrid(): void {
        if (!this.ui.ctx || !this.isGenerated || !this.config.grid.enabled) return;

        const ctx = this.ui.ctx;
        const chunkSize = this.config.chunk.size;
        const camX = this.camera.x, camY = this.camera.y;

        const startCX = Math.floor(camX / chunkSize);
        const endCX = Math.ceil((camX + CANVAS.WIDTH) / chunkSize);
        const startCY = Math.floor(camY / chunkSize);
        const endCY = Math.ceil((camY + CANVAS.HEIGHT) / chunkSize);

        ctx.save();

        const hoveredCoords = this.updateHoveredChunk();
        let tooltipText = "";

        if (this.hoveredChunk && hoveredCoords) {
            const [hcx, hcy] = this.hoveredChunk.split(",").map(Number);
            const hoveredChunkWorldX = hcx * chunkSize;
            const hoveredChunkWorldY = hcy * chunkSize;
            const hoveredScreenX = hoveredChunkWorldX - camX;
            const hoveredScreenY = hoveredChunkWorldY - camY;

            // highlight
            const hex = this.config.grid.chunkBorderColor.slice(1);
            const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
            ctx.fillRect(hoveredScreenX, hoveredScreenY, chunkSize, chunkSize);

            // tooltip data
            const worldX = Math.floor(hoveredCoords.worldX);
            const worldY = Math.floor(hoveredCoords.worldY);
            const mousePos = this.controlsManager.getMousePos();

            const key = `${hcx},${hcy}`;
            const chunk = this.chunks.get(key);
            const chunkBiome = this.chunkBiomes.get(key);

            let materialName = "unknown";
            let materialType = "unknown";
            let materialIndex = -1;
            let colorVariantIndex = -1;
            let height01 = -1;

            if (chunk) {
                const localX = worldX - hcx * chunkSize;
                const localY = worldY - hcy * chunkSize;
                const li = localY * chunkSize + localX;

                const combined = chunk.pixelData[li];
                materialIndex = combined >> 2;
                colorVariantIndex = combined & 0b11;

                const mat = MATERIALS[materialIndex];
                if (mat) { materialName = mat.name; materialType = mat.type; }

                height01 = chunk.getHeightAt(localX, localY, chunkSize); // NEW
            }

            tooltipText = `
                Biome:
                > ${chunkBiome ? chunkBiome.name : "N/A"}
                Chunk:
                > Pos: ${hcx}, ${hcy} (Size: ${chunkSize}x${chunkSize})
                Pixel:
                > World Pos: ${worldX}, ${worldY}
                > Material: ${materialName} (Index: ${materialIndex})
                > Type: ${materialType}
                > Color Var: ${colorVariantIndex}
                > Height: ${height01 >= 0 ? height01.toFixed(2) : "N/A"}
            `.replace(/ {2,}/g, "").trim();

            this.drawTooltip(tooltipText, mousePos.x, mousePos.y);
        }

        // borders
        for (let cx = startCX; cx < endCX; cx++) {
            for (let cy = startCY; cy < endCY; cy++) {
                const worldX = cx * chunkSize, worldY = cy * chunkSize;
                const screenX = worldX - camX, screenY = worldY - camY;

                const currentBiome = this.getChunkBiome(cx, cy);

                // right edge
                const biomeRight = this.getChunkBiome(cx + 1, cy) || currentBiome;
                const vBorder = !!(currentBiome && biomeRight && currentBiome.name !== biomeRight.name);

                ctx.beginPath();
                ctx.moveTo(screenX + chunkSize, screenY);
                ctx.lineTo(screenX + chunkSize, screenY + chunkSize);
                ctx.lineWidth = vBorder ? this.config.grid.borderWidth : this.config.grid.lineWidth;
                ctx.strokeStyle = vBorder ? this.config.grid.biomeBorderColor : this.config.grid.chunkBorderColor;
                ctx.stroke();

                // bottom edge
                const biomeBottom = this.getChunkBiome(cx, cy + 1) || currentBiome;
                const hBorder = !!(currentBiome && biomeBottom && currentBiome.name !== biomeBottom.name);

                ctx.beginPath();
                ctx.moveTo(screenX, screenY + chunkSize);
                ctx.lineTo(screenX + chunkSize, screenY + chunkSize);
                ctx.lineWidth = hBorder ? this.config.grid.borderWidth : this.config.grid.lineWidth;
                ctx.strokeStyle = hBorder ? this.config.grid.biomeBorderColor : this.config.grid.chunkBorderColor;
                ctx.stroke();
            }
        }

        // world bounds
        ctx.strokeStyle = this.config.grid.worldBorderColor;
        ctx.lineWidth = this.config.grid.borderWidth;
        ctx.strokeRect(0 - camX, 0 - camY, WORLD.WIDTH, WORLD.HEIGHT);

        ctx.restore();
    }

    /**
     * Renders chunks to the world canvas.
     */
    private renderChunk(cx: number, cy: number, chunk: WorldChunk): void {
        if (!this.worldCtx) return;
        const chunkSize = this.config.chunk.size;
        const startX = cx * chunkSize, startY = cy * chunkSize;

        for (let y = 0; y < chunkSize; y++) {
            for (let x = 0; x < chunkSize; x++) {
                const worldX = startX + x, worldY = startY + y;
                if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                const baseColor = chunk.getColorAt(x, y, chunkSize);
                const detailNoise = this.smoothNoise(
                    worldX * this.config.generation.detailNoiseScale,
                    worldY * this.config.generation.detailNoiseScale,
                    this.currentSeed + 3000
                );
                const finalColor = this.varyColor(baseColor, detailNoise);
                this.worldCtx.fillStyle = finalColor;
                this.worldCtx.fillRect(worldX, worldY, 1, 1);
            }
        }
    }

    private smoothNoise(x: number, y: number, seed: number): number {
        let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
        for (let i = 0; i < this.config.generation.octaves; i++) {
            total += this.interpolatedNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
            maxValue += amplitude;
            amplitude *= this.config.generation.persistence;
            frequency *= 2;
        }
        return total / maxValue;
    }

    private interpolatedNoise(x: number, y: number, seed: number): number {
        const intX = Math.floor(x), fracX = x - intX;
        const intY = Math.floor(y), fracY = y - intY;

        const v1 = this.hash2D(intX, intY, seed);
        const v2 = this.hash2D(intX + 1, intY, seed);
        const v3 = this.hash2D(intX, intY + 1, seed);
        const v4 = this.hash2D(intX + 1, intY + 1, seed);

        const sx = this.smoothstep(fracX);
        const sy = this.smoothstep(fracY);

        const i1 = this.lerp(v1, v2, sx);
        const i2 = this.lerp(v3, v4, sx);
        return this.lerp(i1, i2, sy);
    }

    private hash2D(x: number, y: number, seed: number): number {
        const n = x * 374761393 + y * 668265263 + seed;
        const hash = (n ^ (n >> 13)) * 1274126177;
        return ((hash ^ (hash >> 16)) & 0x7fffffff) / 0x7fffffff;
    }

    private smoothstep(t: number): number { return t * t * (3 - 2 * t); }
    private lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

    //
    // #endregion

    // #region [ General Helpers ]
    //
    /**
     * Gets the material property of a pixel at runtime.
     */
    public getMaterialAt(x: number, y: number): Material | null {
        const chunkSize = this.config.chunk.size;
        const cx = Math.floor(x / chunkSize), cy = Math.floor(y / chunkSize);
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return null;

        const localX = x - cx * chunkSize;
        const localY = y - cy * chunkSize;
        const idx = localY * chunkSize + localX;
        const combined = chunk.pixelData[idx];
        const materialIndex = combined >> 2;
        return MATERIALS[materialIndex] || null;
    }

    public getHeightAt(x: number, y: number): number | null { // NEW
        const chunkSize = this.config.chunk.size;
        const cx = Math.floor(x / chunkSize), cy = Math.floor(y / chunkSize);
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return null;
        const localX = x - cx * chunkSize;
        const localY = y - cy * chunkSize;
        return chunk.getHeightAt(localX, localY, chunkSize);
    }

    /**
     * Gets the stored or calculated primary biome for a chunk.
     * (This replaces the old getChunkBiome used by drawGrid/tooltip)
     */
    private getChunkBiome(cx: number, cy: number): Biome | null {
        const key = `${cx},${cy}`;
        return this.chunkBiomes.get(key) || null;
    }

    /**
     * Calculates the world and chunk coordinates based on the mouse position from ControlsManager.
     */
    private updateHoveredChunk(): { worldX: number; worldY: number } | null {
        const mousePos = this.controlsManager.getMousePos();
        const worldX = mousePos.x + this.camera.x;
        const worldY = mousePos.y + this.camera.y;

        if (worldX < 0 || worldX >= WORLD.WIDTH || worldY < 0 || worldY >= WORLD.HEIGHT) {
            this.hoveredChunk = null;
            return null;
        }

        const chunkSize = this.config.chunk.size;
        const cx = Math.floor(worldX / chunkSize);
        const cy = Math.floor(worldY / chunkSize);
        this.hoveredChunk = `${cx},${cy}`;
        return { worldX, worldY };
    }

    /**
     * Draws the debug tooltip text box next to the mouse cursor.
     */
    private drawTooltip(text: string, screenX: number, screenY: number): void {
        const ctx = this.ui.ctx;
        if (!ctx) return;

        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const lineHeight = 16, padding = 8;
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        let maxWidth = 0;
        lines.forEach(l => { maxWidth = Math.max(maxWidth, ctx.measureText(l).width); });

        const boxWidth = maxWidth + padding * 2;
        const boxHeight = lines.length * lineHeight + padding * 2;

        const offsetX = 15, offsetY = 15;
        let x = screenX + offsetX, y = screenY + offsetY;
        if (x + boxWidth > CANVAS.WIDTH) x = screenX - offsetX - boxWidth;
        if (y + boxHeight > CANVAS.HEIGHT) y = screenY - offsetY - boxHeight;

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = "#00ff7f";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, boxWidth, boxHeight);

        lines.forEach((line, i) => {
            const textY = y + padding + (i + 1) * lineHeight - 4;
            ctx.fillStyle = line.endsWith(":") ? "#00ff7f" : "#ffffff";
            ctx.fillText(line, x + boxWidth / 2, textY);
        });
    }

    //
    // #endregion

    private async showConfigPopup(): Promise<void> {
        return new Promise(resolve => {
            const popup = document.createElement("div");
            popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            color: #fff;
            padding: 20px;
            border: 2px solid #00ff7f;
            border-radius: 8px;
            z-index: 10000;
            font-family: monospace;
        `;

            const form = document.createElement("form");
            form.innerHTML = `
            <h3 style="color: #00ff7f; margin-top: 0;">World Generation Config</h3>

            <label>Biome Scale:
                <input type="number" name="biomeNoiseScale"
                    value="${this.config.generation.biomeNoiseScale}"
                    step="0.001">
            </label><br>

            <label>Material Scale:
                <input type="number" name="materialNoiseScale"
                    value="${this.config.generation.materialNoiseScale}"
                    step="0.001">
            </label><br>

            <label>Detail Scale:
                <input type="number" name="detailNoiseScale"
                    value="${this.config.generation.detailNoiseScale}"
                    step="0.01">
            </label><br>

            <label>Color Variation:
                <input type="number" name="colorVariation"
                    value="${this.config.generation.colorVariation}"
                    step="0.05" min="0" max="1">
            </label><br>

            <label>Octaves:
                <input type="number" name="octaves"
                    value="${this.config.generation.octaves}"
                    min="1" max="6">
            </label><br>

            <label>Persistence:
                <input type="number" name="persistence"
                    value="${this.config.generation.persistence}"
                    step="0.1" min="0" max="1">
            </label><br>

            <label>Cell Size (px):
                <input type="number" name="cellSize"
                    value="${this.config.generation.cellSize}"
                    min="1">
            </label><br>

            <label>Chunk Size (px):
                <input type="number" name="chunkSize"
                    value="${this.config.chunk.size}"
                    min="1">
            </label><br>

            <!-- biome shaping controls -->
            <label>Height Curve (bias low/high):
                <input type="number" name="heightCurve"
                    value="${this.config.generation.heightCurve}"
                    step="0.1" min="0.1">
            </label><br>

            <label>Biome Intensity (contrast):
                <input type="number" name="biomeNoiseIntensity"
                    value="${this.config.generation.biomeNoiseIntensity}"
                    step="0.1" min="0">
            </label><br>

            <!-- NEW: sea level -->
            <label>Sea Level (0-1):
                <input type="number" name="seaLevel"
                    value="${this.config.generation.seaLevel}"
                    step="0.01" min="0" max="1">
            </label><br>

            <button type="submit"
                style="margin-top:10px;padding:8px 16px;background:#00ff7f;border:none;border-radius:4px;cursor:pointer;">
                Generate (Enter)
            </button>
        `;

            form.onsubmit = e => {
                e.preventDefault();
                const fd = new FormData(form);

                this.config.generation.biomeNoiseScale = parseFloat(fd.get("biomeNoiseScale") as string);
                this.config.generation.materialNoiseScale = parseFloat(fd.get("materialNoiseScale") as string);
                this.config.generation.detailNoiseScale = parseFloat(fd.get("detailNoiseScale") as string);
                this.config.generation.colorVariation = parseFloat(fd.get("colorVariation") as string);
                this.config.generation.octaves = parseInt(fd.get("octaves") as string);
                this.config.generation.persistence = parseFloat(fd.get("persistence") as string);
                this.config.generation.cellSize = parseInt(fd.get("cellSize") as string);
                this.config.chunk.size = parseInt(fd.get("chunkSize") as string);

                // biome shaping controls
                this.config.generation.heightCurve = parseFloat(fd.get("heightCurve") as string);
                this.config.generation.biomeNoiseIntensity = parseFloat(fd.get("biomeNoiseIntensity") as string);

                // NEW: sea level
                this.config.generation.seaLevel = parseFloat(fd.get("seaLevel") as string);

                document.body.removeChild(popup);
                resolve();
            };

            popup.appendChild(form);
            document.body.appendChild(popup);
            (form.querySelector("input") as HTMLInputElement)?.focus();
        });
    }
}