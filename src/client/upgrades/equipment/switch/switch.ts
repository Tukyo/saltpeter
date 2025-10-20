import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// During dash cooldown, player will be able to hold shoot to auto-fire.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "switch",
        name: "Switch",
        subtitle: "Completely legal and completely functional.",
        icon: "/assets/img/icon/upgrades/equipment/switch.png",
        type: UpgradeType.EQUIPMENT,
        rarity: UpgradeRarity.RARE,
        unique: false,
        func: (player: Player) => {
            if (!player.equipment.includes('switch')) {
                player.equipment.push('switch');
                params.playerState.updateStat('actions.primary.projectile.spread', player.actions.primary.projectile.spread *= 1.15);
            }
        }
    };
}