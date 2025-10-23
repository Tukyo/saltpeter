import { ParametricDecalParams } from "./Types";

export class DecalsConfig {
    public decals = {
        projectile: {
            radius: {
                min: 4,
                max: 8
            },
            density: {
                min: 0.175,
                max: 0.35
            },
            opacity: {
                min: 0.15,
                max: 0.25
            },
            variation: 0.215,
            colors: ["#000000", "#191919", "#39362d"]
        } as ParametricDecalParams,
        blood: {
            radius: {
                min: 5,
                max: 17.5
            },
            density: {
                min: 0.1,
                max: 0.175
            },
            opacity: {
                min: 0.275,
                max: 0.315
            },
            variation: 0.5,
            colors: ["#781414", "#710606", "#a10101"]
        } as ParametricDecalParams,
        explosion: {
            radius: {
                min: 25,
                max: 40
            },
            density: {
                min: 0.375,
                max: 0.575
            },
            opacity: {
                min: 0.35,
                max: 0.525
            },
            variation: 0.2,
            colors: ["#434343", "#2a2a2a", "#3b1d1d"]
        } as ParametricDecalParams
    };

    constructor() { }
}