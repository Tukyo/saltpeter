import { OBJECT_DEFAULTS } from "./Config";
import { AmmoBox, GameObject, SpawnObjectParams } from "./Types";

import { Utility } from "./Utility";

import { PlayerState } from "./player/PlayerState";

export class ObjectsManager {
    public ammoBoxes: Map<string, AmmoBox> = new Map();

    constructor(private playerState: PlayerState, private utility: Utility) {}

    // #region [ Objects ]
    //
    /**
     * Spawns a GameObject in the scene, returning it's properties for the construction.
     */
    private spawnObject(params: SpawnObjectParams): GameObject {
        const baseObject: GameObject = {
            id: this.utility.generateUID(OBJECT_DEFAULTS.DATA.ID_LENGTH),
            transform: params.transform,
            timestamp: Date.now()
        };

        switch (params.type) { //TODO: Spawn the player, projectiles and any other GameObject types here
            case 'AmmoBox':
                return {
                    id: baseObject.id,
                    transform: baseObject.transform,
                    timestamp: baseObject.timestamp,
                    ammoAmount: params.data?.amount || 10,
                    isOpen: false,
                    lid: {
                        pos: { x: 0, y: 0 },
                        rot: 0,
                        velocity: { x: 0, y: 0 },
                        torque: 0
                    }
                } as AmmoBox;

            default:
                throw new Error(`Unknown object type: ${params.type}`);
        }
    }

    /**
     * Constructs an ammo box and returns the spawned object instantiated through spawnObject.
     */
    public spawnAmmoBox(amount: number): AmmoBox {
        return this.spawnObject({
            type: 'AmmoBox',
            transform: {
                pos: {
                    x: this.playerState.myPlayer.transform.pos.x,
                    y: this.playerState.myPlayer.transform.pos.y
                },
                rot: this.playerState.myPlayer.transform.rot
            },
            data: { amount }
        }) as AmmoBox;
    }
    //
    // #endregion
}