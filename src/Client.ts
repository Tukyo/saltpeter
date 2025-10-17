
import { PLAYER_DEFAULTS, CANVAS, GAME, SFX, AUDIO } from './Config';

import { Player, RoomMessage, LobbyPlayer, LeaderboardEntry, ResetType, SetSliderParams, SetSpanParams, DeathDecal, EmitterParams } from './Types';

import { Animator } from './Animator';
import { AudioManager } from './AudioManager';
import { CharacterConfig } from './CharacterConfig';
import { CharacterManager } from './CharacterManager';
import { ChatManager } from './ChatManager';
import { ControlsManager } from './ControlsManager';
import { CollisionsManager } from './CollisionsManager';
import { DecalsManager } from './DecalsManager';
import { EventsManager } from './EventsManager';
import { GameState } from './GameState';
import { LobbyManager } from './LobbyManager';
import { ParticlesManager } from './ParticlesManager';
import { RenderingManager } from './RenderingManager';
import { RoomController } from './RoomController';
import { RoomManager } from './RoomManager';
import { SettingsManager } from './SettingsManager';
import { UpgradeManager } from './UpgradeManager';
import { UserInterface } from './UserInterface';
import { Utility } from './Utility';
import { WebsocketManager } from './WebsocketManager';

import { AmmoReservesUIController } from './player/AmmoReservesUIController';
import { CombatController } from './player/CombatController';
import { DashController } from './player/DashController';
import { LuckController } from './player/LuckController';
import { MoveController } from './player/MoveController';
import { ObjectsManager } from './ObjectsManager';
import { PlayerController } from './player/PlayerController';
import { PlayerState } from './player/PlayerState';
import { StaminaController } from './player/StaminaController';
import { CacheManager } from './CacheManager';
import { Admin } from './Admin';

class Client {
    private userId: string;

    private isRoundInProgress = false;

    private roundWinner: string | null = null;
    private gameWinner: string | null = null; // TODO: Use the game winner to display lobby historical wins

    private admin: Admin;
    private ammoReservesUIController: AmmoReservesUIController;
    private animator: Animator;
    private audioManager: AudioManager;
    private cacheManager: CacheManager;
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

    // #region [ Initialization ]
    //
    constructor() {
        this.cacheManager = new CacheManager();
        this.utility = new Utility();
        this.gameState = new GameState();

        this.settingsManager = new SettingsManager(this.cacheManager);
        this.controlsManager = new ControlsManager(this.settingsManager);

        this.charConfig = new CharacterConfig();
        this.charManager = new CharacterManager(this.charConfig);

        this.userId = this.utility.generateUID(PLAYER_DEFAULTS.DATA.ID_LENGTH);

        this.playerState = new PlayerState(this.userId, this.utility);

        this.ui = new UserInterface(this.playerState, this.settingsManager);

        this.ammoReservesUIController = new AmmoReservesUIController(this.ui);
        this.upgradeManager = new UpgradeManager(this.ammoReservesUIController, this.playerState, this.utility);

        this.admin = new Admin(this.cacheManager, this.ui);

        this.objectsManager = new ObjectsManager(
            this.playerState,
            this.utility
        );

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

        this.collisionsManager = new CollisionsManager(
            this.ammoReservesUIController,
            this.objectsManager,
            this.playerState,
            this.roomManager,
            this.userId
        );

        this.moveController = new MoveController(this.controlsManager, this.settingsManager);
        this.staminaController = new StaminaController(this.playerState);
        this.luckController = new LuckController(this.playerState);

        this.audioManager = new AudioManager(this.roomManager, this.settingsManager);
        this.animator = new Animator(this.playerState, this.roomManager, this.userId);

        this.renderingManager = new RenderingManager(
            this.animator,
            this.charManager,
            this.objectsManager,
            this.ui
        );

        this.decalsManager = new DecalsManager(
            this.roomManager,
            this.ui,
            this.utility
        );

        this.particlesManager = new ParticlesManager(
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
            this.gameState,
            this.luckController,
            this.moveController,
            this.objectsManager,
            this.particlesManager,
            this.playerState,
            this.roomManager,
            this.userId,
            this.utility
        );

        this.combatController = new CombatController(
            this.ammoReservesUIController,
            this.animator,
            this.audioManager,
            this.collisionsManager,
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
            this.chatManager,
            this.controlsManager,
            this.gameState,
            this.lobbyManager,
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
                this.ammoReservesUIController.spawnAmmoInReserveUI(ammo);
            }
        });
    }

    /**
     * Main initializer for the game client.
     */
    private async initClient(): Promise<void> {
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

        await this.settingsManager.loadSettings();

        const audioSettings = this.settingsManager.getSettings().audio.mixer;
        this.ui.initSoundSliders(audioSettings);

        this.eventsManager.initKeybindListeners();

        if (AUDIO.SETTINGS.PRELOAD_SOUNDS) {
            this.audioManager.preloadAudioAssets(SFX, '.ogg');
        }

        this.watchForInputs();

        this.admin.onAdminCommand = (command, key) => {
            this.roomManager.sendAdminCommand(command, key);
        };
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
    //
    //
    //
    //
    //
    //
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

                    this.lobbyManager.setupLobbyOptions(
                        this.gameState.gameMaxPlayers,
                        this.gameState.gameMaxWins,
                        this.playerState.isHost,
                        this.roomManager.isPrivateRoom,
                        this.upgradeManager.isUpgradesEnabled
                    );

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
                            flags: {
                                hidden: gameData.flags.hidden || PLAYER_DEFAULTS.FLAGS.HIDDEN,
                                invulnerable: gameData.flags.invulnerable || PLAYER_DEFAULTS.FLAGS.INVULNERABLE
                            },
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
                                defense: gameData.stats?.defense || PLAYER_DEFAULTS.STATS.DEFENSE,
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
                case 'partial-state': {
                    if (message.userId === this.userId) return;

                    const player = this.playerState.players.get(message.userId);
                    if (!player) break;

                    console.log('Partial State update for player', message.userId, ':', gameData);

                    this.utility.deepMerge(player, gameData);
                    break;
                }
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
                            const actuallyDied = this.playerController.playerDeath();
                            if (actuallyDied) {
                                this.checkRoundEnd();
                            }
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
                    this.particlesManager.generateGore(gore); // Spawn gore

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
                case 'projectile-deflect':
                    if (!this.lobbyManager.inLobby && this.combatController.projectiles.has(gameData.projectileId)) {
                        const projectile = this.combatController.projectiles.get(gameData.projectileId)!;

                        // Update projectile properties
                        projectile.ownerId = gameData.newOwnerId;
                        projectile.velocity = gameData.velocity;
                        projectile.color = gameData.color;
                        projectile.transform.rot = Math.atan2(projectile.velocity.y, projectile.velocity.x);

                        console.log(`Projectile ${gameData.projectileId} deflected by ${gameData.newOwnerId}`);
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
                        this.playerState.players.forEach((player: Player, id: string) => {
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
                        const emission: EmitterParams = {
                            id: gameData.emitterId,
                            interval: gameData.interval,
                            lifetime: gameData.lifetime,
                            offset: {
                                x: gameData.offset.x,
                                y: gameData.offset.y
                            },
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
                // #endregion
                //
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
    //
    //
    //
    //
    //
    //
    // #region [ Round ]
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

        this.playerState.players.forEach((player: Player) => {
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
        this.playerState.players.forEach((player: Player) => {
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
            player.flags.hidden = player.flags.hidden || PLAYER_DEFAULTS.FLAGS.HIDDEN;
            player.flags.invulnerable = player.flags.invulnerable || PLAYER_DEFAULTS.FLAGS.INVULNERABLE;
            player.physics.acceleration = player.physics.acceleration || PLAYER_DEFAULTS.PHYSICS.ACCELERATION;
            player.physics.friction = player.physics.friction || PLAYER_DEFAULTS.PHYSICS.FRICTION;
            player.rig.body = player.rig.body || PLAYER_DEFAULTS.RIG.BODY;
            player.rig.head = player.rig.head || PLAYER_DEFAULTS.RIG.HEAD;
            player.rig.headwear = player.rig.headwear || PLAYER_DEFAULTS.RIG.HEADWEAR;
            player.rig.weapon = player.rig.weapon || PLAYER_DEFAULTS.RIG.WEAPON;
            player.stats.defense = player.stats.defense || PLAYER_DEFAULTS.STATS.DEFENSE;
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

        this.playerState.players.forEach((player: Player) => {
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
            flags: {
                hidden: this.playerState.myPlayer.flags.hidden,
                invulnerable: this.playerState.myPlayer.flags.invulnerable
            },
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
                defense: this.playerState.myPlayer.stats.defense,
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

        const sliderLerpTime = 300; //TODO: Define UI lerping times globally
        const staminaSliderParams: SetSliderParams = {
            sliderId: 'staminaBar',
            targetValue: this.playerState.myPlayer.stats.stamina.value,
            maxValue: this.playerState.myPlayer.stats.stamina.max,
            lerpTime: sliderLerpTime
        }
        this.utility.setSlider(staminaSliderParams);

        this.renderingManager.clearCtx(this.ui.ctx);

        this.ui.ctx.drawImage(this.ui.decalCanvas, 0, 0)

        this.renderingManager.drawObjects();

        // Draw projectiles
        this.combatController.projectiles.forEach(projectile => {
            this.renderingManager.drawProjectile(projectile);
        });

        // Draw other players
        this.playerState.players.forEach((player: Player) => {
            this.renderingManager.drawCharacter(player);
        });

        this.renderingManager.drawCharacter(this.playerState.myPlayer, true);
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
        // Clear game flags
        this.gameState.gameInProgress = false;
        this.gameState.isPaused = false;
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
        this.particlesManager.shrapnel.clear();
        this.upgradeManager.upgradesCompleted.clear();

        this.ammoReservesUIController.reserveBulletParticles = [];

        if (resetType === 'Room') {
            this.lobbyManager.lobbyPlayers.clear();
        }

        // Reset UI and player
        this.renderingManager.clearCtx();
        this.chatManager.clearChat();
        this.ui.clearLeaderboard();
        this.playerState.resetPlayerState();
        this.playerState.initPlayer(this.userId);
        this.controlsManager.clearActiveKeys();
        this.animator.clearAllAnimations();

        // Reset upgrades and equipment
        this.upgradeManager.resetUpgrades(this.playerState.myPlayer);
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
            if (this.moveController.isMoving()) {
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
            flags: {
                hidden: this.playerState.myPlayer.flags.hidden,
                invulnerable: this.playerState.myPlayer.flags.invulnerable
            },
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
                defense: this.playerState.myPlayer.stats.defense,
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
