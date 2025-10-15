
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// =============================================================================
// #region CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY || "123";
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000;   // 60 seconds
const SPAWN_MIN_DISTANCE = 120;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BORDER_MARGIN = 15;

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
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Check if there's a room query parameter - serve index.html
  if (url.pathname === '/' && url.searchParams.has('room')) {
    let filePath = path.join(__dirname, "public", "index.html");

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
    const availableRooms = [];

    rooms.forEach((room, roomId) => {
      // FIX: Only consider rooms with at least 1 connected player
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
    filePath = path.join(__dirname, "dist", "app.js");
  } else {
    filePath = path.join(__dirname, "public", filePath);
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
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New client connected!");
  ws.currentRoom = null;
  ws.userId = null;

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      handleRoomMessage(ws, message);
    } catch (error) {
      // Handle plain text messages (backwards compatibility)
      console.log(`Received plain message: ${data}`);
      if (ws.currentRoom) {
        broadcastToRoom(ws.currentRoom, {
          type: 'room-message',
          userId: ws.userId || 'anonymous',
          message: data.toString()
        }, ws);
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
    if (ws.currentRoom) {
      leaveRoom(ws, ws.currentRoom);
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
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating dead connection for user:', ws.userId);
      if (ws.currentRoom) {
        leaveRoom(ws, ws.currentRoom);
      }
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Cleanup stale rooms
const cleanupInterval = setInterval(() => {
  let cleanedRooms = 0;

  console.log(`Checking ${rooms.size} rooms for cleanup.`);

  rooms.forEach((room, roomId) => {
    // Check if all participants are actually connected
    const connectedParticipants = new Set();

    room.participants.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        connectedParticipants.add(ws);
      } else {
        console.log(`Removing disconnected participant ${ws.userId} from room ${roomId}`);
      }
    });

    // Update participants to only include connected clients
    room.participants = connectedParticipants;

    // Delete room if empty
    if (room.participants.size === 0) {
      rooms.delete(roomId);
      cleanedRooms++;
      console.log(`Cleaned up stale room ${roomId}`);
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

function handleRoomMessage(ws, message) {
  const handlers = {
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

function handleGameMessage(ws, message) {
  if (ws.currentRoom !== message.roomId || !message.message) return;

  try {
    const gameData = JSON.parse(message.message);

    // Process special game messages
    if (gameData.type === 'start-game') {
      handleStartGame(message.roomId, message.userId, gameData);
    } else if (gameData.type === 'new-round') {
      message.message = JSON.stringify(gameData); // Pass through spawn map
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

function handleStartGame(roomId, userId, gameData) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.gameActive = true;
  room.spawnMap = generateSpawnMap(room, userId, gameData.hostSpawn);
  gameData.spawnMap = room.spawnMap;

  console.log(`Game started in room ${roomId}`);
}

function generateSpawnMap(room, hostUserId, hostSpawn) {
  const spawnMap = { [hostUserId]: hostSpawn };
  const usedSpawns = [hostSpawn];

  room.participants.forEach(client => {
    if (spawnMap[client.userId]) return;

    const spawn = findValidSpawn(usedSpawns);
    usedSpawns.push(spawn);
    spawnMap[client.userId] = spawn;
  });

  return spawnMap;
}

function findValidSpawn(usedSpawns) {
  let spawn, tries = 0;

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

function handleLobbyOptions(roomId, userId, gameData) {
  const room = rooms.get(roomId);
  if (!room || room.hostUserId !== userId) return;

  const optionUpdates = {
    privateRoom: (val) => { room.isPrivate = val; console.log(`Room ${roomId} privacy: ${val ? 'Private' : 'Public'}`); },
    maxWins: (val) => { room.maxWins = val; console.log(`Room ${roomId} max wins: ${val}`); },
    maxPlayers: (val) => { room.maxPlayers = val; console.log(`Room ${roomId} max players: ${val}`); },
    upgradesEnabled: (val) => { room.upgradesEnabled = val; console.log(`Room ${roomId} upgrades: ${val}`); }
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
// #region ROOM
// =============================================================================

function createRoom(ws, roomId, userId) {
  if (rooms.has(roomId)) {
    ws.send(JSON.stringify({
      type: 'room-error',
      message: 'Room already exists',
      userId: 'server'
    }));
    return;
  }

  rooms.set(roomId, {
    hostUserId: userId,
    participants: new Set([ws]),
    gameActive: false,
    isPrivate: false,
    upgradesEnabled: true,
    maxWins: 5,
    maxPlayers: 4
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

function joinRoom(ws, roomId, userId) {
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
function leaveRoom(ws, roomId) {
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
    const lastPlayer = Array.from(room.participants)[0];
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

  } else if (wasHost && room.participants.size > 0) {
    // Host left but others remain - migrate host
    const newHost = Array.from(room.participants)[0];
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

  // Delete room if empty
  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
    console.log(`Rooms remaining: ${rooms.size}`);
  }

  ws.currentRoom = null;
  ws.userId = null;
}

function broadcastToRoom(roomId, message, sender = null) {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const messageStr = JSON.stringify(message);

  room.participants.forEach(client => {
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

function handleAdminCommand(ws, message) {
  if (message.key !== ADMIN_KEY) { // Verify admin key
    console.log(`❌ Unauthorized admin command attempt from ${ws.userId}`);
    return sendError(ws, 'Unauthorized');
  }

  const commands = {
    'clear_rooms': clearAllRooms,
    'list_rooms': () => listRooms(ws),
    'close_room': () => closeRoom(message.data?.roomId),
    'server_stats': () => sendServerStats(ws)
  };

  const command = commands[message.id];
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
    sendError(ws, `Unknown admin command: ${message.id}`);
  }
}

function clearAllRooms() {
  const count = rooms.size;

  rooms.forEach((room, roomId) => {
    room.participants.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'room-message',
          userId: 'server',
          message: JSON.stringify({
            type: 'kick-player',
            targetPlayerId: client.userId
          }),
          roomId: roomId
        }));
      }
    });
  });

  rooms.clear();
  console.log(`🧹 Cleared ${count} rooms via admin command`);
}

function listRooms(ws) {
  const roomList = [];
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

function closeRoom(roomId) {
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.participants.forEach(client => {
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

function sendServerStats(ws) {
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

//
// #endregion
// =============================================================================

// Start the server
server.listen(PORT, () => { console.log(`Server running at http://localhost:${PORT}`); });