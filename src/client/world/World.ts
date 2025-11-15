import { VIEWPORT, WORLD } from "../Config";
import { WorldLayer, CellData, Material, PhysicsMaterialTypes, PixelData, Vec2, NoiseType, NetworkChunk, PixelWaterData, WorldData, WorldRegion, RegionName, AudioZone, ActiveAudio } from "../Types";

import { Camera } from "../Camera";
import { ControlsManager } from "../ControlsManager";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";
import { WorldChunk } from "./WorldChunk";
import { WorldConfig } from "./WorldConfig";
import { WorldDebug } from "./WorldDebug";
import { WorldEdit } from "./WorldEdit";

import { AudioConfig } from "../audio/AudioConfig";
import { AudioManager } from "../audio/AudioManager";

import { PlayerState } from "../player/PlayerState";

export class World {
    public chunks: WorldChunk[][] = [];
    public chunkLayers: WorldLayer[][] = [];
    public regions: WorldRegion[] = [];

    public audioZones: Map<string, AudioZone> = new Map();
    private regionAudioSources: Map<number, { element: ActiveAudio | null; volume: number }> = new Map();

    public isGenerated = false;
    public currentSeed = 0;

    public worldConfig: WorldConfig;
    public worldDebug: WorldDebug;
    public worldEdit: WorldEdit;

    private erosionTemplate: { name: string; index: number }[] | null = null;
    private chunkBuffer: { cx: number; cy: number; loaded: boolean }[] = [];
    private worldBuffer: CellData | null = null;

    private readonly YIELD_RATE = 10;
    private readonly WORLDGEN_PHASES: readonly string[] = ["cells", "degen", "hydration"];

    constructor(
        private audioConfig: AudioConfig,
        private audioManager: AudioManager,
        private camera: Camera,
        private controlsManager: ControlsManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private utility: Utility
    ) {
        this.worldConfig = new WorldConfig();
        this.worldDebug = new WorldDebug(this.camera, this.controlsManager, this.ui, this.utility, this);
        this.worldEdit = new WorldEdit(this, this.roomManager, this.ui, this.utility);

        this.initLoadingProgressEvents();
    }

    // #region [ General ]
    //
    /**
     * Clears all of the world data for a fresh slate.
     */
    public clear(): void {
        console.log("Clearing world data...");

        // Core data maps
        this.chunks = [];
        this.chunkLayers = [];
        this.regions = [];

        this.cleanWorldAudio();

        // Buffers and templates
        this.chunkBuffer = [];
        this.worldBuffer = null;
        this.erosionTemplate = null;

        // State flags
        this.isGenerated = false;
        this.currentSeed = 0;

        // Debug + UI cleanup
        this.worldDebug.hoveredChunk = null;

        if (this.ui.worldCtx && this.ui.worldCanvas) {
            this.ui.worldCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        }
    }
    //
    // #endregion

    // #region [ Generation ]
    //

    /**
     * Shows the generation menu for the host allows worldgen tuning.
     * 
     * Returns seed and chosen params for network sync and generation.
     */
    public async showGenerationMenu(): Promise<WorldData | "load"> {
        const result = await this.worldgenMenu();

        if (result.mode === "load" && result.file) {
            await this.loadWorldFromFile(result.file);
            return "load"; // signal that we loaded
        }

        const params = this.worldConfig.worldgenParams;
        const seed = params.general.seed || Date.now();

        params.general.seed = seed;
        this.currentSeed = seed;

        return { seed, params };
    }

    /**
     * Main world generation loop.
     * 
     * - Creates cellData
     * - Uses cellData for degeneration pass
     * - Hydrates cells for water coverage
     * - Bakes world details into chunks
     */
    public async generateWorld(worldData: WorldData): Promise<void> {
        this.showLoadingMenu();
        this.clear(); // Full refresh just in case

        this.worldConfig.worldgenParams = worldData.params;
        this.currentSeed = worldData.seed;

        const cellData = await this.generateCells(worldData.seed);
        const degenCellData = await this.applyDegen(cellData, worldData.seed);
        const hydratedCellData = await this.applyHydration(degenCellData, worldData.seed);

        await this.bakeChunksFromCells(hydratedCellData);

        this.isGenerated = true;
        this.hideLoadingMenu();
        console.log(`World generated: ${worldData.seed}`);
    }

    /**
     * Processes cell generation, which is responsible for the detail level in the world.
     * 
     * Creates and returns the CellData which is used to bake the cells into chunks.
     */
    private async generateCells(seed: number): Promise<CellData> {
        const worldGenParams = this.worldConfig.worldgenParams;
        const cellSize = worldGenParams.general.cell.size;
        const terrain = worldGenParams.terrain;
        const lowestDepth = terrain.lowestDepth;
        const seaLevel = terrain.seaLevel;

        // Determine how many cells needed to fill world
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);

        const worldPixelData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT); // Build storage for pixel data (1byte per px)
        const worldHeightData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT); // Build storage for pixel height data (1byte per px)

        // Build storage for the layer type for each cell
        const cellLayerGrid: number[][] = Array.from({ length: cellsY }, () => new Array<number>(cellsX).fill(0));

        // Show status message
        const message = this.worldConfig.getWorldgenMessage("generation");
        await this.utility.yield(message);

        const totalCells = cellsX * cellsY;
        let processedCells = 0;

        for (let cellY = 0; cellY < cellsY; cellY++) {
            for (let cellX = 0; cellX < cellsX; cellX++) {

                processedCells++;
                if (processedCells % Math.floor(totalCells / this.YIELD_RATE) === 0) {
                    await this.utility.yield();
                }

                // Sample height from noise
                let adjustedHeight = this.utility.getNoise(
                    terrain.noiseType,
                    (cellX + 0.5) * terrain.scale,
                    (cellY + 0.5) * terrain.scale,
                    seed,
                    {
                        octaves: terrain.octaves,
                        persistence: terrain.persistence
                    }
                );

                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                const mid: number = 0.5; // Push contrast around midpoint
                adjustedHeight = mid + (adjustedHeight - mid) * terrain.intensity;
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                adjustedHeight = Math.pow(adjustedHeight, terrain.heightCurve); // Bias curve
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                // === Island / Valley shaping (exclusive) ===
                const opts = worldGenParams.general.options;
                if (opts.island || opts.valley) {

                    // Distance from nearest world edge
                    const distToEdgeX = Math.min(cellX * cellSize, WORLD.WIDTH - (cellX * cellSize + cellSize));
                    const distToEdgeY = Math.min(cellY * cellSize, WORLD.HEIGHT - (cellY * cellSize + cellSize));
                    const distToEdge = Math.min(distToEdgeX, distToEdgeY);

                    // Normalize 0 at edge → 1 at center
                    const maxDist = Math.min(WORLD.WIDTH, WORLD.HEIGHT) * 0.5;
                    let t = Math.min(1, distToEdge / maxDist);

                    // Smooth curve (smootherstep)
                    t = t * t * (3 - 2 * t);

                    // Optional subtle noise for organic variation
                    const edgeNoise = this.utility.getNoise(
                        terrain.noiseType,
                        cellX * 0.002,
                        cellY * 0.002,
                        seed + 9100,
                        { octaves: 2, persistence: 0.5 }
                    ) * 0.1;

                    // === ISLAND MODE ===
                    if (opts.island) {
                        const target = seaLevel * 0.5; // deep ocean floor baseline
                        adjustedHeight = this.utility.lerp(target, adjustedHeight, t + edgeNoise);

                        if (adjustedHeight < lowestDepth) adjustedHeight = lowestDepth;
                        else if (adjustedHeight > 1) adjustedHeight = 1;
                    }

                    // === VALLEY MODE ===
                    else if (opts.valley) {
                        // Hard mountain edge (height → 1) fading toward valley
                        const fade = Math.pow(1 - t, terrain.heightCurve * 1.5);
                        const target = 1.0; // mountain peak height
                        adjustedHeight = this.utility.lerp(adjustedHeight, target, fade + edgeNoise);

                        if (adjustedHeight < lowestDepth) adjustedHeight = lowestDepth;
                        else if (adjustedHeight > 1) adjustedHeight = 1;
                    }
                }


                if (adjustedHeight < lowestDepth) { adjustedHeight = lowestDepth; } // Clamp water floor to lowestDepth

                const layerForCell = this.pickLayerForHeight(adjustedHeight);

                const layerIndex = this.worldConfig.worldLayerIndex[layerForCell.name];
                cellLayerGrid[cellY][cellX] = layerIndex;

                // Calculate pixel coordinates in this cell
                const startX = cellX * cellSize;
                const startY = cellY * cellSize;

                for (let ly = 0; ly < cellSize; ly++) {
                    for (let lx = 0; lx < cellSize; lx++) {
                        const worldPos = {
                            x: startX + lx,
                            y: startY + ly
                        }

                        if (worldPos.x >= WORLD.WIDTH || worldPos.y >= WORLD.HEIGHT) continue; // Skip cells outside the world

                        const pixelInfo = this.samplePixelData(worldPos, seed, layerForCell);

                        const landMatIndex = this.worldConfig.materialIndex[pixelInfo.material.name];

                        const outMaterialIndex = landMatIndex >= 0 ? landMatIndex : 0;
                        const outColorIndex = pixelInfo.materialColorIndex;

                        const combined = (outMaterialIndex << 2) | outColorIndex;

                        const gi = worldPos.y * WORLD.WIDTH + worldPos.x;
                        worldPixelData[gi] = combined;

                        // Store final adjustedHeight (0..1 mapped to 0..255)
                        worldHeightData[gi] = Math.round(adjustedHeight * 255);
                    }
                }
            }
        }

        return { worldPixelData, worldHeightData, cellLayerGrid };
    }

    /**
     * Given the provided inputs, sample what pixel should be at this worldPos based on the seed.
     * 
     * Decides:
     * - Which material goes here using layer weights and noise
     * - Which color variant of that material to use
     * - Returns that and the layer we used to make the decision
     */
    public samplePixelData(worldPos: Vec2, seed: number, layer: WorldLayer): PixelData {
        // Sample broad-scale material noise for this pixel
        // (used to pick WHICH material from the layer we get here)
        const materialNoise = this.utility.getNoise(
            this.worldConfig.worldgenParams.material.noiseType,
            worldPos.x * this.worldConfig.worldgenParams.material.scale,
            worldPos.y * this.worldConfig.worldgenParams.material.scale,
            seed + 1000,
            {
                octaves: this.worldConfig.worldgenParams.terrain.octaves,
                persistence: this.worldConfig.worldgenParams.terrain.persistence
            }
        );

        // Roll weighted choice from the layer's material list
        // { material: "dirt", weight: 3 }
        const entries = layer.materials;
        const totalWeight = entries.reduce((s, m) => s + m.weight, 0);
        let target = materialNoise * totalWeight;

        let selectedMaterial: Material = this.worldConfig.materialsList[this.worldConfig.materialIndex["stone"]];

        for (const entry of entries) {
            target -= entry.weight;
            if (target <= 0) {
                const idx = this.worldConfig.materialIndex[entry.material];
                if (idx !== undefined) {
                    selectedMaterial = this.worldConfig.materialsList[idx];
                }
                break;
            }
        }

        // Sample higher-frequency noise to pick which color index of chosen material to use
        // (this breaks up flat color tiling so it doesn't look copy/paste everywhere)
        const detailNoise = this.utility.getNoise(
            this.worldConfig.worldgenParams.material.detail.noiseType,
            worldPos.x * this.worldConfig.worldgenParams.material.detail.scale,
            worldPos.y * this.worldConfig.worldgenParams.material.detail.scale,
            seed + 3000,
            {
                octaves: this.worldConfig.worldgenParams.terrain.octaves,
                persistence: this.worldConfig.worldgenParams.terrain.persistence
            }
        );
        const colorIdx = Math.floor(detailNoise * selectedMaterial.colors.length); // Pick color index from material's palette

        return { material: selectedMaterial, materialColorIndex: colorIdx, layer };
    }

    /**
     * Processes a normalized height value, and picks the closest layer.
     */
    private pickLayerForHeight(h: number): WorldLayer {
        const layers = this.worldConfig.worldLayerList;

        let best = layers[0]; // Start with first layer as "best match"
        let bestDist = Math.abs(h - best.height);

        // Check all other layer and find correct best match
        for (let i = 1; i < layers.length; i++) {
            const d = Math.abs(h - layers[i].height);
            if (d < bestDist) {
                best = layers[i];
                bestDist = d;
            }
        }
        return best;
    }

    //
    // #endregion

    // #region [ Degeneration ]
    //
    /**
     * Second-phase world shaping.
     * 
     * Lowers height, changes material and simulates nearby pixels.
     * 
     * Returns new CellData.
     */
    private async applyDegen(cellData: CellData, seed: number): Promise<CellData> {
        console.log("Applying degeneration pass...");

        const { worldPixelData, worldHeightData, cellLayerGrid } = cellData;
        const newPixelData = new Uint8Array(worldPixelData);
        const newHeightData = new Uint8Array(worldHeightData);

        const degenConfig = this.worldConfig.worldgenParams.degen;
        const allMaterials = this.worldConfig.materialsList;

        const erosionMaterials = this.getErosionTemplate();

        const message = this.worldConfig.getWorldgenMessage("degeneration");
        await this.utility.yield(message);

        const totalPixels = WORLD.WIDTH * WORLD.HEIGHT;
        let processedPixels = 0;

        // === EROSION PASS ===
        for (let wy = 0; wy < WORLD.HEIGHT; wy++) {
            for (let wx = 0; wx < WORLD.WIDTH; wx++) {
                const gi = wy * WORLD.WIDTH + wx;

                processedPixels++;
                if (processedPixels % Math.floor(totalPixels / this.YIELD_RATE) === 0) {
                    await this.utility.yield();
                }

                const originalHeightByte = worldHeightData[gi];
                const originalHeight01 = originalHeightByte / 255;

                // Skip if below minimum erosion height
                if (originalHeight01 < degenConfig.minHeight) {
                    newPixelData[gi] = worldPixelData[gi];
                    newHeightData[gi] = worldHeightData[gi];
                    continue;
                }

                // === CALCULATE EROSION AMOUNT ===
                const erosionNoise = this.utility.getNoise(
                    degenConfig.noiseType,
                    wx * degenConfig.scale,
                    wy * degenConfig.scale,
                    seed + 6000,
                    {
                        octaves: this.worldConfig.worldgenParams.degen.scale,
                        persistence: this.worldConfig.worldgenParams.degen.hardness
                    }
                );

                const detailNoise = this.utility.getNoise(
                    degenConfig.detail.noiseType,
                    wx * degenConfig.detail.scale,
                    wy * degenConfig.detail.scale,
                    seed + 7000,
                    {
                        octaves: this.worldConfig.worldgenParams.degen.detail.scale,
                        persistence: this.worldConfig.worldgenParams.degen.hardness
                    }
                );

                // Combine noises
                const combinedNoise = erosionNoise * 0.7 + detailNoise * 0.3;

                // Only erode if above threshold
                if (combinedNoise < degenConfig.threshold) {
                    newPixelData[gi] = worldPixelData[gi];
                    newHeightData[gi] = worldHeightData[gi];
                    continue;
                }

                // Calculate erosion strength
                const erosionStrength = (combinedNoise - degenConfig.threshold) / (1 - degenConfig.threshold);
                const erosionAmount = erosionStrength * degenConfig.intensity;

                // Get current material's durability (check if solid first!)
                const currentPacked = worldPixelData[gi];
                const currentMatIndex = currentPacked >> 2;
                const currentMat = allMaterials[currentMatIndex];

                let durability = 0.5;
                if (currentMat.physics.type === PhysicsMaterialTypes.Solid) {
                    durability = currentMat.physics.durability;
                }

                // Apply erosion with material resistance
                const heightReduction = erosionAmount * (1 - durability) * degenConfig.hardness;
                let newHeight01 = originalHeight01 - heightReduction;
                if (newHeight01 < 0) newHeight01 = 0;

                const newHeightByte = Math.round(newHeight01 * 255);
                newHeightData[gi] = newHeightByte;

                // === CALCULATE EROSION DEPTH (0 = no erosion, 1 = max erosion) ===
                const erosionDepth = (originalHeight01 - newHeight01) / Math.max(0.01, originalHeight01);

                // === SELECT MATERIAL BASED ON EROSION DEPTH ===
                // Map erosion depth to material hardness gradient
                // 0% eroded = keep original material (or softest if significantly eroded)
                // 100% eroded = hardest material (bedrock)

                const originalDurability = currentMat.physics.type === PhysicsMaterialTypes.Solid
                    ? currentMat.physics.durability
                    : 0.5;


                const harderMaterials = erosionMaterials.filter(m => {
                    const mat = allMaterials[m.index];
                    if (!mat) return false;

                    const matDurability =
                        mat.physics.type === PhysicsMaterialTypes.Solid
                            ? mat.physics.durability
                            : 0.5;

                    return matDurability >= originalDurability;
                });

                let newMatIndex: number;
                let newColorVariantIndex: number;

                if (harderMaterials.length === 0) {
                    // Current material is already the hardest - keep it
                    newMatIndex = currentMatIndex;
                    const colorVariant = currentPacked & 0b11;
                    newColorVariantIndex = colorVariant;
                } else {
                    // Map erosion depth [0...1] to harder materials gradient [0...length-1]
                    const normalizedDepth = Math.min(1, erosionDepth);
                    const materialIndex = Math.floor(normalizedDepth * (harderMaterials.length - 1));
                    const clampedIndex = Math.min(materialIndex, harderMaterials.length - 1);

                    newMatIndex = harderMaterials[clampedIndex].index;

                    // Pick random color variant for the new material
                    const detailForColor = this.utility.getNoise(
                        this.worldConfig.worldgenParams.material.detail.noiseType,
                        wx * this.worldConfig.worldgenParams.material.detail.scale,
                        wy * this.worldConfig.worldgenParams.material.detail.scale,
                        seed + 8000,
                        {
                            octaves: this.worldConfig.worldgenParams.degen.detail.scale,
                            persistence: this.worldConfig.worldgenParams.degen.hardness
                        }
                    );

                    const selectedMat = allMaterials[newMatIndex];
                    const numColors = selectedMat.colors.length;
                    newColorVariantIndex = Math.floor(detailForColor * numColors) % numColors;
                }

                // Pack and store
                const newPacked = (newMatIndex << 2) | (newColorVariantIndex & 0b11);
                newPixelData[gi] = newPacked;
            }
        }

        console.log("Degeneration pass complete.");
        return {
            worldPixelData: newPixelData,
            worldHeightData: newHeightData,
            cellLayerGrid: cellLayerGrid
        };
    }

    /**
     * Gets or creates the erosion template from the chosen materials.
     */
    private getErosionTemplate(): { name: string; index: number }[] {
        if (this.erosionTemplate) return this.erosionTemplate;

        const erosionMaterialNames: string[] = [
            "silt",
            "sand",
            "gravel",
            "dirt",
            "clay",
            "shale",
            "limestone",
            "stone",
            "slate",
            "basalt",
            "granite",
            "bedrock"
        ]; // These materials will be possibly exposed during erosion

        const lookup = this.worldConfig.materialIndex;

        const cached: { name: string; index: number }[] = erosionMaterialNames
            .map((name: string) => ({
                name,
                index: lookup[name]
            }))
            .filter(m => m.index !== undefined);

        this.erosionTemplate = cached;
        console.log("Cached erosion materials...");

        return cached;
    }

    //
    // #endregion

    // #region [ Hydration ]
    //

    private async applyHydration(cellData: CellData, seed: number): Promise<CellData> {
        console.log("Applying hydration pass...");

        const { worldPixelData, worldHeightData, cellLayerGrid } = cellData;
        const newWaterData = new Uint8Array(worldPixelData.length);
        const newPixelData = new Uint8Array(worldPixelData);

        const allMaterials = this.worldConfig.materialsList;
        const materialIndexLookup = this.worldConfig.materialIndex;

        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;
        const lowestDepth = this.worldConfig.worldgenParams.terrain.lowestDepth;
        const depthRange = seaLevel - lowestDepth;

        const width = WORLD.WIDTH;
        const height = WORLD.HEIGHT;
        const totalPixels = width * height;

        const wetMaterialMap: Record<string, string> = {
            "clay": "clay_wet",
            "dirt": "mud",
            "sand": "sand_wet",
            "silt": "silt_wet"
        };

        const message = this.worldConfig.getWorldgenMessage("hydration");
        await this.utility.yield(message);

        // === 1. Create water depth & wetness mask ===
        const wetness = new Float32Array(totalPixels);
        const isWaterPixel = new Uint8Array(totalPixels); // <— track direct water

        for (let i = 0; i < totalPixels; i++) {
            const h = worldHeightData[i] / 255;
            let depthT = 0;
            if (h < seaLevel) {
                depthT = (seaLevel - h) / depthRange;
                depthT = Math.max(0, Math.min(1, depthT));
                newWaterData[i] = Math.round(depthT * 255);
                wetness[i] = 1; // <— force full wetness
                isWaterPixel[i] = 1; // <— mark as direct water
            } else {
                newWaterData[i] = 0;
                wetness[i] = 0;
            }
        }

        // === 2. Diffuse wetness outward (fast blur pass) ===
        const tmp = new Float32Array(totalPixels);
        const passes = 4;
        const blurRadius = 5;

        for (let pass = 0; pass < passes; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;

                    // skip direct water pixels; keep them at full wetness
                    if (isWaterPixel[idx]) {
                        tmp[idx] = 1;
                        continue;
                    }

                    let acc = wetness[idx];
                    let count = 1;
                    for (let dy = -blurRadius; dy <= blurRadius; dy++) {
                        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const nIdx = ny * width + nx;
                            acc += wetness[nIdx];
                            count++;
                        }
                    }
                    tmp[idx] = acc / count;
                }
            }
            wetness.set(tmp);
        }


        // === 3. Add subtle low-frequency noise for realism ===
        const moistureNoiseScale = 0.0025;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const n = this.utility.getNoise(
                    this.worldConfig.worldgenParams.material.noiseType,
                    x * moistureNoiseScale,
                    y * moistureNoiseScale,
                    seed + 9999
                );
                wetness[idx] = Math.min(1, Math.max(0, wetness[idx] * (0.9 + n * 0.3)));
            }
        }

        // === 4. Apply material conversion based on wetness threshold ===
        const dryThreshold = 0.05;

        for (let i = 0; i < totalPixels; i++) {
            const w = wetness[i];
            if (w <= dryThreshold) continue;

            const packed = worldPixelData[i];
            const matIndex = packed >> 2;
            const colorIndex = packed & 0b11;
            const mat = allMaterials[matIndex];
            if (!mat.tags || !mat.tags.includes("absorbent")) continue;

            // chance of wet conversion increases with wetness
            const probability = (w - dryThreshold) / (1 - dryThreshold);
            if (Math.random() < probability) {
                const wetName = wetMaterialMap[mat.name];
                if (wetName) {
                    const wetIndex = materialIndexLookup[wetName];
                    if (wetIndex >= 0) {
                        newPixelData[i] = (wetIndex << 2) | colorIndex;
                    }
                }
            }
        }

        console.log("Hydration pass complete (noise diffusion).");
        return {
            worldPixelData: newPixelData,
            worldHeightData,
            worldWaterData: newWaterData,
            cellLayerGrid
        };
    }


    /**
     * Helper method that returns PixelWaterData.
     * 
     * This contains the amount of water in a cell and the current water material.
     */
    public getWaterData(worldPos: Vec2): PixelWaterData | null {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(worldPos.x / chunkSize);
        const cy = Math.floor(worldPos.y / chunkSize);

        const chunk = this.chunks[cx]?.[cy];
        if (!chunk) return null;

        const localX = worldPos.x - cx * chunkSize;
        const localY = worldPos.y - cy * chunkSize;
        const waterLevel = chunk.getWaterAt(localX, localY, chunkSize);

        if (waterLevel <= 0) return null;

        const height = chunk.getHeightAt(localX, localY, chunkSize);
        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;
        const depth = seaLevel - height;

        const waterMaterial = this.worldConfig.materialsList[this.worldConfig.materialIndex["water"]];

        const pxWaterData: PixelWaterData = {
            hasWater: true,
            waterLevel,
            depth,
            material: waterMaterial
        }

        return pxWaterData;
    }
    //
    // #endregion

    // #region [ Baking ]
    //
    /**
     * Bakes all generated cells into chunks.
     */
    private async bakeChunksFromCells(params: CellData): Promise<void> {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size; // Get the chunk size from the config
        const allWorldLayers = this.worldConfig.worldLayerList;

        this.worldBuffer = params; // Save worldData for streaming

        if (!params.worldHeightData || !params.worldPixelData || !params.worldWaterData) return; // Return if you don't have the data

        // Determine how many chunks needed to fill world
        const chunksX = Math.ceil(WORLD.WIDTH / chunkSize);
        const chunksY = Math.ceil(WORLD.HEIGHT / chunkSize);
        const totalChunks = chunksX * chunksY;

        const cellSize = this.worldConfig.worldgenParams.general.cell.size; // Get cell size from config

        // Check how many cells there are filling the world
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);

        const startMessage = this.worldConfig.getWorldgenMessage("bakeStart");
        const secondMessage = this.worldConfig.getWorldgenMessage("bakeHalf");

        await this.utility.yield(startMessage);

        // === sort chunks by distance to player spawn ===
        const spawn = {
            x: this.playerState.myPlayer.transform.pos.x,
            y: this.playerState.myPlayer.transform.pos.y
        };
        const chunkCoords: { cx: number; cy: number; dist: number }[] = [];

        for (let cx = 0; cx < chunksX; cx++) {
            for (let cy = 0; cy < chunksY; cy++) {
                const centerX = (cx + 0.5) * chunkSize;
                const centerY = (cy + 0.5) * chunkSize;
                const dx = centerX - spawn.x;
                const dy = centerY - spawn.y;
                chunkCoords.push({ cx, cy, dist: Math.sqrt(dx * dx + dy * dy) });
            }
        }
        chunkCoords.sort((a, b) => a.dist - b.dist);

        // === iterate sorted chunks ===
        const progressMessagePoint = Math.floor(totalChunks * 0.25);
        const halfwayPoint = Math.floor(totalChunks * 0.5);

        for (let i = 0; i < chunkCoords.length; i++) {
            const { cx, cy } = chunkCoords[i];

            if (i === progressMessagePoint) {
                await this.utility.yield(secondMessage);
            }

            if (i === halfwayPoint) {
                this.chunkBuffer = chunkCoords.slice(i).map(c => ({ cx: c.cx, cy: c.cy, loaded: false })); // Store remaining chunks for streaming later

                this.isGenerated = true;
                this.hideLoadingMenu();
                console.log(`Returned early after ${i}/${totalChunks} chunks baked. Buffered ${this.chunkBuffer.length} chunks for streaming.`);
                this.dumpChunkBuffer(); // Load all remaining chunks
                return;
            }
            else {
                await this.utility.yield();
            }

            // === keep all your existing chunk-baking code ===
            const chunkPixels = new Uint8Array(chunkSize * chunkSize);
            const chunkHeights = new Uint8Array(chunkSize * chunkSize);
            const chunkWater = new Uint8Array(chunkSize * chunkSize);

            for (let y = 0; y < chunkSize; y++) {
                for (let x = 0; x < chunkSize; x++) {
                    const worldX = cx * chunkSize + x;
                    const worldY = cy * chunkSize + y;
                    if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                    const gi = worldY * WORLD.WIDTH + worldX;
                    const li = y * chunkSize + x;

                    chunkPixels[li] = params.worldPixelData[gi];
                    chunkHeights[li] = params.worldHeightData[gi];
                    chunkWater[li] = params.worldWaterData[gi];
                }
            }

            const layerCounts: Record<number, number> = {};
            const startCellX = Math.floor((cx * chunkSize) / cellSize);
            const endCellX = Math.floor(((cx + 1) * chunkSize - 1) / cellSize);
            const startCellY = Math.floor((cy * chunkSize) / cellSize);
            const endCellY = Math.floor(((cy + 1) * chunkSize - 1) / cellSize);

            for (let cby = startCellY; cby <= endCellY; cby++) {
                if (cby < 0 || cby >= cellsY) continue;
                for (let cbx = startCellX; cbx <= endCellX; cbx++) {
                    if (cbx < 0 || cbx >= cellsX) continue;
                    if (!params.cellLayerGrid) continue;

                    const idx = params.cellLayerGrid[cby][cbx];
                    layerCounts[idx] = (layerCounts[idx] || 0) + 1;
                }
            }

            let dominantIdx = 0, max = -1;
            for (const k in layerCounts) {
                const c = layerCounts[k as any];
                if (c > max) { max = c; dominantIdx = parseInt(k, 10); }
            }

            const dominantLayer = allWorldLayers[dominantIdx] || allWorldLayers[0];

            const worldChunk = new WorldChunk(
                dominantLayer.name,
                chunkPixels,
                chunkHeights,
                chunkWater,
                this.worldConfig
            );

            // Ensure row arrays exist
            if (!this.chunks[cx]) this.chunks[cx] = [];
            if (!this.chunkLayers[cx]) this.chunkLayers[cx] = [];

            // Assign into 2D grid
            this.chunks[cx][cy] = worldChunk;
            this.chunkLayers[cx][cy] = dominantLayer;

            // Render the chunk
            this.renderChunk(cx, cy, worldChunk);

        }
    }

    /**
     * Bakes and classifies chunks as regions for metadata and logic.
     */
    private bakeRegionsFromChunks(): void {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const chunksX = Math.ceil(WORLD.WIDTH / chunkSize);
        const chunksY = Math.ceil(WORLD.HEIGHT / chunkSize);

        const visited = new Set<string>();
        let regionId = 0;
        this.regions = [];
        const classifyRegion = (layerName: string, waterRatio: number): RegionName | null => {
            if (waterRatio >= 0.9) return "ocean";
            if (waterRatio > 0 && waterRatio < 0.9 && ["alluvium", "sediment"].includes(layerName)) return "shore";
            if (layerName === "colluvium") return "cliffs";
            if (["summit"].includes(layerName)) return "mountains";
            if (["soil", "topsoil", "substrate", "foundation"].includes(layerName)) return "plains";
            return null; // explicitly unclassified (handled in fill pass)
        };

        const chunkToRegion: (RegionName | null)[][] = Array.from({ length: chunksY }, () =>
            Array.from({ length: chunksX }, () => null)
        );

        // === Initial region baking ===
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                const key = `${cx},${cy}`;
                if (visited.has(key)) continue;

                const layer = this.getChunkLayer(cx, cy);
                if (!layer) continue;

                // Flood-fill contiguous same-layer chunks
                const regionChunks: { cx: number; cy: number }[] = [];
                const queue = [{ cx, cy }];

                while (queue.length > 0) {
                    const { cx: qx, cy: qy } = queue.shift()!;
                    const qKey = `${qx},${qy}`;
                    if (visited.has(qKey)) continue;
                    visited.add(qKey);

                    const currentLayer = this.getChunkLayer(qx, qy);
                    if (!currentLayer || currentLayer.name !== layer.name) continue;

                    regionChunks.push({ cx: qx, cy: qy });

                    const neighbors = [
                        { cx: qx - 1, cy: qy },
                        { cx: qx + 1, cy: qy },
                        { cx: qx, cy: qy - 1 },
                        { cx: qx, cy: qy + 1 }
                    ];

                    for (const n of neighbors) {
                        if (
                            n.cx >= 0 &&
                            n.cx < chunksX &&
                            n.cy >= 0 &&
                            n.cy < chunksY &&
                            !visited.has(`${n.cx},${n.cy}`)
                        ) {
                            queue.push(n);
                        }
                    }
                }

                if (regionChunks.length <= 5) continue;

                // Compute average water ratio
                let totalWater = 0;
                let totalPixels = 0;
                for (const { cx: rcx, cy: rcy } of regionChunks) {
                    const chunk = this.chunks[rcx]?.[rcy];
                    if (!chunk) continue;

                    for (let y = 0; y < chunkSize; y++) {
                        for (let x = 0; x < chunkSize; x++) {
                            totalWater += chunk.getWaterAt(x, y, chunkSize) > 0 ? 1 : 0;
                            totalPixels++;
                        }
                    }
                }
                const waterRatio = totalPixels > 0 ? totalWater / totalPixels : 0;

                const regionName = classifyRegion(layer.name, waterRatio);
                if (!regionName) continue; // unclassified — will be fixed later

                const minX = Math.min(...regionChunks.map(c => c.cx));
                const maxX = Math.max(...regionChunks.map(c => c.cx));
                const minY = Math.min(...regionChunks.map(c => c.cy));
                const maxY = Math.max(...regionChunks.map(c => c.cy));

                this.regions.push({
                    id: regionId++,
                    name: regionName,
                    layerName: layer.name,
                    bounds: { minX, minY, maxX, maxY },
                    chunkCoords: regionChunks,
                    area: regionChunks.length
                });

                // Store in map
                for (const c of regionChunks) chunkToRegion[c.cy][c.cx] = regionName;
            }
        }

        // === FINAL FILL PASS ===
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                if (chunkToRegion[cy][cx] !== null) continue;

                // Find nearest classified chunk (simple expanding radius search)
                let nearest: RegionName | null = null;
                let radius = 1;
                while (!nearest && radius < Math.max(chunksX, chunksY)) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = cx + dx;
                            const ny = cy + dy;
                            if (
                                nx < 0 ||
                                ny < 0 ||
                                nx >= chunksX ||
                                ny >= chunksY
                            )
                                continue;

                            const candidate = chunkToRegion[ny][nx];
                            if (candidate) {
                                nearest = candidate;
                                break;
                            }
                        }
                        if (nearest) break;
                    }
                    radius++;
                }

                if (nearest) chunkToRegion[cy][cx] = nearest;
                else chunkToRegion[cy][cx] = "plains"; // never happens in practice
            }
        }

        // === Rebuild regions from final map ===
        this.regions = [];
        visited.clear();
        regionId = 0;

        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                const assigned = chunkToRegion[cy][cx];
                if (!assigned || visited.has(`${cx},${cy}`)) continue;

                // Flood-fill new merged regions
                const regionChunks: { cx: number; cy: number }[] = [];
                const queue = [{ cx, cy }];
                while (queue.length > 0) {
                    const { cx: qx, cy: qy } = queue.shift()!;
                    const key = `${qx},${qy}`;
                    if (visited.has(key)) continue;
                    if (chunkToRegion[qy][qx] !== assigned) continue;
                    visited.add(key);
                    regionChunks.push({ cx: qx, cy: qy });

                    const neighbors = [
                        { cx: qx - 1, cy: qy },
                        { cx: qx + 1, cy: qy },
                        { cx: qx, cy: qy - 1 },
                        { cx: qx, cy: qy + 1 }
                    ];
                    for (const n of neighbors) {
                        if (
                            n.cx >= 0 &&
                            n.cx < chunksX &&
                            n.cy >= 0 &&
                            n.cy < chunksY &&
                            !visited.has(`${n.cx},${n.cy}`)
                        ) {
                            queue.push(n);
                        }
                    }
                }

                const minX = Math.min(...regionChunks.map(c => c.cx));
                const maxX = Math.max(...regionChunks.map(c => c.cx));
                const minY = Math.min(...regionChunks.map(c => c.cy));
                const maxY = Math.max(...regionChunks.map(c => c.cy));

                this.regions.push({
                    id: regionId++,
                    name: assigned,
                    layerName: assigned,
                    bounds: { minX, minY, maxX, maxY },
                    chunkCoords: regionChunks,
                    area: regionChunks.length
                });
            }
        }

        console.log(`🗺️ Regions baked + filled: ${this.regions.length}`);
        this.regions.forEach(r => {
            const w = (r.bounds.maxX - r.bounds.minX + 1) * chunkSize;
            const h = (r.bounds.maxY - r.bounds.minY + 1) * chunkSize;
            console.log(
                `  • ${r.name.padEnd(10)} | ${String(r.area).padStart(3)} chunks | ${w}×${h}px`
            );
        });

        this.generateAudioZones();
    }
    //
    // #endregion

    // #region [ Rendering ]
    //
    /**
     * Renders the world to the world canvas within the camera bounds.
     */
    public drawWorld(): void {
        if (!this.ui.ctx || !this.ui.worldCanvas || !this.ui.liquidCanvas || !this.isGenerated) return;

        const cam = this.camera.pos;

        this.ui.ctx.drawImage(
            this.ui.worldCanvas,
            cam.x, cam.y,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT,
            0, 0,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT
        );

        this.ui.ctx.drawImage(
            this.ui.liquidCanvas,
            cam.x, cam.y,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT,
            0, 0,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT
        );
    }

    /**
     * Renders a single chunk onto the world canvas.
     * 
     * For each pixel in this chunk:
     * - get its base material color
     * - apply noise using detailNoiseScale
     * - draw it to the world canvas at its world position
     */
    public renderChunk(cx: number, cy: number, chunk: WorldChunk): void {
        if (!this.ui.worldCtx) return;

        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const startX = cx * chunkSize, startY = cy * chunkSize;

        for (let y = 0; y < chunkSize; y++) {
            for (let x = 0; x < chunkSize; x++) {
                const worldX = startX + x, worldY = startY + y;
                if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                const baseColor = chunk.getColorAt(x, y, chunkSize);
                const detailNoise = this.utility.getNoise( // Sample noise to slightly vary brightness/saturation
                    this.worldConfig.worldgenParams.material.detail.noiseType,
                    worldX * this.worldConfig.worldgenParams.material.detail.scale,
                    worldY * this.worldConfig.worldgenParams.material.detail.scale,
                    this.currentSeed + 3000,
                    {
                        octaves: this.worldConfig.worldgenParams.terrain.octaves,
                        persistence: this.worldConfig.worldgenParams.terrain.persistence
                    }
                );
                const finalColor = this.adjustPixelColor(baseColor, detailNoise);

                this.ui.worldCtx.fillStyle = finalColor;
                this.ui.worldCtx.fillRect(worldX, worldY, 1, 1);
            }
        }

        this.renderWater(cx, cy, chunk);
    }

    /**
     * Renders water with the render.water params.
     * 
     * Uses getHeightAt and getWaterAt to create pixel perfect water render.
     */
    private renderWater(cx: number, cy: number, chunk: WorldChunk): void {
        if (!this.ui.liquidCtx) return;

        const ctx = this.ui.liquidCtx;
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const startX = cx * chunkSize;
        const startY = cy * chunkSize;
        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;

        const w = this.worldConfig.worldgenParams.render.water; // hydration config reference
        const waterMat = this.worldConfig.materialsList[this.worldConfig.materialIndex.water];
        const palette = waterMat.colors;

        const seed = this.currentSeed + 9100;
        const noiseScale = w.noiseScale;
        const foamScale = w.foamScale;
        const shoreBlend = w.shoreBlend;

        for (let y = 0; y < chunkSize; y++) {
            for (let x = 0; x < chunkSize; x++) {
                const worldX = startX + x;
                const worldY = startY + y;
                if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                const height = chunk.getHeightAt(x, y, chunkSize);
                const waterLevel = chunk.getWaterAt(x, y, chunkSize);

                if (waterLevel <= 0) continue;

                const depth = seaLevel - height;
                const depthRatio = Math.max(0, Math.min(1, depth / seaLevel));

                // flip logic: shallow = bright, deep = dark
                const baseIdx = Math.floor((1 - depthRatio) * (palette.length - 1));
                const baseColor = palette[baseIdx];
                const r = parseInt(baseColor.slice(1, 3), 16);
                const g = parseInt(baseColor.slice(3, 5), 16);
                const b = parseInt(baseColor.slice(5, 7), 16);

                // wave shimmer
                const waveNoise = this.utility.getNoise(
                    NoiseType.Perlin,
                    worldX * noiseScale,
                    worldY * noiseScale,
                    seed,
                    { octaves: 4, persistence: 0.55 }
                );

                // ridge pattern for foam + wave edges
                const ridge = this.utility.getNoise(
                    NoiseType.Ridged,
                    worldX * foamScale,
                    worldY * foamScale,
                    seed + 3000,
                    { octaves: 2, persistence: 0.5 }
                );

                // shoreline foam — invert so it appears near land
                let foam = 0;
                if (height > seaLevel - shoreBlend) {
                    const t = (seaLevel - height) / shoreBlend;
                    foam = this.utility.smoothstep(1 - Math.max(0, Math.min(1, t))) * ridge * w.foamIntensity;
                }

                // depth-based shading (dark in deep)
                const darkness = 1 - (depthRatio * w.depthDarkness);
                const shade = (0.5 + (1 - depthRatio) * 0.5 + waveNoise * w.shimmerStrength) * darkness;
                const scatter = 0.25 + waveNoise * 0.25;

                const dr = Math.max(0, Math.min(255, r * shade + 200 * foam + 30 * scatter));
                const dg = Math.max(0, Math.min(255, g * shade + 220 * foam + 50 * scatter));
                const db = Math.max(0, Math.min(255, b * shade + 255 * foam + 60 * scatter));

                // opacity from config
                const alpha = Math.min(1, w.opacityBase + depthRatio * w.opacityMultiplier);

                ctx.fillStyle = `rgba(${dr},${dg},${db},${alpha})`;
                ctx.fillRect(worldX, worldY, 1, 1);
            }
        }
    }

    /**
     * Changes a pixel's color based on noise.
     * 
     * Uses the colorVariation from the config to adjust the brightness.
     */
    private adjustPixelColor(hexColor: string, noise: number): string {
        const variation = this.worldConfig.worldgenParams.material.colorVariation;

        // Brightness multiplier:
        // noise = 0.5 => factor ~1.0 (no change)
        // noise < 0.5 => darker
        // noise > 0.5 => brighter
        const factor = 1 + (noise - 0.5) * variation;

        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        const nr = Math.max(0, Math.min(255, Math.floor(r * factor)));
        const ng = Math.max(0, Math.min(255, Math.floor(g * factor)));
        const nb = Math.max(0, Math.min(255, Math.floor(b * factor)));

        return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    }
    //
    // #endregion

    // #region [ Runtime Helpers ]
    //
    /**
     * Gets the material property of a pixel at runtime.
     */
    public getMaterialAt(x: number, y: number): Material | null {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(x / chunkSize), cy = Math.floor(y / chunkSize);

        const chunk = this.chunks[cx]?.[cy];
        if (!chunk) return null;

        const localX = x - cx * chunkSize;
        const localY = y - cy * chunkSize;
        const idx = localY * chunkSize + localX;
        const combined = chunk.pixelData[idx];
        const materialIndex = combined >> 2;

        return this.worldConfig.materialsList[materialIndex] || null;
    }

    /**
     * Gets the height of a specific pixel at coordinates.
     */
    public getHeightAt(x: number, y: number): number | null {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(x / chunkSize), cy = Math.floor(y / chunkSize);

        const chunk = this.chunks[cx]?.[cy];
        if (!chunk) return null;

        if (!chunk) return null;

        const localX = x - cx * chunkSize;
        const localY = y - cy * chunkSize;

        return chunk.getHeightAt(localX, localY, chunkSize);
    }

    /**
     * Gets the physics properties of a pixel.
     */
    public getPhysicsAt(x: number, y: number) {
        const mat = this.getMaterialAt(x, y);
        return mat ? mat.physics : null;
    }

    /**
     * Gets the stored or calculated primary layer for a chunk.
     */
    public getChunkLayer(cx: number, cy: number): WorldLayer | null {
        return this.chunkLayers[cx]?.[cy] || null;
    }

    /**
     * Calculates the world and chunk coordinates based on the mouse position from ControlsManager.
     */
    public updateHoveredChunk(): { worldX: number; worldY: number } | null {
        const mousePos = this.controlsManager.getMousePos();
        const worldX = mousePos.x + this.camera.pos.x;
        const worldY = mousePos.y + this.camera.pos.y;

        if (worldX < 0 || worldX >= WORLD.WIDTH || worldY < 0 || worldY >= WORLD.HEIGHT) {
            this.worldDebug.hoveredChunk = null;
            return null;
        }

        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(worldX / chunkSize);
        const cy = Math.floor(worldY / chunkSize);
        this.worldDebug.hoveredChunk = { cx, cy };

        return { worldX, worldY };
    }

    /**
     * Determines the total steps needed for a full load based on the amount of chunks and the worldgen phases.
     * 
     * This is purely a loading helper.
     */
    private totalYieldSteps(): number {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;

        const chunksX = Math.ceil(WORLD.WIDTH / chunkSize);
        const chunksY = Math.ceil(WORLD.HEIGHT / chunkSize);
        const totalChunks = chunksX * chunksY;

        const bakedChunks = Math.floor(totalChunks * 0.5);

        return (this.YIELD_RATE * this.WORLDGEN_PHASES.length) + bakedChunks;
    }
    //
    // #endregion

    // #region [ Menus ]
    //
    /**
     * Builds and displays the worldgen menu.
     */
    private async worldgenMenu(): Promise<{ mode: "generate" | "load", file?: File }> {
        return new Promise(resolve => {
            const container = document.createElement("div");
            container.className = "config_popup_container";

            const header = document.createElement("h3");
            header.textContent = 'World Generation Config';

            const popup = document.createElement("div");
            popup.className = "config_popup";

            const form = document.createElement("form");

            // Helper to create noise type dropdown
            const noiseTypeOptions = Object.values(NoiseType).map(type =>
                `<option value="${type}" ${this.worldConfig.worldgenParams.terrain.noiseType === type ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`
            ).join('');

            form.innerHTML = `
            <!-- GENERAL -->
            <fieldset id="generalFieldset">
                <legend>General</legend>
                <div class="form_grid">
                    <label id="seedLabel">
                        <span>Seed:</span>
                        <input type="text" name="general.seed" placeholder="enter seed or leave blank...">
                    </label>
                    <div id="generalFormDiv">
                        <label>
                            <span>Chunk Size (px):</span>
                            <input type="number" name="general.chunk.size" value="${this.worldConfig.worldgenParams.general.chunk.size}" min="1" step="1">
                        </label>
                        <label>
                            <span>Cell Size (px):</span>
                            <input type="number" name="general.cell.size" value="${this.worldConfig.worldgenParams.general.cell.size}" min="1" step="1">
                        </label>
                    </div>
                </div>
            </fieldset>

            <!-- TERRAIN -->
            <fieldset id="terrainFieldset">
                <legend>Terrain</legend>
                <div class="form_grid">
                    <label>
                        <span>Noise Type:</span>
                        <select name="terrain.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="terrain.scale" value="${this.worldConfig.worldgenParams.terrain.scale}" step="any">
                    </label>
                    <label>
                        <span>Intensity:</span>
                        <input type="number" name="terrain.intensity" value="${this.worldConfig.worldgenParams.terrain.intensity}" step="any" min="0">
                    </label>
                    <label>
                        <span>Octaves:</span>
                        <input type="number" name="terrain.octaves" value="${this.worldConfig.worldgenParams.terrain.octaves}" min="1" max="12" step="1">
                    </label>
                    <label>
                        <span>Persistence:</span>
                        <input type="number" name="terrain.persistence" value="${this.worldConfig.worldgenParams.terrain.persistence}" step="any" min="0" max="1">
                    </label>
                    <label>
                        <span>Height Curve:</span>
                        <input type="number" name="terrain.heightCurve" value="${this.worldConfig.worldgenParams.terrain.heightCurve}" step="any" min="0.1">
                    </label>
                    <label>
                        <span>Sea Level:</span>
                        <input type="number" name="terrain.seaLevel" value="${this.worldConfig.worldgenParams.terrain.seaLevel}" step="any" min="0" max="1">
                    </label>
                    <label>
                        <span>Lowest Depth:</span>
                        <input type="number" name="terrain.lowestDepth" value="${this.worldConfig.worldgenParams.terrain.lowestDepth}" step="any" min="0" max="1">
                    </label>
                </div>
            </fieldset>

            <!-- MATERIALS -->
            <fieldset id="materialsFieldset">
                <legend>Materials</legend>
                <div class="form_grid">
                    <label>
                        <span>Noise Type:</span>
                        <select name="material.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="material.scale" value="${this.worldConfig.worldgenParams.material.scale}" step="any">
                    </label>
                    <label>
                        <span>Color Variation:</span>
                        <input type="number" name="material.colorVariation" value="${this.worldConfig.worldgenParams.material.colorVariation}" step="any" min="0" max="1">
                    </label>
                </div>
                <div class="form_grid form_grid_detail">
                <h4>Detail</h4>
                    <label>
                        <span>Noise Type:</span>
                        <select name="material.detail.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="material.detail.scale" value="${this.worldConfig.worldgenParams.material.detail.scale}" step="any">
                    </label>
                </div>
            </fieldset>

            <!-- DEGENERATION -->
            <fieldset id="degenerationFieldset">
                <legend>Degeneration</legend>
                <div class="form_grid">
                    <label>
                        <span>Noise Type:</span>
                        <select name="degen.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="degen.scale" value="${this.worldConfig.worldgenParams.degen.scale}" step="any" min="0">
                    </label>
                    <label>
                        <span>Intensity:</span>
                        <input type="number" name="degen.intensity" value="${this.worldConfig.worldgenParams.degen.intensity}" step="any" min="0" max="2">
                    </label>
                    <label>
                        <span>Min Height:</span>
                        <input type="number" name="degen.minHeight" value="${this.worldConfig.worldgenParams.degen.minHeight}" step="any" min="0" max="1">
                    </label>
                    <label>
                        <span>Threshold:</span>
                        <input type="number" name="degen.threshold" value="${this.worldConfig.worldgenParams.degen.threshold}" step="any" min="0" max="1">
                    </label>
                    <label>
                        <span>Hardness:</span>
                        <input type="number" name="degen.hardness" value="${this.worldConfig.worldgenParams.degen.hardness}" step="any" min="0" max="1">
                    </label>
                </div>
                <div class="form_grid form_grid_detail">
                <h4>Detail</h4>
                    <label>
                        <span>Noise Type:</span>
                        <select name="degen.detail.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="degen.detail.scale" value="${this.worldConfig.worldgenParams.degen.detail.scale}" step="any" min="0">
                    </label>
                </div>
            </fieldset>

            <!-- HYDRATION
            <fieldset id="hydrationFieldset">
                <legend>Hydration</legend>
                <div class="form_grid">
                    <label>
                        <span>Noise Type:</span>
                        <select name="hydration.noiseType">${noiseTypeOptions}</select>
                    </label>
                    <label>
                        <span>Scale:</span>
                        <input type="number" name="hydration.scale" value="${this.worldConfig.worldgenParams.hydration.scale}" step="any" min="0">
                    </label>
                    <label>
                        <span>Intensity:</span>
                        <input type="number" name="hydration.intensity" value="${this.worldConfig.worldgenParams.hydration.intensity}" step="any" min="0" max="5">
                    </label>
                    <label>
                        <span>Multiplier:</span>
                        <input type="number" name="hydration.multiplier" value="${this.worldConfig.worldgenParams.hydration.multiplier}" step="any" min="0" max="10">
                    </label>
                </div>
            </fieldset> -->

            <div class="form_submit">
                <button type="submit">Generate (Enter)</button>
                <input id="loadWorldInput" type="file" accept=".json" style="display:none">
                <button type="button" id="loadWorldButton">Load Saved World</button>
            </div>
            `;

            const loadButton = form.querySelector("#loadWorldButton") as HTMLButtonElement;
            const fileInput = form.querySelector("#loadWorldInput") as HTMLInputElement;

            loadButton.onclick = () => fileInput.click();

            fileInput.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                document.body.removeChild(container);
                resolve({ mode: "load", file });
            };

            form.onsubmit = e => {
                e.preventDefault();
                const fd = new FormData(form);

                const num = (key: string) => parseFloat(fd.get(key) as string);
                const int = (key: string) => parseInt(fd.get(key) as string);

                // --- General ---
                this.worldConfig.worldgenParams.general.chunk.size = int("general.chunk.size");
                this.worldConfig.worldgenParams.general.cell.size = int("general.cell.size");
                this.worldConfig.worldgenParams.general.seed = int("general.seed");

                // --- Terrain ---
                this.worldConfig.worldgenParams.terrain.noiseType = fd.get("terrain.noiseType") as NoiseType;
                this.worldConfig.worldgenParams.terrain.scale = num("terrain.scale");
                this.worldConfig.worldgenParams.terrain.intensity = num("terrain.intensity");
                this.worldConfig.worldgenParams.terrain.octaves = int("terrain.octaves");
                this.worldConfig.worldgenParams.terrain.persistence = num("terrain.persistence");
                this.worldConfig.worldgenParams.terrain.heightCurve = num("terrain.heightCurve");
                this.worldConfig.worldgenParams.terrain.seaLevel = num("terrain.seaLevel");
                this.worldConfig.worldgenParams.terrain.lowestDepth = num("terrain.lowestDepth");

                // --- Materials ---
                this.worldConfig.worldgenParams.material.noiseType = fd.get("material.noiseType") as NoiseType;
                this.worldConfig.worldgenParams.material.scale = num("material.scale");
                this.worldConfig.worldgenParams.material.colorVariation = num("material.colorVariation");
                this.worldConfig.worldgenParams.material.detail.noiseType = fd.get("material.detail.noiseType") as NoiseType;
                this.worldConfig.worldgenParams.material.detail.scale = num("material.detail.scale");

                // --- Degeneration ---
                this.worldConfig.worldgenParams.degen.noiseType = fd.get("degen.noiseType") as NoiseType;
                this.worldConfig.worldgenParams.degen.scale = num("degen.scale");
                this.worldConfig.worldgenParams.degen.intensity = num("degen.intensity");
                this.worldConfig.worldgenParams.degen.minHeight = num("degen.minHeight");
                this.worldConfig.worldgenParams.degen.threshold = num("degen.threshold");
                this.worldConfig.worldgenParams.degen.hardness = num("degen.hardness");
                this.worldConfig.worldgenParams.degen.detail.noiseType = fd.get("degen.detail.noiseType") as NoiseType;
                this.worldConfig.worldgenParams.degen.detail.scale = num("degen.detail.scale");

                // --- Hydration ---
                // this.worldConfig.worldgenParams.hydration.noiseType = fd.get("hydration.noiseType") as NoiseType;
                // this.worldConfig.worldgenParams.hydration.scale = num("hydration.scale");
                // this.worldConfig.worldgenParams.hydration.intensity = num("hydration.intensity");
                // this.worldConfig.worldgenParams.hydration.multiplier = num("hydration.multiplier");

                document.body.removeChild(container);
                resolve({ mode: "generate" });
            };

            popup.appendChild(form);
            container.appendChild(header);
            container.appendChild(popup);
            document.body.appendChild(container);
            (form.querySelector("input") as HTMLInputElement)?.focus();
        });
    }

    /**
     * Builds and displays the rendering menu.
     */
    public async renderMenu(): Promise<void> {
        return new Promise(resolve => {
            const popup = document.createElement("div");
            popup.className = "config_popup";
            const form = document.createElement("form");

            const w = this.worldConfig.worldgenParams.render.water;

            form.innerHTML = `
            <h3>Render Config</h3>

            <fieldset>
                <legend>Water Rendering</legend>
                <div class="form_grid">
                    <label><span>Base Opacity:</span>
                        <input type="number" name="opacityBase" value="${w.opacityBase}" step="any" min="0" max="1">
                    </label>
                    <label><span>Opacity Multiplier:</span>
                        <input type="number" name="opacityMultiplier" value="${w.opacityMultiplier}" step="any" min="0" max="2">
                    </label>
                    <label><span>Foam Intensity:</span>
                        <input type="number" name="foamIntensity" value="${w.foamIntensity}" step="any" min="0" max="2">
                    </label>
                    <label><span>Foam Scale:</span>
                        <input type="number" name="foamScale" value="${w.foamScale}" step="any" min="0">
                    </label>
                    <label><span>Noise Scale:</span>
                        <input type="number" name="noiseScale" value="${w.noiseScale}" step="any" min="0">
                    </label>
                    <label><span>Shore Blend:</span>
                        <input type="number" name="shoreBlend" value="${w.shoreBlend}" step="any" min="0" max="1">
                    </label>
                    <label><span>Shimmer Strength:</span>
                        <input type="number" name="shimmerStrength" value="${w.shimmerStrength}" step="any" min="0" max="1">
                    </label>
                    <label><span>Depth Darkness:</span>
                        <input type="number" name="depthDarkness" value="${w.depthDarkness}" step="any" min="0" max="2">
                    </label>
                </div>
            </fieldset>

            <div class="form_submit">
                <button type="submit">Apply (Enter)</button>
            </div>
            `;

            form.onsubmit = e => {
                e.preventDefault();
                const fd = new FormData(form);
                const num = (key: string) => parseFloat(fd.get(key) as string);

                // Update render params directly
                w.opacityBase = num("opacityBase");
                w.opacityMultiplier = num("opacityMultiplier");
                w.foamIntensity = num("foamIntensity");
                w.foamScale = num("foamScale");
                w.noiseScale = num("noiseScale");
                w.shoreBlend = num("shoreBlend");
                w.shimmerStrength = num("shimmerStrength");
                w.depthDarkness = num("depthDarkness");

                // 🔁 FULL RE-RENDER ONLY
                console.log("🎨 Re-rendering world (no regeneration)...");

                if (this.ui.worldCtx) {
                    this.ui.worldCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
                }

                for (let cx = 0; cx < this.chunks.length; cx++) {
                    const col = this.chunks[cx];
                    if (!col) continue;

                    for (let cy = 0; cy < col.length; cy++) {
                        const chunk = col[cy];
                        if (!chunk) continue;

                        this.renderChunk(cx, cy, chunk);
                    }
                }

                document.body.removeChild(popup);
                resolve();
            };

            popup.appendChild(form);
            document.body.appendChild(popup);
            (form.querySelector("input") as HTMLInputElement)?.focus();
        });
    }

    /**
     * Shows the loading menu during worldgen process.
     */
    public showLoadingMenu(): void {
        const existing = document.getElementById("worldLoadingMenu");
        if (existing) existing.remove(); // Remove old if exists

        const menu = document.createElement("div");
        menu.id = "worldLoadingMenu";
        menu.innerHTML = `
        <div class="loading_wrapper">
            <span id="loadingMessage">Initializing world...</span>
            <div class="loading_bar">
                <div id="loadingBarFill"></div>
            </div>
        </div>
        `;

        document.body.appendChild(menu);
    }

    /**
     * Hides the loading menu once the worldgen process is completed.
     */
    private hideLoadingMenu(): void {
        const loadingMenu = document.getElementById("worldLoadingMenu");
        if (!loadingMenu) return;

        loadingMenu.style.opacity = "0"; // fade-out (optional)
        setTimeout(() => loadingMenu.remove(), 300); // remove after fade
    }

    //
    // #endregion

    // #region [ Chunk Management ]
    //
    /**
     * Processes all chunk updates. Optionally patches a chunk to reflect the newest partial update.
     */
    public handleChunkUpdate(remoteChunk: NetworkChunk): void {
        if (!remoteChunk || !remoteChunk.pos) return;

        if ((remoteChunk as any).patches) {
            this.handleChunkPatch(remoteChunk);
            return;
        }

        const cx = remoteChunk.pos.x;
        const cy = remoteChunk.pos.y;

        const existing = this.chunks[cx]?.[cy];

        // Only update if it's new or newer
        if (existing && (remoteChunk.version ?? 0) <= existing.version) return;

        // Convert NetworkChunk → WorldChunk
        const newChunk = new WorldChunk(
            remoteChunk.layer,
            remoteChunk.cellData.worldPixelData,
            remoteChunk.cellData.worldHeightData,
            remoteChunk.cellData.worldWaterData!,
            this.worldConfig
        );

        newChunk.version = remoteChunk.version;
        newChunk.pos = remoteChunk.pos;
        newChunk.size = remoteChunk.size;

        if (!this.chunks[cx]) this.chunks[cx] = [];
        this.chunks[cx][cy] = newChunk;

        if (!this.chunkLayers[cx]) this.chunkLayers[cx] = [];

        const idx = this.worldConfig.worldLayerIndex[remoteChunk.layer];

        this.chunkLayers[cx][cy] =
            idx !== undefined
                ? this.worldConfig.worldLayerList[idx]
                : this.worldConfig.worldLayerList[0];

        this.renderChunk(cx, cy, newChunk);
    }

    /**
     * Processes partial chunk updates and changes.
     */
    private handleChunkPatch(remoteChunk: any): void {
        const cx = remoteChunk.pos.x;
        const cy = remoteChunk.pos.y;

        const chunk = this.chunks[cx]?.[cy];
        if (!chunk || !remoteChunk.patches) return;

        const ctx = this.ui.worldCtx;
        if (!ctx) return;

        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const startX = remoteChunk.pos.x * chunkSize;
        const startY = remoteChunk.pos.y * chunkSize;

        for (const patch of remoteChunk.patches) {
            const i = patch.i;

            // Update the pixel, height and water data
            if (typeof patch.pixel !== "undefined") {
                chunk.pixelData[i] = patch.pixel;
            }
            if (typeof patch.height !== "undefined") {
                chunk.heightData[i] = patch.height;
            }
            if (chunk.waterData && typeof patch.water !== "undefined") {
                chunk.waterData[i] = patch.water;
            }

            // Compute world-space pixel coordinates
            const localX = i % chunkSize;
            const localY = Math.floor(i / chunkSize);
            const worldX = startX + localX;
            const worldY = startY + localY;

            // Draw updated pixel
            const baseColor = chunk.getColorAt(localX, localY, chunkSize);
            const detailNoise = this.utility.getNoise(
                this.worldConfig.worldgenParams.material.detail.noiseType,
                worldX * this.worldConfig.worldgenParams.material.detail.scale,
                worldY * this.worldConfig.worldgenParams.material.detail.scale,
                this.currentSeed + 3000,
                {
                    octaves: this.worldConfig.worldgenParams.terrain.octaves,
                    persistence: this.worldConfig.worldgenParams.terrain.persistence
                }
            );
            const finalColor = this.adjustPixelColor(baseColor, detailNoise);

            ctx.fillStyle = finalColor;
            ctx.fillRect(worldX, worldY, 1, 1);
        }
        // console.log(`Patched ${remoteChunk.patches.length} pixels in chunk ${key}`);
    }

    /**
     * Immediately streams all pending chunks to the user.
     * 
     * This can be called to dump any unloaded chunks at a maximum of 1 per frame. 
     */
    public async dumpChunkBuffer(): Promise<void> {
        console.log("Starting background chunk streaming...");

        for (let i = 0; i < this.chunkBuffer.length; i++) {
            const entry = this.chunkBuffer[i];
            if (entry.loaded) continue;

            this.loadChunk(entry.cx, entry.cy);
            entry.loaded = true;

            await this.utility.yield(); // one chunk per frame
        }

        this.chunkBuffer = [];
        this.worldBuffer = null;

        this.bakeRegionsFromChunks();
        console.log("All chunks loaded.");
    }

    /**
     * Loads a specific chunk.
     */
    private loadChunk(cx: number, cy: number): void {
        if (!this.worldBuffer || !this.worldBuffer.cellLayerGrid || !this.worldBuffer.worldWaterData) return;

        const allWorldLayers = this.worldConfig.worldLayerList;
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cellSize = this.worldConfig.worldgenParams.general.cell.size;

        const chunkPixels = new Uint8Array(chunkSize * chunkSize);
        const chunkHeights = new Uint8Array(chunkSize * chunkSize);
        const chunkWater = new Uint8Array(chunkSize * chunkSize);

        // Copy pixel/height/water data from world arrays
        for (let y = 0; y < chunkSize; y++) {
            for (let x = 0; x < chunkSize; x++) {
                const worldX = cx * chunkSize + x;
                const worldY = cy * chunkSize + y;
                if (worldX >= WORLD.WIDTH || worldY >= WORLD.HEIGHT) continue;

                const gi = worldY * WORLD.WIDTH + worldX;
                const li = y * chunkSize + x;

                chunkPixels[li] = this.worldBuffer.worldPixelData[gi];
                chunkHeights[li] = this.worldBuffer.worldHeightData[gi];
                chunkWater[li] = this.worldBuffer.worldWaterData[gi];
            }
        }

        const layerCounts: Record<number, number> = {};
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);
        const startCellX = Math.floor((cx * chunkSize) / cellSize);
        const endCellX = Math.floor(((cx + 1) * chunkSize - 1) / cellSize);
        const startCellY = Math.floor((cy * chunkSize) / cellSize);
        const endCellY = Math.floor(((cy + 1) * chunkSize - 1) / cellSize);

        for (let cby = startCellY; cby <= endCellY; cby++) {
            if (cby < 0 || cby >= cellsY) continue;
            for (let cbx = startCellX; cbx <= endCellX; cbx++) {
                if (cbx < 0 || cbx >= cellsX) continue;

                const idx = this.worldBuffer.cellLayerGrid[cby][cbx];
                layerCounts[idx] = (layerCounts[idx] || 0) + 1;
            }
        }

        let dominantIdx = 0, max = -1;
        for (const k in layerCounts) {
            const c = layerCounts[k as any];
            if (c > max) { max = c; dominantIdx = parseInt(k, 10); }
        }
        const dominantLayer = allWorldLayers[dominantIdx] || allWorldLayers[0];

        const worldChunk = new WorldChunk(dominantLayer.name, chunkPixels, chunkHeights, chunkWater, this.worldConfig);

        if (!this.chunks[cx]) this.chunks[cx] = [];
        if (!this.chunkLayers[cx]) this.chunkLayers[cx] = [];

        this.chunks[cx][cy] = worldChunk;
        this.chunkLayers[cx][cy] = dominantLayer;

        this.renderChunk(cx, cy, worldChunk);

    }

    //
    // #endregion

    // #region [ Audio Zones ]
    //

    /**
     * Creates audio zones for valid regions.
     */
    private generateAudioZones(): void {
        console.log("Generating audio zones...");

        this.regions.forEach(region => {
            const regionAudio = this.worldConfig.regionAudioParams[region.name];
            if (!regionAudio || region.area < regionAudio.minRegionSize) return;

            const ambience = this.audioConfig.resources.ambience.beds[region.name];
            if (!ambience || !ambience.length) return;

            const audioSrc = ambience[0];
            const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;

            // create one shared audio source entry
            this.regionAudioSources.set(region.id, { element: null, volume: 0 });

            const regionWidth = (region.bounds.maxX - region.bounds.minX + 1) * chunkSize;
            const regionHeight = (region.bounds.maxY - region.bounds.minY + 1) * chunkSize;

            const overlapFactor = 0.9;
            const effectiveCoverage = regionAudio.radius * 2 * overlapFactor;

            const zonesX = Math.ceil(regionWidth / effectiveCoverage);
            const zonesY = Math.ceil(regionHeight / effectiveCoverage);
            const totalZones = zonesX * zonesY;
            const maxZones = 10; // TODO: Calculate this more dynamically

            if (totalZones > maxZones) {
                console.warn(`Region ${region.name} needs ${totalZones} zones - capping at ${maxZones}.`);
            }

            let createdZones = 0;
            for (let gy = 0; gy < zonesY; gy++) {
                for (let gx = 0; gx < zonesX; gx++) {
                    if (createdZones >= maxZones) break;

                    const zoneX = region.bounds.minX * chunkSize + (gx + 0.5) * effectiveCoverage;
                    const zoneY = region.bounds.minY * chunkSize + (gy + 0.5) * effectiveCoverage;

                    const clampedX = Math.max(
                        region.bounds.minX * chunkSize,
                        Math.min(region.bounds.maxX * chunkSize + chunkSize, zoneX)
                    );
                    const clampedY = Math.max(
                        region.bounds.minY * chunkSize,
                        Math.min(region.bounds.maxY * chunkSize + chunkSize, zoneY)
                    );

                    const center: Vec2 = { x: clampedX, y: clampedY };
                    const zoneId = `${region.id}_${gx}_${gy}`;

                    this.audioZones.set(zoneId, {
                        region: region,
                        center: center,
                        audioParams: {
                            src: audioSrc,
                            listener: this.playerState.myPlayer.transform.pos,
                            loop: true,
                            output: 'sfx',
                            volume: regionAudio.volume,
                            spatial: {
                                blend: 1.0,
                                pos: center,
                                rolloff: {
                                    distance: regionAudio.radius,
                                    factor: 1.0,
                                    type: 'logarithmic'
                                }
                            }
                        },
                        isActive: false
                    });

                    createdZones++;
                }
                if (createdZones >= maxZones) break;
            }
        });

        console.log(`Generated ${this.audioZones.size} audio zones.`);
    }

    /**
     * Processes updates for regional audio zones and controls volume based on player position.
     */
    public updateAudioZones(): void {
        if (!this.playerState?.myPlayer) return;
        const playerPos = this.playerState.myPlayer.transform.pos;

        // Reset all region brain volumes
        this.regionAudioSources.forEach(brain => brain.volume = 0);

        // Each zone contributes its influence to its region brain
        this.audioZones.forEach(zone => {
            const dx = playerPos.x - zone.center.x;
            const dy = playerPos.y - zone.center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = zone.audioParams.spatial?.rolloff?.distance || 500;
            const inRange = distance < radius;

            zone.isActive = inRange;

            if (inRange) {
                const roll = zone.audioParams.spatial!.rolloff!;
                const normalized = Math.min(1, distance / roll.distance);
                const rollFactor = roll.factor > 0 ? roll.factor : 0.5;
                const factor = roll.type === 'logarithmic'
                    ? 1 - Math.pow(normalized, 0.5) * rollFactor
                    : 1 - normalized * rollFactor;

                const regionId = zone.region.id;
                const brain = this.regionAudioSources.get(regionId);
                if (brain) brain.volume = Math.max(brain.volume, factor);
            }
        });

        // Manage region audio playback based on aggregate volumes
        this.regionAudioSources.forEach((brain, regionId) => {
            const region = this.regions.find(r => r.id === regionId);
            if (!region) return;

            const regionAudio = this.worldConfig.regionAudioParams[region.name];
            if (!regionAudio) return;

            // directly scale brain.volume into region’s [min,max] range — never clamp to 1
            const targetVolume = regionAudio.volume.min +
                (regionAudio.volume.max - regionAudio.volume.min) * brain.volume;

            if (targetVolume > regionAudio.volume.min) {
                if (!brain.element) {
                    const src = this.audioConfig.resources.ambience.beds[region.name][0];
                    brain.element = this.audioManager.playAudio({
                        src,
                        loop: true,
                        output: "ambience",
                        volume: { min: regionAudio.volume.min, max: regionAudio.volume.max }
                    });
                    console.log(`Started ${region.name} ambience`);
                }
                if (brain.element) brain.element.setVolume(targetVolume);
            } else if (brain.element) {
                brain.element.stop();
                brain.element = null;
                console.log(`Stopped ${region.name} ambience`);
            }
        });
    }

    /**
    * Stops all world ambience and clears region audio references.
    */
    private cleanWorldAudio(): void {
        console.log("Clearing world ambience...");
        this.regionAudioSources.forEach((brain) => {
            if (brain.element) {
                try {
                    brain.element.stop();
                } catch (e) { console.warn("Failed to stop world audio:", e); }
            }
        });
        this.regionAudioSources.clear();
        this.audioZones.clear();
    }

    //
    // #endregion

    // #region [ Events ]
    //
    /**
     * Initializes loading events.
     */
    private initLoadingProgressEvents(): void {
        document.addEventListener("yieldMessage", (e: Event) => {
            const event = e as CustomEvent<{ message: string }>;
            const msgEl = document.getElementById("loadingMessage");
            if (msgEl) msgEl.textContent = event.detail.message;
        });

        document.addEventListener("yieldProgress", () => {
            const bar = document.getElementById("loadingBarFill");
            if (!bar) return;

            const current = parseFloat(bar.style.width || "0");
            const newWidth = Math.min(100, current + (100 / this.totalYieldSteps()));
            bar.style.width = `${newWidth}%`;
        });
    }

    //
    // #endregion

    public exportWorldData(): void {
        console.log("Exporting full world data snapshot...");

        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;

        const encodeBase64 = (u8: Uint8Array): string => {
            let binary = "";
            const len = u8.byteLength;
            for (let i = 0; i < len; i++) binary += String.fromCharCode(u8[i]);
            return btoa(binary);
        };

        const chunksOut: any[] = []; // TODO: Type protect the output
        for (let cx = 0; cx < this.chunks.length; cx++) {
            const col = this.chunks[cx];
            if (!col) continue;

            for (let cy = 0; cy < col.length; cy++) {
                const chunk = col[cy];
                if (!chunk) continue;

                const pos = {
                    x: cx * chunkSize,
                    y: cy * chunkSize
                };

                chunksOut.push({
                    cx,
                    cy,
                    pos,
                    size: chunkSize,
                    chosenBiomeName: chunk.chosenBiomeName,
                    pixelData: encodeBase64(chunk.pixelData),
                    heightData: encodeBase64(chunk.heightData),
                    waterData: encodeBase64(chunk.waterData)
                });
            }
        }

        const regionsOut = this.regions.map(r => ({
            id: r.id,
            name: r.name,
            layerName: r.layerName,
            bounds: r.bounds,
            chunkCoords: r.chunkCoords,
            area: r.area
        }));

        const zonesOut: any[] = []; // TODO: Type protect the output
        this.audioZones.forEach((zone, id) => {
            zonesOut.push({
                id,
                regionId: zone.region.id,
                regionName: zone.region.name,
                center: zone.center,
                src: zone.audioParams.src,
                volume: zone.audioParams.volume,
                rolloff: zone.audioParams.spatial?.rolloff,
                radius: zone.audioParams.spatial?.rolloff?.distance
            });
        });

        const output = {
            meta: {
                seed: this.currentSeed,
                generatedAt: new Date().toISOString(),
                worldSize: {
                    width: WORLD.WIDTH,
                    height: WORLD.HEIGHT
                },
                chunkCount: chunksOut.length,
                regionCount: this.regions.length,
                audioZoneCount: this.audioZones.size
            },
            params: this.worldConfig.worldgenParams,
            chunks: chunksOut,
            regions: regionsOut,
            audioZones: zonesOut
        };

        const json = JSON.stringify(output, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${this.currentSeed}.json`;
        link.click();

        console.log(`World exported successfully (${this.currentSeed}.json)`);
    }



    private async loadWorldFromFile(file: File): Promise<void> {
        console.log(`Loading saved world from ${file.name}...`);

        const text = await file.text();
        const data = JSON.parse(text);

        this.showLoadingMenu();
        this.clear();

        // Restore config + seed
        this.worldConfig.worldgenParams = data.params;
        this.currentSeed = data.meta.seed;

        const decodeBase64 = (b64: string): Uint8Array => {
            const binary = atob(b64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        };

        // === Chunks ===
        this.chunks = [];
        this.chunkLayers = [];

        const totalChunks = data.chunks.length;
        const allWorldLayers = this.worldConfig.worldLayerList;

        for (let i = 0; i < totalChunks; i++) {
            const c = data.chunks[i];

            const pixel = decodeBase64(c.pixelData);
            const height = decodeBase64(c.heightData);
            const water = decodeBase64(c.waterData);

            const chunk = new WorldChunk(
                c.chosenBiomeName,
                pixel,
                height,
                water,
                this.worldConfig
            );

            const layer =
                allWorldLayers.find(l => l.name === c.chosenBiomeName) ||
                allWorldLayers[0];

            // cx, cy were exported — use them directly
            const cx = c.cx;
            const cy = c.cy;

            if (!this.chunks[cx]) this.chunks[cx] = [];
            if (!this.chunkLayers[cx]) this.chunkLayers[cx] = [];

            this.chunks[cx][cy] = chunk;
            this.chunkLayers[cx][cy] = layer;

            chunk.pos = c.pos;
            chunk.size = c.size;

            this.renderChunk(cx, cy, chunk);

            if (i % 20 === 0) {
                await this.utility.yield(`Restoring chunk ${i}/${totalChunks}`);
            }
        }

        console.log("All chunks rendered.");

        // === Regions ===
        this.regions = data.regions.map((r: any) => ({
            id: r.id,
            name: r.name,
            layerName: r.layerName,
            bounds: r.bounds,
            chunkCoords: r.chunkCoords,
            area: r.area
        }));

        // === Audio Zones ===
        this.audioZones.clear();
        data.audioZones.forEach((z: any) => {
            const regionRef = this.regions.find(r => r.id === z.regionId);
            if (!regionRef) return;

            this.audioZones.set(z.id, {
                region: regionRef,
                center: z.center,
                audioParams: {
                    src: z.src,
                    loop: true,
                    output: "sfx",
                    volume: z.volume,
                    spatial: {
                        blend: 1.0,
                        pos: z.center,
                        rolloff: z.rolloff
                    }
                },
                isActive: false
            });
        });

        // === Finalize ===
        this.isGenerated = true;
        this.hideLoadingMenu();

        console.log(`World loaded and rendered successfully (Seed: ${data.meta.seed}).`);
    }
}