const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// Room management
const rooms = new Map(); // roomId -> { hostUserId, participants: Set<ws> }

// Create HTTP server to serve files
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("File not found");
    }
    
    // Set proper content type for JS modules
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    
    res.writeHead(200, { 'Content-Type': contentType });
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
    participants: new Set([ws])
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

  // Notify user they joined
  ws.send(JSON.stringify({
    type: 'room-joined',
    roomId: roomId,
    userId: 'server'
  }));

  // Notify others in room
  broadcastToRoom(roomId, {
    type: 'user-joined',
    userId: userId,
    roomId: roomId
  }, ws);

  console.log(`User ${userId} joined room ${roomId}`);
}

function leaveRoom(ws, roomId) {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.participants.delete(ws);

  // Notify others in room
  if (ws.userId) {
    broadcastToRoom(roomId, {
      type: 'user-left',
      userId: ws.userId,
      roomId: roomId
    }, ws);
  }

  // Delete room if empty
  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
  }

  ws.currentRoom = null;
  ws.userId = null;
}

function broadcastToRoom(roomId, message, sender = null) {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const messageStr = JSON.stringify(message);

  room.participants.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});