import { WeaponMagazine } from "./Types";

export class CharacterConfig {
    public weapon = {
        glock: [
            '/assets/img/weapon/glock/body.png',
            '/assets/img/weapon/glock/slide.png',
        ],
        knife: [
            '/assets/img/weapon/melee/knife_00.png'
        ]
    };

    public magazine: Record<string, WeaponMagazine> = {
        glock: {
            empty: '/assets/img/object/weapons/glock/magazine_empty.png',
            full: '/assets/img/object/weapons/glock/magazine_full.png'
        }
    };

    public body = {
        default: '/assets/img/char/body/default.png'
    };

    public head = {
        default: '/assets/img/char/head/default.png',
        blondeAfro: '/assets/img/char/head/blonde_afro.png'
    };

    public headwear = {
        default: '/assets/img/char/headwear/default.png',
        fez: '/assets/img/char/headwear/fez.png',
        strawHat: '/assets/img/char/headwear/straw_hat.png',
        trucker: '/assets/img/char/headwear/trucker.png'
    };

    public upgrades = {
        kineticBrain: '/assets/img/char/upgrades/kineticbrain.png'
    };

    public characterDecals = {
        default: {
            blood: [
                '/assets/img/effects/blood/blood_00.png',
                '/assets/img/effects/blood/blood_01.png',
                '/assets/img/effects/blood/blood_02.png',
                '/assets/img/effects/blood/blood_03.png',
                '/assets/img/effects/blood/blood_04.png'
            ],
            gore: [
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
                '/assets/img/effects/gore/gore_10.png',
                '/assets/img/effects/gore/gore_11.png',
                '/assets/img/effects/gore/gore_12.png',
                '/assets/img/effects/gore/gore_13.png'
            ]
        }
    };

    constructor() { }
}