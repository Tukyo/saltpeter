import { CANVAS, WORLD } from "../Config";
import { WorldLayer, CellData, Material, PhysicsMaterialTypes, PixelData, Vec2, NoiseType, NetworkChunk, PixelWaterData, WorldData } from "../Types";

import { Camera } from "../Camera";
import { ControlsManager } from "../ControlsManager";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";

import { WorldChunk } from "./WorldChunk";
import { WorldConfig } from "./WorldConfig";
import { WorldDebug } from "./WorldDebug";
import { WorldEdit } from "./WorldEdit";
import { PlayerState } from "../player/PlayerState";

export class World {
    public chunks: Map<string, WorldChunk> = new Map();
    public chunkLayers: Map<string, WorldLayer> = new Map();

    public isGenerated = false;
    public currentSeed = 0;

    public worldConfig: WorldConfig;
    public worldDebug: WorldDebug;
    public worldEdit: WorldEdit;

    private erosionTemplate: { name: string; index: number }[] | null = null;
    private chunkBuffer: { cx: number; cy: number; loaded: boolean }[] = [];
    private worldBuffer: CellData | null = null;
    private streamingComplete = false;

    private readonly YIELD_RATE = 10;
    private readonly CHUNK_LOAD_RADIUS = Math.max(CANVAS.WIDTH, CANVAS.HEIGHT) * 2;
    private readonly WORLDGEN_PHASES: readonly string[] = ["cells", "degen", "hydration"];

    constructor(
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
        this.chunks.clear();
        this.chunkLayers.clear();
        this.worldDebug.hoveredChunk = null;
        this.isGenerated = false;
        this.chunkBuffer = [];
        this.worldBuffer = null;
        if (this.ui.worldCtx && this.ui.worldCanvas) {
            this.ui.worldCtx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        }
    }

    /**
     * General entrypoint for all chunk updates.
     * 
     * Network message triggers this, as well as client-side edits.
     */
    public handleChunkUpdate(remoteChunk: NetworkChunk): void {
        if (!remoteChunk || !remoteChunk.pos) return;

        const key = `${remoteChunk.pos.x},${remoteChunk.pos.y}`;
        const existing = this.chunks.get(key);

        // Only update if it's new or newer
        if (existing && (remoteChunk.version ?? 0) <= (existing as any).version) {
            return;
        }

        // Convert NetworkChunk → WorldChunk
        const newChunk = new WorldChunk(
            remoteChunk.layer,
            remoteChunk.cellData.worldPixelData,
            remoteChunk.cellData.worldHeightData,
            remoteChunk.cellData.worldWaterData!,
            this.worldConfig
        );

        // Extend runtime metadata
        newChunk.version = remoteChunk.version;
        newChunk.pos = remoteChunk.pos;
        newChunk.size = remoteChunk.size;

        this.chunks.set(key, newChunk);
        this.chunkLayers.set(
            key,
            this.worldConfig.worldLayers[remoteChunk.layer] || Object.values(this.worldConfig.worldLayers)[0]
        );

        console.log(`📦 Synced chunk ${key} (v${remoteChunk.version})`);

        // Immediately re-render the updated chunk
        this.renderChunk(remoteChunk.pos.x, remoteChunk.pos.y, newChunk);
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
    public async showGenerationMenu(): Promise<WorldData> {
        await this.worldgenMenu();

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

        this.worldConfig.worldgenParams = worldData.params;
        this.currentSeed = worldData.seed;

        this.clear(); // Full refresh just in case

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
        const cellSize = this.worldConfig.worldgenParams.general.cell.size; // Get the cell size from the configuration
        const lowestDepth = this.worldConfig.worldgenParams.terrain.lowestDepth; // World bottom

        const allLayerKeys = Object.keys(this.worldConfig.worldLayers);
        const allMaterialKeys = Object.keys(this.worldConfig.materials);

        // Determine how many cells needed to fill world
        const cellsX = Math.ceil(WORLD.WIDTH / cellSize);
        const cellsY = Math.ceil(WORLD.HEIGHT / cellSize);

        const worldPixelData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT); // Build storage for pixel data (1byte per px)
        const worldHeightData = new Uint8Array(WORLD.WIDTH * WORLD.HEIGHT); // Build storage for pixel height data (1byte per px)

        // Build storage for the layer type for each cell
        const cellLayerGrid: number[][] = Array.from({ length: cellsY }, () => new Array<number>(cellsX).fill(0));

        // Show status message
        const phaseMessages = ["building cells...", "placing pixels...", "spawning pixels...", "creating cells..."];
        const randomMessage = phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
        await this.utility.yield(randomMessage);

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
                    this.worldConfig.worldgenParams.terrain.noiseType,
                    (cellX + 0.5) * this.worldConfig.worldgenParams.terrain.scale,
                    (cellY + 0.5) * this.worldConfig.worldgenParams.terrain.scale,
                    seed,
                    {
                        octaves: this.worldConfig.worldgenParams.terrain.octaves,
                        persistence: this.worldConfig.worldgenParams.terrain.persistence
                    }
                );

                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                const mid: number = 0.5; // Push contrast around midpoint
                adjustedHeight = mid + (adjustedHeight - mid) * this.worldConfig.worldgenParams.terrain.intensity;
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                adjustedHeight = Math.pow(adjustedHeight, this.worldConfig.worldgenParams.terrain.heightCurve); // Bias curve
                if (adjustedHeight < 0) adjustedHeight = 0;
                else if (adjustedHeight > 1) adjustedHeight = 1; // Clamp [0..1]

                // === Island / Valley shaping (exclusive) ===
                const opts = this.worldConfig.worldgenParams.general.options;
                if (opts.island || opts.valley) {
                    const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;
                    const lowestDepth = this.worldConfig.worldgenParams.terrain.lowestDepth;

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
                        this.worldConfig.worldgenParams.terrain.noiseType,
                        cellX * 0.002,
                        cellY * 0.002,
                        seed + 9100,
                        { octaves: 2, persistence: 0.5 }
                    ) * 0.1;

                    // === ISLAND MODE ===
                    if (opts.island) {
                        // Hard ocean edge (height → 0) fading toward normal terrain
                        const fade = Math.pow(1 - t, this.worldConfig.worldgenParams.terrain.heightCurve * 1.5);
                        const target = seaLevel * 0.5; // deep ocean floor baseline
                        adjustedHeight = this.utility.lerp(target, adjustedHeight, t + edgeNoise);

                        if (adjustedHeight < lowestDepth) adjustedHeight = lowestDepth;
                        else if (adjustedHeight > 1) adjustedHeight = 1;
                    }

                    // === VALLEY MODE ===
                    else if (opts.valley) {
                        // Hard mountain edge (height → 1) fading toward valley
                        const fade = Math.pow(1 - t, this.worldConfig.worldgenParams.terrain.heightCurve * 1.5);
                        const target = 1.0; // mountain peak height
                        adjustedHeight = this.utility.lerp(adjustedHeight, target, fade + edgeNoise);

                        if (adjustedHeight < lowestDepth) adjustedHeight = lowestDepth;
                        else if (adjustedHeight > 1) adjustedHeight = 1;
                    }
                }


                if (adjustedHeight < lowestDepth) { adjustedHeight = lowestDepth; } // Clamp water floor to lowestDepth

                const layerForCell = this.pickLayerForHeight(adjustedHeight);
                const layerIndex = allLayerKeys.indexOf(layerForCell.name);
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
                        const landMatIndex = allMaterialKeys.indexOf(pixelInfo.material.name);
                        const outMaterialIndex = landMatIndex >= 0 ? landMatIndex : 0;
                        const outColorIndex = pixelInfo.materialColorIndex;

                        // Pack material index + color variant into single byte
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

        let selectedMaterial: Material = this.worldConfig.materials.stone; // fallback

        for (const entry of entries) {
            target -= entry.weight;
            if (target <= 0) {
                const mat = this.worldConfig.materials[entry.material];
                if (mat) selectedMaterial = mat;
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
        const layers = Object.values(this.worldConfig.worldLayers);

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

        const erosionMaterials = this.getErosionTemplate();

        const phaseMessages = ["eroding terrain...", "wearing down surfaces...", "carving material layers...", "degenerating terrain...", "exposing layers..."];
        const randomMessage = phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
        await this.utility.yield(randomMessage);

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
                const currentMat = Object.values(this.worldConfig.materials)[currentMatIndex];

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

                // Filter erosion materials to only those HARDER than current material
                const allMaterials = Object.values(this.worldConfig.materials);

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

                    const selectedMat = Object.values(this.worldConfig.materials)[newMatIndex];
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

        const allKeys = Object.keys(this.worldConfig.materials);
        const cached: { name: string; index: number }[] = erosionMaterialNames
            .map((name: string) => {
                const index: number = allKeys.indexOf(name);
                return { name, index };
            })
            .filter(m => m.index >= 0);

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

        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;
        const lowestDepth = this.worldConfig.worldgenParams.terrain.lowestDepth;
        const depthRange = seaLevel - lowestDepth;

        const phaseMessages = ["hydrating terrain...", "filling water basins...", "flooding valleys...", "hydrating cells...", "hydrating pixels...", "creating water..."];
        const randomMessage = phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
        await this.utility.yield(randomMessage);

        const totalPixels = worldHeightData.length;
        let processedPixels = 0;

        for (let i = 0; i < worldHeightData.length; i++) {
            processedPixels++;
            if (processedPixels % Math.floor(totalPixels / this.YIELD_RATE) === 0) {
                await this.utility.yield();
            }

            const height01 = worldHeightData[i] / 255;

            if (height01 < seaLevel) {
                // how far below sea level this pixel is (0 = shore, 1 = deepest)
                let depthT = (seaLevel - height01) / depthRange;
                if (depthT < 0) depthT = 0;
                else if (depthT > 1) depthT = 1;
                newWaterData[i] = Math.round(depthT * 255);
            } else {
                newWaterData[i] = 0;
            }
        }

        console.log("Hydration pass complete.");

        const hydratedData: CellData = { worldPixelData, worldHeightData, worldWaterData: newWaterData, cellLayerGrid };

        return hydratedData;
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
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);

        if (!chunk) return null;

        const localX = worldPos.x - cx * chunkSize;
        const localY = worldPos.y - cy * chunkSize;
        const waterLevel = chunk.getWaterAt(localX, localY, chunkSize);

        if (waterLevel <= 0) return null;

        const height = chunk.getHeightAt(localX, localY, chunkSize);
        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;
        const depth = seaLevel - height;

        const waterMaterial = this.worldConfig.materials.water;

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
     * Final step before rendering.
     * 
     * Bakes all generated cells into chunks.
     */
    private async bakeChunksFromCells(params: CellData): Promise<void> {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size; // Get the chunk size from the config
        const allWorldLayers = Object.values(this.worldConfig.worldLayers);

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

        const startMessages = ["baking chunks...", "baking pixels into chunks...", "assembling chunks...", "chunkifying... is that a word?", "packing pixels into chunks...", "arranging cells into chunks..."];
        const halfwayMessages = ["getting close...", "thanks for waiting...", "almost done...", "still chunking...", "about 50% of chunks baked...", "still baking pixels into chunks...", "almost all pixels baked..."]

        const firstMessage = startMessages[Math.floor(Math.random() * startMessages.length)];
        const secondMessage = halfwayMessages[Math.floor(Math.random() * halfwayMessages.length)];
        await this.utility.yield(firstMessage);

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
                this.backgroundStreamAllChunks(); // Load all remaining chunks
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

            const key = `${cx},${cy}`;
            this.chunks.set(key, worldChunk);
            this.chunkLayers.set(key, dominantLayer);
            this.renderChunk(cx, cy, worldChunk);
        }
    }
    //
    // #endregion

    // #region [ Rendering ]
    //
    /**
     * Renders the world to the world canvas within the camera bounds.
     */
    public drawWorld(): void {
        if (!this.ui.ctx || !this.ui.worldCanvas || !this.isGenerated) return;

        this.ui.ctx.drawImage(
            this.ui.worldCanvas,
            this.camera.pos.x, this.camera.pos.y,
            CANVAS.WIDTH, CANVAS.HEIGHT,
            0, 0,
            CANVAS.WIDTH, CANVAS.HEIGHT
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
        if (!this.ui.worldCtx) return;

        const ctx = this.ui.worldCtx;
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const startX = cx * chunkSize;
        const startY = cy * chunkSize;
        const seaLevel = this.worldConfig.worldgenParams.terrain.seaLevel;

        const w = this.worldConfig.worldgenParams.render.water; // hydration config reference
        const waterMat = this.worldConfig.materials.water;
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
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return null;

        const localX = x - cx * chunkSize;
        const localY = y - cy * chunkSize;
        const idx = localY * chunkSize + localX;
        const combined = chunk.pixelData[idx];
        const materialIndex = combined >> 2;

        return Object.values(this.worldConfig.materials)[materialIndex] || null;
    }

    /**
     * Gets the height of a specific pixel at coordinates.
     */
    public getHeightAt(x: number, y: number): number | null {
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(x / chunkSize), cy = Math.floor(y / chunkSize);
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);

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
        const key = `${cx},${cy}`;
        return this.chunkLayers.get(key) || null;
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
        this.worldDebug.hoveredChunk = `${cx},${cy}`;
        return { worldX, worldY };
    }
    //
    // #endregion

    // #region [ Menus ]
    //
    /**
     * Builds and displays the worldgen menu.
     */
    private async worldgenMenu(): Promise<void> {
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
            </div>
        `;

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
                // this.worldConfig.params.hydration.noiseType = fd.get("hydration.noiseType") as NoiseType;
                // this.worldConfig.params.hydration.scale = num("hydration.scale");
                // this.worldConfig.params.hydration.intensity = num("hydration.intensity");ds
                // this.worldConfig.params.hydration.multiplier = num("hydration.multiplier");


                document.body.removeChild(container);
                resolve();
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

                for (const [key, chunk] of this.chunks.entries()) {
                    const [cx, cy] = key.split(",").map(Number);
                    this.renderChunk(cx, cy, chunk);
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

    // #region [ Events ]
    //
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


    private totalYieldSteps(): number {
        const yieldPerProcess = this.YIELD_RATE;

        const chunksX = Math.ceil(WORLD.WIDTH / this.worldConfig.worldgenParams.general.chunk.size);
        const chunksY = Math.ceil(WORLD.HEIGHT / this.worldConfig.worldgenParams.general.chunk.size);
        const totalChunks = chunksX * chunksY;

        const bakedChunks = Math.floor(totalChunks * 0.5);

        return (yieldPerProcess * this.WORLDGEN_PHASES.length) + bakedChunks;
    }

    //
    // #endregion

    private async backgroundStreamAllChunks(): Promise<void> {
        console.log("Starting background chunk streaming...");

        for (let i = 0; i < this.chunkBuffer.length; i++) {
            const entry = this.chunkBuffer[i];
            if (entry.loaded) continue;

            this.loadChunk(entry.cx, entry.cy);
            entry.loaded = true;

            await this.utility.yield(); // one chunk per frame
        }

        console.log("✅ Background streaming complete. All chunks loaded.");
        this.chunkBuffer = [];
        this.worldBuffer = null;
        this.streamingComplete = true;
    }

    public async streamUnloadedChunks(): Promise<void> {
        if (!this.isGenerated || !this.playerState?.myPlayer || this.streamingComplete) return;

        if (!this.chunkBuffer.length || this.chunkBuffer.every(c => c.loaded)) {
            console.log("All chunks streamed. Cleaning up temporary world data...");
            this.chunkBuffer = [];
            this.worldBuffer = null;
            this.streamingComplete = true;
            return;
        }

        const playerPos = this.playerState.myPlayer.transform.pos;
        const chunkSize = this.worldConfig.worldgenParams.general.chunk.size;
        const loadRadius = this.CHUNK_LOAD_RADIUS;

        // Only load one new chunk per frame to avoid stutter
        for (let i = 0; i < this.chunkBuffer.length; i++) {
            const entry = this.chunkBuffer[i];
            if (entry.loaded) continue;

            const centerX = (entry.cx + 0.5) * chunkSize;
            const centerY = (entry.cy + 0.5) * chunkSize;
            const dx = centerX - playerPos.x;
            const dy = centerY - playerPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < loadRadius) {
                entry.loaded = true;
                this.loadChunk(entry.cx, entry.cy);
                await this.utility.yield(); // Give the frame time to breathe
                break; // One chunk allowed per frame
            }
        }
    }

    private loadChunk(cx: number, cy: number): void {
        if (!this.worldBuffer || !this.worldBuffer.cellLayerGrid || !this.worldBuffer.worldWaterData) return;

        const allWorldLayers = Object.values(this.worldConfig.worldLayers);

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
        const key = `${cx},${cy}`;
        this.chunks.set(key, worldChunk);
        this.chunkLayers.set(key, dominantLayer);
        this.renderChunk(cx, cy, worldChunk);
    }
}