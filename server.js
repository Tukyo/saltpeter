const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// Room management - now includes game state
const rooms = new Map(); // roomId -> { hostUserId, participants: Set<ws>, gameActive: boolean }

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
      // Only consider rooms in lobby state with available slots
      if (!room.gameActive && !room.isPrivate && room.participants.size < room.maxPlayers) {
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

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New client connected!");
  ws.currentRoom = null;
  ws.userId = null;

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

function handleRoomMessage(ws, message) {
  console.log('Received room message:', message);

  switch (message.type) {
    case 'create-room':
      createRoom(ws, message.roomId, message.userId);
      break;
    case 'join-room':
      joinRoom(ws, message.roomId, message.userId);
      break;
    case 'leave-room':
      leaveRoom(ws, message.roomId);
      break;
    case 'room-message':
      if (ws.currentRoom === message.roomId) {
        // Handle special messages
        if (message.message) {
          try {
            const gameData = JSON.parse(message.message);

            // Handle lobby options changes
            if (gameData.type === 'lobby-options') {
              const room = rooms.get(message.roomId);
              if (room && room.hostUserId === message.userId) {
                if (gameData.privateRoom !== undefined) { //TODO: MAYBE TRACK ROOM MAX PLAYERS HERE?
                  room.isPrivate = gameData.privateRoom;
                  console.log(`Room ${message.roomId} privacy changed to: ${room.isPrivate ? 'Private' : 'Public'}`);
                }
                if (gameData.maxWins !== undefined) {
                  room.maxWins = gameData.maxWins;
                  console.log(`Room ${message.roomId} max wins changed to: ${room.maxWins}`);
                }

                if (gameData.maxPlayers !== undefined) {
                  room.maxPlayers = gameData.maxPlayers;
                  console.log(`Room ${message.roomId} max players changed to: ${room.maxPlayers}`);
                }

                if (gameData.upgradesEnabled !== undefined) {
                  room.upgradesEnabled = gameData.upgradesEnabled;
                  console.log(`Room ${message.roomId} upgrades toggled: ${room.upgradesEnabled}`);
                }
              }
            }

            if (gameData.type === 'start-game') {
              // Mark room as having active game
              const room = rooms.get(message.roomId);
              if (room) {
                room.gameActive = true;
                console.log(`Game started in room ${message.roomId}`);
              }
            }
          } catch (e) {
            // Not JSON, continue normally
          }
        }


        broadcastToRoom(message.roomId, {
          type: 'room-message',
          userId: message.userId,
          message: message.message,
          roomId: message.roomId
        }, ws);
      }
      break;
  }
}

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
  room.participants.add(ws);
  ws.currentRoom = roomId;
  ws.userId = userId;

  // Check if game is active and send appropriate response
  if (room.gameActive) {
    // Game in progress - join directly into game
    ws.send(JSON.stringify({
      type: 'room-joined-game',
      roomId: roomId,
      userId: 'server',
      gameActive: true
    }));
  } else {
    // Join lobby
    ws.send(JSON.stringify({
      type: 'room-joined',
      roomId: roomId,
      userId: 'server',
      gameActive: false
    }));
  }

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

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});