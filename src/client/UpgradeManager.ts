import { Player, Upgrade, UpgradeParams, UpgradeRarity, UpgradeType } from './Types';

import { upgradeFiles } from './upgrades';

import { UserInterface } from './UserInterface';
import { Utility } from './Utility';

import { PlayerState } from './player/PlayerState';
import { PlayerConfig } from './player/PlayerConfig';

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

    public upgrades: Upgrade[] = []

    constructor(
        private playerConfig: PlayerConfig,
        private playerState: PlayerState,
        private ui: UserInterface,
        private utility: Utility
    ) { 
        this.initUpgrades();
    }

    /**
     * Initializes upgrades[] by importing the upgradeFiles from the index.ts in the upgrades folder.
     */
    private initUpgrades(): void {
        const params: UpgradeParams = {
            playerState: this.playerState,
            ui: this.ui,
            utility: this.utility
        };

        upgradeFiles.equipment.forEach(filename => {
            const upgrade = require(`./upgrades/equipment/${filename}/${filename}`).create(params);
            this.upgrades.push(upgrade);
        });

        upgradeFiles.resource.forEach(filename => {
            const upgrade = require(`./upgrades/resource/${filename}/${filename}`).create(params);
            this.upgrades.push(upgrade);
        });

        upgradeFiles.stats.forEach(filename => {
            const upgrade = require(`./upgrades/stats/${filename}/${filename}`).create(params);
            this.upgrades.push(upgrade);
        });

        upgradeFiles.unique.forEach(filename => {
            const upgrade = require(`./upgrades/unique/${filename}/${filename}`).create(params);
            this.upgrades.push(upgrade);
        });
    }

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

        player.equipment = this.playerConfig.default.equipment;
        player.unique = this.playerConfig.default.unique;
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

/**
 Upgrade Ideas:
 ionic compound
 randomly chance to combine all nProjeciles into one
 explosion on dash
 while sprinting, luck doubled
 bullet trails
 projectile with padding on sides = projectiles that are detonated on reload
 on death respawn as 1hp ghost who can melee with .25s invul
 chemistry system
 volatile upgrades

 on hit, chance to instakill player, destroy one of your equipment, only trigger if enemies damage would kill you
 - one time use, destroys itself and another upgrade
 
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