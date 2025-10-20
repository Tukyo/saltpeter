import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Luck based * 1.5, on death chance to trigger.
// One-time use, double damage received permanently on trigger.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "phoenix_module",
        name: "Phoenix Module",
        subtitle: "Return from the flames with vengeance.",
        icon: "/assets/img/icon/upgrades/unique/phoenixmodule.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.LEGENDARY,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('phoenix_module')) {
                player.unique.push('phoenix_module');
            }
        }
    };
}