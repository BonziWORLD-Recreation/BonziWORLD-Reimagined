const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();
const users = new Map();

io.on('connection', (socket) => {
    console.log('User connected');

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
            io.to(user.roomId).emit('userLeft', socket.id);
        }
    });
});

http.listen(3000, () => {
    console.log('Server running on port 3000');
});