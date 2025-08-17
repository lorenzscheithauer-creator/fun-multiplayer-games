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

    const stateForClient = {
        players: gameState.players,
        currentSyllable: gameState.currentSyllable,
        activePlayerId: gameState.players[gameState.currentPlayerIndex].id,
        usedWords: gameState.usedWords,
        timer: gameState.timer
    };

    gameState.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
            playerSocket.emit('wortkartoffel-gamestate-update', stateForClient);
        }
    });
}

function endGame(gameId, winner) {
    const gameState = activeWortkartoffelGames.get(gameId);
    if (!gameState) return;
    if (gameState.timerId) clearInterval(gameState.timerId);

    gameState.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
            playerSocket.emit('wortkartoffel-game-over', { winner });
        }
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
    if (syllableList.length > 0) {
        gameState.currentSyllable = syllableList[Math.floor(Math.random() * syllableList.length)];
    }

    broadcastGameState(gameId);

    gameState.timerId = setInterval(() => {
        if (!activeWortkartoffelGames.has(gameId)) {
            clearInterval(gameState.timerId);
            return;
        }

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
                    while (gameState.players[nextPlayerIndex].lives <= 0) {
                        nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
                    }
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
        socket.emit('update-groups', groups);
    });

    socket.on('create-group', () => {
        const newGroup = { id: `group-${Math.random().toString(36).substr(2, 9)}`, leaderName: socket.playerName, players: [socket.playerName], maxSize: 7, selectedGame: null };
        groups.push(newGroup);
        io.emit('update-groups', groups);
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
        // Wortkartoffel cleanup
        let gameToEnd = null;
        for (const [gameId, state] of activeWortkartoffelGames.entries()) {
            const playerInGame = state.players.find(p => p.id === socket.id);
            if (playerInGame) {
                playerInGame.lives = 0;
                const playersWithLives = state.players.filter(p => p.lives > 0);
                if (playersWithLives.length <= 1) {
                    gameToEnd = gameId;
                }
            }
        }
        if(gameToEnd) endGame(gameToEnd, null);


        groups.forEach(group => {
            const playerIndex = group.players.indexOf(socket.playerName);
            if (playerIndex > -1) group.players.splice(playerIndex, 1);
        });
        groups = groups.filter(group => group.players.length > 0);
        groups.forEach(group => {
            if (group.leaderName === socket.playerName) group.leaderName = group.players[0];
        });
        io.emit('update-groups', groups);
    });

    // --- Wortkartoffel Event Handlers ---
    socket.on('start-wortkartoffel-game', (settings) => {
        const group = groups.find(g => g.players.includes(socket.playerName));
        if (!group) return socket.emit('error-starting-game', 'You must be in a group to start a game.');
        if (group.leaderName !== socket.playerName) return socket.emit('error-starting-game', 'Only the group leader can start the game.');

        const playerSockets = [];
        for (const [id, s] of io.sockets.sockets) {
            if (group.players.includes(s.playerName)) playerSockets.push(s);
        }

        const wordList = loadWordList(settings.language);
        const syllableList = loadSyllables();
        if (wordList.length === 0 || syllableList.length === 0) return playerSockets.forEach(s => s.emit('error-starting-game', 'Could not load necessary game files.'));

        const gameState = {
            gameId: group.id,
            players: group.players.map(playerName => ({ name: playerName, lives: settings.lives, id: playerSockets.find(s => s.playerName === playerName).id })),
            settings: settings,
            wordList: wordList,
            currentSyllable: '',
            currentPlayerIndex: group.players.indexOf(group.leaderName),
            usedWords: [],
            timer: settings.startTimer,
            timerId: null
        };

        activeWortkartoffelGames.set(group.id, gameState);
        console.log(`Wortkartoffel game started for group ${group.id}`);
        startRound(group.id);
    });

    socket.on('wortkartoffel-validate-word', ({ word }) => {
        let gameId, gameState;
        for (const [id, state] of activeWortkartoffelGames.entries()) {
            if (state.players.some(p => p.id === socket.id)) {
                gameId = id;
                gameState = state;
                break;
            }
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
            while (gameState.players[nextPlayerIndex].lives <= 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
            }
            gameState.currentPlayerIndex = nextPlayerIndex;

            broadcastGameState(gameId);
        }
    });
});

server.listen(PORT, () => {
  console.log(`Lobby server is running on http://localhost:${PORT}`);
});
