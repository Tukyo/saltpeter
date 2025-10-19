import { GAME } from "./Config";

import { GameState } from "./GameState";
import { RoomManager } from "./RoomManager";
import { Utility } from "./Utility";

export class WebsocketManager {
    private ws: WebSocket | null = null;

    constructor(
        private gameState: GameState,
        private roomManager: RoomManager,
        private utility: Utility
    ) { }

    /**
     * Used for creating the websocket connection between clients.
     * 
     * Called when joining or creating a room.
     */
    public connectWebSocket(): void {
        const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
        let wsHost: string;

        if (location.port === '8888') { // Electron testing → connect to localhost:8080
            wsHost = 'localhost:8080';
            this.ws = new WebSocket(`ws://${wsHost}`);
        } else if (location.port === '9999') { // Electron production → connect to saltpeter.xyz
            wsHost = 'saltpeter.xyz';
            this.ws = new WebSocket(`wss://${wsHost}`);
        } else { // Browser (not Electron)
            wsHost = location.hostname === 'localhost' ? 'localhost:8080' : location.host;
            this.ws = new WebSocket(`${wsProtocol}//${wsHost}`);
        }

        this.ws.onopen = () => {
            console.log("Connected to WebSocket");
            this.roomManager.setWebSocket(this.ws!);
        };

        this.ws.onclose = () => {
            console.log("Disconnected from WebSocket");
            this.gameState.gameInProgress = false;
            this.utility.safeTimeout(() => this.connectWebSocket(), GAME.RECONNECT_DELAY);
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }


    /**
     * Returns the current WebSocket connection.
     */
    public getWebSocket(): WebSocket | null {
        return this.ws;
    }
}