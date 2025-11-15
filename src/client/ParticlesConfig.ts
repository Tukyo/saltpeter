import { GoreParticles, ParticleParams, WeaponParticles } from "./Types";

export class ParticlesConfig {
    public goreParticles: Record<string, GoreParticles> = {
        blood: {
            drip: {
                count: {
                    min: 1,
                    max: 4
                },
                lifetime: {
                    min: 800,
                    max: 1000
                },
                noise: {
                    strength: {
                        min: 0,
                        max: 0
                    },
                    scale: {
                        min: 0,
                        max: 0
                    }
                },
                opacity: {
                    min: 0.25,
                    max: 0.75
                },
                speed: {
                    min: 0.25,
                    max: 0.75
                },
                sizeOverLifetime: {
                    min: 0,
                    max: 0
                },
                size: {
                    min: 0.125,
                    max: 2.275
                },
                torque: {
                    min: -720,
                    max: 720
                },
                collide: true,
                fade: true,
                paint: false,
                spread: 0.25,
                stain: true,
                colors: ["#690303", "#820c0c", "#a70707"]
            } as ParticleParams,
            spray: {
                count: {
                    min: 4,
                    max: 12
                },
                lifetime: {
                    min: 150,
                    max: 1200
                },
                noise: {
                    strength: {
                        min: 0,
                        max: 0
                    },
                    scale: {
                        min: 0,
                        max: 0
                    }
                },
                opacity: {
                    min: 0.425,
                    max: 0.775
                },
                speed: {
                    min: 1.5,
                    max: 4.75
                },
                sizeOverLifetime: {
                    min: 0,
                    max: 0
                },
                size: {
                    min: 0.75,
                    max: 3.5
                },
                torque: {
                    min: -720,
                    max: 720
                },
                collide: true,
                fade: false,
                paint: true,
                spread: 0.425,
                stain: true,
                colors: ["#7e0a0a", "#941414", "#b51a1a"]
            } as ParticleParams,
        }
    };

    public weaponParticles: Record<string, WeaponParticles> = {
        glock: {
            muzzle: {
                smoke: {
                    count: {
                        min: 3,
                        max: 6
                    },
                    lifetime: {
                        min: 800,
                        max: 1400
                    },
                    noise: {
                        strength: {
                            min: 0,
                            max: 0
                        },
                        scale: {
                            min: 0,
                            max: 0
                        }
                    },
                    opacity: {
                        min: 0.15,
                        max: 0.35
                    },
                    speed: {
                        min: 0.5,
                        max: 1.5
                    },
                    size: {
                        min: 4,
                        max: 8
                    },
                    sizeOverLifetime: {
                        min: 2,
                        max: 3
                    },
                    torque: {
                        min: -180,
                        max: 180
                    },
                    collide: false,
                    fade: true,
                    paint: false,
                    spread: 0.4,
                    stain: false,
                    colors: ["#5a5a5a", "#7a7a7a"]
                } as ParticleParams,
                flash: {
                    count: {
                        min: 8,
                        max: 15
                    },
                    lifetime: {
                        min: 150,
                        max: 300
                    },
                    noise: {
                        strength: {
                            min: 0,
                            max: 0
                        },
                        scale: {
                            min: 0,
                            max: 0
                        }
                    },
                    opacity: {
                        min: 0.4,
                        max: 0.8
                    },
                    speed: {
                        min: 4,
                        max: 10
                    },
                    sizeOverLifetime: {
                        min: 0,
                        max: 0
                    },
                    size: {
                        min: 1,
                        max: 3
                    },
                    torque: {
                        min: 0,
                        max: 0
                    },
                    collide: false,
                    fade: true,
                    paint: false,
                    spread: 0.6,
                    stain: false,
                    colors: ["#ffaa00", "#f3b02a", "#edbe60"]
                } as ParticleParams,
            },
            projectile: {
                shell: {
                    count: {
                        min: 1,
                        max: 1
                    },
                    lifetime: {
                        min: 250,
                        max: 550
                    },
                    noise: {
                        strength: {
                            min: 0,
                            max: 0
                        },
                        scale: {
                            min: 0,
                            max: 0
                        }
                    },
                    opacity: {
                        min: 1.0,
                        max: 1.0
                    },
                    speed: {
                        min: 5,
                        max: 8
                    },
                    sizeOverLifetime: {
                        min: 0,
                        max: 0
                    },
                    size: {
                        min: 2,
                        max: 2
                    },
                    torque: {
                        min: -720,
                        max: 720
                    },
                    collide: true,
                    fade: false,
                    paint: true,
                    spread: 0.4,
                    stain: false,
                    colors: ["#d4af37", "#c69e1c", "#dcb01f"]
                } as ParticleParams,
                sparks: {
                    count: {
                        min: 8,
                        max: 16
                    },
                    lifetime: {
                        min: 150,
                        max: 300
                    },
                    noise: {
                        strength: {
                            min: 0.25,
                            max: 5
                        },
                        scale: {
                            min: 0.25,
                            max: 1.5
                        }
                    },
                    opacity: {
                        min: 0.4,
                        max: 0.8
                    },
                    speed: {
                        min: 4,
                        max: 10
                    },
                    size: {
                        min: 1,
                        max: 3
                    },
                    sizeOverLifetime: {
                        min: 0,
                        max: 0
                    },
                    torque: {
                        min: -720,
                        max: 720
                    },
                    collide: false,
                    fade: true,
                    paint: false,
                    spread: 0.6,
                    stain: false,
                    colors: ["#ffaa00", "#ffcf70", "#f9dea7"]
                } as ParticleParams,
            }
        }
    }

    constructor() { }
}