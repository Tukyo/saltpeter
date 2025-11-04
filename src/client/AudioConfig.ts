export class AudioConfig {
    public mixer = {
        master: 1.0,
        interface: 0.85,
        music: 0.75,
        sfx: 0.9,
        voice: 1.0
    }

    public resources = {
        sfx: {
            impact: {
                flesh: {
                    bullet: [
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_00.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_01.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_02.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_03.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_04.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_05.ogg'
                    ]
                },
                metal: {
                    bullet: [
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_00.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_01.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_02.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_03.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_04.ogg'
                    ]
                }
            },
            player: {
                voice_00: {
                    grunt: [
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_00.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_01.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_02.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_03.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_04.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_05.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_06.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_07.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_08.ogg',
                        '/assets/audio/sfx/player/voice/00/player_voice_00_hit_09.ogg'
                    ]
                },
                voice_01: {
                    grunt: [
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_00.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_01.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_02.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_03.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_04.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_05.ogg',
                        '/assets/audio/sfx/player/voice/01/player_voice_01_hit_06.ogg'
                    ]
                }
            },
            weapon: {
                glock: {
                    attack: [
                        '/assets/audio/sfx/weapons/glock/glock_attack_00.ogg',
                        '/assets/audio/sfx/weapons/glock/glock_attack_01.ogg',
                        '/assets/audio/sfx/weapons/glock/glock_attack_02.ogg',
                        '/assets/audio/sfx/weapons/glock/glock_attack_03.ogg',
                        '/assets/audio/sfx/weapons/glock/glock_attack_04.ogg',
                        '/assets/audio/sfx/weapons/glock/glock_attack_05.ogg'
                    ],
                    empty: [
                        '/assets/audio/sfx/weapons/glock/glock_empty_00.ogg'
                    ],
                    reload: {
                        end: [
                            '/assets/audio/sfx/weapons/glock/glock_reload_end_00.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_end_01.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_end_02.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_end_03.ogg'

                        ],
                        start: [
                            '/assets/audio/sfx/weapons/glock/glock_reload_start_00.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_start_01.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_start_02.ogg',
                            '/assets/audio/sfx/weapons/glock/glock_reload_start_03.ogg'
                        ]
                    },
                    shell: [
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
                }
            }
        },
        ambience: {
            beds: {
                app: ['/assets/audio/ambience/beds/env_app_00.ogg'],
                cliffs: ['/assets/audio/ambience/beds/env_cliffs_00.ogg'],
                mountains: ['/assets/audio/ambience/beds/env_mountains_00.ogg'],
                ocean: ['/assets/audio/ambience/beds/env_ocean_00.ogg'],
                plains: ['/assets/audio/ambience/beds/env_plains_00.ogg'],
                shore: ['/assets/audio/ambience/beds/env_shore_00.ogg']
            }
        }
    }

    public settings = {
        maxConcurrent: 5, // Max simultaneous instances of same sound
        poolSize: 10, // Number of Audio objects per sound
        preloadSounds: true // Toggle sound resource preloading on start
    }

    constructor() { }
}