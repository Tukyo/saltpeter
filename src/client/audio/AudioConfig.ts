import { AudioMixer, AudioMixerName, ImpactSFX, WeaponSFX } from "../Types"

export class AudioConfig {
    public mixer: Record<AudioMixerName, AudioMixer> = {
        master: { out: null, volume: 1.0 },
        ambience: { out: 'master', volume: 0.5 },
        music: { out: 'master', volume: 0.75 },
        sfx: { out: 'master', volume: 0.9 },
        voice: { out: 'master', volume: 1.0 }
    }

    public resources = {
        sfx: {
            impact: {
                flesh: {
                    ranged: [
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_00.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_01.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_02.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_03.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_04.ogg',
                        '/assets/audio/sfx/impact/flesh/bullet/impact_flesh_bullet_05.ogg'
                    ],
                    melee: []
                },
                metal: {
                    ranged: [
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_00.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_01.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_02.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_03.ogg',
                        '/assets/audio/sfx/impact/metal/bullet/impact_metal_bullet_04.ogg'
                    ],
                    melee: []
                }
            } as ImpactSFX,
            player: {
                locomotion: {
                    footsteps: {
                        dirt: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_dirt_06.ogg'
                        ],
                        grass: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_grass_06.ogg'
                        ],
                        gravel: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_gravel_06.ogg'
                        ],
                        mud: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_mud_06.ogg'
                        ],
                        sand: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_06.ogg'
                        ],
                        sand_wet: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_sand_wet_06.ogg'
                        ],
                        silt: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_06.ogg'
                        ],
                        silt_wet: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_silt_wet_06.ogg'
                        ],
                        snow: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_06.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_snow_07.ogg'
                        ],
                        stone: [
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_00.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_01.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_02.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_03.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_04.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_05.ogg',
                            '/assets/audio/sfx/player/locomotion/footsteps/footstep_stone_06.ogg'
                        ],
                        water: {
                            light: [
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_00.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_01.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_02.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_03.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_04.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_light_05.ogg'
                            ],
                            medium: [
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_00.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_01.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_02.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_03.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_04.ogg',
                                '/assets/audio/sfx/player/locomotion/footsteps/footstep_water_medium_05.ogg'
                            ]
                        }
                    }
                },
                voice: {
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
                }
            },
            weapon: {
                glock: {
                    attack: [
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_00.ogg',
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_01.ogg',
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_02.ogg',
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_03.ogg',
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_04.ogg',
                        '/assets/audio/sfx/weapons/glock/attack/glock_attack_05.ogg'
                    ],
                    empty: [
                        '/assets/audio/sfx/weapons/glock/empty/glock_empty_00.ogg'
                    ],
                    reload: {
                        end: [
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_end_00.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_end_01.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_end_02.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_end_03.ogg'

                        ],
                        start: [
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_start_00.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_start_01.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_start_02.ogg',
                            '/assets/audio/sfx/weapons/glock/reload/glock_reload_start_03.ogg'
                        ]
                    },
                    shell: {
                        hard: [
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_00.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_01.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_02.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_03.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_04.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_05.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_06.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_07.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_08.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_09.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_10.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_11.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_12.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_13.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_hard_14.ogg'
                        ],
                        soft: [
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_00.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_01.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_02.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_03.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_04.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_05.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_06.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_07.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_soft_08.ogg'
                        ],
                        water: [
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_00.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_01.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_02.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_03.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_04.ogg',
                            '/assets/audio/sfx/weapons/glock/shell/glock_shell_water_05.ogg'
                        ]
                    }
                }
            } as WeaponSFX
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

    constructor() { }
}