import { ROOM } from './config';

export function generateUID(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < ROOM.USER_ID_LENGTH; i++) {
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

export function getRoomIdFromURL(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

export function updateURLWithRoom(roomId: string): void {
    const newURL = `${window.location.origin}?room=${roomId}`;
    window.history.pushState({ roomId }, '', newURL);
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