export class RenderingManager {
    public characterImages: Map<string, HTMLImageElement> = new Map();
    public ammoBoxImages: { [layer: string]: HTMLImageElement } = {};

    constructor() {}
}