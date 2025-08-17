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

        // Dynamically create and position player areas
        playersContainer.innerHTML = '';
        const playerAreas = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

        gameState.players.forEach((player, index) => {
            const playerArea = document.createElement('div');
            playerArea.className = 'player-area';
            playerArea.id = `player-${player.id}`;
            // Assign grid area based on index. This is a simple layout for up to 4 players.
            // It needs to be more robust for more players.
            if(index < playerAreas.length) {
                playerArea.style.gridArea = playerAreas[index];
            }

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
            // This rotation logic assumes players are laid out evenly in a circle.
            const angle = (activePlayerIndex / gameState.players.length) * 360;
            potatoArrow.style.transform = `rotate(${angle}deg)`;
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
