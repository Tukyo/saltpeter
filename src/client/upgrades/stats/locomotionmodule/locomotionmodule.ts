import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Increases speed but also increases dash cooldown.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "locomotion_module",
        name: "Locomotion Module",
        subtitle: "Primitave locomotion module installed on the user's footwear.",
        icon: "/assets/img/icon/upgrades/stats/locomotionmodule.png",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: (player: Player) => {
            params.playerState.updateStat('stats.speed', player.stats.speed + 1);
            params.playerState.updateStat('actions.dash.cooldown', player.actions.dash.cooldown * 1.5);
        }
    };
}