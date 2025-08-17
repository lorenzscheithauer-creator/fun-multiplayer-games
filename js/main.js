document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const createGroupButton = document.getElementById('create-group-button');
    const joinGroupButton = document.getElementById('join-group-button');
    const groupLobbyContainer = document.querySelector('.group-lobby-container');

    const joinGroupModal = document.getElementById('join-group-modal');
    const closeJoinModalButton = document.getElementById('close-join-modal-button');
    const confirmJoinButton = document.getElementById('confirm-join-button');
    const joinCodeInput = document.getElementById('join-code-input');

    const gameGrid = document.querySelector('.game-grid');

    // --- Client-Side State ---
    let myPlayerName = null;
    let myGroup = null;

    // --- UI Rendering ---
    function renderGroupLobby(group) {
        myGroup = group;
        groupLobbyContainer.innerHTML = '';

        if (!group) {
            gameGrid.classList.remove('leader');
            return;
        }

        const isLeader = myPlayerName === group.leaderName;
        const groupInfo = document.createElement('div');
        groupInfo.className = 'group-info-ticket';

        let playersHTML = group.players.map(p =>
            `<li>${p.name} ${p.name === group.leaderName ? '<b>(Leader)</b>' : ''}</li>`
        ).join('');

        groupInfo.innerHTML = `
            <h3>Gruppe von ${group.leaderName}</h3>
            <p>Ticket-Code: <strong class="ticket-code">${group.ticketCode}</strong></p>
            <h4>Spieler (${group.players.length}/${group.maxSize}):</h4>
            <ul>${playersHTML}</ul>
        `;

        if (isLeader) {
            const startGameButton = document.createElement('button');
            startGameButton.className = 'action-button';
            startGameButton.id = 'leader-start-game-button';
            startGameButton.textContent = 'Spiel starten';

            if (group.players.length < 2) {
                startGameButton.disabled = true;
                startGameButton.title = 'Mindestens 2 Spieler benötigt';
            }
            groupInfo.appendChild(startGameButton);

            startGameButton.addEventListener('click', () => {
                const selectedGame = document.querySelector('.game-grid a.selected');
                if (!selectedGame) {
                    alert('Bitte wähle ein Spiel aus!');
                    return;
                }

                // The server will handle starting the game for the selected game
                // For now, we assume the leader's click is the trigger.
                // A better implementation would have the game selection also emit an event.
                if (selectedGame.id === 'game-wortkartoffel') {
                     // On the game page, the leader would get the settings modal.
                     // The server needs to know which group is navigating.
                     // A simple redirect is not enough for a real system.
                     // This part of the logic needs more thought in a real scenario.
                     window.location.href = selectedGame.href;
                } else {
                     alert(`Start für ${selectedGame.textContent} noch nicht implementiert.`);
                }
            });
        }

        groupLobbyContainer.appendChild(groupInfo);

        // Toggle game selection based on leader status
        const gameLinks = document.querySelectorAll('.game-grid a');
        gameLinks.forEach(link => {
            link.classList.toggle('disabled', !isLeader);
        });
    }


    // --- Event Listeners ---
    createGroupButton.addEventListener('click', () => socket.emit('create-group'));
    joinGroupButton.addEventListener('click', () => joinGroupModal.classList.remove('hidden'));
    closeJoinModalButton.addEventListener('click', () => joinGroupModal.classList.add('hidden'));

    confirmJoinButton.addEventListener('click', () => {
        const code = joinCodeInput.value.trim().toUpperCase();
        if (code) {
            socket.emit('join-group-with-code', code);
            joinCodeInput.value = '';
            joinGroupModal.classList.add('hidden');
        }
    });

    gameGrid.addEventListener('click', (e) => {
        const targetLink = e.target.closest('a');
        if (targetLink && myGroup && myPlayerName === myGroup.leaderName) {
            e.preventDefault(); // Prevent navigation
            document.querySelectorAll('.game-grid a').forEach(link => link.classList.remove('selected'));
            targetLink.classList.add('selected');
        } else if (targetLink) {
            e.preventDefault(); // Prevent non-leaders from navigating
        }
    });


    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        console.log('Connected to server!');
        const storedName = localStorage.getItem('playerName');
        socket.emit('register-name', storedName);
    });

    socket.on('registration-successful', (assignedName) => {
        myPlayerName = assignedName;
        if (!localStorage.getItem('playerName')) {
            localStorage.setItem('playerName', assignedName);
        }
        console.log(`Registered with server as: ${myPlayerName}`);
    });

    socket.on('group-state-update', (groupState) => {
        console.log('Group state update:', groupState);
        renderGroupLobby(groupState);
    });

    socket.on('join-error', (error) => {
        alert(`Could not join group: ${error.message}`);
    });
});
