export const PLAYER_DEFAULTS = {
    ACTIONS: {
        DASH: {
            COOLDOWN: 1000, // ms
            DRAIN: 40, // per dash
            MULTIPLIER: 3,
            TIME: 150 // ms
        },
        MELEE: {
            COOLDOWN: 250, // ms
            DAMAGE: 10,
            DURATION: 100, // ms
            RANGE: 10, // px
            SIZE: 2, // px^2 area at tip
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
    EQUIPMENT: [],
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
    UNIQUE: [],
    VISUAL: {
        ID_DISPLAY_OFFSET: 25
    }
};

export const OBJECT_DEFAULTS = {
    DATA: {
        ID_LENGTH: 8
    },
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
        NOISE: {
            STRENGTH: {
                MIN: 0,
                MAX: 0
            },
            SCALE: {
                MIN: 0,
                MAX: 0
            }
        },
        OPACITY: {
            MIN: 0.25,
            MAX: 0.75
        },
        SPEED: {
            MIN: 0.25,
            MAX: 0.75
        },
        SIZE_OVER_LIFETIME: {
            MIN: 0,
            MAX: 0
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
        NOISE: {
            STRENGTH: {
                MIN: 0,
                MAX: 0
            },
            SCALE: {
                MIN: 0,
                MAX: 0
            }
        },
        OPACITY: {
            MIN: 0.425,
            MAX: 0.775
        },
        SPEED: {
            MIN: 1.5,
            MAX: 4.75
        },
        SIZE_OVER_LIFETIME: {
            MIN: 0,
            MAX: 0
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
        NOISE: {
            STRENGTH: {
                MIN: 0,
                MAX: 0
            },
            SCALE: {
                MIN: 0,
                MAX: 0
            }
        },
        OPACITY: {
            MIN: 0.4,
            MAX: 0.8
        },
        SPEED: {
            MIN: 4,
            MAX: 10
        },
        SIZE_OVER_LIFETIME: {
            MIN: 0,
            MAX: 0
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
        NOISE: {
            STRENGTH: {
                MIN: 0,
                MAX: 0
            },
            SCALE: {
                MIN: 0,
                MAX: 0
            }
        },
        OPACITY: {
            MIN: 1.0,
            MAX: 1.0
        },
        SPEED: {
            MIN: 5,
            MAX: 8
        },
        SIZE_OVER_LIFETIME: {
            MIN: 0,
            MAX: 0
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
    },
    SMOKE: {
        COUNT: {
            MIN: 3,
            MAX: 6
        },
        LIFETIME: {
            MIN: 800,
            MAX: 1400
        },
        NOISE: {
            STRENGTH: {
                MIN: 0.1,
                MAX: 0.3
            },
            SCALE: {
                MIN: 40,
                MAX: 80
            }
        },
        OPACITY: {
            MIN: 0.15,
            MAX: 0.35
        },
        SPEED: {
            MIN: 0.5,
            MAX: 1.5
        },
        SIZE: {
            MIN: 4,
            MAX: 8
        },
        SIZE_OVER_LIFETIME: {
            MIN: 2,
            MAX: 3
        },
        TORQUE: {
            MIN: -180,
            MAX: 180
        },
        COLLIDE: false,
        FADE: true,
        PAINT: false,
        SPREAD: 0.4,
        STAIN: false,
        COLOR: "#5a5a5a"
    },
    SPARKS: {
        COUNT: {
            MIN: 8,
            MAX: 16
        },
        LIFETIME: {
            MIN: 150,
            MAX: 300
        },
        NOISE: {
            STRENGTH: {
                MIN: 0.25,
                MAX: 5
            },
            SCALE: {
                MIN: 0.25,
                MAX: 1.5
            }
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
        SIZE_OVER_LIFETIME: {
            MIN: 0,
            MAX: 0
        },
        TORQUE: {
            MIN: -720,
            MAX: 720
        },
        COLLIDE: false,
        FADE: true,
        PAINT: false,
        SPREAD: 0.6,
        STAIN: false,
        COLOR: "#ffaa00"
    }
};

export const SHRAPNEL = {
    PIECE: [
        '/assets/img/effects/shrapnel/shrapnel_00.png',
        '/assets/img/effects/shrapnel/shrapnel_01.png',
        '/assets/img/effects/shrapnel/shrapnel_02.png',
        '/assets/img/effects/shrapnel/shrapnel_03.png',
        '/assets/img/effects/shrapnel/shrapnel_04.png',
        '/assets/img/effects/shrapnel/shrapnel_05.png'
    ]
};

export const AMMO_BOX = {
    BASE: '/assets/img/object/ammobox/base.png',
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

export const GAMEPAD_MAP = {
    // Face buttons
    A: 0,
    B: 1,
    X: 2,
    Y: 3,

    // Bumpers
    LB: 4,
    RB: 5,

    // Triggers
    LT: 6,
    RT: 7,

    // System buttons
    SELECT: 8,
    START: 9,

    // Stick clicks
    L_STICK: 10,
    R_STICK: 11,

    // D-Pad
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15,

    // Home/Guide button
    HOME: 16,

    // Axes
    AXES: {
        LEFT_STICK_X: 0,
        LEFT_STICK_Y: 1,
        RIGHT_STICK_X: 2,
        RIGHT_STICK_Y: 3
    }
};

export const GAME = {
    CHARACTER_SIZE: 650,
    CONNECTION_TIMEOUT: 1000,
    CONTROLS: {
        KEYBINDS: {
            MELEE: 'mouse2',
            MOVE_UP: 'w',
            MOVE_LEFT: 'a',
            MOVE_DOWN: 's',
            MOVE_RIGHT: 'd',
            RELOAD: 'r',
            SPRINT: 'shift',
            ATTACK: 'mouse1',
            DASH: ' '
        },
        GAMEPAD: {
            MELEE: GAMEPAD_MAP.RB,
            DASH: GAMEPAD_MAP.LB,
            RELOAD: GAMEPAD_MAP.A,
            SPRINT: GAMEPAD_MAP.LT,
            ATTACK: GAMEPAD_MAP.RT
        }
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

export const AUDIO = {
    MIXER: {
        MASTER: 1.0,
        INTERFACE: 0.85,
        MUSIC: 0.75,
        SFX: 0.9,
        VOICE: 1.0
    },
    SETTINGS: {
        MAX_CONCURRENT: 5, // Max simultaneous instances of same sound
        POOL_SIZE: 10, // Number of Audio objects per sound
        PRELOAD_SOUNDS: true
    }
};

// Standardized weapon SFX configuration structure example
export const SFX = {
    IMPACT: {
        FLESH: {
            BULLET: [
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_00.ogg',
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_01.ogg',
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_02.ogg',
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_03.ogg',
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_04.ogg',
                '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_05.ogg'
            ]
        },
        METAL: {
            BULLET: [
                '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_00.ogg',
                '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_01.ogg',
                '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_02.ogg',
                '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_03.ogg',
                '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_04.ogg'
            ]
        }
    },
    WEAPON: {
        GLOCK: {
            ATTACK: [
                '/assets/audio/sfx/weapons/glock/glock_attack_00.ogg',
                '/assets/audio/sfx/weapons/glock/glock_attack_01.ogg',
                '/assets/audio/sfx/weapons/glock/glock_attack_02.ogg',
                '/assets/audio/sfx/weapons/glock/glock_attack_03.ogg',
                '/assets/audio/sfx/weapons/glock/glock_attack_04.ogg',
                '/assets/audio/sfx/weapons/glock/glock_attack_05.ogg'
            ],
            SHELL: [
                '/assets/audio/sfx/weapons/glock/glock_shell_00.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_01.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_02.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_03.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_04.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_05.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_06.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_07.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_08.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_09.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_10.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_11.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_12.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_13.ogg',
                '/assets/audio/sfx/weapons/glock/glock_shell_14.ogg'
            ],
            EMPTY: [
                '/assets/audio/sfx/weapons/glock/glock_empty_00.ogg'
            ]
        }
    }
};