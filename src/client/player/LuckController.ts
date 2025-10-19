import { PlayerState } from "./PlayerState";

export class LuckController {
    constructor(private playerState: PlayerState) { }

    /**
     * Perform a luck roll using the player's luck stat.
     *
     * Luck is a signed value centered around 0.
     * - Uses tanh() to map luck smoothly into [-1, 1], which gives soft limits.
     * - The resulting chance is 5%–95%, with heavy diminishing returns past ±10.
     *
     * Approximate success odds:
     *   luck -20 → ~2%
     *   luck -10 → ~4%
     *   luck  -5 → ~6%
     *   luck   0 → 10%
     *   luck  +5 → 17%
     *   luck +10 → 30%
     *   luck +20 → 45%
     * 
     * Optionally pass a multiplier to scale luck.
     */
    public luckRoll(multiplier: number = 1): boolean {
        const effectiveLuck = this.playerState.myPlayer.stats.luck * multiplier;
        const scaledLuck = Math.tanh(effectiveLuck / 10);

        const baseChance = 0.1; // 10%
        const softCap = 0.35; // 35%

        const chance = baseChance + scaledLuck * softCap;
        return Math.random() < chance;
    }
}