import { CANVAS } from "./Config";

import { Leaderboard, Players } from "./Types";
import { LobbyManager } from "./LobbyManager";

export class UserInterface {
    public canvas: HTMLCanvasElement | null = null;
    public ctx: CanvasRenderingContext2D | null = null;
    public decalCanvas: HTMLCanvasElement | null = null;
    public decalCtx: CanvasRenderingContext2D | null = null;
    public ammoReservesCanvas: HTMLCanvasElement | null = null;
    public ammoReservesCtx: CanvasRenderingContext2D | null = null;

    public roomControls: HTMLDivElement | null = null;
    public gameContainer: HTMLDivElement | null = null;
    public userIdDisplay: HTMLSpanElement | null = null;
    public roomIdDisplay: HTMLSpanElement | null = null;
    public gameRoomIdDisplay: HTMLSpanElement | null = null;
    public lobbyContainer: HTMLDivElement | null = null;
    public lobbyPlayersList: HTMLDivElement | null = null;
    public startGameBtn: HTMLButtonElement | null = null;
    public gameOptionsContainer: HTMLDivElement | null = null;
    public chatContainer: HTMLDivElement | null = null;
    public chatMessages: HTMLDivElement | null = null;
    public chatInput: HTMLInputElement | null = null;
    public chatSendBtn: HTMLButtonElement | null = null;
    public privateToggle: HTMLElement | null = null;
    public upgradesToggle: HTMLElement | null = null;
    public winsInput: HTMLInputElement | null = null;
    public playersInput: HTMLInputElement | null = null;
    public upgradeContainer: HTMLElement | null = null;

    public modal: HTMLElement | null = null;
    public modalInput: HTMLInputElement | null = null;
    public modalButtons: HTMLDivElement | null = null;
    public modalConfirmButton: HTMLButtonElement | null = null;
    public modalCancelButton: HTMLButtonElement | null = null;
    public modalErrorDiv: HTMLElement | null = null;
    public modalContent: HTMLElement | null = null;
    public modalText: HTMLSpanElement | null = null;

    public hostButton: HTMLButtonElement | null = null;
    public joinButton: HTMLButtonElement | null = null;
    public quickplayButton: HTMLButtonElement | null = null;
    public lobbyLeaveButton: HTMLButtonElement | null = null;
    public lobbyCodeButton: HTMLButtonElement | null = null;
    public gameLeaveButton: HTMLButtonElement | null = null;
    public gameCodeButton: HTMLButtonElement | null = null;

    public leaderboardContainer: HTMLDivElement | null = null;
    public leaderboardBody: HTMLTableSectionElement | null = null;
    public leaderboard: Leaderboard = new Map();

    constructor() { }
    
    // #region [ Init ]
    //
    /**
     * Responsible for initializing all elements defined in the class structure.
     * 
     * Do not use "getElement" type lookups on runtime. Cache them all on start.
     */
    public initInterface() {
        this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
        this.decalCanvas = document.createElement('canvas') as HTMLCanvasElement;
        this.ammoReservesCanvas = document.getElementById("ammoReservesCanvas") as HTMLCanvasElement;

        this.roomControls = document.getElementById("roomControls") as HTMLDivElement;
        this.gameContainer = document.getElementById("gameContainer") as HTMLDivElement;
        this.lobbyContainer = document.getElementById("lobbyContainer") as HTMLDivElement;
        this.lobbyPlayersList = document.getElementById("lobbyPlayersList") as HTMLDivElement;
        this.startGameBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
        this.gameOptionsContainer = document.getElementById("gameOptionsContainer") as HTMLDivElement;

        this.userIdDisplay = document.getElementById("userId") as HTMLSpanElement;
        this.roomIdDisplay = document.getElementById("roomId") as HTMLSpanElement;
        this.gameRoomIdDisplay = document.getElementById("gameRoomId") as HTMLSpanElement;

        this.chatContainer = document.getElementById("chatContainer") as HTMLDivElement;
        this.chatMessages = document.getElementById("chatMessages") as HTMLDivElement;
        this.chatInput = document.getElementById("chatInput") as HTMLInputElement;
        this.chatSendBtn = document.getElementById("chatSendBtn") as HTMLButtonElement;

        this.privateToggle = document.getElementById('privateToggle') as HTMLElement;
        this.upgradesToggle = document.getElementById('upgradesToggle') as HTMLElement;
        this.winsInput = document.getElementById('winsInput') as HTMLInputElement;
        this.playersInput = document.getElementById('playersInput') as HTMLInputElement;

        this.upgradeContainer = document.getElementById('upgradeContainer') as HTMLElement;

        this.leaderboardContainer = document.getElementById("leaderboardContainer") as HTMLDivElement;
        this.leaderboardBody = document.getElementById("leaderboardBody") as HTMLTableSectionElement;

        this.hostButton = document.getElementById("atomHost") as HTMLButtonElement;
        this.joinButton = document.getElementById("atomJoin") as HTMLButtonElement;
        this.quickplayButton = document.getElementById("atomQuickplay") as HTMLButtonElement;

        this.lobbyLeaveButton = document.getElementById("lobbyLeaveBtn") as HTMLButtonElement;
        this.lobbyCodeButton = document.getElementById("lobbyCodeBtn") as HTMLButtonElement;

        this.gameLeaveButton = document.getElementById("gameLeaveBtn") as HTMLButtonElement;
        this.gameCodeButton = document.getElementById("gameCodeBtn") as HTMLButtonElement;

        this.modal = document.getElementById('modal') as HTMLDivElement;
        this.modalInput = document.getElementById('joinRoomInput') as HTMLInputElement;
        this.modalButtons = document.getElementById('modalButtons') as HTMLDivElement;
        this.modalConfirmButton = document.getElementById('joinRoomConfirmBtn') as HTMLButtonElement;
        this.modalCancelButton = document.getElementById('joinRoomCancelBtn') as HTMLButtonElement;
        this.modalErrorDiv = document.getElementById('joinRoomError') as HTMLDivElement;
        this.modalContent = document.getElementById('modalContent') as HTMLDivElement;
        this.modalText = document.getElementById('modalText') as HTMLSpanElement;

        if (!this.canvas || !this.decalCanvas || !this.ammoReservesCanvas || !this.roomControls || !this.gameContainer ||
            !this.lobbyContainer || !this.userIdDisplay || !this.roomIdDisplay || !this.gameRoomIdDisplay ||
            !this.lobbyPlayersList || !this.startGameBtn || !this.gameOptionsContainer ||
            !this.chatContainer || !this.chatMessages || !this.chatInput || !this.chatSendBtn ||
            !this.privateToggle || !this.upgradesToggle || !this.winsInput || !this.playersInput ||
            !this.upgradeContainer || !this.leaderboardContainer ||
            !this.leaderboardBody || !this.hostButton || !this.joinButton || !this.quickplayButton ||
            !this.lobbyLeaveButton || !this.lobbyCodeButton || !this.gameLeaveButton ||
            !this.gameCodeButton) {
            alert('Failed to load game. Please refresh the page.');
            throw new Error('Critical error: Required DOM elements are missing.');
        }

        this.canvas.width = CANVAS.WIDTH;
        this.canvas.height = CANVAS.HEIGHT;
        this.decalCanvas.width = CANVAS.WIDTH;
        this.decalCanvas.height = CANVAS.HEIGHT;
        this.ammoReservesCanvas.width = 100;
        this.ammoReservesCanvas.height = 64;

        this.ctx = this.canvas.getContext('2d');
        this.decalCtx = this.decalCanvas.getContext('2d');
        this.ammoReservesCtx = this.ammoReservesCanvas.getContext('2d');

        if (!this.ctx || !this.decalCtx || !this.ammoReservesCtx) {
            alert('Failed to load game. Please refresh the page.');
            throw new Error('Could not get canvas context');
        }
    }
    //
    // #endregion

    // #region [ Display Management ]
    //
    /**
     * Updates the display based on the current state.
     */
    public updateDisplay(
        lobby: LobbyManager,
        target: "lobby" | "room" | "game",
        roomId?: string
    ): void {
        if (!this.roomControls || !this.lobbyContainer || !this.gameContainer ||
            !this.chatContainer || !this.leaderboardContainer) return;


        this.clearDisplay();

        switch (target) {
            case "lobby":
                this.lobbyContainer.style.display = "flex";
                this.chatContainer.style.display = "flex";
                if (roomId && this.roomIdDisplay) {
                    this.roomIdDisplay.textContent = roomId;
                }
                lobby.inLobby = true;
                break;

            case "room":
                this.roomControls.style.display = "flex";
                break;

            case "game":
                this.gameContainer.style.display = "flex";
                this.chatContainer.style.display = "flex";
                this.leaderboardContainer.style.display = "flex";
                if (roomId) {
                    const gameRoomId = this.gameRoomIdDisplay;
                    if (gameRoomId) gameRoomId.textContent = roomId;
                }
                lobby.inLobby = false;
                break;
        }
    }

    /**
     * Shows host controls when called.
     */
    public updateHostDisplay(
        isHost: boolean,
        lobby: LobbyManager
    ): void {
        if (!this.startGameBtn || !this.gameOptionsContainer) return;

        this.startGameBtn.style.display = isHost ? 'block' : 'none';
        this.startGameBtn.disabled = lobby.lobbyPlayers.size < 1;

        this.gameOptionsContainer.style.display = isHost ? 'flex' : 'none';
    }

    /**
     * Displays connected players in the lobby interface.
     */
    public displayLobbyPlayers(
        isHost: boolean,
        lobby: LobbyManager,
        userId: string
    ): void {
        if (!this.lobbyPlayersList) return;

        this.lobbyPlayersList.innerHTML = '';

        // Sort players: host first, then others
        const sortedPlayers = Array.from(lobby.lobbyPlayers.values()).sort((a, b) => {
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            return 0;
        });

        sortedPlayers.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lobby_player';

            const colorDiv = document.createElement('div');
            colorDiv.className = 'player_color';
            colorDiv.style.backgroundColor = player.color;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'player_name';
            nameDiv.textContent = `${player.id}${player.isHost ? ' (Host)' : ''}`;

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'player_controls';

            // Only show controls if I'm the host and this isn't me
            if (isHost && player.id !== userId) {
                const promoteBtn = document.createElement('button');
                promoteBtn.textContent = 'Promote';
                promoteBtn.onclick = () => lobby.promotePlayer(player.id);

                const kickBtn = document.createElement('button');
                kickBtn.textContent = 'Kick';
                kickBtn.className = 'danger';
                kickBtn.onclick = () => lobby.kickPlayer(player.id);

                controlsDiv.appendChild(promoteBtn);
                controlsDiv.appendChild(kickBtn);
            }

            playerDiv.appendChild(colorDiv);
            playerDiv.appendChild(nameDiv);
            playerDiv.appendChild(controlsDiv);

            if (this.lobbyPlayersList) {
                this.lobbyPlayersList.appendChild(playerDiv);
            }
        });
    }

    /**
     * Refreshes the display to a blank slate.
     */
    private clearDisplay(): void {
        if (!this.roomControls || !this.lobbyContainer || !this.gameContainer ||
            !this.chatContainer || !this.leaderboardContainer || !this.upgradeContainer) return;

        this.roomControls.style.display = "none";
        this.lobbyContainer.style.display = "none";
        this.gameContainer.style.display = "none";
        this.chatContainer.style.display = "none";
        this.leaderboardContainer.style.display = "none";
        this.upgradeContainer.style.display = "none";
    }
    //
    // #endregion

    // #region [ Modal & Popup ]
    //
    /**
     * Shows the join room modal for pasting room codes.
     */
    public showJoinRoomModal(onConfirm: (roomId: string) => void): void {
        if (!this.modal || !this.modalInput || !this.modalConfirmButton ||
            !this.modalCancelButton || !this.modalErrorDiv) return;

        this.modal.classList.remove('hidden');
        this.modalInput.value = '';
        this.modalErrorDiv.textContent = '';

        this.modalInput.focus();

        const closeModal = () => {
            if (!this.modal || !this.modalInput || !this.modalConfirmButton ||
                !this.modalCancelButton || !this.modalErrorDiv) return;

            this.modal.classList.add('hidden');
            this.modalConfirmButton.onclick = null;
            this.modalCancelButton.onclick = null;
            this.modalInput.onkeydown = null;
        };

        this.modalConfirmButton.onclick = () => {
            if (!this.modalInput || !this.modalErrorDiv) return;

            const value = this.modalInput.value.trim();
            if (!value) {
                this.modalErrorDiv.textContent = 'Invalid code...';
                return;
            }

            let roomId: string | null = null;
            try {
                const url = new URL(value, window.location.origin);
                if (url.pathname.startsWith("/room_")) {
                    roomId = url.pathname.replace("/", "");
                } else {
                    roomId = new URLSearchParams(url.search).get("room");
                }
            } catch {
                if (value.startsWith("room_")) {
                    roomId = value;
                }
            }

            if (!roomId) {
                this.modalErrorDiv.textContent = 'Invalid code...';
                return;
            }

            closeModal();
            onConfirm(roomId); // pass back the parsed roomId
        };

        this.modalCancelButton.onclick = closeModal;
    }

    /**
     * Displays a wanring modal if the player starts a game alone.
     */
    public soloGameWarning(onConfirm: () => void): void {
        if (!this.modal || !this.modalConfirmButton || !this.modalCancelButton ||
            !this.modalContent || !this.modalText || !this.modalInput ||
            !this.modalErrorDiv || !this.modalButtons) return;

        this.modal.classList.remove('hidden');
        this.modalInput.style.display = 'none';
        this.modalErrorDiv.textContent = ' ';
        this.modalButtons.style.display = 'flex';
        this.modalCancelButton.style.display = 'flex';

        this.modalText.textContent = 'Start game as only player? Other players will be unable to join until you return to the lobby.';
        this.modalConfirmButton.textContent = 'Start Game';
        this.modalCancelButton.textContent = 'Cancel';

        const closeModal = () => {
            if (!this.modal || !this.modalInput || !this.modalConfirmButton ||
                !this.modalCancelButton || !this.modalText) return;

            this.modal.classList.add('hidden');
            this.modalInput.style.display = 'flex';
            this.modalText.textContent = 'Join Room';
            this.modalConfirmButton.onclick = null;
            this.modalCancelButton.onclick = null;
        };

        this.modalConfirmButton.onclick = () => {
            closeModal();
            onConfirm(); // Proceed with starting the game
        };

        this.modalCancelButton.onclick = closeModal;
    }
    //
    // #endregion

    // #region [ Leaderboard ]
    //
    /**
     * Locally initialize the leaderboard, or update it if it already exists.
     */
    public createLeaderboard(
        lobby: LobbyManager,
        players: Players,
        userId: string
    ): void {
        // Create a set of all players
        const allPlayers = new Set<string>();
        allPlayers.add(userId);
        players.forEach((_, playerId) => {
            allPlayers.add(playerId);
        });
        lobby.lobbyPlayers.forEach((_, playerId) => {
            allPlayers.add(playerId);
        });

        // Create/update leaderboard entries for all players
        allPlayers.forEach(playerId => {
            if (!this.leaderboard.has(playerId)) {
                this.leaderboard.set(playerId, { // Create new entry with 0 stats
                    playerId: playerId,
                    wins: 0,
                    kills: 0,
                    deaths: 0
                });
                console.log(`Created leaderboard entry for ${playerId}`);
            }
            // If entry already exists, leave it alone (preserves existing stats)
        });

        this.updateLeaderboardDisplay(userId);
        console.log('Leaderboard created/updated:', Array.from(this.leaderboard.entries()));
    }

    /**
     * Update the table for the leaderboard to display the current game status.
     */
    public updateLeaderboardDisplay(localPlayer: string): void {
        if (!this.leaderboardBody) return;

        // Clear existing rows
        this.leaderboardBody.innerHTML = '';

        // Sort by wins (highest first), then by kills
        const sortedEntries = Array.from(this.leaderboard.entries()).sort((a, b) => {
            const [, entryA] = a;
            const [, entryB] = b;

            // First sort by wins (descending)
            if (entryB.wins !== entryA.wins) {
                return entryB.wins - entryA.wins;
            }
            // Then by kills (descending)
            return entryB.kills - entryA.kills;
        });

        // Create table rows
        sortedEntries.forEach(([playerId, entry]) => {
            const row = document.createElement('tr');
            row.className = 'leaderboard_row';

            // Highlight current player
            if (playerId === localPlayer) {
                row.classList.add('current-player');
            }

            // Player name
            const nameCell = document.createElement('td');
            nameCell.textContent = playerId === localPlayer ? 'You' : playerId.substring(0, 8);
            nameCell.className = 'player_name';
            row.appendChild(nameCell);

            // Wins
            const winsCell = document.createElement('td');
            winsCell.textContent = entry.wins.toString();
            winsCell.className = 'wins';
            row.appendChild(winsCell);

            // Kills
            const killsCell = document.createElement('td');
            killsCell.textContent = entry.kills.toString();
            killsCell.className = 'kills';
            row.appendChild(killsCell);

            // Deaths
            const deathsCell = document.createElement('td');
            deathsCell.textContent = entry.deaths.toString();
            deathsCell.className = 'deaths';
            row.appendChild(deathsCell);

            if (this.leaderboardBody) {
                this.leaderboardBody.appendChild(row);
            }
        });
    }

    /**
     * Reset the leaderboard to default state.
     */
    public clearLeaderboard(): void {
        this.leaderboard.clear();
        if (this.leaderboardBody) {
            this.leaderboardBody.innerHTML = '';
        }
    }
    //
    // #endregion
}