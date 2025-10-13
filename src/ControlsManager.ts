import { SettingsManager } from "./SettingsManager";
import { Vec2 } from "./Types";

export class ControlsManager {
    private activeKeys: Set<string> = new Set();
    private mousePos: Vec2 = { x: 0, y: 0 };;

    private gamepadConnected: boolean = false;
    private gamepadConnectionEnabled: boolean = true;

    constructor(private settingsManager: SettingsManager) {
        this.initGamepad();
        if (this.gamepadConnectionEnabled) this.startPolling();
    }

    private initGamepad(): void {
        window.addEventListener("gamepadconnected", () => {
            console.log("Gamepad connected!");
            this.gamepadConnected = true;
        });

        window.addEventListener("gamepaddisconnected", () => {
            console.log("Gamepad disconnected!");
            this.gamepadConnected = false;
        });
    }

    private startPolling(): void {
        const poll = () => {
            this.pollGamepad();
            requestAnimationFrame(poll);
        };
        poll();
    }

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

    public pollGamepad(): void {
        if (!this.gamepadConnected) return;

        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[0];
        if (!gamepad) return;

        const keybinds = this.settingsManager.getSettings().controls.keybinds;
        const gamepadMap = this.settingsManager.getSettings().controls.gamepad;
        const deadzone = 0.2;

        // Map left stick to movement keys
        const xAxis = gamepad.axes[0];
        const yAxis = gamepad.axes[1];

        if (xAxis > deadzone) this.activeKeys.add(keybinds.moveRight);
        else this.activeKeys.delete(keybinds.moveRight);

        if (xAxis < -deadzone) this.activeKeys.add(keybinds.moveLeft);
        else this.activeKeys.delete(keybinds.moveLeft);

        if (yAxis > deadzone) this.activeKeys.add(keybinds.moveDown);
        else this.activeKeys.delete(keybinds.moveDown);

        if (yAxis < -deadzone) this.activeKeys.add(keybinds.moveUp);
        else this.activeKeys.delete(keybinds.moveUp);

        // Map buttons using gamepad config
        if (gamepad.buttons[gamepadMap.melee].pressed) this.activeKeys.add(keybinds.melee);
        else this.activeKeys.delete(keybinds.melee);

        if (gamepad.buttons[gamepadMap.dash].pressed) this.activeKeys.add(keybinds.dash);
        else this.activeKeys.delete(keybinds.dash);

        if (gamepad.buttons[gamepadMap.reload].pressed) this.activeKeys.add(keybinds.reload);
        else this.activeKeys.delete(keybinds.reload);

        if (gamepad.buttons[gamepadMap.attack].pressed) this.activeKeys.add('mouse1');
        else this.activeKeys.delete('mouse1');

        if (gamepad.buttons[gamepadMap.sprint].pressed) this.activeKeys.add(keybinds.sprint);
        else this.activeKeys.delete(keybinds.sprint);
    }
}