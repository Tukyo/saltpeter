import { Vec2 } from "./Types";

export class ControlsManager {
    private activeKeys: Set<string> = new Set();
    private mousePos: Vec2 = { x: 0, y: 0 };;

    constructor() {}

    /**
     * Returns a read-only copy of the currently active (pressed) keys.
     */
    public getActiveKeys(): ReadonlySet<string> {
        return this.activeKeys;
    }

    /**
     * Adds a key to the active key set.
     */
    public addKey(key: string): void {
        this.activeKeys.add(key);
    }

    /**
     * Removes a key from the active key set.
     */
    public removeKey(key: string): void {
        this.activeKeys.delete(key);
    }

    /**
     * Clears all currently active (pressed) keys.
     */
    public clearActiveKeys(): void {
        this.activeKeys.clear();
    }

    /**
     * Returns the current mouse position as a read-only Vec2.
     */
    public getMousePos(): Readonly<Vec2> {
        return this.mousePos;
    }

    /**
     * Updates the stored mouse position.
     */
    public setMousePos(pos: Vec2): void {
        this.mousePos.x = pos.x;
        this.mousePos.y = pos.y;
    }
}