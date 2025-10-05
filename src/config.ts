export const PLAYER_DEFAULTS = {
    ACTIONS: {
        DASH: {
            COOLDOWN: 1000, // ms
            DRAIN: 40, // per dash
            MULTIPLIER: 3,
            TIME: 150 // ms
        },
        MELEE: {
            COOLDOWN: 600, // ms
            DAMAGE: 35,
            DURATION: 100, // ms
            RANGE: 40, // px
            SIZE: 18, // px^2 area at tip
        },
        PRIMARY: {
            BUFFER: 100, // ms
            BURST: {
                AMOUNT: 1,
                DELAY: 75 // ms
            },
            MAGAZINE: {
                SIZE: 10,
                STARTING_RESERVE: 20,
                MAX_RESERVE: 50
            },
            OFFSET: 10, // px
            PROJECTILE: {
                AMOUNT: 1,
                COLOR: '#fff5beff',
                DAMAGE: 25,
                LENGTH: 15,
                RANGE: 5,
                SIZE: 1,
                SPEED: 35,
                SPREAD: 10,
                UNIQUE: []
            },
            RELOAD: {
                TIME: 750 // ms
            }
        },
        SPRINT: {
            DRAIN: 5, // per ms
            MULTIPLIER: 1.75
        },
    },
    DATA: {
        ID_LENGTH: 12
    },
    EQUIPMENT: {
        CROSSHAIR: false,
    },
    PHYSICS: {
        ACCELERATION: 0.55,
        FRICTION: 0.85
    },
    RIG: {
        BODY: 'DEFAULT',
        HEAD: 'DEFAULT',
        HEADWEAR: 'DEFAULT',
        WEAPON: 'GLOCK'
    },
    STATS: {
        HEALTH: {
            MAX: 100
        },
        LUCK: 1,
        SIZE: 100, // px^2
        SPEED: 6,
        STAMINA: {
            MAX: 100,
            RECOVERY: {
                DELAY: 1000,
                RATE: 25
            }
        }
    },
    VISUAL: {
        ID_DISPLAY_OFFSET: 25
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
    BLOOD_DRIP: {
        COUNT: {
            MIN: 1,
            MAX: 4
        },
        LIFETIME: {
            MIN: 800,
            MAX: 1000
        },
        OPACITY: {
            MIN: 0.25,
            MAX: 0.75
        },
        SPEED: {
            MIN: 0.25,
            MAX: 0.75
        },
        SIZE: {
            MIN: 0.125,
            MAX: 2.275
        },
        TORQUE: {
            MIN: -720,
            MAX: 720
        },
        COLLIDE: true,
        FADE: true,
        PAINT: false,
        SPREAD: 0.25,
        STAIN: true,
        COLOR: "#8b1a1a"
    },
    BLOOD_SPRAY: {
        COUNT: {
            MIN: 4,
            MAX: 12
        },
        LIFETIME: {
            MIN: 150,
            MAX: 1200
        },
        OPACITY: {
            MIN: 0.425,
            MAX: 0.775
        },
        SPEED: {
            MIN: 1.5,
            MAX: 4.75
        },
        SIZE: {
            MIN: 0.75,
            MAX: 3.5
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

export const AMMO_BOX = {
    BODY: '/assets/img/object/ammobox/body.png',
    BULLETS: '/assets/img/object/ammobox/bullets.png',
    LID: '/assets/img/object/ammobox/lid.png',
}

export const CANVAS = {
    WIDTH: 800,
    HEIGHT: 600,
    BORDER_COLOR: '#333',
    BORDER_WIDTH: 2,
    BORDER_MARGIN: 15,
};

export const GAME = {
    CHARACTER_SIZE: 650,
    CONNECTION_TIMEOUT: 1000,
    CONTROLS: {
        KEYBINDS: {
            MELEE: 'f',
            MOVE_UP: 'w',
            MOVE_LEFT: 'a',
            MOVE_DOWN: 's',
            MOVE_RIGHT: 'd',
            RELOAD: 'r',
            SPRINT: 'shift',
            ATTACK: 'mouse1',
            DASH: ' '
        },
    },
    GAME_END_DELAY: 5000,
    MAX_PLAYERS: 4,
    MAX_WINS: 5,
    RECONNECT_DELAY: 3000,
    ROUND_END_DELAY: 3000,
    NEW_ROUND_DELAY: 500
};

export const UI = {
    PLAYER_ID_LENGTH: 6,
    FONT: '12px Arial',
    TEXT_COLOR: '#fff'
};

export const ROOM = {
    ID_PREFIX: 'room_',
    ID_LENGTH: 10
};

export const CHAT = {
    MAX_MESSAGES: 100,
    MAX_MESSAGE_LENGTH: 200
};

export const NETWORK = {
    MOVE_INTERVAL: 10, //ms
    ROTATE_INTERVAL: 25 //ms
}