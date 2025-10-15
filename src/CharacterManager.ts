import { CharacterConfig } from "./CharacterConfig";
import { CharacterLayer } from "./Types";

export class CharacterManager {
    constructor(private charConfig: CharacterConfig) { }

    public getCharacterAsset(layer: CharacterLayer, variant: string): string | string[] {
        switch (layer) {
            case 'BODY':
                return this.charConfig.BODY[variant as keyof typeof this.charConfig.BODY] || this.charConfig.BODY.DEFAULT;
            case 'WEAPON':
                return this.charConfig.WEAPON[variant as keyof typeof this.charConfig.WEAPON] || this.charConfig.WEAPON.GLOCK;
            case 'HEAD':
                return this.charConfig.HEAD[variant as keyof typeof this.charConfig.HEAD] || this.charConfig.HEAD.DEFAULT;
            case 'HEADWEAR':
                return this.charConfig.HEADWEAR[variant as keyof typeof this.charConfig.HEADWEAR] || this.charConfig.HEADWEAR.DEFAULT;
            case 'UPGRADES':
                return variant;
            default:
                throw new Error(`Unknown character layer: ${layer}`);
        }
    }

    public getUpgradeVisual(upgradeName: string): string | null {
        const upperName = upgradeName.toUpperCase();
        return this.charConfig.UPGRADES[upperName as keyof typeof this.charConfig.UPGRADES] || null;
    }
}