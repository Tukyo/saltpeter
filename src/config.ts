export const PLAYER = {
    ATTACK: {
        BURST: {
            AMOUNT: 1,
            DELAY: 75 // ms
        },
        MAGAZINE: {
            SIZE: 10
        },
        RELOAD: {
            TIME: 750 // ms
        }
    },
    DASH: {
        TIME: 150, // ms
        COOLDOWN: 1000, // ms
        MULTIPLIER: 3,
        DRAIN: 40 // per dash
    },
    INVENTORY: {
        AMMO: 0,
        MAX_AMMO: 50
    },
    PHYSICS: {
        FRICTION: 0.85,
        ACCELERATION: 0.55
    },
    PROJECTILE: {
        AMOUNT: 1,
        COLOR: '#fff5beff',
        DAMAGE: 25,
        LENGTH: 15,
        RANGE: 5,
        SIZE: 1,
        SPEED: 30,
        SPREAD: 0.1
    },
    STATS: {
        LUCK: 1,
        MAX_HEALTH: 100,
        MAX_STAMINA: 100,
        SPEED: 6,
    },
    SPRINT: {
        MULTIPLIER: 1.75,
        DRAIN: 5, // per milisecond
    },
    STAMINA: {
        RECOVER_DELAY: 1000, // ms
        RECOVER_RATE: 25 // per second
    },
    VISUAL: {
        BORDER_MARGIN: 15,
        ID_DISPLAY_OFFSET: 25,
        SIZE: 15,
        STROKE_WIDTH: 3
    }
};

export const DECALS = {
    PROJECTILE: {
        RADIUS: {
            MIN: 4,
            MAX: 8
        },
        DENSITY: {
            MIN: 0.175,
            MAX: 0.35
        },
        OPACITY: {
            MIN: 0.15,
            MAX: 0.25
        },
        VARIATION: 0.215,
        COLOR: "#000000"
    },
    BLOOD: {
        RADIUS: {
            MIN: 5,
            MAX: 17.5
        },
        DENSITY: {
            MIN: 0.1,
            MAX: 0.175
        },
        OPACITY: {
            MIN: 0.275,
            MAX: 0.315
        },
        VARIATION: 0.5,
        COLOR: "#781414"
    },
    EXPLOSION: {
        RADIUS: {
            MIN: 25,
            MAX: 40
        },
        DENSITY: {
            MIN: 0.375,
            MAX: 0.575
        },
        OPACITY: {
            MIN: 0.35,
            MAX: 0.525
        },
        VARIATION: 0.2,
        COLOR: "#434343"
    }
};

export const PARTICLES = {
    MUZZLE_FLASH: {
        COUNT: {
            MIN: 8,
            MAX: 15
        },
        LIFETIME: {
            MIN: 150,
            MAX: 300
        },
        OPACITY: {
            MIN: 0.4,
            MAX: 0.8
        },
        SPEED: {
            MIN: 4,
            MAX: 10
        },
        SIZE: {
            MIN: 1,
            MAX: 3
        },
        TORQUE: {
            MIN: 0,
            MAX: 0
        },
        COLLIDE: false,
        FADE: true,
        PAINT: false,
        SPREAD: 0.6,
        STAIN: false,
        COLOR: "#ffaa00"
    },
    BLOOD_SPRAY: {
        COUNT: {
            MIN: 4,
            MAX: 12
        },
        LIFETIME: {
            MIN: 150,
            MAX: 500
        },
        OPACITY: {
            MIN: 0.225,
            MAX: 0.775
        },
        SPEED: {
            MIN: 3,
            MAX: 7
        },
        SIZE: {
            MIN: 0.75,
            MAX: 3
        },
        TORQUE: {
            MIN: -720,
            MAX: 720
        },
        COLLIDE: true,
        FADE: false,
        PAINT: true,
        SPREAD: 0.425,
        STAIN: true,
        COLOR: "#8b1a1a"
    },
    SHELL_CASING: {
        COUNT: {
            MIN: 1,
            MAX: 1
        },
        LIFETIME: {
            MIN: 250,
            MAX: 550
        },
        OPACITY: {
            MIN: 1.0,
            MAX: 1.0
        },
        SPEED: {
            MIN: 5,
            MAX: 8
        },
        SIZE: {
            MIN: 2,
            MAX: 2
        },
        TORQUE: {
            MIN: -720,
            MAX: 720
        },
        COLLIDE: true,
        FADE: false,
        PAINT: true,
        SPREAD: 0.4,
        STAIN: false,
        COLOR: "#d4af37"
    }
};

export const CANVAS = {
    WIDTH: 800,
    HEIGHT: 600,
    BORDER_COLOR: '#333',
    BORDER_WIDTH: 2
};

export const GAME = {
    RECONNECT_DELAY: 3000,
    CONNECTION_TIMEOUT: 1000,
    KEYBINDS: {
        MOVE_UP: 'w',
        MOVE_LEFT: 'a', 
        MOVE_DOWN: 's',
        MOVE_RIGHT: 'd',
        RELOAD: 'r',
        SPRINT: 'shift',
        ATTACK: 'mouse1',
        DASH: ' '
    },
    MAX_WINS: 5,
    ROUND_END_DELAY: 3000,
    GAME_END_DELAY: 5000
};

export const UI = {
    PLAYER_ID_LENGTH: 6,
    FONT: '12px Arial',
    TEXT_COLOR: '#000'
};

export const ROOM = {
    ID_PREFIX: 'room_',
    ID_LENGTH: 10,
    USER_ID_LENGTH: 12
};

export const LOBBY = {
    MAX_PLAYERS: 8,
    HOST_CONTROLS: true
};

export const CHAT = {
    MAX_MESSAGES: 100,
    MAX_MESSAGE_LENGTH: 200
};