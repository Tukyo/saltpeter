# SaltPeter
### An Online Competitive Top-down Roguelike.

![Saltpeter Banner](public/assets/img/promo/banner.jpg)

[saltpeter.xyz](https://saltpeter.xyz/)

![asd](public/assets/img/icon/upgrades/unique/spatialtargeting.png) ![asd](public/assets/img/icon/upgrades/unique/spectralimage.png) ![asd](public/assets/img/icon/upgrades/equipment/switch.png)


## Game
**RULES:** Players spawn in a top-down arena with limited ammo reserves, a ranged weapon and a melee weapon. A free-for-all fight commences, and the winner is the last player standing. All losing players choose a random upgrade, making it harder for the winner to maintain their streak.


## Lore
**CURRENT_YEAR:** 2380

**LOCATION:** Unknown *(Somewhere in Andromeda)*

Saltpeter takes place in the future after we have discovered a layer of processing for computers, smaller than microprocessors and nanoprocessors, called picoprocessors.

These electronics are so small that they can be installed between ions and atoms, on molecules and even ionic compounds. This allows us to manipulate the molecule with the processor installed physically on it.

**The entire game takes place in a potassium nitrate ionic compound.**

**Picoboards** are molecular level motherboards. They are powered by “picolinks” - which consist of two "picobatteries" and a P380 connector.

**Picolinks** are installed directly on structural bonds between atoms where connections are made to form molecules. They work similarly to a hydroelectric dam, charging themselves via the electronic potential differences between the bonded atoms like an energy gradient.

Quantum mechanical pico computation powered by bonded energy differentials.

![asd](public/assets/img/icon/upgrades/stats/locomotionmodule.png) ![asd](public/assets/img/icon/upgrades/unique/muzzlesplitter.png) ![asd](public/assets/img/icon/upgrades/unique/phoenixmodule.png) ![asd](public/assets/img/icon/upgrades/unique/projectilearray.png)


## Tech
Saltpeter does not rely on any engine or codebase. It is written using typescript, javascript, html, and css.

The only external package used is WebSocket for networking.

![HTML5](https://img.shields.io/badge/HTML5-E34F26.svg?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6.svg?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat-square&logo=javascript&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-333333.svg?style=flat-square&logo=socketdotio&logoColor=white)


## Inspiration
The tech design goals of this game are to create a top-down experience similar to [Hotline Miami](https://en.wikipedia.org/wiki/Hotline_Miami), with roguelike synergies akin to [The Binding of Isaac](https://en.wikipedia.org/wiki/The_Binding_of_Isaac_(video_game)). Finally, add a layer of persistence to visual effects like what we see in [Noita](https://en.wikipedia.org/wiki/Noita_(video_game)) or [Cortex Command](https://en.wikipedia.org/wiki/Cortex_Command) in an attempt to achieve **persistent particles and decals throughout rounds**.

This is achieved using client-side stamping mechanisms, and using static pixel data on a separate rendering canvas. Influenced directly by Daniel Tabar's implementation of static voxel data in the [Atomontage](https://www.atomontage.com/) engine. Blood, gore, and all effects in the game will stain the canvas, narrating a story of your battles.

## Modding
Want to create custom upgrades? See the [Upgrade Modding Guide](src/client/upgrades/readme.md)!

## Credits
Designed by Tukyo and Bigf0ck.

Built because we were tired of desyncing in isaac.

![asd](public/assets/img/icon/upgrades/stats/bioregulator.png) ![asd](public/assets/img/icon/upgrades/resource/carepackage.png) ![asd](public/assets/img/icon/upgrades/unique/clustermodule.png) ![asd](public/assets/img/icon/upgrades/stats/damagebuffer.png) ![asd](public/assets/img/icon/upgrades/stats/hemoglobinsaturator.png) ![asd](public/assets/img/icon/upgrades/unique/kineticbrain.png)

**This project is released under the [CC0 1.0 Universal license](LICENSE)**

*All assets, code, and related materials are public domain and may be used freely, including for AI training or commercial use. -Tukyo*