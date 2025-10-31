import { Direction, NoiseType, RandomColorParams, SetInputParams, SetSliderParams, SetSpanParams, SetToggleParams, TextAnimParams, Vec2 } from './Types';

export class Utility {
    private lastFrameTime: number;
    private simplexTable: Uint8Array;
    private activeTimeouts: Set<number>;

    constructor() {
        this.lastFrameTime = performance.now();
        this.simplexTable = this.generateSimplexTable();
        this.activeTimeouts = new Set();
    }

    // #region [ General ]
    //

    public deepMerge(target: any, source: any): void {
        for (const key in source) {
            if (
                source[key] !== null &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key])
            ) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /** Yields to next animation frame (~16ms) allowing UI updates and optional progress message. */
    public async yield(message?: string): Promise<void> {
        console.log(`[Yield] ${message ?? "(no message)"}`);
        
        if (message) {
            document.dispatchEvent(new CustomEvent("yieldMessage", { detail: { message } }));
        } else {
            document.dispatchEvent(new CustomEvent("yieldProgress"));
        }

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }

    //
    // #endregion

    // #region [ Time ]
    //
    /**
     * Calculates and returns delta time.
     * 
     * https://en.wikipedia.org/wiki/Delta_timing
     */
    public deltaTime(): number {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Normalize to 60fps (16.67ms per frame)
        // Cap at 100ms to prevent huge jumps during lag spikes
        return Math.min(delta, 100) / 16.67;
    }

    /**
     * Overrides 'setTimeout' with safe processing.
     * 
     * Timeouts are stored in the 'activeTimeouts' set - allowing stale timeouts to be cleared.
     */
    public safeTimeout(callback: () => void, delay: number): number {
        const id = window.setTimeout(() => {
            this.activeTimeouts.delete(id);
            callback();
        }, delay);
        this.activeTimeouts.add(id);
        return id;
    }

    /**
     * Clears all active timeouts from the activeTimeouts cache.
     */
    public clearTimeoutCache(): void {
        this.activeTimeouts.forEach(id => window.clearTimeout(id));
        this.activeTimeouts.clear();
    }
    //
    // #endregion
    //
    // #region [ Math ]
    /**
     * Returns a random number.
     * 
     * Optionally pass the decimals if you want the returned value trimmed.
     */
    public getRandomNum(min: number, max: number, decimals?: number): number {
        const value = Math.random() * (max - min) + min;

        if (decimals !== undefined) {
            return parseFloat(value.toFixed(decimals));
        }

        return value;
    }

    /**
     * Returns a random int between the passed min/max values.
     */
    public getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Returns a random position in an array.
     */
    public getRandomInArray<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Returns a shuffled copy of an array.
     */
    public getShuffledArray<T>(array: T[]): T[] {
        return array.slice().sort(() => Math.random() - 0.5);
    }

    /**
     * Returns the dot product of two 2D vectors.
     */
    public getDotProduct(v1: Vec2, v2: Vec2): number {
        return v1.x * v2.x + v1.y * v2.y;
    }

    /**
     * Reflects a velocity vector off a surface normal.
     * Formula: V' = V - 2(V·N)N
     */
    public getReflection(velocity: Vec2, normal: Vec2): Vec2 {
        const dot = this.getDotProduct(velocity, normal);
        return {
            x: velocity.x - 2 * dot * normal.x,
            y: velocity.y - 2 * dot * normal.y
        };
    }
    //
    // #endregion
    //
    // #region [ Direction ]
    //
    /**
     * Returns the forward facing direction of the passed rotation.
     */
    public forward(rot: number): Vec2 {
        return { x: Math.cos(rot), y: Math.sin(rot) };
    }

    /**
     * Gets the current aim direction of the local player.
     */
    public getDirection(params: Direction): Vec2 {
        const dx = params.targetPos.x - params.rootPos.x;
        const dy = params.targetPos.y - params.rootPos.y;

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return { x: 0, y: 0 }; // avoid NaN

        return { x: dx / distance, y: dy / distance };
    }

    /**
     * Returns a random based on the degree radius.
     */
    public getRandomDirection(degrees: number): Vec2 {
        const randomAngle = Math.random() * (degrees * Math.PI / 180);
        const direction = { x: Math.cos(randomAngle), y: Math.sin(randomAngle) }
        return direction;
    }
    //
    // #endregion
    //
    // #region [ Visual ]
    /**
     * Returns a random color. With no params passed, color will be completely random hex.
     * 
     * Params can be used to return color templates in either hex or RGB.
     */
    public getRandomColor(params?: RandomColorParams): string {
        const format = params?.format ?? 'hex';
        const mode = params?.mode ?? 'any';

        let hexColor: string;

        switch (mode) {
            case 'primary':
                const primaries = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];
                hexColor = this.getRandomInArray(primaries);
                break;

            case 'pastel':
                const r = this.getRandomInt(127, 254);
                const g = this.getRandomInt(127, 254);
                const b = this.getRandomInt(127, 254);
                hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                break;

            case 'vibrant':
                const channels = [255, this.getRandomInt(0, 255), this.getRandomInt(0, 255)];
                channels.sort(() => Math.random() - 0.5);
                hexColor = `#${channels[0].toString(16).padStart(2, '0')}${channels[1].toString(16).padStart(2, '0')}${channels[2].toString(16).padStart(2, '0')}`;
                break;

            case 'dark':
                const dr = this.getRandomInt(0, 127);
                const dg = this.getRandomInt(0, 127);
                const db = this.getRandomInt(0, 127);
                hexColor = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
                break;

            case 'light':
                const lr = this.getRandomInt(128, 255);
                const lg = this.getRandomInt(128, 255);
                const lb = this.getRandomInt(128, 255);
                hexColor = `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
                break;

            case 'grayscale':
                const gray = this.getRandomInt(0, 255);
                hexColor = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`;
                break;

            case 'any':
            default:
                hexColor = "#" + this.getRandomInt(0, 0xFFFFFF).toString(16).padStart(6, "0");
                break;
        }

        // Convert to requested format
        if (format === 'rgb') {
            const rgb = this.hexToRgb(hexColor);
            if (!rgb) return hexColor; // Fallback to hex if conversion fails
            return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }

        return hexColor;
    }

    /**
     * Returns the lightest color from a hex color array.
     */
    public getLightestColor(colors: string[]): string {
        let lightestColor = colors[0];
        let maxBrightness = 0;

        for (const color of colors) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);

            // Calculate perceived brightness
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

            if (brightness > maxBrightness) {
                maxBrightness = brightness;
                lightestColor = color;
            }
        }

        return lightestColor;
    }

    /**
     * Converts hex color code to RGB.
     */
    public hexToRgb(hex: string): { r: number, g: number, b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    //
    // #endregion
    //
    // #region [ Noise ]
    //
    // - Simplex
    /**
     * Generates the permutation table for simplex noise.
     */
    private generateSimplexTable(): Uint8Array {
        const table = new Uint8Array(512);
        for (let k = 0; k < 256; k++) table[k] = k;
        for (let k = 0; k < 256; k++) {
            const r = k + this.getRandomInt(0, 255 - k);
            [table[k], table[r]] = [table[r], table[k]];
        }
        for (let k = 0; k < 256; k++) table[256 + k] = table[k];
        return table;
    }

    /**
     * 2D noise function using Simplex.
     * 
     * https://en.wikipedia.org/wiki/Simplex_noise
     */
    public simplexNoise2D(x: number, y: number, override: boolean = false): number {
        if (override) { this.simplexTable = this.generateSimplexTable(); }

        const perm = this.simplexTable;

        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);

        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;

        const gi0 = perm[ii + perm[jj]] % 12;
        const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
        const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

        const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
        [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
        [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

        const dot = (g: number[], x: number, y: number) => g[0] * x + g[1] * y;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        let n0 = t0 < 0 ? 0 : Math.pow(t0, 4) * dot(grad3[gi0], x0, y0);

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        let n1 = t1 < 0 ? 0 : Math.pow(t1, 4) * dot(grad3[gi1], x1, y1);

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        let n2 = t2 < 0 ? 0 : Math.pow(t2, 4) * dot(grad3[gi2], x2, y2);

        return 70.0 * (n0 + n1 + n2);
    }

    // - Seeded
    //
    /**
     * Helper function to switch between noise types
     */
    public getNoise(noiseType: NoiseType, x: number, y: number, seed: number, options?: any): number {
        switch (noiseType) {
            case NoiseType.Perlin:
                return this.perlinNoise(
                    x,
                    y,
                    seed,
                    options?.octaves ?? 1,
                    options?.persistence ?? 0.5
                );
            case NoiseType.Ridged:
                return this.ridgedNoise(x, y, seed, options?.octaves ?? 1, options?.persistence ?? 0.5);
            case NoiseType.Worley:
                return this.worleyNoise(
                    x,
                    y,
                    seed,
                    Math.max(1, Math.floor(options?.octaves ?? 1))
                );
            case NoiseType.Voronoi:
                return this.voronoiNoise(x, y, seed);
            default:
                return this.perlinNoise(x, y, seed);
        }
    }

    /**
     * Creates a noise pattern deterministically with a seed.
     * 
     * Optionally pass the octaves and persistence to effect the noise outcome.
     */
    private perlinNoise(x: number, y: number, seed: number, octaves: number = 1, persistence: number = 1): number {
        let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.interpolateNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return total / maxValue;
    }

    private ridgedNoise(x: number, y: number, seed: number, octaves: number = 1, persistence: number = 0.5): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            let noise = this.interpolateNoise(x * frequency, y * frequency, seed + i * 1000);
            noise = 1 - Math.abs(noise); // Invert to create ridges
            total += noise * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue; // Already [0,1] because of the inversion
    }

    private worleyNoise(x: number, y: number, seed: number, pointsPerCell: number = 1): number {
        const cellX = Math.floor(x);
        const cellY = Math.floor(y);
        let minDist = Infinity;

        // Check 3x3 neighborhood
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cx = cellX + dx;
                const cy = cellY + dy;

                for (let p = 0; p < pointsPerCell; p++) {
                    // Use hash to get pseudo-random point in cell [0,1)
                    const px = cx + this.hash2D(cx, cy, seed + p * 10000);
                    const py = cy + this.hash2D(cx, cy, seed + p * 10000 + 1);
                    const dx = x - px;
                    const dy = y - py;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist) minDist = dist;
                }
            }
        }

        // Normalize: max distance in unit grid is ~1.5
        return this.normalize(minDist / 1.5);
    }

    private voronoiNoise(x: number, y: number, seed: number): number {
        return this.worleyNoise(x, y, seed, 1);
    }
    // - Noise Helpers
    //
    /**
     * Generates a deterministic pseudo-random value from integer coordinates and a seed.
     * 
     * Uses a fast 2D hash function to produce a normalized float in [0, 1].
     */
    public hash2D(x: number, y: number, seed: number): number {
        const n = x * 374761393 + y * 668265263 + seed;
        const hash = (n ^ (n >> 13)) * 1274126177;
        return ((hash ^ (hash >> 16)) & 0x7fffffff) / 0x7fffffff;
    }

    /**
     * Helper function to interpolate the seededNoise function.
     * 
     * Performs bilinear interpolation with smoothstep weighting between four hashed grid points.
     */
    private interpolateNoise(x: number, y: number, seed: number): number {
        const ix = Math.floor(x), fx = x - ix;
        const iy = Math.floor(y), fy = y - iy;

        const v1 = this.hash2D(ix, iy, seed);
        const v2 = this.hash2D(ix + 1, iy, seed);
        const v3 = this.hash2D(ix, iy + 1, seed);
        const v4 = this.hash2D(ix + 1, iy + 1, seed);

        const sx = this.smoothstep(fx);
        const sy = this.smoothstep(fy);

        const i1 = this.lerp(v1, v2, sx);
        const i2 = this.lerp(v3, v4, sx);
        return this.lerp(i1, i2, sy);
    }

    /** Smoothly blends from 0 to 1. */
    public smoothstep(t: number): number { return t * t * (3 - 2 * t); }

    /** Linear blend between a and b. */
    public lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

    /** Normalizes a value. */
    public normalize(value: number): number { return Math.max(0, Math.min(1, value)); }
    //
    // #endregion

    // #region [ Generation ]
    //
    /**
     * Returns a UID using pure random math. With 36 characters defined - 8 character long UID has ~2.8 trillion outcomes.
     */
    public generateUID(length: number, prefix?: string): string {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
        let result = prefix ?? '';
        for (let i = 0; i < length; i++) {
            result += chars[this.getRandomInt(0, chars.length - 1)];
        }
        return result;
    }

    /**
     * Generate a custom link using the url from the window object.
     * 
     * Example: generateLink(abc123, 'room'); Result: https://www.link.com/?room=abc123
     */
    public generateLink(value: string, param?: string): string {
        const base = window.location.origin;
        if (param) {
            return `${base}?${param}=${value}`;
        }
        return `${base}?${value}`;
    }
    //
    // #endregion

    // #region [ DOM ]
    //
    /**
     * Sets the value of the chosen HTMLInputElement in the DOM.
     */
    public setInput(params: SetInputParams): void {
        const inputElement = document.getElementById(params.inputId) as HTMLInputElement | null;
        if (inputElement) {
            inputElement.value = params.value.toString();
        }
    }

    /**
     * Sets a specific slider to a specific value.
     * 
     * Slider must have a base element and a fill element. Optionally lerp the value between the target and the current, using the max.
     */
    public setSlider(params: SetSliderParams): void {
        const { sliderId, targetValue, maxValue, lerpTime = 0 } = params;

        const sliderContainer = document.getElementById(sliderId);
        const sliderFill = sliderContainer?.querySelector('div') as HTMLElement;

        if (!sliderContainer || !sliderFill) {
            console.warn(`Slider not found: ${sliderId}...`);
            return;
        }

        if (maxValue === 0) {
            console.warn("maxValue cannot be 0...");
            return;
        }

        // Clamp target value between 0 and maxValue
        const clampedTarget = Math.max(0, Math.min(maxValue, targetValue));
        const targetPercentage = (clampedTarget / maxValue) * 100;

        // Get current width percentage
        const currentWidthStr = sliderFill.style.width || '100%';
        const currentPercentage = parseFloat(currentWidthStr.replace('%', ''));

        // If already at target, no animation needed
        if (Math.abs(currentPercentage - targetPercentage) < 0.1) return;

        // If lerpTime is <= 0, directly set the slider to the targetValue
        if (lerpTime <= 0) {
            sliderFill.style.transition = 'none';
            sliderFill.style.width = `${targetPercentage}%`;
            return;
        }

        // Animate using CSS transition
        sliderFill.style.transition = `width ${lerpTime}ms ease-out`;
        sliderFill.style.width = `${targetPercentage}%`;

        // Clear transition after animation completes to avoid interfering with future updates
        setTimeout(() => {
            if (sliderFill) {
                sliderFill.style.transition = '';
            }
        }, lerpTime);
    }

    /**
     * Update a span element with a specific number or string.
     */
    public setSpan(params: SetSpanParams): void {
        const spanElement = document.getElementById(params.spanId);

        if (!spanElement) {
            console.warn(`Span not found: ${params.spanId}`);
            return;
        }

        spanElement.textContent = params.value.toString();
    }

    /**
     * Updates the attributes of a toggle element for reference.
     */
    public setToggle(params: SetToggleParams): void {
        const toggle = document.getElementById(params.toggleId);
        if (toggle) {
            if (params.value) {
                toggle.setAttribute('checked', 'true');
                toggle.setAttribute('aria-checked', 'true');
            } else {
                toggle.removeAttribute('checked');
                toggle.setAttribute('aria-checked', 'false');
            }
        }
    }
    //
    // #endregion

    // #region [ Animation ]
    //
    /**
     * Can be used to animate most elements with text on the page.
     * 
     * Element must have '.style.color' and '.textContent'.
     */
    public animateTextInElement(params: TextAnimParams): void {
        const increment = (params.newValue - params.oldValue) / params.steps;
        const stepTime = params.animTime / params.steps;

        let currentStep = 0;
        let currentValue = params.oldValue;

        // Set color
        params.element.style.color = params.color;

        const interval = setInterval(() => {
            currentStep++;
            currentValue += increment;

            if (currentStep >= params.steps) {
                params.element.textContent = params.newValue.toFixed(params.decimals);
                clearInterval(interval);

                // Reset color after animation
                setTimeout(() => {
                    params.element.style.color = '';
                }, params.timeout);
            } else {
                params.element.textContent = currentValue.toFixed(params.decimals);
            }
        }, stepTime);
    }
    //
    // #endregion
}