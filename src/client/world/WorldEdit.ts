import { RoomManager } from "../RoomManager";
import { NetworkChunk, Vec2 } from "../Types";
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

    public requestCraterAt(worldPos: Vec2): void {
        const chunkSize = this.world.worldConfig.params.general.chunk.size;
        const cx = Math.floor(worldPos.x / chunkSize);
        const cy = Math.floor(worldPos.y / chunkSize);
        const key = `${cx},${cy}`;
        const chunk = this.world.chunks.get(key);
        if (!chunk) return;

        const radius = 10;
        const centerX = Math.floor(worldPos.x) % chunkSize;
        const centerY = Math.floor(worldPos.y) % chunkSize;

        const bedrockIndex = this.world.worldConfig.materials.findIndex(m => m.name === "bedrock");
        const bedrock = this.world.worldConfig.materials[bedrockIndex] || this.world.worldConfig.materials[0];

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
            }
        }

        // re-render updated chunk
        this.world.renderChunk(cx, cy, chunk);

        // Broadcast to server
        const networkChunk: NetworkChunk = {
            pos: { x: cx, y: cy },
            version: Date.now(),
            size: chunkSize,
            layer: this.world.chunkLayers.get(key)?.name || "unknown",
            cellData: {
                worldPixelData: chunk.pixelData,
                worldHeightData: chunk.heightData,
                worldWaterData: chunk.waterData,
                cellLayerGrid: [] // stub
            }
        };

        this.roomManager.sendMessage(JSON.stringify({
            type: "chunk-update",
            chunk: networkChunk
        }));

        console.log(`Crater applied: ${worldPos.x},${worldPos.y}`);
    }
}