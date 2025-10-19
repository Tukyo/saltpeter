import { ROOM } from './Config';
import { RoomMessage } from './Types';

import { Utility } from './Utility';

export class RoomManager {
  private currentRoom: string | null = null;
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: RoomMessage) => void)[] = [];

  public isPrivateRoom = false;

  constructor(private userId: string, private utility: Utility) { }

  /**
   * Assigns the active WebSocket connection and sets up message handling.
   */
  public setWebSocket(ws: WebSocket): void {
    this.ws = ws;
    this.setupMessageHandler();
  }

  /**
   * Creates a new room and automatically joins it as the host.
   */
  public createRoom(): string | null {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      alert('Cannot create room: Not connected to server. Please refresh the page.');
      return null;
    }

    const roomId = this.utility.generateUID(ROOM.ID_LENGTH, ROOM.ID_PREFIX);
    this.joinRoom(roomId, true);
    return roomId;
  }

  /**
   * Joins an existing room or creates one if isHost is true.
   */
  public joinRoom(roomId: string, isHost: boolean = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      alert('Cannot join room: Not connected to server. Please refresh the page.');
      return;
    }

    const message: RoomMessage = {
      type: isHost ? 'create-room' : 'join-room',
      roomId,
      userId: this.userId
    };

    this.ws.send(JSON.stringify(message));
    this.currentRoom = roomId;
    this.utility.generateLink(roomId, 'room');
  }

  /**
   * Leaves the current room and resets the client state.
   */
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

  /**
   * Returns the ID of the current active room.
   */
  public sendMessage(text: string): void {
    if (!this.currentRoom || !this.ws) return;

    if (this.ws.readyState !== WebSocket.OPEN) {
      alert('Cannot send message: Not connected to server. Please refresh the page.');
      return;
    }

    const message: RoomMessage = {
      type: 'room-message',
      roomId: this.currentRoom,
      userId: this.userId,
      message: text
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Sends an admin command from the frontend to backend.
   */
  public sendAdminCommand(command: string, key: string): void {
    if (!this.ws) return;

    const message = {
      type: 'admin-command',
      id: command,
      key: key,
      userId: this.userId
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Returns the ID of the current active room.
   */
  public getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  /**
   * Generates a shareable link for the current room.
   */
  public getRoomLink(param?: string): string | null {
    return this.currentRoom ? this.utility.generateLink(this.currentRoom, param) : null;
  }

  /**
   * Registers a callback to handle incoming room messages.
   */
  public onMessage(handler: (message: RoomMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Processes incoming WebSocket messages and dispatches them to all handlers.
   */
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
