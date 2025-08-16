const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the root public directory
app.use(express.static(path.join(__dirname)));

// --- Server-Side State ---
// This will be expanded in the next step
let groups = [];

// --- Socket.IO Logic ---
// This will be implemented in the next step
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Store player name on the socket object for easy access
    // The name is received from the client upon connection
    socket.on('register-name', (name) => {
        socket.playerName = name || `Player${socket.id.substring(0,4)}`;
        console.log(`${socket.id} registered as ${socket.playerName}`);
        // Send the assigned name and current groups back to the newly connected client
        socket.emit('registration-successful', socket.playerName);
        socket.emit('update-groups', groups);
    });

    socket.on('create-group', () => {
        const newGroup = {
            id: `group-${Math.random().toString(36).substr(2, 9)}`,
            leaderName: socket.playerName,
            players: [socket.playerName],
            maxSize: 7,
            selectedGame: null
        };
        groups.push(newGroup);
        io.emit('update-groups', groups); // Broadcast to all
    });

    socket.on('join-group', (groupId) => {
        const group = groups.find(g => g.id === groupId);
        if (group && group.players.length < group.maxSize && !group.players.includes(socket.playerName)) {
            group.players.push(socket.playerName);
            io.emit('update-groups', groups);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id, `(${socket.playerName})`);
        // Remove player from any group they were in
        groups.forEach(group => {
            const playerIndex = group.players.indexOf(socket.playerName);
            if (playerIndex > -1) {
                group.players.splice(playerIndex, 1);
            }
        });

        // Filter out empty groups
        groups = groups.filter(group => group.players.length > 0);

        // If the leader of a group left, assign a new leader
        groups.forEach(group => {
            if (group.leaderName === socket.playerName) {
                group.leaderName = group.players[0]; // New leader is the next person in the list
            }
        });

        io.emit('update-groups', groups);
    });
});


server.listen(PORT, () => {
  console.log(`Lobby server is running on http://localhost:${PORT}`);
});
