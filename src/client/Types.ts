import { LobbyManager } from "./LobbyManager";
import { UserInterface } from "./UserInterface";
import { Utility } from "./Utility";

import { PlayerState } from "./player/PlayerState";

// #region [ Core ]
//
/**
 * Represents a 2D vector with x and y coordinates.
 */
export type Vec2 = { x: number, y: number }

/**
 * Represents an object's position and rotation in 2D space.
 */
export type Transform = {
  pos: Vec2;
  rot: number;
}

/**
 * Represents a directional relationship between two points in 2D space.
 */
export type Direction = { rootPos: Vec2; targetPos: Vec2; };
//
// #endregion

// #region [ Game Object ]
/**
 * Base interface for all game world entities.
 * Includes a unique ID, transform data, and a timestamp for synchronization.
 */
export interface GameObject {
  id: string;
  transform: Transform;
  timestamp: number;
}

/**
 * All gameobject types.
 */
export type ObjectType = 'AmmoBox' | 'Player' | 'Projectile';

/**
 * Mapping definition for stored player objects.
 */
export type Players = Map<string, Player>;

/**
 * Full representation of the player object. Extends GameObject.
 */
export interface Player extends GameObject {
  actions: {
    dash: {
      drain: number;
      cooldown: number;
      multiplier: number;
      time: number;
    }
    melee: {
      cooldown: number;
      damage: number;
      duration: number;
      range: number;
      size: number;
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
      }
      reload: { time: number; }
    }
    sprint: {
      drain: number;
      multiplier: number;
    }
  }
  color: string;
  equipment: string[],
  flags: {
    hidden: boolean;
    invulnerable: boolean;
  }
  inventory: {
    primary: string;
    melee: string;
  }
  physics: {
    acceleration: number;
    friction: number;
  }
  rig: {
    body: string;
    head: string;
    headwear: string;
    weapon: string;
  }
  stats: {
    defense: number;
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
  unique: string[];
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

export type ProjectileOverrides = {
  canTriggerUnique?: boolean;
  bypassDefault?: boolean;
  color?: string;
  damage?: number;
  length?: number;
  range?: number;
  size?: number;
  speed?: number;
  spread?: number;
  amount?: number;
};

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

export interface SpawnObjectParams {
  transform: Transform;
  type: ObjectType;
  data?: any;
}
//
// #endregion

// #region [ Animation ]
//
export interface PlayerPartAnimParams {
  playerId: string;
  part: string;
  frames: { [key: number]: { x: number, y: number } };
  duration: number;
  partIndex?: number;
}

export type TextAnimParams = {
  element: HTMLElement;
  oldValue: number;
  newValue: number;
  decimals: number;
  animTime: number;
  steps: number;
  color: string;
  timeout: number;
}
//
// #endregion

// #region [ Audio ]
//
export interface AudioParams {
  delay?: {
    min: number;
    max: number;
  }
  listener: Vec2;
  loop?: boolean;
  output?: string;
  priority?: number;
  pitch?: {
    min: number;
    max: number;
  };
  spatial?: {
    blend?: number;
    pos?: Vec2;
    rolloff?: {
      distance: number;
      factor: number;
      type?: 'linear' | 'logarithmic';
    }
  }
  src: string;
  volume?: {
    min: number;
    max: number;
  };
}
//
// #endregion

// #region [ Lobby & Room ]
//
export type ResetType = 'Room' | 'Lobby'

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
  rig: {
    body: string;
    head: string;
    headwear: string;
    weapon: string;
  }
  transform: Transform;
}

export type LobbyControlsParams = {
  lobby: LobbyManager;
  lobbyOptions: LobbyOptionsParams;
  myPlayer: Player;
  roomId: string;
  userId: string;
}

export type LobbyOptionsParams = {
  maxPlayers: number;
  maxWins: number;
  isHost: boolean;
  privateRoom: boolean;
  upgradesEnabled: boolean;
}

export type ChatMessage = {
  senderId: string;
  message: string;
  isOwn?: boolean;
};
//
// #endregion

// #region [ Settings ]
//
export interface GameSettings {
  audio: {
    mixer: {
      master: number;
      interface: number;
      music: number;
      sfx: number;
      voice: number;
    }
  }
  controls: {
    keybinds: {
      attack: string;
      dash: string;
      melee: string;
      moveDown: string;
      moveLeft: string;
      moveRight: string;
      moveUp: string;
      reload: string;
      sprint: string;
    },
    gamepad: {
      attack: number;
      dash: number;
      deadzone: number;
      melee: number;
      reload: number;
      sprint: number;
    }
  }
  graphics: {
    physics: {
      ammoReserves: boolean;
    }
    renderBackgroundParticles: boolean;
    showStaticOverlay: boolean;
  }
}
//
// #endregion

// #region [ Params ]
//
export type RandomColorParams = {
  format: 'hex' | 'rgb';
  mode: 'any' | 'primary' | 'pastel' | 'vibrant' | 'dark' | 'light' | 'grayscale';

}

export type SetInputParams = {
  inputId: string;
  value: number;
}

export type SetSliderParams = {
  sliderId: string;
  targetValue: number;
  maxValue: number;
  lerpTime?: number;
}

export type SetSpanParams = {
  spanId: string;
  value: string | number;
}

export type SetToggleParams = {
  toggleId: string;
  value: boolean;
}

export type PlayerHitParams = {
  target: Player;
  shooterId: string;
  damage: number;
  newHealth: number;
  source: Projectile | ShrapnelPiece;
  wasKill: boolean;
}
//
// #endregion

// #region [ Leaderboard ]
//
export interface LeaderboardEntry {
  playerId: string;
  kills: number;
  deaths: number;
  wins: number;
}

export type Leaderboard = Map<string, LeaderboardEntry>;
//
// #endregion

// #region [ Combat ]
//
export type AttackType = 'melee' | 'ranged';
//
// #endregion

// #region [ Visual ]
//
export type CreateParticleParams = {
  id: string;
  pos: Vec2;
  particleParams: ParticleParams;
  direction?: Vec2;
}

export type ParticleParams = {
  count: {
    min: number;
    max: number;
  };
  lifetime: {
    min: number;
    max: number;
  };
  noise: {
    strength: {
      min: number;
      max: number;
    };
    scale: {
      min: number;
      max: number;
    };
  };
  opacity: {
    min: number;
    max: number;
  };
  speed: {
    min: number;
    max: number;
  };
  sizeOverLifetime: {
    min: number;
    max: number;
  };
  size: {
    min: number;
    max: number;
  };
  torque: {
    min: number;
    max: number;
  };
  collide: boolean;
  fade: boolean;
  paint: boolean;
  spread: number;
  stain: boolean;
  colors: string[];
};

export type Particle = {
  age: number;
  collide: boolean;
  color: string;
  fade: boolean;
  hasCollided: boolean;
  id: string;
  initialSize: number;
  lifetime: number;
  maxOpacity: number;
  noiseStrength: number;
  noiseScale: number;
  opacity: number;
  paint: boolean;
  pos: Vec2;
  rotation: number;
  size: number;
  sizeOverLifetime: number;
  stain: boolean;
  torque: number;
  velocity: Vec2
}

export type EmitterParams = {
  type?: string;
  id: string;
  interval: number;
  lifetime: number;
  offset: Vec2;
  playerId: string;
  pos: Vec2;
  particleType: ParticleParams;
}

export type Emitter = {
  age: number;
  direction: number;
  emissionInterval: number;
  lastEmission: number;
  lifetime: number;
  offset: Vec2;
  playerId: string;
  particleType: ParticleParams;
}

export type Decal = {
  params: DecalParams | null;
  pos: Vec2;
};

export type DecalParams = {
  id: string;
  pos: Vec2;
  type: 'parametric' | 'image';
  parametric?: ParametricDecalParams;
  image?: ImageDecalParams;
};

export type ParametricDecalParams = {
  radius: {
    min: number;
    max: number;
  };
  density: {
    min: number;
    max: number;
  };
  opacity: {
    min: number;
    max: number;
  };
  variation: number;
  colors: string[];
};

export type ImageDecalParams = {
  src: string;
  scale: number;
  rotation: number;
};

export type Shrapnel = {
  amount: number;
  damage: number;
  images: string[];
  lifetime: { min: number, max: number };
  pos: Vec2;
  size: { min: number, max: number };
  speed: { min: number, max: number };
  torque: { min: number, max: number };
}

export type ShrapnelPiece = {
  id: string;
  image: string;
  transform: Transform;
  velocity: Vec2;
  rotationSpeed: number;
  size: number;
  age: number;
  lifetime: number;
  ownerId: string;
  damage: number;
}

export type DeathDecal = { // TODO: Somehow pass the pool based on current charConfig
  gore: {
    amount: number;
    // pool: string;
  }
  blood: {
    amount: number;
    // pool: string;
  }
  ownerId: string;
  pos: Vec2;
  radius: number;
}

export type DeathStamp = {
  transform: Transform;
  type: string;
  scale: number;
  src: string;
}

export type ReserveBulletParticle = {
  transform: Transform;
  velocity: Vec2;
  torque: number;
  width: number;
  height: number;
}

export type RenderCharacterParams = {
  player: Player | LobbyPlayer;
  context: CanvasRenderingContext2D;
}

export type CharacterAnimation = Map<string, {
  playerId: string;
  part: string;
  partIndex?: number;
  frames: { [key: number]: { x: number, y: number } };
  duration: number;
  startTime: number;
  originalOffset: { x: number, y: number };
}>

export type CharacterLayer = 'body' | 'weapon' | 'head' | 'headwear' | 'upgrades';
//
// #endregion

// #region [ Upgrades ]
//
export enum UpgradeRarity {
  COMMON = 0,
  UNCOMMON = 1,
  SPECIAL = 2,
  SUPERIOR = 3,
  RARE = 4,
  EXCEPTIONAL = 5,
  LEGENDARY = 6,
  MYTHICAL = 7,
  ENLIGHTENED = 8,
  HOLY = 9
}

export enum UpgradeType {
  EQUIPMENT = 'equipment',
  RESOURCE = 'resource',
  STAT = 'stat',
  UNIQUE = 'unique',
}

export interface Upgrade {
  id: string;
  icon: string;
  name: string;
  rarity: UpgradeRarity;
  subtitle: string;
  type: UpgradeType;
  unique: boolean;
  func: (player: Player) => void;
}

export type UpgradeParams = {
  playerState: PlayerState;
  ui: UserInterface;
  utility: Utility;
}
//
// #endregion