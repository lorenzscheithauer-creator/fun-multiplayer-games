document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const nameModalOverlay = document.getElementById('name-modal-overlay');
    const nameInput = document.getElementById('name-input');
    const confirmNameButton = document.getElementById('confirm-name-button');
    const randomNameButton = document.getElementById('random-name-button');
    const createGroupButton = document.getElementById('create-group-button');
    const groupLobbyContainer = document.querySelector('.group-lobby-container');
    const gameGrid = document.querySelector('.game-grid');

    if (!nameModalOverlay || !nameInput || !confirmNameButton || !createGroupButton || !groupLobbyContainer || !gameGrid) {
        console.error('A critical UI element was not found. Check all IDs and classes in index.html.');
        return;
    }

    // --- Client-Side State ---
    let myPlayerName = null;

    // --- Rendering ---
    function renderLobby(groups) {
        groupLobbyContainer.innerHTML = ''; // Clear the container

        if (!groups) return;

        groups.forEach(group => {
            const ticket = document.createElement('div');
            ticket.className = 'group-ticket';
            ticket.dataset.groupId = group.id;

            const isLeader = group.leaderName === myPlayerName;
            const isMember = group.players.includes(myPlayerName);
            const isFull = group.players.length >= group.maxSize;

            // This logic will be re-added later. For now, focus on server sync.
            let gameSelectionHTML = '';
            let startButtonHTML = '';

            ticket.innerHTML = `
                <div class="group-ticket__name">Gruppe von ${group.leaderName}</div>
                <div class="group-ticket__players">
                    <span class="player-count">${group.players.length}</span>/${group.maxSize}
                </div>
                ${gameSelectionHTML}
                <button class="action-button join-button" ${isMember || isFull ? 'disabled' : ''}>${isMember ? 'Beigetreten' : 'Beitreten'}</button>
                ${startButtonHTML}
            `;
            groupLobbyContainer.appendChild(ticket);
        });
    }

    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        console.log('Connected to server!');
        // Re-evaluate button state on connection, in case a name was typed before connecting
        if (nameInput.value.trim().length > 0) {
            confirmNameButton.disabled = false;
        }
    });

    socket.on('update-groups', (groups) => {
        renderLobby(groups);
    });

    function generateRandomName() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 7; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // --- UI Event Listeners ---
    nameInput.addEventListener('input', () => {
        confirmNameButton.disabled = nameInput.value.trim() === '';
    });

    randomNameButton.addEventListener('click', () => {
        nameInput.value = generateRandomName();
        confirmNameButton.disabled = false; // Enable confirm button
    });

    createGroupButton.addEventListener('click', () => {
        socket.emit('create-group');
    });

    groupLobbyContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-button')) {
            const groupId = e.target.closest('.group-ticket').dataset.groupId;
            socket.emit('join-group', groupId);
        }
    });

    // --- Name Modal Logic ---
    function initNameModal() {
        const storedName = localStorage.getItem('playerName');
        if (storedName) {
            myPlayerName = storedName;
            nameModalOverlay.classList.add('hidden');
            socket.emit('register-name', myPlayerName);
        } else {
            // Temporarily disabled by user request
            nameModalOverlay.classList.add('hidden');
        }
    }

    confirmNameButton.addEventListener('click', () => {
        const playerName = nameInput.value.trim();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem('playerName', myPlayerName);
            nameModalOverlay.classList.add('hidden');
            socket.emit('register-name', myPlayerName);
        }
        // No 'else' needed, as the button should be disabled if the input is empty.
    });

    initNameModal();
    console.log('Lobby script loaded.');
});
