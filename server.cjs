// Simple WebRTC signaling server using WebSocket (ws)
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map(); // roomId -> Map(userId -> ws)

wss.on("connection", (ws) => {
  let userId = null;
  let roomId = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case "join-room": {
          userId = msg.from;
          roomId = msg.roomId;

          if (!rooms.has(roomId)) rooms.set(roomId, new Map());
          const room = rooms.get(roomId);

          // send back list of existing users
          const existingUsers = Array.from(room.keys());
          ws.send(JSON.stringify({ type: "existing-users", users: existingUsers }));

          // notify existing users
          room.forEach((client, id) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "user-joined", from: userId }));
            }
          });

          room.set(userId, ws);
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          // forward to target
          const room = rooms.get(msg.roomId);
          if (!room) return;
          const target = room.get(msg.to);
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(msg));
          }
          break;
        }

        case "leave-room": {
          cleanup();
          break;
        }
      }
    } catch (err) {
      console.error("Failed to process message", err);
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
        room.forEach((client, id) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "user-left", from: userId }));
          }
        });
        if (room.size === 0) rooms.delete(roomId);
      }
    }
  }
});

console.log("✅ Signaling server running on ws://localhost:8080");
