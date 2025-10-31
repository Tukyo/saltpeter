export const OBJECT_DEFAULTS = {
    DATA: {
        ID_LENGTH: 8
    },
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

export const WORLD = {
    WIDTH: 3200,
    HEIGHT: 2400,
    BORDER_MARGIN: 15
};

export const CANVAS = {
    WIDTH: 800,
    HEIGHT: 600
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
            DEADZONE: 0.2,
            RELOAD: GAMEPAD_MAP.A,
            SPRINT: GAMEPAD_MAP.LT,
            ATTACK: GAMEPAD_MAP.RT
        }
    },
    GAME_END_DELAY: 5000,
    GRAPHICS: {
        PHYSICS: {
            AMMORESERVES: true
        },
        STATIC_OVERLAY: true,
        BACKGROUND_PARTICLES: true
    },
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