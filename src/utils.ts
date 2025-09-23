export function generateUID(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateRoomId(): string {
  return 'room_' + Math.random().toString(36).substring(2, 10);
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