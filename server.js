const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Retro Chat</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    body {
      font-family: 'Press Start 2P', monospace;
      background-color: black;
      color: #00ff00;
      margin: 0;
      padding: 0;
    }

    #container {
      max-width: 800px;
      margin: 0 auto;
      height: 100vh;
      display: flex;
      flex-direction: column;
      border: 4px solid #00ff00;
      box-sizing: border-box;
    }

    #chatBox {
      flex-grow: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background-color: black;
      font-size: 12px;
    }

    .message {
      max-width: 70%;
      margin: 8px 0;
      padding: 8px 10px;
      border: 1px dashed #00ff00;
      background-color: #001100;
    }

    .sent {
      align-self: flex-end;
    }

    .received {
      align-self: flex-start;
    }

    .meta {
      font-size: 10px;
      color: #55ff55;
      margin-bottom: 3px;
    }

    #inputArea {
      display: flex;
      padding: 10px;
      border-top: 2px solid #00ff00;
      background-color: #000;
    }

    #messageInput {
      flex-grow: 1;
      padding: 8px;
      background: black;
      color: #00ff00;
      border: 2px solid #00ff00;
      font-family: 'Press Start 2P', monospace;
      font-size: 12px;
    }

    #sendButton {
      margin-left: 10px;
      padding: 8px 12px;
      font-size: 10px;
      background-color: black;
      color: #00ff00;
      border: 2px solid #00ff00;
      cursor: pointer;
      font-family: 'Press Start 2P', monospace;
    }

    #sendButton:hover {
      background-color: #002200;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="chatBox"></div>
    <div id="inputArea">
      <input id="messageInput" type="text" placeholder="Type a message..." />
      <button id="sendButton">Send</button>
    </div>
  </div>

  <script>
    let username = "";

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "black";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "1000";

    const modal = document.createElement("div");
    modal.style.border = "4px solid #00ff00";
    modal.style.padding = "20px";
    modal.style.background = "black";
    modal.style.color = "#00ff00";
    modal.style.fontFamily = "'Press Start 2P', monospace";
    modal.style.textAlign = "center";

    const label = document.createElement("div");
    label.textContent = "-----ENTER YOUR NAME-----";
    label.style.marginBottom = "10px";

    const input = document.createElement("input");
    input.type = "text";
    input.style.background = "black";
    input.style.border = "2px solid #00ff00";
    input.style.color = "#00ff00";
    input.style.padding = "8px";
    input.style.fontFamily = "'Press Start 2P', monospace";
    input.style.fontSize = "10px";
    input.style.width = "100%";

    const button = document.createElement("button");
    button.textContent = "CONNECT";
    button.style.marginTop = "10px";
    button.style.padding = "8px";
    button.style.background = "black";
    button.style.color = "#00ff00";
    button.style.border = "2px solid #00ff00";
    button.style.fontFamily = "'Press Start 2P', monospace";
    button.style.cursor = "pointer";

    button.onclick = () => {
      username = input.value.trim() || "Anonymous";
      document.body.removeChild(overlay);
      startChat(username);
    };

    modal.appendChild(label);
    modal.appendChild(input);
    modal.appendChild(button);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();

    function startChat(username) {
      const socket = new WebSocket(location.origin.replace(/^http/, 'ws'));
      const chatBox = document.getElementById('chatBox');

      socket.onopen = () => {
        appendSystem(">> Connected as " + username);
      };

      socket.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.system) {
          appendSystem(">> " + data.message);
        } else {
          const isSelf = data.username === username;
          appendMessage(data.username, data.message, isSelf);
        }
      };

      function sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        if (message) {
          socket.send(JSON.stringify({ username, message }));
          input.value = '';
        }
      }

      function appendMessage(user, msg, isSelf) {
        const div = document.createElement('div');
        div.classList.add('message');
        div.classList.add(isSelf ? 'sent' : 'received');

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = user;

        const body = document.createElement('div');
        body.textContent = msg;

        div.appendChild(meta);
        div.appendChild(body);

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      function appendSystem(text) {
        const div = document.createElement('div');
        div.style.textAlign = "center";
        div.style.color = "#55ff55";
        div.style.margin = "5px 0";
        div.textContent = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      document.getElementById('sendButton').onclick = sendMessage;
      document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
      });
    }
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

const wss = new WebSocket.Server({ server });

function getColorForUsername(name) {
  const hash = crypto.createHash('md5').update(name).digest('hex');
  return '#' + hash.substring(0, 6);
}

wss.on('connection', (socket) => {
  let username = null;

  socket.on('message', (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      return;
    }

    if (!username) {
      username = parsed.username || 'Anonymous';
    }

    const payload = {
      username: username,
      message: parsed.message || '',
      color: getColorForUsername(username)
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });

  socket.on('close', () => {
    if (username) {
      const sysPayload = {
        system: true,
        message: username + ' left the chat'
      };
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(sysPayload));
        }
      });
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('🚀 Server running on port', PORT);
});