import { CacheManager } from "./CacheManager";
import { UserInterface } from "./UserInterface";

const ADMIN_KEYS = {
    KEYS: ['Control', 'Shift', 'Alt', '-', '+'],
    REQUIRED_COUNT: 5
} as const;

const CONSOLE_KEY = 'Control';

export class Admin {
    private adminKeysHeld: Set<string> = new Set();

    constructor(private cacheManager: CacheManager, private ui: UserInterface) {
        this.initKeyListener();
        this.initConsoleKeybinds();
    }

    // #region [ Admin (Locked) ]
    //
    /**
     * Listens for admin key combo and shows modal when detected.
     */
    private initKeyListener(): void {
        window.addEventListener('keydown', (e) => {
            this.adminKeysHeld.add(e.key);
            this.checkAdminCombo();
        });

        window.addEventListener('keyup', (e) => {
            this.adminKeysHeld.delete(e.key);
        });
    }

    /**
     * Checks held keys against the ADMIN_KEYS configuration.
     */
    private checkAdminCombo(): void {
        const hasAllKeys = ADMIN_KEYS.KEYS.every(key => this.adminKeysHeld.has(key));

        if (hasAllKeys && this.adminKeysHeld.size === ADMIN_KEYS.REQUIRED_COUNT) {
            this.adminKeysHeld.clear(); // Prevent repeated triggers
            this.showAdminModal();
        }
    }

    /**
     * Shows the admin modal using the general website modal.
     */
    private showAdminModal(): void {
        if (!this.ui.modal || !this.ui.modalInput || !this.ui.modalConfirmButton ||
            !this.ui.modalCancelButton || !this.ui.modalErrorDiv || !this.ui.modalText) return;

        this.ui.modal.classList.remove('hidden');
        this.ui.modalConfirmButton.classList.remove('hidden');

        this.ui.modalInput.value = '';
        this.ui.modalInput.style.display = 'block';
        this.ui.modalErrorDiv.textContent = '';
        this.ui.modalText.textContent = 'Enter Admin Command.';
        this.ui.modalConfirmButton.textContent = 'Execute';
        this.ui.modalCancelButton.textContent = 'Cancel';

        this.ui.modalInput.focus();

        this.ui.modalConfirmButton.onclick = () => {
            if (!this.ui.modalInput || !this.ui.modalErrorDiv) return;

            const value = this.ui.modalInput.value.trim();
            if (!value.includes(':')) {
                this.ui.modalErrorDiv.textContent = 'Invalid format.';
                return;
            }

            const [command, key] = value.split(':');
            if (!command || !key) {
                this.ui.modalErrorDiv.textContent = 'Invalid format.';
                return;
            }

            this.executeAdminCommand(command.trim(), key.trim());
            this.ui.closeModal();
        };

        this.ui.modalCancelButton.onclick = () => this.ui.closeModal();
    }

    /**
     * Executes a command that is in the input field of the admin modal.
     */
    private executeAdminCommand(command: string, key: string): void {
        // This will be called from your main game class with the WebSocket
        console.log(`Admin command: ${command} with key: ${key}`);

        // You'll expose this via a callback or event system
        this.onAdminCommand?.(command, key);
    }

    // Public callback for Client.ts
    public onAdminCommand?: (command: string, key: string) => void;

    //
    // #endregion

    // #region [ Console ]
    //
    /**
     * Clears cache with tilde key
     */
    private initConsoleKeybinds(): void {
        document.addEventListener('keydown', (e) => {
            if (!e.getModifierState(CONSOLE_KEY)) return;
            if (e.key === '`') { e.preventDefault(); this.clearCacheCommand(); }
        });
    }

    private clearCacheCommand(): void {
        this.cacheManager.clear().then(() => {
            console.log('Cache cleared! Reload the page.');
            location.reload();
        });
    }
    //
    // #endregion
}