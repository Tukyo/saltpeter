import { PlayerState } from "../PlayerState";

export class LuckController {
    constructor(private playerState: PlayerState) {}

    /**
     * Perform a luck roll using the player's luck stat.
     *
     * Luck is a signed value centered around 0.
     * - Uses tanh() to map luck smoothly into [-1, 1], which gives soft limits.
     * - The resulting chance is 5%–95%, with heavy diminishing returns past ±10.
     *
     * Approximate success odds:
     *   luck -20 → ~5%
     *   luck -10 → ~10%
     *   luck  -5 → ~27%
     *   luck   0 → 50%
     *   luck  +5 → ~73%
     *   luck +10 → ~90%
     *   luck +20 → ~95%
     */
    public luckRoll(): boolean {
        const scaledLuck = Math.tanh(this.playerState.myPlayer.stats.luck / 10);
        const chance = 0.5 + scaledLuck * 0.45;
        return Math.random() < chance;
    }
}