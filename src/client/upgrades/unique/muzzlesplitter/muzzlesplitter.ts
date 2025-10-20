import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Luck based, can replace standard shot with split shot.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "muzzle_splitter",
        name: "Muzzle Splitter",
        subtitle: "Muzzle modification for primary attacks, requires certain skillset.",
        icon: "/assets/img/icon/upgrades/unique/muzzlesplitter.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.SPECIAL,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('muzzle_splitter')) {
                player.unique.push('muzzle_splitter');
            }
        }
    };
}