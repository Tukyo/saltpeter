import { SettingsManager } from "./SettingsManager";
import { Vec2 } from "./Types";

export class ControlsManager {
    private activeKeys: Set<string> = new Set();
    private gamepadKeys: Set<string> = new Set();
    private previousKeys: Set<string> = new Set();

    private mousePos: Vec2 = { x: 0, y: 0 };;

    private gamepadConnected: boolean = false;
    public gamepadConnectionEnabled: boolean = true;

    private gamepadRAxis: number | null = null;

    constructor(private settingsManager: SettingsManager) {
        this.initGamepad();
    }

    // #region [ Keys ]
    //
    /**
     * Returns true if the key is currently being held down.
     */
    public held(key: string): boolean {
        return this.activeKeys.has(key);
    }

    /**
     * Returns true if the key was pressed this frame.
     */
    public triggered(key: string): boolean {
        return this.activeKeys.has(key) && !this.previousKeys.has(key);
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
     * Monitors the previous keys set, allowing for action triggers.
     */
    public updatePreviousKeys(): void {
        this.previousKeys = new Set(this.activeKeys);
    }
    //
    // #endregion

    // #region [ Mouse ]
    //
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
    //
    // #endregion

    // #region [ Gamepad ]
    //
    /**
     * Initializes gamepad connection listeners.
     */
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

    /**
     * Used to poll for gamepad inputs when one is connected.
     * 
     * Gamepad bindings map to the keyboard bindings to trigger actions.
     */
    public pollGamepad(): void {
        if (!this.gamepadConnected) return;

        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[0];
        if (!gamepad) return;

        const settings = this.settingsManager.getSettings();
        const keybinds = settings.controls.keybinds;
        const gamepadMap = settings.controls.gamepad;
        const deadzone = gamepadMap.deadzone;

        // Clear previous gamepad keys
        this.gamepadKeys.forEach(key => this.activeKeys.delete(key));
        this.gamepadKeys.clear();

        const xAxis = gamepad.axes[0];
        const yAxis = gamepad.axes[1];

        if (xAxis > deadzone) {
            this.activeKeys.add(keybinds.moveRight);
            this.gamepadKeys.add(keybinds.moveRight);
        }

        if (xAxis < -deadzone) {
            this.activeKeys.add(keybinds.moveLeft);
            this.gamepadKeys.add(keybinds.moveLeft);
        }

        if (yAxis > deadzone) {
            this.activeKeys.add(keybinds.moveDown);
            this.gamepadKeys.add(keybinds.moveDown);
        }

        if (yAxis < -deadzone) {
            this.activeKeys.add(keybinds.moveUp);
            this.gamepadKeys.add(keybinds.moveUp);
        }

        if (gamepad.buttons[gamepadMap.melee].pressed) {
            this.activeKeys.add(keybinds.melee);
            this.gamepadKeys.add(keybinds.melee);
        }

        if (gamepad.buttons[gamepadMap.dash].pressed) {
            this.activeKeys.add(keybinds.dash);
            this.gamepadKeys.add(keybinds.dash);
        }

        if (gamepad.buttons[gamepadMap.reload].pressed) {
            this.activeKeys.add(keybinds.reload);
            this.gamepadKeys.add(keybinds.reload);
        }

        if (gamepad.buttons[gamepadMap.attack].pressed) {
            this.activeKeys.add(keybinds.attack);
            this.gamepadKeys.add(keybinds.attack);
        }

        if (gamepad.buttons[gamepadMap.sprint].pressed) {
            this.activeKeys.add(keybinds.sprint);
            this.gamepadKeys.add(keybinds.sprint);
        }

        // Right stick aiming
        const rightX = gamepad.axes[2];
        const rightY = gamepad.axes[3];
        const aimMagnitude = Math.sqrt(rightX * rightX + rightY * rightY);

        if (aimMagnitude > deadzone) {
            this.gamepadRAxis = Math.atan2(rightY, rightX) + Math.PI / 2;
        } else {
            this.gamepadRAxis = null;
        }
    }

    /**
     * Returns the current right axis input.
     */
    public getGamepadRAxis(): number | null {
        return this.gamepadRAxis;
    }
    //
    // #endregion
}