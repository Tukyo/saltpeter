import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Luck based, causes projectiles to sometimes break into shrapnel on impact.
// Varying amounts of pieces can spawn, and shrapnel does 1 damage to any enemy hit.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "cluster_module",
        name: "Cluster Module",
        subtitle: "Cluster enhancement module for primary attacks.",
        icon: "/assets/img/icon/upgrades/unique/clustermodule.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.RARE,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('cluster_module')) {
                player.unique.push('cluster_module');
            }
        }
    };
}