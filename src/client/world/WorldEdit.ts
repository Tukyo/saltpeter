import { RoomManager } from "../RoomManager";
import { NetworkChunk, PhysicsMaterialTypes, Vec2 } from "../Types";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";
import { World } from "./World";

export class WorldEdit {
    private world: World;
    private roomManager: RoomManager;
    private ui: UserInterface;
    private utility: Utility;

    constructor(
        world: World,
        roomManager: RoomManager,
        ui: UserInterface,
        utility: Utility
    ) {
        this.world = world;
        this.roomManager = roomManager;
        this.ui = ui;
        this.utility = utility;
    }

    public createChunkPatch(params: NetworkChunk): void {
        // Apply locally
        this.world.handleChunkUpdate(params);

        // Broadcast
        this.roomManager.sendMessage(JSON.stringify({
            type: 'chunk-update',
            chunk: params
        }));
    }

    public createChunkPatchNetwork(params: NetworkChunk): void {
        // No-op if message originated locally (your RoomManager handles filtering)
        this.world.handleChunkUpdate(params);
    }

    public requestCraterAt(worldPos: Vec2): void {
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(worldPos.x / chunkSize);
        const cy = Math.floor(worldPos.y / chunkSize);
        const chunk = this.world.chunks[cx]?.[cy];
        if (!chunk) return;

        const radius = 10;
        const centerX = Math.floor(worldPos.x) % chunkSize;
        const centerY = Math.floor(worldPos.y) % chunkSize;

        const bedrockIndex = this.world.worldConfig.materialIndex["bedrock"];
        const bedrock = this.world.worldConfig.materialsList[bedrockIndex];

        const patches: { i: number; pixel?: number; height?: number }[] = [];

        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                const localX = centerX + x;
                const localY = centerY + y;
                if (localX < 0 || localX >= chunkSize || localY < 0 || localY >= chunkSize) continue;

                const idx = localY * chunkSize + localX;
                const newColorIdx = Math.floor(Math.random() * bedrock.colors.length);
                const newPacked = (bedrockIndex << 2) | newColorIdx;

                chunk.pixelData[idx] = newPacked;
                chunk.heightData[idx] = Math.max(0, chunk.heightData[idx] - 1);

                patches.push({ i: idx, pixel: newPacked, height: chunk.heightData[idx] });
            }
        }

        this.createChunkPatch({
            pos: { x: cx, y: cy },
            version: Date.now(),
            size: chunkSize,
            layer: this.world.chunkLayers[cx]?.[cy]?.name || "unknown",
            patches
        } as any);

        console.log(`Crater applied: ${worldPos.x},${worldPos.y}`);
    }


    public applyFootstepAt(worldPos: Vec2, materialName: string, force: number): void {
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const cx = Math.floor(worldPos.x / chunkSize);
        const cy = Math.floor(worldPos.y / chunkSize);
        const chunk = this.world.chunks[cx]?.[cy];
        if (!chunk) return;

        const centerX = Math.floor(worldPos.x) % chunkSize;
        const centerY = Math.floor(worldPos.y) % chunkSize;

        const allMaterials = this.world.worldConfig.materialsList;

        const radius = 4 + Math.floor(force * 3);
        const patches: { i: number; pixel?: number; height?: number }[] = [];

        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                const localX = centerX + x;
                const localY = centerY + y;
                if (localX < 0 || localX >= chunkSize || localY < 0 || localY >= chunkSize) continue;

                const dist = Math.sqrt(x * x + (y * 1.2) * (y * 1.2));
                if (dist > radius) continue;

                const idx = localY * chunkSize + localX;

                // Skip any pixels that have water on them
                if (chunk.waterData[idx] > 0) continue;

                const currentPacked = chunk.pixelData[idx];
                const matIndex = currentPacked >> 2;
                const colorIndex = currentPacked & 3;

                const currentMat = allMaterials[matIndex];
                if (!currentMat) continue;

                // Footstep imprint only allowed if the material itself allows it
                if (!currentMat.tags || !currentMat.tags.includes("imprint_on_footstep")) continue;

                // Darken slightly
                const darken = Math.random() < 0.9;
                const newColorIndex = darken ? Math.max(0, colorIndex - 1) : colorIndex;

                // Compress height based on distance from center and force
                const compression = (1 - dist / radius) * 0.4 * force;
                const newHeight = Math.max(0, chunk.heightData[idx] - compression);

                const newPacked = (matIndex << 2) | newColorIndex;
                chunk.pixelData[idx] = newPacked;
                chunk.heightData[idx] = newHeight;

                patches.push({ i: idx, pixel: newPacked, height: newHeight });
            }
        }

        // Send delta patch to world
        this.createChunkPatch({
            pos: { x: cx, y: cy },
            version: Date.now(),
            size: chunkSize,
            layer: this.world.chunkLayers[cx]?.[cy]?.name || "unknown",
            patches
        } as any);

        console.log(`Footstep imprint applied: ${worldPos.x}, ${worldPos.y} [${materialName}]`);
    }
}