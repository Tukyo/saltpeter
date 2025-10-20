import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Allows player's rotation to slightly influence projectile direction.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "spatial_targeting",
        name: "Spatial Targeting",
        subtitle: "Projectile upgrade that syncs its spatial awareness with the user.",
        icon: "/assets/img/icon/upgrades/unique/spatialtargeting.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.SUPERIOR,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('spatial_targeting')) {
                player.unique.push('spatial_targeting');
            }
        }
    };
}