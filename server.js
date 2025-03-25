const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(__dirname));

let players = {};

// Function to get random initial position
function getRandomPosition() {
    return { 
        x: Math.random() * 700 + 50,  // Random x between 50-750
        y: 300  // Fixed ground level
    };
}

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);
    
    // Assign unique initial position
    players[socket.id] = getRandomPosition();

    // Broadcast updated player list to all clients
    io.emit("updatePlayers", players);

    // Server-side socket handling (pseudo-code)
socket.on('playerMove', (playerData) => {
    players[socket.id] = {
        x: playerData.x,
        y: playerData.y,
        health: playerData.health,
        score: playerData.score,
        facing: playerData.facing  // Store and broadcast facing direction
    };
    io.emit('updatePlayers', players);
});

    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        delete players[socket.id];
        io.emit("updatePlayers", players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});