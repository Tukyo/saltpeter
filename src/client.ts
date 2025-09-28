import { generateUID, getRoomIdFromURL, getRandomColor, hexToRgb, setSlider, updateToggle, updateInput } from './utils';
import { RoomManager } from './roomManager';
import { Player, RoomMessage, Projectile, LobbyPlayer, Leaderboard, LeaderboardEntry } from './defs';
import { PLAYER, CANVAS, GAME, UI, CHAT, DECALS, PARTICLES } from './config';
import { applyUpgrade, getUpgrades, removeUpgradeFromPool, resetUpgrades, UPGRADES } from './upgrades';

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
    private gameRoomIdDisplay: HTMLSpanElement | null = null;
    private lobbyContainer: HTMLDivElement | null = null;
    private lobbyPlayersList: HTMLDivElement | null = null;
    private startGameBtn: HTMLButtonElement | null = null;
    private gameOptionsContainer: HTMLDivElement | null = null;
    private chatContainer: HTMLDivElement | null = null;
    private chatMessages: HTMLDivElement | null = null;
    private chatInput: HTMLInputElement | null = null;
    private chatSendBtn: HTMLButtonElement | null = null;
    private privateToggle: HTMLElement | null = null;
    private winsInput: HTMLInputElement | null = null;

    private myPlayer: Player;
    private playerVelocityX = 0;
    private playerVelocityY = 0;
    private lastSentX = 0;
    private lastSentY = 0;

    private defaultPlayerConfig = JSON.parse(JSON.stringify(PLAYER));

    private players: Map<string, Player> = new Map();
    private lobbyPlayers: Map<string, LobbyPlayer> = new Map();
    private projectiles: Map<string, Projectile> = new Map();
    private decals: Map<string, {
        params: typeof DECALS[keyof typeof DECALS] | null,
        x: number,
        y: number
    }> = new Map();
    private particles: Map<string, {
        age: number,
        collide: boolean,
        color: string,
        fade: boolean,
        hasCollided: boolean,
        id: string,
        lifetime: number,
        maxOpacity: number,
        opacity: number,
        paint: boolean,
        rotation: number,
        size: number,
        stain: boolean,
        torque: number,
        velocityX: number,
        velocityY: number,
        x: number,
        y: number
    }> = new Map();

    private keys: Set<string> = new Set();

    private gamePaused = false; // Tracks paused state of game
    private gameRunning = false; // Actual websocket connection tracking, deeper than pause
    private pausedPlayers = new Set<string>();

    private isHost = false;
    private inLobby = false;
    private isPrivateRoom = false;
    private gameMaxWins = GAME.MAX_WINS;

    // Shooting mechanics
    private canShoot = true;
    private mouseX = 0;
    private mouseY = 0;
    private currentBurstShot = 0;
    private burstInProgress = false;
    private nextBurstShotTime = 0;
    private projectileOffset = 5;

    private inventoryAmmo = Math.floor(PLAYER.INVENTORY.MAX_AMMO / 2);
    private currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;

    private isReloading = false;
    private reloadStartTime = 0;

    private isSprinting = false;
    private isDashing = false;

    private dashStartTime = 0;
    private lastDashTime = 0;

    private currentStamina = PLAYER.STATS.MAX_STAMINA;
    private lastStaminaDrainTime = 0;
    private staminaRecoveryBlocked = false;
    private staminaRecoveryBlockedUntil = 0;

    private leaderboardContainer: HTMLDivElement | null = null;
    private leaderboardBody: HTMLTableSectionElement | null = null;

    private completedUpgrades = new Set<string>();

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
            health: PLAYER.STATS.MAX_HEALTH
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
        this.gameRoomIdDisplay = document.getElementById("gameRoomId") as HTMLSpanElement;

        this.chatContainer = document.getElementById("chatContainer") as HTMLDivElement;
        this.chatMessages = document.getElementById("chatMessages") as HTMLDivElement;
        this.chatInput = document.getElementById("chatInput") as HTMLInputElement;
        this.chatSendBtn = document.getElementById("chatSendBtn") as HTMLButtonElement;

        this.privateToggle = document.getElementById('privateToggle') as HTMLElement;
        this.winsInput = document.getElementById('winsInput') as HTMLInputElement;

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
                //
                // #region [ Lobby ]
                //
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
                            players: Array.from(this.lobbyPlayers.values()),
                            options: {
                                privateRoom: this.isPrivateRoom,
                                maxWins: this.gameMaxWins
                                // TODO: Add more room options here as enabled
                            }
                        }));
                    }
                    break;
                case 'lobby-state':
                    this.lobbyPlayers.clear();

                    gameData.players.forEach((player: LobbyPlayer) => {
                        this.lobbyPlayers.set(player.id, player);
                    });

                    this.updateLobbyPlayersList();
                    this.updateHostDisplay();

                    if (gameData.options) {
                        this.syncLobbyOptions(gameData.options);
                    }
                    break;
                case 'lobby-options':
                    this.syncLobbyOptions(gameData);
                    break;
                case 'promote-player':
                    this.lobbyPlayers.forEach((player, id) => { // Update host status for all players
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
                //
                // #endregion
                //
                // #region [ Chat ]
                //
                case 'chat-message':
                    if (message.userId !== this.userId) {
                        this.displayChatMessage(message.userId, gameData.message, false);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Player ]
                //
                case 'player-join':
                case 'player-state':
                    if (!this.inLobby) {
                        this.players.set(message.userId, {
                            id: message.userId,
                            x: gameData.x,
                            y: gameData.y,
                            color: gameData.color,
                            health: gameData.health || PLAYER.STATS.MAX_HEALTH
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
                    if (gameData.projectileId) { // Remove the projectile for everyone
                        this.projectiles.delete(gameData.projectileId);
                    }

                    if (gameData.targetId === this.userId) {
                        this.myPlayer.health = gameData.newHealth;
                        setSlider('healthBar', this.myPlayer.health, PLAYER.STATS.MAX_HEALTH);

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
                        if (this.leaderboard.has(gameData.shooterId)) { // Increment kills for shooter
                            this.leaderboard.get(gameData.shooterId)!.kills++;
                        }
                        if (this.leaderboard.has(gameData.targetId)) { // Increment deaths for victim
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
                case 'player-pause':
                    this.pausedPlayers.add(gameData.userId);
                    this.updatePauseState();
                    console.log(`${gameData.userId} paused the game`);
                    break;

                case 'player-unpause':
                    this.pausedPlayers.delete(gameData.userId);
                    this.updatePauseState();
                    console.log(`${gameData.userId} unpaused`);
                    break;
                //
                // #endregion
                //
                // #region [ Projectile ]
                //
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
                //
                // #endregion
                //
                // #region [ Game ]
                //
                case 'start-game':
                    this.showGameControls(this.roomManager.getCurrentRoom() || '');
                    this.startGameLoop();
                    break;
                case 'game-end':
                    console.log(`Game ended! Winner: ${gameData.winnerId}`);
                    this.gameWinner = gameData.winnerId;
                    break;
                //
                // #endregion
                //
                // #region [ Round ]
                //
                case 'round-end':
                    console.log(`Round ended! Winner: ${gameData.winnerId || 'No one'}`);
                    this.roundInProgress = false;
                    this.roundWinner = gameData.winnerId;
                    break;
                case 'new-round':
                    console.log('New round started! Everyone respawning...');
                    this.roundInProgress = true;
                    this.roundWinner = null;

                    if (this.players.has(message.userId)) { // Respawn other players
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                        player.health = gameData.health;
                    }
                    break;
                case 'upgrade-taken':
                    if (gameData.upgradeId && gameData.isUnique) {
                        removeUpgradeFromPool(gameData.upgradeId);
                        console.log(`Unique upgrade ${gameData.upgradeId} taken by ${message.userId}`);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Upgrade ]
                //
                case 'upgrade-complete':
                    this.togglePause();

                    // If no one is paused anymore, everyone is done - start new round
                    if (this.pausedPlayers.size === 0) {
                        setTimeout(() => {
                            this.startNewRound();
                        }, 500);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Visual ]
                //
                case 'add-decal':
                    if (message.userId !== this.userId) {
                        this.applyDecal(gameData.x, gameData.y, gameData.decalId, gameData.params);
                    }
                    break;
                case 'add-particles':
                    if (message.userId !== this.userId) {
                        this.applyParticles(
                            gameData.x,
                            gameData.y,
                            gameData.particleId,
                            gameData.particleData,
                            gameData.color,
                            gameData.collide,
                            gameData.fade
                        );
                    }
                    break;
                case 'particle-stamp':
                    if (message.userId !== this.userId) {
                        this.applyParticleStamp( // TODO: pass ParticleStamp type params object instead
                            gameData.x,
                            gameData.y,
                            gameData.stampId,
                            gameData.color,
                            gameData.opacity,
                            gameData.size,
                            gameData.rotation,
                            gameData.torque
                        );
                    }
                    break;
                //
                // #endregion
                //
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
        this.resetPlayerConfig();

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
            ? this.roomIdDisplay?.textContent
            : this.gameRoomIdDisplay?.textContent;

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

        this.setupLobbyOptions();
        updateToggle('privateToggle', this.isPrivateRoom);
        updateInput('winsInput', this.gameMaxWins);

        this.updateLobbyPlayersList();
        this.updateHostDisplay();
    }

    private setupLobbyOptions(): void {
        if (this.privateToggle) {
            this.privateToggle.addEventListener('click', () => {
                if (!this.isHost) return; // Only host can change options

                this.isPrivateRoom = !this.isPrivateRoom;
                updateToggle('privateToggle', this.isPrivateRoom);

                // Send lobby options update to all clients
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'lobby-options',
                    privateRoom: this.isPrivateRoom
                }));

                console.log(`Room privacy changed to: ${this.isPrivateRoom ? 'Private' : 'Public'}`);
            });
        }

        if (this.winsInput) {
            this.winsInput.addEventListener('change', () => {
                if (!this.isHost) return; // Only host can change options
                if (!this.winsInput) return;

                const newWins = parseInt(this.winsInput.value);
                if (isNaN(newWins) || newWins < 1) {
                    this.winsInput.value = this.gameMaxWins.toString();
                    return;
                }

                this.gameMaxWins = newWins;
                updateInput('winsInput', this.gameMaxWins);

                // Send lobby options update to all clients
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'lobby-options',
                    maxWins: this.gameMaxWins
                }));

                console.log(`Game max wins changed to: ${this.gameMaxWins}`);
            });
        }
    }

    private syncLobbyOptions(options: any): void { // TODO: Type protect options later once formulated
        if (options.privateRoom !== undefined) {
            this.isPrivateRoom = options.privateRoom;
            updateToggle('privateToggle', this.isPrivateRoom);
            console.log(`Lobby privacy synced to: ${this.isPrivateRoom ? 'Private' : 'Public'}`);
        }

        // TODO: Add more option syncing here
        if (options.maxWins !== undefined) {
            this.gameMaxWins = options.maxWins;
            updateInput('winsInput', this.gameMaxWins);
            console.log(`Game max wins synced to: ${this.gameMaxWins}`);
        }
        // if (options.upgradesEnabled !== undefined) { ... }
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

        this.clearChat();
        this.clearLeaderboard();
        this.resetPlayerConfig();
        resetUpgrades();

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

            // Check if they've won the game - use dynamic max wins
            if (winnerEntry.wins >= this.gameMaxWins) {
                this.endGame(winnerId);
                return; // Don't start a new round
            }

            // Update display to show new win count
            this.updateLeaderboardDisplay();
        }

        // Show round results and start upgrade phase after delay
        setTimeout(() => {
            this.startUpgradePhase(winnerId);
        }, GAME.ROUND_END_DELAY);
    }

    private endGame(winnerId: string): void {
        this.gameWinner = winnerId;
        console.log(`${winnerId} won the game with ${this.gameMaxWins} wins!`);

        this.resetPlayerConfig();
        this.pausedPlayers.clear();
        resetUpgrades();

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
        this.myPlayer.health = PLAYER.STATS.MAX_HEALTH;
        this.myPlayer.x = Math.random() * (CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;
        this.myPlayer.y = Math.random() * (CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN * 2) + PLAYER.VISUAL.BORDER_MARGIN;

        this.currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
        this.isReloading = false;
        this.burstInProgress = false;
        this.currentBurstShot = 0;

        // Reset all other players
        this.players.forEach(player => {
            player.health = PLAYER.STATS.MAX_HEALTH;
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

        setSlider('healthBar', this.myPlayer.health, PLAYER.STATS.MAX_HEALTH);
        setSlider('staminaBar', this.currentStamina, PLAYER.STATS.MAX_STAMINA);
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
            this.canShoot = false;
            this.isSprinting = false;
            this.isDashing = false;
            this.burstInProgress = false;
            this.currentBurstShot = 0;
        });

        this.chatInput?.addEventListener("blur", () => {
            this.keys.clear();
            this.canShoot = true;
            this.isSprinting = false;
            this.isDashing = false;
        });

        // Keep keyboard events on document (for WASD movement)
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameRunning && !this.inLobby) {
                e.preventDefault();
                this.togglePause();
            }
        });

        // CHANGE: Move mouse events to canvas only
        this.canvas?.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas?.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas?.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || this.gamePaused) return;

        const key = e.key.toLowerCase();
        const keybinds = GAME.KEYBINDS;
        const isGameKey = Object.values(keybinds).includes(key);

        if (isGameKey) {
            e.preventDefault();
            this.keys.add(key);

            if (key === keybinds.RELOAD && !this.isReloading && this.currentAmmo < PLAYER.ATTACK.MAGAZINE.SIZE && this.inventoryAmmo > 0) {
                this.startReload();
            }

            if (key === keybinds.SPRINT) {
                this.isSprinting = true;
            }

            if (key === keybinds.DASH && !this.isDashing) {
                this.startDash();
            }
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;

        const key = e.key.toLowerCase();
        const keybinds = GAME.KEYBINDS;

        if (Object.values(keybinds).includes(key)) {
            e.preventDefault();
            this.keys.delete(key);

            if (key === keybinds.SPRINT) {
                this.isSprinting = false;
            }
        }
    }

    private onMouseDown(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || this.gamePaused || !this.canvas) return;

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
        if (!this.gameRunning || this.gamePaused) return;
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
                // Reload complete - calculate how much to reload
                const magazineSpace = PLAYER.ATTACK.MAGAZINE.SIZE - this.currentAmmo;
                const ammoToReload = Math.min(magazineSpace, this.inventoryAmmo);

                this.currentAmmo += ammoToReload;
                this.inventoryAmmo -= ammoToReload;
                this.isReloading = false;

                console.log(`Reload complete! Magazine: ${this.currentAmmo}/${PLAYER.ATTACK.MAGAZINE.SIZE}, Inventory: ${this.inventoryAmmo}/${PLAYER.INVENTORY.MAX_AMMO}`);
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

                console.log(`Burst shot ${this.currentBurstShot}! Magazine: ${this.currentAmmo}/${PLAYER.ATTACK.MAGAZINE.SIZE}, Inventory: ${this.inventoryAmmo}/${PLAYER.INVENTORY.MAX_AMMO}`);

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
            console.log('Out of ammo! Magazine empty.');
            // TODO: Play empty magazine sound/visual feedback
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

        console.log(`Fired shot! Magazine: ${this.currentAmmo}/${PLAYER.ATTACK.MAGAZINE.SIZE}, Inventory: ${this.inventoryAmmo}/${PLAYER.INVENTORY.MAX_AMMO}`);
    }


    private launchProjectile(): void {
        const dx = this.mouseX - this.myPlayer.x;
        const dy = this.mouseY - this.myPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        this.createParticles(
            this.myPlayer.x + dirX * (PLAYER.VISUAL.SIZE + 5),
            this.myPlayer.y + dirY * (PLAYER.VISUAL.SIZE + 5),
            `muzzle_${Date.now()}`,
            PARTICLES.MUZZLE_FLASH,
            { x: dirX, y: dirY }
        );

        // Calculate spawn offset to prevent immediate collision
        const spawnOffset = PLAYER.VISUAL.SIZE + PLAYER.PROJECTILE.SIZE + this.projectileOffset;
        const bulletSpawnX = this.myPlayer.x + dirX * spawnOffset;
        const bulletSpawnY = this.myPlayer.y + dirY * spawnOffset;
        const rightX = -dirY;
        const rightY = dirX;

        this.createParticles(
            bulletSpawnX,
            bulletSpawnY,
            `shell_${Date.now()}`,
            PARTICLES.SHELL_CASING,
            { x: rightX * 0.8 + dirX * -0.2, y: rightY * 0.8 + dirY * -0.2 } // Right + slightly back
        );

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
                range: PLAYER.PROJECTILE.RANGE * 100,
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

                if (distance <= PLAYER.VISUAL.SIZE + PLAYER.PROJECTILE.SIZE) {
                    this.myPlayer.health -= PLAYER.PROJECTILE.DAMAGE;
                    setSlider('healthBar', this.myPlayer.health, PLAYER.STATS.MAX_HEALTH);

                    projectilesToRemove.push(id);

                    this.createDecal(projectile.x, projectile.y, `blood_${id}`, DECALS.BLOOD);

                    // Create directional blood spray - spray backwards from projectile direction
                    const bloodDirection = {
                        x: -projectile.velocityX / Math.sqrt(projectile.velocityX ** 2 + projectile.velocityY ** 2),
                        y: -projectile.velocityY / Math.sqrt(projectile.velocityX ** 2 + projectile.velocityY ** 2)
                    };
                    this.createParticles(projectile.x, projectile.y, `blood_${id}`, PARTICLES.BLOOD_SPRAY, bloodDirection);

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

                        if (distance2 <= PLAYER.VISUAL.SIZE + PLAYER.PROJECTILE.SIZE) {
                            // Hit another player!
                            projectilesToRemove.push(id);

                            // Calculate their new health
                            const newHealth = Math.max(0, player.health - PLAYER.PROJECTILE.DAMAGE);
                            player.health = newHealth;

                            this.createDecal(projectile.x, projectile.y, `blood_${id}`, DECALS.BLOOD);

                            // Create directional blood spray - spray backwards from projectile direction
                            const bloodDirection = {
                                x: -projectile.velocityX / Math.sqrt(projectile.velocityX ** 2 + projectile.velocityY ** 2),
                                y: -projectile.velocityY / Math.sqrt(projectile.velocityX ** 2 + projectile.velocityY ** 2)
                            };
                            this.createParticles(projectile.x, projectile.y, `blood_${id}`, PARTICLES.BLOOD_SPRAY, bloodDirection);

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
        if (this.isReloading || this.currentAmmo >= PLAYER.ATTACK.MAGAZINE.SIZE || this.inventoryAmmo <= 0) return;

        console.log(`Starting reload - Current ammo: ${this.currentAmmo}, Inventory: ${this.inventoryAmmo}`);
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

        // Update stamina system
        this.updateStamina();

        // Update dash state
        this.updateDash();

        // If dashing, skip normal movement logic
        if (this.isDashing) {
            // Calculate new position using current dash velocity
            let newX = this.myPlayer.x + this.playerVelocityX;
            let newY = this.myPlayer.y + this.playerVelocityY;

            let moved = false;

            // Check boundaries
            if (newX >= PLAYER.VISUAL.BORDER_MARGIN && newX <= CANVAS.WIDTH - PLAYER.VISUAL.BORDER_MARGIN) {
                this.myPlayer.x = newX;
                moved = true;
            } else {
                // Stop dash if hitting wall
                this.isDashing = false;
                this.playerVelocityX = 0;
            }

            if (newY >= PLAYER.VISUAL.BORDER_MARGIN && newY <= CANVAS.HEIGHT - PLAYER.VISUAL.BORDER_MARGIN) {
                this.myPlayer.y = newY;
                moved = true;
            } else {
                // Stop dash if hitting wall
                this.isDashing = false;
                this.playerVelocityY = 0;
            }

            // Send position update if moved
            const distanceFromLastSent = Math.sqrt(
                (this.myPlayer.x - this.lastSentX) ** 2 +
                (this.myPlayer.y - this.lastSentY) ** 2
            );

            if (moved && distanceFromLastSent > 2) {
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'player-move',
                    x: this.myPlayer.x,
                    y: this.myPlayer.y
                }));

                this.lastSentX = this.myPlayer.x;
                this.lastSentY = this.myPlayer.y;
            }

            return; // Exit early, skip normal movement
        }

        // Normal movement logic
        const keybinds = GAME.KEYBINDS;
        let inputX = 0;
        let inputY = 0;

        if (this.keys.has(keybinds.MOVE_UP)) inputY -= 1;
        if (this.keys.has(keybinds.MOVE_DOWN)) inputY += 1;
        if (this.keys.has(keybinds.MOVE_LEFT)) inputX -= 1;
        if (this.keys.has(keybinds.MOVE_RIGHT)) inputX += 1;

        const inputLength = Math.sqrt(inputX * inputX + inputY * inputY);
        if (inputLength > 0) {
            inputX = inputX / inputLength;
            inputY = inputY / inputLength;
        }

        // Only allow sprinting if we have stamina
        const canSprint = this.isSprinting && this.currentStamina > 0;
        const currentSpeed = canSprint ? PLAYER.STATS.SPEED * PLAYER.SPRINT.MULTIPLIER : PLAYER.STATS.SPEED;

        // Stop sprinting if out of stamina
        if (this.isSprinting && this.currentStamina <= 0) {
            this.isSprinting = false;
            console.log('Out of stamina, stopped sprinting');
        }

        const targetVelocityX = inputX * currentSpeed;
        const targetVelocityY = inputY * currentSpeed;

        this.playerVelocityX += (targetVelocityX - this.playerVelocityX) * PLAYER.PHYSICS.ACCELERATION;
        this.playerVelocityY += (targetVelocityY - this.playerVelocityY) * PLAYER.PHYSICS.ACCELERATION;

        if (inputLength === 0) {
            this.playerVelocityX *= PLAYER.PHYSICS.FRICTION;
            this.playerVelocityY *= PLAYER.PHYSICS.FRICTION;
        }

        let newX = this.myPlayer.x + this.playerVelocityX;
        let newY = this.myPlayer.y + this.playerVelocityY;

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

        const distanceFromLastSent = Math.sqrt(
            (this.myPlayer.x - this.lastSentX) ** 2 +
            (this.myPlayer.y - this.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                x: this.myPlayer.x,
                y: this.myPlayer.y
            }));

            this.lastSentX = this.myPlayer.x;
            this.lastSentY = this.myPlayer.y;
        }

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

    private resetPlayerConfig(): void {
        Object.assign(PLAYER, JSON.parse(JSON.stringify(this.defaultPlayerConfig)));
        console.log('Player config reset to defaults');
    }

    private requestStamina(amount: number): boolean {
        if (this.currentStamina < amount) {
            console.log(`Insufficient stamina! Need: ${amount}, Have: ${this.currentStamina}`);
            return false;
        }

        this.currentStamina -= amount;

        // Block stamina recovery for the delay period
        this.staminaRecoveryBlocked = true;
        this.staminaRecoveryBlockedUntil = Date.now() + PLAYER.STAMINA.RECOVER_DELAY;

        console.log(`Stamina drained: -${amount}, Remaining: ${this.currentStamina}`);
        return true;
    }

    private updateStamina(): void {
        const currentTime = Date.now();

        // Handle sprint stamina drain (every second while sprinting)
        if (this.isSprinting && currentTime >= this.lastStaminaDrainTime + 100) {
            if (!this.requestStamina(PLAYER.SPRINT.DRAIN)) {
                // Out of stamina, stop sprinting
                this.isSprinting = false;
                console.log('Out of stamina, stopped sprinting');
            }
            this.lastStaminaDrainTime = currentTime;
        }

        // Handle stamina recovery
        if (!this.staminaRecoveryBlocked || currentTime >= this.staminaRecoveryBlockedUntil) {
            this.staminaRecoveryBlocked = false;

            // Recover stamina if not at max and not sprinting
            if (this.currentStamina < PLAYER.STATS.MAX_STAMINA && !this.isSprinting) {
                // Recover stamina per second (16ms frame rate approximation)
                const staminaRecoveryPerFrame = (PLAYER.STAMINA.RECOVER_RATE / 1000) * 16;
                this.currentStamina = Math.min(PLAYER.STATS.MAX_STAMINA, this.currentStamina + staminaRecoveryPerFrame);
            }
        }
    }
    //
    // #endregion

    // #region [ Dash ]
    //
    private startDash(): void {
        if (this.isDashing || this.myPlayer.health <= 0) return;
        console.log("Starting dash...");

        const currentTime = Date.now();

        // Check if dash is on cooldown
        if (currentTime < this.lastDashTime + PLAYER.DASH.COOLDOWN) {
            console.log('Dash on cooldown');
            return;
        }

        if (!this.requestStamina(PLAYER.DASH.DRAIN)) {
            console.log('Not enough stamina to dash');
            return;
        }

        // Only dash if we have movement input
        const keybinds = GAME.KEYBINDS;
        let inputX = 0;
        let inputY = 0;

        if (this.keys.has(keybinds.MOVE_UP)) inputY -= 1;
        if (this.keys.has(keybinds.MOVE_DOWN)) inputY += 1;
        if (this.keys.has(keybinds.MOVE_LEFT)) inputX -= 1;
        if (this.keys.has(keybinds.MOVE_RIGHT)) inputX += 1;

        // Normalize input
        const inputLength = Math.sqrt(inputX * inputX + inputY * inputY);
        if (inputLength === 0) {
            console.log('No movement input for dash');
            return;
        }

        inputX = inputX / inputLength;
        inputY = inputY / inputLength;

        // Start dash
        this.isDashing = true;
        this.dashStartTime = currentTime;
        this.lastDashTime = currentTime;

        // Set dash velocity
        const dashSpeed = PLAYER.STATS.SPEED * PLAYER.DASH.MULTIPLIER;
        this.playerVelocityX = inputX * dashSpeed;
        this.playerVelocityY = inputY * dashSpeed;

        console.log(`Dashing! Speed: ${dashSpeed}`);
    }

    private updateDash(): void {
        if (!this.isDashing) return;

        const currentTime = Date.now();

        // Check if dash time is over
        if (currentTime >= this.dashStartTime + PLAYER.DASH.TIME) {
            this.isDashing = false;
            console.log('Dash ended');
        }
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

        this.inventoryAmmo = Math.floor(PLAYER.INVENTORY.MAX_AMMO / 2);
        this.currentAmmo = PLAYER.ATTACK.MAGAZINE.SIZE;
        this.isReloading = false;

        this.createLeaderboard();
        this.resetPlayerConfig();
        resetUpgrades();

        // Send my initial position
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-join',
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            color: this.myPlayer.color,
            health: this.myPlayer.health
        }));

        this.gameLoop();

        setSlider('healthBar', this.myPlayer.health, PLAYER.STATS.MAX_HEALTH);
        setSlider('staminaBar', this.currentStamina, PLAYER.STATS.MAX_STAMINA);
    }

    private gameLoop(): void {
        if (!this.gameRunning || !this.ctx || !this.canvas || !this.decalCtx || !this.decalCanvas) return;

        if (this.gamePaused) { // Continue the loop but skip all updates
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // Update
        this.updatePlayerPosition();
        this.updateAttack();
        this.updateProjectiles();
        this.updateParticles();

        setSlider('staminaBar', this.currentStamina, PLAYER.STATS.MAX_STAMINA);

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

        this.drawPlayer(this.myPlayer, true);
        this.drawParticles();

        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }

    public pauseGame(): void {
        if (!this.gameRunning) return;

        this.gamePaused = true;
        console.log('Game paused');

        this.keys.clear();
        this.isSprinting = false;
        this.isDashing = false;
        this.burstInProgress = false;
        this.currentBurstShot = 0;
    }

    public resumeGame(): void {
        if (!this.gameRunning) return;

        this.gamePaused = false;
        console.log('Game resumed');
    }

    public togglePause(): void {
        if (!this.gameRunning) return;

        const isPaused = this.pausedPlayers.has(this.userId);

        if (isPaused) {
            // I want to unpause
            this.pausedPlayers.delete(this.userId);
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-unpause',
                userId: this.userId
            }));
            console.log('Requesting unpause...');
        } else {
            // I want to pause
            this.pausedPlayers.add(this.userId);
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-pause',
                userId: this.userId
            }));
            console.log('Requesting pause...');
        }

        // Check if game should be paused
        this.updatePauseState();
    }

    private updatePauseState(): void {
        const shouldPause = this.pausedPlayers.size > 0;

        if (shouldPause && !this.gamePaused) {
            this.pauseGame();
            console.log(`Game paused. ${this.pausedPlayers.size} player(s) paused.`);
        } else if (!shouldPause && this.gamePaused) {
            this.resumeGame();
            console.log('Game resumed. All players unpaused.');
        }
    }
    //
    // #endregion

    // #region [ Upgrade ]
    //
    private startUpgradePhase(winnerId: string | null): void {
        console.log('Starting upgrade phase...');

        // Force everyone to pause for upgrade selection
        this.pausedPlayers.add(this.userId);
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-pause',
            userId: this.userId
        }));
        this.updatePauseState();

        // Show upgrade UI based on if I won or lost
        if (winnerId === this.userId) {
            this.showWinnerWaitScreen();
        } else {
            this.showUpgradeSelection();
        }
    }

    private showWinnerWaitScreen(): void {
        const upgradeContainer = document.getElementById('upgradeContainer');
        if (!upgradeContainer) return;

        upgradeContainer.innerHTML = '';

        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'upgrade_waiting';
        waitingDiv.textContent = 'You won! Other players are selecting upgrades...';

        const continueBtn = document.createElement('button');
        continueBtn.textContent = 'Continue to Next Round';
        continueBtn.onclick = () => {
            console.log("Winner pressed continue...");
            // Hide UI and signal completion
            upgradeContainer.style.display = 'none';
            this.roomManager.sendMessage(JSON.stringify({
                type: 'upgrade-complete',
                userId: this.userId
            }));
        };

        upgradeContainer.appendChild(waitingDiv);
        upgradeContainer.appendChild(continueBtn);
        upgradeContainer.style.display = 'flex';
    }

    private showUpgradeSelection(): void {
        const upgradeContainer = document.getElementById('upgradeContainer');
        if (!upgradeContainer) return;

        upgradeContainer.innerHTML = '';

        // Get 3 random upgrades
        const availableUpgrades = getUpgrades(3);

        availableUpgrades.forEach(upgrade => {
            const upgradeDiv = document.createElement('div');
            upgradeDiv.className = 'upgrade_card';
            upgradeDiv.setAttribute('data-rarity', upgrade.rarity.toString());

            const nameDiv = document.createElement('div');
            nameDiv.className = 'upgrade_name';
            nameDiv.textContent = upgrade.name;

            const subtitleDiv = document.createElement('div');
            subtitleDiv.className = 'upgrade_subtitle';
            subtitleDiv.textContent = upgrade.subtitle;

            upgradeDiv.appendChild(nameDiv);
            upgradeDiv.appendChild(subtitleDiv);

            upgradeDiv.addEventListener('click', () => {
                this.selectUpgrade(upgrade.id);
            });

            upgradeContainer.appendChild(upgradeDiv);
        });

        upgradeContainer.style.display = 'flex';
    }

    private selectUpgrade(upgradeId: string): void {
        // Apply upgrade locally
        const success = applyUpgrade(upgradeId);
        if (!success) {
            console.error('Failed to apply upgrade');
            return;
        }

        // Notify others about upgrade taken
        this.roomManager.sendMessage(JSON.stringify({
            type: 'upgrade-taken',
            upgradeId: upgradeId,
            userId: this.userId,
            isUnique: UPGRADES.find(u => u.id === upgradeId)?.unique || false
        }));

        // Hide upgrade UI
        const upgradeContainer = document.getElementById('upgradeContainer');
        if (upgradeContainer) {
            upgradeContainer.style.display = 'none';
        }

        // Signal I'm done with upgrades
        this.roomManager.sendMessage(JSON.stringify({
            type: 'upgrade-complete',
            userId: this.userId
        }));

        console.log('Upgrade selected, waiting for others...');
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
        this.ctx.arc(player.x, player.y, PLAYER.VISUAL.SIZE, 0, 2 * Math.PI);
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

    private drawParticles(): void {
        if (!this.ctx) return;

        this.particles.forEach(particle => {
            const rgb = hexToRgb(particle.color);
            if (!rgb) return;

            if (!this.ctx) return;
            this.ctx.save();
            this.ctx.globalAlpha = particle.opacity;

            // Apply rotation if torque exists
            if (particle.torque !== 0) {
                this.ctx.translate(particle.x + particle.size / 2, particle.y + particle.size / 2);
                this.ctx.rotate(particle.rotation);
                this.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            } else {
                this.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ctx.fillRect(Math.floor(particle.x), Math.floor(particle.y), particle.size, particle.size);
            }

            this.ctx.restore();
        });
    }
    //
    // #endregion

    // #region [ Decals ]
    //
    private createDecal(x: number, y: number, decalId: string, params: typeof DECALS[keyof typeof DECALS] = DECALS.PROJECTILE): void {
        if (!this.decalCtx) return;

        // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        // Use random values within MIN/MAX ranges
        const radius = params.RADIUS.MIN + Math.random() * (params.RADIUS.MAX - params.RADIUS.MIN);
        const density = params.DENSITY.MIN + Math.random() * (params.DENSITY.MAX - params.DENSITY.MIN);
        const opacity = params.OPACITY.MIN + Math.random() * (params.OPACITY.MAX - params.OPACITY.MIN);

        const numPixels = Math.floor((radius * radius * Math.PI) * density);

        const rgb = hexToRgb(params.COLOR);
        if (!rgb) {
            console.error(`Invalid hex color: ${params.COLOR}`);
            return;
        }

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        // Create scattered decal pixels around impact point
        for (let i = 0; i < numPixels; i++) {
            // Random position within decal radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const pixelX = x + Math.cos(angle) * distance;
            const pixelY = y + Math.sin(angle) * distance;

            // Skip if outside canvas
            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Random opacity with variation
            const pixelOpacity = opacity + (Math.random() - 0.5) * params.VARIATION;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, pixelOpacity));

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

    private applyDecal(x: number, y: number, decalId: string, params: typeof DECALS[keyof typeof DECALS]): void {
        if (!this.decalCtx) return;

        // Don't create duplicate decals
        if (this.decals.has(decalId)) return;

        // Don't create decals outside canvas bounds
        if (x < 0 || x > CANVAS.WIDTH || y < 0 || y > CANVAS.HEIGHT) return;

        // Use random values within MIN/MAX ranges
        const radius = params.RADIUS.MIN + Math.random() * (params.RADIUS.MAX - params.RADIUS.MIN);
        const density = params.DENSITY.MIN + Math.random() * (params.DENSITY.MAX - params.DENSITY.MIN);
        const opacity = params.OPACITY.MIN + Math.random() * (params.OPACITY.MAX - params.OPACITY.MIN);

        const numPixels = Math.floor((radius * radius * Math.PI) * density);

        const rgb = hexToRgb(params.COLOR);
        if (!rgb) {
            console.error(`Invalid hex color: ${params.COLOR}`);
            return;
        }

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        // Create scattered decal pixels around impact point
        for (let i = 0; i < numPixels; i++) {
            // Random position within decal radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const pixelX = x + Math.cos(angle) * distance;
            const pixelY = y + Math.sin(angle) * distance;

            // Skip if outside canvas
            if (pixelX < 0 || pixelX >= CANVAS.WIDTH || pixelY < 0 || pixelY >= CANVAS.HEIGHT) continue;

            // Random opacity with variation
            const pixelOpacity = opacity + (Math.random() - 0.5) * params.VARIATION;
            const clampedOpacity = Math.max(0.05, Math.min(0.6, pixelOpacity));

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

    // #region [ Particles ]
    //
    private createParticles(x: number, y: number, particleId: string, params: typeof PARTICLES[keyof typeof PARTICLES], direction?: { x: number, y: number }): void {
        const count = Math.floor(params.COUNT.MIN + Math.random() * (params.COUNT.MAX - params.COUNT.MIN));
        const particleData: any[] = []; // Store the actual particle data to send

        for (let i = 0; i < count; i++) {
            const lifetime = params.LIFETIME.MIN + Math.random() * (params.LIFETIME.MAX - params.LIFETIME.MIN);
            const speed = params.SPEED.MIN + Math.random() * (params.SPEED.MAX - params.SPEED.MIN);
            const size = params.SIZE.MIN + Math.random() * (params.SIZE.MAX - params.SIZE.MIN);
            const opacity = params.OPACITY.MIN + Math.random() * (params.OPACITY.MAX - params.OPACITY.MIN);
            const torque = params.TORQUE.MIN + Math.random() * (params.TORQUE.MAX - params.TORQUE.MIN);

            let angle;
            if (direction) {
                angle = Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * params.SPREAD;
            } else {
                angle = Math.random() * Math.PI * 2;
            }

            const particleInfo = {
                lifetime,
                speed,
                size,
                opacity,
                torque,
                angle,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                rotation: Math.random() * Math.PI * 2
            };

            // Create local particle
            const particle = {
                id: `${particleId}_${i}`,
                x: x,
                y: y,
                velocityX: particleInfo.velocityX,
                velocityY: particleInfo.velocityY,
                size: particleInfo.size,
                opacity: particleInfo.opacity,
                maxOpacity: particleInfo.opacity,
                color: params.COLOR,
                lifetime: particleInfo.lifetime,
                age: 0,
                collide: params.COLLIDE,
                fade: params.FADE,
                paint: params.PAINT,
                stain: params.STAIN,
                torque: particleInfo.torque,
                rotation: particleInfo.rotation,
                hasCollided: false
            };

            this.particles.set(particle.id, particle);
            particleData.push(particleInfo); // Store for network sync
        }

        // Send the computed particle data
        this.roomManager.sendMessage(JSON.stringify({
            type: 'add-particles',
            particleId: particleId,
            x: x,
            y: y,
            particleData: particleData,
            color: params.COLOR,
            collide: params.COLLIDE,
            fade: params.FADE
        }));
    }

    private applyParticles(x: number, y: number, particleId: string, particleData: any[], color: string, collide: boolean, fade: boolean): void {
        particleData.forEach((data, i) => {
            const particle = {
                id: `${particleId}_${i}`,
                x: x,
                y: y,
                velocityX: data.velocityX,
                velocityY: data.velocityY,
                size: data.size,
                opacity: data.opacity,
                maxOpacity: data.opacity,
                color: color,
                lifetime: data.lifetime,
                age: 0,
                collide: collide,
                fade: fade,
                paint: false,
                stain: data.stain,
                torque: data.torque,
                rotation: data.rotation,
                hasCollided: false
            };

            this.particles.set(particle.id, particle);
        });
    }

    private updateParticles(): void {
        const particlesToRemove: string[] = [];

        this.particles.forEach((particle, id) => {
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.age += 16;

            particle.rotation += (particle.torque * Math.PI / 180) / 60;

            if (particle.fade) {
                const ageRatio = particle.age / particle.lifetime;
                particle.opacity = particle.maxOpacity * (1 - ageRatio);
            }

            // Handle staining during extended collision life
            if (particle.hasCollided && particle.stain) {
                // Paint every frame during extended life
                this.stampParticle(particle.x, particle.y, `stain_${id}_${Date.now()}`, particle);

                // Calculate how far we are through the extended life
                const extendedLifeRatio = (particle.age - (particle.lifetime - particle.lifetime * 0.5)) / (particle.lifetime * 0.5);

                if (extendedLifeRatio > 0) {
                    // Shrink particle during extended life
                    particle.size = Math.max(0.5, particle.size * (1 - extendedLifeRatio * 0.1));

                    // Fade opacity during extended life (from current opacity to 0)
                    particle.opacity = particle.opacity * (1 - extendedLifeRatio);
                }
            }

            const shouldRemove = particle.age >= particle.lifetime ||
                particle.x < -10 || particle.x > CANVAS.WIDTH + 10 ||
                particle.y < -10 || particle.y > CANVAS.HEIGHT + 10;

            if (shouldRemove) {
                // Handle collision for particles with COLLIDE property
                if (particle.collide && particle.age >= particle.lifetime &&
                    particle.x >= 0 && particle.x <= CANVAS.WIDTH &&
                    particle.y >= 0 && particle.y <= CANVAS.HEIGHT &&
                    !particle.hasCollided) {

                    // Simulate collision with ground/surface
                    particle.hasCollided = true;

                    // Reduce speed
                    const speedReduction = 0.875 + Math.random() * 0.1;
                    particle.velocityX *= (1 - speedReduction);
                    particle.velocityY *= (1 - speedReduction);

                    // Extend lifetime
                    const lifetimeExtension = particle.lifetime * 0.5;
                    particle.lifetime += lifetimeExtension;

                    // Don't remove this particle yet
                    return;
                }

                // Handle painting before removal (only for non-staining particles)
                if (particle.paint && !particle.stain && particle.age >= particle.lifetime &&
                    particle.x >= 0 && particle.x <= CANVAS.WIDTH &&
                    particle.y >= 0 && particle.y <= CANVAS.HEIGHT) {

                    this.stampParticle(particle.x, particle.y, `stamp_${id}`, particle);
                }

                particlesToRemove.push(id);
            }
        });

        particlesToRemove.forEach(id => this.particles.delete(id));
    }

    private stampParticle(x: number, y: number, stampId: string, particle: any): void {
        if (!this.decalCtx) return;

        const rgb = hexToRgb(particle.color);
        if (!rgb) return;

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        // Paint with rotation if particle had torque
        if (particle.torque !== 0) {
            this.decalCtx.translate(particle.x + particle.size / 2, particle.y + particle.size / 2);
            this.decalCtx.rotate(particle.rotation);
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.decalCtx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        } else {
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
            this.decalCtx.fillRect(Math.floor(particle.x), Math.floor(particle.y), particle.size, particle.size);
        }

        this.decalCtx.restore();

        this.decals.set(stampId, {
            x: particle.x,
            y: particle.y,
            params: null
        });

        // Send stamp with rotation info
        this.roomManager.sendMessage(JSON.stringify({
            type: 'particle-stamp',
            stampId: stampId,
            x: particle.x,
            y: particle.y,
            color: particle.color,
            opacity: particle.opacity,
            size: particle.size,
            rotation: particle.rotation,
            torque: particle.torque
        }));
    }

    private applyParticleStamp(x: number, y: number, stampId: string, color: string, opacity: number, size: number, rotation?: number, torque?: number): void {
        if (!this.decalCtx) return;
        if (this.decals.has(stampId)) return;

        const rgb = hexToRgb(color);
        if (!rgb) return;

        this.decalCtx.save();
        this.decalCtx.globalCompositeOperation = 'source-over';

        if (rotation !== undefined && torque !== undefined && torque !== 0) {
            this.decalCtx.translate(x + size / 2, y + size / 2);
            this.decalCtx.rotate(rotation);
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            this.decalCtx.fillRect(-size / 2, -size / 2, size, size);
        } else {
            this.decalCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            this.decalCtx.fillRect(Math.floor(x), Math.floor(y), size, size);
        }

        this.decalCtx.restore();
        this.decals.set(stampId, { x, y, params: null });
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
                    const gameRoomId = this.gameRoomIdDisplay;
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