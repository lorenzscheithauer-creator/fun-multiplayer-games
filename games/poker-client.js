document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const setupScreen = document.getElementById('setup-screen');
    const hostControls = document.getElementById('host-controls');
    const waitingMessage = document.getElementById('waiting-message');
    const pokerTable = document.getElementById('poker-table');
    const actionsContainer = document.getElementById('actions-container');

    const playerSeats = document.querySelectorAll('.player-seat');
    const communityCardsContainer = document.querySelector('.community-cards');
    const potValueElement = document.querySelector('.pot__value');
    const foldButton = document.getElementById('fold-button');
    const checkButton = document.getElementById('check-button');
    const betButton = document.getElementById('bet-button');
    const betSlider = document.getElementById('bet-slider');
    const betAmountSpan = document.getElementById('bet-amount');
    const startGameButton = document.getElementById('start-game-button');
    const startingChipsInput = document.getElementById('starting-chips');

    let myPlayerId = null;

    // --- Socket Listeners ---
    socket.on('connect', () => {
        myPlayerId = socket.id;
        console.log('Connected to server with ID:', myPlayerId);
    });

    socket.on('gameState', (gameState) => {
        console.log('Received game state:', gameState);
        updateUI(gameState);
    });


    // --- UI Update Functions ---
    function updateUI(gameState) {
        if (!myPlayerId) return;

        // Show/hide setup screen vs game table
        if (gameState.gameInProgress) {
            setupScreen.classList.add('hidden');
            pokerTable.classList.remove('hidden');
            actionsContainer.classList.remove('hidden');
        } else {
            setupScreen.classList.remove('hidden');
            pokerTable.classList.add('hidden');
            actionsContainer.classList.add('hidden');

            // Show host controls or waiting message
            if (myPlayerId === gameState.hostId) {
                hostControls.classList.remove('hidden');
                waitingMessage.classList.add('hidden');
            } else {
                hostControls.classList.add('hidden');
                waitingMessage.classList.remove('hidden');
            }
        }

        // Update pot
        potValueElement.textContent = gameState.pot;

        // Update community cards
        communityCardsContainer.innerHTML = '';
        gameState.communityCards.forEach(card => {
            communityCardsContainer.appendChild(createCardElement(card));
        });
        // Fill remaining with placeholders
        for (let i = gameState.communityCards.length; i < 5; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'card card--placeholder';
            communityCardsContainer.appendChild(placeholder);
        }

        const playerIds = Object.keys(gameState.players);
        playerSeats.forEach((seat, index) => {
            const playerId = playerIds[index];
            const player = gameState.players[playerId];

            if (player) {
                seat.style.display = 'block';
                const nameEl = seat.querySelector('.player__name');
                const chipsEl = seat.querySelector('.player__chips');
                const cardsContainer = seat.querySelector('.player__cards');

                nameEl.textContent = player.id === myPlayerId ? `You (${player.id.substring(0, 4)})` : `Player ${player.id.substring(0, 4)}`;
                chipsEl.textContent = player.chips;

                cardsContainer.innerHTML = '';
                if (player.cards && player.cards.length > 0) {
                    player.cards.forEach(card => {
                        const showCard = (player.id === myPlayerId);
                        cardsContainer.appendChild(createCardElement(card, showCard));
                    });
                } else {
                    // Render placeholders if no cards
                    cardsContainer.appendChild(createCardElement(null, false));
                    cardsContainer.appendChild(createCardElement(null, false));
                }

            } else {
                seat.style.display = 'none';
            }
        });
    }

    function createCardElement(card, isVisible) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        if (!isVisible || !card) {
            cardEl.classList.add('card--back');
        } else {
            cardEl.textContent = getCardSymbol(card);
            cardEl.style.color = getCardColor(card);
        }
        return cardEl;
    }

    function getCardSymbol(card) {
        if (!card) return '';
        const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
        return `${card.value}${suits[card.suit]}`;
    }

    function getCardColor(card) {
        if (!card) return 'black';
        return (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    }


    // --- Event Listeners ---
    foldButton.addEventListener('click', () => {
        socket.emit('playerAction', { action: 'fold' });
    });

    checkButton.addEventListener('click', () => {
        socket.emit('playerAction', { action: 'check' });
    });

    betButton.addEventListener('click', () => {
        const amount = parseInt(betSlider.value, 10);
        socket.emit('playerAction', { action: 'bet', amount: amount });
    });

    betSlider.addEventListener('input', (e) => {
        betAmountSpan.textContent = e.target.value;
    });

    startGameButton.addEventListener('click', () => {
        const startingChips = parseInt(startingChipsInput.value, 10);
        socket.emit('requestStartGame', { startingChips });
    });

    console.log('Poker client script loaded.');
});
