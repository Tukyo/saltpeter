export interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
  health: number;
  rotation?: number;
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

export interface RoomMessage {
  type: 'join-room' | 'create-room' | 'leave-room' | 'room-message' | 'room-created' | 'room-joined' | 'room-joined-game' | 'room-error' | 'user-joined' | 'user-left';
  roomId?: string;
  userId: string;
  message?: string;
  data?: any;
  gameActive?: boolean;
}

export interface LobbyPlayer {
  id: string;
  color: string;
  isHost: boolean;
}

export interface LeaderboardEntry {
    playerId: string;
    kills: number;
    deaths: number;
    wins: number;
}

export type Leaderboard = Map<string, LeaderboardEntry>;