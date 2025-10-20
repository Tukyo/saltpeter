import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Increases stamina, and stamina recovery, but increases regen delay after using.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "bioregulator",
        name: "Bioregulator",
        subtitle: "Increases energy regulation efficiency, with a small boot overhead.",
        icon: "/assets/img/icon/upgrades/stats/bioregulator.png",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: (player: Player) => {
            params.playerState.updateStat('stats.stamina.max', player.stats.stamina.max * 1.1);
            params.playerState.updateStat('stats.stamina.recovery.rate', player.stats.stamina.recovery.rate + 1);
            params.playerState.updateStat('stats.stamina.recovery.delay', player.stats.stamina.recovery.delay * 1.25);
        }
    };
}