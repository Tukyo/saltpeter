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
            TIME: 2000 // ms
        }
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
        RANGE: 450,
        SIZE: 1,
        SPEED: 20,
        SPREAD: 0.1
    },
    STATS: {
        HEALTH: 100,
        LUCK: 1,
        SIZE: 15,
        SPEED: 8,
        STAMINA: 100
    },
    VISUAL: {
        BORDER_MARGIN: 15,
        ID_DISPLAY_OFFSET: 25,
        STROKE_WIDTH: 3
    }
};

export const DECALS = {
    PROJECTILE: {
        radius: 8,
        density: 0.35,
        opacity: 0.25,
        variation: 0.215,
        color: "#000000"
    },
    BLOOD: {
        radius: 25,
        density: 0.125,
        opacity: 0.275,
        variation: 0.45,
        color: "#781414"
    },
    EXPLOSION: {
        radius: 20,
        density: 0.5,
        opacity: 0.2,
        variation: 0.2,
        color: "#434343"
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
    CONTROLS: ['w', 'a', 's', 'd', 'r'],
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