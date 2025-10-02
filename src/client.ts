import { generateUID, getRandomColor, hexToRgb, setSlider, updateToggle, updateInput, forward } from './utils';
import { RoomManager } from './roomManager';
import { Player, RoomMessage, Projectile, LobbyPlayer, Leaderboard, LeaderboardEntry, AmmoBox, ResetType } from './defs';
import { PLAYER_DEFAULTS, CANVAS, GAME, UI, CHAT, DECALS, PARTICLES, AMMO_BOX } from './config';
import { applyUpgrade, getUpgrades, removeUpgradeFromPool, resetUpgrades, UPGRADES } from './upgrades';
import { CHARACTER, CHARACTER_DECALS, CharacterLayer, getCharacterAsset } from './char';

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
    private upgradesToggle: HTMLElement | null = null;
    private winsInput: HTMLInputElement | null = null;
    private playersInput: HTMLInputElement | null = null;
    private upgradeContainer: HTMLElement | null = null;
    private leaderboardContainer: HTMLDivElement | null = null;
    private leaderboardBody: HTMLTableSectionElement | null = null;

    private crosshair: HTMLElement | null = null;

    private modal: HTMLElement | null = null;
    private modalInput: HTMLInputElement | null = null;
    private modalButtons: HTMLDivElement | null = null;
    private modalConfirmButton: HTMLButtonElement | null = null;
    private modalCancelButton: HTMLButtonElement | null = null;
    private modalErrorDiv: HTMLElement | null = null;
    private modalContent: HTMLElement | null = null;
    private modalText: HTMLSpanElement | null = null;

    private hostButton: HTMLButtonElement | null = null;
    private joinButton: HTMLButtonElement | null = null;
    private quickplayButton: HTMLButtonElement | null = null;
    private lobbyLeaveButton: HTMLButtonElement | null = null;
    private lobbyCodeButton: HTMLButtonElement | null = null;
    private gameLeaveButton: HTMLButtonElement | null = null;
    private gameCodeButton: HTMLButtonElement | null = null;

    private myPlayer: Player; // My player object
    private players: Map<string, Player> = new Map(); // Other player objects
    private lobbyPlayers: Map<string, LobbyPlayer> = new Map(); // Temporary partial player object used for lobby only information

    private characterImages: Map<string, HTMLImageElement> = new Map();
    private ammoBoxImages: { [layer: string]: HTMLImageElement } = {};

    private characterOffsets: Map<string, { x: number, y: number }> = new Map();
    private characterAnimations: Map<string, {
        playerId: string;
        part: string;
        partIndex?: number;
        frames: { [key: number]: { x: number, y: number } };
        duration: number;
        startTime: number;
        originalOffset: { x: number, y: number };
    }> = new Map();

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
    private emitters: Map<string, {
        playerId: string;
        offsetX: number;
        offsetY: number;
        direction: number;
        lifetime: number;
        age: number;
        lastEmission: number;
        emissionInterval: number;
    }> = new Map();

    private projectiles: Map<string, Projectile> = new Map();
    private ammoBoxes: Map<string, AmmoBox> = new Map();

    // Game
    private gamePaused = false; // Tracks paused state of game
    private gameRunning = false; // Actual websocket connection tracking, deeper than pause

    private isHost = false;
    private inLobby = false;
    private isPrivateRoom = false;
    private isUpgradesEnabled = true;
    private isRoundInProgress = false;

    private gameMaxWins = GAME.MAX_WINS;
    private gameMaxPlayers = GAME.MAX_PLAYERS;

    private alivePlayersCount = 0;

    private roundWinner: string | null = null;
    private gameWinner: string | null = null;

    private leaderboard: Leaderboard = new Map();

    private pausedPlayers = new Set<string>(); // Tracks which players are paused for consensus

    private keys: Set<string> = new Set();

    // Player
    private canShoot = true;
    private isBurstActive = false;
    private isReloading = false;
    private isSprinting = false;
    private isDashing = false;
    private isStaminaRecoveryBlocked = false;

    private mouseX = 0;
    private mouseY = 0;

    private lastSentX = 0;
    private lastSentY = 0;
    private lastSentRotation = 0;

    private playerVelocityX = 0;
    private playerVelocityY = 0;

    private dashStartTime = 0;
    private lastDashTime = 0;
    private reloadStartTime = 0;
    private lastShotTime = 0;
    private nextBurstShotTime = 0;
    private currentBurstShot = 0;
    private lastStaminaDrainTime = 0;
    private staminaRecoveryBlockedUntil = 0;

    // #region [ Initialization ]
    //
    constructor() {
        this.userId = generateUID();
        this.roomManager = new RoomManager(this.userId);

        this.myPlayer = this.initializePlayer();

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

    /**
     * Responsible for initializing all elements defined in the class structure.
     * 
     * Do not use "getElement" type lookups on runtime. Cache them all on start.
     */
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
        this.upgradesToggle = document.getElementById('upgradesToggle') as HTMLElement;
        this.winsInput = document.getElementById('winsInput') as HTMLInputElement;
        this.playersInput = document.getElementById('playersInput') as HTMLInputElement;

        this.upgradeContainer = document.getElementById('upgradeContainer') as HTMLElement;

        this.crosshair = document.getElementById('crosshair') as HTMLElement;

        this.leaderboardContainer = document.getElementById("leaderboardContainer") as HTMLDivElement;
        this.leaderboardBody = document.getElementById("leaderboardBody") as HTMLTableSectionElement;

        this.hostButton = document.getElementById("hostBtn") as HTMLButtonElement;
        this.joinButton = document.getElementById("joinBtn") as HTMLButtonElement;
        this.quickplayButton = document.getElementById("quickBtn") as HTMLButtonElement;

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

        if (!this.canvas || !this.decalCanvas || !this.roomControls || !this.gameContainer ||
            !this.lobbyContainer || !this.userIdDisplay || !this.roomIdDisplay || !this.gameRoomIdDisplay ||
            !this.lobbyPlayersList || !this.startGameBtn || !this.gameOptionsContainer ||
            !this.chatContainer || !this.chatMessages || !this.chatInput || !this.chatSendBtn ||
            !this.privateToggle || !this.upgradesToggle || !this.winsInput || !this.playersInput ||
            !this.upgradeContainer || !this.crosshair || !this.leaderboardContainer ||
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

        this.ctx = this.canvas.getContext('2d');
        this.decalCtx = this.decalCanvas.getContext('2d');

        if (!this.ctx || !this.decalCtx) {
            alert('Failed to load game. Please refresh the page.');
            throw new Error('Could not get canvas context');
        }

        this.userIdDisplay.textContent = this.userId;
        this.showRoomControls();
    }

    /**
     * Used for creating the websocket connection between clients.
     * 
     * Called when joining or creating a room.
     */
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

    // #region [ Events ]
    //
    /**
     * Initializes all event listeners to the required DOM elements.
     */
    private setupEventListeners(): void {
        if (!this.canvas || !this.hostButton || !this.joinButton || !this.quickplayButton ||
            !this.lobbyLeaveButton || !this.lobbyCodeButton || !this.gameLeaveButton ||
            !this.gameCodeButton || !this.startGameBtn || !this.chatSendBtn || !this.chatInput) return;

        this.hostButton.addEventListener("click", () => this.hostRoom());
        this.joinButton.addEventListener("click", () => this.joinRoom());
        this.quickplayButton.addEventListener("click", () => this.quickPlay());
        this.lobbyLeaveButton.addEventListener("click", () => this.leaveRoom());
        this.lobbyCodeButton.addEventListener("click", () => this.copyRoomCode());
        this.gameLeaveButton.addEventListener("click", () => this.leaveRoom());
        this.gameCodeButton.addEventListener("click", () => this.copyRoomCode());
        this.startGameBtn.addEventListener("click", () => this.startGame());

        // Chat event listeners
        this.chatSendBtn.addEventListener("click", () => this.sendChatMessage());
        this.chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Add focus/blur listeners to chat input
        this.chatInput.addEventListener("focus", () => {
            this.keys.clear();
            this.canShoot = false;
            this.isSprinting = false;
            this.isDashing = false;
            this.isBurstActive = false;
            this.currentBurstShot = 0;
        });

        this.chatInput.addEventListener("blur", () => {
            this.keys.clear();
            this.canShoot = true;
            this.isSprinting = false;
            this.isDashing = false;
        });

        // Listen on document for events, not canvas.
        // If this presents issues, swap "document." with "this.canvas"
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameRunning && !this.inLobby) {
                e.preventDefault();
                // TODO: Test stuff here!
            }
        });

        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e)); // Canvas only listening for mouse (shooting mainly)

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
    }

    /**
     * Handles all key press events.
     */
    private onKeyDown(e: KeyboardEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || this.gamePaused) return;

        const key = e.key.toLowerCase();
        const keybinds = GAME.KEYBINDS;
        const isGameKey = Object.values(keybinds).includes(key);

        if (isGameKey) {
            e.preventDefault();
            this.keys.add(key);

            if (key === keybinds.RELOAD) {
                this.startReload();
            }

            if (key === keybinds.SPRINT && this.isMoving()) {
                this.isSprinting = true;
            }

            if (key === keybinds.DASH) {
                this.startDash();
            }
        }
    }

    /**
     * Handles all key release events.
     */
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

    /**
     * Handles all mouse click events.
     */
    private onMouseDown(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || this.gamePaused || !this.canvas) return;

        if (e.button === 0 && this.canShoot && !this.isBurstActive) { // Left mouse button
            this.updateMouse(e);
            this.startBurst(); // Trigger burst on click
            this.canShoot = false; // Prevent shooting until mouse up
        }
    }

    /**
     * Handles all mouse release events.
     */
    private onMouseUp(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning) return;

        if (e.button === 0) { // Left mouse button
            this.canShoot = true; // Allow shooting again
        }
    }

    /**
     * Handles all mouse movement events.
     */
    private onMouseMove(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.gameRunning || this.gamePaused) return;

        this.updateMouse(e);

        // Calculate rotation based on mouse position
        const dx = this.mouseX - this.myPlayer.transform.pos.x;
        const dy = this.mouseY - this.myPlayer.transform.pos.y;
        const rotation = Math.atan2(dy, dx) + Math.PI / 2;

        // Rotate my character
        this.rotateCharacterPart(this.userId, rotation);

        // Send rotation update if it changed significantly (avoid spamming)
        // TODO: Throttle the network updates for rotations
        const rotationDiff = Math.abs(rotation - this.lastSentRotation);
        if (rotationDiff > 0.1) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    pos: {
                        x: this.myPlayer.transform.pos.x,
                        y: this.myPlayer.transform.pos.y
                    },
                    rot: this.myPlayer.transform.rot
                }
            }));

            this.lastSentRotation = rotation;
        }

        // TODO: Create a global equipment function that can be called when you need to check for specific upgrades
        if (this.crosshair && this.myPlayer.equipment.crosshair) {
            this.crosshair.style.left = `${e.clientX}px`;
            this.crosshair.style.top = `${e.clientY}px`;
        }
    }

    /**
     * Processes mouse position and updates.
     */
    private updateMouse(e: MouseEvent): void {
        if (this.chatInput === document.activeElement) return;
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
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

                if (this.lobbyPlayers.size === 1) {
                    this.isHost = true;
                    this.lobbyPlayers.get(this.userId)!.isHost = true;
                    this.updateHostDisplay();
                    console.log('I am the only player in the room...');
                }
                break;
            case 'user-joined':
                console.log(`User ${message.userId} joined`);

                // If I'm in an active game, send my current state to the new player
                // TODO: Keep full track of Player object here
                if (this.gameRunning && !this.inLobby) {
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-state',
                        id: this.myPlayer.id,
                        transform: {
                            pos: {
                                x: this.myPlayer.transform.pos.x,
                                y: this.myPlayer.transform.pos.y
                            },
                            rot: this.myPlayer.transform.rot
                        },
                        timestamp: this.myPlayer.timestamp,
                        color: this.myPlayer.color,
                        actions: {
                            dash: {
                                cooldown: this.myPlayer.actions.dash.cooldown,
                                drain: this.myPlayer.actions.dash.drain,
                                multiplier: this.myPlayer.actions.dash.multiplier,
                                time: this.myPlayer.actions.dash.time
                            },
                            primary: {
                                buffer: this.myPlayer.actions.primary.buffer,
                                burst: {
                                    amount: this.myPlayer.actions.primary.burst.amount,
                                    delay: this.myPlayer.actions.primary.burst.delay
                                },
                                magazine: {
                                    currentAmmo: this.myPlayer.actions.primary.magazine.currentAmmo,
                                    currentReserve: this.myPlayer.actions.primary.magazine.currentReserve,
                                    maxReserve: this.myPlayer.actions.primary.magazine.maxReserve,
                                    size: this.myPlayer.actions.primary.magazine.size
                                },
                                offset: this.myPlayer.actions.primary.offset,
                                projectile: {
                                    amount: this.myPlayer.actions.primary.projectile.amount,
                                    color: this.myPlayer.actions.primary.projectile.color,
                                    damage: this.myPlayer.actions.primary.projectile.damage,
                                    length: this.myPlayer.actions.primary.projectile.length,
                                    range: this.myPlayer.actions.primary.projectile.range,
                                    size: this.myPlayer.actions.primary.projectile.size,
                                    speed: this.myPlayer.actions.primary.projectile.speed,
                                    spread: this.myPlayer.actions.primary.projectile.spread,
                                    unique: this.myPlayer.actions.primary.projectile.unique
                                },
                                reload: {
                                    time: this.myPlayer.actions.primary.reload.time
                                }
                            },
                            sprint: {
                                drain: this.myPlayer.actions.sprint.drain,
                                multiplier: this.myPlayer.actions.sprint.multiplier
                            }
                        },
                        equipment: {
                            crosshair: this.myPlayer.equipment.crosshair
                        },
                        physics: {
                            acceleration: this.myPlayer.physics.acceleration,
                            friction: this.myPlayer.physics.friction
                        },
                        stats: {
                            health: {
                                max: this.myPlayer.stats.health.max,
                                value: this.myPlayer.stats.health.value,
                            },
                            luck: this.myPlayer.stats.luck,
                            size: this.myPlayer.stats.size,
                            speed: this.myPlayer.stats.speed,
                            stamina: {
                                max: this.myPlayer.stats.stamina.max,
                                recovery: {
                                    delay: this.myPlayer.stats.stamina.recovery.delay,
                                    rate: this.myPlayer.stats.stamina.recovery.rate
                                },
                                value: this.myPlayer.stats.stamina.value
                            },
                        },
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
                                maxPlayers: this.gameMaxPlayers,
                                maxWins: this.gameMaxWins,
                                upgradesEnabled: this.isUpgradesEnabled
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

                    // Update host status if I'm the new host
                    if (gameData.newHostId === this.userId) {
                        this.isHost = true;
                        console.log('I am now the host as the last remaining player');
                    }

                    this.resetGameState('Lobby');

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
                // TODO: Keep full track of Player object here
                case 'player-state':
                    if (!this.inLobby) {
                        this.players.set(message.userId, {
                            id: message.userId,
                            transform: {
                                pos: {
                                    x: gameData.transform?.pos.x,
                                    y: gameData.transform?.pos.y
                                },
                                rot: gameData.transform?.rot
                            },
                            timestamp: gameData.timestamp,
                            color: gameData.color,
                            actions: {
                                dash: {
                                    cooldown: gameData.actions?.dash.cooldown || PLAYER_DEFAULTS.ACTIONS.DASH.COOLDOWN,
                                    drain: gameData.actions?.dash.drain || PLAYER_DEFAULTS.ACTIONS.DASH.DRAIN,
                                    multiplier: gameData.actions?.dash.multiplier || PLAYER_DEFAULTS.ACTIONS.DASH.MULTIPLIER,
                                    time: gameData.actions?.dash.time || PLAYER_DEFAULTS.ACTIONS.DASH.TIME
                                },
                                primary: {
                                    buffer: gameData.actions?.primary.buffer || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BUFFER,
                                    burst: {
                                        amount: gameData.actions?.primary.burst.amount || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.AMOUNT,
                                        delay: gameData.actions?.primary.burst.delay || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.DELAY
                                    },
                                    magazine: {
                                        currentAmmo: gameData.actions?.primary.magazine.currentAmmo,
                                        currentReserve: gameData.actions?.primary.magazine.currentReserve,
                                        maxReserve: gameData.actions?.primary.magazine.maxReserve,
                                        size: gameData.actions?.primary.magazine.size || PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE
                                    },
                                    offset: gameData.actions?.primary.offset || PLAYER_DEFAULTS.ACTIONS.PRIMARY.OFFSET,
                                    projectile: {
                                        amount: gameData.actions?.primary.projectile.amount || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.AMOUNT,
                                        color: gameData.actions?.primary.projectile.color || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.COLOR,
                                        damage: gameData.actions?.primary.projectile.damage || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.DAMAGE,
                                        length: gameData.actions?.primary.projectile.length || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.LENGTH,
                                        range: gameData.actions?.primary.projectile.range || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.RANGE,
                                        size: gameData.actions?.primary.projectile.size || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SIZE,
                                        speed: gameData.actions?.primary.projectile.speed || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPEED,
                                        spread: gameData.actions?.primary.projectile.spread || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPREAD,
                                        unique: gameData.actions?.primary.projectile.unique || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.UNIQUE
                                    },
                                    reload: {
                                        time: gameData.actions?.primary.reload.time || PLAYER_DEFAULTS.ACTIONS.PRIMARY.RELOAD.TIME
                                    }
                                },
                                sprint: {
                                    drain: gameData.actions?.sprint.drain || PLAYER_DEFAULTS.ACTIONS.SPRINT.DRAIN,
                                    multiplier: gameData.actions?.sprint.multiplier || PLAYER_DEFAULTS.ACTIONS.SPRINT.MULTIPLIER
                                }
                            },
                            equipment: {
                                crosshair: gameData.equipment?.crosshair || PLAYER_DEFAULTS.EQUIPMENT.CROSSHAIR
                            },
                            physics: {
                                acceleration: gameData.physics?.acceleration || PLAYER_DEFAULTS.PHYSICS.ACCELERATION,
                                friction: gameData.physics?.friction || PLAYER_DEFAULTS.PHYSICS.FRICTION
                            },
                            stats: {
                                health: {
                                    max: gameData.stats?.health.max || PLAYER_DEFAULTS.STATS.HEALTH.MAX,
                                    value: gameData.stats?.health.value || PLAYER_DEFAULTS.STATS.HEALTH.MAX
                                },
                                luck: gameData.stats?.luck || PLAYER_DEFAULTS.STATS.LUCK,
                                size: gameData.stats?.size || PLAYER_DEFAULTS.STATS.SIZE,
                                speed: gameData.stats?.speed || PLAYER_DEFAULTS.STATS.SPEED,
                                stamina: {
                                    max: gameData.stats?.stamina.max || PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                                    recovery: {
                                        delay: gameData.stats?.stamina.recovery.delay || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.DELAY,
                                        rate: gameData.stats?.stamina.recovery.rate || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.RATE
                                    },
                                    value: gameData.stats?.stamina.value || PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                                },
                            }
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
                        player.transform.pos.x = gameData.transform.pos.x;
                        player.transform.pos.y = gameData.transform.pos.y;
                        player.transform.rot = gameData.transform.rot;
                    }
                    break;
                case 'player-hit':
                    if (gameData.projectileId) { // Remove the projectile for everyone
                        this.projectiles.delete(gameData.projectileId);
                    }

                    if (gameData.targetId === this.userId) {
                        this.myPlayer.stats.health.value = gameData.newHealth;
                        setSlider('healthBar', this.myPlayer.stats.health.value, this.myPlayer.stats.health.max);

                        if (this.myPlayer.stats.health.value <= 0) {
                            this.recordDeath();
                            this.checkRoundEnd();
                        }
                    } else if (this.players.has(gameData.targetId)) {
                        const hitPlayer = this.players.get(gameData.targetId)!;
                        hitPlayer.stats.health.value = gameData.newHealth;

                        if (hitPlayer.stats.health.value <= 0) {
                            console.log(`Player ${hitPlayer.id} died`);
                            this.checkRoundEnd();
                        }
                    }

                    if (gameData.wasKill) {
                        const shooter = this.leaderboard.get(gameData.shooterId);
                        if (shooter) {
                            shooter.kills++;
                        }

                        const target = this.leaderboard.get(gameData.targetId);
                        if (target) {
                            target.deaths++;
                        }

                        this.updateLeaderboardDisplay();
                    }
                    break;
                case 'player-death':
                    // TODO Death processing
                    if (message.userId !== this.userId && gameData.ammoBox) {
                        this.ammoBoxes.set(gameData.ammoBox.id, gameData.ammoBox);
                        console.log(`Ammo box spawned at death of ${message.userId}`);
                    }

                    if (gameData.gore && Array.isArray(gameData.gore)) {
                        gameData.gore.forEach((goreDecal: any, index: number) => {
                            const decalId = `death_gore_${message.userId}_${Date.now()}_${index}`;

                            this.stampGore(goreDecal);

                            this.decals.set(decalId, {
                                x: goreDecal.x,
                                y: goreDecal.y,
                                params: null
                            });
                        });

                        console.log(`Stamped ${gameData.gore.length} gore decals for ${message.userId}`);
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
                case 'ammo-pickup':
                    if (gameData.playerId === this.userId) break;

                    if (this.ammoBoxes.has(gameData.ammoBoxId)) {
                        const box = this.ammoBoxes.get(gameData.ammoBoxId)!;

                        // Update box state
                        box.isOpen = gameData.boxState.isOpen;
                        box.lid = gameData.boxState.lid;

                        console.log(`Ammo box opened by ${gameData.playerId}`);
                    }
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
                    this.isRoundInProgress = false;
                    this.roundWinner = gameData.winnerId;
                    break;
                case 'new-round':
                    console.log('New round started! Everyone respawning...');
                    this.isRoundInProgress = true;
                    this.roundWinner = null;

                    this.myPlayer.stats.health.value = this.myPlayer.stats.health.max;
                    setSlider('healthBar', this.myPlayer.stats.health.value, this.myPlayer.stats.health.max);
                    setSlider('staminaBar', this.myPlayer.stats.stamina.value, this.myPlayer.stats.stamina.max);

                    // TODO: Keep full track of Player object here
                    if (this.players.has(message.userId)) { // Respawn other players
                        const player = this.players.get(message.userId)!;

                        player.transform.pos.x = gameData.transform.pos.x;
                        player.transform.pos.y = gameData.transform.pos.y;
                        player.transform.rot = gameData.transform.rot;
                        player.timestamp = gameData.timestamp;
                        player.actions.dash.cooldown = gameData.actions.dash.cooldown;
                        player.actions.dash.drain = gameData.actions.dash.drain;
                        player.actions.dash.multiplier = gameData.actions.dash.multiplier;
                        player.actions.dash.time = gameData.actions.dash.time;
                        player.actions.primary.buffer = gameData.actions.primary.buffer;
                        player.actions.primary.burst.amount = gameData.actions.primary.burst.amount;
                        player.actions.primary.burst.delay = gameData.actions.primary.burst.delay;
                        player.actions.primary.magazine.currentAmmo = gameData.actions.primary.magazine.currentAmmo;
                        player.actions.primary.magazine.currentReserve = gameData.actions.primary.magazine.currentReserve;
                        player.actions.primary.magazine.maxReserve = gameData.actions.primary.magazine.maxReserve;
                        player.actions.primary.magazine.size = gameData.actions.primary.magazine.size;
                        player.actions.primary.offset = gameData.actions.primary.offset;
                        player.actions.primary.projectile.amount = gameData.actions.primary.projectile.amount;
                        player.actions.primary.projectile.color = gameData.actions.primary.projectile.color;
                        player.actions.primary.projectile.damage = gameData.actions.primary.projectile.damage;
                        player.actions.primary.projectile.length = gameData.actions.primary.projectile.length;
                        player.actions.primary.projectile.range = gameData.actions.primary.projectile.range;
                        player.actions.primary.projectile.size = gameData.actions.primary.projectile.size;
                        player.actions.primary.projectile.speed = gameData.actions.primary.projectile.speed;
                        player.actions.primary.projectile.spread = gameData.actions.primary.projectile.spread;
                        player.actions.primary.projectile.unique = gameData.actions.primary.projectile.unique;
                        player.actions.primary.reload.time = gameData.actions.primary.reload.time;
                        player.actions.sprint.drain = gameData.actions.sprint.drain;
                        player.actions.sprint.multiplier = gameData.actions.sprint.multiplier;
                        player.equipment.crosshair = gameData.equipment.crosshair;
                        player.physics.acceleration = gameData.physics.acceleration;
                        player.physics.friction = gameData.physics.friction;
                        player.stats.health.max = gameData.stats.health.max;
                        player.stats.health.value = gameData.stats.health.max;
                        player.stats.luck = gameData.stats.luck;
                        player.stats.size = gameData.stats.size;
                        player.stats.speed = gameData.stats.speed;
                        player.stats.stamina.max = gameData.stats.stamina.max;
                        player.stats.stamina.recovery.delay = gameData.stats.stamina.recovery.delay;
                        player.stats.stamina.recovery.rate = gameData.stats.stamina.recovery.rate;
                        player.stats.stamina.value = gameData.stats.stamina.value;
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

                    // Winner is last paused player
                    if (this.roundWinner === this.userId && this.pausedPlayers.size === 1) {
                        this.showWinnerContinueButton();
                    }

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
                case 'particle-emitter':
                    if (message.userId !== this.userId) {
                        this.emitters.set(gameData.emitterId, {
                            playerId: gameData.playerId,
                            offsetX: gameData.offsetX,
                            offsetY: gameData.offsetY,
                            direction: gameData.direction || 0,
                            lifetime: gameData.lifetime,
                            age: 0,
                            lastEmission: 0,
                            emissionInterval: 200 + Math.random() * 300
                        });
                    }
                    break;
                case 'character-animation':
                    if (gameData.playerId !== this.userId) { // Only apply animations from other players
                        this.animateCharacterPart(
                            gameData.playerId,
                            gameData.part,
                            gameData.frames,
                            gameData.duration,
                            gameData.partIndex
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
    /**
     * Calls updateDisplay to show the room specific controls.
     */
    private showRoomControls(): void {
        this.updateDisplay("room");
    }

    /**
     * Creates a websocket connection on the server, and a room with the roomManager.
     */
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

    /**
     * Displays the room joining modal, and allows pasting of room code.
     */
    private joinRoom(): void {
        this.showJoinRoomModal();
    }

    /**
     * Directly connect to a game with it's room id.
     * 
     * Called by the room join modal.
     */
    private joinRoomById(roomId: string): void {
        if (!roomId) return;
        if (!this.ws) {
            this.connectWebSocket();
            setTimeout(() => {
                this.roomManager.joinRoom(roomId!);
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            this.roomManager.joinRoom(roomId);
        }
    }

    /**
     * Calls quickplay endpoint on server to find a random open public room.
     */
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
                if (!this.modal || !this.modalConfirmButton || !this.modalCancelButton ||
                    !this.modalContent || !this.modalText || !this.modalInput ||
                    !this.modalErrorDiv || !this.modalButtons) return;

                this.modal.classList.remove('hidden');
                this.modalInput.style.display = 'none';
                this.modalErrorDiv.textContent = ' ';
                this.modalButtons.style.display = 'flex';
                this.modalCancelButton.style.display = 'none';

                this.modalText.textContent = 'No available games found.';

                this.modalConfirmButton.textContent = 'Confirm';
                this.modalConfirmButton.onclick = () => {
                    if (!this.modal || !this.modalInput || !this.modalCancelButton ||
                        !this.modalText || !this.modalConfirmButton) return;

                    this.modal.classList.add('hidden');
                    this.modalInput.style.display = 'flex';
                    this.modalText.textContent = 'Join Room';
                    this.modalCancelButton.style.display = 'flex';
                    this.modalConfirmButton.onclick = null;
                };
            });
    }

    /**
     * Called when leaving the current room - resets game state.
     */
    private leaveRoom(): void {
        this.roomManager.leaveRoom();

        this.resetGameState('Room');
        this.showRoomControls();
    }

    /**
     * Used to check for a room link in the URL when loading the page.
     */
    private checkForRoomInURL(): void {
        const roomId = this.getRoomIdFromURL();
        if (roomId) {
            this.connectWebSocket();
            setTimeout(() => {
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
    private copyRoomCode(): void {
        // Get room ID from either lobby or game container
        const roomId = this.inLobby
            ? this.roomIdDisplay?.textContent
            : this.gameRoomIdDisplay?.textContent;

        if (!roomId) return;

        navigator.clipboard.writeText(roomId).then(() => {
            if (!this.modal || !this.modalConfirmButton || !this.modalCancelButton ||
                !this.modalContent || !this.modalText || !this.modalInput ||
                !this.modalErrorDiv || !this.modalButtons) return;

            this.modal.classList.remove('hidden');
            this.modalInput.style.display = 'none';
            this.modalErrorDiv.textContent = ' ';
            this.modalButtons.style.display = 'flex';
            this.modalCancelButton.style.display = 'none';

            this.modalText.textContent = 'Room code copied!';
            this.modalConfirmButton.textContent = 'Confirm';

            // Define the close function
            const closeModal = () => {
                if (!this.modal || !this.modalInput || !this.modalCancelButton ||
                    !this.modalText || !this.modalConfirmButton) return;

                this.modal.classList.add('hidden');
                this.modalInput.style.display = 'flex';
                this.modalText.textContent = 'Join Room';
                this.modalCancelButton.style.display = 'flex';
                this.modalConfirmButton.onclick = null;
            };

            this.modalConfirmButton.onclick = closeModal;

            // Auto-close after 3 seconds
            setTimeout(() => {
                if (this.modal && !this.modal.classList.contains('hidden')) {
                    closeModal();
                }
            }, 3000);
        }).catch(() => {
            alert("Could not copy. Please copy manually.");
        });
    }
    //
    // #endregion

    // #region [ Lobby Management ]
    //
    /**
     * Calls updateDisplay to show the lobby specific controls.
     */
    private showLobbyControls(roomId: string): void {
        this.updateDisplay("lobby", roomId);

        // Add myself to lobby
        this.lobbyPlayers.set(this.userId, {
            id: this.userId,
            color: this.myPlayer.color,
            isHost: this.isHost
        }); // TODO: Consider sending the full player object here

        this.setupLobbyOptions();

        updateToggle('privateToggle', this.isPrivateRoom);
        updateToggle('upgradesToggle', this.isUpgradesEnabled)
        updateInput('winsInput', this.gameMaxWins);

        this.updateLobbyPlayersList();
        this.updateHostDisplay();
    }

    /**
     * Sets up lobby toggles and input for game settings.
     */
    private setupLobbyOptions(): void {
        this.setupLobbyToggle('privateToggle', 'privateRoom', () => this.isPrivateRoom, (val) => this.isPrivateRoom = val);
        this.setupLobbyToggle('upgradesToggle', 'upgradesEnabled', () => this.isUpgradesEnabled, (val) => this.isUpgradesEnabled = val);
        this.setupLobbyInput('winsInput', 'maxWins', () => this.gameMaxWins, (val) => this.gameMaxWins = val);
        this.setupLobbyInput('playersInput', 'maxPlayers', () => this.gameMaxPlayers, (val) => this.gameMaxPlayers = val);
    }

    /**
     * Called by setupLobbyOptions - Responsible for toggles.
     */
    private setupLobbyToggle(
        elementProp: 'privateToggle' | 'upgradesToggle',
        messageKey: string,
        getter: () => boolean,
        setter: (val: boolean) => void
    ): void {
        const element = this[elementProp];
        if (!element) return;

        element.addEventListener('click', () => {
            if (!this.isHost) return;

            const newValue = !getter();
            setter(newValue);
            updateToggle(elementProp, newValue);

            this.roomManager.sendMessage(JSON.stringify({
                type: 'lobby-options',
                [messageKey]: newValue
            }));

            console.log(`${messageKey} changed to: ${newValue}`);
        });
    }

    /**
     * Called by setupLobbyOptions - Responsible for input fields.
     */
    private setupLobbyInput(
        elementProp: 'winsInput' | 'playersInput',
        messageKey: string,
        getter: () => number,
        setter: (val: number) => void
    ): void {
        const element = this[elementProp];
        if (!element) return;

        element.addEventListener('change', () => {
            if (!this.isHost) return;

            const newValue = parseInt(element.value);
            if (isNaN(newValue) || newValue < 1) {
                element.value = getter().toString();
                return;
            }

            setter(newValue);
            updateInput(elementProp, newValue);

            this.roomManager.sendMessage(JSON.stringify({
                type: 'lobby-options',
                [messageKey]: newValue
            }));

            console.log(`${messageKey} changed to: ${newValue}`);
        });
    }

    /**
     * Syncs lobby options when state change messages are received over websocket.
     */
    private syncLobbyOptions(options: any): void {
        this.syncOption(options, 'privateRoom', 'isPrivateRoom', 'privateToggle', updateToggle, 'Lobby privacy', (v) => v ? 'Private' : 'Public');
        this.syncOption(options, 'maxWins', 'gameMaxWins', 'winsInput', updateInput, 'Game max wins');
        this.syncOption(options, 'maxPlayers', 'gameMaxPlayers', 'playersInput', updateInput, 'Game max players');
        this.syncOption(options, 'upgradesEnabled', 'isUpgradesEnabled', 'upgradesToggle', updateToggle, 'Game upgrades toggled');
    }

    /**
     * [DO NOT CALL] Syncs a lobby option - called by syncLobbyOptions.
     */
    private syncOption(options: any, key: string, prop: string, element: string, fn: Function, label: string, format?: (v: any) => string): void {
        if (options[key] !== undefined) {
            (this as any)[prop] = options[key];
            fn(element, options[key]);
            const displayValue = format ? format(options[key]) : options[key];
            console.log(`${label} synced to: ${displayValue}`);
        }
    }

    /**
     * Promote specific player to host.
     */
    private promotePlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'promote-player',
            targetPlayerId: playerId
        }));
    }

    /**
     * Kick specific  player from the current lobby.
     */
    private kickPlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'kick-player',
            targetPlayerId: playerId
        }));
    }

    /**
     * Return to the lobby for this room from the game.
     * 
     * Called when game ends, or when you are the last player left in the game.
     */
    private returnToLobby(): void {
        this.resetGameState('Lobby');

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
    /**
     * Responsible for checking if the round should end.
     * 
     * Called when players are hit or events happen that could end the round.
     */
    private checkRoundEnd(): void {
        if (!this.isRoundInProgress) return;

        // Count alive players (including myself if I'm alive)
        let aliveCount = this.myPlayer.stats.health.value > 0 ? 1 : 0;
        let lastAlivePlayer = this.myPlayer.stats.health.value > 0 ? this.userId : null;

        this.players.forEach((player) => {
            if (player.stats.health.value > 0) {
                aliveCount++;
                lastAlivePlayer = player.id;
            }
        });

        // Round ends when only 1 or 0 players are alive
        if (aliveCount <= 1) {
            this.endRound(lastAlivePlayer);
        }
    }

    /**
     * Processes end of round logic.
     */
    private endRound(winnerId: string | null): void {
        if (!this.isRoundInProgress) return;

        this.isRoundInProgress = false;
        this.roundWinner = winnerId;

        if (!winnerId) { // Everyone died somehow
            console.log('Round ended with no survivors!');
            setTimeout(() => {
                this.startNewRound();
            }, GAME.ROUND_END_DELAY);
            return;
        }

        // Increment win for the winner
        if (this.leaderboard.has(winnerId)) {
            const winnerEntry = this.leaderboard.get(winnerId)!;
            winnerEntry.wins++;
            console.log(`${winnerId} won the round! Total wins: ${winnerEntry.wins}`);

            // Check if they've won the game - use dynamic max wins
            if (winnerEntry.wins >= this.gameMaxWins) {
                this.endGame(winnerId); // TODO: Maybe don't rely on leaderboard data to end the game but actual player data stored for the round
                return; // Don't start a new round
            }

            // Update display to show new win count
            this.updateLeaderboardDisplay();
        }

        // We have a winner, start the upgrade phase after a delay
        setTimeout(() => {
            this.startUpgradePhase(winnerId);
        }, GAME.ROUND_END_DELAY);
    }

    /**
     * Processes end of game logic.
     */
    private endGame(winnerId: string): void {
        this.gameWinner = winnerId;
        console.log(`${winnerId} won the game with ${this.gameMaxWins} wins!`);

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

    /**
     * Starts a new round, keeping track of full player states.
     */
    private startNewRound(): void {
        console.log('Starting new round...');

        // Reset myself
        this.myPlayer.stats.health.value = this.myPlayer.stats.health.max;
        //TODO: Update spawning so it is not random
        this.myPlayer.transform.pos.x = Math.random() * (CANVAS.WIDTH - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN;
        this.myPlayer.transform.pos.y = Math.random() * (CANVAS.HEIGHT - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN;

        setSlider('healthBar', this.myPlayer.stats.health.value, this.myPlayer.stats.health.max);
        setSlider('staminaBar', this.myPlayer.stats.stamina.value, this.myPlayer.stats.stamina.max);

        // Locally update all other players
        // TODO: Keep full track of Player object here
        this.players.forEach(player => {
            player.timestamp = player.timestamp || Date.now();
            player.actions.dash.cooldown = player.actions.dash.cooldown || PLAYER_DEFAULTS.ACTIONS.DASH.COOLDOWN;
            player.actions.dash.drain = player.actions.dash.drain || PLAYER_DEFAULTS.ACTIONS.DASH.DRAIN;
            player.actions.dash.multiplier = player.actions.dash.multiplier || PLAYER_DEFAULTS.ACTIONS.DASH.MULTIPLIER;
            player.actions.dash.time = player.actions.dash.time || PLAYER_DEFAULTS.ACTIONS.DASH.TIME;
            player.actions.primary.buffer = player.actions.primary.buffer || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BUFFER;
            player.actions.primary.burst.amount = player.actions.primary.burst.amount || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.AMOUNT;
            player.actions.primary.burst.delay = player.actions.primary.burst.delay || PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.DELAY;
            player.actions.primary.magazine.currentAmmo = player.actions.primary.magazine.currentAmmo || PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE;
            player.actions.primary.magazine.currentReserve = player.actions.primary.magazine.currentReserve || PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.STARTING_RESERVE;
            player.actions.primary.magazine.maxReserve = player.actions.primary.magazine.maxReserve || PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.MAX_RESERVE;
            player.actions.primary.magazine.size = player.actions.primary.magazine.size || PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE;
            player.actions.primary.offset = player.actions.primary.offset || PLAYER_DEFAULTS.ACTIONS.PRIMARY.OFFSET;
            player.actions.primary.projectile.amount = player.actions.primary.projectile.amount || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.AMOUNT;
            player.actions.primary.projectile.color = player.actions.primary.projectile.color || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.COLOR;
            player.actions.primary.projectile.damage = player.actions.primary.projectile.damage || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.DAMAGE;
            player.actions.primary.projectile.length = player.actions.primary.projectile.length || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.LENGTH;
            player.actions.primary.projectile.range = player.actions.primary.projectile.range || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.RANGE;
            player.actions.primary.projectile.size = player.actions.primary.projectile.size || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SIZE;
            player.actions.primary.projectile.speed = player.actions.primary.projectile.speed || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPEED;
            player.actions.primary.projectile.spread = player.actions.primary.projectile.spread || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPREAD;
            player.actions.primary.projectile.unique = player.actions.primary.projectile.unique || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.UNIQUE;
            player.actions.primary.reload.time = player.actions.primary.reload.time || PLAYER_DEFAULTS.ACTIONS.PRIMARY.RELOAD.TIME;
            player.actions.sprint.drain = player.actions.sprint.drain || PLAYER_DEFAULTS.ACTIONS.SPRINT.DRAIN;
            player.actions.sprint.multiplier = player.actions.sprint.multiplier || PLAYER_DEFAULTS.ACTIONS.SPRINT.MULTIPLIER;
            player.equipment.crosshair = player.equipment.crosshair || PLAYER_DEFAULTS.EQUIPMENT.CROSSHAIR;
            player.physics.acceleration = player.physics.acceleration || PLAYER_DEFAULTS.PHYSICS.ACCELERATION;
            player.physics.friction = player.physics.friction || PLAYER_DEFAULTS.PHYSICS.FRICTION;
            player.stats.health.max = player.stats.health.max || PLAYER_DEFAULTS.STATS.HEALTH.MAX;
            player.stats.health.value = player.stats.health.max || PLAYER_DEFAULTS.STATS.HEALTH.MAX;
            player.stats.luck = player.stats.luck || PLAYER_DEFAULTS.STATS.LUCK;
            player.stats.size = player.stats.size || PLAYER_DEFAULTS.STATS.SIZE;
            player.stats.speed = player.stats.speed || PLAYER_DEFAULTS.STATS.SPEED;
            player.stats.stamina.max = player.stats.stamina.max || PLAYER_DEFAULTS.STATS.STAMINA.MAX;
            player.stats.stamina.recovery.delay = player.stats.stamina.recovery.delay || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.DELAY;
            player.stats.stamina.recovery.rate = player.stats.stamina.recovery.rate || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.RATE;
            player.stats.stamina.value = player.stats.stamina.value || PLAYER_DEFAULTS.STATS.STAMINA.MAX;
        });

        this.isRoundInProgress = true;
        this.roundWinner = null;

        // Notify others of new round with my spawn position
        // TODO: Keep full track of Player object here
        this.roomManager.sendMessage(JSON.stringify({
            type: 'new-round',
            transform: {
                pos: {
                    x: this.myPlayer.transform.pos.x,
                    y: this.myPlayer.transform.pos.y
                },
                rot: this.myPlayer.transform.rot
            },
            timestamp: this.myPlayer.timestamp,
            actions: {
                dash: {
                    cooldown: this.myPlayer.actions.dash.cooldown,
                    drain: this.myPlayer.actions.dash.drain,
                    multiplier: this.myPlayer.actions.dash.multiplier,
                    time: this.myPlayer.actions.dash.time
                },
                primary: {
                    buffer: this.myPlayer.actions.primary.buffer,
                    burst: {
                        amount: this.myPlayer.actions.primary.burst.amount,
                        delay: this.myPlayer.actions.primary.burst.delay
                    },
                    magazine: {
                        currentAmmo: this.myPlayer.actions.primary.magazine.currentAmmo,
                        currentReserve: this.myPlayer.actions.primary.magazine.currentReserve,
                        maxReserve: this.myPlayer.actions.primary.magazine.maxReserve,
                        size: this.myPlayer.actions.primary.magazine.size
                    },
                    offset: this.myPlayer.actions.primary.offset,
                    projectile: {
                        amount: this.myPlayer.actions.primary.projectile.amount,
                        color: this.myPlayer.actions.primary.projectile.color,
                        damage: this.myPlayer.actions.primary.projectile.damage,
                        length: this.myPlayer.actions.primary.projectile.length,
                        range: this.myPlayer.actions.primary.projectile.range,
                        size: this.myPlayer.actions.primary.projectile.size,
                        speed: this.myPlayer.actions.primary.projectile.speed,
                        spread: this.myPlayer.actions.primary.projectile.spread,
                        unique: this.myPlayer.actions.primary.projectile.unique
                    },
                    reload: {
                        time: this.myPlayer.actions.primary.reload.time
                    }
                },
                sprint: {
                    drain: this.myPlayer.actions.sprint.drain,
                    multiplier: this.myPlayer.actions.sprint.multiplier
                }
            },
            equipment: {
                crosshair: this.myPlayer.equipment.crosshair
            },
            physics: {
                acceleration: this.myPlayer.physics.acceleration,
                friction: this.myPlayer.physics.friction
            },
            stats: {
                health: {
                    max: this.myPlayer.stats.health.max,
                    value: this.myPlayer.stats.health.max,
                },
                luck: this.myPlayer.stats.luck,
                size: this.myPlayer.stats.size,
                speed: this.myPlayer.stats.speed,
                stamina: {
                    max: this.myPlayer.stats.stamina.max,
                    recovery: {
                        delay: this.myPlayer.stats.stamina.recovery.delay,
                        rate: this.myPlayer.stats.stamina.recovery.rate
                    },
                    value: this.myPlayer.stats.stamina.max
                },
            }
        }));
    }
    //
    // #endregion

    // #region [ Chat Management ]
    //
    /**
     * Sends a message in the chat.
     */
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

    /**
     * Displayes messages sent in the chat.
     */
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

    /**
     * Resets the chat.
     */
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

    // #region [ Attack ]
    //
    private updateAttack(): void {
        if (!this.gameRunning || this.myPlayer.stats.health.value <= 0) return;

        const currentTime = Date.now();

        // Handle reload
        if (this.isReloading) {
            if (currentTime >= this.reloadStartTime + this.myPlayer.actions.primary.reload.time) {
                // Reload complete - calculate how much to reload
                const magazineSpace = this.myPlayer.actions.primary.magazine.size - this.myPlayer.actions.primary.magazine.currentAmmo;
                const ammoToReload = Math.min(magazineSpace, this.myPlayer.actions.primary.magazine.currentReserve);

                this.myPlayer.actions.primary.magazine.currentAmmo += ammoToReload;
                this.myPlayer.actions.primary.magazine.currentReserve -= ammoToReload;
                this.isReloading = false;

                this.animateCharacterPart(this.userId, 'WEAPON', {
                    0: { x: 0, y: 20 }, // Start with slide back
                    1: { x: 0, y: 0 } // Return to start
                }, 175, 1);

                console.log(`Reload complete! Magazine: ${this.myPlayer.actions.primary.magazine.currentAmmo}/${this.myPlayer.actions.primary.magazine.size}, Inventory: ${this.myPlayer.actions.primary.magazine.currentReserve}/${this.myPlayer.actions.primary.magazine.maxReserve}`);
            }
            return; // Can't shoot while reloading
        }

        // Handle ongoing burst
        if (this.isBurstActive && currentTime >= this.nextBurstShotTime) {
            // Check if we still have ammo and haven't finished the intended burst amount
            const ammoNeeded = this.myPlayer.actions.primary.burst.amount;
            if (this.myPlayer.actions.primary.magazine.currentAmmo > 0 && this.currentBurstShot < ammoNeeded) {
                this.launchProjectile();
                this.currentBurstShot++;
                this.myPlayer.actions.primary.magazine.currentAmmo--; // Use 1 ammo per shot in burst

                console.log(`Burst shot ${this.currentBurstShot}! Magazine: ${this.myPlayer.actions.primary.magazine.currentAmmo}/${this.myPlayer.actions.primary.magazine.size}, Inventory: ${this.myPlayer.actions.primary.magazine.currentReserve}/${this.myPlayer.actions.primary.magazine.maxReserve}`);

                // Check if we should continue the burst
                if (this.currentBurstShot >= ammoNeeded || this.myPlayer.actions.primary.magazine.currentAmmo === 0) {
                    // Burst complete (reached intended amount or out of ammo)
                    this.isBurstActive = false;
                    this.currentBurstShot = 0;
                } else {
                    // Schedule next shot in burst
                    this.nextBurstShotTime = currentTime + this.myPlayer.actions.primary.burst.delay;
                }
            } else {
                // Out of ammo or reached burst limit
                this.isBurstActive = false;
                this.currentBurstShot = 0;
            }
        }
    }

    private startBurst(): void {
        if (this.isBurstActive || this.myPlayer.stats.health.value <= 0 || this.isReloading) return;

        // Don't proceed if there is still a buffer
        const now = Date.now();
        if (now < this.lastShotTime + this.myPlayer.actions.primary.buffer) return;
        this.lastShotTime = now;

        // Check if we have enough ammo for the burst
        const ammoNeeded = this.myPlayer.actions.primary.burst.amount;
        const ammoToUse = Math.min(ammoNeeded, this.myPlayer.actions.primary.magazine.currentAmmo);

        if (ammoToUse === 0) {
            console.log('Out of ammo! Magazine empty.');

            this.animateCharacterPart(this.userId, 'WEAPON', {
                0: { x: 0, y: 8 } // Slide held back
            }, 0, 1); // duration=0 means infinite/held

            // TODO: Play empty magazine sound
            return;
        }

        this.isBurstActive = true;
        this.currentBurstShot = 0;

        // Fire first shot immediately
        this.launchProjectile();
        this.currentBurstShot++;
        this.myPlayer.actions.primary.magazine.currentAmmo--; // Use 1 ammo per shot in burst

        // If burst has more shots and we have ammo, schedule the next ones
        if (this.myPlayer.actions.primary.burst.amount > 1 && this.myPlayer.actions.primary.magazine.currentAmmo > 0 && this.currentBurstShot < ammoToUse) {
            this.nextBurstShotTime = Date.now() + this.myPlayer.actions.primary.burst.delay;
        } else { // Burst complete
            this.isBurstActive = false;
            this.currentBurstShot = 0;

            if (this.myPlayer.actions.primary.magazine.currentAmmo === 0) {
                this.animateCharacterPart(this.userId, 'WEAPON', {
                    0: { x: 0, y: 8 } // Slide held back
                }, 0, 1); // duration=0 means infinite/held
            }
        }

        console.log(`Fired shot! Magazine: ${this.myPlayer.actions.primary.magazine.currentAmmo}/${this.myPlayer.actions.primary.magazine.size}, Inventory: ${this.myPlayer.actions.primary.magazine.currentReserve}/${this.myPlayer.actions.primary.magazine.maxReserve}`);
    }

    private launchProjectile(): void {
        const dx = this.mouseX - this.myPlayer.transform.pos.x;
        const dy = this.mouseY - this.myPlayer.transform.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Animate weapon slide (glock_slide.png is index 1 in the WEAPON.GLOCK array)
        this.animateCharacterPart(this.userId, 'WEAPON', {
            0: { x: 0, y: 0 },    // Start position
            0.5: { x: 0, y: 20 }, // Pull back slide
            1: { x: 0, y: 0 }     // Return to start
        }, 175, 1);

        // Calculate spawn offset
        const spawnOffset = (this.myPlayer.stats.size / 4) + this.myPlayer.actions.primary.projectile.size + this.myPlayer.actions.primary.offset;
        const bulletSpawnX = this.myPlayer.transform.pos.x + dirX * spawnOffset;
        const bulletSpawnY = this.myPlayer.transform.pos.y + dirY * spawnOffset;
        const rightX = -dirY;
        const rightY = dirX;

        this.createParticles( // Muzzle flash
            bulletSpawnX,
            bulletSpawnY,
            `muzzle_${Date.now()}`,
            PARTICLES.MUZZLE_FLASH,
            { x: dirX, y: dirY }
        );

        this.createParticles( // Shell casing
            bulletSpawnX - 5,
            bulletSpawnY - 5,
            `shell_${Date.now()}`,
            PARTICLES.SHELL_CASING,
            { x: rightX * 0.8 + dirX * -0.2, y: rightY * 0.8 + dirY * -0.2 } // Right + slightly back
        );

        // Create projectiles
        for (let i = 0; i < this.myPlayer.actions.primary.projectile.amount; i++) {
            const spread = (Math.random() - 0.5) * (this.myPlayer.actions.primary.projectile.spread / 100);
            const angle = Math.atan2(dirY, dirX) + spread;
            const dir = forward(angle);

            const projectile: Projectile = {
                id: generateUID(),
                transform: {
                    pos: {
                        x: this.myPlayer.transform.pos.x + Math.cos(angle) * spawnOffset,
                        y: this.myPlayer.transform.pos.y + Math.sin(angle) * spawnOffset,
                    },
                    rot: angle
                },
                timestamp: Date.now(),
                color: this.myPlayer.actions.primary.projectile.color,
                damage: this.myPlayer.actions.primary.projectile.damage,
                distanceTraveled: 0,
                length: this.myPlayer.actions.primary.projectile.length,
                ownerId: this.userId,
                range: this.myPlayer.actions.primary.projectile.range * 100, // Convert to px
                size: this.myPlayer.actions.primary.projectile.size,
                velocity: {
                    x: dir.x * this.myPlayer.actions.primary.projectile.speed,
                    y: dir.y * this.myPlayer.actions.primary.projectile.speed,
                },
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
            projectile.transform.pos.x += projectile.velocity.x;
            projectile.transform.pos.y += projectile.velocity.y;

            // Update distance traveled
            const frameDistance = Math.sqrt(
                projectile.velocity.x * projectile.velocity.x +
                projectile.velocity.y * projectile.velocity.y
            );
            projectile.distanceTraveled += frameDistance;

            // Check collision with my player (only if I'm alive)
            if (this.myPlayer.stats.health.value > 0) {
                const dx = projectile.transform.pos.x - this.myPlayer.transform.pos.x;
                const dy = projectile.transform.pos.y - this.myPlayer.transform.pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const col = this.myPlayer.stats.size / 4;

                if (distance <= col + projectile.size) {
                    this.myPlayer.stats.health.value -= projectile.damage;
                    setSlider('healthBar', this.myPlayer.stats.health.value, this.myPlayer.stats.health.max);

                    projectilesToRemove.push(id);

                    this.createDecal(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, DECALS.BLOOD);

                    // Create directional blood spray - spray backwards from projectile direction
                    const bloodDirection = {
                        x: -projectile.velocity.x / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2),
                        y: -projectile.velocity.y / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2)
                    };
                    this.createParticles(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, PARTICLES.BLOOD_SPRAY, bloodDirection);
                    this.createEmitter(this.userId, projectile.transform.pos.x, projectile.transform.pos.y);

                    // Notify everyone I was hit
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-hit',
                        targetId: this.userId,
                        shooterId: projectile.ownerId,
                        damage: projectile.damage,
                        newHealth: this.myPlayer.stats.health.value,
                        projectileId: id
                    }));

                    // Check if I died
                    if (this.myPlayer.stats.health.value <= 0) {
                        // this.recordDeath();
                        // this.checkRoundEnd(); // Calling in 'player-death' message handler
                    }
                }
            }

            // Check collision with other players (for my projectiles only)
            if (projectile.ownerId === this.userId) {
                this.players.forEach((player, playerId) => {
                    if (player.stats.health.value > 0) { // Only check collision if the player is alive
                        const dx2 = projectile.transform.pos.x - player.transform.pos.x;
                        const dy2 = projectile.transform.pos.y - player.transform.pos.y;
                        const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                        const col = player.stats.size / 4;

                        if (distance2 <= col + projectile.size) { // Calculate hit based on MY projectile size
                            // Hit another player!
                            projectilesToRemove.push(id);

                            // Calculate their new health / use MY damage
                            const newHealth = Math.max(0, player.stats.health.value - projectile.damage);
                            player.stats.health.value = newHealth;

                            this.createDecal(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, DECALS.BLOOD);

                            // Create directional blood spray - spray backwards from projectile direction
                            const bloodDirection = {
                                x: -projectile.velocity.x / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2),
                                y: -projectile.velocity.y / Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2)
                            };
                            this.createParticles(projectile.transform.pos.x, projectile.transform.pos.y, `blood_${id}`, PARTICLES.BLOOD_SPRAY, bloodDirection);
                            this.createEmitter(playerId, projectile.transform.pos.x, projectile.transform.pos.y);

                            // If they died, I get a kill
                            if (newHealth <= 0) {
                                console.log(`I killed ${playerId}!`);

                                const me = this.leaderboard.get(this.userId);
                                if (me) {
                                    me.kills++;
                                }

                                const other = this.leaderboard.get(playerId);
                                if (other) {
                                    other.deaths++;
                                }

                                this.updateLeaderboardDisplay();
                            }

                            // Notify everyone about the hit
                            this.roomManager.sendMessage(JSON.stringify({
                                type: 'player-hit',
                                targetId: playerId,
                                shooterId: this.userId,
                                damage: projectile.damage,
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
                projectile.transform.pos.x < 0 || projectile.transform.pos.x > CANVAS.WIDTH ||
                projectile.transform.pos.y < 0 || projectile.transform.pos.y > CANVAS.HEIGHT) {

                projectilesToRemove.push(id);

                // Create burn mark where projectile expired (only for my projectiles)
                if (projectile.ownerId === this.userId) {
                    if (projectile.distanceTraveled >= projectile.range) {
                        this.createDecal(projectile.transform.pos.x, projectile.transform.pos.y, `impact_${id}`, DECALS.PROJECTILE);
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
        if (!this.canReload()) return;
        console.log(`Ammo: ${this.myPlayer.actions.primary.magazine.currentAmmo}, Inventory: ${this.myPlayer.actions.primary.magazine.currentReserve}`);

        this.isReloading = true;
        this.reloadStartTime = Date.now();

        // Cancel any ongoing burst
        this.isBurstActive = false;
        this.currentBurstShot = 0;

        this.animateCharacterPart(this.userId, 'WEAPON', {
            0: { x: 0, y: 8 } // Slide held back
        }, 0, 1); // duration=0 means infinite/held
    }

    private canReload(): boolean {
        return (
            !this.isReloading &&
            this.myPlayer.actions.primary.magazine.currentAmmo < this.myPlayer.actions.primary.magazine.size &&
            this.myPlayer.actions.primary.magazine.currentReserve > 0
        );
    }
    //
    // #endregion

    // #region [ Player ]
    //
    // TODO: Keep full track of Player object here
    private initializePlayer(): Player {
        return this.myPlayer = {
            id: this.userId,
            transform: {
                pos: {
                    x: Math.random() * (CANVAS.WIDTH - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN,
                    y: Math.random() * (CANVAS.HEIGHT - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN
                },
                rot: 0
            },
            timestamp: Date.now(),
            color: getRandomColor(),
            actions: {
                dash: {
                    cooldown: PLAYER_DEFAULTS.ACTIONS.DASH.COOLDOWN,
                    drain: PLAYER_DEFAULTS.ACTIONS.DASH.DRAIN,
                    multiplier: PLAYER_DEFAULTS.ACTIONS.DASH.MULTIPLIER,
                    time: PLAYER_DEFAULTS.ACTIONS.DASH.TIME
                },
                primary: {
                    buffer: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BUFFER,
                    burst: {
                        amount: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.AMOUNT,
                        delay: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.DELAY
                    },
                    magazine: {
                        currentAmmo: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE,
                        currentReserve: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.STARTING_RESERVE,
                        maxReserve: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.MAX_RESERVE,
                        size: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE
                    },
                    offset: PLAYER_DEFAULTS.ACTIONS.PRIMARY.OFFSET,
                    projectile: {
                        amount: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.AMOUNT,
                        color: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.COLOR,
                        damage: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.DAMAGE,
                        length: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.LENGTH,
                        range: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.RANGE,
                        size: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SIZE,
                        speed: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPEED,
                        spread: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPREAD,
                        unique: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.UNIQUE
                    },
                    reload: {
                        time: PLAYER_DEFAULTS.ACTIONS.PRIMARY.RELOAD.TIME
                    }
                },
                sprint: {
                    drain: PLAYER_DEFAULTS.ACTIONS.SPRINT.DRAIN,
                    multiplier: PLAYER_DEFAULTS.ACTIONS.SPRINT.MULTIPLIER
                }
            },
            equipment: {
                crosshair: PLAYER_DEFAULTS.EQUIPMENT.CROSSHAIR
            },
            physics: {
                acceleration: PLAYER_DEFAULTS.PHYSICS.ACCELERATION,
                friction: PLAYER_DEFAULTS.PHYSICS.FRICTION
            },
            stats: {
                health: {
                    max: PLAYER_DEFAULTS.STATS.HEALTH.MAX,
                    value: PLAYER_DEFAULTS.STATS.HEALTH.MAX,
                },
                luck: PLAYER_DEFAULTS.STATS.LUCK,
                size: PLAYER_DEFAULTS.STATS.SIZE,
                speed: PLAYER_DEFAULTS.STATS.SPEED,
                stamina: {
                    max: PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                    recovery: {
                        delay: PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.DELAY,
                        rate: PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.RATE
                    },
                    value: PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                },
            }
        };
    }
    private updatePlayerPosition(): void {
        if (!this.gameRunning || this.myPlayer.stats.health.value <= 0) return;

        this.updateStamina();
        this.updateDash();
        this.checkCollisions();

        // If dashing, skip normal movement logic
        if (this.isDashing) {
            // Calculate new position using current dash velocity
            let newX = this.myPlayer.transform.pos.x + this.playerVelocityX;
            let newY = this.myPlayer.transform.pos.y + this.playerVelocityY;

            let moved = false;

            // Check boundaries
            if (newX >= CANVAS.BORDER_MARGIN && newX <= CANVAS.WIDTH - CANVAS.BORDER_MARGIN) {
                this.myPlayer.transform.pos.x = newX;
                moved = true;
            } else {
                // Stop dash if hitting wall
                this.isDashing = false;
                this.playerVelocityX = 0;
            }

            if (newY >= CANVAS.BORDER_MARGIN && newY <= CANVAS.HEIGHT - CANVAS.BORDER_MARGIN) {
                this.myPlayer.transform.pos.y = newY;
                moved = true;
            } else {
                // Stop dash if hitting wall
                this.isDashing = false;
                this.playerVelocityY = 0;
            }

            // Send position update if moved
            const distanceFromLastSent = Math.sqrt(
                (this.myPlayer.transform.pos.x - this.lastSentX) ** 2 +
                (this.myPlayer.transform.pos.y - this.lastSentY) ** 2
            );

            if (moved && distanceFromLastSent > 2) {
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'player-move',
                    transform: {
                        pos: {
                            x: this.myPlayer.transform.pos.x,
                            y: this.myPlayer.transform.pos.y
                        },
                        rot: this.myPlayer.transform.rot
                    }
                }));

                this.lastSentX = this.myPlayer.transform.pos.x;
                this.lastSentY = this.myPlayer.transform.pos.y;
                this.lastSentRotation = this.myPlayer.transform.rot || 0;
            }

            return; // Exit early, skip normal movement
        }

        // Normal movement logic
        const { inputX, inputY } = this.getInput();

        // Only allow sprinting if we have stamina
        const canSprint = this.isSprinting && this.myPlayer.stats.stamina.value > 0 && this.isMoving();
        const currentSpeed = canSprint ? this.myPlayer.stats.speed * this.myPlayer.actions.sprint.multiplier : this.myPlayer.stats.speed;

        // Stop sprinting if out of stamina
        if (this.isSprinting && this.myPlayer.stats.stamina.value <= 0) {
            this.isSprinting = false;
            console.log('Out of stamina, stopped sprinting');
        }

        const targetVelocityX = inputX * currentSpeed;
        const targetVelocityY = inputY * currentSpeed;

        this.playerVelocityX += (targetVelocityX - this.playerVelocityX) * this.myPlayer.physics.acceleration;
        this.playerVelocityY += (targetVelocityY - this.playerVelocityY) * this.myPlayer.physics.acceleration;

        if (!this.isMoving()) {
            this.playerVelocityX *= this.myPlayer.physics.friction;
            this.playerVelocityY *= this.myPlayer.physics.friction;
        }

        let newX = this.myPlayer.transform.pos.x + this.playerVelocityX;
        let newY = this.myPlayer.transform.pos.y + this.playerVelocityY;

        let moved = false;

        if (newX >= CANVAS.BORDER_MARGIN && newX <= CANVAS.WIDTH - CANVAS.BORDER_MARGIN) {
            this.myPlayer.transform.pos.x = newX;
            moved = true;
        } else {
            this.playerVelocityX = 0;
        }

        if (newY >= CANVAS.BORDER_MARGIN && newY <= CANVAS.HEIGHT - CANVAS.BORDER_MARGIN) {
            this.myPlayer.transform.pos.y = newY;
            moved = true;
        } else {
            this.playerVelocityY = 0;
        }

        const distanceFromLastSent = Math.sqrt(
            (this.myPlayer.transform.pos.x - this.lastSentX) ** 2 +
            (this.myPlayer.transform.pos.y - this.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    pos: {
                        x: this.myPlayer.transform.pos.x,
                        y: this.myPlayer.transform.pos.y
                    },
                    rot: this.myPlayer.transform.rot
                }
            }));

            this.lastSentX = this.myPlayer.transform.pos.x;
            this.lastSentY = this.myPlayer.transform.pos.y;
            this.lastSentRotation = this.myPlayer.transform.rot || 0;
        }

        if (Math.abs(this.playerVelocityX) < 0.01) this.playerVelocityX = 0;
        if (Math.abs(this.playerVelocityY) < 0.01) this.playerVelocityY = 0;
    }

    private rotateCharacterPart(playerId: string, rotation: number): void {
        if (playerId === this.userId) {
            this.myPlayer.transform.rot = rotation;
        } else {
            const player = this.players.get(playerId);
            if (!player) return;
            player.transform.rot = rotation;
        }
    }

    private recordDeath(): void {
        console.log('I died! Waiting for round to end...');

        this.resetPlayerState();

        const ammoBox = this.spawnAmmoBox(10);
        this.ammoBoxes.set(ammoBox.id, ammoBox);

        const gore = this.spawnGore(this.myPlayer.transform.pos.x, this.myPlayer.transform.pos.y);
        gore.forEach((goreDecal: any, index: number) => {
            const decalId = `death_gore_${this.userId}_${Date.now()}_${index}`;
            this.stampGore(goreDecal);
            this.decals.set(decalId, {
                x: goreDecal.x,
                y: goreDecal.y,
                params: null
            });
        });

        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-death',
            playerId: this.userId,
            ammoBox: ammoBox,
            gore: gore
        }));
    }

    private requestStamina(amount: number): boolean {
        if (this.myPlayer.stats.stamina.value < amount) {
            console.log(`Insufficient stamina! Need: ${amount}, Have: ${this.myPlayer.stats.stamina}`);
            return false;
        }

        this.myPlayer.stats.stamina.value -= amount;

        // Block stamina recovery for the delay period
        this.isStaminaRecoveryBlocked = true;
        this.staminaRecoveryBlockedUntil = Date.now() + this.myPlayer.stats.stamina.recovery.delay;

        console.log(`Stamina drained: -${amount}, Remaining: ${this.myPlayer.stats.stamina}`);
        return true;
    }

    private updateStamina(): void {
        const currentTime = Date.now();

        // Handle sprint stamina drain (every second while sprinting)
        if (this.isSprinting && currentTime >= this.lastStaminaDrainTime + 100) {
            if (!this.requestStamina(this.myPlayer.actions.sprint.drain)) {
                // Out of stamina, stop sprinting
                this.isSprinting = false;
                console.log('Out of stamina, stopped sprinting');
            }
            this.lastStaminaDrainTime = currentTime;
        }

        // Handle stamina recovery
        if (!this.isStaminaRecoveryBlocked || currentTime >= this.staminaRecoveryBlockedUntil) {
            this.isStaminaRecoveryBlocked = false;

            // Recover stamina if not at max and not sprinting
            if (this.myPlayer.stats.stamina.value < this.myPlayer.stats.stamina.max && !this.isSprinting) {
                // Recover stamina per second (16ms frame rate approximation)
                const staminaRecoveryPerFrame = (this.myPlayer.stats.stamina.recovery.rate / 1000) * 16;
                this.myPlayer.stats.stamina.value = Math.min(this.myPlayer.stats.stamina.max, this.myPlayer.stats.stamina.value + staminaRecoveryPerFrame);
            }
        }
    }

    private checkCollisions(): void {
        const collisionRadius = (this.myPlayer.stats.size / 4) + 5;

        this.ammoBoxes.forEach((ammoBox, boxId) => {
            if (ammoBox.isOpen) return;

            const dx = this.myPlayer.transform.pos.x - ammoBox.transform.pos.x;
            const dy = this.myPlayer.transform.pos.y - ammoBox.transform.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= collisionRadius) {
                // Pick up ammo
                this.myPlayer.actions.primary.magazine.currentReserve = Math.min(
                    this.myPlayer.actions.primary.magazine.maxReserve,
                    this.myPlayer.actions.primary.magazine.currentReserve + ammoBox.ammoAmount
                );

                console.log(`Picked up ammo box! +${ammoBox.ammoAmount} bullets. Inventory: ${this.myPlayer.actions.primary.magazine.currentReserve}/${this.myPlayer.actions.primary.magazine.maxReserve}`);

                // Generate random lid physics
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 3;

                ammoBox.isOpen = true;
                ammoBox.lid.velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                ammoBox.lid.torque = (Math.random() - 0.5) * 0.3;

                // Broadcast pickup with full box state
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'ammo-pickup',
                    ammoBoxId: boxId,
                    playerId: this.userId,
                    boxState: {
                        isOpen: true,
                        lid: ammoBox.lid
                    }
                }));
            }
        });
    }

    private getInput(): { inputX: number; inputY: number; inputLength: number } {
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

        return { inputX, inputY, inputLength };
    }

    private isMoving(): boolean {
        return this.getInput().inputLength > 0;
    }

    private spawnGore(centerX: number, centerY: number): any[] {
        const goreDecals = [];

        // Sample unique gore assets
        const goreCount = 2 + Math.floor(Math.random() * 4); // 2-5 pieces
        const gorePool = [...CHARACTER_DECALS.GORE];
        for (let i = 0; i < goreCount && gorePool.length > 0; i++) {
            // Pick a random index and remove it from the pool
            const idx = Math.floor(Math.random() * gorePool.length);
            const goreAsset = gorePool.splice(idx, 1)[0];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.myPlayer.stats.size;

            goreDecals.push({
                type: 'gore',
                assetPath: goreAsset,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                rotation: Math.random() * Math.PI * 2,
                scale: 0.65 + Math.random() * 0.4
            });
        }

        // Sample unique blood assets
        const bloodCount = 1 + Math.floor(Math.random() * 2); // 1-2 pieces
        const bloodPool = [...CHARACTER_DECALS.BLOOD];
        for (let i = 0; i < bloodCount && bloodPool.length > 0; i++) {
            const idx = Math.floor(Math.random() * bloodPool.length);
            const bloodAsset = bloodPool.splice(idx, 1)[0];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (this.myPlayer.stats.size * 0.7);

            goreDecals.push({
                type: 'blood',
                assetPath: bloodAsset,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                rotation: Math.random() * Math.PI * 2,
                scale: 1.25 + Math.random() * 0.2
            });
        }

        return goreDecals;
    }

    private stampGore(decalData: any): void { // TODO: Type protect
        if (!this.decalCtx) return;

        // Load and cache the image
        let image = this.characterImages.get(decalData.assetPath);

        if (!image) {
            image = new Image();
            image.src = decalData.assetPath;
            this.characterImages.set(decalData.assetPath, image);

            // If image isn't loaded yet, try again later
            if (!image.complete) {
                image.onload = () => {
                    this.stampGore(decalData);
                };
                return;
            }
        }

        if (!image.complete || image.naturalWidth === 0) return;

        this.decalCtx.save();

        // Apply position and rotation
        this.decalCtx.translate(decalData.x, decalData.y);
        this.decalCtx.rotate(decalData.rotation);

        // Apply scale and draw
        const drawSize = 32 * decalData.scale; // Base size 32px
        this.decalCtx.drawImage(
            image,
            -drawSize / 2,
            -drawSize / 2,
            drawSize,
            drawSize
        );

        this.decalCtx.restore();
    }

    private resetPlayerState(): void {
        this.canShoot = true;
        this.isBurstActive = false;
        this.isReloading = false;
        this.isSprinting = false;
        this.isDashing = false;
        this.isStaminaRecoveryBlocked = false;

        this.playerVelocityX = 0;
        this.playerVelocityY = 0;

        this.dashStartTime = 0;
        this.lastDashTime = 0;
        this.reloadStartTime = 0;
        this.lastShotTime = 0;
        this.nextBurstShotTime = 0;
        this.currentBurstShot = 0;
        this.lastStaminaDrainTime = 0;
        this.staminaRecoveryBlockedUntil = 0;
    }
    //
    // #endregion

    // #region [ Dash ]
    //
    private startDash(): void {
        if (this.isDashing || this.myPlayer.stats.health.value <= 0 || !this.isMoving()) return;

        const currentTime = Date.now(); // Cooldown check first
        if (currentTime < this.lastDashTime + this.myPlayer.actions.dash.cooldown) {
            console.log('Dash on cooldown');
            return;
        }

        // Input check
        let { inputX, inputY, inputLength } = this.getInput();

        // Normalize input
        if (!this.isMoving()) {
            console.log('No movement input for dash');
            return;
        }

        inputX = inputX / inputLength;
        inputY = inputY / inputLength;

        if (!this.requestStamina(this.myPlayer.actions.dash.drain)) {
            console.log('Not enough stamina to dash');
            return;
        }

        // Start dash
        this.isDashing = true;
        this.dashStartTime = currentTime;
        this.lastDashTime = currentTime;

        // Set dash velocity
        const dashSpeed = this.myPlayer.stats.speed * this.myPlayer.actions.dash.multiplier;
        this.playerVelocityX = inputX * dashSpeed;
        this.playerVelocityY = inputY * dashSpeed;

        console.log(`Dashing! Speed: ${dashSpeed}`);
    }

    private updateDash(): void {
        if (!this.isDashing) return;

        const currentTime = Date.now();

        // Check if dash time is over
        if (currentTime >= this.dashStartTime + this.myPlayer.actions.dash.time) {
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
        this.isRoundInProgress = true;

        this.myPlayer.actions.primary.magazine.currentReserve = Math.floor(PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.MAX_RESERVE / 2);
        this.myPlayer.actions.primary.magazine.currentAmmo = this.myPlayer.actions.primary.magazine.size;
        this.isReloading = false;

        this.initializePlayer();
        this.createLeaderboard();

        resetUpgrades();

        if (this.crosshair) {
            this.toggleCrosshair(); // TODO: Create a function to toggle off all equipment
        }

        // Send my player data
        // TODO: You can maybe just call this.initializePlayer and use the returned player object, unsure yet.
        // TODO: Keep full track of Player object here
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-state',
            id: this.myPlayer.id,
            transform: {
                pos: {
                    x: this.myPlayer.transform.pos.x,
                    y: this.myPlayer.transform.pos.y,
                },
                rot: this.myPlayer.transform.rot
            },
            timestamp: this.myPlayer.timestamp,
            color: this.myPlayer.color,
            actions: {
                dash: {
                    cooldown: this.myPlayer.actions.dash.cooldown,
                    drain: this.myPlayer.actions.dash.drain,
                    multiplier: this.myPlayer.actions.dash.multiplier,
                    time: this.myPlayer.actions.dash.time
                },
                primary: {
                    buffer: this.myPlayer.actions.primary.buffer,
                    burst: {
                        amount: this.myPlayer.actions.primary.burst.amount,
                        delay: this.myPlayer.actions.primary.burst.delay
                    },
                    magazine: {
                        currentAmmo: this.myPlayer.actions.primary.magazine.currentAmmo,
                        currentReserve: this.myPlayer.actions.primary.magazine.currentReserve,
                        maxReserve: this.myPlayer.actions.primary.magazine.maxReserve,
                        size: this.myPlayer.actions.primary.magazine.size
                    },
                    offset: this.myPlayer.actions.primary.offset,
                    projectile: {
                        amount: this.myPlayer.actions.primary.projectile.amount,
                        color: this.myPlayer.actions.primary.projectile.color,
                        damage: this.myPlayer.actions.primary.projectile.damage,
                        length: this.myPlayer.actions.primary.projectile.length,
                        range: this.myPlayer.actions.primary.projectile.range,
                        size: this.myPlayer.actions.primary.projectile.size,
                        speed: this.myPlayer.actions.primary.projectile.speed,
                        spread: this.myPlayer.actions.primary.projectile.spread,
                        unique: this.myPlayer.actions.primary.projectile.unique
                    },
                    reload: {
                        time: this.myPlayer.actions.primary.reload.time
                    }
                },
                sprint: {
                    drain: this.myPlayer.actions.sprint.drain,
                    multiplier: this.myPlayer.actions.sprint.multiplier
                }
            },
            equipment: {
                crosshair: this.myPlayer.equipment.crosshair
            },
            physics: {
                acceleration: this.myPlayer.physics.acceleration,
                friction: this.myPlayer.physics.friction
            },
            stats: {
                health: {
                    max: this.myPlayer.stats.health.max,
                    value: this.myPlayer.stats.health.value
                },
                luck: this.myPlayer.stats.luck,
                size: this.myPlayer.stats.size,
                speed: this.myPlayer.stats.speed,
                stamina: {
                    max: this.myPlayer.stats.stamina.max,
                    recovery: {
                        delay: this.myPlayer.stats.stamina.recovery.delay,
                        rate: this.myPlayer.stats.stamina.recovery.rate
                    },
                    value: this.myPlayer.stats.stamina.value,
                },
            }
        }));

        this.gameLoop();

        setSlider('healthBar', this.myPlayer.stats.health.value, this.myPlayer.stats.health.max);
        setSlider('staminaBar', this.myPlayer.stats.stamina.value, this.myPlayer.stats.stamina.max);
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
        this.updateEmitters();
        this.updateCharacterAnimations();

        setSlider('staminaBar', this.myPlayer.stats.stamina.value, this.myPlayer.stats.stamina.max);

        this.clearCtx(this.ctx);

        this.ctx.drawImage(this.decalCanvas, 0, 0)

        // Draw border
        this.ctx.strokeStyle = CANVAS.BORDER_COLOR;
        this.ctx.lineWidth = CANVAS.BORDER_WIDTH;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawAmmoBoxes();

        // Draw projectiles
        this.projectiles.forEach(projectile => {
            this.drawProjectile(projectile);
        });

        // Draw other players
        this.players.forEach(player => {
            this.drawCharacter(player);
        });

        this.drawCharacter(this.myPlayer, true);
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
        this.isBurstActive = false;
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

    /**
     * DO NOT CALL THIS FUNCTION - CALL togglePause();
     */
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

    private resetGameState(resetType: ResetType): void {
        // Clear game flags
        this.gameRunning = false;
        this.isRoundInProgress = false;
        this.gameWinner = null;
        this.roundWinner = null;

        if (resetType === 'Room') {
            this.inLobby = false;
            this.isHost = false;
        }

        // Clear all collections
        this.players.clear();
        this.projectiles.clear();
        this.ammoBoxes.clear();
        this.decals.clear();
        this.particles.clear();
        this.emitters.clear();
        this.pausedPlayers.clear();

        if (resetType === 'Room') {
            this.lobbyPlayers.clear();
        }

        // Reset UI and player
        this.clearCtx();
        this.clearChat();
        this.clearLeaderboard();
        this.resetPlayerState();
        this.initializePlayer();

        // Reset upgrades and equipment
        resetUpgrades();
        if (this.crosshair) {
            this.toggleCrosshair(); // TODO: Create a function to toggle off all equipment
        }
    }
    //
    // #endregion

    // #region [ Upgrade ]
    //
    private startUpgradePhase(winnerId: string | null): void {
        console.log('Starting upgrade phase...');
        this.togglePause();

        // Show upgrade UI based on if I won or lost
        if (winnerId === this.userId) {
            this.showWinnerWaitScreen();
        } else {
            this.showUpgradeSelection();
        }
    }

    private showWinnerWaitScreen(): void {
        if (!this.upgradeContainer) return;

        this.upgradeContainer.innerHTML = '';

        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'upgrade_waiting';
        waitingDiv.textContent = 'Waiting for other players...';

        this.upgradeContainer.appendChild(waitingDiv);
        this.upgradeContainer.style.display = 'flex';
    }

    private showWinnerContinueButton(): void {
        if (!this.upgradeContainer) return;

        // Clear existing content
        this.upgradeContainer.innerHTML = '';

        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'upgrade_waiting';
        waitingDiv.textContent = 'Upgrade phase complete.';

        const continueBtn = document.createElement('button');
        continueBtn.textContent = 'Continue';
        continueBtn.onclick = () => {
            if (!this.upgradeContainer) return;
            console.log("Winner pressed continue...");

            this.upgradeContainer.style.display = 'none';
            this.roomManager.sendMessage(JSON.stringify({
                type: 'upgrade-complete',
                userId: this.userId
            }));
        };

        this.upgradeContainer.appendChild(waitingDiv);
        this.upgradeContainer.appendChild(continueBtn);
        this.upgradeContainer.style.display = 'flex';
    }

    private showUpgradeSelection(): void {
        if (!this.upgradeContainer) return;

        this.upgradeContainer.innerHTML = '';

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
                console.log("Selected upgrade: ", upgrade.name);
                this.selectUpgrade(upgrade.id);
            });

            if (!this.upgradeContainer) return;
            this.upgradeContainer.appendChild(upgradeDiv);
        });

        this.upgradeContainer.style.display = 'flex';
    }

    private selectUpgrade(upgradeId: string): void {
        const success = applyUpgrade(upgradeId);
        if (!success) {
            console.error('Failed to apply upgrade');
            return;
        }

        if (upgradeId === 'neural_target_interface') {
            this.toggleCrosshair();
        }

        // Notify others about upgrade taken
        this.roomManager.sendMessage(JSON.stringify({
            type: 'upgrade-taken',
            upgradeId: upgradeId,
            userId: this.userId,
            isUnique: UPGRADES.find(u => u.id === upgradeId)?.unique || false
        }));

        // Hide upgrade UI
        if (this.upgradeContainer) {
            this.upgradeContainer.style.display = 'none';
        }

        // Signal I'm done with upgrades
        this.roomManager.sendMessage(JSON.stringify({
            type: 'upgrade-complete',
            userId: this.userId
        }));

        console.log('Upgrade selected, waiting for others...');
    }

    public toggleCrosshair(): void { // TODO: Expand this to be something like "toggleEquipment" - pass the equipment, then case switch
        if (!this.crosshair) return;

        if (this.myPlayer.equipment.crosshair) {
            this.crosshair.style.display = 'block';
            console.log('Crosshair enabled');
        } else {
            this.crosshair.style.display = 'none';
            console.log('Crosshair disabled');
        }
    }

    private spawnAmmoBox(amount: number): AmmoBox { // TODO: Expand this "spawnObject" - this should be able to spawn any game object type
        const ammoBox: AmmoBox = {
            id: generateUID(),
            transform: {
                pos: {
                    x: this.myPlayer.transform.pos.x,
                    y: this.myPlayer.transform.pos.y
                },
                rot: this.myPlayer.transform.rot
            },
            timestamp: Date.now(),
            ammoAmount: amount,
            isOpen: false,
            lid: {
                pos: { x: 0, y: 0 },
                rot: 0,
                velocity: { x: 0, y: 0 },
                torque: 0
            }
        };
        return ammoBox;
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
    private drawCharacter(player: Player, isMe: boolean = false): void {
        if (!this.ctx) return;
        if (player.stats.health.value <= 0) return;

        // For now, use default character config - later this will be per-player
        const characterConfig = CHARACTER;

        // Render layers in order: BODY → WEAPON → HEAD → HEADWEAR
        this.drawCharacterLayer(player, 'BODY', characterConfig.body);
        this.drawCharacterLayer(player, 'WEAPON', characterConfig.weapon);
        this.drawCharacterLayer(player, 'HEAD', characterConfig.head);
        this.drawCharacterLayer(player, 'HEADWEAR', characterConfig.headwear);

        // Draw player name/info (existing code)
        this.ctx.fillStyle = UI.TEXT_COLOR;
        this.ctx.font = UI.FONT;
        this.ctx.textAlign = 'center';

        const displayName = isMe ? 'You' : player.id.substring(0, 6);
        this.ctx.fillText(
            displayName,
            player.transform.pos.x,
            player.transform.pos.y - PLAYER_DEFAULTS.VISUAL.ID_DISPLAY_OFFSET
        );
    }

    private drawCharacterLayer(player: Player, layer: CharacterLayer, variant: string): void {
        if (!this.ctx) return;

        const assets = getCharacterAsset(layer, variant);

        if (typeof assets === 'string') {
            this.drawCharacterPart(player, assets, layer);
        }
        else if (Array.isArray(assets)) {
            assets.forEach((assetPath, index) => {
                this.drawCharacterPart(player, assetPath, layer, index);
            });
        }
    }

    private drawCharacterPart(player: Player, assetPath: string, partType: CharacterLayer, partIndex?: number): void {
        if (!this.ctx) return;

        let image = this.characterImages.get(assetPath);

        if (!image) {
            image = new Image();
            image.src = assetPath;
            this.characterImages.set(assetPath, image);
            if (!image.complete) return;
        }

        if (!image.complete || image.naturalWidth === 0) return;

        const drawSize = GAME.CHARACTER_SIZE * (player.stats.size / GAME.CHARACTER_SIZE);

        // Check for animation offset
        const animationId = `${player.id}_${partType}_${partIndex || 0}`;
        const animationOffset = this.characterOffsets?.get(animationId) || { x: 0, y: 0 };

        this.ctx.save();

        // Apply rotation if it exists
        if (player.transform.rot !== undefined) {
            this.ctx.translate(player.transform.pos.x, player.transform.pos.y);
            this.ctx.rotate(player.transform.rot);

            // Apply animation offset
            this.ctx.translate(animationOffset.x, animationOffset.y);

            this.ctx.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
        } else {
            this.ctx.drawImage(
                image,
                player.transform.pos.x - drawSize / 2 + animationOffset.x,
                player.transform.pos.y - drawSize / 2 + animationOffset.y,
                drawSize,
                drawSize
            );
        }

        this.ctx.restore();
    }

    private drawProjectile(projectile: Projectile): void {
        if (!this.ctx) return;

        // Calculate projectile direction
        const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
        const dirX = projectile.velocity.x / speed;
        const dirY = projectile.velocity.y / speed;

        // Calculate front and back points
        const frontX = projectile.transform.pos.x + dirX * (projectile.length / 2);
        const frontY = projectile.transform.pos.y + dirY * (projectile.length / 2);
        const backX = projectile.transform.pos.x - dirX * (projectile.length / 2);
        const backY = projectile.transform.pos.y - dirY * (projectile.length / 2);

        // Draw the capsule body (rectangle)
        this.ctx.fillStyle = projectile.color;
        this.ctx.strokeStyle = projectile.color;
        this.ctx.lineWidth = projectile.size;
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

    private drawAmmoBoxes(): void {
        if (!this.ctx) return;

        this.ammoBoxes.forEach(ammoBox => {
            if (!this.ctx) return;

            // Load and cache images
            if (!this.ammoBoxImages) this.ammoBoxImages = {};
            const layers: (keyof typeof AMMO_BOX)[] = ['BODY', 'BULLETS', 'LID'];
            layers.forEach(layer => {
                if (!this.ammoBoxImages[layer]) {
                    const img = new Image();
                    img.src = AMMO_BOX[layer];
                    this.ammoBoxImages[layer] = img;
                }
            });

            if (!layers.every(layer => this.ammoBoxImages[layer]?.complete && this.ammoBoxImages[layer]?.naturalWidth > 0)) return;

            const scale = 35;
            const x = ammoBox.transform.pos.x;
            const y = ammoBox.transform.pos.y;

            // Update lid physics if open
            if (ammoBox.isOpen) {
                ammoBox.lid.velocity.x *= 0.85;
                ammoBox.lid.velocity.y *= 0.85;
                ammoBox.lid.torque *= 0.85;

                ammoBox.lid.pos.x += ammoBox.lid.velocity.x;
                ammoBox.lid.pos.y += ammoBox.lid.velocity.y;
                ammoBox.lid.rot += ammoBox.lid.torque;
            }

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(ammoBox.transform.rot || 0);

            // Draw body
            this.ctx.drawImage(this.ammoBoxImages['BODY'], -scale / 2, -scale / 2, scale, scale);

            // Draw bullets only if NOT open
            if (!ammoBox.isOpen) {
                this.ctx.drawImage(this.ammoBoxImages['BULLETS'], -scale / 2, -scale / 2, scale, scale);
                // Draw closed lid here
                this.ctx.drawImage(this.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
            }

            this.ctx.restore();

            // Draw flying lid separately if open
            if (ammoBox.isOpen) {
                this.ctx.save();
                this.ctx.translate(x + ammoBox.lid.pos.x, y + ammoBox.lid.pos.y);
                this.ctx.rotate((ammoBox.transform.rot || 0) + ammoBox.lid.rot);
                this.ctx.drawImage(this.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
                this.ctx.restore();
            }
        });
    }

    /**
     * Clear all canvas rendering context in the game.
     * 
     * / OR /
     * 
     * Pass the specific CanvasRenderingContext2D to clear.
     */
    private clearCtx(customCtx?: CanvasRenderingContext2D): void {
        if (customCtx) {
            customCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
            return;
        }

        if (!this.decalCtx || !this.ctx) return;

        this.ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        this.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
    }
    //
    // #endregion

    // #region [ Animation ]
    //
    private animateCharacterPart(playerId: string, part: string, frames: { [key: number]: { x: number, y: number } }, duration: number, partIndex?: number): void {
        const animationId = `${playerId}_${part}_${partIndex || 0}`;

        this.characterAnimations.set(animationId, {
            playerId: playerId,
            part: part,
            partIndex: partIndex,
            frames: frames,
            duration: duration,
            startTime: Date.now(),
            originalOffset: { x: 0, y: 0 }
        });

        this.roomManager.sendMessage(JSON.stringify({
            type: 'character-animation',
            playerId: playerId,
            part: part,
            partIndex: partIndex,
            frames: frames,
            duration: duration
        }));
    }

    // Add to gameLoop update section (around line 1925, after updateParticles)
    private updateCharacterAnimations(): void {
        const animationsToRemove: string[] = [];
        const currentTime = Date.now();

        this.characterAnimations.forEach((animation, animationId) => {
            const elapsed = currentTime - animation.startTime;
            const progress = elapsed / animation.duration;

            if (animation.duration !== 0 && progress >= 1) {
                // Animation complete, remove it
                animationsToRemove.push(animationId);
                return;
            }

            // Find current keyframe
            const frameKeys = Object.keys(animation.frames).map(Number).sort((a, b) => a - b);
            let currentFrameIndex = 0;

            for (let i = 0; i < frameKeys.length - 1; i++) {
                const frameProgress = frameKeys[i];
                const nextFrameProgress = frameKeys[i + 1];

                if (progress >= frameProgress && progress < nextFrameProgress) {
                    currentFrameIndex = i;
                    break;
                }
            }

            let lerpedX, lerpedY;
            if (progress >= 1) {
                // Hold at last keyframe for infinite animation
                const lastFrame = animation.frames[frameKeys[frameKeys.length - 1]];
                lerpedX = lastFrame.x;
                lerpedY = lastFrame.y;
            } else {
                // Normal lerp
                const currentFrame = animation.frames[frameKeys[currentFrameIndex]];
                const nextFrame = animation.frames[frameKeys[currentFrameIndex + 1]] || currentFrame;
                const frameProgress = (progress - frameKeys[currentFrameIndex]) / (frameKeys[currentFrameIndex + 1] - frameKeys[currentFrameIndex]) || 0;
                lerpedX = currentFrame.x + (nextFrame.x - currentFrame.x) * frameProgress;
                lerpedY = currentFrame.y + (nextFrame.y - currentFrame.y) * frameProgress;
            }

            this.characterOffsets.set(animationId, { x: lerpedX, y: lerpedY });
        });

        // Remove completed animations
        animationsToRemove.forEach(id => {
            this.characterAnimations.delete(id);
            if (this.characterOffsets) {
                this.characterOffsets.delete(id);
            }
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
    // [ Basic Particles ]
    //
    /**
     * Creates particles with params. Entrypoint for all particle creations. [ CALL THIS FUNCTION ]
     */
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

    /**
     * Network creation of particles, responds to websocket message "add-particles".
     */
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

    /**
     * Handles updating of all particles in the game during the update loop.
     */
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
    //

    // [ Particle Persistence ]
    //
    /**
     * Stamps persistent particles onto the decal canvas. [ CALL THIS FUNCTION ]
     */
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

    /**
     * Responsible for persisting particles over the network, responds to websocket message  "particle-stamp".
     */
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

    // [ Particle Emitters ]
    // TODO: Obfuscate the emitters for more general use than just blood gushing. Add emitter types in config.
    //
    /**
     * Creates a particle emitter in the game, and syncs this action via websocket message "particle-emitter".
     */
    private createEmitter(playerId: string, hitX: number, hitY: number): void {
        const player = playerId === this.userId ? this.myPlayer : this.players.get(playerId);
        if (!player) return;

        // Calculate offset from player center
        const offsetX = hitX - player.transform.pos.x;
        const offsetY = hitY - player.transform.pos.y;

        // Calculate direction (away from player center towards hit point)
        const angle = Math.atan2(offsetY, offsetX);

        const emitterId = `particle_emitter_${playerId}_${Date.now()}`;
        const emitterLifetime = 1000 + Math.random() * 2000;

        this.emitters.set(emitterId, {
            playerId: playerId,
            offsetX: offsetX,
            offsetY: offsetY,
            direction: angle,
            lifetime: emitterLifetime,
            age: 0,
            lastEmission: 0,
            emissionInterval: 200 + Math.random() * 300
        });

        // Broadcast to other clients
        this.roomManager.sendMessage(JSON.stringify({
            type: 'particle-emitter',
            emitterId: emitterId,
            playerId: playerId,
            offsetX: offsetX,
            offsetY: offsetY,
            direction: angle,
            lifetime: emitterLifetime
        }));

        console.log(`Emitter created on ${playerId} for ${emitterLifetime}ms`);
    }

    /**
     * Process all particle emitters in the game during the update loop.
     */
    private updateEmitters(): void {
        const emittersToRemove: string[] = [];

        this.emitters.forEach((emitter, emitterId) => {
            emitter.age += 16; // 60fps frame time

            const player = emitter.playerId === this.userId ? this.myPlayer : this.players.get(emitter.playerId);
            if (!player || player.stats.health.value <= 0) {
                emittersToRemove.push(emitterId);
                return;
            }

            // Calculate current world position
            const worldX = player.transform.pos.x + emitter.offsetX;
            const worldY = player.transform.pos.y + emitter.offsetY;

            if (emitter.age >= emitter.lastEmission + emitter.emissionInterval) {
                // Create directional spray with cone spread
                const coneSpread = Math.PI * 0.6; // 108 degree cone
                const randomSpread = (Math.random() - 0.5) * coneSpread;
                const angle = emitter.direction + randomSpread;

                // Variable speed for more natural spray
                const baseSpeed = 3;
                const speedVariation = (Math.random() - 0.5) * 4; // -2 to +2
                const finalSpeed = Math.max(0.5, baseSpeed + speedVariation);

                this.createParticles(
                    worldX + (Math.random() - 0.5) * 8, // Small random spawn offset
                    worldY + (Math.random() - 0.5) * 8,
                    `blood_splatter_${emitterId}_${emitter.age}`,
                    PARTICLES.BLOOD_DRIP,
                    {
                        x: Math.cos(angle) * finalSpeed,
                        y: Math.sin(angle) * finalSpeed
                    }
                );

                emitter.lastEmission = emitter.age;
                emitter.emissionInterval = 120 + Math.random() * 180; // More consistent timing
            }

            // Remove expired emitters
            if (emitter.age >= emitter.lifetime) {
                this.createDecal(worldX, worldY, `emitter_decal_${emitterId}`, DECALS.BLOOD); // Create permanent decal on ground
                emittersToRemove.push(emitterId);
            }
        });

        emittersToRemove.forEach(id => this.emitters.delete(id));
    }
    //
    // #endregion

    // #region [ UI ]
    //








    private showJoinRoomModal(): void {
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
                    roomId = url.pathname.replace("/", "").replace("/", "");
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
            this.joinRoomById(roomId);
        };

        this.modalCancelButton.onclick = closeModal;

        this.modalInput.onkeydown = (e) => {
            if (e.key === "Enter") if (this.modalConfirmButton) this.modalConfirmButton.click();
            if (e.key === "Escape") closeModal();
        };
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




    /**
     * Updates the display based on the current state.
     */
    private updateDisplay(target: "lobby" | "room" | "game", roomId?: string): void {
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
                this.inLobby = true;
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
                this.inLobby = false;
                break;
        }
    }

    /**
     * Shows host controls when called.
     */
    private updateHostDisplay(): void {
        if (!this.startGameBtn || !this.gameOptionsContainer) return;

        this.startGameBtn.style.display = this.isHost ? 'block' : 'none';
        this.startGameBtn.disabled = this.lobbyPlayers.size < 1;

        this.gameOptionsContainer.style.display = this.isHost ? 'flex' : 'none';
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
}

// Initialize the game client
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GameClient();
    });
} else {
    new GameClient();
}