const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

// Simple UUID generator (no external dependency needed)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Configuration
const CONFIG = {
  PORT: process.env.PORT || 8080,
  MAX_MESSAGE_LENGTH: 500,
  MAX_USERNAME_LENGTH: 20
};

// In-memory storage (use Redis in production)
const chatRooms = new Map();
const userSessions = new Map();

class ChatRoom {
  constructor(id, name = 'General') {
    this.id = id;
    this.name = name;
    this.users = new Set();
    this.messageHistory = [];
    this.createdAt = new Date();
  }

  addUser(userId, username) {
    this.users.add({ userId, username, joinedAt: new Date() });
  }

  removeUser(userId) {
    this.users = new Set([...this.users].filter(user => user.userId !== userId));
  }

  addMessage(message) {
    this.messageHistory.push({
      ...message,
      timestamp: new Date(),
      id: generateUUID()
    });
    
    // Keep only last 100 messages
    if (this.messageHistory.length > 100) {
      this.messageHistory = this.messageHistory.slice(-100);
    }
  }

  getRecentMessages(limit = 50) {
    return this.messageHistory.slice(-limit);
  }
}

class User {
  constructor(id, username, socket) {
    this.id = id;
    this.username = this.sanitizeUsername(username);
    this.socket = socket;
    this.roomId = 'general';
    this.color = this.generateColor();
    this.joinedAt = new Date();
    this.isOnline = true;
  }

  sanitizeUsername(username) {
    return username
      .trim()
      .substring(0, CONFIG.MAX_USERNAME_LENGTH)
      .replace(/[<>'"&]/g, '') || 'Anonymous';
  }

  generateColor() {
    const hash = crypto.createHash('md5').update(this.username).digest('hex');
    // Generate colors in white, light blue, and grey spectrum
    const colors = ['#ffffff', '#87ceeb', '#c0c0c0', '#b0c4de', '#d3d3d3', '#e6e6fa'];
    const index = parseInt(hash.substring(0, 2), 16) % colors.length;
    return colors[index];
  }
}

// Message validation
function validateMessage(message) {
  if (!message || typeof message !== 'string') return false;
  if (message.length > CONFIG.MAX_MESSAGE_LENGTH) return false;
  return message.trim().length > 0;
}

// HTML Template with enhanced features
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Box</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Press Start 2P', monospace;
      background: linear-gradient(45deg, #000 25%, #111 25%, #111 50%, #000 50%, #000 75%, #111 75%);
      background-size: 20px 20px;
      color: #ffffff;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }

    #container {
      max-width: 900px;
      margin: 0 auto;
      height: 100vh;
      display: flex;
      flex-direction: column;
      border: 4px solid #87ceeb;
      background: rgba(0, 0, 0, 0.95);
      box-shadow: 0 0 20px #87ceeb;
    }

    #header {
      padding: 15px;
      border-bottom: 2px solid #87ceeb;
      background: #000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }

    #roomInfo {
      font-size: 10px;
      color: #ffffff;
    }

    #userCount {
      font-size: 8px;
      color: #c0c0c0;
    }

    #chatBox {
      flex-grow: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background: rgba(0, 0, 0, 0.8);
      font-size: 11px;
      scrollbar-width: thin;
      scrollbar-color: #87ceeb #000;
    }

    #chatBox::-webkit-scrollbar {
      width: 8px;
    }

    #chatBox::-webkit-scrollbar-track {
      background: #000;
    }

    #chatBox::-webkit-scrollbar-thumb {
      background: #87ceeb;
      border-radius: 4px;
    }

    .message {
      max-width: 75%;
      margin: 8px 0;
      padding: 12px;
      border: 1px solid;
      background: rgba(0, 0, 0, 0.9);
      border-radius: 4px;
      word-wrap: break-word;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sent {
      align-self: flex-end;
      border-color: #87ceeb;
      background: rgba(135, 206, 235, 0.1);
      color: #ffffff;
    }

    .received {
      align-self: flex-start;
      border-color: #c0c0c0;
      color: #ffffff;
    }

    .system {
      align-self: center;
      max-width: 80%;
      background: rgba(64, 64, 64, 0.3);
      border-color: #808080;
      color: #c0c0c0;
      font-size: 10px;
      text-align: center;
    }

    .meta {
      font-size: 9px;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .username {
      font-weight: bold;
    }

    .timestamp {
      opacity: 0.7;
      font-size: 8px;
    }

    #inputArea {
      display: flex;
      padding: 15px;
      border-top: 2px solid #87ceeb;
      background: #000;
      gap: 10px;
    }

    #messageInput {
      flex-grow: 1;
      padding: 12px;
      background: rgba(0, 0, 0, 0.9);
      color: #ffffff;
      border: 2px solid #87ceeb;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      border-radius: 4px;
      transition: box-shadow 0.3s;
    }

    #messageInput:focus {
      outline: none;
      box-shadow: 0 0 10px #87ceeb;
    }

    #messageInput::placeholder {
      color: #c0c0c0;
    }

    #sendButton {
      padding: 12px 16px;
      font-size: 10px;
      background: #000;
      color: #ffffff;
      border: 2px solid #87ceeb;
      cursor: pointer;
      font-family: 'Press Start 2P', monospace;
      border-radius: 4px;
      transition: all 0.3s;
    }

    #sendButton:hover {
      background: #1a1a2e;
      box-shadow: 0 0 5px #87ceeb;
    }

    #sendButton:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .status {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid;
      border-radius: 4px;
      font-size: 8px;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .status.connected {
      border-color: #87ceeb;
      color: #87ceeb;
    }

    .status.disconnected {
      border-color: #ff6b6b;
      color: #ff6b6b;
    }

    .typing-indicator {
      font-size: 9px;
      color: #888;
      font-style: italic;
      padding: 5px 0;
    }

    @media (max-width: 600px) {
      #container {
        height: 100vh;
        border: 2px solid #87ceeb;
      }
      
      #header {
        padding: 10px;
        flex-direction: column;
        gap: 5px;
      }
      
      .message {
        font-size: 10px;
        max-width: 90%;
      }
      
      #inputArea {
        flex-direction: column;
      }
      
      #sendButton {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="header">
      <div id="roomInfo">CHAT WITH US</div>
      <div id="userCount">USERS ONLINE: 0</div>
    </div>
    <div id="chatBox"></div>
    <div id="inputArea">
      <input id="messageInput" type="text" placeholder="Type your message..." maxlength="500" />
      <button id="sendButton">SEND</button>
    </div>
  </div>

  <script>
    class RetroChat {
      constructor() {
        this.username = "";
        this.userId = this.generateUserId();
        this.socket = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
      }

      generateUserId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
      }

      init() {
        this.showUsernameModal();
      }

      showUsernameModal() {
        const overlay = document.createElement("div");
        overlay.style.cssText = \`
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.95); display: flex;
          justify-content: center; align-items: center; z-index: 1000;
        \`;

        const modal = document.createElement("div");
        modal.style.cssText = \`
          border: 4px solid #87ceeb; padding: 30px; background: black;
          color: #ffffff; font-family: 'Press Start 2P', monospace;
          text-align: center; border-radius: 8px;
          box-shadow: 0 0 20px #87ceeb;
        \`;

        modal.innerHTML = \`
          <div style="margin-bottom: 20px; font-size: 12px;">
            ━━━━━━━━━━━━━━━━━━━━━━━━<br>
            ENTER THE CHAT ZONE<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━
          </div>
          <input type="text" id="usernameInput" placeholder="Enter your name..."
                 style="background: black; border: 2px solid #87ceeb; color: #ffffff;
                        padding: 12px; font-family: 'Press Start 2P', monospace;
                        font-size: 10px; width: 100%; margin-bottom: 15px;
                        border-radius: 4px;"
                 maxlength="20" />
          <button id="connectBtn"
                  style="padding: 12px 20px; background: black; color: #ffffff;
                         border: 2px solid #87ceeb; font-family: 'Press Start 2P', monospace;
                         cursor: pointer; font-size: 10px; width: 100%;
                         border-radius: 4px; transition: all 0.3s;">
            CONNECT
          </button>
        \`;

        const input = modal.querySelector('#usernameInput');
        const button = modal.querySelector('#connectBtn');

        button.addEventListener('mouseover', () => {
          button.style.background = '#1a1a2e';
          button.style.boxShadow = '0 0 10px #87ceeb';
        });

        button.addEventListener('mouseout', () => {
          button.style.background = 'black';
          button.style.boxShadow = 'none';
        });

        const connect = () => {
          this.username = input.value.trim() || "Anonymous_" + Math.floor(Math.random() * 1000);
          document.body.removeChild(overlay);
          this.startChat();
        };

        button.onclick = connect;
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') connect();
        });

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        input.focus();
      }

      startChat() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.showStatus('Connecting...', 'disconnected');
      }

      connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${location.host}\`;
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.showStatus('Connected', 'connected');
          this.appendSystem(\`>> Connected as \${this.username}\`);
          
          // Send queued messages
          while (this.messageQueue.length > 0) {
            this.socket.send(this.messageQueue.shift());
          }
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          this.showStatus('Disconnected', 'disconnected');
          this.appendSystem('>> Connection lost. Attempting to reconnect...');
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.showStatus('Connection Error', 'disconnected');
        };
      }

      attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.appendSystem(\`>> Reconnect attempt \${this.reconnectAttempts}/\${this.maxReconnectAttempts}\`);
            this.connectWebSocket();
          }, 2000 * this.reconnectAttempts);
        } else {
          this.appendSystem('>> Maximum reconnection attempts reached. Please refresh the page.');
        }
      }

      handleMessage(data) {
        if (data.system) {
          this.appendSystem('>> ' + data.message);
        } else if (data.userCount !== undefined) {
          document.getElementById('userCount').textContent = \`USERS ONLINE: \${data.userCount}\`;
        } else if (data.messageHistory) {
          // Load recent messages
          data.messageHistory.forEach(msg => {
            const isSelf = msg.username === this.username;
            this.appendMessage(msg.username, msg.message, isSelf, msg.timestamp, msg.color);
          });
        } else {
          const isSelf = data.username === this.username;
          this.appendMessage(data.username, data.message, isSelf, data.timestamp, data.color);
        }
      }

      sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || message.length > 500) return;

        const payload = JSON.stringify({
          userId: this.userId,
          username: this.username,
          message: message,
          type: 'message'
        });

        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(payload);
        } else {
          this.messageQueue.push(payload);
          this.showStatus('Message queued...', 'disconnected');
        }

        input.value = '';
      }

      appendMessage(username, message, isSelf, timestamp, color) {
        const chatBox = document.getElementById('chatBox');
        const div = document.createElement('div');
        div.classList.add('message', isSelf ? 'sent' : 'received');

        const meta = document.createElement('div');
        meta.className = 'meta';

        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = username;
        usernameSpan.style.color = color || '#00ff00';

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = this.formatTimestamp(timestamp);

        meta.appendChild(usernameSpan);
        meta.appendChild(timestampSpan);

        const body = document.createElement('div');
        body.textContent = message;

        div.appendChild(meta);
        div.appendChild(body);

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      appendSystem(text) {
        const chatBox = document.getElementById('chatBox');
        const div = document.createElement('div');
        div.classList.add('message', 'system');
        div.textContent = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      showStatus(message, type) {
        // Remove existing status
        const existing = document.querySelector('.status');
        if (existing) existing.remove();

        const status = document.createElement('div');
        status.className = \`status \${type}\`;
        status.textContent = message;
        document.body.appendChild(status);

        if (type === 'connected') {
          setTimeout(() => status.remove(), 3000);
        }
      }

      formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      setupEventListeners() {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');

        sendButton.onclick = () => this.sendMessage();
        
        messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });

        // Character counter
        messageInput.addEventListener('input', (e) => {
          const remaining = 500 - e.target.value.length;
          if (remaining < 50) {
            e.target.style.borderColor = remaining < 10 ? '#ff6b6b' : '#ffa500';
          } else {
            e.target.style.borderColor = '#87ceeb';
          }
        });
      }
    }

    // Initialize chat when page loads
    document.addEventListener('DOMContentLoaded', () => {
      new RetroChat();
    });
  </script>
</body>
</html>
`;

// WebSocket Server with enhanced features
const wss = new WebSocket.Server({ 
  server: http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  })
});

// Initialize default room
chatRooms.set('general', new ChatRoom('general', 'General'));

wss.on('connection', (socket, request) => {
  let user = null;
  const clientIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
  
  console.log(`New connection from ${clientIp}`);

  socket.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      
      if (!user) {
        // Initialize user
        const userId = parsed.userId || generateUUID();
        user = new User(userId, parsed.username, socket);
        userSessions.set(userId, user);
        
        const room = chatRooms.get('general');
        room.addUser(user.id, user.username);
        
        // Send recent message history
        socket.send(JSON.stringify({
          messageHistory: room.getRecentMessages(20)
        }));
        
        // Broadcast user joined
        broadcastToRoom('general', {
          system: true,
          message: `${user.username} joined the chat`
        });
        
        broadcastUserCount('general');
        return;
      }

      // Validate message
      if (!validateMessage(parsed.message)) {
        socket.send(JSON.stringify({
          system: true,
          message: 'Invalid message format or length.'
        }));
        return;
      }

      // Process message
      const messageData = {
        username: user.username,
        message: parsed.message,
        color: user.color,
        timestamp: new Date().toISOString(),
        userId: user.id
      };

      // Add to room history
      const room = chatRooms.get(user.roomId);
      if (room) {
        room.addMessage(messageData);
        broadcastToRoom(user.roomId, messageData);
      }

    } catch (error) {
      console.error('Message processing error:', error);
      socket.send(JSON.stringify({
        system: true,
        message: 'Message processing failed.'
      }));
    }
  });

  socket.on('close', () => {
    if (user) {
      const room = chatRooms.get(user.roomId);
      if (room) {
        room.removeUser(user.id);
        
        broadcastToRoom(user.roomId, {
          system: true,
          message: `${user.username} left the chat`
        });
        
        broadcastUserCount(user.roomId);
      }
      
      userSessions.delete(user.id);
      console.log(`User ${user.username} disconnected`);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

function broadcastToRoom(roomId, message) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const userSession = [...userSessions.values()].find(u => u.socket === client);
      if (userSession && userSession.roomId === roomId) {
        client.send(payload);
      }
    }
  });
}

function broadcastUserCount(roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const count = [...userSessions.values()].filter(u => u.roomId === roomId).length;
  
  broadcastToRoom(roomId, {
    userCount: count
  });
}

// Server startup
const server = wss.options.server;
server.listen(CONFIG.PORT, () => {
  console.log(`🚀 Enhanced Retro Chat Server running on port ${CONFIG.PORT}`);
});
