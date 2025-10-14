import { AnimationParams, CharacterAnimation, Vec2 } from "./Types";

import { RoomManager } from "./RoomManager";

import { PlayerState } from "./player/PlayerState";
import { NETWORK } from "./Config";

export class Animator {
    private characterAnimations: CharacterAnimation = new Map();
    public characterOffsets: Map<string, Vec2> = new Map();

    constructor(private playerState: PlayerState, private roomManager: RoomManager, private userId: string) { }

    // #region [ Animation ]
    /**
     * Animates a specific character part locally with generateCharacterAnimation and broadcasts for other clients to sync animations.
     */
    public animateCharacterPart(params: AnimationParams): void {
        this.generateCharacterAnimation(params);

        this.roomManager.sendMessage(JSON.stringify({
            type: 'character-animation',
            params: params
        }));
    }

    /**
     * Rotates a specific part of a player with the passed rotation.
     */
    public rotateCharacterPart(playerId: string, rotation: number): void {
        if (playerId === this.userId) {
            this.playerState.myPlayer.transform.rot = rotation;
        } else {
            const player = this.playerState.players.get(playerId);
            if (!player) return;
            player.transform.rot = rotation;
        }

        const now = Date.now();
        const rotationDiff = Math.abs(rotation - this.playerState.lastSentRotation);
        if (rotationDiff > 0.1 && now - this.playerState.lastSentRotationTime >= NETWORK.ROTATE_INTERVAL) {
            this.roomManager.sendMessage(JSON.stringify({
                type: 'player-move',
                transform: {
                    rot: this.playerState.myPlayer.transform.rot
                }
            }));

            this.playerState.lastSentRotation = rotation;
            this.playerState.lastSentRotationTime = now;
        }
    }

    /**
     * Responds to a network request to process a character animation.
     */
    public animateCharacterPartNetwork(params: AnimationParams): void {
        this.generateCharacterAnimation(params);
    }

    /**
     * Assembles the character animation and adds it to the characterAnimations mapping for playback during update processing.
     */
    private generateCharacterAnimation(params: AnimationParams): void {
        const { playerId, part, frames, duration, partIndex } = params;
        const animationId = `${playerId}_${part}_${partIndex || 0}`;

        this.characterAnimations.set(animationId, {
            playerId: playerId,
            part: part,
            partIndex: partIndex,
            frames: frames,
            duration: duration,
            startTime: Date.now(),
            originalOffset: { x: 0, y: 0 }
        });
    }

    /**
     * Process visual character animations by updating part positions.
     */
    public updateCharacterAnimations(delta: number): void {
        const animationsToRemove: string[] = [];
        const currentTime = Date.now();

        this.characterAnimations.forEach((animation, animationId) => {
            const elapsed = currentTime - animation.startTime;
            const progress = elapsed / animation.duration;

            if (animation.duration !== 0 && progress >= 1) {
                // Animation complete, remove it
                animationsToRemove.push(animationId);
                return;
            }

            // Find current keyframe
            const frameKeys = Object.keys(animation.frames).map(Number).sort((a, b) => a - b);
            let currentFrameIndex = 0;

            for (let i = 0; i < frameKeys.length - 1; i++) {
                const frameProgress = frameKeys[i];
                const nextFrameProgress = frameKeys[i + 1];

                if (progress >= frameProgress && progress < nextFrameProgress) {
                    currentFrameIndex = i;
                    break;
                }
            }

            let lerpedX, lerpedY;
            if (progress >= 1) { // Hold at last keyframe for infinite animation
                const lastFrame = animation.frames[frameKeys[frameKeys.length - 1]];
                lerpedX = lastFrame.x;
                lerpedY = lastFrame.y;
            } else { // Normal animation with no lerp
                const currentFrame = animation.frames[frameKeys[currentFrameIndex]];
                const nextFrame = animation.frames[frameKeys[currentFrameIndex + 1]] || currentFrame;
                const frameProgress = (progress - frameKeys[currentFrameIndex]) / (frameKeys[currentFrameIndex + 1] - frameKeys[currentFrameIndex]) || 0;
                lerpedX = currentFrame.x + (nextFrame.x - currentFrame.x) * frameProgress;
                lerpedY = currentFrame.y + (nextFrame.y - currentFrame.y) * frameProgress;
            }

            this.characterOffsets.set(animationId, { x: lerpedX, y: lerpedY });
        });

        // Remove completed animations
        animationsToRemove.forEach(id => {
            this.characterAnimations.delete(id);
            if (this.characterOffsets) {
                this.characterOffsets.delete(id);
            }
        });
    }
    //
    // #endregion
}