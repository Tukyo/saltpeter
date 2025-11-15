
import { VIEWPORT, GAME, WORLD } from './Config';
import { Player, RoomMessage, LobbyPlayer, ResetType, SetSpanParams, DeathDecal, EmitterParams, GameSettings, RenderCharacterParams } from './Types';

import { Admin } from './Admin';
import { Animator } from './Animator';
import { CacheManager } from './CacheManager';
import { Camera } from './Camera';
import { CharacterConfig } from './CharacterConfig';
import { CharacterManager } from './CharacterManager';
import { ControlsManager } from './ControlsManager';
import { CollisionsManager } from './CollisionsManager';
import { DecalsManager } from './DecalsManager';
import { EventsManager } from './EventsManager';
import { GameState } from './GameState';
import { LobbyManager } from './LobbyManager';
import { ObjectsManager } from './ObjectsManager';
import { ParticlesManager } from './ParticlesManager';
import { RenderingManager } from './RenderingManager';
import { RoomController } from './RoomController';
import { RoomManager } from './RoomManager';
import { SettingsManager } from './SettingsManager';
import { UpgradeManager } from './UpgradeManager';
import { UserInterface } from './UserInterface';
import { Utility } from './Utility';
import { WebsocketManager } from './WebsocketManager';

import { AudioConfig } from './audio/AudioConfig';
import { AudioManager } from './audio/AudioManager';

import { ChatManager } from './chat/ChatManager';

import { CombatController } from './player/CombatController';
import { DashController } from './player/DashController';
import { LuckController } from './player/LuckController';
import { MoveController } from './player/MoveController';
import { PlayerConfig } from './player/PlayerConfig';
import { PlayerController } from './player/PlayerController';
import { PlayerState } from './player/PlayerState';
import { StaminaController } from './player/StaminaController';

import { World } from './world/World';

class Client {
    private userId: string;

    private isRoundInProgress = false;

    private roundWinner: string | null = null;
    private gameWinner: string | null = null; // TODO: Use the game winner to display lobby historical wins

    private admin: Admin;
    private animator: Animator;
    private audioConfig: AudioConfig;
    private audioManager: AudioManager;
    private cacheManager: CacheManager;
    private camera: Camera;
    private charConfig: CharacterConfig;
    private charManager: CharacterManager;
    private chatManager: ChatManager;
    private collisionsManager: CollisionsManager;
    private combatController: CombatController;
    private controlsManager: ControlsManager;
    private dashController: DashController;
    private decalsManager: DecalsManager;
    private eventsManager: EventsManager;
    private gameState: GameState;
    private lobbyManager: LobbyManager;
    private luckController: LuckController;
    private moveController: MoveController;
    private objectsManager: ObjectsManager;
    private particlesManager: ParticlesManager;
    private playerConfig: PlayerConfig;
    private playerController: PlayerController;
    private playerState: PlayerState;
    private renderingManager: RenderingManager;
    private roomController: RoomController;
    private roomManager: RoomManager;
    private settingsManager: SettingsManager;
    private staminaController: StaminaController;
    private upgradeManager: UpgradeManager;
    private ui: UserInterface;
    private utility: Utility;
    private wsManager: WebsocketManager;
    private world: World;

    // #region [ Initialization ]
    //
    constructor() {
        this.cacheManager = new CacheManager();
        this.utility = new Utility();
        this.gameState = new GameState();

        this.audioConfig = new AudioConfig();

        this.playerConfig = new PlayerConfig();

        this.settingsManager = new SettingsManager(this.audioConfig, this.cacheManager, this.playerConfig);
        this.controlsManager = new ControlsManager(this.settingsManager);

        this.charConfig = new CharacterConfig();
        this.charManager = new CharacterManager(this.charConfig);

        this.userId = this.utility.generateUID(this.playerConfig.default.data.idLength);
        this.playerState = new PlayerState(this.playerConfig, this.userId, this.utility);

        this.camera = new Camera(this.playerState, this.utility);

        this.ui = new UserInterface(this.playerState, this.settingsManager, this.utility);

        this.admin = new Admin(this.cacheManager, this.ui);

        this.objectsManager = new ObjectsManager(this.playerState, this.utility);

        this.roomManager = new RoomManager(this.userId, this.utility);
        this.lobbyManager = new LobbyManager(this.charManager, this.playerConfig, this.playerState, this.roomManager, this.settingsManager, this.ui, this.utility);
        this.wsManager = new WebsocketManager(this.gameState, this.roomManager, this.utility);
        this.chatManager = new ChatManager(this.roomManager, this.ui);

        this.upgradeManager = new UpgradeManager(
            this.playerConfig,
            this.playerState,
            this.ui,
            this.utility
        );

        this.roomController = new RoomController(
            this.gameState,
            this.lobbyManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.upgradeManager,
            this.userId,
            this.utility,
            this.wsManager
        );

        this.collisionsManager = new CollisionsManager(
            this.objectsManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.userId
        );

        this.moveController = new MoveController(this.controlsManager, this.playerState, this.settingsManager);
        this.staminaController = new StaminaController(this.playerState);
        this.luckController = new LuckController(this.playerState);

        this.audioManager = new AudioManager(this.audioConfig, this.roomManager, this.settingsManager, this.utility);
        this.animator = new Animator(this.playerState, this.roomManager, this.userId);

        this.world = new World(
            this.audioConfig,
            this.audioManager,
            this.camera,
            this.controlsManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.utility
        );

        this.renderingManager = new RenderingManager(
            this.animator,
            this.camera,
            this.charManager,
            this.lobbyManager,
            this.objectsManager,
            this.playerConfig,
            this.ui,
            this.userId
        );

        this.decalsManager = new DecalsManager(
            this.camera,
            this.charConfig,
            this.playerState,
            this.renderingManager,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility
        );

        this.particlesManager = new ParticlesManager(
            this.camera,
            this.charConfig,
            this.collisionsManager,
            this.decalsManager,
            this.playerState,
            this.renderingManager,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility
        );

        this.playerController = new PlayerController(
            this.audioConfig,
            this.audioManager,
            this.decalsManager,
            this.gameState,
            this.luckController,
            this.moveController,
            this.objectsManager,
            this.particlesManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility,
            this.world
        );

        this.combatController = new CombatController(
            this.animator,
            this.audioConfig,
            this.audioManager,
            this.collisionsManager,
            this.decalsManager,
            this.gameState,
            this.luckController,
            this.particlesManager,
            this.playerController,
            this.playerState,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility,
            this.world
        );

        this.dashController = new DashController(
            this.collisionsManager,
            this.combatController,
            this.moveController,
            this.playerState,
            this.roomManager,
            this.staminaController,
            this.userId
        );

        this.eventsManager = new EventsManager(
            this.animator,
            this.audioManager,
            this.camera,
            this.chatManager,
            this.controlsManager,
            this.gameState,
            this.roomController,
            this.playerState,
            this.settingsManager,
            this.ui,
            this.userId
        );

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { this.initClient(); });
        } else {
            this.initClient();
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameState.gameInProgress && !this.lobbyManager.inLobby) {
                e.preventDefault();
                // TODO: Test stuff here!

                const ammo = 20;

                this.playerState.myPlayer.actions.primary.magazine.currentReserve += ammo;
                this.ui.ammoReservesUIController.spawnAmmoInReserveUI(ammo);
            }
        });
    }

    /**
     * Clears the client state.
     */
    private clear(): void {
        this.isRoundInProgress = false;
        this.gameWinner = null;
        this.roundWinner = null;
    }

    /**
     * Main initializer for the game client.
     */
    private async initClient(): Promise<void> {
        this.ui.initInterface();
        this.eventsManager.initEventListeners();
        this.initGlobalEvents();

        this.roomController.checkForRoomInURL();
        this.roomController.showRoomControls();

        const spanParams: SetSpanParams = {
            spanId: 'userId',
            value: this.userId
        }
        this.utility.setSpan(spanParams);

        await this.settingsManager.loadSettings();
        const settings: GameSettings = this.settingsManager.getSettings();

        this.ui.initSoundSliders(settings);
        this.ui.initSettingsInputs(settings);
        this.ui.initSettingsToggles(settings)
        this.ui.ammoReservesUIController.initAmmoReserveCanvas();

        this.eventsManager.initKeybindListeners();

        this.audioManager.updateMixerGains();
        await this.audioManager.preloadAudio(this.audioConfig.resources.sfx, '.ogg');
        await this.audioManager.preloadAudio(this.audioConfig.resources.ambience, '.ogg');

        this.watchForInputs();

        this.admin.onAdminCommand = (command, key) => {
            this.roomManager.sendAdminCommand(command, key);
        };

        window.addEventListener("customEvent_AppStart", () => { // Start playing background ambience once the app has been entered by user agency
            const src = this.audioConfig.resources.ambience.beds.app[0];
            this.audioManager.playAudio({
                src: src,
                loop: true,
                output: "ambience",
                volume: { min: 0.025, max: 0.025 }
            });
        });

    }

    /**
     * Initializes event listeners.
     */
    private initGlobalEvents(): void {
        window.addEventListener("customEvent_startGame", () => this.startGame());
        window.addEventListener("customEvent_resetGameState", (e: Event) => {
            const event = e as CustomEvent<{ resetType: ResetType }>;
            this.resetGameState(event.detail.resetType);
        });

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
    }
    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Client <> Server ]
    //
    /**
     * Responsible for room related WS messages.
     */
    private handleRoomMessage(message: RoomMessage): void {
        switch (message.type) {
            case 'room-created':
                console.log('Room created');
                break;
            case 'room-joined':
                console.log('Joined room - lobby');
                this.playerState.isHost = false;
                this.lobbyManager.showLobbyControls({
                    lobby: this.lobbyManager,
                    lobbyOptions: {
                        maxPlayers: this.gameState.gameMaxPlayers,
                        maxWins: this.gameState.gameMaxWins,
                        isHost: this.playerState.isHost,
                        privateRoom: this.roomManager.isPrivateRoom,
                        upgradesEnabled: this.upgradeManager.isUpgradesEnabled
                    },
                    myPlayer: this.playerState.myPlayer,
                    roomId: this.roomManager.getCurrentRoom() || "",
                    userId: this.userId
                });

                // Send my lobby info
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'lobby-join',
                    color: this.playerState.myPlayer.color,
                    rig: {
                        body: this.playerConfig.default.rig.body,
                        head: this.playerConfig.default.rig.head,
                        headwear: this.playerConfig.default.rig.headwear,
                        weapon: this.playerConfig.default.rig.weapon
                    }
                }));

                const centerX = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.width / 2 : 0;
                const centerY = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.height / 2 : 0;

                // Add myself to lobby
                this.lobbyManager.lobbyPlayers.set(this.userId, {
                    id: this.userId,
                    color: this.playerState.myPlayer.color,
                    isHost: this.playerState.isHost,
                    rig: {
                        body: this.playerConfig.default.rig.body,
                        head: this.playerConfig.default.rig.head,
                        headwear: this.playerConfig.default.rig.headwear,
                        weapon: this.playerConfig.default.rig.weapon
                    },
                    transform: {
                        pos: { x: centerX, y: centerY },
                        rot: 0
                    }
                });
                this.ui.displayLobbyPlayers(this.playerState.isHost, this.lobbyManager, this.userId);
                this.ui.updateHostDisplay(this.playerState.isHost, this.lobbyManager);

                if (this.lobbyManager.lobbyPlayers.size === 0) { // No other players added to lobby list
                    this.playerState.isHost = true;
                    this.lobbyManager.lobbyPlayers.get(this.userId)!.isHost = true;
                    this.ui.updateHostDisplay(this.playerState.isHost, this.lobbyManager);
                    console.log('I am the only player in the room...');
                }
                break;
            case 'user-left':
                console.log(`User ${message.userId} left`);
                this.lobbyManager.lobbyPlayers.delete(message.userId);
                this.playerState.players.delete(message.userId);

                // Remove from leaderboard when player leaves
                this.ui.leaderboard.delete(message.userId);
                this.ui.updateLeaderboardDisplay(this.userId);
                console.log(`Removed ${message.userId} from leaderboard`);

                // Remove projectiles from disconnected player
                this.combatController.projectiles.forEach((projectile, id) => {
                    if (projectile.ownerId === message.userId) {
                        this.combatController.projectiles.delete(id);
                    }
                });
                this.ui.displayLobbyPlayers(this.playerState.isHost, this.lobbyManager, this.userId);
                break;
            case 'room-message':
                this.handleGameMessage(message);
                break;
            case 'room-error':
                alert(`Error: ${message.message}`);
                break;
        }
    }

    /**
     * Processes all client sent network messages related to gameplay and lobby logic.
     */
    private async handleGameMessage(message: RoomMessage): Promise<void> {
        if (!message.message) return;

        try {
            const gameData = JSON.parse(message.message);

            switch (gameData.type) {
                //
                // [ Lobby ]
                //
                case 'lobby-join':
                    const centerX = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.width / 2 : 0;
                    const centerY = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.height / 2 : 0;

                    this.lobbyManager.lobbyPlayers.set(message.userId, {
                        id: message.userId,
                        color: gameData.color,
                        isHost: false,
                        rig: gameData.rig,
                        transform: {
                            pos: { x: centerX, y: centerY },
                            rot: 0
                        }
                    });
                    this.ui.displayLobbyPlayers(this.playerState.isHost, this.lobbyManager, this.userId);

                    // If I'm host, send current lobby state to new player
                    if (this.playerState.isHost) {
                        this.roomManager.sendMessage(JSON.stringify({
                            type: 'lobby-state',
                            players: Array.from(this.lobbyManager.lobbyPlayers.values()),
                            options: {
                                privateRoom: this.roomManager.isPrivateRoom,
                                maxPlayers: this.gameState.gameMaxPlayers,
                                maxWins: this.gameState.gameMaxWins,
                                upgradesEnabled: this.upgradeManager.isUpgradesEnabled
                                // TODO: Add more room options here as enabled
                            }
                        }));
                    }
                    break;
                case 'lobby-state':
                    this.lobbyManager.lobbyPlayers.clear();

                    gameData.players.forEach((player: LobbyPlayer) => {
                        this.lobbyManager.lobbyPlayers.set(player.id, player);
                    });

                    this.ui.displayLobbyPlayers(this.playerState.isHost, this.lobbyManager, this.userId);
                    this.ui.updateHostDisplay(this.playerState.isHost, this.lobbyManager);

                    if (gameData.options) {
                        this.lobbyManager.syncLobbyOptions(gameData.options);
                    }
                    break;
                case 'lobby-options':
                    this.lobbyManager.syncLobbyOptions(gameData);
                    break;
                case 'promote-player':
                    this.lobbyManager.lobbyPlayers.forEach((player, id) => { // Update host status for all players
                        player.isHost = id === gameData.targetPlayerId;
                    });

                    // Update my own host status
                    this.playerState.isHost = gameData.targetPlayerId === this.userId;

                    // If I just became host due to migration, log it
                    if (this.playerState.isHost && gameData.reason === 'host-migration') {
                        console.log('I am now the host due to host migration');
                    }

                    this.lobbyManager.setupLobbyOptions({
                        maxPlayers: this.gameState.gameMaxPlayers,
                        maxWins: this.gameState.gameMaxWins,
                        isHost: this.playerState.isHost,
                        privateRoom: this.roomManager.isPrivateRoom,
                        upgradesEnabled: this.upgradeManager.isUpgradesEnabled
                    });

                    this.ui.displayLobbyPlayers(this.playerState.isHost, this.lobbyManager, this.userId);
                    this.ui.updateHostDisplay(this.playerState.isHost, this.lobbyManager);
                    break;
                case 'return-to-lobby': // New message type
                    console.log('Returning to lobby - last player or game ended');

                    // Update host status if I'm the new host
                    if (gameData.newHostId === this.userId) {
                        this.playerState.isHost = true;
                        console.log('I am now the host as the last remaining player');
                    }

                    this.resetGameState('Lobby');

                    // Show lobby
                    this.lobbyManager.showLobbyControls({
                        lobby: this.lobbyManager,
                        lobbyOptions: {
                            maxPlayers: this.gameState.gameMaxPlayers,
                            maxWins: this.gameState.gameMaxWins,
                            isHost: this.playerState.isHost,
                            privateRoom: this.roomManager.isPrivateRoom,
                            upgradesEnabled: this.upgradeManager.isUpgradesEnabled
                        },
                        myPlayer: this.playerState.myPlayer,
                        roomId: this.roomManager.getCurrentRoom() || "",
                        userId: this.userId
                    });
                    break;
                case 'kick-player':
                    if (gameData.targetPlayerId === this.userId) {
                        alert('You have been kicked from the lobby');
                        this.roomController.leaveRoom();
                    }
                    break;
                //
                // [ Chat ]
                //
                case 'chat-message':
                    if (message.userId !== this.userId) {
                        this.chatManager.displayChatMessage({
                            senderId: message.userId,
                            message: gameData.message,
                            isOwn: false
                        });
                    }
                    break;
                //
                // [ Player ]
                //
                case "player-state": {
                    const playerData = gameData.data;
                    if (!playerData || !playerData.id) return;

                    this.playerState.players.set(playerData.id, playerData);

                    this.ui.createLeaderboard(this.lobbyManager, this.playerState.players, this.userId);
                    console.log('State update for player', message.userId, ':', gameData);
                    break;
                }
                case 'partial-state': {
                    if (message.userId === this.userId) return;

                    const player = this.playerState.players.get(message.userId);
                    if (!player) break;

                    this.utility.deepMerge(player, gameData);
                    console.log('Partial State update for player', message.userId, ':', gameData);
                    break;
                }
                case 'player-move':
                    if (!this.lobbyManager.inLobby && this.playerState.players.has(message.userId)) {
                        const player = this.playerState.players.get(message.userId);
                        if (!player) break;

                        if (gameData.transform.pos) {
                            player.transform.pos.x = gameData.transform.pos.x;
                            player.transform.pos.y = gameData.transform.pos.y;
                        }

                        if (gameData.transform.rot !== undefined) {
                            player.transform.rot = gameData.transform.rot;
                        }
                    }
                    break;
                case 'player-hit':
                    if (gameData.projectileId) { // Remove the projectile for everyone
                        this.combatController.projectiles.delete(gameData.projectileId);
                    }

                    if (gameData.targetId === this.userId) { // I got hit
                        this.playerState.myPlayer.stats.health.value = gameData.newHealth;

                        this.ui.updateSlider('health');

                        if (this.playerState.myPlayer.stats.health.value <= 0) {
                            this.playerController.playerDeath();
                        }
                    } else if (this.playerState.players.has(gameData.targetId)) { // Another player got hit
                        const hitPlayer = this.playerState.players.get(gameData.targetId);
                        if (!hitPlayer) break;

                        hitPlayer.stats.health.value = gameData.newHealth;

                        if (hitPlayer.stats.health.value <= 0) {
                            console.log(`Player ${hitPlayer.id} died`);
                        }
                    }

                    if (gameData.wasKill) {
                        const shooter = this.ui.leaderboard.get(gameData.shooterId);
                        if (shooter) {
                            shooter.kills++;
                        }

                        const target = this.ui.leaderboard.get(gameData.targetId);
                        if (target) {
                            target.deaths++;
                        }

                        this.ui.updateLeaderboardDisplay(this.userId);
                    }
                    break;
                case 'player-death':
                    if (message.userId !== this.userId && gameData.ammoBox) { // Spawn ammo
                        this.objectsManager.ammoBoxes.set(gameData.ammoBox.id, gameData.ammoBox);
                        console.log(`Ammo box spawned at death of ${message.userId}`);
                    }

                    const gore: DeathDecal = {
                        gore: {
                            amount: this.utility.getRandomInt(2, 5)
                        },
                        blood: {
                            amount: this.utility.getRandomInt(1, 3)
                        },
                        ownerId: message.userId,
                        pos: {
                            x: gameData.x,
                            y: gameData.y
                        },
                        radius: gameData.size
                    }
                    this.decalsManager.generateGore(gore); // Spawn gore

                    console.log(`Generated gore for ${message.userId}`);
                    break;
                case 'ammo-pickup':
                    if (gameData.playerId === this.userId) break;

                    if (this.objectsManager.ammoBoxes.has(gameData.ammoBoxId)) {
                        const box = this.objectsManager.ammoBoxes.get(gameData.ammoBoxId);
                        if (!box) break;

                        // Update box state
                        box.isOpen = gameData.boxState.isOpen;
                        box.lid = gameData.boxState.lid;

                        console.log(`Ammo box opened by ${gameData.playerId}`);
                    }
                    break;
                case 'weapon-change':
                    if (message.userId !== this.userId && this.playerState.players.has(message.userId)) {
                        const player = this.playerState.players.get(message.userId);
                        if (!player) break;

                        player.rig.weapon = gameData.weapon;
                        console.log(`${message.userId} switched to ${gameData.weapon}`);
                    }
                    break;
                //
                //
                // [ Projectile ]
                //
                case 'projectile-launch':
                    if (!this.lobbyManager.inLobby && message.userId !== this.userId) {
                        this.combatController.projectiles.set(gameData.projectile.id, gameData.projectile);
                    }
                    break;
                case 'projectile-remove':
                    if (!this.lobbyManager.inLobby) {
                        this.combatController.projectiles.delete(gameData.projectileId);
                    }
                    break;
                case 'projectile-update': // Used for deflections or any projectile mid trajectory updates
                    if (!this.lobbyManager.inLobby && this.combatController.projectiles.has(gameData.projectileId)) {
                        const projectile = this.combatController.projectiles.get(gameData.projectileId);
                        if (!projectile) break;

                        // Update projectile properties
                        projectile.ownerId = gameData.newOwnerId;
                        projectile.velocity = gameData.velocity;
                        projectile.color = gameData.color;
                        projectile.transform.rot = Math.atan2(projectile.velocity.y, projectile.velocity.x);

                        console.log(`Projectile ${gameData.projectileId} data updated by ${gameData.newOwnerId}`);
                    }
                    break;
                //
                //
                // [ Game ]
                //
                case 'start-game':
                    if (gameData.spawnMap && gameData.spawnMap[this.userId]) {
                        this.playerState.myPlayer.transform.pos.x = gameData.spawnMap[this.userId].x;
                        this.playerState.myPlayer.transform.pos.y = gameData.spawnMap[this.userId].y;
                        console.log("My Player Spawn:", gameData.spawnMap[this.userId].x, gameData.spawnMap[this.userId].y)
                    }
                    // For other players
                    if (gameData.spawnMap) {
                        this.playerState.players.forEach((player: Player, id: string) => {
                            if (gameData.spawnMap[id]) {
                                player.transform.pos.x = gameData.spawnMap[id].x;
                                player.transform.pos.y = gameData.spawnMap[id].y;
                                console.log(`Player ${id} spawn:`, gameData.spawnMap[id].x, gameData.spawnMap[id].y)
                            }
                        });
                    }

                    if (gameData.worldData) {
                        await this.world.generateWorld(gameData.worldData);
                    }

                    this.showGameControls(this.roomManager.getCurrentRoom() || '');
                    this.startGameLoop();
                    break;
                case 'game-end':
                    console.log(`Game ended! Winner: ${gameData.winnerId}`);
                    this.gameWinner = gameData.winnerId;
                    break;
                //
                //
                // [ Round ]
                //
                case 'round-end':
                    console.log(`Round ended! Winner: ${gameData.winnerId || 'No one'}`);
                    this.endRound(gameData.winnerId);
                    break;
                case 'new-round':
                    if (!gameData.spawnMap) return;
                    console.log(gameData.spawnMap);

                    // Hide upgrade UI
                    if (this.ui.upgradeContainer) {
                        this.ui.upgradeContainer.style.display = 'none';
                    }

                    console.log('New round started! Everyone respawning...');
                    this.isRoundInProgress = true;
                    this.roundWinner = null;

                    this.playerState.myPlayer.stats.health.value = this.playerState.myPlayer.stats.health.max;

                    this.ui.updateSlider('health');
                    this.ui.updateSlider('stamina');

                    this.playerState.myPlayer.transform.pos.x = gameData.spawnMap[this.userId].x;
                    this.playerState.myPlayer.transform.pos.y = gameData.spawnMap[this.userId].y;

                    this.resumeGame(); // Unpause locally

                    // Receive all player's spawn locations and reset their health
                    this.playerState.players.forEach((player: Player, playerId: string) => { // Respawn other players
                        if (gameData.spawnMap[playerId]) {
                            player.transform.pos.x = gameData.spawnMap[player.id].x;
                            player.transform.pos.y = gameData.spawnMap[player.id].y;
                            player.transform.rot = 0;

                            // Reset vitals for good measure lol
                            player.stats.health.value = player.stats.health.max;
                            player.stats.stamina.value = player.stats.stamina.max;
                        }
                    });
                    break;
                case 'upgrade-taken': // Someone else took an upgrade
                    if (gameData.upgradeId && gameData.isUnique) { // That upgrade is unique - remove it from my local uniques pool
                        this.upgradeManager.removeUpgradeFromPool(gameData.upgradeId);
                        console.log(`Unique upgrade ${gameData.upgradeId} taken by ${message.userId}`);
                    }

                    if (this.roundWinner === this.userId) { // I am the round winner - how many players have taken upgrades?
                        this.upgradeManager.upgradesCompleted.add(message.userId);
                        console.log(`${message.userId} completed upgrade. ${this.upgradeManager.upgradesCompleted.size}/${this.playerState.players.size} done`);

                        // Check if all losers are done
                        if (this.upgradeManager.upgradesCompleted.size >= this.playerState.players.size) {
                            this.showWinnerContinueButton();
                        }
                    }
                    break;
                //
                //
                // [ Audio ]
                //
                case 'play-audio':
                    if (message.userId !== this.userId) {
                        this.audioManager.playAudio(gameData.params);
                    }
                    break;
                //
                //
                // [ Visual ]
                //
                case 'add-decal':
                    if (message.userId !== this.userId) {
                        this.decalsManager.createDecalNetwork(gameData.params);
                    }
                    break;
                case 'add-particles':
                    if (message.userId !== this.userId) {
                        this.particlesManager.createParticlesNetwork(gameData.params);
                    }
                    break;
                case 'particle-emitter':
                    if (message.userId !== this.userId) {
                        const emission: EmitterParams = {
                            id: gameData.id,
                            interval: gameData.interval,
                            lifetime: gameData.lifetime,
                            offset: {
                                x: gameData.offset.x,
                                y: gameData.offset.y
                            },
                            particleType: gameData.particleType,
                            playerId: gameData.playerId,
                            pos: {
                                x: gameData.pos.x,
                                y: gameData.pos.y
                            }
                        }
                        this.particlesManager.generateEmitter(emission);
                    }
                    break;
                case 'character-animation':
                    if (gameData.params.playerId !== this.userId) {
                        this.animator.animateCharacterPartNetwork(gameData.params);
                    }
                    break;
                case 'shrapnel-spawn':
                    if (message.userId !== this.userId) {
                        this.particlesManager.generateShrapnel(gameData.pieces);
                    }
                    break;
                //
                //
                // [ World ]
                //
                case 'chunk-update':
                    if (message.userId !== this.userId) {
                        this.world.worldEdit.createChunkPatchNetwork(gameData.chunk);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error parsing game message:', error);
        }
    }

    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Lobby ]
    //
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

        this.lobbyManager.showLobbyControls({
            lobby: this.lobbyManager,
            lobbyOptions: {
                maxPlayers: this.gameState.gameMaxPlayers,
                maxWins: this.gameState.gameMaxWins,
                isHost: this.playerState.isHost,
                privateRoom: this.roomManager.isPrivateRoom,
                upgradesEnabled: this.upgradeManager.isUpgradesEnabled
            },
            myPlayer: this.playerState.myPlayer,
            roomId: this.roomManager.getCurrentRoom() || "",
            userId: this.userId
        });
    }

    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Round ]
    //
    /**
     * Processes end of round logic.
     */
    private endRound(winnerId: string | null): void {
        if (!this.isRoundInProgress) {
            console.log('Ignoring endRound - round already ended');
            return;
        }

        console.log(`Server confirmed round end. Winner: ${winnerId || 'No one'}`);

        this.isRoundInProgress = false;
        this.roundWinner = winnerId;

        if (!winnerId) { // Everyone died somehow
            console.log('Round ended with no survivors!');
            if (this.playerState.isHost) {
                this.utility.safeTimeout(() => {
                    this.startNewRound();
                }, GAME.ROUND_END_DELAY);
            }
            return;
        }

        // Increment win for the winner
        if (winnerId && this.ui.leaderboard.has(winnerId)) {
            const winnerEntry = this.ui.leaderboard.get(winnerId);
            if (!winnerEntry) return;

            winnerEntry.wins++;
            console.log(`${winnerId} won the round! Total wins: ${winnerEntry.wins}`);

            // Check if they've won the game - use dynamic max wins
            if (winnerEntry.wins >= this.gameState.gameMaxWins) {
                this.endGame(winnerId); // TODO: Maybe don't rely on leaderboard data to end the game but actual player data stored for the round
                return; // Don't start a new round
            }

            // Update display to show new win count
            this.ui.updateLeaderboardDisplay(this.userId);
        }

        this.utility.safeTimeout(() => {
            this.pauseGame(); // Everybody pause locally
        }, GAME.ROUND_END_DELAY / 6);

        // We have a winner, start the upgrade phase after a delay
        this.utility.safeTimeout(() => {
            this.startUpgradePhase(winnerId);
        }, GAME.ROUND_END_DELAY);
    }

    /**
     * Processes end of game logic.
     */
    private endGame(winnerId: string): void {
        this.gameWinner = winnerId;
        console.log(`${winnerId} won the game with ${this.gameState.gameMaxWins} wins!`);

        // Send game end message
        this.roomManager.sendMessage(JSON.stringify({
            type: 'game-end',
            winnerId: winnerId
        }));

        // Return to lobby after delay
        this.utility.safeTimeout(() => {
            this.returnToLobby();
        }, GAME.GAME_END_DELAY);
    }

    /**
     * Starts a new round, keeping track of full player states.
     */
    private startNewRound(): void {
        console.log('Starting new round...');

        // Send the spawn map to all other players
        this.roomManager.sendMessage(JSON.stringify({
            type: 'new-round',
            reservedSpawn: {
                x: Math.random() * (WORLD.WIDTH - WORLD.BORDER_MARGIN * 2) + WORLD.BORDER_MARGIN,
                y: Math.random() * (WORLD.HEIGHT - WORLD.BORDER_MARGIN * 2) + WORLD.BORDER_MARGIN
            }
        }));
    }

    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Game ]
    //
    /**
     * Update the display with the game canvas via updateDisplay.
     */
    private showGameControls(roomId: string): void {
        this.ui.updateDisplay(this.lobbyManager, "game", roomId);
    }

    /**
     * Called by the host when the start button is pressed in the lobby.
     * 
     * Starts game loop via executeStartGame or displays a warning before continuing if solo.
     */
    private startGame(): void {
        if (!this.playerState.isHost) return;

        // Check if solo and show warning if needed
        if (this.lobbyManager.lobbyPlayers.size === 1) {
            this.ui.soloGameWarning(() => this.executeStartGame());
            return; // Don't continue, let the modal handle it
        }

        // If not solo, proceed normally
        this.executeStartGame();
    }

    /**
     * Executes the beginning of a game and broadcasts the start to all lobbyplayers.
     */
    private async executeStartGame(): Promise<void> {
        const worldData = await this.world.showGenerationMenu(); // Show the worldgen menu for the host, and use params for all clients

        // Send start game message to other players
        this.roomManager.sendMessage(JSON.stringify({
            type: 'start-game',
            reservedSpawn: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            },
            worldData: worldData
        }));

        if (worldData !== "load") { // Generate a new world if a saved world is not loaded
            await this.world.generateWorld(worldData);
        }

        // Also start the game for the host
        this.showGameControls(this.roomManager.getCurrentRoom() || '');
        this.startGameLoop();
    }

    /**
     * Kicks of the game loop and initializes values to clean slate.
     */
    private startGameLoop(): void {
        this.gameState.gameInProgress = true;
        this.isRoundInProgress = true;

        this.playerState.myPlayer.actions.primary.magazine.currentReserve = Math.floor(this.playerConfig.default.actions.primary.magazine.maxReserve / 2);
        this.playerState.myPlayer.actions.primary.magazine.currentAmmo = this.playerState.myPlayer.actions.primary.magazine.size;
        this.ui.ammoReservesUIController.spawnAmmoInReserveUI(this.playerState.myPlayer.actions.primary.magazine.currentReserve);
        this.playerState.isReloading = false;

        this.ui.createLeaderboard(this.lobbyManager, this.playerState.players, this.userId);

        this.upgradeManager.resetUpgrades(this.playerState.myPlayer);

        // Transfer rig from lobby to game player
        const myLobbyPlayer = this.lobbyManager.lobbyPlayers.get(this.userId);
        if (myLobbyPlayer) {
            console.log("Found lobby rig for my player: ", myLobbyPlayer.rig);

            this.playerState.myPlayer.rig.body = myLobbyPlayer.rig.body;
            this.playerState.myPlayer.rig.head = myLobbyPlayer.rig.head;
            this.playerState.myPlayer.rig.headwear = myLobbyPlayer.rig.headwear;
            this.playerState.myPlayer.rig.weapon = myLobbyPlayer.rig.weapon;
        }

        this.roomManager.sendMessage(JSON.stringify({
            type: "player-state",
            userId: this.userId,
            data: this.playerState.myPlayer
        }));


        this.gameLoop();

        this.ui.updateSlider('health');
        this.ui.updateSlider('stamina');
    }

    /**
     * Core game processing function.
     * 
     * Handles animation frame requests, update loops for all systems, and drawing functions.
     */
    private gameLoop(): void {
        if (
            !this.gameState.gameInProgress || !this.ui.ctx || !this.ui.canvas ||
            !this.ui.decalCtx || !this.ui.decalCanvas || !this.ui.postEffectsCtx
        ) return;

        if (this.gameState.isPaused) { // Continue the loop but skip all updates
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        const dt = this.utility.deltaTime();

        this.camera.update(dt);

        // Update
        this.playerController.updatePlayerPosition(dt);
        this.combatController.updateAttack(dt);
        this.combatController.updateProjectiles(dt);
        this.particlesManager.updateParticles(dt);
        this.particlesManager.updateEmitters(dt);
        this.particlesManager.updateShrapnel(dt);
        this.animator.updateCharacterAnimations(dt);
        this.staminaController.updateStamina(dt);
        this.dashController.updateDash(dt);

        this.collisionsManager.checkCollisions(dt);

        this.ui.updateSlider('stamina');

        // === RENDERING ===

        // Clear main canvas
        this.renderingManager.clearCtx(this.ui.ctx);

        this.world.drawWorld();

        this.world.worldDebug.drawDebug();
        this.world.updateAudioZones();

        this.ui.ctx.drawImage(
            this.ui.decalCanvas,
            this.camera.pos.x, this.camera.pos.y,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT,
            0, 0,
            VIEWPORT.WIDTH, VIEWPORT.HEIGHT
        );

        // Draw objects (with camera offset)
        this.renderingManager.drawObjects();

        // Draw projectiles (with camera offset)
        this.combatController.projectiles.forEach(projectile => {
            this.renderingManager.drawProjectile(projectile);
        });

        // Draw other players (with camera offset)
        this.playerState.players.forEach((player: Player) => {
            if (!this.ui.ctx) return;

            const charRenderParams: RenderCharacterParams = { player, context: this.ui.ctx };
            this.renderingManager.drawCharacter(charRenderParams);
        });

        // Draw my player (with camera offset)
        const myRenderParams: RenderCharacterParams = { player: this.playerState.myPlayer, context: this.ui.ctx };
        this.renderingManager.drawCharacter(myRenderParams);

        // Draw particles and shrapnel (with camera offset)
        this.particlesManager.drawParticles();
        this.particlesManager.drawShrapnel();

        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Pauses the game when called.
     */
    public pauseGame(): void {
        if (!this.gameState.gameInProgress) return;

        this.gameState.isPaused = true;
        console.log('Game paused');

        this.controlsManager.clearActiveKeys();
        this.playerState.isSprinting = false;
        this.playerState.isDashing = false;
        this.playerState.isBurstActive = false;
        this.playerState.currentBurstShot = 0;
    }

    /**
     * Resumes the game when called.
     */
    public resumeGame(): void {
        if (!this.gameState.gameInProgress) return;

        this.gameState.isPaused = false;
        console.log('Game resumed');
    }

    /**
     * Resets the game state to default.
     */
    private resetGameState(resetType: ResetType): void {
        this.clear();

        this.gameState.clear();

        if (resetType === 'Room') {
            this.lobbyManager.inLobby = false;
            this.playerState.isHost = false;
        }

        this.combatController.projectiles.clear();

        this.decalsManager.clear();
        this.objectsManager.clear();
        this.particlesManager.clear();

        if (resetType === 'Room') {
            this.lobbyManager.lobbyPlayers.clear();
        }

        this.renderingManager.clearCtx();
        this.ui.clear();

        this.chatManager.clear();

        this.playerState.clear();
        this.playerState.initPlayer(this.userId);

        this.controlsManager.clear();
        this.animator.clear();

        this.utility.clearTimeoutCache();

        this.world.clear();

        // Reset upgrades and equipment
        this.upgradeManager.resetUpgrades(this.playerState.myPlayer);
        this.upgradeManager.upgradesCompleted.clear();
    }
    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Actions / Inputs ]
    //
    /**
     * Provides polling for inputs and keybinds - checking for any actions assigned.
     */
    private watchForInputs(): void {
        const poll = () => {
            if (this.controlsManager.gamepadConnectionEnabled) {
                this.controlsManager.pollGamepad();
            }
            this.checkActions();
            requestAnimationFrame(poll);
        };
        poll();
    }

    /**
     * Checks for keybinds and input actions during polling.
     */
    public checkActions(): void {
        // TODO: MAYBE add menu navigation with keyboard/gamepad here

        if (!this.gameState.gameInProgress || this.gameState.isPaused) return;

        const keybinds = this.settingsManager.getSettings().controls.keybinds;

        if (this.controlsManager.triggered(keybinds.dash)) {
            this.dashController.startDash();
        }

        if (this.controlsManager.triggered(keybinds.melee)) {
            if (this.combatController.canMelee()) {
                this.combatController.triggerAttack('melee');
            }
        }

        if (this.controlsManager.triggered(keybinds.reload)) {
            this.combatController.startReload();
        }

        if (this.controlsManager.held(keybinds.sprint)) {
            if (this.moveController.isMoveInput()) {
                this.playerState.isSprinting = true;
            }
        } else {
            this.playerState.isSprinting = false;
        }

        if (this.controlsManager.triggered(keybinds.attack)) {
            if (this.playerState.canShoot && !this.playerState.isBurstActive && !this.playerState.isMelee) {
                this.combatController.triggerAttack('ranged');
            }
        }

        if (this.controlsManager.held(keybinds.attack) && this.playerState.canAutoFire) {
            this.combatController.triggerAttack('ranged');
        }

        const gamepadRAxis = this.controlsManager.getGamepadRAxis();
        if (gamepadRAxis !== null) {
            this.animator.rotateCharacterPart(this.userId, gamepadRAxis);
        }

        this.controlsManager.updatePreviousKeys();
    }
    //
    // #endregion
    //
    //
    //
    //
    //
    //
    // #region [ Upgrades ]
    //
    /**
     * Start the upgrade phase by showing the relative UI for winners/losers.
     */
    private startUpgradePhase(winnerId: string | null): void {
        console.log('Starting upgrade phase...');

        this.upgradeManager.upgradesCompleted.clear(); // Reset upgrade tracking

        const numUpgrades = 2; // TODO: This could change based on upgrades or other factors

        // Show upgrade UI based on if I won or lost
        if (winnerId === this.userId) {
            this.showWinnerWaitScreen();
        } else {
            this.showUpgradeSelection(numUpgrades);
        }
    }

    // [ Winner ]
    //
    /**
     * Show the winner waiting screen.
     * 
     * This screen will persist until all losers in the game finish picking upgrades.
     */
    private showWinnerWaitScreen(): void {
        if (!this.ui.upgradeContainer) return;

        this.ui.upgradeContainer.innerHTML = '';

        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'upgrade_waiting';
        waitingDiv.textContent = 'Waiting for other players...';

        this.ui.upgradeContainer.appendChild(waitingDiv);
        this.ui.upgradeContainer.style.display = 'flex';
    }

    /**
     * Update winner waiting screen to show the continue button, which will conclude the round-end upgrade process.
     */
    private showWinnerContinueButton(): void {
        if (!this.ui.upgradeContainer) return;
        this.ui.upgradeContainer.innerHTML = '';

        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'upgrade_waiting';
        waitingDiv.textContent = 'Upgrade phase complete.';

        const continueBtn = document.createElement('button');
        continueBtn.textContent = 'Continue';
        continueBtn.onclick = () => {
            if (!this.ui.upgradeContainer) return;
            console.log("Winner pressed continue...");

            this.ui.upgradeContainer.style.display = 'none';

            this.utility.safeTimeout(() => {
                this.startNewRound();
            }, GAME.NEW_ROUND_DELAY);
        };

        this.ui.upgradeContainer.appendChild(waitingDiv);
        this.ui.upgradeContainer.appendChild(continueBtn);
        this.ui.upgradeContainer.style.display = 'flex';
    }

    // [ Losers ]
    //
    /**
     * Displays the upgrade selection screen for losers during the upgrade phase.
     */
    private showUpgradeSelection(amount: number): void {
        if (!this.ui.upgradeContainer) return;

        this.ui.upgradeContainer.innerHTML = '';

        // Get 3 random upgrades
        const availableUpgrades = this.upgradeManager.getUpgrades(amount, this.playerState.myPlayer);

        availableUpgrades.forEach(upgrade => {
            const upgradeDiv = document.createElement('div');
            upgradeDiv.className = 'upgrade_card container';
            upgradeDiv.setAttribute('data-rarity', upgrade.rarity.toString());

            // Create image element
            const imageDiv = document.createElement('div');
            imageDiv.className = 'upgrade_image';

            const img = document.createElement('img');
            img.src = upgrade.icon;
            img.alt = upgrade.name;
            img.className = 'upgrade_icon';

            // Handle image load errors
            img.onerror = () => {
                console.warn(`Failed to load upgrade image: ${upgrade.icon}`);
                img.style.display = 'none';
            };

            imageDiv.appendChild(img);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'upgrade_name';
            nameDiv.textContent = upgrade.name;

            const subtitleDiv = document.createElement('div');
            subtitleDiv.className = 'upgrade_subtitle';
            subtitleDiv.textContent = upgrade.subtitle;

            upgradeDiv.appendChild(imageDiv);
            upgradeDiv.appendChild(nameDiv);
            upgradeDiv.appendChild(subtitleDiv);

            upgradeDiv.addEventListener('click', () => {
                console.log("Selected upgrade: ", upgrade.name);
                this.selectUpgrade(upgrade.id);
            });

            if (!this.ui.upgradeContainer) return;
            this.ui.upgradeContainer.appendChild(upgradeDiv);
        });

        this.ui.upgradeContainer.style.display = 'flex';
    }

    /**
     * Triggers on click when a loser selects an upgrade from their displayed options.
     * 
     * Processes selection upgrade and sends a network message to inform others of the action.
     */
    private selectUpgrade(upgradeId: string): void {
        const success = this.upgradeManager.applyUpgrade(upgradeId, this.playerState.myPlayer);
        if (!success) {
            console.error('Failed to apply upgrade'); // Maybe two people picked same one, (apply upgrade checks uniques)
            return;
        }

        this.finishUpgrade(upgradeId);
    }

    /**
     * Closes upgrade loop for loser once they have selected an upgrade.
     */
    private finishUpgrade(selectedUpgradeId: string): void {
        if (this.ui.upgradeContainer) { // Hide upgrade UI
            this.ui.upgradeContainer.style.display = 'none';
        }

        this.roomManager.sendMessage(JSON.stringify({
            type: 'upgrade-taken',
            upgradeId: selectedUpgradeId,
            userId: this.userId,
            isUnique: this.upgradeManager.upgrades.find(u => u.id === selectedUpgradeId)?.unique || false
        }));

        this.roomManager.sendMessage(JSON.stringify({
            type: "player-state",
            userId: this.userId,
            data: this.playerState.myPlayer
        }));

        console.log('Upgrade selected, waiting for others...');
    }
    //
    // #endregion
}

// Initialize the game client
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new Client();
    });
} else {
    new Client();
}