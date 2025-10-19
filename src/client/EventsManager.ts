import { GAMEPAD_MAP } from "./Config";

import { Animator } from "./Animator";
import { ChatManager } from "./ChatManager";
import { ControlsManager } from "./ControlsManager";
import { GameState } from "./GameState";
import { RoomController } from "./RoomController";
import { SettingsManager } from "./SettingsManager";
import { UserInterface } from "./UserInterface";

import { PlayerState } from "./player/PlayerState";

export class EventsManager {
    constructor(
        private animator: Animator,
        private chatManager: ChatManager,
        private controlsManager: ControlsManager,
        private gameState: GameState,
        private roomController: RoomController,
        private playerState: PlayerState,
        private settingsManager: SettingsManager,
        private ui: UserInterface,
        private userId: string
    ) { }

    // #region [ Events ]
    //
    /**
     * Initializes all event listeners to the required DOM elements.
     */
    public initEventListeners(): void {
        if (!this.ui.canvas || !this.ui.hostButton || !this.ui.joinButton || !this.ui.quickplayButton ||
            !this.ui.lobbyLeaveButton || !this.ui.lobbyCodeButton || !this.ui.gameLeaveButton ||
            !this.ui.gameCodeButton || !this.ui.startGameBtn || !this.ui.chatSendBtn || !this.ui.chatInput) return;

        this.ui.hostButton.addEventListener("click", () => this.roomController.hostRoom());
        this.ui.joinButton.addEventListener("click", () => this.roomController.joinRoom());
        this.ui.quickplayButton.addEventListener("click", () => this.roomController.quickPlay());
        this.ui.lobbyLeaveButton.addEventListener("click", () => this.roomController.leaveRoom());
        this.ui.lobbyCodeButton.addEventListener("click", () => this.roomController.copyRoomCode());
        this.ui.gameLeaveButton.addEventListener("click", () => this.roomController.leaveRoom());
        this.ui.gameCodeButton.addEventListener("click", () => this.roomController.copyRoomCode());
        this.ui.startGameBtn.addEventListener("click", () => this.onStartButtonClick());

        // [ Chat ]
        this.ui.chatSendBtn.addEventListener("click", () => this.chatManager.sendChatMessage(this.userId));
        this.ui.chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.chatManager.sendChatMessage(this.userId);
            }
        });
        this.ui.chatInput.addEventListener("focus", () => {
            this.controlsManager.clearActiveKeys();

            this.playerState.canShoot = false;
            this.playerState.isSprinting = false;
            this.playerState.isDashing = false;
            this.playerState.isBurstActive = false;
            this.playerState.currentBurstShot = 0;
        });

        this.ui.chatInput.addEventListener("blur", () => {
            this.controlsManager.clearActiveKeys();

            this.playerState.canShoot = true;
            this.playerState.isSprinting = false;
            this.playerState.isDashing = false;
        });

        this.ui.settingsButton?.addEventListener('click', () => {
            this.ui.showSettingsPage();
        });

        this.ui.settingsCloseButton?.addEventListener('click', () => {
            this.ui.hideSettingsPage();
        })

        // Prevent right-click context menu on the entire window
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Listen on document for events, not canvas.
        // If this presents issues, swap "document." with "this.interface.canvas"
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        this.ui.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e)); // Canvas only listening for mouse (shooting mainly)

        this.ui.switchSettingsPage('sound'); // Init settings page to sound tab on dom load

        this.ui.controlsTab?.addEventListener('click', () => {
            this.ui.switchSettingsPage('controls');
        });

        this.ui.graphicsTab?.addEventListener('click', () => {
            this.ui.switchSettingsPage('graphics');
        });

        this.ui.soundTab?.addEventListener('click', () => {
            this.ui.switchSettingsPage('sound');
        });

        // Settings page click to open when hidden
        this.ui.controlsBody?.addEventListener('click', () => {
            if (this.ui.controlsBody?.classList.contains('settings_page_hidden')) {
                this.ui.switchSettingsPage('controls');
            }
        });

        this.ui.graphicsBody?.addEventListener('click', () => {
            if (this.ui.graphicsBody?.classList.contains('settings_page_hidden')) {
                this.ui.switchSettingsPage('graphics');
            }
        });

        this.ui.soundBody?.addEventListener('click', () => {
            if (this.ui.soundBody?.classList.contains('settings_page_hidden')) {
                this.ui.switchSettingsPage('sound');
            }
        });

        this.initSettingsAudioSliders();
        this.initSettingsInputListeners();
        this.initSettingsToggleListeners();
    }

    /**
     * Handles all key press events.
     */
    private onKeyDown(e: KeyboardEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress || this.gameState.isPaused) return;

        const key = e.key.toLowerCase();
        const keybinds = this.settingsManager.getSettings().controls.keybinds;

        const isGameKey = Object.values(keybinds).includes(key);
        if (!isGameKey) return;

        e.preventDefault();
        this.controlsManager.addKey(key);
    }

    /**
     * Handles all key release events.
     */
    private onKeyUp(e: KeyboardEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress) return;

        const key = e.key.toLowerCase();
        const keybinds = this.settingsManager.getSettings().controls.keybinds;

        if (!Object.values(keybinds).includes(key)) return;

        e.preventDefault();
        this.controlsManager.removeKey(key);
    }

    /**
     * Handles all mouse click events.
     */
    private onMouseDown(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress || this.gameState.isPaused || !this.ui.canvas) return;

        if (e.button === 0) {
            this.updateMouse(e);
            this.controlsManager.addKey('mouse1'); // Left Click
        } else if (e.button === 1) {
            this.controlsManager.addKey('mouse3'); // Middle Click
        } else if (e.button === 2) {
            this.updateMouse(e);
            this.controlsManager.addKey('mouse2'); // Right Click
        }
    }

    /**
     * Handles all mouse release events.
     */
    private onMouseUp(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress) return;

        if (e.button === 0) {
            this.controlsManager.removeKey('mouse1'); // Left Click
        } else if (e.button === 1) {
            this.controlsManager.addKey('mouse3'); // Middle Click
        } else if (e.button === 2) {
            this.controlsManager.removeKey('mouse2'); // Right Click
        }
    }

    /**
     * Handles all mouse movement events.
     */
    private onMouseMove(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress || this.gameState.isPaused) return;

        this.updateMouse(e);
        const mousePos = this.controlsManager.getMousePos();

        // Calculate rotation based on mouse position
        const dx = mousePos.x - this.playerState.myPlayer.transform.pos.x;
        const dy = mousePos.y - this.playerState.myPlayer.transform.pos.y;
        const rotation = Math.atan2(dy, dx) + Math.PI / 2;

        // Rotate my character
        this.animator.rotateCharacterPart(this.userId, rotation);
    }

    /**
     * Processes mouse position and updates.
     */
    private updateMouse(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.ui.canvas) return;

        const rect = this.ui.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.controlsManager.setMousePos({ x, y });
    }

    /**
     * Called when the Start Game button is pressed.
     */
    private onStartButtonClick(): void {
        const event = new CustomEvent("customEvent_startGame");
        window.dispatchEvent(event);
    }
    //
    // #endregion

    // #region [ Settings Page ]
    //
    /**
     * Initializes event listeners for audio sliders on audio settings page.
     */
    private initSettingsAudioSliders(): void {
        const sliders = [
            { slider: this.ui.masterSlider, fill: this.ui.masterFill, value: this.ui.masterValue, channel: 'master' },
            { slider: this.ui.interfaceSlider, fill: this.ui.interfaceFill, value: this.ui.interfaceValue, channel: 'interface' },
            { slider: this.ui.musicSlider, fill: this.ui.musicFill, value: this.ui.musicValue, channel: 'music' },
            { slider: this.ui.sfxSlider, fill: this.ui.sfxFill, value: this.ui.sfxValue, channel: 'sfx' },
            { slider: this.ui.voiceSlider, fill: this.ui.voiceFill, value: this.ui.voiceValue, channel: 'voice' }
        ];

        sliders.forEach(({ slider, fill, value, channel }) => {
            if (!slider || !fill || !value) return;

            slider.addEventListener('mousedown', (e) => {
                const handleMove = (moveEvent: MouseEvent) => {
                    const sliderValue = this.ui.calculateSliderValue(slider, moveEvent.clientX);
                    this.ui.updateSettingsSlider(fill, value, sliderValue);

                    this.settingsManager.updateSettings({
                        audio: {
                            mixer: {
                                [channel]: sliderValue
                            }
                        }
                    });
                };

                const handleUp = () => {
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleUp);
                };

                handleMove(e);
                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', handleUp);
                e.preventDefault();
            });
        });
    }

    /**
     * Initializes event listeners for input fields on all settings pages.
     */
    private initSettingsInputListeners(): void {
        const inputs = [
            { input: this.ui.deadzoneInput, settingPath: 'controls.gamepad.deadzone', parse: parseFloat }
            // Future inputs go here: { input: this.ui.someInput, settingPath: 'path.to.setting', parse: parseFloat }
        ];

        inputs.forEach(({ input, settingPath, parse }) => {
            if (!input) return;

            input.addEventListener('change', () => {
                const rawValue = input.value;
                const parsedValue = parse(rawValue);

                if (isNaN(parsedValue)) return; // Invalid input

                // Build nested update object
                const pathParts = settingPath.split('.');
                const update: any = {};
                let current = update;

                for (let i = 0; i < pathParts.length - 1; i++) {
                    current[pathParts[i]] = {};
                    current = current[pathParts[i]];
                }
                current[pathParts[pathParts.length - 1]] = parsedValue;

                this.settingsManager.updateSettings(update);
            });
        });
    }

    /**
     * Initializes event listeners for toggles on all settings pages.
     */
    private initSettingsToggleListeners(): void {
        const toggles = [
            { toggle: this.ui.particleJSToggle, settingPath: 'graphics.renderBackgroundParticles' },
            { toggle: this.ui.staticVfxToggle, settingPath: 'graphics.showStaticOverlay' },
            { toggle: this.ui.ammoReservesPhysicsToggle, settingPath: 'graphics.physics.ammoReserves' }
        ];

        toggles.forEach(({ toggle, settingPath }) => {
            if (!toggle) return;

            toggle.addEventListener('click', () => {
                const currentValue = toggle.getAttribute('aria-checked') === 'true';
                const newValue = !currentValue;

                // Update toggle visually
                if (newValue) {
                    toggle.setAttribute('checked', 'true');
                    toggle.setAttribute('aria-checked', 'true');
                } else {
                    toggle.removeAttribute('checked');
                    toggle.setAttribute('aria-checked', 'false');
                }

                // Build nested update object
                const pathParts = settingPath.split('.');
                const update: any = {};
                let current = update;

                for (let i = 0; i < pathParts.length - 1; i++) {
                    current[pathParts[i]] = {};
                    current = current[pathParts[i]];
                }
                current[pathParts[pathParts.length - 1]] = newValue;

                this.settingsManager.updateSettings(update);
            });
        });
    }

    /**
     * Initializes the keybinds interface, with user prefs or defaults.
     * 
     * Also sets up keybind change listeners.
     */
    public initKeybindListeners(): void {
        const controlsSettings = this.settingsManager.getSettings().controls;
        this.ui.initKeybindsInterface(
            controlsSettings,
            (action, type, newBinding) => this.onBindingChange(action, type, newBinding)
        );
    }

    /**
     * Event that fires on keybind or gamepad press when input change modal is visible.
     */
    public onBindingChange(action: string, type: 'keybind' | 'gamepad', newBinding: string | number): void {
        if (type === 'keybind') {
            this.settingsManager.updateSettings({
                controls: {
                    keybinds: {
                        [action]: newBinding as string
                    }
                }
            });

            const element = document.getElementById(`${action}Keybind`);
            if (element) {
                element.textContent = newBinding === ' ' ? 'SPACE' : (newBinding as string).toUpperCase();
            }
        } else {
            this.settingsManager.updateSettings({
                controls: {
                    gamepad: {
                        [action]: newBinding as number
                    }
                }
            });

            const element = document.getElementById(`${action}Gamepad`);
            if (element) {
                const buttonName = Object.keys(GAMEPAD_MAP).find(
                    key => typeof GAMEPAD_MAP[key as keyof typeof GAMEPAD_MAP] === 'number'
                        && GAMEPAD_MAP[key as keyof typeof GAMEPAD_MAP] === newBinding
                );
                element.textContent = buttonName || newBinding.toString();
            }
        }
    }
}