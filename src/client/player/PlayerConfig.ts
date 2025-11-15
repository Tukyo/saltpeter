import { FrictionTypes } from "../Types";

export class PlayerConfig {
    public default = {
        actions: {
            dash: {
                cooldown: 1000, // ms
                drain: 40, // per dash
                multiplier: 3,
                time: 150 // ms
            },
            melee: {
                cooldown: 250, // ms
                damage: 10,
                duration: 100, // ms
                range: 10, // px
                size: 2, // px^2 area at tip
            },
            primary: {
                buffer: 250, // ms
                burst: {
                    amount: 1,
                    delay: 75 // ms
                },
                magazine: {
                    size: 10,
                    startingReserve: 20,
                    maxReserve: 50
                },
                offset: 10, // px
                projectile: {
                    amount: 1,
                    color: '#fff5beff',
                    damage: 25,
                    length: 15,
                    range: 5,
                    size: 1,
                    speed: 35,
                    spread: 10
                },
                reload: {
                    time: 750 // ms
                }
            },
            sprint: {
                drain: 5, // per ms
                multiplier: 1.75
            },
        },
        data: {
            idLength: 12,
            idOffset: 25
        },
        equipment: [],
        flags: {
            hidden: false,
            invulnerable: false
        },
        inventory: {
            primary: 'glock',
            melee: 'knife'
        },
        physics: {
            acceleration: 0.65,
            friction: FrictionTypes.Normal
        },
        rig: {
            body: 'default',
            head: 'default',
            headwear: 'default',
            weapon: 'glock'
        },
        stats: {
            defense: 0,
            health: {
                max: 100
            },
            luck: 1,
            size: 100, // px^2
            speed: 6,
            stamina: {
                max: 100,
                recovery: {
                    delay: 1000,
                    rate: 25
                }
            }
        },
        unique: []
    };

    constructor() { }
}