import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Luck based, chance to add extra projectiles on shot in random direction.
// Extra shots have more spread, less distance and do half damage.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "projectile_array",
        name: "Projectile Array",
        subtitle: "Chance to fire an array of extra projectiles.",
        icon: "/assets/img/icon/upgrades/unique/projectilearray.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.RARE,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('projectile_array')) {
                player.unique.push('projectile_array');
            }
        }
    };
}