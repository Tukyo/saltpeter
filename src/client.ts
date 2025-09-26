import { generateUID, getRoomIdFromURL, getRandomColor, hexToRgb } from './utils';
import { RoomManager } from './roomManager';
import { Player, RoomMessage, Projectile, LobbyPlayer, Leaderboard, LeaderboardEntry, Decal } from './defs';
import { PLAYER, CANVAS, GAME, UI, CHAT, DECALS } from './config';

class GameClient {
    private ws: WebSocket | null = null;
    private userId: string;
    private roomManager: RoomManager;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private decalCanvas: HTMLCanvasElement | null = null;
    private decalCtx: CanvasRenderingContext2D | null = null;

    private roomControls: HTMLDivElement | null = null;
    private gameContainer: HTMLDivElement | null = null;
    private userIdDisplay: HTMLSpanElement | null = null;
    private roomIdDisplay: HTMLSpanElement | null = null;
    private lobbyContainer: HTMLDivElement | null = null;
    private lobbyPlayersList: HTMLDivElement | null = null;
    private startGameBtn: HTMLButtonElement | null = null;
    private gameOptionsContainer: HTMLDivElement | null = null;
    private chatContainer: HTMLDivElement | null = null;
    private chatMessages: HTMLDivElement | null = null;
    private chatInput: HTMLInputElement | null = null;
    private chatSendBtn: HTMLButtonElement | null = null;

    private myPlayer: Player;
    private playerVelocityX = 0;
    private playerVelocityY = 0;
    private lastSentX = 0;
    private lastSentY = 0;

    private players: Map<string, Player> = new Map();
    private lobbyPlayers: Map<string, LobbyPlayer> = new Map();
    private projectiles: Map<string, Projectile> = new Map();
    private decals: Map<string, { x: number, y: number, params: Decal }> = new Map();

    private keys: Set<string> = new Set();

    private gameRunning = false;
    private isHost = false;
    private inLobby = false;

    // Shooting mechanics
    private canShoot = true;
    private mouseX = 0;
    private mouseY = 0;
    private currentBurstShot = 0;
    private burstInProgress = false;
    private nextBurstShotTime = 0;
    private projectileOffset = 5;

    private currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
    private isReloading = false;
    private reloadStartTime = 0;

    private leaderboardContainer: HTMLDivElement | null = null;
    private leaderboardBody: HTMLTableSectionElement | null = null;

    private leaderboard: Leaderboard = new Map();
    private roundInProgress = false;
    private roundWinner: string | null = null;
    private gameWinner: string | null = null;
    private alivePlayersCount = 0;

    // #region [ Initialization ]
    //
    constructor() {
        this.userId = generateUID();
        this.roomManager = new RoomManager(this.userId);

        this.myPlayer = {
            id: this.userId,
            x: Math.random() * (CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN,
            y: Math.random() * (CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN,
            color: getRandomColor(),
            health: PLAYER.STATS.HEALTH
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeElements();
                this.setupEventListeners();
                this.checkForRoomInURL();
            });
        } else {
            this.initializeElements();
            this.setupEventListeners();
            this.checkForRoomInURL();
        }
    }

    private initializeElements(): void {
        this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
        this.decalCanvas = document.createElement('canvas') as HTMLCanvasElement;

        this.roomControls = document.getElementById("roomControls") as HTMLDivElement;
        this.gameContainer = document.getElementById("gameContainer") as HTMLDivElement;
        this.lobbyContainer = document.getElementById("lobbyContainer") as HTMLDivElement;
        this.lobbyPlayersList = document.getElementById("lobbyPlayersList") as HTMLDivElement;
        this.startGameBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
        this.gameOptionsContainer = document.getElementById("gameOptionsContainer") as HTMLDivElement;
        this.userIdDisplay = document.getElementById("userId") as HTMLSpanElement;
        this.roomIdDisplay = document.getElementById("roomId") as HTMLSpanElement;

        this.chatContainer = document.getElementById("chatContainer") as HTMLDivElement;
        this.chatMessages = document.getElementById("chatMessages") as HTMLDivElement;
        this.chatInput = document.getElementById("chatInput") as HTMLInputElement;
        this.chatSendBtn = document.getElementById("chatSendBtn") as HTMLButtonElement;

        this.leaderboardContainer = document.getElementById("leaderboardContainer") as HTMLDivElement;
        this.leaderboardBody = document.getElementById("leaderboardBody") as HTMLTableSectionElement;

        if (!this.canvas || !this.decalCanvas || !this.roomControls || !this.gameContainer || !this.lobbyContainer ||
            !this.userIdDisplay || !this.roomIdDisplay || !this.lobbyPlayersList || !this.startGameBtn ||
            !this.gameOptionsContainer || !this.chatContainer || !this.chatMessages || !this.chatInput ||
            !this.chatSendBtn || !this.leaderboardContainer || !this.leaderboardBody) {
            console.error('Some required DOM elements are missing');
            return;
        }

        this.canvas.width = CANVAS.WIDTH;
        this.canvas.height = CANVAS.HEIGHT;
        this.decalCanvas.width = CANVAS.WIDTH;
        this.decalCanvas.height = CANVAS.HEIGHT;

        this.ctx = this.canvas.getContext('2d');
        this.decalCtx = this.decalCanvas.getContext('2d');

        if (!this.ctx || !this.decalCtx) {
            console.error('Could not get canvas context');
            return;
        }

        this.userIdDisplay.textContent = this.userId;
        this.showRoomControls();
    }

    private connectWebSocket(): void {
        const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
        this.ws = new WebSocket(`${wsProtocol}//${location.host}`);

        this.ws.onopen = () => {
            console.log("Connected to WebSocket");
            this.roomManager.setWebSocket(this.ws!);
        };

        this.ws.onclose = () => {
            console.log("Disconnected from WebSocket");
            this.gameRunning = false;
            setTimeout(() => this.connectWebSocket(), GAME.RECONNECT_DELAY);
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }
    //
    // #endregion

    // #region [ Client <> Server ]
    //
    private handleRoomMessage(message: RoomMessage): void {
        switch (message.type) {
            case 'room-created':
                console.log('Room created');
                break;
            case 'room-joined':
                console.log('Joined room - lobby');
                this.isHost = false;
                this.showLobbyControls(message.roomId || '');

                // Send my lobby info
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'lobby-join',
                    color: this.myPlayer.color
                }));

                // Add myself to lobby
                this.lobbyPlayers.set(this.userId, {
                    id: this.userId,
                    color: this.myPlayer.color,
                    isHost: this.isHost
                });
                this.updateLobbyPlayersList();
                this.updateHostDisplay();
                break;
            case 'user-joined':
                console.log(`User ${message.userId} joined`);

                // If I'm in an active game, send my current state to the new player
                if (this.gameRunning && !this.inLobby) {
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-join',
                        x: this.myPlayer.x,
                        y: this.myPlayer.y,
                        color: this.myPlayer.color,
                        leaderboard: Array.from(this.leaderboard.entries())
                    }));
                }
                break;

            case 'room-joined-game': // New message type for joining active games
                console.log('Joined room - game in progress');
                this.isHost = false;
                this.showGameControls(message.roomId || '');
                this.startGameLoop();
                break;
            case 'user-left':
                console.log(`User ${message.userId} left`);
                this.lobbyPlayers.delete(message.userId);
                this.players.delete(message.userId);

                // Remove from leaderboard when player leaves
                this.leaderboard.delete(message.userId);
                this.updateLeaderboardDisplay();
                console.log(`Removed ${message.userId} from leaderboard`);

                // Remove projectiles from disconnected player
                this.projectiles.forEach((projectile, id) => {
                    if (projectile.ownerId === message.userId) {
                        this.projectiles.delete(id);
                    }
                });
                this.updateLobbyPlayersList();
                break;
            case 'room-message':
                this.handleGameMessage(message);
                break;
            case 'room-error':
                alert(`Error: ${message.message}`);
                break;
        }
    }

    private handleGameMessage(message: RoomMessage): void {
        if (!message.message) return;

        try {
            const gameData = JSON.parse(message.message);

            switch (gameData.type) {
                case 'lobby-join':
                    this.lobbyPlayers.set(message.userId, {
                        id: message.userId,
                        color: gameData.color,
                        isHost: false
                    });
                    this.updateLobbyPlayersList();

                    // If I'm host, send current lobby state to new player
                    if (this.isHost) {
                        this.roomManager.sendMessage(JSON.stringify({
                            type: 'lobby-state',
                            players: Array.from(this.lobbyPlayers.values())
                        }));
                    }
                    break;

                case 'lobby-state':
                    // Update my lobby with the current state
                    this.lobbyPlayers.clear();
                    gameData.players.forEach((player: LobbyPlayer) => {
                        this.lobbyPlayers.set(player.id, player);
                    });
                    this.updateLobbyPlayersList();
                    this.updateHostDisplay();
                    break;

                case 'promote-player':
                    // Update host status for all players
                    this.lobbyPlayers.forEach((player, id) => {
                        player.isHost = id === gameData.targetPlayerId;
                    });

                    // Update my own host status
                    this.isHost = gameData.targetPlayerId === this.userId;

                    // If I just became host due to migration, log it
                    if (this.isHost && gameData.reason === 'host-migration') {
                        console.log('I am now the host due to host migration');
                    }

                    this.updateLobbyPlayersList();
                    this.updateHostDisplay();
                    break;

                case 'return-to-lobby': // New message type
                    console.log('Returning to lobby - last player or game ended');
                    this.gameRunning = false;

                    // Update host status if I'm the new host
                    if (gameData.newHostId === this.userId) {
                        this.isHost = true;
                        console.log('I am now the host as the last remaining player');
                    }

                    // Clear game state
                    this.players.clear();
                    this.projectiles.clear();

                    // Show lobby
                    this.showLobbyControls(this.roomManager.getCurrentRoom() || '');
                    break;

                case 'kick-player':
                    if (gameData.targetPlayerId === this.userId) {
                        alert('You have been kicked from the lobby');
                        this.leaveRoom();
                    }
                    break;
                case 'chat_message':
                    if (message.userId !== this.userId) {
                        this.displayChatMessage(message.userId, gameData.message, false);
                    }
                    break;

                case 'start-game':
                    this.showGameControls(this.roomManager.getCurrentRoom() || '');
                    this.startGameLoop();
                    break;

                case 'player-join':
                case 'player-state':
                    if (!this.inLobby) {
                        this.players.set(message.userId, {
                            id: message.userId,
                            x: gameData.x,
                            y: gameData.y,
                            color: gameData.color,
                            health: gameData.health || PLAYER.STATS.HEALTH
                        });
                    }

                    if (gameData.leaderboard) {
                        gameData.leaderboard.forEach(([playerId, entry]: [string, LeaderboardEntry]) => {
                            this.leaderboard.set(playerId, entry);
                        });
                    }

                    this.createLeaderboard();
                    break;

                case 'player-move':
                    if (!this.inLobby && this.players.has(message.userId)) {
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                    }
                    break;
                case 'player-hit':
                    // Remove the projectile for everyone
                    if (gameData.projectileId) {
                        this.projectiles.delete(gameData.projectileId);
                    }

                    if (gameData.targetId === this.userId) {
                        this.myPlayer.health = gameData.newHealth;
                        if (this.myPlayer.health <= 0) {
                            this.recordDeath();
                            this.checkRoundEnd();
                        }
                    } else if (this.players.has(gameData.targetId)) {
                        const hitPlayer = this.players.get(gameData.targetId)!;
                        hitPlayer.health = gameData.newHealth;

                        if (hitPlayer.health <= 0) {
                            console.log(`Player ${hitPlayer.id} died`);
                            this.checkRoundEnd();
                        }
                    }

                    if (gameData.wasKill) {
                        // Increment kills for shooter
                        if (this.leaderboard.has(gameData.shooterId)) {
                            this.leaderboard.get(gameData.shooterId)!.kills++;
                        }
                        // Increment deaths for victim
                        if (this.leaderboard.has(gameData.targetId)) {
                            this.leaderboard.get(gameData.targetId)!.deaths++;
                        }
                        this.updateLeaderboardDisplay();
                    }
                    break;
                case 'player-death':
                    // TODO Death processing
                    break;
                case 'player-respawn':
                    if (this.players.has(message.userId)) {
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                        player.health = gameData.health;
                        console.log(`Player ${player.id} respawned`);
                    }
                    break;

                case 'projectile-launch':
                    if (!this.inLobby && message.userId !== this.userId) {
                        this.projectiles.set(gameData.projectile.id, gameData.projectile);
                    }
                    break;

                case 'projectile-remove':
                    if (!this.inLobby) {
                        this.projectiles.delete(gameData.projectileId);
                    }
                    break;

                case 'round-end':
                    console.log(`Round ended! Winner: ${gameData.winnerId || 'No one'}`);
                    this.roundInProgress = false;
                    this.roundWinner = gameData.winnerId;
                    break;

                case 'game-end':
                    console.log(`Game ended! Winner: ${gameData.winnerId}`);
                    this.gameWinner = gameData.winnerId;
                    break;

                case 'new-round':
                    console.log('New round started! Everyone respawning...');
                    this.roundInProgress = true;
                    this.roundWinner = null;

                    // Respawn other players
                    if (this.players.has(message.userId)) {
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                        player.health = gameData.health;
                    }
                    break;

                case 'add-decal':
                    if (message.userId !== this.userId) {
                        this.applyDecal(gameData.x, gameData.y, gameData.decalId, gameData.params);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error parsing game message:', error);
        }
    }
    //
    // #endregion

    // #region [ Room Management ]
    //
    private showRoomControls(): void {
        this.updateDisplay("room");
    }

    private hostRoom(): void {
        if (!this.ws) {
            this.connectWebSocket();
            setTimeout(() => {
                const roomId = this.roomManager.createRoom();
                this.isHost = true;
                this.showLobbyControls(roomId);
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            const roomId = this.roomManager.createRoom();
            this.isHost = true;
            this.showLobbyControls(roomId);
        }
    }

    private joinRoom(): void {
        const input = prompt("Enter room code or link:");
        if (!input) return;

        let roomId: string | null = null;

        try {
            const url = new URL(input, window.location.origin);
            if (url.pathname.startsWith("/room_")) {
                roomId = url.pathname.replace("/", "").replace("/", "");
            } else {
                roomId = new URLSearchParams(url.search).get("room");
            }
        } catch {
            if (input.startsWith("room_")) {
                roomId = input;
            }
        }

        if (!roomId) {
            alert("Invalid room code or link");
            return;
        }

        if (!this.ws) {
            this.connectWebSocket();
            setTimeout(() => {
                this.roomManager.joinRoom(roomId!);
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            this.roomManager.joinRoom(roomId);
        }
    }

    private quickPlay(): void {
        fetch('/quickplay')
            .then(response => {
                if (!response.ok) {
                    throw new Error('No available rooms');
                }
                return response.json();
            })
            .then(data => {
                if (!this.ws) {
                    this.connectWebSocket();
                    setTimeout(() => {
                        this.roomManager.joinRoom(data.roomId);
                    }, GAME.CONNECTION_TIMEOUT);
                } else {
                    this.roomManager.joinRoom(data.roomId);
                }
            })
            .catch(error => {
                alert('No available games found. Try hosting a new session!');
                console.log('Quickplay error:', error);
            });
    }

    private leaveRoom(): void {
        this.roomManager.leaveRoom();
        this.gameRunning = false;
        this.inLobby = false;
        this.isHost = false;
        this.players.clear();
        this.projectiles.clear();
        this.lobbyPlayers.clear();
        this.clearChat();
        this.clearLeaderboard();
        this.showRoomControls();

        // Clear decals
        this.decals.clear();
        if (this.decalCtx) {
            this.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        }

        // Clear main
        if (this.ctx) {
            this.ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        }
    }

    private checkForRoomInURL(): void {
        const roomId = getRoomIdFromURL();
        if (roomId) {
            this.connectWebSocket();
            setTimeout(() => {
                this.roomManager.joinRoom(roomId);
            }, GAME.CONNECTION_TIMEOUT);
        }
    }

    private copyRoomCode(): void {
        // Get room ID from either lobby or game container
        const roomId = this.inLobby
            ? document.getElementById("roomId")?.textContent
            : document.getElementById("gameRoomId")?.textContent;

        if (!roomId) return;

        navigator.clipboard.writeText(roomId).then(() => {
            alert("Room code copied!");
        }).catch(() => {
            alert("Could not copy. Please copy manually.");
        });
    }
    //
    // #endregion

    // #region [ Lobby Management ]
    //
    private showLobbyControls(roomId: string): void {
        this.updateDisplay("lobby", roomId);

        // Add myself to lobby
        this.lobbyPlayers.set(this.userId, {
            id: this.userId,
            color: this.myPlayer.color,
            isHost: this.isHost
        });

        this.updateLobbyPlayersList();
        this.updateHostDisplay();
    }

    private updateLobbyPlayersList(): void {
        if (!this.lobbyPlayersList) return;

        this.lobbyPlayersList.innerHTML = '';

        // Sort players: host first, then others
        const sortedPlayers = Array.from(this.lobbyPlayers.values()).sort((a, b) => {
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
            if (this.isHost && player.id !== this.userId) {
                const promoteBtn = document.createElement('button');
                promoteBtn.textContent = 'Promote';
                promoteBtn.onclick = () => this.promotePlayer(player.id);

                const kickBtn = document.createElement('button');
                kickBtn.textContent = 'Kick';
                kickBtn.className = 'danger';
                kickBtn.onclick = () => this.kickPlayer(player.id);

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

    private promotePlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'promote-player',
            targetPlayerId: playerId
        }));
    }

    private kickPlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'kick-player',
            targetPlayerId: playerId
        }));
    }

    private returnToLobby(): void {
        this.gameRunning = false;
        this.roundInProgress = false;
        this.leaderboard.clear();
        this.gameWinner = null;
        this.roundWinner = null;
        this.players.clear();
        this.projectiles.clear();

        // Clear decals
        this.decals.clear();
        if (this.decalCtx) {
            this.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        }

        // Clear main
        if (this.ctx) {
            this.ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        }

        // Clear chat
        this.clearChat();

        // Clear leaderboard
        this.clearLeaderboard();

        // Notify others and return to lobby
        this.roomManager.sendMessage(JSON.stringify({
            type: 'return-to-lobby',
            reason: 'game-ended'
        }));

        this.showLobbyControls(this.roomManager.getCurrentRoom() || '');
    }
    //
    // #endregion

    // #region [ Round Management ]
    //
    private checkRoundEnd(): void {
        if (!this.roundInProgress) return;

        // Count alive players (including myself if I'm alive)
        let aliveCount = this.myPlayer.health > 0 ? 1 : 0;
        let lastAlivePlayer = this.myPlayer.health > 0 ? this.userId : null;

        this.players.forEach((player) => {
            if (player.health > 0) {
                aliveCount++;
                lastAlivePlayer = player.id;
            }
        });

        // Round ends when only 1 or 0 players are alive
        if (aliveCount <= 1) {
            this.endRound(lastAlivePlayer);
        }
    }

    private endRound(winnerId: string | null): void {
        if (!this.roundInProgress) return;

        this.roundInProgress = false;
        this.roundWinner = winnerId;

        // Increment win for the winner
        if (winnerId && this.leaderboard.has(winnerId)) {
            const winnerEntry = this.leaderboard.get(winnerId)!;
            winnerEntry.wins++;
            console.log(`${winnerId} won the round! Total wins: ${winnerEntry.wins}`);

            // Check if they've won the game
            if (winnerEntry.wins >= GAME.MAX_WINS) {
                this.endGame(winnerId);
                return; // Don't start a new round
            }

            // Update display to show new win count
            this.updateLeaderboardDisplay();
        }

        // Show round results and start new round after delay
        setTimeout(() => {
            this.startNewRound();
        }, GAME.ROUND_END_DELAY);
    }

    private endGame(winnerId: string): void {
        this.gameWinner = winnerId;
        console.log(`${winnerId} won the game with ${GAME.MAX_WINS} wins!`);

        // Send game end message
        this.roomManager.sendMessage(JSON.stringify({
            type: 'game-end',
            winnerId: winnerId
        }));

        // Return to lobby after delay
        setTimeout(() => {
            this.returnToLobby();
        }, GAME.GAME_END_DELAY);
    }

    private startNewRound(): void {
        console.log('Starting new round...');

        // Reset all players (including myself)
        this.myPlayer.health = PLAYER.STATS.HEALTH;
        this.myPlayer.x = Math.random() * (CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;
        this.myPlayer.y = Math.random() * (CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;

        this.currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
        this.isReloading = false;
        this.burstInProgress = false;
        this.currentBurstShot = 0;

        // Reset all other players
        this.players.forEach(player => {
            player.health = PLAYER.STATS.HEALTH;
            player.x = Math.random() * (CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;
            player.y = Math.random() * (CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;
        });

        this.roundInProgress = true;
        this.roundWinner = null;

        // Notify others of new round with my spawn position
        this.roomManager.sendMessage(JSON.stringify({
            type: 'new-round',
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            health: this.myPlayer.health
        }));
    }
    //
    // #endregion

    // #region [ Chat ]
    //
    private sendChatMessage(): void {
        if (!this.chatInput || !this.chatInput.value.trim()) return;

        const message = this.chatInput.value.trim();
        if (message.length > CHAT.MAX_MESSAGE_LENGTH) {
            alert(`Message too long! Max ${CHAT.MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        // Send message to server
        this.roomManager.sendMessage(JSON.stringify({
            type: 'chat-message',
            message: message,
            timestamp: Date.now()
        }));

        // Display own message immediately
        this.displayChatMessage(this.userId, message, true);

        // Clear input
        this.chatInput.value = '';
    }

    private displayChatMessage(senderId: string, message: string, isOwn: boolean = false): void {
        if (!this.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat_message ${isOwn ? 'own' : 'other'}`;

        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = isOwn ? 'You:' : `${senderId}:`;

        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        contentSpan.textContent = message;

        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentSpan);

        this.chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Limit message history
        while (this.chatMessages.children.length > CHAT.MAX_MESSAGES) {
            this.chatMessages.removeChild(this.chatMessages.firstChild!);
        }
    }

    private clearChat(): void {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        if (this.chatInput) {
            this.chatInput.value = '';
        }
    }
    //
    // #endregion

    // #region [ Events ]
    //
    private setupEventListeners(): void {
        document.getElementById("hostBtn")?.addEventListener("click", () => this.hostRoom());
        document.getElementById("joinBtn")?.addEventListener("click", () => this.joinRoom());
        document.getElementById("quickBtn")?.addEventListener("click", () => this.quickPlay());

        document.getElementById("lobbyLeaveBtn")?.addEventListener("click", () => this.leaveRoom());
        document.getElementById("lobbyCodeBtn")?.addEventListener("click", () => this.copyRoomCode());

        document.getElementById("gameLeaveBtn")?.addEventListener("click", () => this.leaveRoom());
        document.getElementById("gameCodeBtn")?.addEventListener("click", () => this.copyRoomCode());

        this.startGameBtn?.addEventListener("click", () => this.startGame());

        // Chat event listeners
        this.chatSendBtn?.addEventListener("click", () => this.sendChatMessage());
        this.chatInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Add focus/blur listeners to chat input
        this.chatInput?.addEventListener("focus", () => {
            this.keys.clear();
            this.canShoot = false; // Disable shooting when typing
            this.burstInProgress = false;
            this.currentBurstShot = 0;
        });

        this.chatInput?.addEventListener("blur", () => {
            this.keys.clear();
            this.canShoot = true; // Re-enable shooting when done typing
        });

        // Keep keyboard events on document (for WASD movement)
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // CHANGE: Move mouse events to canvas only
        this.canvas?.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas?.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas?.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;

        const key = e.key.toLowerCase();
        if (GAME.CONTROLS.includes(key)) {
            e.preventDefault();
            this.keys.add(key);

            if (key === 'r' && !this.isReloading && this.currentAmmo < PLAYER.ATTACK.MAGAZINE.SIZE) {
                this.startReload();
            }
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;

        const key = e.key.toLowerCase();
        if (GAME.CONTROLS.includes(key)) {
            e.preventDefault();
            this.keys.delete(key);
        }
    }

    private onMouseDown(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || !this.canvas) return;

        if (e.button === 0 && this.canShoot && !this.burstInProgress) { // Left mouse button
            this.updateMousePosition(e);
            this.startBurst(); // Trigger burst on click
            this.canShoot = false; // Prevent shooting until mouse up
        }
    }

    private onMouseUp(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;

        if (e.button === 0) { // Left mouse button
            this.canShoot = true; // Allow shooting again
        }
    }

    private onMouseMove(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;
        this.updateMousePosition(e);
    }

    private updateMousePosition(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }
    //
    // #endregion

    // #region [ Attack ]
    //
    private updateAttack(): void {
        if (!this.gameRunning || this.myPlayer.health <= 0) return;

        const currentTime = Date.now();

        // Handle reload
        if (this.isReloading) {
            if (currentTime >= this.reloadStartTime + PLAYER.ATTACK.RELOAD.TIME) {
                // Reload complete
                this.isReloading = false;
                this.currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
                console.log('Reload complete!');
            }
            return; // Can't shoot while reloading
        }

        // Handle ongoing burst
        if (this.burstInProgress && currentTime >= this.nextBurstShotTime) {
            // Check if we still have ammo and haven't finished the intended burst amount
            const ammoNeeded = PLAYER.ATTACK.BURST.AMOUNT;
            if (this.currentAmmo > 0 && this.currentBurstShot < ammoNeeded) {
                this.launchProjectile();
                this.currentBurstShot++;
                this.currentAmmo--; // Use 1 ammo per shot in burst

                console.log(`Burst shot ${this.currentBurstShot}! Ammo: ${this.currentAmmo}/${PLAYER.ATTACK.MAGAZINE.SIZE}`);

                // Check if we should continue the burst
                if (this.currentBurstShot >= ammoNeeded || this.currentAmmo === 0) {
                    // Burst complete (reached intended amount or out of ammo)
                    this.burstInProgress = false;
                    this.currentBurstShot = 0;
                } else {
                    // Schedule next shot in burst
                    this.nextBurstShotTime = currentTime + PLAYER.ATTACK.BURST.DELAY;
                }
            } else {
                // Out of ammo or reached burst limit
                this.burstInProgress = false;
                this.currentBurstShot = 0;
            }
        }
    }

    private startBurst(): void {
        if (this.burstInProgress || this.myPlayer.health <= 0 || this.isReloading) return;

        // Check if we have enough ammo for the burst
        const ammoNeeded = PLAYER.ATTACK.BURST.AMOUNT;
        const ammoToUse = Math.min(ammoNeeded, this.currentAmmo);

        if (ammoToUse === 0) {
            // TODO: Implement no ammo feedback
            return;
        }

        this.burstInProgress = true;
        this.currentBurstShot = 0;

        // Fire first shot immediately
        this.launchProjectile();
        this.currentBurstShot++;
        this.currentAmmo--; // Use 1 ammo per shot in burst

        // If burst has more shots and we have ammo, schedule the next ones
        if (PLAYER.ATTACK.BURST.AMOUNT > 1 && this.currentAmmo > 0 && this.currentBurstShot < ammoToUse) {
            this.nextBurstShotTime = Date.now() + PLAYER.ATTACK.BURST.DELAY;
        } else {
            // Burst complete (either single shot or out of ammo)
            this.burstInProgress = false;
            this.currentBurstShot = 0;
        }

        console.log(`Fired shot! Ammo: ${this.currentAmmo}/${PLAYER.ATTACK.MAGAZINE.SIZE}`);
    }

    private launchProjectile(): void {
        const dx = this.mouseX - this.myPlayer.x;
        const dy = this.mouseY - this.myPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Calculate spawn offset to prevent immediate collision
        const spawnOffset = PLAYER.STATS.SIZE + PLAYER.PROJECTILE.SIZE + this.projectileOffset;

        // Create projectiles based on PROJECTILE.AMOUNT with spread
        for (let i = 0; i < PLAYER.PROJECTILE.AMOUNT; i++) {
            const spread = (Math.random() - 0.5) * PLAYER.PROJECTILE.SPREAD;
            const angle = Math.atan2(dirY, dirX) + spread;

            const projectile: Projectile = {
                id: generateUID(),
                x: this.myPlayer.x + Math.cos(angle) * spawnOffset, // Spawn with offset
                y: this.myPlayer.y + Math.sin(angle) * spawnOffset, // Spawn with offset
                velocityX: Math.cos(angle) * PLAYER.PROJECTILE.SPEED,
                velocityY: Math.sin(angle) * PLAYER.PROJECTILE.SPEED,
                range: PLAYER.PROJECTILE.RANGE,
                distanceTraveled: 0,
                ownerId: this.userId,
                timestamp: Date.now()
            };

            this.projectiles.set(projectile.id, projectile);

            // Send projectile to other players
            this.roomManager.sendMessage(JSON.stringify({
                type: 'projectile-launch',
                projectile: projectile
            }));
        }
    }

    private updateProjectiles(): void {
        const projectilesToRemove: string[] = [];

        this.projectiles.forEach((projectile, id) => {
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;

            // Update distance traveled
            const frameDistance = Math.sqrt(
                projectile.velocityX * projectile.velocityX +
                projectile.velocityY * projectile.velocityY
            );
            projectile.distanceTraveled += frameDistance;

            // Check collision with my player (only if I'm alive)
            if (this.myPlayer.health > 0) {
                const dx = projectile.x - this.myPlayer.x;
                const dy = projectile.y - this.myPlayer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= PLAYER.STATS.SIZE + PLAYER.PROJECTILE.SIZE) {
                    this.myPlayer.health -= PLAYER.PROJECTILE.DAMAGE;
                    projectilesToRemove.push(id);

                    this.createDecal(projectile.x, projectile.y, `blood_${id}`, DECALS.BLOOD);

                    // Notify everyone I was hit
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-hit',
                        targetId: this.userId,
                        shooterId: projectile.ownerId,
                        damage: PLAYER.PROJECTILE.DAMAGE,
                        newHealth: this.myPlayer.health,
                        projectileId: id
                    }));

                    // Check if I died
                    if (this.myPlayer.health <= 0) {
                        this.recordDeath();
                        this.checkRoundEnd();
                    }
                }
            }

            // Check collision with other players (for my projectiles only)
            if (projectile.ownerId === this.userId) {
                this.players.forEach((player, playerId) => {
                    // Only check collision if the target player is alive
                    if (player.health > 0) {
                        const dx2 = projectile.x - player.x;
                        const dy2 = projectile.y - player.y;
                        const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                        if (distance2 <= PLAYER.STATS.SIZE + PLAYER.PROJECTILE.SIZE) {
                            // Hit another player!
                            projectilesToRemove.push(id);

                            // Calculate their new health
                            const newHealth = Math.max(0, player.health - PLAYER.PROJECTILE.DAMAGE);
                            player.health = newHealth;

                            this.createDecal(projectile.x, projectile.y, `blood_${id}`, DECALS.BLOOD);

                            // If they died, I get a kill
                            if (newHealth <= 0) {
                                console.log(`I killed ${playerId}!`);
                                // Update my own kill count immediately
                                if (this.leaderboard.has(this.userId)) {
                                    this.leaderboard.get(this.userId)!.kills++;
                                }
                                // Update their death count immediately
                                if (this.leaderboard.has(playerId)) {
                                    this.leaderboard.get(playerId)!.deaths++;
                                }
                                this.updateLeaderboardDisplay();
                            }

                            // Notify everyone about the hit
                            this.roomManager.sendMessage(JSON.stringify({
                                type: 'player-hit',
                                targetId: playerId,
                                shooterId: this.userId,
                                damage: PLAYER.PROJECTILE.DAMAGE,
                                newHealth: newHealth,
                                projectileId: id,
                                wasKill: newHealth <= 0
                            }));

                            if (newHealth <= 0) {
                                this.checkRoundEnd();
                            }
                        }
                    }
                });
            }

            // Check if projectile should be removed (range/bounds)
            if (projectile.distanceTraveled >= projectile.range ||
                projectile.x < 0 || projectile.x > CANVAS.WIDTH ||
                projectile.y < 0 || projectile.y > CANVAS.HEIGHT) {

                projectilesToRemove.push(id);

                // Create burn mark where projectile expired (only for my projectiles)
                if (projectile.ownerId === this.userId) {
                    if (projectile.distanceTraveled >= projectile.range) {
                        this.createDecal(projectile.x, projectile.y, `impact_${id}`, DECALS.PROJECTILE);
                    }

                    // Notify others to remove projectile
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'projectile-remove',
                        projectileId: id
                    }));
                }
            }
        });

        // Remove projectiles locally
        projectilesToRemove.forEach(id => {
            this.projectiles.delete(id);
        });
    }

    private startReload(): void {
        if (this.isReloading || this.currentAmmo >= PLAYER.ATTACK.MAGAZINE.SIZE) return;
        
        console.log('Reloading...');
        this.isReloading = true;
        this.reloadStartTime = Date.now();
        
        // Cancel any ongoing burst
        this.burstInProgress = false;
        this.currentBurstShot = 0;
    }
    //
    // #endregion

    // #region [ Player ]
    //
    private updatePlayerPosition(): void {
        if (!this.gameRunning || this.myPlayer.health <= 0) return;

        let inputX = 0;
        let inputY = 0;

        // Get raw input
        if (this.keys.has('w')) inputY -= 1;
        if (this.keys.has('s')) inputY += 1;
        if (this.keys.has('a')) inputX -= 1;
        if (this.keys.has('d')) inputX += 1;

        // Normalize diagonal input
        const inputLength = Math.sqrt(inputX * inputX + inputY * inputY);
        if (inputLength > 0) {
            inputX = inputX / inputLength;
            inputY = inputY / inputLength;
        }

        // Calculate target velocity
        const targetVelocityX = inputX * PLAYER.STATS.SPEED;
        const targetVelocityY = inputY * PLAYER.STATS.SPEED;

        // Apply acceleration towards target
        this.playerVelocityX += (targetVelocityX - this.playerVelocityX) * PLAYER.PHYSICS.ACCELERATION;
        this.playerVelocityY += (targetVelocityY - this.playerVelocityY) * PLAYER.PHYSICS.ACCELERATION;

        // Apply friction ONLY when no input
        if (inputLength === 0) {
            this.playerVelocityX *= PLAYER.PHYSICS.FRICTION;
            this.playerVelocityY *= PLAYER.PHYSICS.FRICTION;
        }

        // Calculate new position
        let newX = this.myPlayer.x + this.playerVelocityX;
        let newY = this.myPlayer.y + this.playerVelocityY;

        // Check boundaries
        let moved = false;

        if (newX >= PLAYER.VISUAL.BORDER_MARGIN && newX <= CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN) {
            this.myPlayer.x = newX;
            moved = true;
        } else {
            this.playerVelocityX = 0;
        }

        if (newY >= PLAYER.VISUAL.BORDER_MARGIN && newY <= CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN) {
            this.myPlayer.y = newY;
            moved = true;
        } else {
            this.playerVelocityY = 0;
        }

        // Only send if moved far enough from last sent position
        const distanceFromLastSent = Math.sqrt(
            (this.myPlayer.x - this.lastSentX) ** 2 +
            (this.myPlayer.y - this.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2) { // Only send if moved more than 2 pixels
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                x: this.myPlayer.x,
                y: this.myPlayer.y
            }));

            this.lastSentX = this.myPlayer.x;
            this.lastSentY = this.myPlayer.y;
        }

        // Clean up tiny velocities
        if (Math.abs(this.playerVelocityX) < 0.01) this.playerVelocityX = 0;
        if (Math.abs(this.playerVelocityY) < 0.01) this.playerVelocityY = 0;
    }

    private recordDeath(): void {
        console.log('I died! Waiting for round to end...');

        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-death',
            playerId: this.userId
        }));
    }
    //
    // #endregion

    // #region [ Game ]
    //
    private showGameControls(roomId: string): void {
        this.updateDisplay("game", roomId);
    }

    private startGame(): void {
        if (!this.isHost) return;

        // Send start game message to other players
        this.roomManager.sendMessage(JSON.stringify({
            type: 'start-game'
        }));

        // Also start the game for myself as the host
        this.showGameControls(this.roomManager.getCurrentRoom() || '');
        this.startGameLoop();
    }

    private startGameLoop(): void {
        this.gameRunning = true;
        this.roundInProgress = true;

        this.currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
        this.isReloading = false;

        this.createLeaderboard();

        // Send my initial position
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-join',
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            color: this.myPlayer.color,
            health: this.myPlayer.health
        }));

        this.gameLoop();
    }

    private gameLoop(): void {
        if (!this.gameRunning || !this.ctx || !this.canvas || !this.decalCtx || !this.decalCanvas) return;

        // Update
        this.updatePlayerPosition();
        this.updateAttack();
        this.updateProjectiles();

        // Clear canvas - used to show bg img
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw decals
        if (this.decalCanvas) {
            this.ctx.drawImage(this.decalCanvas, 0, 0)
        }

        // Draw border
        this.ctx.strokeStyle = CANVAS.BORDER_COLOR;
        this.ctx.lineWidth = CANVAS.BORDER_WIDTH;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw projectiles
        this.projectiles.forEach(projectile => {
            this.drawProjectile(projectile);
        });

        // Draw other players
        this.players.forEach(player => {
            this.drawPlayer(player);
        });

        // Draw my player
        this.drawPlayer(this.myPlayer, true);

        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }
    //
    // #endregion

    // #region [ Leaderboard ]
    //
    private createLeaderboard(): void {
        console.log('Creating/updating leaderboard for all players');

        // Get all current players (from game or lobby)
        const allPlayers = new Set<string>();

        // Add myself
        allPlayers.add(this.userId);

        // Add players from game
        this.players.forEach((_, playerId) => {
            allPlayers.add(playerId);
        });

        // Add players from lobby
        this.lobbyPlayers.forEach((_, playerId) => {
            allPlayers.add(playerId);
        });

        // Create/update leaderboard entries for all players
        allPlayers.forEach(playerId => {
            if (!this.leaderboard.has(playerId)) {
                // Create new entry with 0 stats
                this.leaderboard.set(playerId, {
                    playerId: playerId,
                    wins: 0,
                    kills: 0,
                    deaths: 0
                });
                console.log(`Created leaderboard entry for ${playerId}`);
            }
            // If entry already exists, leave it alone (preserves existing stats)
        });

        // Update the visual display
        this.updateLeaderboardDisplay();

        console.log('Leaderboard created/updated:', Array.from(this.leaderboard.entries()));
    }

    private updateLeaderboardDisplay(): void {
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
            if (playerId === this.userId) {
                row.classList.add('current-player');
            }

            // Player name
            const nameCell = document.createElement('td');
            nameCell.textContent = playerId === this.userId ? 'You' : playerId.substring(0, 8);
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

    private clearLeaderboard(): void {
        this.leaderboard.clear();
        if (this.leaderboardBody) {
            this.leaderboardBody.innerHTML = '';
        }
    }
    //
    // #endregion

    // #region [ Rendering ]
    //
    private drawPlayer(player: Player, isMe: boolean = false): void {
        if (!this.ctx) return;
        if (player.health <= 0) return;

        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, PLAYER.STATS.SIZE, 0, 2 * Math.PI);
        this.ctx.fillStyle = player.color;
        this.ctx.fill();

        if (isMe) {
            this.ctx.strokeStyle = UI.TEXT_COLOR;
            this.ctx.lineWidth = PLAYER.VISUAL.STROKE_WIDTH;
            this.ctx.stroke();
        }

        // Draw player info
        this.ctx.fillStyle = UI.TEXT_COLOR;
        this.ctx.font = UI.FONT;
        this.ctx.textAlign = 'center';

        const displayName = isMe ? 'You' : player.id.substring(0, 6);
        this.ctx.fillText(
            displayName,
            player.x,
            player.y - PLAYER.VISUAL.ID_DISPLAY_OFFSET
        );
    }

    private drawProjectile(projectile: Projectile): void {
        if (!this.ctx) return;

        // Calculate projectile direction
        const speed = Math.sqrt(projectile.velocityX * projectile.velocityX + projectile.velocityY * projectile.velocityY);
        const dirX = projectile.velocityX / speed;
        const dirY = projectile.velocityY / speed;

        // Calculate front and back points
        const frontX = projectile.x + dirX * (PLAYER.PROJECTILE.LENGTH / 2);
        const frontY = projectile.y + dirY * (PLAYER.PROJECTILE.LENGTH / 2);
        const backX = projectile.x - dirX * (PLAYER.PROJECTILE.LENGTH / 2);
        const backY = projectile.y - dirY * (PLAYER.PROJECTILE.LENGTH / 2);

        // Draw the capsule body (rectangle)
        this.ctx.fillStyle = PLAYER.PROJECTILE.COLOR;
        this.ctx.strokeStyle = PLAYER.PROJECTILE.COLOR;
        this.ctx.lineWidth = PLAYER.PROJECTILE.SIZE * 2;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(backX, backY);
        this.ctx.lineTo(frontX, frontY);
        this.ctx.stroke();
    }
    //
    // #endregion

    // #region [ Decals ]
    //
    private createDecal(x: number, y: number, decalId: string, params: Decal = DECALS.PROJECTILE): void {
        if (!this.decalCtx) return;

        // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        const numPixels = Math.floor((params.radius * params.radius * Math.PI) * params.density);

        const rgb = hexToRgb(params.color);
        if (!rgb) {
            console.error(`Invalid hex color: ${params.color}`);
            return;
        }

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        // Create scattered decal pixels around impact point
        for (let i = 0; i < numPixels; i++) {
            // Random position within decal radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * params.radius;
            const pixelX = x + Math.cos(angle) * distance;
            const pixelY = y + Math.sin(angle) * distance;

            // Skip if outside canvas
            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Random opacity with variation
            const opacity = params.opacity + (Math.random() - 0.5) * params.variation;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, opacity));

            // Use custom color from params
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
            this.decalCtx.fillRect(Math.floor(pixelX), Math.floor(pixelY), 1, 1);
        }

        this.decalCtx.restore();

        // Store decal with params for network sync
        this.decals.set(decalId, { x, y, params });

        // Send decal to other clients with params
        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-decal',
            decalId: decalId,
            x: x,
            y: y,
            params: params
        }));
    }

    private applyDecal(x: number, y: number, decalId: string, params: Decal): void {
        if (!this.decalCtx) return;

        // Don't create duplicate decals
        if (this.decals.has(decalId)) return;

        // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        const numPixels = Math.floor((params.radius * params.radius * Math.PI) * params.density);

        const rgb = hexToRgb(params.color);
        if (!rgb) {
            console.error(`Invalid hex color: ${params.color}`);
            return;
        }

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        // Create scattered decal pixels around impact point
        for (let i = 0; i < numPixels; i++) {
            // Random position within decal radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * params.radius;
            const pixelX = x + Math.cos(angle) * distance;
            const pixelY = y + Math.sin(angle) * distance;

            // Skip if outside canvas
            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Random opacity with variation
            const opacity = params.opacity + (Math.random() - 0.5) * params.variation;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, opacity));

            // Use custom color from params
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
            this.decalCtx.fillRect(Math.floor(pixelX), Math.floor(pixelY), 1, 1);
        }

        this.decalCtx.restore();

        // Store decal with params
        this.decals.set(decalId, { x, y, params });
    }
    //
    // #endregion

    // #region [ UI ]
    //
    private updateDisplay(target: "lobby" | "room" | "game", roomId?: string): void {
        if (!this.roomControls || !this.lobbyContainer || !this.gameContainer ||
            !this.chatContainer || !this.leaderboardContainer) return;

        // Hide all
        this.roomControls.style.display = "none";
        this.lobbyContainer.style.display = "none";
        this.gameContainer.style.display = "none";
        this.chatContainer.style.display = "none";
        this.leaderboardContainer.style.display = "none";

        switch (target) {
            case "lobby":
                this.lobbyContainer.style.display = "flex";
                this.chatContainer.style.display = "flex"; // Show chat in lobby
                if (roomId && this.roomIdDisplay) {
                    this.roomIdDisplay.textContent = roomId;
                }
                this.inLobby = true;
                break;

            case "room":
                this.roomControls.style.display = "flex";
                // Chat not shown in main menu
                break;

            case "game":
                this.gameContainer.style.display = "flex";
                this.chatContainer.style.display = "flex"; // Show chat in game
                this.leaderboardContainer.style.display = "flex"; // Show leaderboard in game
                if (roomId) {
                    const gameRoomId = document.getElementById("gameRoomId");
                    if (gameRoomId) gameRoomId.textContent = roomId;
                }
                this.inLobby = false;
                break;
        }
    }

    private updateHostDisplay(): void {
        if (!this.startGameBtn) return;

        this.startGameBtn.style.display = this.isHost ? 'block' : 'none';
        this.startGameBtn.disabled = this.lobbyPlayers.size < 1;

        if (this.gameOptionsContainer) {
            this.gameOptionsContainer.style.display = this.isHost ? 'flex' : 'none';
        }
    }
    //
    // #endregion
}

// Initialize the game client
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GameClient();
    });
} else {
    new GameClient();
}