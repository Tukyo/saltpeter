import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Luck based, creates visible aura around player.
// Enemy projectiles in radius have a chance to be deflected.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "kinetic_brain",
        name: "Kinetic Brain",
        subtitle: "Cerebral kinetic stem implant, unable to function at maximum capacity.",
        icon: "/assets/img/icon/upgrades/unique/kineticbrain.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.EXCEPTIONAL,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('kinetic_brain')) {
                player.unique.push('kinetic_brain');
            }
        }
    };
}