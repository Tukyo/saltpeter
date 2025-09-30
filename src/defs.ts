export interface Player {
  id: string;
  transform: Transform;
  color: string;
  actions: {
    dash: {
      drain: number;
      cooldown: number;
      multiplier: number;
      time: number;
    }
    primary: {
      buffer: number;
      burst: {
        amount: number;
        delay: number;
      }
      magazine: {
        currentAmmo: number;
        currentReserve: number;
        maxReserve: number;
        size: number;
      }
      offset: number;
      reload: { time: number; }
    }
    sprint: {
      drain: number;
      multiplier: number;
    }
  }
  equipment: {
    crosshair: boolean;
  }
  physics: {
    acceleration: number;
    friction: number;
  }
  stats: {
    health: {
      max: number;
      value: number;
    }
    stamina: {
      max: number;
      recovery: {
        delay: number;
        rate: number;
      }
      value: number;
    }
    luck: number;
    size: number;
    speed: number;
  }
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

export interface AmmoBox {
  id: string;
  x: number;
  y: number;
  ammoAmount: number;
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

export type Transform = {
  pos: Vec2;
  rot: number;
}

export type Vec2 = { x: number, y: number }