/*
 * Client-seitige Spiellogik für das Minispiel "Wortkartoffel".
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Wortkartoffel-Client-Skript geladen.');

    const socket = io();

    // --- SETTINGS UI ELEMENTS ---
    const settingsIcon = document.getElementById('settings-icon');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const startGameButton = document.getElementById('start-game-button');
    const languageSwitch = document.getElementById('language-switch');
    const startTimerSlider = document.getElementById('start-timer-slider');
    const timeBonusSlider = document.getElementById('time-bonus-slider');
    const livesSlider = document.getElementById('lives-slider');
    const startTimerValue = document.getElementById('start-timer-value');
    const timeBonusValue = document.getElementById('time-bonus-value');
    const livesValue = document.getElementById('lives-value');

    // --- GAME UI ELEMENTS ---
    const playersContainer = document.getElementById('players-container');
    const potatoArrow = document.getElementById('potato-arrow');
    const syllableDisplay = document.getElementById('syllable');
    const timerDisplay = document.getElementById('timer');
    const usedWordsList = document.getElementById('used-words-list');

    // --- CLIENT-SIDE STATE ---
    let myPlayerId = null;

    // --- SETTINGS LOGIC ---
    settingsIcon.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));

    startTimerSlider.addEventListener('input', () => startTimerValue.textContent = startTimerSlider.value);
    timeBonusSlider.addEventListener('input', () => timeBonusValue.textContent = timeBonusSlider.value);
    livesSlider.addEventListener('input', () => livesValue.textContent = livesSlider.value);

    startGameButton.addEventListener('click', () => {
        const gameSettings = {
            language: languageSwitch.value,
            startTimer: parseInt(startTimerSlider.value, 10),
            timeBonus: parseInt(timeBonusSlider.value, 10),
            lives: parseInt(livesSlider.value, 10)
        };
        socket.emit('start-wortkartoffel-game', gameSettings);
        settingsModal.classList.add('hidden');
    });

    // --- GAMEPLAY LOGIC ---
    function updateUI(gameState) {
        if (!gameState || !gameState.players) return;

        playersContainer.innerHTML = ''; // Clear existing players

        const numPlayers = gameState.players.length;
        const containerRect = playersContainer.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        const radiusX = centerX * 0.85; // Use 85% of the radius for spacing
        const radiusY = centerY * 0.8;

        gameState.players.forEach((player, index) => {
            // Calculate player position in a circle
            const angle = (index / numPlayers) * 2 * Math.PI - (Math.PI / 2); // Start at the top
            const x = centerX + radiusX * Math.cos(angle);
            const y = centerY + radiusY * Math.sin(angle);

            const playerArea = document.createElement('div');
            playerArea.className = 'player-area';
            playerArea.id = `player-${player.id}`;
            playerArea.style.left = `${x}px`;
            playerArea.style.top = `${y}px`;

            const isMyTurn = myPlayerId === player.id && myPlayerId === gameState.activePlayerId;

            playerArea.innerHTML = `
                <div class="player-info">
                    <span class="player-name">${player.name}</span>
                    <div class="player-lives">${'❤️'.repeat(player.lives)}</div>
                </div>
                <input type="text" class="word-input ${isMyTurn ? '' : 'hidden'}" placeholder="Wort eingeben...">
            `;
            playersContainer.appendChild(playerArea);

            if (isMyTurn) {
                const myInput = playerArea.querySelector('.word-input');
                myInput.focus();
            }
        });

        syllableDisplay.textContent = gameState.currentSyllable;

        const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId);
        if (activePlayer) {
            const activePlayerIndex = gameState.players.indexOf(activePlayer);
            const angleInDegrees = (activePlayerIndex / numPlayers) * 360 - 90; // -90deg to start from top
            potatoArrow.style.transform = `rotate(${angleInDegrees + 90}deg)`; // +90deg to align arrow model
        }

        usedWordsList.innerHTML = '';
        (gameState.usedWords || []).forEach(word => {
            const li = document.createElement('li');
            li.textContent = word;
            usedWordsList.appendChild(li);
        });

        if (gameState.timer !== undefined) {
            timerDisplay.textContent = gameState.timer;
        }
    }

    playersContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('word-input')) {
            const word = e.target.value.trim().toLowerCase();
            if (word) {
                socket.emit('wortkartoffel-validate-word', { word: word });
                e.target.value = '';
            }
        }
    });

    // --- SOCKET EVENT HANDLERS ---
    socket.on('connect', () => {
        console.log('Verbunden mit dem Server!', socket.id);
        myPlayerId = socket.id;
    });

    socket.on('wortkartoffel-game-started', (initialState) => {
        console.log('Game started!', initialState);
        updateUI(initialState);
    });

    socket.on('wortkartoffel-gamestate-update', (gameState) => {
        console.log('Game state update received:', gameState);
        updateUI(gameState);
    });

    socket.on('wortkartoffel-invalid-word', ({ type }) => {
        const myInput = document.querySelector(`#player-${myPlayerId} .word-input`);
        if (myInput) {
            myInput.classList.add('invalid');
            setTimeout(() => {
                myInput.classList.remove('invalid');
                myInput.value = '';
            }, 1000);
        }
    });

    socket.on('wortkartoffel-game-over', ({ winner }) => {
        const inputs = document.querySelectorAll('.word-input');
        inputs.forEach(input => input.disabled = true);

        let message = "Das Spiel ist vorbei! ";
        if (winner) {
            if (winner.id === myPlayerId) {
                message += "Du hast gewonnen!";
            } else {
                message += `${winner.name} hat gewonnen!`;
            }
        } else {
            message += "Unentschieden oder vorzeitig beendet!";
        }

        setTimeout(() => {
            alert(message);
            // Optional: Redirect back to lobby
            // window.location.href = '/';
        }, 500);
    });
});
