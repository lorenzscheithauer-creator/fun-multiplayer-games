document.addEventListener('DOMContentLoaded', () => {
    // --- Modal Elements ---
    const nameModalOverlay = document.getElementById('name-modal-overlay');
    const nameInput = document.getElementById('name-input');
    const confirmNameButton = document.getElementById('confirm-name-button');

    // --- Lobby Elements ---
    const createGroupButton = document.getElementById('create-group-button');
    const groupLobbyContainer = document.querySelector('.group-lobby-container');
    const gameGrid = document.querySelector('.game-grid');

    if (!createGroupButton || !groupLobbyContainer || !gameGrid || !nameModalOverlay) {
        console.error('Required UI elements not found!');
        return;
    }

    // --- Client-Side State ---
    const myPlayerId = `Player${Math.floor(Math.random() * 1000)}`;
    let groups = []; // Array to hold the state of all groups
    let groupCounter = 0;

    // --- State-based Rendering ---
    function renderLobby() {
        groupLobbyContainer.innerHTML = ''; // Clear the container

        groups.forEach(group => {
            const ticket = document.createElement('div');
            ticket.className = 'group-ticket';
            ticket.dataset.groupId = group.id;

            const isLeader = group.leaderId === myPlayerId;
            const isMember = group.players.includes(myPlayerId);
            const isFull = group.players.length >= 7;

            let gameSelectionHTML = '';
            if (group.selectedGame) {
                gameSelectionHTML = `<div class="group-ticket__game">Ausgewählt: ${group.selectedGame.name}</div>`;
            }

            let startButtonHTML = '';
            if (isLeader && group.selectedGame) {
                startButtonHTML = `<button class="action-button start-game-button">Spiel starten</button>`;
            }

            ticket.innerHTML = `
                <div class="group-ticket__name">Gruppe von ${group.leaderId}</div>
                <div class="group-ticket__players">
                    <span class="player-count">${group.players.length}</span>/7
                </div>
                ${gameSelectionHTML}
                <button class="action-button join-button" ${isMember || isFull ? 'disabled' : ''}>${isMember ? 'Beigetreten' : 'Beitreten'}</button>
                ${startButtonHTML}
            `;
            groupLobbyContainer.appendChild(ticket);
        });
    }

    // --- Event Handlers ---
    function handleCreateGroup() {
        groupCounter++;
        const newGroup = {
            id: `group-${groupCounter}`,
            leaderId: myPlayerId,
            players: [myPlayerId],
            selectedGame: null
        };
        groups.push(newGroup);
        renderLobby();
    }

    function handleJoinGroup(e) {
        if (e.target.classList.contains('join-button')) {
            const groupId = e.target.closest('.group-ticket').dataset.groupId;
            const group = groups.find(g => g.id === groupId);

            if (group && group.players.length < 7 && !group.players.includes(myPlayerId)) {
                group.players.push(myPlayerId);
                renderLobby();
            }
        }
    }

    function handleStartGame(e) {
        if (e.target.classList.contains('start-game-button')) {
            const groupId = e.target.closest('.group-ticket').dataset.groupId;
            const group = groups.find(g => g.id === groupId);

            if (group) {
                if (group.players.length < 2) {
                    alert('Mindestens 2 Spieler sind für den Start erforderlich.');
                } else {
                    // Note: This only redirects the current user.
                    // A real implementation would need a server to coordinate the redirect for all players.
                    window.location.href = group.selectedGame.url;
                }
            }
        }
    }

    function handleGameSelect(e) {
        // Find the group where the current player is the leader
        const myGroup = groups.find(g => g.leaderId === myPlayerId);

        if (myGroup) {
            // If the player is a leader, prevent navigation and select the game
            e.preventDefault();
            const gameCard = e.target.closest('a');
            if (!gameCard) return;

            myGroup.selectedGame = {
                name: gameCard.textContent.trim(),
                url: gameCard.getAttribute('href')
            };
            renderLobby();
        }
        // If the player is not a leader of any group, the default link behavior will proceed.
    }

    // --- Event Listeners ---
    createGroupButton.addEventListener('click', handleCreateGroup);
    groupLobbyContainer.addEventListener('click', (e) => {
        handleJoinGroup(e);
        handleStartGame(e);
    });
    gameGrid.addEventListener('click', handleGameSelect);

    // --- Name Modal Logic ---
    function initNameModal() {
        const playerName = localStorage.getItem('playerName');
        if (playerName) {
            nameModalOverlay.classList.add('hidden');
            // Update the player ID with the stored name
            myPlayerId = playerName;
        } else {
            nameModalOverlay.classList.remove('hidden');
        }
    }

    confirmNameButton.addEventListener('click', () => {
        const playerName = nameInput.value.trim();
        if (playerName) {
            localStorage.setItem('playerName', playerName);
            myPlayerId = playerName;
            nameModalOverlay.classList.add('hidden');
        } else {
            alert('Please enter a name.');
        }
    });

    renderLobby(); // Initial render
    initNameModal(); // Check for name on page load
    console.log(`Lobby script loaded for ${myPlayerId}.`);
});
