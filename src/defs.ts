export interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  range: number;
  distanceTraveled: number;
  ownerId: string;
  timestamp: number;
}

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