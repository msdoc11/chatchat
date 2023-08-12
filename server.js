const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  const htmlContent = fs.readFileSync("index.html", "utf8");
  res.end(htmlContent);
});

const wss = new WebSocket.Server({ server });

const clients = {};
const messageHistory = [];
const typingClients = {};

wss.on("connection", (ws) => {
  let id = null;

  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === "id") {
      id = parsedMessage.userId;
      clients[id] = ws;
      ws.username = parsedMessage.name;
      console.log("новое соединение " + id);

      // Отправляем историю сообщений новым пользователям
      ws.send(
        JSON.stringify({
          type: "history",
          content: messageHistory,
          clientId: id,
          onlineUsers: Object.values(clients).map((client) => client.username), // Отправляем список пользователей онлайн
        })
      );
      broadcastOnlineUsers();
    } else if (parsedMessage.type === "typing") {
      // Обработка сообщения о наборе текста
      for (const clientId in clients) {
        if (clients.hasOwnProperty(clientId) && clientId !== id) {
          clients[clientId].send(
            JSON.stringify({
              type: "typing",
              isTyping: parsedMessage.isTyping,
              clientId: id,
              name: parsedMessage.name,
            })
          );
        }
      }
    } else if (parsedMessage.type === "message") {
      let localTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      // Обработка обычных сообщений
      messageHistory.push({
        content: parsedMessage.content,
        clientId: id,
        time: localTime,
        name: parsedMessage.name,
      });

      for (const clientId in clients) {
        if (clients.hasOwnProperty(clientId)) {
          clients[clientId].send(
            JSON.stringify({
              type: "message",
              content: parsedMessage.content,
              clientId: id,
              time: localTime,
              name: parsedMessage.name,
            })
          );
        }
      }
    } else if (parsedMessage.type === "onlineUsers") {
      ws.send(
        JSON.stringify({
          type: "onlineUsers",
          onlineUsers: parsedMessage.name,
        })
      );
    } else if (parsedMessage.type === "userOffline") {
      // Обработка выхода пользователя из онлайн
      if (id) {
        delete clients[id];
        broadcastOnlineUsers();
      }
    }
  });

  ws.on("close", () => {
    console.log("соединение закрыто " + id);
    if (id) {
      delete clients[id];
      broadcastOnlineUsers();
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
function broadcastOnlineUsers() {
  const onlineUsernames = Object.values(clients).map(
    (client) => client.username
  );
  for (const clientId in clients) {
    if (clients.hasOwnProperty(clientId)) {
      const client = clients[clientId];
      client.send(
        JSON.stringify({
          type: "onlineUsers",
          onlineUsers: onlineUsernames,
        })
      );
    }
  }
}
