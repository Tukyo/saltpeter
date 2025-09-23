import { generateUID, getRoomIdFromURL } from './utils';
import { RoomManager } from './roomManager';
import { Player, RoomMessage, Projectile } from './defs';
import { PLAYER, CANVAS, GAME, UI, PROJECTILE, ATTACK_PARAMS } from './config';

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
    private roomLinkDisplay: HTMLInputElement | null = null;

    private players: Map<string, Player> = new Map();
    private projectiles: Map<string, Projectile> = new Map();
    private myPlayer: Player;
    private keys: Set<string> = new Set();
    private gameRunning = false;
    
    // Shooting mechanics
    private isMouseDown = false;
    private mouseX = 0;
    private mouseY = 0;
    private lastBurstTime = 0;
    private currentBurstShot = 0;
    private burstInProgress = false;
    private nextBurstShotTime = 0;

    constructor() {
        this.userId = generateUID();
        this.roomManager = new RoomManager(this.userId);

        this.myPlayer = {
            id: this.userId,
            x: Math.random() * (CANVAS.WIDTH - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN,
            y: Math.random() * (CANVAS.HEIGHT - PLAYER.BORDER_MARGIN * 2) + PLAYER.BORDER_MARGIN,
            color: this.getRandomColor()
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
        this.userIdDisplay = document.getElementById("userId") as HTMLSpanElement;
        this.roomIdDisplay = document.getElementById("roomId") as HTMLSpanElement;
        this.roomLinkDisplay = document.getElementById("roomLink") as HTMLInputElement;

        if (!this.canvas || !this.roomControls || !this.gameContainer ||
            !this.userIdDisplay || !this.roomIdDisplay || !this.roomLinkDisplay) {
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

    private setupEventListeners(): void {
        // Room control buttons
        document.getElementById("hostBtn")?.addEventListener("click", () => this.hostRoom());
        document.getElementById("joinBtn")?.addEventListener("click", () => this.joinRoom());
        document.getElementById("leaveBtn")?.addEventListener("click", () => this.leaveRoom());
        document.getElementById("copyLinkBtn")?.addEventListener("click", () => this.copyRoomLink());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse controls for shooting
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Room manager message handler
        this.roomManager.onMessage((message) => this.handleRoomMessage(message));
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

    private checkForRoomInURL(): void {
        const roomId = getRoomIdFromURL();
        if (roomId) {
            this.connectWebSocket();
            setTimeout(() => {
                this.roomManager.joinRoom(roomId);
            }, GAME.CONNECTION_TIMEOUT);
        }
    }

    private hostRoom(): void {
        if (!this.ws) {
            this.connectWebSocket();
            setTimeout(() => {
                const roomId = this.roomManager.createRoom();
                this.showGameContainer(roomId);
            }, GAME.CONNECTION_TIMEOUT);
        } else {
            const roomId = this.roomManager.createRoom();
            this.showGameContainer(roomId);
        }
    }

    private joinRoom(): void {
        const roomLink = prompt("Enter room link:");
        if (!roomLink) return;

        try {
            const url = new URL(roomLink);
            const roomId = new URLSearchParams(url.search).get('room');

            if (!roomId) {
                alert("Invalid room link");
                return;
            }

            if (!this.ws) {
                this.connectWebSocket();
                setTimeout(() => {
                    this.roomManager.joinRoom(roomId);
                    this.showGameContainer(roomId);
                }, GAME.CONNECTION_TIMEOUT);
            } else {
                this.roomManager.joinRoom(roomId);
                this.showGameContainer(roomId);
            }
        } catch (error) {
            alert("Invalid room link format");
        }
    }

    private leaveRoom(): void {
        this.roomManager.leaveRoom();
        this.gameRunning = false;
        this.players.clear();
        this.projectiles.clear();
        this.showRoomControls();
    }

    private copyRoomLink(): void {
        const link = this.roomManager.getRoomLink();
        if (link && this.roomLinkDisplay) {
            this.roomLinkDisplay.value = link;
            this.roomLinkDisplay.select();

            try {
                document.execCommand('copy');
                alert("Room link copied to clipboard!");
            } catch (error) {
                navigator.clipboard?.writeText(link).then(() => {
                    alert("Room link copied to clipboard!");
                }).catch(() => {
                    alert("Could not copy to clipboard. Please copy manually.");
                });
            }
        }
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

    private updateShooting(): void {
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

        if (distance === 0) return; // Avoid division by zero

        // Normalize direction
        const dirX = dx / distance;
        const dirY = dy / distance;

        // Create projectiles based on PROJECTILE.AMOUNT with spread
        for (let i = 0; i < PROJECTILE.AMOUNT; i++) {
            const spread = (Math.random() - 0.5) * PROJECTILE.SPREAD;
            const angle = Math.atan2(dirY, dirX) + spread;
            
            const projectile: Projectile = {
                id: generateUID(),
                x: this.myPlayer.x,
                y: this.myPlayer.y,
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
            // Update position
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;
            
            // Update distance traveled
            const frameDistance = Math.sqrt(
                projectile.velocityX * projectile.velocityX + 
                projectile.velocityY * projectile.velocityY
            );
            projectile.distanceTraveled += frameDistance;

            // Check if projectile should be removed
            if (projectile.distanceTraveled >= projectile.range ||
                projectile.x < 0 || projectile.x > CANVAS.WIDTH ||
                projectile.y < 0 || projectile.y > CANVAS.HEIGHT) {
                projectilesToRemove.push(id);
            }
        });

        // Remove expired projectiles
        projectilesToRemove.forEach(id => {
            this.projectiles.delete(id);
            
            // Notify other players if it's my projectile
            const projectile = this.projectiles.get(id);
            if (projectile && projectile.ownerId === this.userId) {
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'projectile-remove',
                    projectileId: id
                }));
            }
        });
    }

    private updatePlayerPosition(): void {
        if (!this.gameRunning) return;

        let moved = false;

        if (this.keys.has('w') && this.myPlayer.y > PLAYER.BORDER_MARGIN) {
            this.myPlayer.y -= PLAYER.SPEED;
            moved = true;
        }
        if (this.keys.has('s') && this.myPlayer.y < CANVAS.HEIGHT - PLAYER.BORDER_MARGIN) {
            this.myPlayer.y += PLAYER.SPEED;
            moved = true;
        }
        if (this.keys.has('a') && this.myPlayer.x > PLAYER.BORDER_MARGIN) {
            this.myPlayer.x -= PLAYER.SPEED;
            moved = true;
        }
        if (this.keys.has('d') && this.myPlayer.x < CANVAS.WIDTH - PLAYER.BORDER_MARGIN) {
            this.myPlayer.x += PLAYER.SPEED;
            moved = true;
        }

        if (moved) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                x: this.myPlayer.x,
                y: this.myPlayer.y
            }));
        }
    }

    private handleRoomMessage(message: RoomMessage): void {
        switch (message.type) {
            case 'room-created':
                console.log('Room created');
                this.startGame();
                break;
            case 'room-joined':
                console.log('Joined room');
                this.startGame();
                // Send my initial position
                this.roomManager.sendMessage(JSON.stringify({
                    type: 'player-join',
                    x: this.myPlayer.x,
                    y: this.myPlayer.y,
                    color: this.myPlayer.color
                }));
                break;
            case 'user-joined':
                console.log(`User ${message.userId} joined`);
                break;
            case 'user-left':
                console.log(`User ${message.userId} left`);
                this.players.delete(message.userId);
                // Remove projectiles from disconnected player
                this.projectiles.forEach((projectile, id) => {
                    if (projectile.ownerId === message.userId) {
                        this.projectiles.delete(id);
                    }
                });
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
                case 'player-join':
                    this.players.set(message.userId, {
                        id: message.userId,
                        x: gameData.x,
                        y: gameData.y,
                        color: gameData.color
                    });
                    // Send my position to the new player
                    this.roomManager.sendMessage(JSON.stringify({
                        type: 'player-join',
                        x: this.myPlayer.x,
                        y: this.myPlayer.y,
                        color: this.myPlayer.color
                    }));
                    break;
                case 'player-move':
                    if (this.players.has(message.userId)) {
                        const player = this.players.get(message.userId)!;
                        player.x = gameData.x;
                        player.y = gameData.y;
                    }
                    break;
                case 'projectile-launch':
                    if (message.userId !== this.userId) {
                        this.projectiles.set(gameData.projectile.id, gameData.projectile);
                    }
                    break;
                case 'projectile-remove':
                    this.projectiles.delete(gameData.projectileId);
                    break;
            }
        } catch (error) {
            console.error('Error parsing game message:', error);
        }
    }

    private startGame(): void {
        this.gameRunning = true;
        this.gameLoop();
    }

    private gameLoop(): void {
        if (!this.gameRunning || !this.ctx || !this.canvas) return;

        // Update
        this.updatePlayerPosition();
        this.updateShooting();
        this.updateProjectiles();

        // Clear canvas
        this.ctx.fillStyle = CANVAS.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

    private drawPlayer(player: Player, isMe: boolean = false): void {
        if (!this.ctx) return;

        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, PLAYER.RADIUS, 0, 2 * Math.PI);
        this.ctx.fillStyle = player.color;
        this.ctx.fill();

        if (isMe) {
            this.ctx.strokeStyle = UI.TEXT_COLOR;
            this.ctx.lineWidth = PLAYER.STROKE_WIDTH;
            this.ctx.stroke();
        }

        // Draw player ID
        this.ctx.fillStyle = UI.TEXT_COLOR;
        this.ctx.font = UI.FONT;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            isMe ? 'You' : player.id.substring(0, UI.PLAYER_ID_LENGTH),
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

    private getRandomColor(): string {
        return PLAYER.COLORS[Math.floor(Math.random() * PLAYER.COLORS.length)];
    }

    private showRoomControls(): void {
        if (this.roomControls && this.gameContainer) {
            this.roomControls.style.display = 'block';
            this.gameContainer.style.display = 'none';
        }
    }

    private showGameContainer(roomId: string): void {
        if (this.roomControls && this.gameContainer && this.roomIdDisplay && this.roomLinkDisplay) {
            this.roomControls.style.display = 'none';
            this.gameContainer.style.display = 'block';
            this.roomIdDisplay.textContent = roomId;
            this.roomLinkDisplay.value = this.roomManager.getRoomLink() || '';
        }
    }
}

// Initialize the game client
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GameClient();
    });
} else {
    new GameClient();
}