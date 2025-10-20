import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Dash replaced with spectral teleport, and increased range. No collisions when dashing.

export function create(params: UpgradeParams): Upgrade {
    return {
        id: "spectral_image",
        name: "Spectral Image",
        subtitle: "Forward imaging coordinate transponder.",
        icon: "/assets/img/icon/upgrades/unique/spectralimage.png",
        type: UpgradeType.UNIQUE,
        rarity: UpgradeRarity.EXCEPTIONAL,
        unique: true,
        func: (player: Player) => {
            if (!player.unique.includes('spectral_image')) {
                player.unique.push('spectral_image');
                params.playerState.updateStat('actions.dash.time', player.actions.dash.time + 50);
            }
        }
    };
}