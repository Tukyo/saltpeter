import { CANVAS, PLAYER_DEFAULTS } from "../Config";

import { Player, Players } from "../Types";
import { Utility } from "../Utility";

export class PlayerState {
    public myPlayer: Player; // My player object
    public players: Players = new Map(); // Other players in game

    public isHost = false;

    public canShoot = true;
    public isBurstActive = false;
    public isReloading = false;
    public isMelee = false;
    public isSprinting = false;
    public isDashing = false;
    public isStaminaRecoveryBlocked = false;

    public lastSentX = 0;
    public lastSentY = 0;
    public lastSentRotation = 0;
    public lastSentRotationTime = 0;
    public lastSentMoveTime = 0;

    public playerVelocityX = 0;
    public playerVelocityY = 0;

    public dashStartTime = 0;
    public lastDashTime = 0;
    public reloadStartTime = 0;
    public lastShotTime = 0;
    public lastMeleeTime = 0;
    public nextBurstShotTime = 0;
    public currentBurstShot = 0;
    public lastStaminaDrainTime = 0;
    public staminaRecoveryBlockedUntil = 0;

    constructor(userId: string, private utility: Utility) {
        this.myPlayer = this.initPlayer(userId);
    }

    //
    // [ IMPORTANT ] Keep full track of Player object here
    /**
     * Initializes the default player object using the PLAYER_DEFAULTS defined in the config.
     */
    public initPlayer(userId: string): Player {
        return this.myPlayer = {
            id: userId,
            transform: {
                pos: {
                    x: Math.random() * (CANVAS.WIDTH - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN,
                    y: Math.random() * (CANVAS.HEIGHT - CANVAS.BORDER_MARGIN * 2) + CANVAS.BORDER_MARGIN
                },
                rot: 0
            },
            timestamp: Date.now(),
            color: this.utility.getRandomColor(), // TODO: Replace with char customization
            actions: {
                dash: {
                    cooldown: PLAYER_DEFAULTS.ACTIONS.DASH.COOLDOWN,
                    drain: PLAYER_DEFAULTS.ACTIONS.DASH.DRAIN,
                    multiplier: PLAYER_DEFAULTS.ACTIONS.DASH.MULTIPLIER,
                    time: PLAYER_DEFAULTS.ACTIONS.DASH.TIME
                },
                melee: {
                    cooldown: PLAYER_DEFAULTS.ACTIONS.MELEE.COOLDOWN,
                    damage: PLAYER_DEFAULTS.ACTIONS.MELEE.DAMAGE,
                    duration: PLAYER_DEFAULTS.ACTIONS.MELEE.DURATION,
                    range: PLAYER_DEFAULTS.ACTIONS.MELEE.RANGE,
                    size: PLAYER_DEFAULTS.ACTIONS.MELEE.SIZE
                },
                primary: {
                    buffer: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BUFFER,
                    burst: {
                        amount: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.AMOUNT,
                        delay: PLAYER_DEFAULTS.ACTIONS.PRIMARY.BURST.DELAY
                    },
                    magazine: {
                        currentAmmo: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE,
                        currentReserve: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.STARTING_RESERVE,
                        maxReserve: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.MAX_RESERVE,
                        size: PLAYER_DEFAULTS.ACTIONS.PRIMARY.MAGAZINE.SIZE
                    },
                    offset: PLAYER_DEFAULTS.ACTIONS.PRIMARY.OFFSET,
                    projectile: {
                        amount: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.AMOUNT,
                        color: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.COLOR,
                        damage: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.DAMAGE,
                        length: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.LENGTH,
                        range: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.RANGE,
                        size: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SIZE,
                        speed: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPEED,
                        spread: PLAYER_DEFAULTS.ACTIONS.PRIMARY.PROJECTILE.SPREAD
                    },
                    reload: {
                        time: PLAYER_DEFAULTS.ACTIONS.PRIMARY.RELOAD.TIME
                    }
                },
                sprint: {
                    drain: PLAYER_DEFAULTS.ACTIONS.SPRINT.DRAIN,
                    multiplier: PLAYER_DEFAULTS.ACTIONS.SPRINT.MULTIPLIER
                }
            },
            equipment: PLAYER_DEFAULTS.EQUIPMENT,
            physics: {
                acceleration: PLAYER_DEFAULTS.PHYSICS.ACCELERATION,
                friction: PLAYER_DEFAULTS.PHYSICS.FRICTION
            },
            rig: {
                body: PLAYER_DEFAULTS.RIG.BODY,
                head: PLAYER_DEFAULTS.RIG.HEAD,
                headwear: PLAYER_DEFAULTS.RIG.HEADWEAR,
                weapon: PLAYER_DEFAULTS.RIG.WEAPON
            },
            stats: {
                health: {
                    max: PLAYER_DEFAULTS.STATS.HEALTH.MAX,
                    value: PLAYER_DEFAULTS.STATS.HEALTH.MAX,
                },
                luck: PLAYER_DEFAULTS.STATS.LUCK,
                size: PLAYER_DEFAULTS.STATS.SIZE,
                speed: PLAYER_DEFAULTS.STATS.SPEED,
                stamina: {
                    max: PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                    recovery: {
                        delay: PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.DELAY,
                        rate: PLAYER_DEFAULTS.STATS.STAMINA.RECOVERY.RATE
                    },
                    value: PLAYER_DEFAULTS.STATS.STAMINA.MAX,
                },
            },
            unique: PLAYER_DEFAULTS.UNIQUE
        };
    }

    /**
     * Resets the current player state stored in memory to default.
     */
    public resetPlayerState(): void {
        this.canShoot = true;
        this.isBurstActive = false;
        this.isReloading = false;
        this.isMelee = false;
        this.isSprinting = false;
        this.isDashing = false;
        this.isStaminaRecoveryBlocked = false;

        this.playerVelocityX = 0;
        this.playerVelocityY = 0;

        this.dashStartTime = 0;
        this.lastDashTime = 0;
        this.reloadStartTime = 0;
        this.lastMeleeTime = 0;
        this.lastShotTime = 0;
        this.nextBurstShotTime = 0;
        this.currentBurstShot = 0;
        this.lastStaminaDrainTime = 0;
        this.staminaRecoveryBlockedUntil = 0;

        this.lastSentX = 0;
        this.lastSentY = 0;
        this.lastSentRotation = 0;
        this.lastSentRotationTime = 0;
        this.lastSentMoveTime = 0;
    }
}