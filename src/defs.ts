export type Vec2 = { x: number, y: number }

export type Transform = {
  pos: Vec2;
  rot: number;
}

export interface GameObject {
  id: string;
  transform: Transform;
  timestamp: number;
}

export interface Player extends GameObject {
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
      projectile: {
        amount: number;
        color: string;
        damage: number;
        length: number;
        range: number;
        size: number;
        speed: number;
        spread: number;
        unique: string[];
      }
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
    luck: number;
    size: number;
    speed: number;
    stamina: {
      max: number;
      recovery: {
        delay: number;
        rate: number;
      }
      value: number;
    }
  }
}

export interface Projectile extends GameObject {
  color: string;
  damage: number;
  distanceTraveled: number;
  length: number;
  ownerId: string;
  range: number;
  size: number;
  velocity: Vec2;
}

export interface AmmoBox extends GameObject {
  ammoAmount: number;
  isOpen: boolean;
  lid: {
    pos: Vec2;
    rot: number;
    velocity: Vec2;
    torque: number;
  };
}

export interface RoomMessage {
  type: 'join-room' | 'create-room' | 'leave-room' | 'room-message' | 'room-created' | 'room-joined' | 'room-joined-game' | 'room-error' | 'user-joined' | 'user-left';
  roomId?: string;
  userId: string;
  message?: string;
  data?: any;
  gameActive?: boolean;
}

export interface LobbyPlayer { // TODO: Consider just merging this into the standard player
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

export type ResetType = 'Room' | 'Lobby'