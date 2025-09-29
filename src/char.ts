export interface CharacterConfig {
    body: keyof typeof BODY;
    weapon: keyof typeof WEAPON;
    head: keyof typeof HEAD;
    headwear: keyof typeof HEADWEAR;
}

export type CharacterLayer = 'BODY' | 'WEAPON' | 'HEAD' | 'HEADWEAR';

export const BODY = {
    DEFAULT: '/assets/img/char/default_body.png'
};

export const WEAPON = {
    GLOCK: [
        '/assets/img/weapon/glock_body.png',
        '/assets/img/weapon/glock_slide.png',
    ]
};

export const HEAD = {
    DEFAULT: '/assets/img/char/default_head.png'
};

export const HEADWEAR = {
    DEFAULT: '/assets/img/char/default_headwear.png'
};

export const CHARACTER_DECALS = {
    BLOOD: [
        '/assets/img/effects/blood/blood_00.png',
        '/assets/img/effects/blood/blood_01.png',
        '/assets/img/effects/blood/blood_02.png',
        '/assets/img/effects/blood/blood_03.png',
        '/assets/img/effects/blood/blood_04.png'
    ],
    GORE: [
        '/assets/img/effects/gore/gore_00.png',
        '/assets/img/effects/gore/gore_01.png',
        '/assets/img/effects/gore/gore_02.png',
        '/assets/img/effects/gore/gore_03.png',
        '/assets/img/effects/gore/gore_04.png',
        '/assets/img/effects/gore/gore_05.png',
        '/assets/img/effects/gore/gore_06.png',
        '/assets/img/effects/gore/gore_07.png',
        '/assets/img/effects/gore/gore_08.png',
        '/assets/img/effects/gore/gore_09.png',
        '/assets/img/effects/gore/gore_10.png'
    ]
}

export const CHARACTER: CharacterConfig = {
    body: 'DEFAULT',
    weapon: 'GLOCK', 
    head: 'DEFAULT',
    headwear: 'DEFAULT'
};

export function getCharacterAsset(layer: CharacterLayer, variant: string): string | string[] {
    switch (layer) {
        case 'BODY':
            return BODY[variant as keyof typeof BODY] || BODY.DEFAULT;
        case 'WEAPON':
            return WEAPON[variant as keyof typeof WEAPON] || WEAPON.GLOCK;
        case 'HEAD':
            return HEAD[variant as keyof typeof HEAD] || HEAD.DEFAULT;
        case 'HEADWEAR':
            return HEADWEAR[variant as keyof typeof HEADWEAR] || HEADWEAR.DEFAULT;
        default:
            throw new Error(`Unknown character layer: ${layer}`);
    }
}