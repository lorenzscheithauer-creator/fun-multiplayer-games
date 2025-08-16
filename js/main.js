document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const createGroupButton = document.getElementById('create-group-button');
    const groupLobbyContainer = document.querySelector('.group-lobby-container');
    const gameGrid = document.querySelector('.game-grid');

    if (!createGroupButton || !groupLobbyContainer || !gameGrid) {
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
        // Name feature removed. Register with the server to get a default name.
        socket.emit('register-name', null);
    });

    // The server will send back the assigned name
    socket.on('registration-successful', (assignedName) => {
        myPlayerName = assignedName;
        console.log(`Registered with server as: ${myPlayerName}`);
    });

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

    console.log('Lobby script loaded.');
});
