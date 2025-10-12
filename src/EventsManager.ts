import { NETWORK } from "./config";

import { Animator } from "./Animator";
import { ChatManager } from "./ChatManager";
import { ControlsManager } from "./ControlsManager";
import { GameState } from "./GameState";
import { LobbyManager } from "./LobbyManager";
import { CombatController } from "./player/CombatController";
import { DashController } from "./player/DashController";
import { MoveController } from "./player/MoveController";
import { PlayerState } from "./PlayerState";
import { RoomController } from "./RoomController";
import { RoomManager } from "./RoomManager";
import { SettingsManager } from "./SettingsManager";
import { UserInterface } from "./UserInterface";

export class EventsManager {
    constructor(
        private animator: Animator,
        private chatManager: ChatManager,
        private combatController: CombatController,
        private controlsManager: ControlsManager,
        private dashController: DashController,
        private gameState: GameState,
        private lobbyManager: LobbyManager,
        private moveController: MoveController,
        private roomController: RoomController,
        private roomManager: RoomManager,
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

        // Chat event listeners
        this.ui.chatSendBtn.addEventListener("click", () => this.chatManager.sendChatMessage(this.userId));
        this.ui.chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.chatManager.sendChatMessage(this.userId);
            }
        });

        // Add focus/blur listeners to chat input
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

        // Listen on document for events, not canvas.
        // If this presents issues, swap "document." with "this.interface.canvas"
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameState.gameInProgress && !this.lobbyManager.inLobby) {
                e.preventDefault();
                // TODO: Test stuff here!
            }
        });

        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        this.ui.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e)); // Canvas only listening for mouse (shooting mainly)
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

        switch (key) {
            case keybinds.dash:
                this.dashController.startDash();
                break;
            case keybinds.melee:
                if (this.combatController.canMelee()) this.combatController.triggerAttack("melee");
                break;
            case keybinds.reload:
                this.combatController.startReload();
                break;
            case keybinds.sprint:
                if (this.moveController.isMoving()) this.playerState.isSprinting = true;
                break;
            // TODO: Add more actions here as needed
        }
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

        if (key === keybinds.sprint) {
            this.playerState.isSprinting = false;
        }
    }

    /**
     * Handles all mouse click events.
     */
    private onMouseDown(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress || this.gameState.isPaused || !this.ui.canvas) return;

        if (e.button === 0 && this.playerState.canShoot && !this.playerState.isBurstActive && !this.playerState.isMelee) { // Left mouse button
            this.updateMouse(e);
            this.combatController.triggerAttack('ranged');
            this.playerState.canShoot = false; // Prevent shooting until mouse up
        }
    }

    /**
     * Handles all mouse release events.
     */
    private onMouseUp(e: MouseEvent): void {
        if (this.ui.chatInput === document.activeElement) return;
        if (!this.gameState.gameInProgress) return;

        if (e.button === 0) { // Left mouse button
            this.playerState.canShoot = true; // Allow shooting again
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

        const now = Date.now();
        const rotationDiff = Math.abs(rotation - this.playerState.lastSentRotation);
        if (rotationDiff > 0.1 && now - this.playerState.lastSentRotationTime >= NETWORK.ROTATE_INTERVAL) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    rot: this.playerState.myPlayer.transform.rot
                }
            }));

            this.playerState.lastSentRotation = rotation;
            this.playerState.lastSentRotationTime = now;
        }
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
}