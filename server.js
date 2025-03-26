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
    socket.on("playerPunch", (data) => {
        // Find opponents in collision range
        const attackerId = data.attackerId;
        for (let targetId in players) {
            if (targetId !== attackerId) {
                // Apply damage and score
                players[targetId].health = Math.max(0, 
                    (players[targetId].health || 100) - 10
                );
                players[attackerId].score = 
                    (players[attackerId].score || 0) + 5;
            }
        }
        
        // Broadcast updated players
        io.emit("updatePlayers", players);
    });

    socket.on("playerKick", (data) => {
        // Find opponents in collision range
        const attackerId = data.attackerId;
        for (let targetId in players) {
            if (targetId !== attackerId) {
                // Apply damage and score
                players[targetId].health = Math.max(0, 
                    (players[targetId].health || 100) - 15
                );
                players[attackerId].score = 
                    (players[attackerId].score || 0) + 10;
            }
        }
        
        // Broadcast updated players
        io.emit("updatePlayers", players);
    });
    socket.on("damagePlayer", (data) => {
        if (players[data.targetId] && players[data.attackerId]) {
            // Reduce health
            players[data.targetId].health = Math.max(0, 
                (players[data.targetId].health || 100) - data.damage
            );
            
            // Increase attacker's score
            players[data.attackerId].score = 
                (players[data.attackerId].score || 0) + 5;
            
            // Broadcast updated players
            io.emit("updatePlayers", players);
        }
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