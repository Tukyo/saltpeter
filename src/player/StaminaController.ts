import { PlayerState } from "./PlayerState";

export class StaminaController {
    constructor(private playerState: PlayerState) { }

    // #region [ Stamina ]
    //
    /**
     * Requests stamina from my pool for actions that require it.
     * 
     * If there is enough, drain the needed stamina and return true.
     */
    public requestStamina(amount: number): boolean {
        if (this.playerState.myPlayer.stats.stamina.value < amount) {
            console.log(`Insufficient stamina! Need: ${amount}, Have: ${this.playerState.myPlayer.stats.stamina}`);
            return false;
        }

        this.playerState.myPlayer.stats.stamina.value -= amount;

        // Block stamina recovery for the delay period
        this.playerState.isStaminaRecoveryBlocked = true;
        this.playerState.staminaRecoveryBlockedUntil = Date.now() + this.playerState.myPlayer.stats.stamina.recovery.delay;

        console.log(`Stamina drained: -${amount}, Remaining: ${this.playerState.myPlayer.stats.stamina}`);
        return true;
    }

    /**
     * Process stamina requests and recovery.
     */
    public updateStamina(delta: number): void {
        const currentTime = Date.now();

        // Handle sprint stamina drain (every second while sprinting)
        if (this.playerState.isSprinting && currentTime >= this.playerState.lastStaminaDrainTime + 100) {
            if (!this.requestStamina(this.playerState.myPlayer.actions.sprint.drain)) {
                // Out of stamina, stop sprinting
                this.playerState.isSprinting = false;
                console.log('Out of stamina, stopped sprinting');
            }
            this.playerState.lastStaminaDrainTime = currentTime;
        }

        // Handle stamina recovery
        if (!this.playerState.isStaminaRecoveryBlocked || currentTime >= this.playerState.staminaRecoveryBlockedUntil) {
            this.playerState.isStaminaRecoveryBlocked = false;

            // Recover stamina if not at max and not sprinting
            if (this.playerState.myPlayer.stats.stamina.value < this.playerState.myPlayer.stats.stamina.max && !this.playerState.isSprinting) {
                const staminaRecoveryPerFrame = (this.playerState.myPlayer.stats.stamina.recovery.rate / 1000) * 16.67 * delta;
                this.playerState.myPlayer.stats.stamina.value = Math.min(this.playerState.myPlayer.stats.stamina.max, this.playerState.myPlayer.stats.stamina.value + staminaRecoveryPerFrame);
            }
        }
    }
    //
    // #endregion
}