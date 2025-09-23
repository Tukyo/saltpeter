const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// Create HTTP server to serve files
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("File not found");
    }
    res.writeHead(200);
    res.end(data);
  });
});

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New client connected!");
  ws.send("Welcome! You are connected to the WebSocket server.");

  ws.on("message", (message) => {
    console.log(`Received: ${message}`);

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Someone says: ${message}`);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});