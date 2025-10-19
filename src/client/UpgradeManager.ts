import { PLAYER_DEFAULTS } from './Config';
import { Player, Upgrade, UpgradeRarity, UpgradeType } from './Types';

import { Utility } from './Utility';

import { AmmoReservesUIController } from './player/AmmoReservesUIController';
import { PlayerState } from './player/PlayerState';

/**
 Upgrade Ideas:
 ionic compound
 randomly chance to combine all nProjeciles into one
 explosion on dash
 while sprinting, luck doubled
 bullet trails
 projectile with padding on sides = projectiles that are detonated on reload
 on death respawn as 1hp ghost who can melee with .25s invuln
 > [ Stats ]
  - Size -- / Speed ++
  - Damage ++ / Buffer ++
  - 
 > [ Persistent ]
  - Projectile burst into more projectiles on non-player hit.
  - Dash becomes teleport but uses twice as much stamina.
  - Switch, unlocking further firing modes 
 > [ Luck Based ]
  - Explosive
    > explode on hit
    > stick, then explode after timer
    > only explode on player hit
  - Fire
    > leave behind a flame on ground hit that persists and does damage for some time
    > burn player on hit for timer
  - Oil
    > leave oil puddles on hit, flammable, oil on fire persists much longer
  - Poison
    > decrease player health gradually for timer on player hit
    > leave pool of poison on ground for timer
    > spray poison out on ground hit
  - Bounce
    > chance for projectile to bounce
  - Orbital Laser
    > chance to spawn cluster of lasers on non-boundary hit
*/

export class UpgradeManager {
    public takenUniques = new Set<string>(); // Pool of uniques already taken by players during this session
    public upgradesCompleted = new Set<string>(); // Tracks round end upgrade progress

    public isUpgradesEnabled = true;

    private rarityConfig = {
        [UpgradeRarity.COMMON]: {
            weight: 35,
            color: '#7e7e7e'
        },
        [UpgradeRarity.UNCOMMON]: {
            weight: 20,
            color: '#61b6d5'
        },
        [UpgradeRarity.SPECIAL]: {
            weight: 15,
            color: '#58d688'
        },
        [UpgradeRarity.SUPERIOR]: {
            weight: 12,
            color: '#ffc233'
        },
        [UpgradeRarity.RARE]: {
            weight: 8,
            color: '#0077ff'
        },
        [UpgradeRarity.EXCEPTIONAL]: {
            weight: 5,
            color: '#00ff62'
        },
        [UpgradeRarity.LEGENDARY]: {
            weight: 2.5,
            color: '#f6ff00'
        },
        [UpgradeRarity.MYTHICAL]: {
            weight: 1.5,
            color: '#ff0000'
        },
        [UpgradeRarity.ENLIGHTENED]: {
            weight: 0.9,
            color: '#9500ff'
        },
        [UpgradeRarity.HOLY]: {
            weight: 0.1,
            color: '#ff00f7'
        }
    };

    public upgrades: Upgrade[] = [
        // #region [ EQUIPMENT ]
        //
        {
            // During dash cooldown, player will be able to hold shoot to auto-fire.
            id: "switch",
            name: "Switch",
            subtitle: "Completely legal and completely functional.",
            icon: "/assets/img/icon/upgrades/switch.png",
            type: UpgradeType.EQUIPMENT,
            rarity: UpgradeRarity.RARE,
            unique: false,
            func: (player: Player) => {
                if (!player.equipment.includes('switch')) {
                    player.equipment.push('switch');
                    this.playerState.updateStat('actions.primary.projectile.spread', player.actions.primary.projectile.spread *= 1.15);
                }
            }
        },
        //
        // #endregion
        //
        // #region [ RESOURCE ]
        //
        {
            // Gives the player some ammo in their reserves.
            id: "care_package",
            name: "Care Package",
            subtitle: "These are hard to come by.",
            icon: "/assets/img/icon/upgrades/carepackage.png",
            type: UpgradeType.RESOURCE,
            rarity: UpgradeRarity.COMMON,
            unique: false,
            func: (player: Player) => {
                const ammo = 20;

                player.actions.primary.magazine.currentReserve += ammo;
                this.ammoReservesUI.spawnAmmoInReserveUI(ammo);
            }
        },
        //
        // #endregion
        //
        // #region [ STATS ]
        //
        {
            // Increases stamina, and stamina recovery, but increases regen delay after using.
            id: "bioregulator",
            name: "Bioregulator",
            subtitle: "Increases energy regulation efficiency, with a small boot overhead.",
            icon: "/assets/img/icon/upgrades/bioregulator.png",
            type: UpgradeType.STAT,
            rarity: UpgradeRarity.COMMON,
            unique: false,
            func: (player: Player) => {
                this.playerState.updateStat('stats.stamina.max', player.stats.stamina.max * 1.1);
                this.playerState.updateStat('stats.stamina.recovery.rate', player.stats.stamina.recovery.rate + 1);
                this.playerState.updateStat('stats.stamina.recovery.delay', player.stats.stamina.recovery.delay * 1.25);
            }
        },
        {
            // Increases damage and shot buffer by 10%.
            // Bullets hit harder, but can be shot less often each time this is taken. 
            id: "damage_buffer",
            name: "Damage Buffer",
            subtitle: "Type D125 buffer, which improves damage at a small cost. ",
            icon: "/assets/img/icon/upgrades/damagebuffer.png",
            type: UpgradeType.STAT,
            rarity: UpgradeRarity.UNCOMMON,
            unique: false,
            func: (player: Player) => {
                this.playerState.updateStat('actions.primary.projectile.damage', player.actions.primary.projectile.damage * 1.1);
                this.playerState.updateStat('actions.primary.buffer', player.actions.primary.buffer * 1.1);
            }
        },
        {
            // Increases the player's max health.
            id: "hemoglobin_saturator",
            name: "Hemoglobin Saturator",
            subtitle: "Increases red blood cell density for extended durability.",
            icon: "/assets/img/icon/upgrades/hemoglobinsaturator.png",
            type: UpgradeType.RESOURCE,
            rarity: UpgradeRarity.UNCOMMON,
            unique: false,
            func: (player: Player) => {
                this.playerState.updateStat('stats.health.max', player.stats.health.max + 10);
                this.playerState.updateStat('stats.health.value', player.stats.health.max); // Heal to new max
            }
        },
        {
            // Increases speed but also increases dash cooldown.
            id: "locomotion_module",
            name: "Locomotion Module",
            subtitle: "Primitave locomotion module installed on the user's footwear.",
            icon: "/assets/img/icon/upgrades/locomotionmodule.png",
            type: UpgradeType.STAT,
            rarity: UpgradeRarity.COMMON,
            unique: false,
            func: (player: Player) => {
                this.playerState.updateStat('stats.speed', player.stats.speed + 1);
                this.playerState.updateStat('actions.dash.cooldown', player.actions.dash.cooldown * 1.5);
            }
        },
        //
        // #endregion
        //
        // #region [ UNIQUE ]
        //
        {
            // Luck based, causes projectiles to sometimes break into shrapnel on impact.
            // Varying amounts of pieces can spawn, and shrapnel does 1 damage to any enemy hit.
            id: "cluster_module",
            name: "Cluster Module",
            subtitle: "Cluster enhancement module for primary attacks.",
            icon: "/assets/img/icon/upgrades/clustermodule.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.RARE,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('cluster_module')) {
                    player.unique.push('cluster_module');
                }
            }
        },
        {
            // Luck based, creates visible aura around player.
            // Enemy projectiles in radius have a chance to be deflected.
            id: "kinetic_brain",
            name: "Kinetic Brain",
            subtitle: "Cerebral kinetic stem implant, unable to function at maximum capacity.",
            icon: "/assets/img/icon/upgrades/kineticbrain.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.EXCEPTIONAL,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('kinetic_brain')) {
                    player.unique.push('kinetic_brain');
                }
            }
        },
        {
            // Luck based, can replace standard shot with split shot.
            id: "muzzle_spliter",
            name: "Muzzle Spliiter",
            subtitle: "Muzzle modification for primary attacks, requires certain skillset.",
            icon: "/assets/img/icon/upgrades/kineticbrain.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.SPECIAL,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('muzzle_spliter')) {
                    player.unique.push('muzzle_spliter');
                }
            }
        },
        {
            // Luck based * 1.5, on death chance to trigger.
            // One-time use, double damage received permanently on trigger.
            id: "phoenix_module",
            name: "Phoenix Module",
            subtitle: "Return from the flames with vengeance.",
            icon: "/assets/img/icon/upgrades/phoenixmodule.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.LEGENDARY,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('phoenix_module')) {
                    player.unique.push('phoenix_module');
                }
            }
        },
        {
            // Luck based, chance to add extra projectiles on shot in random direction.
            // Extra shots have more spread, less distance and do half damage.
            id: "projectile_array",
            name: "Projectile Array",
            subtitle: "Chance to fire an array of extra projectiles.",
            icon: "/assets/img/icon/upgrades/projectilearray.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.RARE,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('projectile_array')) {
                    player.unique.push('projectile_array');
                }
            }
        },
        {
            // Allows player's rotation to slightly influence projectile direction.
            id: "spatial_targeting",
            name: "Spatial Targeting",
            subtitle: "Projectile upgrade that syncs its spatial awareness with the user.",
            icon: "/assets/img/icon/upgrades/spatialtargeting.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.SUPERIOR,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('spatial_targeting')) {
                    player.unique.push('spatial_targeting');
                }
            }
        },
        {
            // Dash replaced with spectral teleport, and increased range. No collisions when dashing.
            id: "spectral_image",
            name: "Spectral Image",
            subtitle: "Forward imaging coordinate transponder.",
            icon: "/assets/img/icon/upgrades/spectralimage.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.EXCEPTIONAL,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('spectral_image')) {
                    player.unique.push('spectral_image');
                    this.playerState.updateStat('actions.dash.time', player.actions.dash.time + 50);
                }
            }
        }
        //
        // #endregion
        //
    ]

    constructor(private ammoReservesUI: AmmoReservesUIController, private playerState: PlayerState, private utility: Utility) { }

    /**
     * Returns a selected amount of upgrades for a specific player in the game.
     * 
     * Used to display upgrades for all round losers after brief roud-end pause.
     */
    public getUpgrades(count: number, player: Player): Upgrade[] {
        // Filter available upgrades based on type restrictions
        const availableUpgrades = this.upgrades.filter(upgrade => {
            // Check if unique upgrade has already been taken globally
            if (upgrade.unique && this.takenUniques.has(upgrade.id)) {
                return false;
            }

            // Check if equipment is already owned by this player
            if (upgrade.type === UpgradeType.EQUIPMENT && player.equipment.includes(upgrade.id)) {
                return false;
            }

            return true;
        });

        // Weighted random selection using rarity config
        const selected: Upgrade[] = [];

        for (let i = 0; i < Math.min(count, availableUpgrades.length); i++) {
            if (availableUpgrades.length === 0) break;

            // Calculate weighted random selection using this.rarityConfig
            const totalWeight = availableUpgrades.reduce((sum, upgrade) => {
                return sum + this.getRarityWeight(upgrade.rarity);
            }, 0);

            let random = Math.random() * totalWeight;
            let selectedUpgrade: Upgrade | null = null;

            for (const upgrade of availableUpgrades) {
                random -= this.getRarityWeight(upgrade.rarity);
                if (random <= 0) {
                    selectedUpgrade = upgrade;
                    break;
                }
            }

            if (selectedUpgrade) {
                selected.push(selectedUpgrade);
                // Remove from available pool to prevent duplicates in this selection
                const index = availableUpgrades.indexOf(selectedUpgrade);
                availableUpgrades.splice(index, 1);
            }
        }

        return selected;
    }

    /**
     * Applies a specific upgrade to a specific player by mutating their myPlayer object.
     */
    public applyUpgrade(upgradeId: string, player: Player): boolean {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) return false;

        // Double-check restrictions
        if (upgrade.unique && this.takenUniques.has(upgradeId)) {
            console.warn(`Unique upgrade ${upgradeId} already taken globally`);
            return false;
        }

        if (upgrade.type === UpgradeType.EQUIPMENT && this.hasEquipment(player, upgradeId)) {
            console.warn(`Equipment ${upgradeId} already owned by player`);
            return false;
        }

        // Track unique upgrades globally
        if (upgrade.unique) {
            this.takenUniques.add(upgradeId);
        }

        // Apply the upgrade to the player object
        upgrade.func(player);
        return true;
    }

    /**
     * Removes a unique upgrade from the global pool.
     * 
     * This process involved adding the unique item to the client's takenUniques array.
     * 
     * Network message 'upgrade-taken' broadcasts this to all players.
     */
    public removeUpgradeFromPool(upgradeId: string): void {
        this.takenUniques.add(upgradeId);
    }

    /**
     * Resets the global uniques pool to a clean slate.
     */
    public resetUpgrades(player: Player): void {
        this.takenUniques.clear();

        player.equipment = PLAYER_DEFAULTS.EQUIPMENT;
        player.unique = PLAYER_DEFAULTS.UNIQUE;
    }

    // #region [ Helpers ]
    //
    /**
     * Returns boolean based on if the selected player has a specific equipment piece or not.
     */
    public hasEquipment(player: Player, equipmentId: string): boolean {
        return player.equipment.includes(equipmentId);
    }

    /**
     * Returns boolean based on if the selected player has a specific unique item or not.
     */
    private hasUnique(player: Player, uniqueId: string): boolean {
        return player.unique.includes(uniqueId);
    }

    /**
     * Gets the color associated with a specific rarity.
     */
    private getRarityColor(rarity: UpgradeRarity): string {
        return this.rarityConfig[rarity].color;
    }

    /**
     * Gets the weight of a specific rarity.
     */
    private getRarityWeight(rarity: UpgradeRarity): number {
        return this.rarityConfig[rarity].weight;
    }
}