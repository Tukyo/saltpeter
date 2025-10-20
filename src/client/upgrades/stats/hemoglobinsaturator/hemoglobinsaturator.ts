import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Increases the player's max health.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "hemoglobin_saturator",
        name: "Hemoglobin Saturator",
        subtitle: "Increases red blood cell density for extended durability.",
        icon: "/assets/img/icon/upgrades/stats/hemoglobinsaturator.png",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.UNCOMMON,
        unique: false,
        func: (player: Player) => {
            params.playerState.updateStat('stats.health.max', player.stats.health.max + 10);
            params.playerState.updateStat('stats.health.value', player.stats.health.max); // Heal to new max
        }
    };
}