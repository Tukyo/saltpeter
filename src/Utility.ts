import { DirectionParams, RandomColorParams, SetInputParams, SetSliderParams, SetSpanParams, SetToggleParams, Vec2 } from './defs';

export class Utility {
    private lastFrameTime: number;
    private simplexTable: Uint8Array;

    constructor() {
        this.lastFrameTime = performance.now();
        this.simplexTable = this.generateSimplexTable();
    }

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
    //
    // #endregion
    //
    // #region [ Math ]
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
    public getDirection(params: DirectionParams): Vec2 {
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
                hexColor = primaries[Math.floor(Math.random() * primaries.length)];
                break;

            case 'pastel':
                const r = Math.floor(Math.random() * 128 + 127);
                const g = Math.floor(Math.random() * 128 + 127);
                const b = Math.floor(Math.random() * 128 + 127);
                hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                break;

            case 'vibrant':
                const channels = [255, Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                channels.sort(() => Math.random() - 0.5);
                hexColor = `#${channels[0].toString(16).padStart(2, '0')}${channels[1].toString(16).padStart(2, '0')}${channels[2].toString(16).padStart(2, '0')}`;
                break;

            case 'dark':
                const dr = Math.floor(Math.random() * 128);
                const dg = Math.floor(Math.random() * 128);
                const db = Math.floor(Math.random() * 128);
                hexColor = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
                break;

            case 'light':
                const lr = Math.floor(Math.random() * 128 + 128);
                const lg = Math.floor(Math.random() * 128 + 128);
                const lb = Math.floor(Math.random() * 128 + 128);
                hexColor = `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
                break;

            case 'grayscale':
                const gray = Math.floor(Math.random() * 256);
                hexColor = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`;
                break;

            case 'any':
            default:
                hexColor = "#" + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0");
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

    /**
     * Generates the permutation table for simplex noise.
     */
    private generateSimplexTable(): Uint8Array {
        const table = new Uint8Array(512);
        for (let k = 0; k < 256; k++) table[k] = k;
        for (let k = 0; k < 256; k++) {
            const r = k + Math.floor(Math.random() * (256 - k));
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
    //
    // #endregion
    //
    // #region [ Generation ]
    //
    /**
     * Returns a UID using pure random math. With 36 characters defined - 8 character long UID has ~2.8 trillion outcomes.
     */
    public generateUID(length: number, prefix?: string): string {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
        let result = prefix ?? '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
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
    //
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
}