import { generateUID, getRoomIdFromURL } from './utils';
import { RoomManager, RoomMessage } from './roomManager';

class ChatClient {
  private ws: WebSocket | null = null;
  private userId: string;
  private roomManager: RoomManager;
  private messagesList: HTMLUListElement | null = null;
  private messageInput: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private roomControls: HTMLDivElement | null = null;
  private chatContainer: HTMLDivElement | null = null;
  private userIdDisplay: HTMLSpanElement | null = null;
  private roomIdDisplay: HTMLSpanElement | null = null;
  private roomLinkDisplay: HTMLInputElement | null = null;

  constructor() {
    this.userId = generateUID();
    this.roomManager = new RoomManager(this.userId);
    
    // Wait for DOM to be ready
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
    this.messagesList = document.getElementById("messages") as HTMLUListElement;
    this.messageInput = document.getElementById("msg") as HTMLInputElement;
    this.sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
    this.roomControls = document.getElementById("roomControls") as HTMLDivElement;
    this.chatContainer = document.getElementById("chatContainer") as HTMLDivElement;
    this.userIdDisplay = document.getElementById("userId") as HTMLSpanElement;
    this.roomIdDisplay = document.getElementById("roomId") as HTMLSpanElement;
    this.roomLinkDisplay = document.getElementById("roomLink") as HTMLInputElement;

    // Verify all elements exist
    if (!this.messagesList || !this.messageInput || !this.sendBtn || 
        !this.roomControls || !this.chatContainer || !this.userIdDisplay || 
        !this.roomIdDisplay || !this.roomLinkDisplay) {
      console.error('Some required DOM elements are missing');
      return;
    }

    this.userIdDisplay.textContent = this.userId;
    this.showRoomControls();
  }

  private setupEventListeners(): void {
    if (!this.sendBtn || !this.messageInput) return;

    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.sendMessage();
    });

    // Room control buttons
    document.getElementById("hostBtn")?.addEventListener("click", () => this.hostRoom());
    document.getElementById("joinBtn")?.addEventListener("click", () => this.joinRoom());
    document.getElementById("leaveBtn")?.addEventListener("click", () => this.leaveRoom());
    document.getElementById("copyLinkBtn")?.addEventListener("click", () => this.copyRoomLink());

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
      setTimeout(() => this.connectWebSocket(), 3000); // Auto-reconnect
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  private checkForRoomInURL(): void {
    const roomId = getRoomIdFromURL();
    if (roomId) {
      this.connectWebSocket();
      // Wait for connection then join room
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
        this.showChatContainer(roomId);
      }, 1000);
    } else {
      const roomId = this.roomManager.createRoom();
      this.showChatContainer(roomId);
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
          this.showChatContainer(roomId);
        }, 1000);
      } else {
        this.roomManager.joinRoom(roomId);
        this.showChatContainer(roomId);
      }
    } catch (error) {
      alert("Invalid room link format");
    }
  }

  private leaveRoom(): void {
    this.roomManager.leaveRoom();
    this.showRoomControls();
  }

  private sendMessage(): void {
    if (!this.messageInput) return;
    
    const message = this.messageInput.value.trim();
    if (message) {
      this.roomManager.sendMessage(message);
      this.messageInput.value = "";
    }
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
        // Fallback for modern browsers
        navigator.clipboard?.writeText(link).then(() => {
          alert("Room link copied to clipboard!");
        }).catch(() => {
          alert("Could not copy to clipboard. Please copy manually.");
        });
      }
    }
  }

  private handleRoomMessage(message: RoomMessage): void {
    if (!this.messagesList) return;

    const li = document.createElement("li");
    
    switch (message.type) {
      case 'room-created':
        li.textContent = `Room created! Share this link: ${this.roomManager.getRoomLink()}`;
        li.className = 'system-message';
        break;
      case 'room-joined':
        li.textContent = `Joined room: ${message.roomId}`;
        li.className = 'system-message';
        break;
      case 'user-joined':
        li.textContent = `User ${message.userId} joined the room`;
        li.className = 'system-message';
        break;
      case 'user-left':
        li.textContent = `User ${message.userId} left the room`;
        li.className = 'system-message';
        break;
      case 'room-message':
        const isOwnMessage = message.userId === this.userId;
        li.textContent = `${isOwnMessage ? 'You' : message.userId}: ${message.message}`;
        li.className = isOwnMessage ? 'own-message' : 'other-message';
        break;
      case 'room-error':
        li.textContent = `Error: ${message.message}`;
        li.className = 'error-message';
        break;
      default:
        li.textContent = message.message || '';
    }

    this.messagesList.appendChild(li);
    this.messagesList.scrollTop = this.messagesList.scrollHeight;
  }

  private showRoomControls(): void {
    if (this.roomControls && this.chatContainer) {
      this.roomControls.style.display = 'block';
      this.chatContainer.style.display = 'none';
    }
  }

  private showChatContainer(roomId: string): void {
    if (this.roomControls && this.chatContainer && this.roomIdDisplay && this.roomLinkDisplay) {
      this.roomControls.style.display = 'none';
      this.chatContainer.style.display = 'block';
      this.roomIdDisplay.textContent = roomId;
      this.roomLinkDisplay.value = this.roomManager.getRoomLink() || '';
    }
  }
}

// Initialize the chat client when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ChatClient();
  });
} else {
  new ChatClient();
}