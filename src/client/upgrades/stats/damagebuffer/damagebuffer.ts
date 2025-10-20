import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Increases damage and shot buffer by 10%.
// Bullets hit harder, but can be shot less often each time this is taken. 

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "damage_buffer",
        name: "Damage Buffer",
        subtitle: "Type D125 buffer, which improves damage at a small cost. ",
        icon: "/assets/img/icon/upgrades/stats/damagebuffer.png",
        type: UpgradeType.STAT,
        rarity: UpgradeRarity.UNCOMMON,
        unique: false,
        func: (player: Player) => {
            params.playerState.updateStat('actions.primary.projectile.damage', player.actions.primary.projectile.damage * 1.1);
            params.playerState.updateStat('actions.primary.buffer', player.actions.primary.buffer * 1.1);
        }
    };
}