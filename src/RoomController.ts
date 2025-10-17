import { GAME } from "./Config";

import { GameState } from "./GameState";
import { LobbyManager } from "./LobbyManager";
import { RoomManager } from "./RoomManager";
import { UpgradeManager } from "./UpgradeManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";
import { WebsocketManager } from "./WebsocketManager";

import { PlayerState } from "./player/PlayerState";

export class RoomController {
    constructor(
        private gameState: GameState,
        private lobbyManager: LobbyManager,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private upgradeManager: UpgradeManager,
        private userId: string,
        private utility: Utility,
        private wsManager: WebsocketManager
    ) { }

    /**
     * Calls updateDisplay to show the room specific controls.
     */
    public showRoomControls(): void {
        this.ui.updateDisplay(this.lobbyManager, "room");
    }

    /**
     * Creates a websocket connection on the server, and a room with the roomManager.
     */
    public hostRoom(): void {
        if (!this.wsManager.getWebSocket()) {
            this.wsManager.connectWebSocket();
            this.utility.safeTimeout(() => {
                const roomId = this.roomManager.createRoom();
                if (!roomId) return;

                this.playerState.isHost = true;
                this.lobbyManager.showLobbyControls(
                    this.gameState.gameMaxPlayers,
                    this.gameState.gameMaxWins,
                    this.playerState.isHost,
                    this.roomManager.isPrivateRoom,
                    this.upgradeManager.isUpgradesEnabled,
                    this.lobbyManager,
                    this.playerState.myPlayer,
                    roomId,
                    this.userId
                );
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            const roomId = this.roomManager.createRoom();
            if (!roomId) return;
            
            this.playerState.isHost = true;
            this.lobbyManager.showLobbyControls(
                this.gameState.gameMaxPlayers,
                this.gameState.gameMaxWins,
                this.playerState.isHost,
                this.roomManager.isPrivateRoom,
                this.upgradeManager.isUpgradesEnabled,
                this.lobbyManager,
                this.playerState.myPlayer,
                roomId,
                this.userId
            );
        }
    }

    /**
     * Displays the room joining modal, and allows pasting of room code.
     */
    public joinRoom(): void {
        this.ui.showJoinRoomModal((roomId: string) => {
            this.joinRoomById(roomId);
        });
    }

    /**
     * Directly connect to a game with it's room id.
     * 
     * Called by the room join modal.
     */
    private joinRoomById(roomId: string): void {
        if (!roomId) return;
        if (!this.wsManager.getWebSocket()) {
            this.wsManager.connectWebSocket();
            this.utility.safeTimeout(() => {
                this.roomManager.joinRoom(roomId!);
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            this.roomManager.joinRoom(roomId);
        }
    }

    /**
     * Calls quickplay endpoint on server to find a random open public room.
     */
    public quickPlay(): void {
        fetch('/quickplay')
            .then(response => {
                if (!response.ok) {
                    throw new Error('No available rooms');
                }
                return response.json();
            })
            .then(data => {
                if (!this.wsManager.getWebSocket()) {
                    this.wsManager.connectWebSocket();
                    this.utility.safeTimeout(() => {
                        this.roomManager.joinRoom(data.roomId);
                    }, GAME.CONNECTION_TIMEOUT);
                } else {
                    this.roomManager.joinRoom(data.roomId);
                }
            })
            .catch(error => {
                if (!this.ui.modal || !this.ui.modalConfirmButton || !this.ui.modalCancelButton ||
                    !this.ui.modalContent || !this.ui.modalText || !this.ui.modalInput ||
                    !this.ui.modalErrorDiv || !this.ui.modalButtons) return;

                this.ui.modal.classList.remove('hidden');
                this.ui.modalInput.style.display = 'none';
                this.ui.modalErrorDiv.textContent = ' ';
                this.ui.modalButtons.style.display = 'flex';
                this.ui.modalCancelButton.style.display = 'none';

                this.ui.modalText.textContent = 'No available games found.';

                this.ui.modalConfirmButton.textContent = 'Confirm';
                this.ui.modalConfirmButton.onclick = () => {
                    if (!this.ui.modal || !this.ui.modalInput || !this.ui.modalCancelButton ||
                        !this.ui.modalText || !this.ui.modalConfirmButton) return;

                    this.ui.modal.classList.add('hidden');
                    this.ui.modalInput.style.display = 'flex';
                    this.ui.modalText.textContent = 'Join Room';
                    this.ui.modalCancelButton.style.display = 'flex';
                    this.ui.modalConfirmButton.onclick = null;
                };
            });
    }

    /**
     * Called when leaving the current room - resets game state.
     */
    public leaveRoom(): void {
        this.roomManager.leaveRoom();

        window.dispatchEvent(new CustomEvent("customEvent_resetGameState", {
            detail: { resetType: "Room" }
        }));

        this.showRoomControls();
    }

    /**
     * Used to check for a room link in the URL when loading the page.
     */
    public checkForRoomInURL(): void {
        const roomId = this.getRoomIdFromURL();
        if (roomId) {
            this.wsManager.connectWebSocket();
            this.utility.safeTimeout(() => {
                this.roomManager.joinRoom(roomId);
            }, GAME.CONNECTION_TIMEOUT);
        }
    }

    /**
     * [DO NOT CALL - Call checkForRoomInURL] Directly parses the room ID from the URL if one is found. 
     */
    private getRoomIdFromURL(): string | null {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('room');
    }

    /**
     * Gets the room ID contextually, and copies it to clipboard.
     */
    public copyRoomCode(): void {
        // Get room ID from either lobby or game container
        const roomId = this.lobbyManager.inLobby
            ? this.ui.roomIdDisplay?.textContent
            : this.ui.gameRoomIdDisplay?.textContent;

        if (!roomId) return;

        navigator.clipboard.writeText(roomId).then(() => {
            if (!this.ui.modal || !this.ui.modalConfirmButton || !this.ui.modalCancelButton ||
                !this.ui.modalContent || !this.ui.modalText || !this.ui.modalInput ||
                !this.ui.modalErrorDiv || !this.ui.modalButtons) return;

            this.ui.modal.classList.remove('hidden');
            this.ui.modalInput.style.display = 'none';
            this.ui.modalErrorDiv.textContent = ' ';
            this.ui.modalButtons.style.display = 'flex';
            this.ui.modalCancelButton.style.display = 'none';

            this.ui.modalText.textContent = 'Room code copied!';
            this.ui.modalConfirmButton.textContent = 'Confirm';

            // Define the close function
            const closeModal = () => {
                if (!this.ui.modal || !this.ui.modalInput || !this.ui.modalCancelButton ||
                    !this.ui.modalText || !this.ui.modalConfirmButton) return;

                this.ui.modal.classList.add('hidden');
                this.ui.modalInput.style.display = 'flex';
                this.ui.modalText.textContent = 'Join Room';
                this.ui.modalCancelButton.style.display = 'flex';
                this.ui.modalConfirmButton.onclick = null;
            };

            this.ui.modalConfirmButton.onclick = closeModal;

            // Auto-close after 3 seconds
            this.utility.safeTimeout(() => {
                if (this.ui.modal && !this.ui.modal.classList.contains('hidden')) {
                    closeModal();
                }
            }, 3000);
        }).catch(() => {
            alert("Could not copy. Please copy manually.");
        });
    }
}