import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Gives the player some ammo in their reserves.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "care_package",
        name: "Care Package",
        subtitle: "These are hard to come by.",
        icon: "/assets/img/icon/upgrades/resource/carepackage.png",
        type: UpgradeType.RESOURCE,
        rarity: UpgradeRarity.COMMON,
        unique: false,
        func: (player: Player) => {
            const ammo = 20;
            player.actions.primary.magazine.currentReserve += ammo;
            params.ui.ammoReservesUIController.spawnAmmoInReserveUI(ammo);
        }
    };
}