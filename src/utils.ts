import { PLAYER_DEFAULTS, ROOM } from './config';
import { Vec2 } from './defs';

export function generateUID(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < PLAYER_DEFAULTS.DATA.ID_LENGTH; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

export function generateRoomId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = ROOM.ID_PREFIX;
    for (let i = 0; i < ROOM.ID_LENGTH; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

export function createRoomLink(roomId: string): string {
    return `${window.location.origin}?room=${roomId}`;
}

export function updateURLWithRoom(roomId: string): void {
    const newURL = `${window.location.origin}?room=${roomId}`;
    window.history.pushState({ roomId }, '', newURL);
}

export function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


export function getRandomInArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export function getRandomColor(): string {
    const color = "#" + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0");
    return color;
}

export function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function forward(rot: number): Vec2 {
    return { x: Math.cos(rot), y: Math.sin(rot) };
}

// #region [ UI Utilities ]
//
export function setSlider(sliderId: string, targetValue: number, maxValue: number = 100, lerpTime: number = 300): void {
    const sliderContainer = document.getElementById(sliderId);
    const sliderFill = sliderContainer?.querySelector('div') as HTMLElement;

    if (!sliderContainer || !sliderFill) {
        console.warn(`Slider not found: ${sliderId}`);
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

export function setHudValue(spanId: string, value: string | number): void {
    const spanElement = document.getElementById(spanId);

    if (!spanElement) {
        console.warn(`HUD element not found: ${spanId}`);
        return;
    }

    spanElement.textContent = value.toString();
}

export function updateToggle(toggleId: string, isChecked: boolean): void {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
        if (isChecked) {
            toggle.setAttribute('checked', 'true');
            toggle.setAttribute('aria-checked', 'true');
        } else {
            toggle.removeAttribute('checked');
            toggle.setAttribute('aria-checked', 'false');
        }
    }
}

export function updateInput(inputId: string, value: number): void {
    const inputElement = document.getElementById(inputId) as HTMLInputElement | null;
    if (inputElement) {
        inputElement.value = value.toString();
    }
}
//
// #endregion