const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Game State and Logic ---

let gameState = {
  players: {},
  deck: [],
  communityCards: [],
  pot: 0,
  currentPlayerTurn: null,
  gameInProgress: false
};

function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function startGame(startingChips = 1000) {
  if (Object.keys(gameState.players).length < 2) {
    console.log("Not enough players to start the game.");
    return;
  }

  gameState.gameInProgress = true;
  gameState.deck = shuffleDeck(createDeck());
  gameState.communityCards = [];
  gameState.pot = 0;

  // Assign chips and deal cards
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    player.chips = startingChips;
    player.cards = [gameState.deck.pop(), gameState.deck.pop()];
  }

  // TODO: Determine first player to act
  gameState.currentPlayerTurn = Object.keys(gameState.players)[0];

  console.log("Game started!");
}

const PORT = process.env.PORT || 3000;

// Serve static files from the 'games' directory
app.use(express.static(path.join(__dirname)));

// Route for the main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'game1.html'));
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Add new player to the game state
  gameState.players[socket.id] = {
    id: socket.id,
    chips: 0,
    cards: []
  };

  // The old auto-start logic is no longer needed, will be triggered by host.
  // We still broadcast the state so new players get the current state.
  io.emit('gameState', gameState);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove player from the game state
    delete gameState.players[socket.id];

    // TODO: Add logic to handle game state if a player disconnects mid-game
    if (Object.keys(gameState.players).length < 2 && gameState.gameInProgress) {
        console.log("Not enough players, game paused.");
        gameState.gameInProgress = false; // Reset game
    }

    // Broadcast the updated game state to all clients
    io.emit('gameState', gameState);
  });

  socket.on('requestStartGame', () => {
    // Any player can start the game, as long as it's not already in progress
    if (!gameState.gameInProgress) {
      console.log(`Player ${socket.id} started the game.`);
      startGame(); // Starts with default 1000 chips
      io.emit('gameState', gameState); // Broadcast the new state
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
