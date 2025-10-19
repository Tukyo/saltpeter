
import http from "http";
import fs from "fs";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";

// =============================================================================
// #region CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY || "123";
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = HEARTBEAT_INTERVAL * 2; // 1 minute
const INACTIVITY_TIMEOUT = CLEANUP_INTERVAL * 5; // 5 Minutes
const SPAWN_MIN_DISTANCE = 120;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BORDER_MARGIN = 15;

interface ConnectedClient extends WebSocket {
  isAlive: boolean;
  currentRoom: string | null;
  userId: string | null;
}

interface Room {
  hostUserId: string;
  participants: Set<ConnectedClient>;
  lastActivityTime: number;
  isPrivate: boolean;
  upgradesEnabled: boolean;
  maxWins: number;
  maxPlayers: number;
  gameActive: boolean;
  roundActive: boolean;
  alivePlayers: Set<string>;
  playerHealth: Map<string, number>;
  playerMaxHealth: Map<string, number>;
  spawnMap?: { [playerId: string]: { x: number; y: number } };
}

interface RoomMessage {
  type: string;
  roomId: string;
  userId: string;
  message?: string;
  key?: string;
  data?: any;
  id?: string;
}

type Vec2 = { x: number, y: number }
//
// #endregion
// =============================================================================

// =============================================================================
// #region STATE
// =============================================================================

const rooms = new Map(); // roomId -> RoomState

//
// #endregion
// =============================================================================

// =============================================================================
// #region HTTP SERVER
// =============================================================================

// Create HTTP server to serve files
const server = http.createServer((req, res) => {
  if (!req.url) return;

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Check if there's a room query parameter - serve index.html
  if (url.pathname === '/' && url.searchParams.has('room')) {
    let filePath = path.join(process.cwd(), "public", "index.html");

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("File not found");
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // Handle quickplay endpoint
  if (req.url === "/quickplay") {
    const availableRooms: { roomId: string; playerCount: number }[] = [];

    rooms.forEach((room, roomId) => {
      // Only consider rooms with at least 1 connected player
      if (!room.gameActive && !room.isPrivate && room.participants.size > 0 && room.participants.size < room.maxPlayers) {
        availableRooms.push({
          roomId: roomId,
          playerCount: room.participants.size
        });
      }
    });

    if (availableRooms.length === 0) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No available rooms" }));
      return;
    }

    // Pick random room
    const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ roomId: randomRoom.roomId }));
    return;
  }

  // Handle room redirect
  if (req.url && req.url.startsWith("/room_")) {
    const roomId = req.url.split("/")[1]; // remove leading slash
    res.writeHead(302, { Location: `/?room=${roomId}` });
    return res.end();
  }

  let filePath = req.url === "/" ? "/index.html" : req.url;

  if (filePath === "/app.js") {
    filePath = path.join(process.cwd(), "dist", "app.js");
  } else {
    filePath = path.join(process.cwd(), "public", filePath);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("File not found");
    }

    const ext = path.extname(filePath);
    let contentType = "text/html";
    if (ext === ".js") contentType = "application/javascript";
    if (ext === ".css") contentType = "text/css";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

//
// #endregion
// =============================================================================

// =============================================================================
// #region WEBSOCKET
// =============================================================================

// Attach WebSocket server to the same HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  const client = ws as ConnectedClient;

  console.log("New client connected!");
  client.currentRoom = null;
  client.userId = null;
  client.isAlive = true;

  client.on('pong', () => {
    client.isAlive = true;
  });

  client.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleRoomMessage(client, message);
    } catch (error) {
      // Handle plain text messages (backwards compatibility)
      console.log(`Received plain message: ${data}`);
      if (client.currentRoom) {
        broadcastToRoom(client.currentRoom, {
          type: 'room-message',
          userId: client.userId || 'anonymous',
          message: data.toString()
        }, client);
      }
    }
  });

  client.on("close", () => {
    console.log("Client disconnected.");
    if (client.currentRoom) {
      leaveRoom(client, client.currentRoom);
    }
  });
});

//
// #endregion
// =============================================================================

// =============================================================================
// #region CONNECTIONS
// =============================================================================

// Detect dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as ConnectedClient;

    if (client.isAlive === false) {
      console.log('Terminating dead connection for user:', client.userId);
      if (client.currentRoom) {
        leaveRoom(client, client.currentRoom);
      }
      return client.terminate();
    }

    client.isAlive = false;
    client.ping();
  });
}, HEARTBEAT_INTERVAL);

// Cleanup stale rooms
const cleanupInterval = setInterval(() => {
  let cleanedRooms = 0;

  console.log(`Checking ${rooms.size} rooms for cleanup.`);

  rooms.forEach((room, roomId) => {
    // Check if all participants are actually connected
    const connectedParticipants = new Set<ConnectedClient>();

    room.participants.forEach((ws: ConnectedClient) => {
      if (ws.readyState === WebSocket.OPEN) {
        connectedParticipants.add(ws);
      } else {
        console.log(`Removing disconnected participant ${ws.userId} from room ${roomId}`);
      }
    });

    room.participants = connectedParticipants;

    // Check for inactivity
    const inactiveTime = Date.now() - room.lastActivityTime;
    if (inactiveTime > INACTIVITY_TIMEOUT) {
      console.log(`Room ${roomId} inactive for 10 minutes, closing...`);

      kickPlayersFromRoom(roomId, 'inactivity');

      rooms.delete(roomId);
      cleanedRooms++;
      console.log(`Cleaned up inactive room ${roomId}`);
      return;
    }

    // Delete room if empty
    if (room.participants.size === 0) {
      rooms.delete(roomId);
      cleanedRooms++;
      console.log(`Cleaned up empty room ${roomId}`);
    }
  });

  if (cleanedRooms > 0) {
    console.log(`Cleanup complete: removed ${cleanedRooms} stale room(s). Active rooms: ${rooms.size}`);
  }
}, CLEANUP_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
  clearInterval(cleanupInterval);
});

//
// #endregion
// =============================================================================

// =============================================================================
// #region ROOM MESSAGE
// =============================================================================

function handleRoomMessage(ws: ConnectedClient, message: RoomMessage): void {
  const handlers: { [key: string]: () => void } = {
    'create-room': () => createRoom(ws, message.roomId, message.userId),
    'join-room': () => joinRoom(ws, message.roomId, message.userId),
    'leave-room': () => leaveRoom(ws, message.roomId),
    'room-message': () => handleGameMessage(ws, message),
    'admin-command': () => handleAdminCommand(ws, message)
  };

  const handler = handlers[message.type];
  if (handler) {
    handler();
  }
}

function handleGameMessage(ws: ConnectedClient, message: RoomMessage): void {
  if (ws.currentRoom !== message.roomId || !message.message) return;

  const room = rooms.get(message.roomId);
  if (room) {
    room.lastActivityTime = Date.now();
  }

  try {
    const gameData = JSON.parse(message.message);

    // Process special game messages
    if (gameData.type === 'start-game') {
      handleStartGame(message.roomId, message.userId, gameData);
    } else if (gameData.type === 'player-state') {
      const room = rooms.get(message.roomId);
      if (room && gameData.stats?.health?.max) {
        room.playerMaxHealth.set(message.userId, gameData.stats.health.max);
      }
    } else if (gameData.type === 'new-round') {
      const room = rooms.get(message.roomId);
      if (room) {
        const spawnMap = startNewRoundServer(message.roomId, gameData.reservedSpawn);
        gameData.spawnMap = spawnMap;
        message.message = JSON.stringify(gameData);
      }

      broadcastToRoom(message.roomId, {
        type: 'room-message',
        userId: message.userId,
        message: message.message,
        roomId: message.roomId
      }, null);
      return;
    } else if (gameData.type === 'player-hit') {
      handlePlayerHealthUpdate(message.roomId, gameData.targetId, gameData.newHealth);
    } else if (gameData.type === 'lobby-options') {
      handleLobbyOptions(message.roomId, message.userId, gameData);
    } else if (gameData.type === 'promote-player') {
      const room = rooms.get(message.roomId);
      if (room) {
        room.hostUserId = gameData.targetPlayerId;
        console.log(`${gameData.targetPlayerId} promoted to host of ${message.roomId}`);
      }
    }
  } catch (e) {
    // Not JSON, just pass through
  }

  broadcastToRoom(message.roomId, {
    type: 'room-message',
    userId: message.userId,
    message: message.message,
    roomId: message.roomId
  }, ws);
}

//
// #endregion
// =============================================================================

// =============================================================================
// #region GAME LOGIC
// =============================================================================

function handleStartGame(roomId: string, userId: string, gameData: any): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.gameActive = true;
  room.roundActive = true;

  room.alivePlayers.clear();
  room.playerHealth.clear();

  room.participants.forEach((client: ConnectedClient) => {
    if (client.userId) {
      room.alivePlayers.add(client.userId);
      const maxHealth = room.playerMaxHealth.get(client.userId) || 100;
      room.playerHealth.set(client.userId, maxHealth);
    }
  });

  room.spawnMap = generateSpawnMap(room, userId, gameData.reservedSpawn);
  gameData.spawnMap = room.spawnMap;

  console.log(`Game started in room ${roomId}`);
}

function generateSpawnMap(room: Room, hostUserId: string, reservedSpawn: Vec2) {
  const spawnMap: { [playerId: string]: Vec2 } = { [hostUserId]: reservedSpawn };
  const usedSpawns: Vec2[] = [reservedSpawn];

  room.participants.forEach((client: ConnectedClient) => {
    if (!client.userId || spawnMap[client.userId]) return;

    const spawn = findValidSpawn(usedSpawns);
    usedSpawns.push(spawn);
    spawnMap[client.userId] = spawn;
  });

  return spawnMap;
}

function findValidSpawn(usedSpawns: Vec2[]): Vec2 {
  let spawn: Vec2;
  let tries = 0;

  do {
    spawn = {
      x: Math.random() * (CANVAS_WIDTH - 2 * BORDER_MARGIN) + BORDER_MARGIN,
      y: Math.random() * (CANVAS_HEIGHT - 2 * BORDER_MARGIN) + BORDER_MARGIN
    };
    tries++;
  } while (
    usedSpawns.some(s => Math.hypot(s.x - spawn.x, s.y - spawn.y) < SPAWN_MIN_DISTANCE) &&
    tries < 1000
  );

  return spawn;
}

function handleLobbyOptions(roomId: string, userId: string, gameData: any): void {
  const room = rooms.get(roomId);
  if (!room || room.hostUserId !== userId) return;

  const optionUpdates: { [key: string]: (val: any) => void } = {
    privateRoom: (val: boolean) => { room.isPrivate = val; console.log(`Room ${roomId} privacy: ${val ? 'Private' : 'Public'}`); },
    maxWins: (val: number) => { room.maxWins = val; console.log(`Room ${roomId} max wins: ${val}`); },
    maxPlayers: (val: number) => { room.maxPlayers = val; console.log(`Room ${roomId} max players: ${val}`); },
    upgradesEnabled: (val: boolean) => { room.upgradesEnabled = val; console.log(`Room ${roomId} upgrades: ${val}`); }
  };

  Object.entries(gameData).forEach(([key, value]) => {
    if (optionUpdates[key] && value !== undefined) {
      optionUpdates[key](value);
    }
  });
}

//
// #endregion
// =============================================================================

// =============================================================================
// #region ROUND MANAGEMENT
// =============================================================================

function handlePlayerHealthUpdate(roomId: string, userId: string, newHealth: number): void {
  const room = rooms.get(roomId);

  if (!room || !room.roundActive) {
    console.log('[HEALTH UPDATE IGNORED] Room:', roomId, 'Player:', userId, 'Health:', newHealth, '- Round not active');
    return;
  }

  console.log('[HEALTH UPDATE] Room:', roomId, 'Player:', userId, 'Health:', newHealth);

  room.playerHealth.set(userId, newHealth);

  // Check if player just died
  if (newHealth <= 0 && room.alivePlayers.has(userId)) {
    room.alivePlayers.delete(userId);
    console.log('=== PLAYER DEATH ===');
    console.log('Room:', roomId);
    console.log('Died:', userId);
    console.log('Remaining:', room.alivePlayers.size, 'alive');
    console.log('Alive Players:', Array.from(room.alivePlayers).join(', '));
    console.log('==================');

    checkRoundEnd(roomId);
  }
}

function checkRoundEnd(roomId: string): void {
  const room = rooms.get(roomId);

  if (!room || !room.roundActive) {
    console.log('[CHECK ROUND END SKIPPED] Room:', roomId, '- Round not active');
    return;
  }

  const aliveCount = room.alivePlayers.size;

  console.log('[CHECK ROUND END] Room:', roomId, 'Alive:', aliveCount);

  // Round ends when 1 or 0 players alive
  if (aliveCount <= 1) {
    let winnerId: string | null = null;
    for (const playerId of room.alivePlayers) {
      winnerId = playerId;
      break;
    }
    console.log('[TRIGGERING ROUND END] Winner:', winnerId || 'No one');
    endRound(roomId, winnerId);
  } else {
    console.log('[ROUND CONTINUES]', aliveCount, 'players still alive');
  }
}

function endRound(roomId: string, winnerId: string | null): void {
  const room = rooms.get(roomId);

  if (!room || !room.roundActive) {
    console.log('[END ROUND SKIPPED] Room:', roomId, '- Already ended');
    return;
  }

  room.roundActive = false;

  console.log('=== ROUND ENDED ===');
  console.log('Room:', roomId);
  console.log('Winner:', winnerId || 'No one (tie)');
  console.log('==================');

  // Broadcast round end to ALL clients simultaneously
  broadcastToRoom(roomId, {
    type: 'room-message',
    userId: 'server',
    message: JSON.stringify({
      type: 'round-end',
      winnerId: winnerId,
      timestamp: Date.now()
    }),
    roomId: roomId
  }, null);
}

function startNewRoundServer(roomId: string, reservedSpawn: Vec2): { [playerId: string]: Vec2 } | undefined {
  const room = rooms.get(roomId);
  if (!room) return;

  room.roundActive = true;
  room.alivePlayers.clear();
  room.playerHealth.clear();

  // Initialize all players as alive with their tracked max health
  room.participants.forEach((client: ConnectedClient) => {
    if (client.userId) {
      room.alivePlayers.add(client.userId);
      const maxHealth = room.playerMaxHealth.get(client.userId) || 100;
      room.playerHealth.set(client.userId, maxHealth);
    }
  });

  const spawnMap = generateSpawnMap(room, room.hostUserId, reservedSpawn);

  const healthString: string[] = [];
  room.playerHealth.forEach((hp: number, id: string) => {
    healthString.push(`${id}: ${hp}hp`);
  });

  console.log('=== NEW ROUND STARTED ===');
  console.log('Room:', roomId);
  console.log('Players:', room.alivePlayers.size);
  console.log('Host:', room.hostUserId);
  console.log('Alive Players:', Array.from(room.alivePlayers).join(', '));
  console.log('Spawn Map:', JSON.stringify(spawnMap, null, 2));
  console.log('Player Health:', healthString.join(', '));
  console.log('========================');

  return spawnMap;
}
//
// #endregion
// =============================================================================

// =============================================================================
// #region ROOM
// =============================================================================

function createRoom(ws: ConnectedClient, roomId: string, userId: string): void {
  if (rooms.has(roomId)) {
    ws.send(JSON.stringify({
      type: 'room-error',
      message: 'Room already exists',
      userId: 'server'
    }));
    return;
  }

  rooms.set(roomId, {
    // [ Detail ]
    hostUserId: userId,
    participants: new Set([ws]),
    lastActivityTime: Date.now(),

    // [ Settings ]
    isPrivate: false,
    upgradesEnabled: true,
    maxWins: 5,
    maxPlayers: 4,

    // [ State ]
    gameActive: false,
    roundActive: false,
    alivePlayers: new Set(),
    playerHealth: new Map(), // userId -> health value
    playerMaxHealth: new Map() // userId -> max health
  });

  ws.currentRoom = roomId;
  ws.userId = userId;

  ws.send(JSON.stringify({
    type: 'room-created',
    roomId: roomId,
    userId: 'server'
  }));

  console.log(`Room ${roomId} created by ${userId}`);
}

function joinRoom(ws: ConnectedClient, roomId: string, userId: string) {
  if (!rooms.has(roomId)) {
    ws.send(JSON.stringify({
      type: 'room-error',
      message: 'Room does not exist',
      userId: 'server'
    }));
    return;
  }

  const room = rooms.get(roomId);

  // Check if room is full
  if (room.participants.size >= room.maxPlayers) {
    ws.send(JSON.stringify({
      type: 'room-error',
      message: 'Room is full',
      userId: 'server'
    }));
    return;
  }

  // Check if game is active
  if (room.gameActive) {
    ws.send(JSON.stringify({
      type: 'room-error',
      message: 'Game already in progress.',
      userId: 'server'
    }));
    return;
  }

  // Only now add the client to the room
  room.participants.add(ws);
  ws.currentRoom = roomId;
  ws.userId = userId;

  // Join lobby
  ws.send(JSON.stringify({
    type: 'room-joined',
    roomId: roomId,
    userId: 'server',
    gameActive: false
  }));

  // Notify others in room
  broadcastToRoom(roomId, {
    type: 'user-joined',
    userId: userId,
    roomId: roomId
  }, ws);

  console.log(`User ${userId} joined room ${roomId} (game active: ${room.gameActive})`);
}

function leaveRoom(ws: ConnectedClient, roomId: string) {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const wasHost = room.hostUserId === ws.userId;
  room.participants.delete(ws);

  // Notify others in room that user left
  if (ws.userId) {
    broadcastToRoom(roomId, {
      type: 'user-left',
      userId: ws.userId,
      roomId: roomId
    }, ws);
  }

  // Handle different scenarios based on remaining players
  if (room.participants.size === 1 && room.gameActive) {
    // Only 1 player left during active game - return to lobby
    let lastPlayer: ConnectedClient | null = null;
    for (const client of room.participants) {
      lastPlayer = client;
      break;
    }

    if (lastPlayer && lastPlayer.userId) {
      room.hostUserId = lastPlayer.userId;
      room.gameActive = false;

      broadcastToRoom(roomId, {
        type: 'room-message',
        userId: 'server',
        message: JSON.stringify({
          type: 'return-to-lobby',
          reason: 'last-player',
          newHostId: lastPlayer.userId
        }),
        roomId: roomId
      }, null);

      console.log(`Last player ${lastPlayer.userId} in room ${roomId}, returning to lobby as host`);
    }

  } else if (wasHost && room.participants.size > 0) {
    // Host left but others remain - migrate host
    let newHost: ConnectedClient | null = null;
    for (const client of room.participants) {
      newHost = client;
      break;
    }

    if (newHost && newHost.userId) {
      room.hostUserId = newHost.userId;

      broadcastToRoom(roomId, {
        type: 'room-message',
        userId: 'server',
        message: JSON.stringify({
          type: 'promote-player',
          targetPlayerId: newHost.userId,
          reason: 'host-migration'
        }),
        roomId: roomId
      }, null);

      console.log(`Host migrated from ${ws.userId} to ${newHost.userId} in room ${roomId}`);
    }
  }

  // Delete room if empty
  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
    console.log(`Rooms remaining: ${rooms.size}`);
  }

  ws.currentRoom = null;
  ws.userId = null;
}

function broadcastToRoom(roomId: string, message: any, sender: ConnectedClient | null = null): void {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId)!;
  const messageStr = JSON.stringify(message);

  room.participants.forEach((client: ConnectedClient) => {
    // Send to all if sender is null, or exclude sender unless it's a promote-player message
    if (client.readyState === WebSocket.OPEN &&
      (sender === null ||
        client !== sender ||
        message.message?.includes('"type":"promote-player"'))) {
      client.send(messageStr);
    }
  });
}

//
// #endregion
// =============================================================================

// =============================================================================
// #region ADMIN
// =============================================================================

function handleAdminCommand(ws: ConnectedClient, message: RoomMessage): void {
  if (message.key !== ADMIN_KEY) {
    console.log(`❌ Unauthorized admin command attempt from ${ws.userId}`);
    ws.send(JSON.stringify({
      type: 'admin-error',
      message: 'Unauthorized',
      userId: 'server'
    }));
    return;
  }

  const commands: { [key: string]: () => void } = {
    'clear_rooms': clearAllRooms,
    'list_rooms': () => listRooms(ws),
    'close_room': () => closeRoom(message.data?.roomId),
    'server_stats': () => sendServerStats(ws)
  };

  const command = commands[message.id || ''];
  if (command) {
    console.log(`🔧 Admin command executed: ${message.id} by ${ws.userId}`);
    command();
    ws.send(JSON.stringify({
      type: 'admin-response',
      success: true,
      command: message.id,
      userId: 'server'
    }));
  } else {
    ws.send(JSON.stringify({
      type: 'admin-error',
      message: `Unknown admin command: ${message.id}`,
      userId: 'server'
    }));
  }
}

function clearAllRooms(): void {
  const count = rooms.size;

  rooms.forEach((room, roomId) => {
    kickPlayersFromRoom(roomId, 'admin-clear');
  });

  rooms.clear();
  console.log(`🧹 Cleared ${count} rooms via admin command`);
}

function listRooms(ws: ConnectedClient): void {
  const roomList: any[] = [];
  rooms.forEach((room, roomId) => {
    roomList.push({
      roomId,
      host: room.hostUserId,
      players: room.participants.size,
      maxPlayers: room.maxPlayers,
      gameActive: room.gameActive,
      isPrivate: room.isPrivate
    });
  });

  console.log('📋 Room List:', roomList);

  ws.send(JSON.stringify({
    type: 'admin-response',
    command: 'list_rooms',
    data: roomList,
    userId: 'server'
  }));
}

function closeRoom(roomId: string | undefined): void {
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId)!;
  room.participants.forEach((client: ConnectedClient) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'room-message',
        userId: 'server',
        message: JSON.stringify({
          type: 'return-to-lobby',
          reason: 'admin-close'
        })
      }));
      leaveRoom(client, roomId);
    }
  });

  rooms.delete(roomId);
  console.log(`🚫 Closed room: ${roomId}`);
}

function sendServerStats(ws: ConnectedClient): void {
  const stats = {
    totalRooms: rooms.size,
    totalPlayers: wss.clients.size,
    activeGames: Array.from(rooms.values()).filter(r => r.gameActive).length,
    uptime: process.uptime()
  };

  console.log('📊 Server Stats:', stats);

  ws.send(JSON.stringify({
    type: 'admin-response',
    command: 'server_stats',
    data: stats,
    userId: 'server'
  }));
}

function kickPlayersFromRoom(roomId: string, reason: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.participants.forEach((client: ConnectedClient) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'room-message',
        userId: 'server',
        message: JSON.stringify({
          type: 'kick-player',
          targetPlayerId: client.userId,
          reason: reason
        }),
        roomId: roomId
      }));
    }
  });
}

//
// #endregion
// =============================================================================

// Start the server
server.listen(PORT, () => { console.log(`Server running at http://localhost:${PORT}`); });