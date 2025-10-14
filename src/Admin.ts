import { UserInterface } from "./UserInterface";

export class Admin {
    private adminKeysHeld: Set<string> = new Set();

    constructor(private ui: UserInterface) {
        this.initKeyListener();
    }

    private initKeyListener(): void {
        window.addEventListener('keydown', (e) => {
            this.adminKeysHeld.add(e.key);
            this.checkAdminCombo();
        });

        window.addEventListener('keyup', (e) => {
            this.adminKeysHeld.delete(e.key);
        });
    }

    private checkAdminCombo(): void {
        const hasCtrl = this.adminKeysHeld.has('Control');
        const hasShift = this.adminKeysHeld.has('Shift');
        const hasAlt = this.adminKeysHeld.has('Alt');
        const hasMinus = this.adminKeysHeld.has('-');
        const hasPlus = this.adminKeysHeld.has('+');

        if (hasCtrl && hasShift && hasAlt && hasMinus && hasPlus) {
            this.adminKeysHeld.clear(); // Prevent repeated triggers
            this.showAdminModal();
        }
    }

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

    private executeAdminCommand(command: string, key: string): void {
        // This will be called from your main game class with the WebSocket
        console.log(`Admin command: ${command} with key: ${key}`);
        
        // You'll expose this via a callback or event system
        this.onAdminCommand?.(command, key);
    }

    // Public callback that your main game class will set
    public onAdminCommand?: (command: string, key: string) => void;
}