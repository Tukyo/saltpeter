import { LobbyControlsParams, LobbyOptionsParams, LobbyPlayer, SetInputParams, SetToggleParams } from "./Types";

import { UserInterface } from "./UserInterface";
import { RoomManager } from "./RoomManager";
import { Utility } from "./Utility";
import { CharacterManager } from "./CharacterManager";
import { PlayerState } from "./player/PlayerState";
import { PlayerConfig } from "./player/PlayerConfig";

export class LobbyManager {
    public inLobby = false;
    public lobbyPlayers: Map<string, LobbyPlayer> = new Map(); // Temporary partial player object used for lobby only information
    private charCustomizeHandlers: Array<{ element: HTMLElement, handler: () => void }> = []; // Event handlers for lobby customization arrows

    constructor(
        private characterManager: CharacterManager,
        private playerConfig: PlayerConfig,
        private playerState: PlayerState,
        private roomManager: RoomManager,
        private ui: UserInterface,
        private utility: Utility
    ) { }

    // #region [ Lobby Controls ]
    //
    /**
     * Calls updateDisplay to show the lobby specific controls.
     */
    public showLobbyControls(params: LobbyControlsParams): void {
        const { lobby, lobbyOptions, myPlayer, roomId, userId } = params;
        const { isHost, maxWins, privateRoom, upgradesEnabled } = lobbyOptions;

        this.ui.updateDisplay(lobby, "lobby", roomId);

        const centerX = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.width / 2 : 0;
        const centerY = this.ui.charCustomizeCanvas ? this.ui.charCustomizeCanvas.height / 2 : 0;

        // Add myself to lobby
        this.lobbyPlayers.set(userId, {
            id: userId,
            color: myPlayer.color,
            isHost: isHost,
            rig: { //TODO: Load from the user's saved charCustomization
                body: this.playerConfig.default.rig.body,
                head: this.playerConfig.default.rig.head,
                headwear: this.playerConfig.default.rig.headwear,
                weapon: this.playerConfig.default.rig.weapon
            },
            transform: {
                pos: { x: centerX, y: centerY },
                rot: 0
            }
        });

        // Setup lobby inputs/toggles using nested options
        this.setupLobbyOptions(lobbyOptions);

        const winsInputParams: SetInputParams = {
            inputId: "winsInput",
            value: maxWins
        };
        const privateToggleParams: SetToggleParams = {
            toggleId: "privateToggle",
            value: privateRoom
        };
        const upgradesToggleParams: SetToggleParams = {
            toggleId: "upgradesToggle",
            value: upgradesEnabled
        };

        this.utility.setToggle(privateToggleParams);
        this.utility.setToggle(upgradesToggleParams);
        this.utility.setInput(winsInputParams);

        this.ui.displayLobbyPlayers(isHost, lobby, userId);
        this.ui.updateHostDisplay(isHost, lobby);

        window.dispatchEvent(new CustomEvent("customEvent_renderCharacter"));
        this.setupCharacterCustomization();
    }
    //
    // #endregion

    // #region [ Lobby Options ]
    //
    /**
     * Sets up lobby toggles and input for game settings.
     */
    public setupLobbyOptions(params: LobbyOptionsParams): void {
        this.setupLobbyToggle('privateToggle', params.isHost, 'privateRoom', () => params.privateRoom, (val) => params.privateRoom = val);
        this.setupLobbyToggle('upgradesToggle', params.isHost, 'upgradesEnabled', () => params.upgradesEnabled, (val) => params.upgradesEnabled = val);
        this.setupLobbyInput('winsInput', params.isHost, 'maxWins', () => params.maxWins, (val) => params.maxWins = val);
        this.setupLobbyInput('playersInput', params.isHost, 'maxPlayers', () => params.maxPlayers, (val) => params.maxPlayers = val);
    }

    /**
     * Called by setupLobbyOptions - Responsible for toggles.
     */
    private setupLobbyToggle(elementProp: 'privateToggle' | 'upgradesToggle', isHost: boolean, messageKey: string, getter: () => boolean, setter: (val: boolean) => void): void {
        const element = this.ui[elementProp];
        if (!element) return;

        // Store the handler so we can remove it later
        const handlerKey = `${elementProp}Handler` as keyof this;

        // Remove existing listener if it exists
        if (this[handlerKey]) {
            element.removeEventListener('click', this[handlerKey] as EventListener);
        }

        // Create and store the new handler
        const handler = () => {
            if (!isHost) return;

            const newValue = !getter();
            setter(newValue);

            const toggleParams: SetToggleParams = {
                toggleId: elementProp,
                value: newValue
            }
            this.utility.setToggle(toggleParams);

            this.roomManager.sendMessage(JSON.stringify({
                type: 'lobby-options',
                [messageKey]: newValue
            }));

            console.log(`${messageKey} changed to: ${newValue}`);
        };

        // Store handler for later removal & add listener
        (this as any)[handlerKey] = handler;
        element.addEventListener('click', handler);
    }

    /**
     * Called by setupLobbyOptions - Responsible for input fields.
     */
    private setupLobbyInput(elementProp: 'winsInput' | 'playersInput', isHost: boolean, messageKey: string, getter: () => number, setter: (val: number) => void): void {
        const element = this.ui[elementProp];
        if (!element) return;

        // Store the handler so we can remove it later
        const handlerKey = `${elementProp}Handler` as keyof this;

        // Remove existing listener if it exists
        if (this[handlerKey]) {
            element.removeEventListener('change', this[handlerKey] as EventListener);
        }

        // Create and store the new handler
        const handler = () => {
            if (!isHost) return;

            const newValue = parseInt(element.value);
            if (isNaN(newValue) || newValue < 1) {
                element.value = getter().toString();
                return;
            }

            setter(newValue);

            const inputParams: SetInputParams = {
                inputId: elementProp,
                value: newValue
            }
            this.utility.setInput(inputParams);

            this.roomManager.sendMessage(JSON.stringify({
                type: 'lobby-options',
                [messageKey]: newValue
            }));

            console.log(`${messageKey} changed to: ${newValue}`);
        };

        // Store handler for later removal & setup listener
        (this as any)[handlerKey] = handler;
        element.addEventListener('change', handler);
    }

    /**
     * Syncs lobby options when state change messages are received over websocket.
     */
    public syncLobbyOptions(options: any): void {
        this.syncOption(options, 'privateRoom', 'isPrivateRoom', 'privateToggle', this.utility.setToggle.bind(this.utility), 'Lobby privacy', (v) => v ? 'Private' : 'Public');
        this.syncOption(options, 'maxWins', 'gameMaxWins', 'winsInput', this.utility.setInput.bind(this.utility), 'Game max wins');
        this.syncOption(options, 'maxPlayers', 'gameMaxPlayers', 'playersInput', this.utility.setInput.bind(this.utility), 'Game max players');
        this.syncOption(options, 'upgradesEnabled', 'isUpgradesEnabled', 'upgradesToggle', this.utility.setToggle.bind(this.utility), 'Game upgrades toggled');
    }

    /**
     * [DO NOT CALL] Syncs a lobby option - called by syncLobbyOptions.
     */
    private syncOption<T extends SetInputParams | SetToggleParams>(options: any, key: string, prop: string, elementId: string, fn: (params: T) => void, label: string, format?: (v: any) => string): void {
        if (options[key] === undefined) return;

        (this as any)[prop] = options[key];

        // Build params object based on element type
        const params = elementId.includes('Input')
            ? { inputId: elementId, value: options[key] } as T
            : { toggleId: elementId, value: options[key] } as T;

        fn(params);

        const displayValue = format ? format(options[key]) : options[key];
        console.log(`${label} synced to: ${displayValue}`);
    }
    //
    // #endregion

    // #region [ Lobby Player Management ]
    //
    /**
     * Promote specific player to host.
     */
    public promotePlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'promote-player',
            targetPlayerId: playerId
        }));
    }

    /**
     * Kick specific  player from the current lobby.
     */
    public kickPlayer(playerId: string): void {
        this.roomManager.sendMessage(JSON.stringify({
            type: 'kick-player',
            targetPlayerId: playerId
        }));
    }
    //
    // #endregion

    // #region [ Char Customization ]
    //
    /**
     * Initializes the lobby character customization menu buttons.
     */
    public setupCharacterCustomization(): void {
        if (!this.ui.bodyArrowLeft || !this.ui.bodyArrowRight ||
            !this.ui.headArrowLeft || !this.ui.headArrowRight ||
            !this.ui.headwearArrowLeft || !this.ui.headwearArrowRight) return;

        const myLobbyPlayer = this.lobbyPlayers.get(this.playerState.myPlayer.id);
        if (!myLobbyPlayer) return;

        // Remove all old listeners
        this.charCustomizeHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
        this.charCustomizeHandlers = [];

        // Helper to add and track listeners
        const addHandler = (element: HTMLElement, handler: () => void) => {
            this.charCustomizeHandlers.push({ element, handler });
            element.addEventListener('click', handler);
        };

        // Body arrows
        addHandler(this.ui.bodyArrowLeft, () => this.cycleRigVariant('body', -1));
        addHandler(this.ui.bodyArrowRight, () => this.cycleRigVariant('body', 1));

        // Head arrows
        addHandler(this.ui.headArrowLeft, () => this.cycleRigVariant('head', -1));
        addHandler(this.ui.headArrowRight, () => this.cycleRigVariant('head', 1));

        // Headwear arrows
        addHandler(this.ui.headwearArrowLeft, () => this.cycleRigVariant('headwear', -1));
        addHandler(this.ui.headwearArrowRight, () => this.cycleRigVariant('headwear', 1));
    }

    /**
     * Responsible for swapping layers in the character customizer. Arrow buttons call this, via event handlers.
     */
    private cycleRigVariant(rigProp: 'body' | 'head' | 'headwear' | 'weapon', direction: number): void {
        const myLobbyPlayer = this.lobbyPlayers.get(this.playerState.myPlayer.id);
        if (!myLobbyPlayer) return;

        // Get all variants for this layer
        const allVariants = Object.keys(this.characterManager['charConfig'][rigProp]);

        // Find current index
        const currentVariant = myLobbyPlayer.rig[rigProp];
        const currentIndex = allVariants.indexOf(currentVariant);

        // Calculate new index (with wrapping)
        let newIndex = currentIndex + direction;
        if (newIndex < 0) {
            newIndex = allVariants.length - 1; // Wrap to last
        } else if (newIndex >= allVariants.length) {
            newIndex = 0; // Wrap to first
        }

        // Update the rig
        myLobbyPlayer.rig[rigProp] = allVariants[newIndex];

        window.dispatchEvent(new CustomEvent("customEvent_renderCharacter"));
    }
    //
    // #endregion
}