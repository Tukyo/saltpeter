import { generateUID, getRoomIdFromURL, getRandomColor } from './utils';
import { RoomManager } from './roomManager';
import { Player, RoomMessage, Projectile, LobbyPlayer } from './defs';
import { PLAYER, CANVAS, GAME, UI, PROJECTILE, ATTACK_PARAMS, CHAT } from './config';

class GameClient {
    private ws: WebSocket | null = null;
    private userId: string;
    private roomManager: RoomManager;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    private roomControls: HTMLDivElement | null = null;
    private gameContainer: HTMLDivElement | null = null;
    private userIdDisplay: HTMLSpanElement | null = null;
    private roomIdDisplay: HTMLSpanElement | null = null;
    private lobbyContainer: HTMLDivElement | null = null;
    private lobbyPlayersList: HTMLDivElement | null = null;
    private startGameBtn: HTMLButtonElement | null = null;
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

    private keys: Set<string> = new Set();

    private gameRunning = false;
    private isHost = false;
    private inLobby = false;

    // Shooting mechanics
    private isMouseDown = false;
    private mouseX = 0;
    private mouseY = 0;
    private lastBurstTime = 0;
    private currentBurstShot = 0;
    private burstInProgress = false;
    private nextBurstShotTime = 0;
    private projectileOffset = 5;

    // #region [ Initialization ]
    //
    constructor() {
        this.userId = generateUID();
        this.roomManager = new RoomManager(this.userId);

        this.myPlayer = {
            id: this.userId,
            x: Math.random() * (CANVAS.WIDTH - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN,
            y: Math.random() * (CANVAS.HEIGHT - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN,
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
        this.roomControls = document.getElementById("roomControls") as HTMLDivElement;
        this.gameContainer = document.getElementById("gameContainer") as HTMLDivElement;
        this.lobbyContainer = document.getElementById("lobbyContainer") as HTMLDivElement;
        this.lobbyPlayersList = document.getElementById("lobbyPlayersList") as HTMLDivElement;
        this.startGameBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
        this.userIdDisplay = document.getElementById("userId") as HTMLSpanElement;
        this.roomIdDisplay = document.getElementById("roomId") as HTMLSpanElement;

        // Add chat elements
        this.chatContainer = document.getElementById("chatContainer") as HTMLDivElement;
        this.chatMessages = document.getElementById("chatMessages") as HTMLDivElement;
        this.chatInput = document.getElementById("chatInput") as HTMLInputElement;
        this.chatSendBtn = document.getElementById("chatSendBtn") as HTMLButtonElement;

        if (!this.canvas || !this.roomControls || !this.gameContainer || !this.lobbyContainer ||
            !this.userIdDisplay || !this.roomIdDisplay || !this.lobbyPlayersList || !this.startGameBtn ||
            !this.chatContainer || !this.chatMessages || !this.chatInput || !this.chatSendBtn) {
            console.error('Some required DOM elements are missing');
            return;
        }

        this.canvas.width = CANVAS.WIDTH;
        this.canvas.height = CANVAS.HEIGHT;

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
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
                this.updateStartButton();
                break;
            case 'user-joined':
                console.log(`User ${message.userId} joined`);

                // If I'm in an active game, send my current state to the new player
                if (this.gameRunning && !this.inLobby) {
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-join',
                        x: this.myPlayer.x,
                        y: this.myPlayer.y,
                        color: this.myPlayer.color
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
                    this.updateStartButton();
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
                    this.updateStartButton();
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
                case 'chat-message':
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
                    break;

                case 'player-move':
                    if (!this.inLobby && this.players.has(message.userId)) {
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                    }
                    break;
                // Update the player-hit case in handleGameMessage
                case 'player-hit':
                    // Remove the projectile for everyone
                    if (gameData.projectileId) {
                        this.projectiles.delete(gameData.projectileId);
                    }

                    if (gameData.targetId === this.userId) {
                        // I was hit - use the synchronized health value
                        this.myPlayer.health = gameData.newHealth;
                        console.log(`I was hit for ${gameData.damage} damage by ${gameData.shooterId}`);

                        // Check if I died
                        if (this.myPlayer.health <= 0) {
                            this.respawnPlayer();
                        }
                    } else if (this.players.has(gameData.targetId)) {
                        // Another player was hit, update their health
                        const hitPlayer = this.players.get(gameData.targetId)!;
                        hitPlayer.health = gameData.newHealth;
                        console.log(`Player ${hitPlayer.id} was hit for ${gameData.damage} damage`);

                        // If they died, they'll send a respawn message soon
                        if (hitPlayer.health <= 0) {
                            console.log(`Player ${hitPlayer.id} died`);
                        }
                    }
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

    private leaveRoom(): void {
        this.roomManager.leaveRoom();
        this.gameRunning = false;
        this.inLobby = false;
        this.isHost = false;
        this.players.clear();
        this.projectiles.clear();
        this.lobbyPlayers.clear();
        this.clearChat();
        this.showRoomControls();
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
        this.updateStartButton();
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
            playerDiv.className = 'lobby-player';

            const colorDiv = document.createElement('div');
            colorDiv.className = 'player-color';
            colorDiv.style.backgroundColor = player.color;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'player-name';
            nameDiv.textContent = `${player.id}${player.isHost ? ' (Host)' : ''}`;

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'player-controls';

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

    private updateStartButton(): void {
        if (!this.startGameBtn) return;

        this.startGameBtn.style.display = this.isHost ? 'block' : 'none';
        this.startGameBtn.disabled = this.lobbyPlayers.size < 1;
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
        messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;

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

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (!this.gameRunning) return;

        const key = e.key.toLowerCase();
        if (GAME.CONTROLS.includes(key)) {
            e.preventDefault();
            this.keys.add(key);
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        if (!this.gameRunning) return;

        const key = e.key.toLowerCase();
        if (GAME.CONTROLS.includes(key)) {
            e.preventDefault();
            this.keys.delete(key);
        }
    }

    private onMouseDown(e: MouseEvent): void {
        if (!this.gameRunning || !this.canvas) return;

        if (e.button === 0) { // Left mouse button
            this.isMouseDown = true;
            this.updateMousePosition(e);
        }
    }

    private onMouseUp(e: MouseEvent): void {
        if (!this.gameRunning) return;

        if (e.button === 0) { // Left mouse button
            this.isMouseDown = false;
            this.burstInProgress = false;
            this.currentBurstShot = 0;
        }
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.gameRunning) return;
        this.updateMousePosition(e);
    }

    private updateMousePosition(e: MouseEvent): void {
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
        if (!this.isMouseDown || !this.gameRunning) return;

        const currentTime = Date.now();

        // Check if we should start a new burst
        if (!this.burstInProgress && currentTime - this.lastBurstTime >= ATTACK_PARAMS.SHOT_DELAY) {
            this.burstInProgress = true;
            this.currentBurstShot = 0;
            this.nextBurstShotTime = currentTime;
            this.lastBurstTime = currentTime;
        }

        // Handle burst shooting
        if (this.burstInProgress && currentTime >= this.nextBurstShotTime) {
            this.launchProjectile();
            this.currentBurstShot++;

            if (this.currentBurstShot >= ATTACK_PARAMS.BURST_AMOUNT) {
                this.burstInProgress = false;
            } else {
                this.nextBurstShotTime = currentTime + ATTACK_PARAMS.BURST_DELAY;
            }
        }
    }

    private launchProjectile(): void {
        const dx = this.mouseX - this.myPlayer.x;
        const dy = this.mouseY - this.myPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Calculate spawn offset to prevent immediate collision
        const spawnOffset = PLAYER.STATS.SIZE + PROJECTILE.SIZE + this.projectileOffset;

        // Create projectiles based on PROJECTILE.AMOUNT with spread
        for (let i = 0; i < PROJECTILE.AMOUNT; i++) {
            const spread = (Math.random() - 0.5) * PROJECTILE.SPREAD;
            const angle = Math.atan2(dirY, dirX) + spread;

            const projectile: Projectile = {
                id: generateUID(),
                x: this.myPlayer.x + Math.cos(angle) * spawnOffset, // Spawn with offset
                y: this.myPlayer.y + Math.sin(angle) * spawnOffset, // Spawn with offset
                velocityX: Math.cos(angle) * PROJECTILE.SPEED,
                velocityY: Math.sin(angle) * PROJECTILE.SPEED,
                range: PROJECTILE.RANGE,
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

            // Check collision with my player
            const dx = projectile.x - this.myPlayer.x;
            const dy = projectile.y - this.myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= PLAYER.STATS.SIZE + PROJECTILE.SIZE) {
                // Hit! Take damage and remove projectile
                this.myPlayer.health -= PROJECTILE.DAMAGE;
                projectilesToRemove.push(id);

                // Notify everyone I was hit (including my new health)
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'player-hit',
                    targetId: this.userId,
                    shooterId: projectile.ownerId,
                    damage: PROJECTILE.DAMAGE,
                    newHealth: this.myPlayer.health,
                    projectileId: id
                }));

                // Check if I died
                if (this.myPlayer.health <= 0) {
                    this.respawnPlayer();
                }
            }

            // Check collision with other players (for my projectiles only)
            if (projectile.ownerId === this.userId) {
                this.players.forEach((player, playerId) => {
                    const dx2 = projectile.x - player.x;
                    const dy2 = projectile.y - player.y;
                    const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                    if (distance2 <= PLAYER.STATS.SIZE + PROJECTILE.SIZE) {
                        // Hit another player!
                        projectilesToRemove.push(id);

                        // Calculate their new health
                        const newHealth = Math.max(0, player.health - PROJECTILE.DAMAGE);

                        // UPDATE THEIR HEALTH LOCALLY - ADD THIS LINE
                        player.health = newHealth;

                        // Notify everyone about the hit
                        this.roomManager.sendMessage(JSON.stringify({
                            type: 'player-hit',
                            targetId: playerId,
                            shooterId: this.userId,
                            damage: PROJECTILE.DAMAGE,
                            newHealth: newHealth,
                            projectileId: id
                        }));
                    }
                });
            }

            // Check if projectile should be removed (range/bounds)
            if (projectile.distanceTraveled >= projectile.range ||
                projectile.x < 0 || projectile.x > CANVAS.WIDTH ||
                projectile.y < 0 || projectile.y > CANVAS.HEIGHT) {
                projectilesToRemove.push(id);

                // Notify others to remove out-of-bounds projectile if it's mine
                if (projectile.ownerId === this.userId) {
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
    //
    // #endregion

    // #region [ Player ]
    //
    private updatePlayerPosition(): void {
        if (!this.gameRunning) return;

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
        const targetVelocityX = inputX * PLAYER.PHYSICS.MAX_SPEED;
        const targetVelocityY = inputY * PLAYER.PHYSICS.MAX_SPEED;

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

        if (newX >= PLAYER.BORDER_MARGIN && newX <= CANVAS.WIDTH - PLAYER.BORDER_MARGIN) {
            this.myPlayer.x = newX;
            moved = true;
        } else {
            this.playerVelocityX = 0;
        }

        if (newY >= PLAYER.BORDER_MARGIN && newY <= CANVAS.HEIGHT - PLAYER.BORDER_MARGIN) {
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

    private respawnPlayer(): void {
        console.log('I died! Respawning...');

        // Reset health and position
        this.myPlayer.health = PLAYER.STATS.HEALTH;
        this.myPlayer.x = Math.random() * (CANVAS.WIDTH - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN;
        this.myPlayer.y = Math.random() * (CANVAS.HEIGHT - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN;

        // Notify others of respawn - ADD THIS
        this.roomManager.sendMessage(JSON.stringify({
            type: 'player-respawn',
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            health: this.myPlayer.health
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
        if (!this.gameRunning || !this.ctx || !this.canvas) return;

        // Update
        this.updatePlayerPosition();
        this.updateAttack();
        this.updateProjectiles();

        // Clear canvas - use clearRect instead of fillRect to show CSS background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

    // #region [ Rendering ]
    //
    private drawPlayer(player: Player, isMe: boolean = false): void {
        if (!this.ctx) return;

        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, PLAYER.STATS.SIZE, 0, 2 * Math.PI);
        this.ctx.fillStyle = player.color;
        this.ctx.fill();

        if (isMe) {
            this.ctx.strokeStyle = UI.TEXT_COLOR;
            this.ctx.lineWidth = PLAYER.STROKE_WIDTH;
            this.ctx.stroke();
        }

        // Draw player ID and health
        this.ctx.fillStyle = UI.TEXT_COLOR;
        this.ctx.font = UI.FONT;
        this.ctx.textAlign = 'center';

        const displayName = isMe ? 'You' : player.id.substring(4, 10);
        const healthText = `${displayName} (${player.health}HP)`;

        this.ctx.fillText(
            healthText,
            player.x,
            player.y - PLAYER.ID_DISPLAY_OFFSET
        );
    }

    private drawProjectile(projectile: Projectile): void {
        if (!this.ctx) return;

        this.ctx.beginPath();
        this.ctx.arc(projectile.x, projectile.y, PROJECTILE.SIZE, 0, 2 * Math.PI);
        this.ctx.fillStyle = PROJECTILE.COLOR;
        this.ctx.fill();
    }
    //
    // #endregion

    // #region [ UI ]
    //
    private updateDisplay(target: "lobby" | "room" | "game", roomId?: string): void {
        if (!this.roomControls || !this.lobbyContainer || !this.gameContainer || !this.chatContainer) return;

        // Hide all
        this.roomControls.style.display = "none";
        this.lobbyContainer.style.display = "none";
        this.gameContainer.style.display = "none";
        this.chatContainer.style.display = "none";

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
                if (roomId) {
                    const gameRoomId = document.getElementById("gameRoomId");
                    if (gameRoomId) gameRoomId.textContent = roomId;
                }
                this.inLobby = false;
                break;
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