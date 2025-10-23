import { CharacterConfig } from "./CharacterConfig";
import { CharacterLayer } from "./Types";

export class CharacterManager {
    constructor(private charConfig: CharacterConfig) { }

    public getCharacterAsset(layer: CharacterLayer, variant: string): string | string[] {
        switch (layer) {
            case 'BODY':
                return this.charConfig.body[variant as keyof typeof this.charConfig.body] || this.charConfig.body.default;
            case 'WEAPON':
                return this.charConfig.weapon[variant as keyof typeof this.charConfig.weapon] || this.charConfig.weapon.glock;
            case 'HEAD':
                return this.charConfig.head[variant as keyof typeof this.charConfig.head] || this.charConfig.head.default;
            case 'HEADWEAR':
                return this.charConfig.headwear[variant as keyof typeof this.charConfig.headwear] || this.charConfig.headwear.default;
            case 'UPGRADES':
                return variant;
            default:
                throw new Error(`Unknown character layer: ${layer}`);
        }
    }

    public getUpgradeVisual(upgradeName: string): string | null {
        const lowerName = upgradeName.toLowerCase();
        return this.charConfig.upgrades[lowerName as keyof typeof this.charConfig.upgrades] || null;
    }
}