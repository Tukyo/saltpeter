import { VIEWPORT, WORLD } from "../Config";
import { PhysicsMaterialTypes, RegionName } from "../Types";

import { Camera } from "../Camera";
import { ControlsManager } from "../ControlsManager";
import { UserInterface } from "../UserInterface";
import { Utility } from "../Utility";
import { World } from "./World";

export class WorldDebug {
    public hoveredChunk: { cx: number; cy: number } | null = null;

    private overlayMode: number = 0;
    private overlayNames: string[] = ["Chunk", "Heightmap", "Contours", "Regions", "Audio"];

    constructor(
        private camera: Camera,
        private controlsManager: ControlsManager,
        private ui: UserInterface,
        private utility: Utility,
        private world: World
    ) {
        this.listenForDebugShortcuts();
    }

    /**
     * Sets up event listeners for debug shortcut keys. (Hold CTRL + ALT + Keybind)
     * 
     * Overlay: Numpad Enter | [ ] < -- Brackets switch debug overlay pages.
     * 
     * Regen World: Numpad 0 | ReRender: Numpad . | Save World: Numpad /
     */
    private listenForDebugShortcuts(): void {
        window.addEventListener("keydown", e => {
            if (e.ctrlKey && e.altKey) {
                if (!this.world.isGenerated) return;

                switch (e.code) {
                    case "Numpad0":
                        e.preventDefault();
                        console.log("Opening generation menu...");
                        this.world.showGenerationMenu()
                            .then(async (worldData) => {
                                if (worldData !== "load") {
                                    await this.world.generateWorld(worldData);
                                }
                            });
                        break;

                    case "NumpadDecimal":
                        e.preventDefault();
                        console.log("Refreshing world rendering...");
                        this.world.renderMenu();
                        break;

                    case "NumpadEnter":
                        e.preventDefault();
                        this.world.worldConfig.worldgenParams.render.grid.active =
                            !this.world.worldConfig.worldgenParams.render.grid.active;
                        if (!this.world.worldConfig.worldgenParams.render.grid.active) this.hoveredChunk = null;
                        console.log("Overlay " + (this.world.worldConfig.worldgenParams.render.grid.active ? "enabled" : "disabled") +
                            " (mode: " + this.overlayNames[this.overlayMode] + ")");
                        if (this.world.worldConfig.worldgenParams.render.grid.active) {
                            this.showOverlayName();
                        }
                        break;

                    case "NumpadDivide":
                        e.preventDefault();
                        console.log("Exporting world data...");
                        this.world.exportWorldData();
                        break;

                    default:
                        break;
                }
            }

            if (this.world.worldConfig.worldgenParams.render.grid.active && e.ctrlKey && e.altKey) { // Debug page cycling
                if (e.key === "[" || e.code === "BracketLeft") {
                    e.preventDefault();
                    this.overlayMode = (this.overlayMode - 1 + this.overlayNames.length) % this.overlayNames.length;
                    console.log("Overlay mode: " + this.overlayNames[this.overlayMode]);
                    this.showOverlayName();
                }
                if (e.key === "]" || e.code === "BracketRight") {
                    e.preventDefault();
                    this.overlayMode = (this.overlayMode + 1) % this.overlayNames.length;
                    console.log("Overlay mode: " + this.overlayNames[this.overlayMode]);
                    this.showOverlayName();
                }
            }
        });
    }


    /**
     * General entrypoint for different world debug overlays.
     */
    public drawDebug(): void {
        if (!this.ui.ctx || !this.world.isGenerated) return;

        // Draw terrain overlays if enabled
        if (this.world.worldConfig.worldgenParams.render.grid.active) {
            switch (this.overlayMode) {
                case 0: this.drawChunks(); break;
                case 1: this.drawHeightmap(); break;
                case 2: this.drawContours(); break;
                case 3: this.drawRegions(); break;
                case 4: this.drawAudioZones(); break;
            }
            this.drawInfoPanels();
        }
    }

    /**
     * Draws fixed info panels at the top of the screen
     */
    private drawInfoPanels(): void {
        const hoveredCoords = this.world.updateHoveredChunk();
        if (!hoveredCoords || !this.hoveredChunk) return;

        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const hcx = this.hoveredChunk.cx;
        const hcy = this.hoveredChunk.cy;

        const worldX = Math.floor(hoveredCoords.worldX);
        const worldY = Math.floor(hoveredCoords.worldY);
        const worldPos = { x: worldX, y: worldY }

        const chunk = this.world.chunks[hcx]?.[hcy];
        const chunkLayer = this.world.chunkLayers[hcx]?.[hcy];
        if (!chunk) return;

        const localX = worldX - hcx * chunkSize;
        const localY = worldY - hcy * chunkSize;
        const li = localY * chunkSize + localX;

        const combined = chunk.pixelData[li];
        const materialIndex = combined >> 2;
        const colorVariantIndex = combined & 0b11;
        const height01 = chunk.getHeightAt(localX, localY, chunkSize);

        const mat = this.world.worldConfig.materialsList[materialIndex];
        const waterData = this.world.getWaterData(worldPos);

        const margin = 10;
        let currentX = margin;

        let regionName = "N/A";
        if (this.world.regions) {
            for (const region of this.world.regions) {
                if (region.chunkCoords.some(c => c.cx === hcx && c.cy === hcy)) {
                    regionName = region.name;
                    break;
                }
            }
        }

        const mainInfo = [ // Draw main panel
            `Region: ${regionName}`,
            `Layer: ${chunkLayer ? chunkLayer.name : "N/A"}`,
            `Chunk: ${hcx},${hcy})`,
            `Pixel: ${worldX},${worldY}`,
            `Height: ${height01.toFixed(3)}`
        ];
        currentX += this.drawPanel("Main", mainInfo, currentX, 10, '#888888', null) + margin;

        if (mat && mat.physics.type === PhysicsMaterialTypes.Solid) {
            const materialColor = this.utility.getLightestColor(mat.colors);
            const solidInfo = [
                `Material: ${mat.name} [${materialIndex}]`,
                `Type: ${mat.type}`,
                `Color Var: ${colorVariantIndex}`,
                `Simulate: ${mat.physics.simulate}`,
                `Durability: ${mat.physics.durability.toFixed(2)}`,
                `Friction: ${mat.physics.friction.toFixed(2)}`,
                `Density: ${mat.physics.density.toFixed(2)}`
            ];
            currentX += this.drawPanel("Solid", solidInfo, currentX, 10, materialColor, materialColor) + margin;
        }

        if (waterData && waterData.hasWater) {
            const phys = waterData.material.physics;
            const materialColor = this.utility.getLightestColor(waterData.material.colors);

            if (phys.type === PhysicsMaterialTypes.Liquid) {
                const liquidInfo = [
                    `Material: ${waterData.material.name}`,
                    `Depth: ${waterData.depth.toFixed(3)}`,
                    `Simulate: ${phys.simulate}`,
                    `Viscosity: ${phys.viscosity.toFixed(2)}`
                ];
                currentX += this.drawPanel("Liquid", liquidInfo, currentX, 10, materialColor, materialColor) + margin;
            }
        }
    }

    /**
     * Draws a single info panel and returns its width
     */
    private drawPanel(title: string, lines: string[], x: number, y: number, color: string, titleBgColor: string | null): number {
        const ctx = this.ui.ctx;
        if (!ctx) return 0;

        const padding = 8;
        const lineHeight = 14;
        const headerHeight = 20;
        const titleMargin = 4; // Space between title and content

        ctx.font = "11px monospace";
        ctx.textAlign = "left";

        let maxWidth = ctx.measureText(title).width;
        lines.forEach(line => {
            maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
        });

        const boxWidth = maxWidth + padding * 2;
        const boxHeight = headerHeight + titleMargin + lines.length * lineHeight + padding;

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(x, y, boxWidth, boxHeight);

        // Border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxWidth, boxHeight);

        // Header with background color
        if (titleBgColor) {
            ctx.fillStyle = titleBgColor;
            ctx.fillRect(x, y, boxWidth, headerHeight);
        }

        // Title text
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = titleBgColor ? "#000000" : color; // Black text if has bg, colored if not
        ctx.fillText(title, x + padding, y + padding + 10);

        // Content
        ctx.fillStyle = titleBgColor ? color : "#ffffff"; // Use material color for content if material panel
        ctx.font = "11px monospace";
        lines.forEach((line, i) => {
            ctx.fillText(line, x + padding, y + headerHeight + titleMargin + padding + i * lineHeight);
        });

        return boxWidth;
    }

    /**
     * Renders chunk borders with layer highlights
     */
    private drawChunks(): void {
        if (!this.ui.ctx || !this.world.isGenerated) return;

        const ctx = this.ui.ctx;
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const camX = this.camera.pos.x, camY = this.camera.pos.y;

        const startCX = Math.floor(camX / chunkSize);
        const endCX = Math.ceil((camX + VIEWPORT.WIDTH) / chunkSize);
        const startCY = Math.floor(camY / chunkSize);
        const endCY = Math.ceil((camY + VIEWPORT.HEIGHT) / chunkSize);

        ctx.save();

        // Highlight hovered chunk
        if (this.hoveredChunk) {
            const hcx = this.hoveredChunk.cx;
            const hcy = this.hoveredChunk.cy;
            const hoveredChunkWorldX = hcx * chunkSize;
            const hoveredChunkWorldY = hcy * chunkSize;
            const hoveredScreenX = hoveredChunkWorldX - camX;
            const hoveredScreenY = hoveredChunkWorldY - camY;

            const hex = this.world.worldConfig.worldgenParams.render.grid.chunkBorderColor.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
            ctx.fillRect(hoveredScreenX, hoveredScreenY, chunkSize, chunkSize);
        }

        // Draw chunk borders
        for (let cx = startCX; cx < endCX; cx++) {
            for (let cy = startCY; cy < endCY; cy++) {
                const worldX = cx * chunkSize;
                const worldY = cy * chunkSize;
                const screenX = worldX - camX;
                const screenY = worldY - camY;

                const currentLayer = this.world.getChunkLayer(cx, cy);
                const layerRight = this.world.getChunkLayer(cx + 1, cy) || currentLayer;
                const layerBottom = this.world.getChunkLayer(cx, cy + 1) || currentLayer;

                const vBorder = !!(currentLayer && layerRight && currentLayer.name !== layerRight.name);
                const hBorder = !!(currentLayer && layerBottom && currentLayer.name !== layerBottom.name);

                // Right edge
                ctx.beginPath();
                ctx.moveTo(screenX + chunkSize, screenY);
                ctx.lineTo(screenX + chunkSize, screenY + chunkSize);
                ctx.lineWidth = vBorder ? this.world.worldConfig.worldgenParams.render.grid.borderWidth : this.world.worldConfig.worldgenParams.render.grid.lineWidth;
                ctx.strokeStyle = vBorder ? this.world.worldConfig.worldgenParams.render.grid.layerBorderColor : this.world.worldConfig.worldgenParams.render.grid.chunkBorderColor;
                ctx.stroke();

                // Bottom edge
                ctx.beginPath();
                ctx.moveTo(screenX, screenY + chunkSize);
                ctx.lineTo(screenX + chunkSize, screenY + chunkSize);
                ctx.lineWidth = hBorder ? this.world.worldConfig.worldgenParams.render.grid.borderWidth : this.world.worldConfig.worldgenParams.render.grid.lineWidth;
                ctx.strokeStyle = hBorder ? this.world.worldConfig.worldgenParams.render.grid.layerBorderColor : this.world.worldConfig.worldgenParams.render.grid.chunkBorderColor;
                ctx.stroke();
            }
        }

        // World bounds
        ctx.strokeStyle = this.world.worldConfig.worldgenParams.render.grid.worldBorderColor;
        ctx.lineWidth = this.world.worldConfig.worldgenParams.render.grid.borderWidth;
        ctx.strokeRect(0 - camX, 0 - camY, WORLD.WIDTH, WORLD.HEIGHT);

        ctx.restore();
    }

    /**
     * Draws a heightmap debug view.
     * 
     * Heightmap ranges from blue > green > red > white.
     */
    private drawHeightmap(): void {
        const ctx = this.ui.ctx;
        if (!ctx || !this.world.isGenerated) return;

        const camX = this.camera.pos.x;
        const camY = this.camera.pos.y;
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const resolution = 4;
        const alpha = 0.6;

        const { seaLevel, lowestDepth } = this.world.worldConfig.worldgenParams.terrain;
        const layers = this.world.worldConfig.worldLayerList;

        ctx.save();
        ctx.globalAlpha = alpha;

        const startCX = Math.floor(camX / chunkSize);
        const endCX = Math.ceil((camX + VIEWPORT.WIDTH) / chunkSize);
        const startCY = Math.floor(camY / chunkSize);
        const endCY = Math.ceil((camY + VIEWPORT.HEIGHT) / chunkSize);

        const lerpColor = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
            Math.floor(this.utility.lerp(a[0], b[0], t)),
            Math.floor(this.utility.lerp(a[1], b[1], t)),
            Math.floor(this.utility.lerp(a[2], b[2], t)),
        ];

        const stops: [number, [number, number, number]][] = [];
        const shoreBlend = 0.05;

        stops.push([lowestDepth, [0, 0, 90]]);
        stops.push([seaLevel * 0.5, [0, 60, 170]]);
        stops.push([seaLevel - shoreBlend, [0, 120, 220]]);
        stops.push([seaLevel + shoreBlend, [0, 200, 140]]);

        for (const layer of Object.values(layers)) {
            const h = layer.height;

            if (h <= seaLevel) continue;

            const t = this.world.worldConfig.worldLayerIndex[layer.name] / (this.world.worldConfig.worldLayerList.length - 1);
            let color: [number, number, number];

            if (t < 0.25) color = [60, 220, 80];
            else if (t < 0.5) color = [230, 230, 60];
            else if (t < 0.75) color = [240, 140, 50];
            else if (t < 0.95) color = [255, 70, 40];
            else color = [255, 255, 255];

            stops.push([h, color]);
        }

        stops.sort((a, b) => a[0] - b[0]);

        for (let cx = startCX; cx < endCX; cx++) {
            for (let cy = startCY; cy < endCY; cy++) {
                const chunk = this.world.chunks[cx]?.[cy];
                if (!chunk) continue;

                const startX = cx * chunkSize - camX;
                const startY = cy * chunkSize - camY;

                for (let y = 0; y < chunkSize; y += resolution) {
                    for (let x = 0; x < chunkSize; x += resolution) {
                        const h = chunk.getHeightAt(x, y, chunkSize);

                        let lower = stops[0];
                        let upper = stops[stops.length - 1];
                        for (let i = 0; i < stops.length - 1; i++) {
                            if (h >= stops[i][0] && h <= stops[i + 1][0]) {
                                lower = stops[i];
                                upper = stops[i + 1];
                                break;
                            }
                        }

                        const range = upper[0] - lower[0];
                        let t = range > 0 ? (h - lower[0]) / range : 0;
                        t = this.utility.smoothstep(t);

                        const [r, g, b] = lerpColor(lower[1], upper[1], t);
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(startX + x, startY + y, resolution, resolution);
                    }
                }
            }
        }

        ctx.restore();
    }

    /**
     * Draws contour lines showing visible height changes in the terrain.
     */
    private drawContours(): void {
        const ctx = this.ui.ctx;
        if (!ctx || !this.world.isGenerated) return;

        const camX = this.camera.pos.x;
        const camY = this.camera.pos.y;
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;
        const resolution = 2;
        const contourStep = 0.02;
        const lineWidth = 1;
        const color = "rgba(0,0,0,0.35)";

        ctx.save();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;

        const startCX = Math.floor(camX / chunkSize);
        const endCX = Math.ceil((camX + VIEWPORT.WIDTH) / chunkSize);
        const startCY = Math.floor(camY / chunkSize);
        const endCY = Math.ceil((camY + VIEWPORT.HEIGHT) / chunkSize);

        const getH = (chunk: any, x: number, y: number): number => chunk.getHeightAt(x, y, chunkSize);

        for (let cx = startCX; cx < endCX; cx++) {
            for (let cy = startCY; cy < endCY; cy++) {
                const chunk = this.world.chunks[cx]?.[cy];
                if (!chunk) continue;

                const startX = cx * chunkSize - camX;
                const startY = cy * chunkSize - camY;

                for (let y = 0; y < chunkSize - resolution; y += resolution) {
                    for (let x = 0; x < chunkSize - resolution; x += resolution) {
                        const h00 = getH(chunk, x, y);
                        const h10 = getH(chunk, x + resolution, y);
                        const h01 = getH(chunk, x, y + resolution);
                        const h11 = getH(chunk, x + resolution, y + resolution);

                        const minH = Math.min(h00, h10, h01, h11);
                        const maxH = Math.max(h00, h10, h01, h11);

                        const base = Math.floor(minH / contourStep) * contourStep;
                        for (let level = base; level <= maxH; level += contourStep) {
                            if (level >= minH && level <= maxH) {
                                ctx.beginPath();

                                const interp = (v1: number, v2: number, offset: number): number => {
                                    const t = (offset - v1) / (v2 - v1);
                                    return Math.max(0, Math.min(1, t));
                                };

                                const points: { x: number; y: number }[] = [];

                                if ((level - h00) * (level - h10) < 0)
                                    points.push({ x: startX + x + resolution * interp(h00, h10, level), y: startY + y });
                                if ((level - h10) * (level - h11) < 0)
                                    points.push({ x: startX + x + resolution, y: startY + y + resolution * interp(h10, h11, level) });
                                if ((level - h11) * (level - h01) < 0)
                                    points.push({ x: startX + x + resolution * (1 - interp(h11, h01, level)), y: startY + y + resolution });
                                if ((level - h01) * (level - h00) < 0)
                                    points.push({ x: startX + x, y: startY + y + resolution * (1 - interp(h01, h00, level)) });

                                if (points.length >= 2) {
                                    ctx.moveTo(points[0].x, points[0].y);
                                    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                                    ctx.stroke();
                                }
                            }
                        }
                    }
                }
            }
        }

        ctx.restore();
    }

    /**
     * Draws region overlays with fill + border.
     */
    private drawRegions(): void {
        if (!this.ui.ctx || !this.world.isGenerated || !this.world.regions) return;

        const ctx = this.ui.ctx;
        const camX = this.camera.pos.x;
        const camY = this.camera.pos.y;
        const chunkSize = this.world.worldConfig.worldgenParams.general.chunk.size;

        const regionFillColors: Record<RegionName, string> = {
            shore: "rgba(30, 150, 200, 0.25)",
            cliffs: "rgba(180, 80, 60, 0.25)",
            mountains: "rgba(120, 120, 140, 0.25)",
            ocean: "rgba(40, 80, 180, 0.3)",
            plains: "rgba(160, 200, 100, 0.25)"
        };

        const regionBorderColors: Record<RegionName, string> = {
            shore: "#1e96c8",
            cliffs: "#b4503c",
            mountains: "#78788c",
            ocean: "#2850b4",
            plains: "#afc543ff"
        };

        ctx.save();

        // First pass: fill
        for (const region of this.world.regions) {
            const color = regionFillColors[region.name];
            ctx.fillStyle = color;
            for (const { cx, cy } of region.chunkCoords) {
                const screenX = cx * chunkSize - camX;
                const screenY = cy * chunkSize - camY;
                ctx.fillRect(screenX, screenY, chunkSize, chunkSize);
            }
        }

        // Second pass: outline
        ctx.lineWidth = 2;
        for (const region of this.world.regions) {
            const borderColor = regionBorderColors[region.name];
            ctx.strokeStyle = borderColor;
            for (const { cx, cy } of region.chunkCoords) {
                const screenX = cx * chunkSize - camX;
                const screenY = cy * chunkSize - camY;
                ctx.strokeRect(screenX, screenY, chunkSize, chunkSize);
            }
        }

        ctx.restore();
    }

    /**
     * Draws audio zones and highlights the currently active zones.
     */
    private drawAudioZones(): void {
        const ctx = this.ui.ctx;
        if (!ctx) return;

        ctx.save();

        this.world.audioZones.forEach(zone => {
            const screenX = zone.center.x - this.camera.pos.x;
            const screenY = zone.center.y - this.camera.pos.y;
            const radius = zone.audioParams.spatial?.rolloff?.distance || 500;

            // Draw audio radius
            ctx.strokeStyle = zone.isActive ? '#00ff0055' : '#ffffff22';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw center point
            ctx.fillStyle = zone.isActive ? '#00ff00' : '#ffffff';
            ctx.fillRect(screenX - 3, screenY - 3, 6, 6);
        });

        ctx.restore();
    }

    /**
     * Shows the current debug overlay mode name with a quick fade effect.
     */
    private showOverlayName(): void {
        const existing = document.getElementById('debugOverlayName');
        if (existing) existing.remove();

        // Create overlay name element
        const overlay = document.createElement('div');
        overlay.id = 'debugOverlayName';
        overlay.textContent = this.overlayNames[this.overlayMode];
        overlay.style.cssText = `
            position: fixed;
            top: 60%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            color: #ffffff;
            padding: 12px 24px;
            border: 2px solid #888888;
            border-radius: 4px;
            z-index: 99999;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.3s ease-out;
        `;

        document.body.appendChild(overlay);

        setTimeout(() => { // Fade out after short delay
            overlay.style.opacity = '0';

            setTimeout(() => { // Remove from DOM after fade completes
                if (overlay.parentElement) {
                    overlay.remove();
                }
            }, 300); // Match transition duration
        }, 800); // Show for 800ms before fading
    }
}