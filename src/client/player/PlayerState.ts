import { WORLD } from "../Config";

import { Player, Players } from "../Types";
import { Utility } from "../Utility";
import { PlayerConfig } from "./PlayerConfig";

export class PlayerState {
    public myPlayer: Player; // My player object
    public players: Players = new Map(); // Other players in game

    public isHost = false;

    public canShoot = true;
    public canAutoFire = false;
    public isBurstActive = false;
    public isReloading = false;
    public isMelee = false;
    public isSprinting = false;
    public isDashing = false;
    public isStaminaRecoveryBlocked = false;
    public isSwimming = false;

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

    private statListeners: Map<string, (value: any) => void> = new Map();

    constructor(private playerConfig: PlayerConfig, private userId: string, private utility: Utility) {
        this.myPlayer = this.initPlayer(this.userId);
    }

    /**
     * Resets the internal state of the player.
     */
    public clear(): void {
        this.players.clear();
        this.resetPlayerState();
    }

    // #region [ State ]
    //
    // [ IMPORTANT ] Keep full track of Player object here
    /**
     * Initializes the default player object using the playerConfig.
     */
    public initPlayer(userId: string): Player {
        return this.myPlayer = {
            id: userId,
            transform: {
                pos: {
                    x: Math.random() * (WORLD.WIDTH - WORLD.BORDER_MARGIN * 2) + WORLD.BORDER_MARGIN,
                    y: Math.random() * (WORLD.HEIGHT - WORLD.BORDER_MARGIN * 2) + WORLD.BORDER_MARGIN
                },
                rot: 0
            },
            timestamp: Date.now(),
            color: this.utility.getRandomColor(),
            actions: {
                dash: {
                    cooldown: this.playerConfig.default.actions.dash.cooldown,
                    drain: this.playerConfig.default.actions.dash.drain,
                    multiplier: this.playerConfig.default.actions.dash.multiplier,
                    time: this.playerConfig.default.actions.dash.time
                },
                melee: {
                    cooldown: this.playerConfig.default.actions.melee.cooldown,
                    damage: this.playerConfig.default.actions.melee.damage,
                    duration: this.playerConfig.default.actions.melee.duration,
                    range: this.playerConfig.default.actions.melee.range,
                    size: this.playerConfig.default.actions.melee.size
                },
                primary: {
                    buffer: this.playerConfig.default.actions.primary.buffer,
                    burst: {
                        amount: this.playerConfig.default.actions.primary.burst.amount,
                        delay: this.playerConfig.default.actions.primary.burst.delay
                    },
                    magazine: {
                        currentAmmo: this.playerConfig.default.actions.primary.magazine.size,
                        currentReserve: this.playerConfig.default.actions.primary.magazine.startingReserve,
                        maxReserve: this.playerConfig.default.actions.primary.magazine.maxReserve,
                        size: this.playerConfig.default.actions.primary.magazine.size
                    },
                    offset: this.playerConfig.default.actions.primary.offset,
                    projectile: {
                        amount: this.playerConfig.default.actions.primary.projectile.amount,
                        color: this.playerConfig.default.actions.primary.projectile.color,
                        damage: this.playerConfig.default.actions.primary.projectile.damage,
                        length: this.playerConfig.default.actions.primary.projectile.length,
                        range: this.playerConfig.default.actions.primary.projectile.range,
                        size: this.playerConfig.default.actions.primary.projectile.size,
                        speed: this.playerConfig.default.actions.primary.projectile.speed,
                        spread: this.playerConfig.default.actions.primary.projectile.spread
                    },
                    reload: {
                        time: this.playerConfig.default.actions.primary.reload.time
                    }
                },
                sprint: {
                    drain: this.playerConfig.default.actions.sprint.drain,
                    multiplier: this.playerConfig.default.actions.sprint.multiplier
                }
            },
            equipment: this.playerConfig.default.equipment,
            flags: {
                hidden: this.playerConfig.default.flags.hidden,
                invulnerable: this.playerConfig.default.flags.invulnerable
            },
            inventory: {
                primary: this.playerConfig.default.inventory.primary,
                melee: this.playerConfig.default.inventory.melee
            },
            physics: {
                acceleration: this.playerConfig.default.physics.acceleration,
                friction: this.playerConfig.default.physics.friction
            },
            rig: {
                body: this.playerConfig.default.rig.body,
                head: this.playerConfig.default.rig.head,
                headwear: this.playerConfig.default.rig.headwear,
                weapon: this.playerConfig.default.rig.weapon
            },
            stats: {
                defense: this.playerConfig.default.stats.defense,
                health: {
                    max: this.playerConfig.default.stats.health.max,
                    value: this.playerConfig.default.stats.health.max,
                },
                luck: this.playerConfig.default.stats.luck,
                size: this.playerConfig.default.stats.size,
                speed: this.playerConfig.default.stats.speed,
                stamina: {
                    max: this.playerConfig.default.stats.stamina.max,
                    recovery: {
                        delay: this.playerConfig.default.stats.stamina.recovery.delay,
                        rate: this.playerConfig.default.stats.stamina.recovery.rate
                    },
                    value: this.playerConfig.default.stats.stamina.max,
                },
            },
            unique: this.playerConfig.default.unique
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
        this.isSwimming = false;

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
    //
    // #endregion

    // #region [ Events ]
    //

    /**
     * Event callback for when stats change, informing all stat listeners.
     */
    public onStatChange(statPath: string, callback: (value: any) => void): void {
        this.statListeners.set(statPath, callback);
    }

    /**
     * Routing process to notify each listener that is subscribed to a stat change.
     */
    private notifyChange(statPath: string, value: any): void {
        const listener = this.statListeners.get(statPath);
        if (listener) {
            listener(value);
        }
    }

    /**
     * Directly updates the stat, triggering an 'onStatChange' event for all listeners.
     */
    public updateStat(statPath: string, value: any): void {
        // Navigate to the property and set it
        const pathParts = statPath.split('.');
        let obj: any = this.myPlayer;

        for (let i = 0; i < pathParts.length - 1; i++) {
            obj = obj[pathParts[i]];
        }

        const lastProp = pathParts[pathParts.length - 1];
        obj[lastProp] = value;

        console.log(`${lastProp}: ${value}`);

        // Notify listeners
        this.notifyChange(statPath, value);
    }
    //
    // #endregion
}