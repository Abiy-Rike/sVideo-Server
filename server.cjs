// Simple WebRTC signaling server with rooms
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT, host: "0.0.0.0" });

// Map: roomId -> Map<userId, WebSocket>kgj
const rooms = new Map();

wss.on("connection", (ws) => {
  let userId = null;
  let roomId = null;

  console.log("🌐 New WebSocket connection");

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case "join-room": {
          userId = msg.from;
          roomId = msg.roomId;

          if (!rooms.has(roomId)) rooms.set(roomId, new Map());
          const room = rooms.get(roomId);

          // Send back list of existing users
          const existingUsers = Array.from(room.keys());
          ws.send(JSON.stringify({ type: "existing-users", users: existingUsers }));

          // Notify existing users of the new user
          room.forEach((client, id) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "user-joined", from: userId }));
            }
          });

          room.set(userId, ws);
          console.log(`✅ ${userId} joined room ${roomId}`);
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          const room = rooms.get(msg.roomId);
          if (!room) return;
          const target = room.get(msg.to);
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(msg));
            console.log(`➡️ Forwarded ${msg.type} from ${msg.from} to ${msg.to}`);
          }
          break;
        }

        case "leave-room": {
          cleanup();
          break;
        }
      }
    } catch (err) {
      console.error("❌ Failed to process message", err);
    }
  });

  ws.on("close", () => {
    cleanup();
  });

  function cleanup() {
    if (roomId && userId) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(userId);
        console.log(`👋 ${userId} left room ${roomId}`);

        // Notify remaining users
        room.forEach((client, id) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "user-left", from: userId }));
          }
        });

        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        }
      }
    }
  }
});

console.log(`✅ Signaling server running on ws://0.0.0.0:${PORT}`);
