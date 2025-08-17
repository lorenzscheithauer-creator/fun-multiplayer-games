const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

// --- Server-Side State ---
let groups = [];
const activeWortkartoffelGames = new Map();

// --- Helper Functions ---
function generateTicketCode(length = 5) {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// --- Wortkartoffel Helper Functions ---
function loadWordList(language) {
    try {
        const filePath = path.join(__dirname, 'assets', 'wortlisten', `${language}.txt`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return fileContent.split(/\r?\n/).filter(word => word.length > 0).map(word => word.toLowerCase());
    } catch (error) {
        console.error(`Error loading word list for language: ${language}`, error);
        return [];
    }
}

function loadSyllables() {
     try {
        const filePath = path.join(__dirname, 'assets', 'silben.txt');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return fileContent.split(/\r?\n/).filter(s => s.length > 0);
    } catch (error) {
        console.error(`Error loading syllables`, error);
        return [];
    }
}

function broadcastGameState(gameId) {
    const gameState = activeWortkartoffelGames.get(gameId);
    if (!gameState) return;
    const stateForClient = { players: gameState.players, currentSyllable: gameState.currentSyllable, activePlayerId: gameState.players[gameState.currentPlayerIndex].id, usedWords: gameState.usedWords, timer: gameState.timer };
    gameState.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) playerSocket.emit('wortkartoffel-gamestate-update', stateForClient);
    });
}

function endGame(gameId, winner) {
    const gameState = activeWortkartoffelGames.get(gameId);
    if (!gameState) return;
    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) playerSocket.emit('wortkartoffel-game-over', { winner });
    });
    activeWortkartoffelGames.delete(gameId);
    console.log(`Wortkartoffel game ended for group ${gameId}`);
}

function startRound(gameId) {
    const gameState = activeWortkartoffelGames.get(gameId);
    if (!gameState) return;
    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.timer = gameState.settings.startTimer;
    gameState.usedWords = [];
    const syllableList = loadSyllables();
    if (syllableList.length > 0) gameState.currentSyllable = syllableList[Math.floor(Math.random() * syllableList.length)];
    broadcastGameState(gameId);
    gameState.timerId = setInterval(() => {
        if (!activeWortkartoffelGames.has(gameId)) return clearInterval(gameState.timerId);
        gameState.timer--;
        if (gameState.timer <= 0) {
            clearInterval(gameState.timerId);
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            currentPlayer.lives--;
            const playersWithLives = gameState.players.filter(p => p.lives > 0);
            if (playersWithLives.length <= 1) {
                endGame(gameId, playersWithLives.length === 1 ? playersWithLives[0] : null);
            } else {
                if (gameState.players[gameState.currentPlayerIndex].lives <= 0) {
                    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                    while (gameState.players[nextPlayerIndex].lives <= 0) nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
                    gameState.currentPlayerIndex = nextPlayerIndex;
                }
                startRound(gameId);
            }
        } else {
            broadcastGameState(gameId);
        }
    }, 1000);
}

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register-name', (name) => {
        socket.playerName = name || `Player${socket.id.substring(0,4)}`;
        console.log(`${socket.id} registered as ${socket.playerName}`);
        socket.emit('registration-successful', socket.playerName);
    });

    socket.on('create-group', () => {
        const ticketCode = generateTicketCode();
        const newGroup = { id: `group-${ticketCode}`, leaderName: socket.playerName, players: [{ name: socket.playerName, id: socket.id }], maxSize: 7, ticketCode: ticketCode };
        groups.push(newGroup);
        socket.join(newGroup.id);
        socket.emit('group-state-update', newGroup);
    });

    socket.on('join-group-with-code', (ticketCode) => {
        const code = ticketCode.toUpperCase();
        const group = groups.find(g => g.ticketCode === code);
        if (!group) return socket.emit('join-error', { message: 'Group not found.' });
        if (group.players.length >= group.maxSize) return socket.emit('join-error', { message: 'Group is full.' });
        if (group.players.some(p => p.id === socket.id)) return socket.emit('join-error', { message: 'You are already in this group.' });

        group.players.push({ name: socket.playerName, id: socket.id });
        socket.join(group.id);
        io.to(group.id).emit('group-state-update', group);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id, `(${socket.playerName})`);
        let groupToUpdate = null;
        for (const group of groups) {
            const playerIndex = group.players.findIndex(p => p.id === socket.id);
            if (playerIndex > -1) {
                group.players.splice(playerIndex, 1);
                groupToUpdate = group;
                break;
            }
        }
        if (groupToUpdate) {
            if (groupToUpdate.players.length === 0) {
                groups = groups.filter(g => g.id !== groupToUpdate.id);
                if (activeWortkartoffelGames.has(groupToUpdate.id)) endGame(groupToUpdate.id, null);
            } else {
                if (groupToUpdate.leaderName === socket.playerName) {
                    groupToUpdate.leaderName = groupToUpdate.players[0].name;
                }
                io.to(groupToUpdate.id).emit('group-state-update', groupToUpdate);
            }
        }
    });

    // --- Wortkartoffel Event Handlers ---
    socket.on('start-wortkartoffel-game', (settings) => {
        const group = groups.find(g => g.players.some(p => p.id === socket.id));
        if (!group) return socket.emit('error-starting-game', 'You must be in a group to start a game.');
        if (group.leaderName !== socket.playerName) return socket.emit('error-starting-game', 'Only the group leader can start the game.');
        if (group.players.length < 2) return socket.emit('error-starting-game', 'You need at least 2 players to start.');

        const gameState = { gameId: group.id, players: group.players.map(p => ({ ...p, lives: settings.lives })), settings, wordList: loadWordList(settings.language), currentSyllable: '', currentPlayerIndex: group.players.findIndex(p => p.name === group.leaderName), usedWords: [], timer: settings.startTimer, timerId: null };
        activeWortkartoffelGames.set(group.id, gameState);
        console.log(`Wortkartoffel game started for group ${group.id}`);
        startRound(group.id);
    });

    socket.on('wortkartoffel-validate-word', ({ word }) => {
        let gameId, gameState;
        for (const [id, state] of activeWortkartoffelGames.entries()) {
            if (state.players.some(p => p.id === socket.id)) { gameId = id; gameState = state; break; }
        }
        if (!gameState) return;
        const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== gameState.currentPlayerIndex) return;
        const wordLower = word.toLowerCase();
        const isValid = wordLower.includes(gameState.currentSyllable.toLowerCase()) && gameState.wordList.includes(wordLower) && !gameState.usedWords.includes(wordLower);
        if (!isValid) {
            socket.emit('wortkartoffel-invalid-word', { type: 'validation-failed' });
        } else {
            gameState.usedWords.push(wordLower);
            gameState.timer += gameState.settings.timeBonus;
            let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            while (gameState.players[nextPlayerIndex].lives <= 0) nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
            gameState.currentPlayerIndex = nextPlayerIndex;
            broadcastGameState(gameId);
        }
    });
});

server.listen(PORT, () => {
  console.log(`Lobby server is running on http://localhost:${PORT}`);
});
