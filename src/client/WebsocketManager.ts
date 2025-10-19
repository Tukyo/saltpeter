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
    ) {}

    /**
     * Used for creating the websocket connection between clients.
     * 
     * Called when joining or creating a room.
     */
    public connectWebSocket(): void {
        const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
        this.ws = new WebSocket(`${wsProtocol}//${location.host}`);

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