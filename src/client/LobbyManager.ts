import { PLAYER_DEFAULTS } from "./Config";
import { LobbyControlsParams, LobbyOptionsParams, LobbyPlayer, SetInputParams, SetToggleParams } from "./Types";

import { UserInterface } from "./UserInterface";
import { RoomManager } from "./RoomManager";
import { Utility } from "./Utility";
import { CharacterManager } from "./CharacterManager";
import { PlayerState } from "./player/PlayerState";

export class LobbyManager {
    public inLobby = false;
    public lobbyPlayers: Map<string, LobbyPlayer> = new Map(); // Temporary partial player object used for lobby only information

    constructor(
        private characterManager: CharacterManager,
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

        // Add myself to lobby
        this.lobbyPlayers.set(userId, {
            id: userId,
            color: myPlayer.color,
            isHost: isHost,
            rig: { //TODO: Load from the user's saved charCustomization
                body: PLAYER_DEFAULTS.RIG.BODY,
                head: PLAYER_DEFAULTS.RIG.HEAD,
                headwear: PLAYER_DEFAULTS.RIG.HEADWEAR,
                weapon: PLAYER_DEFAULTS.RIG.WEAPON
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

        this.renderLobbyPlayer();
        this.setupCharacterZoom();
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
    private customizeDrawSize: number = 200;
    private cachedCharImages: Map<string, HTMLImageElement> = new Map();
    private charCustomizeHandlers: Array<{ element: HTMLElement, handler: () => void }> = [];

    public renderLobbyPlayer(): void {
        if (!this.inLobby) return;

        const myLobbyPlayer = this.lobbyPlayers.get(this.playerState.myPlayer.id);
        if (!myLobbyPlayer || !this.ui.charCustomizeCanvas) return;

        const ctx = this.ui.charCustomizeCanvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, this.ui.charCustomizeCanvas.width, this.ui.charCustomizeCanvas.height);

        const centerX = this.ui.charCustomizeCanvas.width / 2;
        const centerY = this.ui.charCustomizeCanvas.height / 2;

        // Collect all layers to draw in order
        const layersToDraw = [
            { layer: 'BODY' as const, variant: myLobbyPlayer.rig.body },
            { layer: 'HEAD' as const, variant: myLobbyPlayer.rig.head },
            { layer: 'WEAPON' as const, variant: myLobbyPlayer.rig.weapon },
            { layer: 'HEADWEAR' as const, variant: myLobbyPlayer.rig.headwear }
        ];

        const imagesToDraw: Array<{ img: HTMLImageElement, order: number }> = [];

        // Count TOTAL images to load (not just layers)
        let totalImages = 0;
        layersToDraw.forEach(({ layer, variant }) => {
            const assets = this.characterManager.getCharacterAsset(layer, variant);
            const assetArray = typeof assets === 'string' ? [assets] : assets;
            totalImages += assetArray.length;
        });

        let loadedCount = 0;

        // Load all images first
        layersToDraw.forEach(({ layer, variant }, layerOrder) => {
            const assets = this.characterManager.getCharacterAsset(layer, variant);
            const assetArray = typeof assets === 'string' ? [assets] : assets;

            assetArray.forEach((assetPath: string) => {
                // Check cache first
                let img = this.cachedCharImages.get(assetPath);

                if (img && img.complete) {
                    // Image already loaded, use it immediately
                    imagesToDraw.push({ img, order: layerOrder });
                    loadedCount++;

                    if (loadedCount === totalImages) {
                        this.drawAllLayers(ctx, imagesToDraw, centerX, centerY);
                    }
                } else {
                    // Load and cache the image
                    const newImg = new Image(); // Use const here instead of reusing img
                    newImg.src = assetPath;
                    this.cachedCharImages.set(assetPath, newImg);

                    newImg.onload = () => {
                        imagesToDraw.push({ img: newImg, order: layerOrder });
                        loadedCount++;

                        if (loadedCount === totalImages) {
                            this.drawAllLayers(ctx, imagesToDraw, centerX, centerY);
                        }
                    };
                }
            });
        });
    }

    private drawAllLayers(ctx: CanvasRenderingContext2D, imagesToDraw: Array<{ img: HTMLImageElement, order: number }>, centerX: number, centerY: number): void {
        if (!this.ui.charCustomizeCanvas) return;

        ctx.clearRect(0, 0, this.ui.charCustomizeCanvas.width, this.ui.charCustomizeCanvas.height);

        // Sort by layer order and draw
        imagesToDraw.sort((a, b) => a.order - b.order);
        imagesToDraw.forEach(item => {
            ctx.drawImage(item.img, centerX - this.customizeDrawSize / 2, centerY - this.customizeDrawSize / 2, this.customizeDrawSize, this.customizeDrawSize);
        });
    }


    public setupCharacterZoom(): void {
        if (!this.ui.charCustomizeCanvas) return;

        this.ui.charCustomizeCanvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault(); // Prevent page scroll

            const zoomSpeed = 10;
            const minSize = 100;
            const maxSize = 500;

            // Scroll up = zoom in (larger), scroll down = zoom out (smaller)
            if (e.deltaY < 0) {
                this.customizeDrawSize = Math.min(this.customizeDrawSize + zoomSpeed, maxSize);
            } else {
                this.customizeDrawSize = Math.max(this.customizeDrawSize - zoomSpeed, minSize);
            }

            // Re-render with new size
            this.renderLobbyPlayer();
        });
    }

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
        addHandler(this.ui.bodyArrowLeft, () => this.cycleRigVariant('body', 'BODY', -1));
        addHandler(this.ui.bodyArrowRight, () => this.cycleRigVariant('body', 'BODY', 1));

        // Head arrows
        addHandler(this.ui.headArrowLeft, () => this.cycleRigVariant('head', 'HEAD', -1));
        addHandler(this.ui.headArrowRight, () => this.cycleRigVariant('head', 'HEAD', 1));

        // Headwear arrows
        addHandler(this.ui.headwearArrowLeft, () => this.cycleRigVariant('headwear', 'HEADWEAR', -1));
        addHandler(this.ui.headwearArrowRight, () => this.cycleRigVariant('headwear', 'HEADWEAR', 1));
    }

    private cycleRigVariant(rigProp: 'body' | 'head' | 'headwear' | 'weapon', configProp: 'BODY' | 'HEAD' | 'HEADWEAR' | 'WEAPON', direction: number): void {
        const myLobbyPlayer = this.lobbyPlayers.get(this.playerState.myPlayer.id);
        if (!myLobbyPlayer) return;

        // Get all variants for this layer
        const allVariants = Object.keys(this.characterManager['charConfig'][configProp]);

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

        // Re-render
        this.renderLobbyPlayer();
    }
    //
    // #endregion
}