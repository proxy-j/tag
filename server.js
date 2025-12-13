// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

app.use(express.static('public'));

let players = {};
let taggerId = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Player sets name
    socket.on('setName', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name || 'Anonymous',
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            color: getRandomColor(),
            frozenUntil: 0
        };

        // First player is IT
        if (!taggerId) {
            taggerId = socket.id;
        }

        socket.emit('currentPlayers', { players, taggerId });
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Movement
    socket.on('move', (movement) => {
        const player = players[socket.id];
        if (!player) return;

        // Frozen check
        if (Date.now() < player.frozenUntil) return;

        player.x += movement.x;
        player.y += movement.y;

        // Borders
        player.x = Math.max(15, Math.min(player.x, GAME_WIDTH - 15));
        player.y = Math.max(15, Math.min(player.y, GAME_HEIGHT - 15));

        io.emit('playerMoved', {
            id: socket.id,
            x: player.x,
            y: player.y
        });

        // Tag logic
        if (socket.id === taggerId) {
            for (let id in players) {
                if (id !== socket.id && isColliding(player, players[id])) {
                    taggerId = id;
                    players[taggerId].frozenUntil = Date.now() + 3000; // 3 sec freeze
                    io.emit('taggerChanged', taggerId);
                    break;
                }
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];

        // If IT leaves, pick new IT
        if (socket.id === taggerId) {
            taggerId = Object.keys(players)[0] || null;
            if (taggerId && players[taggerId]) {
                players[taggerId].frozenUntil = Date.now() + 3000;
            }
            io.emit('taggerChanged', taggerId);
        }

        io.emit('playerDisconnected', socket.id);
    });
});

// Collision check
function isColliding(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < 30;
}

// Random color
function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

// Start server
http.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
