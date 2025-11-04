import { Material, WorldLayer, PhysicsMaterialTypes, NoiseType, WorldParams, RegionName } from "../Types";

export class WorldConfig {
    public worldgenParams: WorldParams = {
        general: {
            chunk: { size: 128 },
            cell: { size: 2 },
            options: { island: false, valley: false, },
            seed: 0
        },
        terrain: {
            noiseType: NoiseType.Perlin,
            intensity: 2,
            octaves: 6.0,
            scale: 0.0005,
            persistence: 0.55,
            heightCurve: 1.5,
            seaLevel: 0.18,
            lowestDepth: 0.1
        },
        material: {
            noiseType: NoiseType.Perlin,
            scale: 0.005,
            detail: {
                noiseType: NoiseType.Perlin,
                scale: 1.0,
            },
            colorVariation: 0.75
        },
        degen: {
            noiseType: NoiseType.Perlin,
            scale: 0.0001,
            intensity: 0.35,
            minHeight: 0.1,
            threshold: 0.55,
            hardness: 0.5,
            detail: {
                noiseType: NoiseType.Perlin,
                scale: 0.005
            }
        },
        hydration: {
            noiseType: NoiseType.Perlin,
            intensity: 0.5,
            scale: 0.001,
            multiplier: 1
        },
        render: {
            water: {
                opacityBase: 0.55,
                opacityMultiplier: 0.975,
                foamIntensity: 1.0,
                foamScale: 0.035,
                noiseScale: 0.001,
                shoreBlend: 0.0275,
                shimmerStrength: 0.15,
                depthDarkness: 1
            },
            grid: {
                active: false, // Switches visibility state in WorldDebug.ts
                lineWidth: 1,
                chunkBorderColor: "#a1a1a1",
                worldBorderColor: "#9747ff",
                layerBorderColor: "#ff4343",
                borderWidth: 3
            }
        }
    };

    public regionAudioParams: Record<RegionName, {
        minRegionSize: number;
        radius: number;
        volume: { min: number; max: number };
    } | null> = {
            shore: { minRegionSize: 4, radius: 400, volume: { min: 0.0, max: 0.175 } },
            cliffs: { minRegionSize: 6, radius: 550, volume: { min: 0.0, max: 0.135 } },
            mountains: { minRegionSize: 8, radius: 650, volume: { min: 0.0, max: 0.125 } },
            ocean: { minRegionSize: 16, radius: 750, volume: { min: 0.0, max: 0.115 } },
            plains: { minRegionSize: 14, radius: 1000, volume: { min: 0.0, max: 0.1 } }
        };

    public worldLayers: Record<string, WorldLayer> = {
        // NAME KEY MUST MATCH OBJECT LITERAL !IMPORTANT
        // MUST BE ORDERED BY HEIGHT [0..1]

        foundation: {
            name: "foundation",
            height: 0.05,
            materials: [
                { material: "bedrock", weight: 10, blend: 0.1 },
                { material: "granite", weight: 6, blend: 0.2 },
                { material: "basalt", weight: 3, blend: 0.2 }
            ]
        },
        substrate: {
            name: "substrate",
            height: 0.07,
            materials: [
                { material: "granite", weight: 6, blend: 0.3 },
                { material: "limestone", weight: 4, blend: 0.5 },
                { material: "shale", weight: 3, blend: 0.4 },
                { material: "slate", weight: 2, blend: 0.4 }
            ]
        },
        sediment: {
            name: "sediment",
            height: 0.12,
            materials: [
                { material: "silt", weight: 4, blend: 0.9 },
                { material: "sand", weight: 5, blend: 0.9 },
                { material: "gravel", weight: 2, blend: 0.6 },
                { material: "dirt", weight: 1, blend: 0.4 }
            ]
        },
        alluvium: {
            name: "alluvium",
            height: 0.18,
            materials: [
                { material: "silt", weight: 3, blend: 0.95 },
                { material: "sand", weight: 6, blend: 0.9 },
                { material: "gravel", weight: 3, blend: 0.6 },
                { material: "stone", weight: 1, blend: 0.2 }
            ]
        },
        soil: {
            name: "soil",
            height: 0.3,
            materials: [
                { material: "grass", weight: 7, blend: 0.8 },
                { material: "dirt", weight: 2, blend: 0.6 },
                { material: "gravel", weight: 2, blend: 0.7 },
                { material: "stone", weight: 1, blend: 0.3 }
            ]
        },
        topsoil: {
            name: "topsoil",
            height: 0.45,
            materials: [
                { material: "grass", weight: 7, blend: 0.8 },
                { material: "dirt", weight: 2, blend: 0.6 },
                { material: "gravel", weight: 1, blend: 0.4 }
            ]
        },
        colluvium: {
            name: "colluvium",
            height: 0.7,
            materials: [
                { material: "stone", weight: 6, blend: 0.3 },
                { material: "gravel", weight: 3, blend: 0.5 },
                { material: "dirt", weight: 1, blend: 0.6 },
                { material: "snow", weight: 1, blend: 0.8 },
            ]
        },
        summit: {
            name: "summit",
            height: 0.9,
            materials: [
                { material: "stone", weight: 2, blend: 0.3 },
                { material: "gravel", weight: 1, blend: 0.4 },
                { material: "snow", weight: 4, blend: 0.8 },
                { material: "ice", weight: 3, blend: 0.9 }
            ]
        }
    };

    public materials: Record<string, Material> = {
        // NAME KEY MUST MATCH OBJECT LITERAL !IMPORTANT

        // TEMPLATE
        // name: { // Name key and name string must match (case-sensitive)
        //     name: "", type: "terrain",
        //     colors: [],
        //     physics: {
        //         type: PhysicsMaterialTypes.Solid,
        //         simulate: ,
        //         durability: ,
        //         friction: ,
        //         density: 
        //     }
        // },

        // TERRAIN
        basalt: {
            name: "basalt", type: "terrain",
            colors: ["#2e2e2e", "#3e3e3e", "#4e4e4e", "#5e5e5e"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.8,
                friction: 0.88,
                density: 0.88
            }
        },
        bedrock: {
            name: "bedrock", type: "terrain",
            colors: ["#2f3236", "#3a3e44", "#454a52", "#50565f"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 1,
                friction: 0.9,
                density: 0.95
            }
        },
        clay: {
            name: "clay", type: "terrain",
            colors: ["#6f5a4a", "#7c6755", "#897461", "#96816e"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.2,
                friction: 0.75,
                density: 0.4
            }
        },
        dirt: {
            name: "dirt", type: "terrain",
            colors: ["#5b3a1f", "#6b4a2f", "#7b5a3f", "#8b6a4f"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.2,
                friction: 0.8,
                density: 0.5
            }
        },
        granite: {
            name: "granite", type: "terrain",
            colors: ["#6e6e6e", "#7e7e7e", "#8e8e8e", "#9e9e9e"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.9,
                friction: 0.9,
                density: 0.9
            }
        },
        grass: {
            name: "grass", type: "terrain",
            colors: ["#3a5f3e", "#4a6f4e", "#5a7f5e", "#6a8f6e"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.2,
                friction: 0.8,
                density: 0.5
            }
        },
        gravel: {
            name: "gravel", type: "terrain",
            colors: ["#606060", "#707070", "#808080", "#909090"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: true,
                durability: 0.1,
                friction: 0.6,
                density: 0.3
            }
        },
        ice: {
            name: "ice", type: "terrain",
            colors: ["#a9d5ff", "#8fc5ff", "#6fb5ff", "#5aa4f2"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.3,
                friction: 0.4,
                density: 0.5
            }
        },
        permafrost: {
            name: "permafrost", type: "terrain",
            colors: ["#a4b5ef", "#7aabeb", "#9bc6f5", "#7d92f9"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.7,
                friction: 0.85,
                density: 0.8
            }
        },
        loam: {
            name: "loam", type: "terrain",
            colors: ["#2d1f12", "#3a2918", "#4a361f", "#5a4328"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.2,
                friction: 0.8,
                density: 0.55
            }
        },
        limestone: {
            name: "limestone", type: "terrain",
            colors: ["#c0b8a0", "#b0a890", "#a09880", "#908870"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.5,
                friction: 0.8,
                density: 0.7
            }
        },
        moss: {
            name: "moss", type: "terrain",
            colors: ["#264a2f", "#2f5a3a", "#376a45", "#3f7a50"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.1,
                friction: 0.8,
                density: 0.4
            }
        },
        peat: {
            name: "peat", type: "terrain",
            colors: ["#1a150f", "#241e16", "#2e271e", "#383024"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.1,
                friction: 0.6,
                density: 0.3
            }
        },
        sand: {
            name: "sand", type: "terrain",
            colors: ["#b2a280", "#c2b290", "#d2c2a0", "#e2d2b0"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: true,
                durability: 0.1,
                friction: 0.6,
                density: 0.2
            }
        },
        sandstone: {
            name: "sandstone", type: "terrain",
            colors: ["#c2b290", "#b2a280", "#a29270", "#928260"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.4,
                friction: 0.75,
                density: 0.65
            }
        },
        scree: {
            name: "scree", type: "terrain",
            colors: ["#868680", "#8f8f88", "#999990", "#a3a399"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.4,
                friction: 0.75,
                density: 0.65
            }
        },
        shale: {
            name: "shale", type: "terrain",
            colors: ["#4f555d", "#5a616a", "#656d77", "#707a85"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.4,
                friction: 0.75,
                density: 0.7
            }
        },
        silt: {
            name: "silt", type: "terrain",
            colors: ["#7a7362", "#777165", "#6b6965", "#6d6755"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: true,
                durability: 0.1,
                friction: 0.5,
                density: 0.3
            }
        },
        slate: {
            name: "slate", type: "terrain",
            colors: ["#4a4f55", "#555a60", "#60656b", "#6b7076"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.6,
                friction: 0.82,
                density: 0.75
            }
        },
        snow: {
            name: "snow", type: "terrain",
            colors: ["#ffffff", "#e6eef5", "#dfe8f2", "#cfdceb"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.2,
                friction: 0.9,
                density: 0.4
            }
        },
        stone: {
            name: "stone", type: "terrain",
            colors: ["#707070", "#808080", "#909090", "#a0a0a0"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.5,
                friction: 0.85,
                density: 0.75
            }
        },

        // MINERAL
        coal: {
            name: "coal", type: "mineral",
            colors: ["#0a0a0a", "#1a1a1a", "#2a2a2a", "#3a3a3a"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.6,
                friction: 0.85,
                density: 0.55
            }
        },
        iron: {
            name: "iron", type: "mineral",
            colors: ["#7b3716", "#8b4726", "#9b5736", "#ab6746"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.7,
                friction: 0.85,
                density: 0.9
            }
        },
        gold: {
            name: "gold", type: "mineral",
            colors: ["#eec700", "#fed700", "#ffe700", "#fff74c"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.8,
                friction: 0.85,
                density: 0.8
            }
        },
        silver: {
            name: "silver", type: "mineral",
            colors: ["#b0b0b0", "#c0c0c0", "#d0d0d0", "#e0e0e0"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.7,
                friction: 0.85,
                density: 0.75
            }
        },
        copper: {
            name: "copper", type: "mineral",
            colors: ["#a86323", "#b87333", "#c88343", "#d89353"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.6,
                friction: 0.85,
                density: 0.7
            }
        },

        // SURFACE
        wood: {
            name: "wood", type: "surface",
            colors: ["#7b3503", "#8b4513", "#9b5523", "#ab6533"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.4,
                friction: 0.85,
                density: 0.5
            }
        },
        concrete: {
            name: "concrete", type: "surface",
            colors: ["#2a2a2a", "#3a3a3a", "#4a4a4a", "#5a5a5a"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.8,
                friction: 0.85,
                density: 0.65
            }
        },
        metal: {
            name: "metal", type: "surface",
            colors: ["#4a4a4a", "#6a6a6a", "#7a7a7a", "#8a8a8a"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.9,
                friction: 0.85,
                density: 0.8
            }
        },
        asphalt: {
            name: "asphalt", type: "surface",
            colors: ["#1b1b1b", "#2b2b2b", "#3b3b3b", "#4b4b4b"],
            physics: {
                type: PhysicsMaterialTypes.Solid,
                simulate: false,
                durability: 0.8,
                friction: 0.85,
                density: 0.7
            }
        },

        // LIQUIDS
        water: {
            name: "water", type: "liquid",
            colors: ["#2d6bc9", "#2450a6", "#1f3f8a", "#1a2f6e"],
            physics: {
                type: PhysicsMaterialTypes.Liquid,
                simulate: true,
                viscosity: 0.2
            }
        }
    };

    constructor() { }
}

// 1761802917695 1761883681927 1761926328530