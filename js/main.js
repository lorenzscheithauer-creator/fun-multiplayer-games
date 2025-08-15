document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const nameModalOverlay = document.getElementById('name-modal-overlay');
    const nameInput = document.getElementById('name-input');
    const confirmNameButton = document.getElementById('confirm-name-button');
    const createGroupButton = document.getElementById('create-group-button');
    const groupLobbyContainer = document.querySelector('.group-lobby-container');
    const gameGrid = document.querySelector('.game-grid');

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
    socket.on('update-groups', (groups) => {
        renderLobby(groups);
    });

    // --- UI Event Listeners ---
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
            nameModalOverlay.classList.remove('hidden');
        }
    }

    confirmNameButton.addEventListener('click', () => {
        const playerName = nameInput.value.trim();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem('playerName', myPlayerName);
            nameModalOverlay.classList.add('hidden');
            socket.emit('register-name', myPlayerName);
        } else {
            alert('Please enter a name.');
        }
    });

    initNameModal();
    console.log('Lobby script loaded.');
});
