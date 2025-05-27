

**Retro Chat** is a terminal-style, real-time chat application built with **Node.js**, **WebSockets**, and pure frontend code. It features a nostalgic green-on-black interface, reminiscent of classic hacker terminals.

![Retro Chat Banner](https://chat-mar1.onrender.com/screenshot.png) <!-- Optional, replace or remove if you don't have this image -->

---

## 🚀 Live Demo

Try it now:  
👉 **[https://chat-mar1.onrender.com](https://chat-mar1.onrender.com)**

---

## 🛠️ Built With

- **Frontend:**  
  - HTML5  
  - CSS3 (with retro terminal theme)  
  - Vanilla JavaScript

- **Backend:**  
  - Node.js  
  - WebSocket (using `ws` library)

- **Hosting:**  
  - [Render.com](https://render.com/)

---

## ✨ Features

- Real-time messaging with WebSockets
- Retro terminal-style interface
- Dynamic username input modal
- Random color coding per user (based on hashed username)
- System messages for user join/leave events
- Fully responsive layout – works on both desktop and mobile
- Clean code with zero dependencies on frontend frameworks

---

## 📦 Getting Started

### Prerequisites

Make sure you have **Node.js** installed:

```bash
node -v
npm -v
````

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/rajkrish63/chat.git
cd chat
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the server**

```bash
npm start
```

4. **Open in browser**

```
http://localhost:8080
```

---

## 📁 Project Structure

```
chat/
├── server.js           # Node.js server with WebSocket logic
├── package.json        # Dependencies and scripts
├── .gitignore          # Ignored files/folders
└── README.md           # This file
```

---

## ⚙️ Scripts

```json
"scripts": {
  "start": "node server.js"
}
```

---

## 🧾 .gitignore

```gitignore
node_modules/
.env
.DS_Store
```

---

## 🤖 Upcoming Enhancements

* Chat history saving with localStorage or DB
* Private messaging (DM)
* User list with online status
* Emojis and themes toggle

---

## ✍️ Author

Built with dedication by **Raj Krish**
GitHub: [@rajkrish63](https://github.com/rajkrish63)

---

## ⚖️ License

This project is licensed under the **MIT License** – do anything you want, but give credit.

---


