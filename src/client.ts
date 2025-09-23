import { generateUID, getRoomIdFromURL } from './utils';
import { RoomManager, RoomMessage } from './roomManager';

interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
}

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
  private myPlayer: Player;
  private keys: Set<string> = new Set();
  private gameRunning = false;

  constructor() {
    this.userId = generateUID();
    this.roomManager = new RoomManager(this.userId);
    
    // Initialize my player
    this.myPlayer = {
      id: this.userId,
      x: Math.random() * 760 + 20, // Random position within canvas bounds
      y: Math.random() * 560 + 20,
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
      setTimeout(() => this.connectWebSocket(), 3000);
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
      }, 1000);
    }
  }

  private hostRoom(): void {
    if (!this.ws) {
      this.connectWebSocket();
      setTimeout(() => {
        const roomId = this.roomManager.createRoom();
        this.showGameContainer(roomId);
      }, 1000);
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
        }, 1000);
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
    if (['w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
      this.keys.add(key);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.gameRunning) return;
    
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
      this.keys.delete(key);
    }
  }

  private updatePlayerPosition(): void {
    if (!this.gameRunning) return;

    const speed = 5;
    let moved = false;
    
    if (this.keys.has('w') && this.myPlayer.y > 15) {
      this.myPlayer.y -= speed;
      moved = true;
    }
    if (this.keys.has('s') && this.myPlayer.y < 585) {
      this.myPlayer.y += speed;
      moved = true;
    }
    if (this.keys.has('a') && this.myPlayer.x > 15) {
      this.myPlayer.x -= speed;
      moved = true;
    }
    if (this.keys.has('d') && this.myPlayer.x < 785) {
      this.myPlayer.x += speed;
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

    // Clear canvas
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw border
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

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
    this.ctx.arc(player.x, player.y, 15, 0, 2 * Math.PI);
    this.ctx.fillStyle = player.color;
    this.ctx.fill();
    
    if (isMe) {
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }
    
    // Draw player ID
    this.ctx.fillStyle = '#000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(isMe ? 'You' : player.id.substring(0, 6), player.x, player.y - 25);
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
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