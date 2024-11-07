const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();
const users = new Map();
const DEFAULT_ROOM = 'default'; // Define a default room

io.on('connection', (socket) => {
    console.log('User  connected');

    // Automatically assign users to the default room
    socket.join(DEFAULT_ROOM);
    users.set(socket.id, { nickname: `User ${socket.id.substring(0, 4)}`, roomId: DEFAULT_ROOM }); // Default nickname

    if (!rooms.has(DEFAULT_ROOM)) {
        rooms.set(DEFAULT_ROOM, new Set());
    }
    rooms.get(DEFAULT_ROOM).add(socket.id);

    io.to(DEFAULT_ROOM).emit('userJoined', {
        id: socket.id,
        nickname: users.get(socket.id).nickname
    });

    socket.on('login', (data) => {
        const { nickname, roomId } = data;
        users.set(socket.id, { nickname, roomId });
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);

        io.to(roomId).emit('userJoined', {
            id: socket.id,
            nickname: nickname
        });
    });

    socket.on('chat', (message) => {
        const user = users.get(socket.id);
        if (user) {
            io.to(user.roomId).emit('chat', {
                id: socket.id,
                nickname: user.nickname,
                message: message
            });
        }
    });

    socket.on('move', (position) => {
        const user = users.get(socket.id);
        if (user) {
            io.to(user.roomId).emit('move', {
                id: socket.id,
                position: position
            });
        }
    });

    // Handle nickname change
    socket.on('name', (newNickname) => {
        const user = users.get(socket.id);
        if (user) {
            user.nickname = newNickname; // Update the nickname
            io.to(user.roomId).emit('nameChanged', {
                id: socket.id,
                nickname: newNickname
            });
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            const room = rooms.get(user.roomId);
            if (room) {
                room.delete(socket.id);
                if (room.size === 0) {
                    rooms.delete(user.roomId);
                }
            }
            users.delete(socket.id);
            io.to(user.roomId).emit('userLeft', {
                id: socket.id,
                nickname: user.nickname
            });
        }
    });
});

http.listen(3000, () => {
    console.log('Server running on port 3000');
});
