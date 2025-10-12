export class AudioPool {
    private pools: Map<string, HTMLAudioElement[]> = new Map();
    private activeAudio: Map<string, HTMLAudioElement[]> = new Map();

    constructor(private poolSize: number = 10, private maxConcurrent: number = 5) { }

    private createPool(src: string): HTMLAudioElement[] {
        const pool: HTMLAudioElement[] = [];
        for (let i = 0; i < this.poolSize; i++) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.addEventListener('ended', () => this.returnToPool(src, audio));
            audio.addEventListener('pause', () => this.returnToPool(src, audio));
            pool.push(audio);
        }
        return pool;
    }

    private returnToPool(src: string, audio: HTMLAudioElement): void {
        const active = this.activeAudio.get(src);
        if (active) {
            const index = active.indexOf(audio);
            if (index > -1) {
                active.splice(index, 1);
            }
        }

        const pool = this.pools.get(src);
        if (pool && !pool.includes(audio)) {
            pool.push(audio);
        }
    }

    public getAudio(src: string): HTMLAudioElement | null {
        // Check if we're at max concurrent instances
        const active = this.activeAudio.get(src) || [];
        if (active.length >= this.maxConcurrent) {
            return null; // Skip playing if too many instances
        }

        // Get or create pool for this sound
        let pool = this.pools.get(src);
        if (!pool) {
            pool = this.createPool(src);
            this.pools.set(src, pool);
            this.activeAudio.set(src, []);
        }

        // Get available audio from pool
        const audio = pool.pop();
        if (audio) {
            // Reset audio properties
            audio.currentTime = 0;
            audio.volume = 1;
            audio.playbackRate = 1;
            audio.loop = false;

            // Move to active list
            active.push(audio);
            return audio;
        }

        return null; // Pool exhausted
    }

    public preloadSound(src: string): void {
        if (!this.pools.has(src)) {
            const pool = this.createPool(src);
            this.pools.set(src, pool);
            this.activeAudio.set(src, []);
        }
    }
}