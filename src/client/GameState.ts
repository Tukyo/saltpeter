import { GAME } from "./Config";

export class GameState {
    /**
     * Tracks paused state of the application.
     */
    public isPaused = false;

    /**
     * Becomes true when game loop starts.
     * 
     * False when game loop is no longer ongoing (end game, websocket disconnect, leave room)
     */
    public gameInProgress = false;

    /**
     * Max wins needed for session to end.
     */
    public gameMaxWins = GAME.MAX_WINS;

    /**
     * Max players allowed in a game.
     */
    public gameMaxPlayers = GAME.MAX_PLAYERS;

    constructor() {}

    public clear(): void {
        this.gameInProgress = false;
        this.isPaused = false;

        this.gameMaxWins = GAME.MAX_WINS;
        this.gameMaxPlayers = GAME.MAX_PLAYERS;
    }
}