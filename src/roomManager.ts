import { generateRoomId, createRoomLink, updateURLWithRoom } from './utils';

export interface Room {
  id: string;
  hostUserId: string;
  participants: string[];
  createdAt: Date;
}

export interface RoomMessage {
  type: 'join-room' | 'create-room' | 'leave-room' | 'room-message' | 'room-created' | 'room-joined' | 'room-error' | 'user-joined' | 'user-left';
  roomId?: string;
  userId: string;
  message?: string;
  data?: any;
}

export class RoomManager {
  private currentRoom: string | null = null;
  private userId: string;
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: RoomMessage) => void)[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  public setWebSocket(ws: WebSocket): void {
    this.ws = ws;
    this.setupMessageHandler();
  }

  public createRoom(): string {
    const roomId = generateRoomId();
    this.joinRoom(roomId, true);
    return roomId;
  }

  public joinRoom(roomId: string, isHost: boolean = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message: RoomMessage = {
      type: isHost ? 'create-room' : 'join-room',
      roomId,
      userId: this.userId
    };

    this.ws.send(JSON.stringify(message));
    this.currentRoom = roomId;
    updateURLWithRoom(roomId);
  }

  public leaveRoom(): void {
    if (!this.currentRoom || !this.ws) return;

    const message: RoomMessage = {
      type: 'leave-room',
      roomId: this.currentRoom,
      userId: this.userId
    };

    this.ws.send(JSON.stringify(message));
    this.currentRoom = null;
    window.history.pushState({}, '', window.location.origin);
  }

  public sendMessage(text: string): void {
    if (!this.currentRoom || !this.ws) return;

    const message: RoomMessage = {
      type: 'room-message',
      roomId: this.currentRoom,
      userId: this.userId,
      message: text
    };

    this.ws.send(JSON.stringify(message));
  }

  public getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  public getRoomLink(): string | null {
    return this.currentRoom ? createRoomLink(this.currentRoom) : null;
  }

  public onMessage(handler: (message: RoomMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  private setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const message: RoomMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        // Handle plain text messages (backwards compatibility)
        const plainMessage: RoomMessage = {
          type: 'room-message',
          userId: 'server',
          message: event.data
        };
        this.messageHandlers.forEach(handler => handler(plainMessage));
      }
    };
  }
}