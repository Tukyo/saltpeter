
import { Player, RoomMessage, Projectile, LobbyPlayer, LeaderboardEntry, AmmoBox, ResetType, GameObject, SpawnObjectParams, SetSliderParams, SetSpanParams } from './defs';
import { PLAYER_DEFAULTS, CANVAS, GAME, UI, AMMO_BOX, NETWORK, SFX, AUDIO, OBJECT_DEFAULTS } from './config';
import { CharacterLayer, getCharacterAsset } from './char';

import { Animator } from './Animator';
import { AudioManager } from './AudioManager';
import { ControlsManager } from './ControlsManager';
import { CollisionsManager } from './CollisionsManager';
import { DecalsManager } from './DecalsManager';
import { LobbyManager } from './LobbyManager';
import { EventsManager } from './EventsManager';
import { ParticlesManager } from './ParticlesManager';
import { PlayerState } from './PlayerState';
import { RoomController } from './RoomController';
import { RoomManager } from './RoomManager';
import { SettingsManager } from './SettingsManager';
import { UpgradeManager } from './UpgradeManager';
import { UserInterface } from './UserInterface';
import { Utility } from './Utility';
import { GameState } from './GameState';
import { ChatManager } from './ChatManager';
import { WebsocketManager } from './WebsocketManager';

import { DashController } from './player/DashController';
import { MoveController } from './player/MoveController';
import { StaminaController } from './player/StaminaController';
import { CombatController } from './player/CombatController';
import { AmmoReservesUIController } from './player/AmmoReservesUIController';
import { LuckController } from './player/LuckController';
import { ObjectsManager } from './ObjectsManager';
import { RenderingManager } from './RenderingManager';

class Client {
    private userId: string;

    private isRoundInProgress = false;

    private roundWinner: string | null = null;
    private gameWinner: string | null = null; // TODO: Use the game winner to display lobby historical wins

    private ammoReservesUIController: AmmoReservesUIController;
    private animator: Animator;
    private audioManager: AudioManager;
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

    // #region [ Initialization ]
    //
    constructor() {
        this.settingsManager = new SettingsManager();
        this.utility = new Utility();
        this.ui = new UserInterface();
        this.upgradeManager = new UpgradeManager();
        this.controlsManager = new ControlsManager();
        this.gameState = new GameState();
        this.objectsManager = new ObjectsManager();
        this.renderingManager = new RenderingManager();

        this.userId = this.utility.generateUID(PLAYER_DEFAULTS.DATA.ID_LENGTH);

        this.playerState = new PlayerState(this.userId, this.utility);

        this.settingsManager.initSettings();

        this.roomManager = new RoomManager(this.userId, this.utility);
        this.lobbyManager = new LobbyManager(this.utility, this.ui, this.roomManager);
        this.wsManager = new WebsocketManager(this.gameState, this.roomManager);

        this.roomController = new RoomController(
            this.gameState,
            this.lobbyManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.upgradeManager,
            this.userId,
            this.wsManager
        );

        this.chatManager = new ChatManager(this.roomManager, this.ui);

        this.ammoReservesUIController = new AmmoReservesUIController(this.ui);

        this.collisionsManager = new CollisionsManager(
            this.ammoReservesUIController,
            this.objectsManager,
            this.playerState,
            this.roomManager,
            this.userId
        );

        this.moveController = new MoveController(this.controlsManager, this.settingsManager);
        this.staminaController = new StaminaController(this.playerState);
        this.dashController = new DashController(this.moveController, this.playerState, this.roomManager, this.staminaController);
        this.luckController = new LuckController(this.playerState);

        this.decalsManager = new DecalsManager(
            this.roomManager,
            this.ui,
            this.utility
        );

        this.particlesManager = new ParticlesManager(
            this.decalsManager,
            this.playerState,
            this.renderingManager,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility
        );

        this.audioManager = new AudioManager(this.roomManager, this.settingsManager);
        this.animator = new Animator(this.playerState, this.roomManager, this.userId);

        this.combatController = new CombatController(
            this.ammoReservesUIController,
            this.animator,
            this.audioManager,
            this.collisionsManager,
            this.controlsManager,
            this.decalsManager,
            this.gameState,
            this.luckController,
            this.particlesManager,
            this.playerState,
            this.roomManager,
            this.ui,
            this.userId,
            this.utility
        );

        this.eventsManager = new EventsManager(
            this.animator,
            this.chatManager,
            this.combatController,
            this.controlsManager,
            this.dashController,
            this.gameState,
            this.lobbyManager,
            this.moveController,
            this.roomController,
            this.roomManager,
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
    }

    private initClient(): void {
        this.ui.initInterface();
        this.eventsManager.initEventListeners();
        this.initGlobalEvents();

        this.roomController.checkForRoomInURL();

        this.ammoReservesUIController.initAmmoReserveCanvas();
        this.roomController.showRoomControls();

        const spanParams: SetSpanParams = {
            spanId: 'userId',
            value: this.userId
        }
        this.utility.setSpan(spanParams);

        if (AUDIO.SETTINGS.PRELOAD_SOUNDS) {
            this.audioManager.preloadAudioAssets(SFX, '.ogg');
        }
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

        window.addEventListener("customEvent_checkRoundEnd", () => this.checkRoundEnd());

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
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
                this.playerState.isHost = false;
                this.lobbyManager.showLobbyControls(
                    this.gameState.gameMaxPlayers,
                    this.gameState.gameMaxWins,
                    this.playerState.isHost,
                    this.roomManager.isPrivateRoom,
                    this.upgradeManager.isUpgradesEnabled,
                    this.lobbyManager,
                    this.playerState.myPlayer,
                    this.roomManager.getCurrentRoom() || '',
                    this.userId
                );

                // Send my lobby info
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'lobby-join',
                    color: this.playerState.myPlayer.color
                }));

                // Add myself to lobby
                this.lobbyManager.lobbyPlayers.set(this.userId, {
                    id: this.userId,
                    color: this.playerState.myPlayer.color,
                    isHost: this.playerState.isHost
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

    private handleGameMessage(message: RoomMessage): void {
        if (!message.message) return;

        try {
            const gameData = JSON.parse(message.message);

            switch (gameData.type) {
                //
                // #region [ Lobby ]
                //
                case 'lobby-join':
                    this.lobbyManager.lobbyPlayers.set(message.userId, {
                        id: message.userId,
                        color: gameData.color,
                        isHost: false
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
                    this.lobbyManager.showLobbyControls(
                        this.gameState.gameMaxPlayers,
                        this.gameState.gameMaxWins,
                        this.playerState.isHost,
                        this.roomManager.isPrivateRoom,
                        this.upgradeManager.isUpgradesEnabled,
                        this.lobbyManager,
                        this.playerState.myPlayer,
                        this.roomManager.getCurrentRoom() || '',
                        this.userId
                    );
                    break;
                case 'kick-player':
                    if (gameData.targetPlayerId === this.userId) {
                        alert('You have been kicked from the lobby');
                        this.roomController.leaveRoom();
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Chat ]
                //
                case 'chat-message':
                    if (message.userId !== this.userId) {
                        this.chatManager.displayChatMessage(message.userId, gameData.message, false);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Player ]
                //
                // [ IMPORTANT ] Keep full track of Player object here
                case 'player-state':
                    console.log('Player State for player', gameData.id, ':', gameData);

                    if (!this.lobbyManager.inLobby) {
                        this.playerState.players.set(message.userId, {
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
                                melee: {
                                    cooldown: gameData.actions?.melee.cooldown || PLAYER_DEFAULTS.ACTIONS.MELEE.COOLDOWN,
                                    damage: gameData.actions?.melee.damage || PLAYER_DEFAULTS.ACTIONS.MELEE.DAMAGE,
                                    duration: gameData.actions?.melee.duration || PLAYER_DEFAULTS.ACTIONS.MELEE.DURATION,
                                    range: gameData.actions?.melee.range || PLAYER_DEFAULTS.ACTIONS.MELEE.RANGE,
                                    size: gameData.actions?.melee.size || PLAYER_DEFAULTS.ACTIONS.MELEE.SIZE
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
                                        spread: gameData.actions?.primary.projectile.spread || PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPREAD
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
                            equipment: gameData.equipment || PLAYER_DEFAULTS.EQUIPMENT,
                            physics: {
                                acceleration: gameData.physics?.acceleration || PLAYER_DEFAULTS.PHYSICS.ACCELERATION,
                                friction: gameData.physics?.friction || PLAYER_DEFAULTS.PHYSICS.FRICTION
                            },
                            rig: {
                                body: gameData.rig?.body || PLAYER_DEFAULTS.RIG.BODY,
                                head: gameData.rig?.head || PLAYER_DEFAULTS.RIG.HEAD,
                                headwear: gameData.rig?.headwear || PLAYER_DEFAULTS.RIG.HEADWEAR,
                                weapon: gameData.rig?.weapon || PLAYER_DEFAULTS.RIG.WEAPON
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
                            },
                            unique: gameData.unique || PLAYER_DEFAULTS.UNIQUE
                        });
                    }

                    if (gameData.leaderboard) {
                        gameData.leaderboard.forEach(([playerId, entry]: [string, LeaderboardEntry]) => {
                            this.ui.leaderboard.set(playerId, entry);
                        });
                    }

                    this.ui.createLeaderboard(this.lobbyManager, this.playerState.players, this.userId);
                    break;
                case 'player-move':
                    if (!this.lobbyManager.inLobby && this.playerState.players.has(message.userId)) {
                        const player = this.playerState.players.get(message.userId)!;

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

                    if (gameData.targetId === this.userId) {
                        this.playerState.myPlayer.stats.health.value = gameData.newHealth;

                        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
                        const healthSliderParams: SetSliderParams = {
                            sliderId: 'healthBar',
                            targetValue: this.playerState.myPlayer.stats.health.value,
                            maxValue: this.playerState.myPlayer.stats.health.max,
                            lerpTime: sliderLerpTime
                        }
                        this.utility.setSlider(healthSliderParams);

                        if (this.playerState.myPlayer.stats.health.value <= 0) {
                            this.recordDeath();
                            this.checkRoundEnd();
                        }
                    } else if (this.playerState.players.has(gameData.targetId)) {
                        const hitPlayer = this.playerState.players.get(gameData.targetId)!;
                        hitPlayer.stats.health.value = gameData.newHealth;

                        if (hitPlayer.stats.health.value <= 0) {
                            console.log(`Player ${hitPlayer.id} died`);
                            this.checkRoundEnd();
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

                    this.particlesManager.generateGore(message.userId, gameData.x, gameData.y, gameData.size); // Spawn gore
                    console.log(`Generated gore for ${message.userId}`);
                    break;
                case 'ammo-pickup':
                    if (gameData.playerId === this.userId) break;

                    if (this.objectsManager.ammoBoxes.has(gameData.ammoBoxId)) {
                        const box = this.objectsManager.ammoBoxes.get(gameData.ammoBoxId)!;

                        // Update box state
                        box.isOpen = gameData.boxState.isOpen;
                        box.lid = gameData.boxState.lid;

                        console.log(`Ammo box opened by ${gameData.playerId}`);
                    }
                    break;
                case 'weapon-change':
                    if (message.userId !== this.userId && this.playerState.players.has(message.userId)) {
                        const player = this.playerState.players.get(message.userId)!;
                        player.rig.weapon = gameData.weapon;
                        console.log(`${message.userId} switched to ${gameData.weapon}`);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Projectile ]
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
                //
                // #endregion
                //
                // #region [ Game ]
                //
                case 'start-game':
                    if (gameData.spawnMap && gameData.spawnMap[this.userId]) {
                        this.playerState.myPlayer.transform.pos.x = gameData.spawnMap[this.userId].x;
                        this.playerState.myPlayer.transform.pos.y = gameData.spawnMap[this.userId].y;
                        console.log("My Player Spawn:", gameData.spawnMap[this.userId].x, gameData.spawnMap[this.userId].y)
                    }
                    // For other players
                    if (gameData.spawnMap) {
                        this.playerState.players.forEach((player, id) => {
                            if (gameData.spawnMap[id]) {
                                player.transform.pos.x = gameData.spawnMap[id].x;
                                player.transform.pos.y = gameData.spawnMap[id].y;
                                console.log(`Player ${id} spawn:`, gameData.spawnMap[id].x, gameData.spawnMap[id].y)
                            }
                        });
                    }

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

                    const sliderLerpTime = 300; //TODO: Define UI lerping times globally
                    const healthSliderParams: SetSliderParams = {
                        sliderId: 'healthBar',
                        targetValue: this.playerState.myPlayer.stats.health.value,
                        maxValue: this.playerState.myPlayer.stats.health.max,
                        lerpTime: sliderLerpTime
                    }

                    const staminaSliderParams: SetSliderParams = {
                        sliderId: 'staminaBar',
                        targetValue: this.playerState.myPlayer.stats.stamina.value,
                        maxValue: this.playerState.myPlayer.stats.stamina.max,
                        lerpTime: sliderLerpTime
                    }

                    this.utility.setSlider(healthSliderParams);
                    this.utility.setSlider(staminaSliderParams);

                    this.playerState.myPlayer.transform.pos.x = gameData.spawnMap[this.userId].x;
                    this.playerState.myPlayer.transform.pos.y = gameData.spawnMap[this.userId].y;

                    this.resumeGame(); // Unpause locally

                    // Receive all player's spawn locations and reset their health
                    this.playerState.players.forEach((player, playerId) => { // Respawn other players
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
                // #endregion
                //
                // #region [ Audio ]
                //
                case 'play-audio':
                    if (message.userId !== this.userId) {
                        this.audioManager.playAudio(gameData.params);
                    }
                    break;
                //
                // #endregion
                //
                // #region [ Visual ]
                //
                case 'add-decal':
                    if (message.userId !== this.userId) {
                        this.decalsManager.createDecalNetwork(gameData.x, gameData.y, gameData.decalId, gameData.params);
                    }
                    break;
                case 'add-particles':
                    if (message.userId !== this.userId) {
                        this.particlesManager.generateParticles(
                            gameData.x,
                            gameData.y,
                            gameData.particleId,
                            gameData.params,
                            gameData.direction
                        );
                    }
                    break;
                case 'particle-emitter':
                    if (message.userId !== this.userId) {
                        this.particlesManager.emitters.set(gameData.emitterId, {
                            age: 0,
                            direction: gameData.direction || 0,
                            emissionInterval: 200 + Math.random() * 300,
                            lastEmission: 0,
                            lifetime: gameData.lifetime,
                            offset: {
                                x: gameData.offsetX,
                                y: gameData.offsetY
                            },
                            playerId: gameData.playerId,
                        });
                    }
                    break;
                case 'character-animation':
                    if (gameData.params.playerId !== this.userId) {
                        this.animator.animateCharacterPartNetwork(gameData.params);
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

    // #region [ Lobby Management ]
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

        this.lobbyManager.showLobbyControls(
            this.gameState.gameMaxPlayers,
            this.gameState.gameMaxWins,
            this.playerState.isHost,
            this.roomManager.isPrivateRoom,
            this.upgradeManager.isUpgradesEnabled,
            this.lobbyManager,
            this.playerState.myPlayer,
            this.roomManager.getCurrentRoom() || '',
            this.userId
        );
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
        let aliveCount = this.playerState.myPlayer.stats.health.value > 0 ? 1 : 0;
        let lastAlivePlayer = this.playerState.myPlayer.stats.health.value > 0 ? this.userId : null;

        this.playerState.players.forEach((player) => {
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
                this.startNewRound(); //TODO Might need to adjust this because normally only the winner calls this
            }, GAME.ROUND_END_DELAY);
            return;
        }

        // Increment win for the winner
        if (this.ui.leaderboard.has(winnerId)) {
            const winnerEntry = this.ui.leaderboard.get(winnerId)!;
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

        setTimeout(() => {
            this.pauseGame(); // Everybody pause locally
        }, GAME.ROUND_END_DELAY / 6);

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
        console.log(`${winnerId} won the game with ${this.gameState.gameMaxWins} wins!`);

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

        this.resumeGame(); // Unpause myself locally

        this.isRoundInProgress = true;
        this.roundWinner = null;

        // Reset myself
        this.playerState.myPlayer.stats.health.value = this.playerState.myPlayer.stats.health.max;

        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
        const healthSliderParams: SetSliderParams = {
            sliderId: 'healthBar',
            targetValue: this.playerState.myPlayer.stats.health.value,
            maxValue: this.playerState.myPlayer.stats.health.max,
            lerpTime: sliderLerpTime
        }

        const staminaSliderParams: SetSliderParams = {
            sliderId: 'staminaBar',
            targetValue: this.playerState.myPlayer.stats.stamina.value,
            maxValue: this.playerState.myPlayer.stats.stamina.max,
            lerpTime: sliderLerpTime
        }

        this.utility.setSlider(healthSliderParams);
        this.utility.setSlider(staminaSliderParams);

        // Generate a random position for the winner, and reserve in the new-round message
        this.playerState.myPlayer.transform.pos.x = Math.random() * (CANVAS.WIDTH - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN;
        this.playerState.myPlayer.transform.pos.y = Math.random() * (CANVAS.HEIGHT - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN;

        const spawnDistance = 120; // How far away each player must spawn from each other (px)
        const spawnMap = this.getSpawnMap(spawnDistance);

        // Locally update all other players for the winner, their state should already be updated after taking upgrades
        // [ IMPORTANT ] Keep full track of Player object here
        this.playerState.players.forEach(player => {
            const spawn = spawnMap[player.id];

            player.transform.pos.x = spawn.x;
            player.transform.pos.y = spawn.y;
            player.transform.rot = player.transform.rot || 0;
            player.timestamp = player.timestamp || Date.now();
            player.actions.dash.cooldown = player.actions.dash.cooldown || PLAYER_DEFAULTS.ACTIONS.DASH.COOLDOWN;
            player.actions.dash.drain = player.actions.dash.drain || PLAYER_DEFAULTS.ACTIONS.DASH.DRAIN;
            player.actions.dash.multiplier = player.actions.dash.multiplier || PLAYER_DEFAULTS.ACTIONS.DASH.MULTIPLIER;
            player.actions.dash.time = player.actions.dash.time || PLAYER_DEFAULTS.ACTIONS.DASH.TIME;
            player.actions.melee.cooldown = player.actions.melee.cooldown || PLAYER_DEFAULTS.ACTIONS.MELEE.COOLDOWN;
            player.actions.melee.damage = player.actions.melee.damage || PLAYER_DEFAULTS.ACTIONS.MELEE.DAMAGE;
            player.actions.melee.duration = player.actions.melee.duration || PLAYER_DEFAULTS.ACTIONS.MELEE.DURATION;
            player.actions.melee.range = player.actions.melee.range || PLAYER_DEFAULTS.ACTIONS.MELEE.RANGE;
            player.actions.melee.size = player.actions.melee.size || PLAYER_DEFAULTS.ACTIONS.MELEE.SIZE;
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
            player.actions.primary.reload.time = player.actions.primary.reload.time || PLAYER_DEFAULTS.ACTIONS.PRIMARY.RELOAD.TIME;
            player.actions.sprint.drain = player.actions.sprint.drain || PLAYER_DEFAULTS.ACTIONS.SPRINT.DRAIN;
            player.actions.sprint.multiplier = player.actions.sprint.multiplier || PLAYER_DEFAULTS.ACTIONS.SPRINT.MULTIPLIER;
            player.equipment = player.equipment || PLAYER_DEFAULTS.EQUIPMENT;
            player.physics.acceleration = player.physics.acceleration || PLAYER_DEFAULTS.PHYSICS.ACCELERATION;
            player.physics.friction = player.physics.friction || PLAYER_DEFAULTS.PHYSICS.FRICTION;
            player.rig.body = player.rig.body || PLAYER_DEFAULTS.RIG.BODY;
            player.rig.head = player.rig.head || PLAYER_DEFAULTS.RIG.HEAD;
            player.rig.headwear = player.rig.headwear || PLAYER_DEFAULTS.RIG.HEADWEAR;
            player.rig.weapon = player.rig.weapon || PLAYER_DEFAULTS.RIG.WEAPON;
            player.stats.health.max = player.stats.health.max || PLAYER_DEFAULTS.STATS.HEALTH.MAX;
            player.stats.health.value = player.stats.health.max || PLAYER_DEFAULTS.STATS.HEALTH.MAX;
            player.stats.luck = player.stats.luck || PLAYER_DEFAULTS.STATS.LUCK;
            player.stats.size = player.stats.size || PLAYER_DEFAULTS.STATS.SIZE;
            player.stats.speed = player.stats.speed || PLAYER_DEFAULTS.STATS.SPEED;
            player.stats.stamina.max = player.stats.stamina.max || PLAYER_DEFAULTS.STATS.STAMINA.MAX;
            player.stats.stamina.recovery.delay = player.stats.stamina.recovery.delay || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.DELAY;
            player.stats.stamina.recovery.rate = player.stats.stamina.recovery.rate || PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.RATE;
            player.stats.stamina.value = player.stats.stamina.value || PLAYER_DEFAULTS.STATS.STAMINA.MAX;
            player.unique = player.unique || PLAYER_DEFAULTS.UNIQUE
        });

        // Send the spawn map to all other players
        this.roomManager.sendMessage(JSON.stringify({
            type: 'new-round',
            spawnMap: spawnMap,
        }));
    }

    /**
     * Creates a spawn map for player start locations in a new round.
     * 
     * This value is generated by the winner or the host, and is sent to the server for distribution.
     */
    private getSpawnMap(distance: number): { [playerId: string]: { x: number, y: number } } {
        const spawnMap: { [playerId: string]: { x: number, y: number } } = {};
        const usedSpawns: { x: number, y: number }[] = [];

        spawnMap[this.userId] = {
            x: this.playerState.myPlayer.transform.pos.x,
            y: this.playerState.myPlayer.transform.pos.y
        };
        usedSpawns.push(spawnMap[this.userId]);

        this.playerState.players.forEach(player => {
            let spawn: { x: number, y: number };
            let tries = 0;
            do {
                spawn = {
                    x: Math.random() * (CANVAS.WIDTH - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN,
                    y: Math.random() * (CANVAS.HEIGHT - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN
                };
                tries++;
            } while (
                usedSpawns.some(s => Math.hypot(s.x - spawn.x, s.y - spawn.y) < distance) &&
                tries < 1000
            );
            usedSpawns.push(spawn);
            spawnMap[player.id] = spawn;
        });

        return spawnMap;
    }
    //
    // #endregion

    // #region [ Player ]
    /**
     * Processes player movements and desired velocity. 
     */
    private updatePlayerPosition(delta: number): void {
        if (!this.gameState.gameInProgress || this.playerState.myPlayer.stats.health.value <= 0 || this.playerState.isDashing) return;

        const now = Date.now();
        const { inputX, inputY } = this.moveController.getMoveInput();

        // [ Sprinting ]
        const canSprint = this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value > 0 && this.moveController.isMoving();
        const currentSpeed = canSprint ? this.playerState.myPlayer.stats.speed * this.playerState.myPlayer.actions.sprint.multiplier : this.playerState.myPlayer.stats.speed;
        if (this.playerState.isSprinting && this.playerState.myPlayer.stats.stamina.value <= 0) { // Stop sprinting if out of stamina
            this.playerState.isSprinting = false;
            console.log('Out of stamina, stopped sprinting');
        }
        //

        const targetVelocityX = inputX * currentSpeed;
        const targetVelocityY = inputY * currentSpeed;

        this.playerState.playerVelocityX += (targetVelocityX - this.playerState.playerVelocityX) * this.playerState.myPlayer.physics.acceleration * delta;
        this.playerState.playerVelocityY += (targetVelocityY - this.playerState.playerVelocityY) * this.playerState.myPlayer.physics.acceleration * delta;

        if (!this.moveController.isMoving()) {
            this.playerState.playerVelocityX *= Math.pow(this.playerState.myPlayer.physics.friction, delta);
            this.playerState.playerVelocityY *= Math.pow(this.playerState.myPlayer.physics.friction, delta);
        }

        let newX = this.playerState.myPlayer.transform.pos.x + this.playerState.playerVelocityX * delta;
        let newY = this.playerState.myPlayer.transform.pos.y + this.playerState.playerVelocityY * delta;

        this.playerState.myPlayer.transform.pos.x = newX;
        this.playerState.myPlayer.transform.pos.y = newY;

        let moved = (this.playerState.playerVelocityX !== 0 || this.playerState.playerVelocityY !== 0);

        const distanceFromLastSent = Math.sqrt(
            (this.playerState.myPlayer.transform.pos.x - this.playerState.lastSentX) ** 2 +
            (this.playerState.myPlayer.transform.pos.y - this.playerState.lastSentY) ** 2
        );

        if (moved && distanceFromLastSent > 2 && now - this.playerState.lastSentMoveTime >= NETWORK.MOVE_INTERVAL) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    pos: {
                        x: this.playerState.myPlayer.transform.pos.x,
                        y: this.playerState.myPlayer.transform.pos.y
                    }
                }
            }));

            this.playerState.lastSentX = this.playerState.myPlayer.transform.pos.x;
            this.playerState.lastSentY = this.playerState.myPlayer.transform.pos.y;
            this.playerState.lastSentMoveTime = now;
        }

        if (Math.abs(this.playerState.playerVelocityX) < 0.01) this.playerState.playerVelocityX = 0;
        if (Math.abs(this.playerState.playerVelocityY) < 0.01) this.playerState.playerVelocityY = 0;
    }

    /**
     * Record the player's own death when they are the targetId of a player-hit message and their health reaches 0.
     */
    private recordDeath(): void {
        console.log('I died! Waiting for round to end...');

        this.playerState.resetPlayerState();

        const ammoBox = this.spawnAmmoBox(10);
        this.objectsManager.ammoBoxes.set(ammoBox.id, ammoBox);

        this.particlesManager.generateGore(this.userId, this.playerState.myPlayer.transform.pos.x, this.playerState.myPlayer.transform.pos.y, this.playerState.myPlayer.stats.size);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-death',
            playerId: this.userId,
            x: this.playerState.myPlayer.transform.pos.x,
            y: this.playerState.myPlayer.transform.pos.y,
            size: this.playerState.myPlayer.stats.size,
            ammoBox: ammoBox
        }));
    }
    //
    // #endregion

    // #region [ Objects ]
    //
    /**
     * Spawns a GameObject in the scene, returning it's properties for the construction.
     */
    private spawnObject(params: SpawnObjectParams): GameObject {
        const baseObject: GameObject = {
            id: this.utility.generateUID(OBJECT_DEFAULTS.DATA.ID_LENGTH),
            transform: params.transform,
            timestamp: Date.now()
        };

        switch (params.type) { //TODO: Spawn the player, projectiles and any other GameObject types here
            case 'AmmoBox':
                return {
                    id: baseObject.id,
                    transform: baseObject.transform,
                    timestamp: baseObject.timestamp,
                    ammoAmount: params.data?.amount || 10,
                    isOpen: false,
                    lid: {
                        pos: { x: 0, y: 0 },
                        rot: 0,
                        velocity: { x: 0, y: 0 },
                        torque: 0
                    }
                } as AmmoBox;

            default:
                throw new Error(`Unknown object type: ${params.type}`);
        }
    }

    private spawnAmmoBox(amount: number): AmmoBox {
        return this.spawnObject({
            type: 'AmmoBox',
            transform: {
                pos: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y
                },
                rot: this.playerState.myPlayer.transform.rot
            },
            data: { amount }
        }) as AmmoBox;
    }
    //
    // #endregion

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
    private executeStartGame(): void {
        // Send start game message to other players
        this.roomManager.sendMessage(JSON.stringify({
            type: 'start-game',
            hostSpawn: {
                x: this.playerState.myPlayer.transform.pos.x,
                y: this.playerState.myPlayer.transform.pos.y
            }
        }));

        // Also start the game for myself as the host
        this.showGameControls(this.roomManager.getCurrentRoom() || '');
        this.startGameLoop();
    }

    /**
     * Kicks of the game loop and initializes values to clean slate.
     */
    private startGameLoop(): void {
        this.gameState.gameInProgress = true;
        this.isRoundInProgress = true;

        this.playerState.myPlayer.actions.primary.magazine.currentReserve = Math.floor(PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.MAX_RESERVE / 2);
        this.playerState.myPlayer.actions.primary.magazine.currentAmmo = this.playerState.myPlayer.actions.primary.magazine.size;
        this.ammoReservesUIController.spawnAmmoInReserveUI(this.playerState.myPlayer.actions.primary.magazine.currentReserve);
        this.playerState.isReloading = false;

        this.ui.createLeaderboard(this.lobbyManager, this.playerState.players, this.userId);

        this.upgradeManager.resetUpgrades(this.playerState.myPlayer);

        // Send my player data
        // TODO: You can maybe just call this.initializePlayer and use the returned player object, unsure yet.
        // [ IMPORTANT ] Keep full track of Player object here
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-state',
            id: this.playerState.myPlayer.id,
            timestamp: this.playerState.myPlayer.timestamp,
            color: this.playerState.myPlayer.color,
            transform: {
                pos: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y,
                },
                rot: this.playerState.myPlayer.transform.rot
            },
            actions: {
                dash: {
                    cooldown: this.playerState.myPlayer.actions.dash.cooldown,
                    drain: this.playerState.myPlayer.actions.dash.drain,
                    multiplier: this.playerState.myPlayer.actions.dash.multiplier,
                    time: this.playerState.myPlayer.actions.dash.time
                },
                melee: {
                    cooldown: this.playerState.myPlayer.actions.melee.cooldown,
                    damage: this.playerState.myPlayer.actions.melee.damage,
                    duration: this.playerState.myPlayer.actions.melee.duration,
                    range: this.playerState.myPlayer.actions.melee.range,
                    size: this.playerState.myPlayer.actions.melee.size
                },
                primary: {
                    buffer: this.playerState.myPlayer.actions.primary.buffer,
                    burst: {
                        amount: this.playerState.myPlayer.actions.primary.burst.amount,
                        delay: this.playerState.myPlayer.actions.primary.burst.delay
                    },
                    magazine: {
                        currentAmmo: this.playerState.myPlayer.actions.primary.magazine.currentAmmo,
                        currentReserve: this.playerState.myPlayer.actions.primary.magazine.currentReserve,
                        maxReserve: this.playerState.myPlayer.actions.primary.magazine.maxReserve,
                        size: this.playerState.myPlayer.actions.primary.magazine.size
                    },
                    offset: this.playerState.myPlayer.actions.primary.offset,
                    projectile: {
                        amount: this.playerState.myPlayer.actions.primary.projectile.amount,
                        color: this.playerState.myPlayer.actions.primary.projectile.color,
                        damage: this.playerState.myPlayer.actions.primary.projectile.damage,
                        length: this.playerState.myPlayer.actions.primary.projectile.length,
                        range: this.playerState.myPlayer.actions.primary.projectile.range,
                        size: this.playerState.myPlayer.actions.primary.projectile.size,
                        speed: this.playerState.myPlayer.actions.primary.projectile.speed,
                        spread: this.playerState.myPlayer.actions.primary.projectile.spread
                    },
                    reload: {
                        time: this.playerState.myPlayer.actions.primary.reload.time
                    }
                },
                sprint: {
                    drain: this.playerState.myPlayer.actions.sprint.drain,
                    multiplier: this.playerState.myPlayer.actions.sprint.multiplier
                }
            },
            equipment: this.playerState.myPlayer.equipment,
            physics: {
                acceleration: this.playerState.myPlayer.physics.acceleration,
                friction: this.playerState.myPlayer.physics.friction
            },
            rig: {
                body: this.playerState.myPlayer.rig.body,
                head: this.playerState.myPlayer.rig.head,
                headwear: this.playerState.myPlayer.rig.headwear,
                weapon: this.playerState.myPlayer.rig.weapon
            },
            stats: {
                health: {
                    max: this.playerState.myPlayer.stats.health.max,
                    value: this.playerState.myPlayer.stats.health.value
                },
                luck: this.playerState.myPlayer.stats.luck,
                size: this.playerState.myPlayer.stats.size,
                speed: this.playerState.myPlayer.stats.speed,
                stamina: {
                    max: this.playerState.myPlayer.stats.stamina.max,
                    recovery: {
                        delay: this.playerState.myPlayer.stats.stamina.recovery.delay,
                        rate: this.playerState.myPlayer.stats.stamina.recovery.rate
                    },
                    value: this.playerState.myPlayer.stats.stamina.value,
                },
            },
            unique: this.playerState.myPlayer.unique
        }));

        this.gameLoop();

        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
        const healthSliderParams: SetSliderParams = {
            sliderId: 'healthBar',
            targetValue: this.playerState.myPlayer.stats.health.value,
            maxValue: this.playerState.myPlayer.stats.health.max,
            lerpTime: sliderLerpTime
        }

        const staminaSliderParams: SetSliderParams = {
            sliderId: 'staminaBar',
            targetValue: this.playerState.myPlayer.stats.stamina.value,
            maxValue: this.playerState.myPlayer.stats.stamina.max,
            lerpTime: sliderLerpTime
        }

        this.utility.setSlider(healthSliderParams);
        this.utility.setSlider(staminaSliderParams);
    }

    /**
     * Core game processing function.
     * 
     * Handles animation frame requests, update loops for all systems, and drawing functions.
     */
    private gameLoop(): void {
        if (!this.gameState.gameInProgress || !this.ui.ctx || !this.ui.canvas || !this.ui.decalCtx || !this.ui.decalCanvas) return;

        if (this.gameState.isPaused) { // Continue the loop but skip all updates
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        const dt = this.utility.deltaTime();

        // Update
        this.updatePlayerPosition(dt);
        this.combatController.updateAttack(dt);
        this.combatController.updateProjectiles(dt);
        this.particlesManager.updateParticles(dt);
        this.particlesManager.updateEmitters(dt);
        this.animator.updateCharacterAnimations(dt);
        this.staminaController.updateStamina(dt);
        this.dashController.updateDash(dt);

        this.collisionsManager.checkCollisions(dt);

        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
        const staminaSliderParams: SetSliderParams = {
            sliderId: 'staminaBar',
            targetValue: this.playerState.myPlayer.stats.stamina.value,
            maxValue: this.playerState.myPlayer.stats.stamina.max,
            lerpTime: sliderLerpTime
        }
        this.utility.setSlider(staminaSliderParams);

        this.clearCtx(this.ui.ctx);

        this.ui.ctx.drawImage(this.ui.decalCanvas, 0, 0)

        this.drawObjects();

        // Draw projectiles
        this.combatController.projectiles.forEach(projectile => {
            this.drawProjectile(projectile);
        });

        // Draw other players
        this.playerState.players.forEach(player => {
            this.drawCharacter(player);
        });

        this.drawCharacter(this.playerState.myPlayer, true);
        this.drawParticles();

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
        // Clear game flags
        this.gameState.gameInProgress = false;
        this.isRoundInProgress = false;
        this.gameWinner = null;
        this.roundWinner = null;

        this.gameState.gameMaxWins = GAME.MAX_WINS;
        this.gameState.gameMaxPlayers = GAME.MAX_PLAYERS;

        if (resetType === 'Room') {
            this.lobbyManager.inLobby = false;
            this.playerState.isHost = false;
        }

        // Clear all collections
        this.playerState.players.clear();
        this.combatController.projectiles.clear();
        this.objectsManager.ammoBoxes.clear();
        this.decalsManager.decals.clear();
        this.particlesManager.particles.clear();
        this.particlesManager.emitters.clear();
        this.upgradeManager.upgradesCompleted.clear();

        this.ammoReservesUIController.reserveBulletParticles = [];

        if (resetType === 'Room') {
            this.lobbyManager.lobbyPlayers.clear();
        }

        // Reset UI and player
        this.clearCtx();
        this.chatManager.clearChat();
        this.ui.clearLeaderboard();
        this.playerState.resetPlayerState();
        this.playerState.initPlayer(this.userId);

        // Reset upgrades and equipment
        this.upgradeManager.resetUpgrades(this.playerState.myPlayer);
    }

    //
    // #endregion

    // #region [ Upgrade ]
    //
    /**
     * Start the upgrade phase by showing the relative UI for winners/losers.
     */
    private startUpgradePhase(winnerId: string | null): void {
        console.log('Starting upgrade phase...');

        this.upgradeManager.upgradesCompleted.clear(); // Reset upgrade tracking

        // Show upgrade UI based on if I won or lost
        if (winnerId === this.userId) {
            this.showWinnerWaitScreen();
        } else {
            this.showUpgradeSelection();
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

            setTimeout(() => {
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
    private showUpgradeSelection(): void {
        if (!this.ui.upgradeContainer) return;

        this.ui.upgradeContainer.innerHTML = '';

        // Get 3 random upgrades
        // TODO: Test this, seems to not be working, might actual be upgrade rolls not having enough in pool right now.
        const availableUpgrades = this.upgradeManager.getUpgrades(3, this.playerState.myPlayer);

        availableUpgrades.forEach(upgrade => {
            const upgradeDiv = document.createElement('div');
            upgradeDiv.className = 'upgrade_card';
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
            console.error('Failed to apply upgrade');
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

        // [ IMPORTANT ] Keep full track of Player object here
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-state',
            id: this.playerState.myPlayer.id,
            timestamp: this.playerState.myPlayer.timestamp,
            color: this.playerState.myPlayer.color,
            transform: {
                pos: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y,
                },
                rot: this.playerState.myPlayer.transform.rot
            },
            actions: {
                dash: {
                    cooldown: this.playerState.myPlayer.actions.dash.cooldown,
                    drain: this.playerState.myPlayer.actions.dash.drain,
                    multiplier: this.playerState.myPlayer.actions.dash.multiplier,
                    time: this.playerState.myPlayer.actions.dash.time
                },
                melee: {
                    cooldown: this.playerState.myPlayer.actions.melee.cooldown,
                    damage: this.playerState.myPlayer.actions.melee.damage,
                    duration: this.playerState.myPlayer.actions.melee.duration,
                    range: this.playerState.myPlayer.actions.melee.range,
                    size: this.playerState.myPlayer.actions.melee.size
                },
                primary: {
                    buffer: this.playerState.myPlayer.actions.primary.buffer,
                    burst: {
                        amount: this.playerState.myPlayer.actions.primary.burst.amount,
                        delay: this.playerState.myPlayer.actions.primary.burst.delay
                    },
                    magazine: {
                        currentAmmo: this.playerState.myPlayer.actions.primary.magazine.currentAmmo,
                        currentReserve: this.playerState.myPlayer.actions.primary.magazine.currentReserve,
                        maxReserve: this.playerState.myPlayer.actions.primary.magazine.maxReserve,
                        size: this.playerState.myPlayer.actions.primary.magazine.size
                    },
                    offset: this.playerState.myPlayer.actions.primary.offset,
                    projectile: {
                        amount: this.playerState.myPlayer.actions.primary.projectile.amount,
                        color: this.playerState.myPlayer.actions.primary.projectile.color,
                        damage: this.playerState.myPlayer.actions.primary.projectile.damage,
                        length: this.playerState.myPlayer.actions.primary.projectile.length,
                        range: this.playerState.myPlayer.actions.primary.projectile.range,
                        size: this.playerState.myPlayer.actions.primary.projectile.size,
                        speed: this.playerState.myPlayer.actions.primary.projectile.speed,
                        spread: this.playerState.myPlayer.actions.primary.projectile.spread
                    },
                    reload: {
                        time: this.playerState.myPlayer.actions.primary.reload.time
                    }
                },
                sprint: {
                    drain: this.playerState.myPlayer.actions.sprint.drain,
                    multiplier: this.playerState.myPlayer.actions.sprint.multiplier
                }
            },
            equipment: this.playerState.myPlayer.equipment,
            physics: {
                acceleration: this.playerState.myPlayer.physics.acceleration,
                friction: this.playerState.myPlayer.physics.friction
            },
            rig: {
                body: this.playerState.myPlayer.rig.body,
                head: this.playerState.myPlayer.rig.head,
                headwear: this.playerState.myPlayer.rig.headwear,
                weapon: this.playerState.myPlayer.rig.weapon
            },
            stats: {
                health: {
                    max: this.playerState.myPlayer.stats.health.max,
                    value: this.playerState.myPlayer.stats.health.max
                },
                luck: this.playerState.myPlayer.stats.luck,
                size: this.playerState.myPlayer.stats.size,
                speed: this.playerState.myPlayer.stats.speed,
                stamina: {
                    max: this.playerState.myPlayer.stats.stamina.max,
                    recovery: {
                        delay: this.playerState.myPlayer.stats.stamina.recovery.delay,
                        rate: this.playerState.myPlayer.stats.stamina.recovery.rate
                    },
                    value: this.playerState.myPlayer.stats.stamina.max
                }
            },
            unique: this.playerState.myPlayer.unique
        }));

        console.log('Upgrade selected, waiting for others...');
    }

    /**
     * Toggle all equipment based on player state.
     */
    private toggleEquipment(equipmentId: string): void {
        if (!this.upgradeManager.hasEquipment(this.playerState.myPlayer, equipmentId)) return;

        switch (equipmentId) {
            case 'test_equipment_id':
                // Toggle equipment stuff here
                break;
            // TODO: Add more equipment types here

            default:
                console.warn(`Unknown equipment: ${equipmentId}`);
        }
    }
    //
    // #endregion

    // #region [ Rendering ]
    //
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

        if (!this.ui.decalCtx || !this.ui.ctx) return;

        this.ui.ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        this.ui.decalCtx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
    }
    // #endregion

    // [ Character ]
    //
    /**
     * Draws the corresponding character layers defined in the rig to create the player character.
     */
    private drawCharacter(player: Player, isMe: boolean = false): void {
        if (!this.ui.ctx) return;
        if (player.stats.health.value <= 0) return;

        // Render layers in order: BODY → WEAPON → HEAD → HEADWEAR
        this.drawCharacterLayer(player, 'BODY', player.rig.body);
        this.drawCharacterLayer(player, 'WEAPON', player.rig.weapon);
        this.drawCharacterLayer(player, 'HEAD', player.rig.head);
        this.drawCharacterLayer(player, 'HEADWEAR', player.rig.headwear);

        // Draw player name/info (existing code)
        this.ui.ctx.fillStyle = UI.TEXT_COLOR;
        this.ui.ctx.font = UI.FONT;
        this.ui.ctx.textAlign = 'center';

        const displayName = isMe ? 'You' : player.id.substring(0, 6);
        this.ui.ctx.fillText(
            displayName,
            player.transform.pos.x,
            player.transform.pos.y - PLAYER_DEFAULTS.VISUAL.ID_DISPLAY_OFFSET
        );
    }

    /**
     * Retrieves character assets and draws each layer using drawCharacterPart.
     */
    private drawCharacterLayer(player: Player, layer: CharacterLayer, variant: string): void {
        if (!this.ui.ctx) return;

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

    /**
     * Handles the actual rendering for all player parts on each layer.
     */
    private drawCharacterPart(player: Player, assetPath: string, partType: CharacterLayer, partIndex?: number): void {
        if (!this.ui.ctx) return;

        let image = this.renderingManager.characterImages.get(assetPath);

        if (!image) {
            image = new Image();
            image.src = assetPath;
            this.renderingManager.characterImages.set(assetPath, image);
            if (!image.complete) return;
        }

        if (!image.complete || image.naturalWidth === 0) return;

        const drawSize = GAME.CHARACTER_SIZE * (player.stats.size / GAME.CHARACTER_SIZE);

        // Check for animation offset
        const animationId = `${player.id}_${partType}_${partIndex || 0}`;
        const animationOffset = this.animator.characterOffsets?.get(animationId) || { x: 0, y: 0 };

        this.ui.ctx.save();

        // Apply rotation if it exists
        if (player.transform.rot !== undefined) {
            this.ui.ctx.translate(player.transform.pos.x, player.transform.pos.y);
            this.ui.ctx.rotate(player.transform.rot);

            // Apply animation offset
            this.ui.ctx.translate(animationOffset.x, animationOffset.y);

            this.ui.ctx.drawImage(
                image,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
        } else {
            this.ui.ctx.drawImage(
                image,
                player.transform.pos.x - drawSize / 2 + animationOffset.x,
                player.transform.pos.y - drawSize / 2 + animationOffset.y,
                drawSize,
                drawSize
            );
        }

        this.ui.ctx.restore();
    }
    //

    /**
     * Draws object entities on the canvas.
     */
    private drawObjects(): void {
        if (!this.ui.ctx) return;

        //TODO: Use this function to draw all 'objects' in the scene.

        // Ammo Boxes
        this.objectsManager.ammoBoxes.forEach(ammoBox => {
            if (!this.ui.ctx) return;

            // Load and cache images
            if (!this.renderingManager.ammoBoxImages) this.renderingManager.ammoBoxImages = {};
            const layers: (keyof typeof AMMO_BOX)[] = ['BASE', 'BULLETS', 'LID'];
            layers.forEach(layer => {
                if (!this.renderingManager.ammoBoxImages[layer]) {
                    const img = new Image();
                    img.src = AMMO_BOX[layer];
                    this.renderingManager.ammoBoxImages[layer] = img;
                }
            });

            if (!layers.every(layer => this.renderingManager.ammoBoxImages[layer]?.complete && this.renderingManager.ammoBoxImages[layer]?.naturalWidth > 0)) return;

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

            this.ui.ctx.save();
            this.ui.ctx.translate(x, y);
            this.ui.ctx.rotate(ammoBox.transform.rot || 0);

            // Draw body
            this.ui.ctx.drawImage(this.renderingManager.ammoBoxImages['BASE'], -scale / 2, -scale / 2, scale, scale);

            // Draw bullets only if NOT open
            if (!ammoBox.isOpen) {
                this.ui.ctx.drawImage(this.renderingManager.ammoBoxImages['BULLETS'], -scale / 2, -scale / 2, scale, scale);
                // Draw closed lid here
                this.ui.ctx.drawImage(this.renderingManager.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
            }

            this.ui.ctx.restore();

            // Draw flying lid separately if open
            if (ammoBox.isOpen) {
                this.ui.ctx.save();
                this.ui.ctx.translate(x + ammoBox.lid.pos.x, y + ammoBox.lid.pos.y);
                this.ui.ctx.rotate((ammoBox.transform.rot || 0) + ammoBox.lid.rot);
                this.ui.ctx.drawImage(this.renderingManager.ammoBoxImages['LID'], -scale / 2, -scale / 2, scale, scale);
                this.ui.ctx.restore();
            }
        });
    }

    /**
     * Draws the rect of the projectile and renders it on the main canvas.
     */
    private drawProjectile(projectile: Projectile): void {
        if (!this.ui.ctx) return;

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
        this.ui.ctx.fillStyle = projectile.color;
        this.ui.ctx.strokeStyle = projectile.color;
        this.ui.ctx.lineWidth = projectile.size;
        this.ui.ctx.lineCap = 'round';

        this.ui.ctx.beginPath();
        this.ui.ctx.moveTo(backX, backY);
        this.ui.ctx.lineTo(frontX, frontY);
        this.ui.ctx.stroke();
    }

    /**
     * Responsible for the actual rendering of particles spawned via emitters and particle functions.
     */
    private drawParticles(): void {
        if (!this.ui.ctx) return;

        this.particlesManager.particles.forEach(particle => {
            const rgb = this.utility.hexToRgb(particle.color);
            if (!rgb) return;

            if (!this.ui.ctx) return;
            this.ui.ctx.save();
            this.ui.ctx.globalAlpha = particle.opacity;

            // Apply rotation if torque exists
            if (particle.torque !== 0) {
                this.ui.ctx.translate(particle.pos.x + particle.size / 2, particle.pos.y + particle.size / 2);
                this.ui.ctx.rotate(particle.rotation);
                this.ui.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ui.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            } else {
                this.ui.ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.ui.ctx.fillRect(Math.floor(particle.pos.x), Math.floor(particle.pos.y), particle.size, particle.size);
            }

            this.ui.ctx.restore();
        });
    }
}

// Initialize the game client
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new Client();
    });
} else {
    new Client();
}