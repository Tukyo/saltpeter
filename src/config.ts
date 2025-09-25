export const PLAYER = {
    PHYSICS: {
        FRICTION: 0.85,
        ACCELERATION: 0.55,
        MAX_SPEED: 8
    },
    STATS: {
        HEALTH: 100,
        SIZE: 15
    },
    BORDER_MARGIN: 15,
    ID_DISPLAY_OFFSET: 25,
    STROKE_WIDTH: 3
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
    CONTROLS: ['w', 'a', 's', 'd']
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

export const PROJECTILE = {
    DAMAGE: 25,
    SPEED: 8,
    RANGE: 250,
    AMOUNT: 1,
    SPREAD: 0.1,
    SIZE: 3,
    COLOR: '#ff4444'
}

export const ATTACK_PARAMS = {
    SHOT_DELAY: 500, //ms
    BURST_AMOUNT: 1,
    BURST_DELAY: 100 //ms
}