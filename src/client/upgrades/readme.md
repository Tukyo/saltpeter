# Creating Custom Upgrades

## Quick Start
1. Create a new folder for your script in the upgrade type directory. *(see structure below)*
2. Add a new typescript script to that folder, and use the template below to get started.
3. Add to category index: `[upgradetype]/index.ts` *(this is in the same folder where you added the mod)*
4. Place 60x60px icon in correct folder within the public assets. *(see structure below)*
5. Open a pull request.

## Params
> You can include additional scripts you create for the upgrade and put them in the folder.
> 
> Import them into your script and use the `func:` block to run your custom script!

- `params.playerState` - Modify player stats
- `params.ui` - Access UI controllers
- `params.utility` - Helper functions

## Upgrade Structure
Folder name, icon and script name should all be the name of your upgrade with **no spaces** and **no capitalized letters**.

**Example:** `myupgrade.ts` | `upgradefoldername` | `upgradeiconname.png`

The id and name of the upgrade within your script should be formatted as such.

**Example** id: `name_with_underscores` name: `Name Proper Casing`

**Equipment**
- Index: [`index.ts`](./equipment/index.ts)
- Icon: [`public/assets/img/icon/upgrades/equipment/`](../../../public/assets/img/icon/upgrades/equipment/)
- Script: [`src/client/upgrades/equipment/`](../../client/upgrades/equipment/)

**Resource**
- Index: [`index.ts`](./resource/index.ts)
- Icon: [`public/assets/img/icon/upgrades/resource/`](../../../public/assets/img/icon/upgrades/resource/)
- Script: [`src/client/upgrades/resource/`](../../client/upgrades/resource/)

**Stats**
- Index: [`index.ts`](./stats/index.ts)
- Icon: [`public/assets/img/icon/upgrades/stats/`](../../../public/assets/img/icon/upgrades/stats/)
- Script: [`src/client/upgrades/stats/`](../../client/upgrades/stats/)

**Unique**
- Index: [`index.ts`](./unique/index.ts)
- Icon: [`public/assets/img/icon/upgrades/unique/`](../../../public/assets/img/icon/upgrades/unique/)
- Script: [`src/client/upgrades/unique/`](../../client/upgrades/unique/)

## Template
`/src/client/upgrades/equipment/steeltoedboots/steeltoedboots.ts`
```typescript
import { Upgrade, UpgradeType, UpgradeRarity, Player, UpgradeParams } from '../../../Types';

// Add a comment here about what the upgrade does. It can be long or short, but it should be all inclusive of what the upgrade changes.

// Let's pretend we are adding boots that increase the player's defense.
export function create(params: UpgradeParams): Upgrade {
    return {
        id: "steel_toed_boots",
        name: "Steel Toed Boots",
        subtitle: "What in tarnation!",
        icon: "/assets/img/icon/upgrades/equipment/steeltoedboots/steeltoedboots.png",
        type: UpgradeType.EQUIPMENT,
        rarity: UpgradeRarity.UNCOMMON,
        unique: false,
        func: (player: Player) => {
            if (!player.equipment.includes('steel_toed_boots')) {
                player.equipment.push('steel_toed_boots');
                params.playerState.updateStat(
                    'stats.defense',
                    player.stats.defense + 5
                );
            }
        }
    };
}
```