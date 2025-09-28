import { PLAYER } from './config';

const takenUniques = new Set<string>();
const myEquipment = new Set<string>();

enum UpgradeRarity {
    COMMON = 0,
    UNCOMMON = 1,
    RARE = 2,
    EPIC = 3,
    LEGENDARY = 4
}
enum UpgradeType {
    STAT = 'stat',
    UNIQUE = 'unique',
    EQUIPMENT = 'equipment'
}

interface Upgrade {
    id: string;
    name: string;
    subtitle: string;
    type: UpgradeType;
    rarity: UpgradeRarity;
    unique: boolean;
    func: () => void;
}

const RARITY_CONFIG = {
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

export const UPGRADES: Upgrade[] = [
    // #region [ STATS ]
    //
    {
        id: "bigger_is_better",
        name: "Bigger is Better",
        subtitle: "Have my bullets always been this big?",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: () => {
            PLAYER.PROJECTILE.SIZE *= 1.1;
            PLAYER.PROJECTILE.DAMAGE *= 1.05;
            PLAYER.PROJECTILE.SPREAD *= 1.025;

            console.log(`Upgrade taken: Bigger is Better`);
        }
    },
    {
        id: "bigger_is_worse",
        name: "Bigger is Worse?",
        subtitle: "Big boned.",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: () => {

        }
    },
    {
        id: "smaller_is_better",
        name: "Smaller is Better",
        subtitle: "Have I always been this small?",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: () => {
            PLAYER.VISUAL.SIZE *= 0.9;
            PLAYER.STATS.MAX_HEALTH = Math.max(1, Math.floor(PLAYER.STATS.MAX_HEALTH * 0.95));

            console.log(`Upgrade taken: Smaller is Better`);
        }
    },
    //
    // #endregion
    //
    // #region [ EQUIPMENT ]
    //
    // {
    //     id: "",
    //     name: "",
    //     subtitle: "",
    //     type: UpgradeType.EQUIPMENT,
    //     rarity: UpgradeRarity.COMMON,
    //     unique: false,
    //     func: () => {

    //     }
    // },
    //
    // #endregion
    //
    // #region [ UNIQUE ]
    //
    // {
    //     id: "",
    //     name: "",
    //     subtitle: "",
    //     type: UpgradeType.UNIQUE,
    //     rarity: UpgradeRarity.COMMON,
    //     unique: true,
    //     func: () => {

    //     }
    // }
    //
    // #endregion
    //
]

export function getUpgrades(count: number): Upgrade[] {
    // Filter available upgrades based on type restrictions
    const availableUpgrades = UPGRADES.filter(upgrade => {
        if (upgrade.unique && takenUniques.has(upgrade.id)) {
            return false;
        }

        if (upgrade.type === UpgradeType.EQUIPMENT && myEquipment.has(upgrade.id)) {
            return false;
        }

        return true;
    });

    // Weighted random selection using rarity config
    const selected: Upgrade[] = [];

    for (let i = 0; i < Math.min(count, availableUpgrades.length); i++) {
        if (availableUpgrades.length === 0) break;

        // Calculate weighted random selection using RARITY_CONFIG
        const totalWeight = availableUpgrades.reduce((sum, upgrade) => {
            return sum + RARITY_CONFIG[upgrade.rarity].weight;
        }, 0);

        let random = Math.random() * totalWeight;
        let selectedUpgrade: Upgrade | null = null;

        for (const upgrade of availableUpgrades) {
            random -= RARITY_CONFIG[upgrade.rarity].weight;
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

// Helper function to get rarity color
export function getRarityColor(rarity: UpgradeRarity): string {
    return RARITY_CONFIG[rarity].color;
}

// Helper function to get rarity weight
export function getRarityWeight(rarity: UpgradeRarity): number {
    return RARITY_CONFIG[rarity].weight;
}

export function applyUpgrade(upgradeId: string): boolean {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return false;

    // Double-check restrictions
    if (upgrade.unique && takenUniques.has(upgradeId)) return false;
    if (upgrade.type === UpgradeType.EQUIPMENT && myEquipment.has(upgradeId)) return false;

    // Track locally
    if (upgrade.type === UpgradeType.EQUIPMENT) {
        myEquipment.add(upgradeId);
    }
    if (upgrade.unique) {
        takenUniques.add(upgradeId); // Add locally immediately
    }

    // Apply the upgrade
    upgrade.func();
    return true;
}

export function removeUpgradeFromPool(upgradeId: string): void {
    takenUniques.add(upgradeId);
}

export function resetUpgrades(): void {
    takenUniques.clear();
    myEquipment.clear();
}