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
        y: 300,  // Fixed ground level
        health: 100,
        score: 0,
        facing: Math.random() > 0.5 ? 1 : -1  // Random initial facing direction
    };
}

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    players[socket.id] = getRandomPosition();
    // Broadcast updated player list to all clients
    io.emit("updatePlayers", players);
 
    socket.on("playerMove", (data) => {
        console.log("Received player move:", data); // Debug log
        
        if (players[socket.id]) {
            // Update all player properties
            players[socket.id] = {
                x: data.x,
                y: data.y,
                baseX: data.baseX,
                baseY: data.baseY,
                spawnPercentageX: data.spawnPercentageX,
                spawnPercentageY: data.spawnPercentageY,
                health: data.health,
                score: data.score,
                facing: data.facing,
                username: data.username,
                isGameStarted: data.isGameStarted || false
            };
        }
        
        // Broadcast updated players to all clients
        io.emit("updatePlayers", players);
    });
    socket.on("playerInactive", (data) => {
        delete players[data.id]; // Remove player from the game
        io.emit("updatePlayers", players); // Send updated player list
    });
    socket.on("updateHealth", (data) => {
        if (players[data.id]) {
            players[data.id].health = Math.max(0, data.health);
            io.emit("updatePlayers", players);
        }
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