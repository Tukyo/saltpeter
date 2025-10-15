import { AmmoReservesUIController } from './player/AmmoReservesUIController';
import { Player, Upgrade, UpgradeRarity, UpgradeType } from './Types';

/**
 Upgrade Ideas:
 ionic compound
 phoenix module, on death multiply 1.5 * luck to get chance and if hits, disallow further attempts and give player double damage
 > [ Resources ]
  - Reserves ++
  - 
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
            weight: 70,
            color: '#ffffff'
        },
        [UpgradeRarity.UNCOMMON]: {
            weight: 20,
            color: '#1eff00'
        },
        [UpgradeRarity.RARE]: {
            weight: 7,
            color: '#0099ff'
        },
        [UpgradeRarity.EPIC]: {
            weight: 2,
            color: '#9d00ff'
        },
        [UpgradeRarity.LEGENDARY]: {
            weight: 1,
            color: '#ff9500'
        }
    };

    public upgrades: Upgrade[] = [ // TODO: Update all upgrades to use the player object instead of the olayer defaults
        // #region [ EQUIPMENT ]
        //
        // {
        //     id: "neural_target_interface",
        //     name: "Neural Target Interface",
        //     subtitle: "G.I.M.P. proprietary targeting module.",
        //     icon: "/assets/img/icon/upgrades/crosshair.png",
        //     type: UpgradeType.EQUIPMENT,
        //     rarity: UpgradeRarity.UNCOMMON,
        //     unique: false,
        //     func: (player: Player) => {
        //         // Add to equipment array if not already present
        //         if (!player.equipment.includes('neural_target_interface')) {
        //             player.equipment.push('neural_target_interface');
        //         }

        //         // Apply stat changes
        //         player.actions.primary.projectile.spread *= 0.95;

        //         console.log(`[Neural Target Interface] - Equipment added.`, "Spread:", player.actions.primary.projectile.spread);
        //     }
        // },
        //
        // #endregion
        //
        // #region [ RESOURCE ]
        //
        {
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

                console.log(`Care package received. Primary Reserves: ${player.actions.primary.magazine.currentReserve}`);
            }
        },      
        {
            id: "hemoglobin_saturator",
            name: "Hemoglobin Saturator",
            subtitle: "Increases red blood cell density for extended durability.",
            icon: "/assets/img/icon/upgrades/hemoglobinsaturator.png",
            type: UpgradeType.RESOURCE,
            rarity: UpgradeRarity.UNCOMMON,
            unique: false,
            func: (player: Player) => {
                player.stats.health.max += 10;
                player.stats.health.value = player.stats.health.max;

                console.log(`Damage Buffer installed. New damage: ${player.actions.primary.projectile.damage} - New Buffer: ${player.actions.primary.buffer}`);
            }
        },  
        //
        // #endregion
        //
        // #region [ STATS ]
        //
        {
            id: "damage_buffer",
            name: "Damage Buffer",
            subtitle: "Type D125 buffer, which improves the damage at a small cost. ",
            icon: "/assets/img/icon/upgrades/damageup.png",
            type: UpgradeType.STAT,
            rarity: UpgradeRarity.COMMON,
            unique: false,
            func: (player: Player) => {
                player.actions.primary.projectile.damage *= 1.25;
                player.actions.primary.buffer *= 1.1;

                console.log(`Damage Buffer installed. New damage: ${player.actions.primary.projectile.damage} - New Buffer: ${player.actions.primary.buffer}`);
            }
        },
        {
            id: "locomotion_module",
            name: "Locomotion Module",
            subtitle: "Primitave locomotion module installed on the user's footwear.",
            icon: "/assets/img/icon/upgrades/speedup.png",
            type: UpgradeType.STAT,
            rarity: UpgradeRarity.COMMON,
            unique: false,
            func: (player: Player) => {
                player.stats.speed += 1;
                player.actions.dash.cooldown *= 1.5;

                console.log(`Locomotion Module installed. New Speed: ${player.stats.speed} - New Dash Cooldown: ${player.actions.dash.cooldown}`);
            }
        },
        //
        // #endregion
        //
        // #region [ UNIQUE ]
        //
        {
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
            id: "kinetic_brain",
            name: "Kinetic Brain",
            subtitle: "Cerebral kinetic stem implant, unable to function at maximum capacity.",
            icon: "/assets/img/icon/upgrades/kineticbrain.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.EPIC,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('kinetic_brain')) {
                    player.unique.push('kinetic_brain');
                }
            }
        },
        {
            id: "phoenix_module",
            name: "Phoenix Module",
            subtitle: "Does its best to keep you alive.",
            icon: "/assets/img/icon/upgrades/phoenixmodule.png",
            type: UpgradeType.UNIQUE,
            rarity: UpgradeRarity.UNCOMMON,
            unique: true,
            func: (player: Player) => {
                if (!player.unique.includes('phoenix_module')) {
                    player.unique.push('phoenix_module');
                }
            }
        },
        { // Luck based, chance to add extra projectiles on shot in random direction.
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
        }
        //
        // #endregion
        //
    ]

    constructor(private ammoReservesUI: AmmoReservesUIController) { }

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
        player.equipment = [];
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