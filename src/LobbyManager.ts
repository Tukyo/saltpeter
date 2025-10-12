import { LobbyPlayer, Player, SetInputParams, SetToggleParams } from "./defs";
import { UserInterface } from "./UserInterface";
import { RoomManager } from "./RoomManager";
import { Utility } from "./Utility";

export class LobbyManager {
    public inLobby = false;
    public lobbyPlayers: Map<string, LobbyPlayer> = new Map(); // Temporary partial player object used for lobby only information

    constructor(private utility: Utility, private ui: UserInterface, private roomManager: RoomManager) {}

    // #region [ Lobby Controls ]
    //
    /**
     * Calls updateDisplay to show the lobby specific controls.
     */
    public showLobbyControls(
        gameMaxPlayers: number,
        gameMaxWins: number,
        isHost: boolean,
        isPrivateRoom: boolean,
        isUpgradesEnabled: boolean,
        lobby: LobbyManager,
        myPlayer: Player,
        roomId: string,
        userId: string,
    ): void {
        this.ui.updateDisplay(lobby, "lobby", roomId);

        // Add myself to lobby
        this.lobbyPlayers.set(userId, {
            id: userId,
            color: myPlayer.color,
            isHost: isHost
        });

        this.setupLobbyOptions(
            gameMaxPlayers,
            gameMaxWins,
            isHost,
            isPrivateRoom,
            isUpgradesEnabled
        );

        const winsInputParams: SetInputParams = {
            inputId: 'winsInput',
            value: gameMaxWins
        }
        const privateToggleParams: SetToggleParams = {
            toggleId: 'privateToggle',
            value: isPrivateRoom
        }
        const upgradesToggleParams: SetToggleParams = {
            toggleId: 'upgradesToggle',
            value: isUpgradesEnabled
        }

        this.utility.setToggle(privateToggleParams);
        this.utility.setToggle(upgradesToggleParams)
        this.utility.setInput(winsInputParams);

        this.ui.displayLobbyPlayers(isHost, lobby, userId);
        this.ui.updateHostDisplay(isHost, lobby);
    }
    //
    // #endregion

    // #region [ Lobby Options ]
    //
    /**
     * Sets up lobby toggles and input for game settings.
     */
    private setupLobbyOptions(
        gameMaxPlayers: number,
        gameMaxWins: number,
        isHost: boolean,
        isPrivateRoom: boolean,
        isUpgradesEnabled: boolean,
    ): void {
        this.setupLobbyToggle('privateToggle', isHost, 'privateRoom', () => isPrivateRoom, (val) => isPrivateRoom = val);
        this.setupLobbyToggle('upgradesToggle', isHost, 'upgradesEnabled', () => isUpgradesEnabled, (val) => isUpgradesEnabled = val);
        this.setupLobbyInput('winsInput', isHost, 'maxWins', () => gameMaxWins, (val) => gameMaxWins = val);
        this.setupLobbyInput('playersInput', isHost, 'maxPlayers', () => gameMaxPlayers, (val) => gameMaxPlayers = val);
    }

    /**
     * Called by setupLobbyOptions - Responsible for toggles.
     */
    private setupLobbyToggle(
        elementProp: 'privateToggle' | 'upgradesToggle',
        isHost: boolean,
        messageKey: string,
        getter: () => boolean,
        setter: (val: boolean) => void
    ): void {
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
    private setupLobbyInput(
        elementProp: 'winsInput' | 'playersInput',
        isHost: boolean,
        messageKey: string,
        getter: () => number,
        setter: (val: number) => void
    ): void {
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
    private syncOption<T extends SetInputParams | SetToggleParams>(
        options: any,
        key: string,
        prop: string,
        elementId: string,
        fn: (params: T) => void,
        label: string,
        format?: (v: any) => string
    ): void {
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
}