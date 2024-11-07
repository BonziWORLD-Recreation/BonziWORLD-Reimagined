const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();
const users = new Map();
const DEFAULT_ROOM = '';
const MAX_NAME_LENGTH = 35;
const MAX_MESSAGE_LENGTH = 400;

// Handle commands
function handleCommand(socket, message) {
    const args = message.slice(1).split(' '); // Remove "/" and split by space
    const command = args[0].toLowerCase();
    const user = users.get(socket.id);
    
    if (!user) return false;

    switch (command) {
        case 'name':
    const newNickname = args.slice(1).join(' ').trim().substring(0, MAX_NAME_LENGTH);
    if (newNickname) {
        const oldNickname = user.nickname;
        user.nickname = newNickname;
        io.to(user.roomId).emit('nameChanged', {
            id: socket.id,
            oldNickname: oldNickname,
            newNickname: newNickname
        });
        // Send system message about name change
        io.to(user.roomId).emit('chat', {
            id: 'system',
            nickname: 'System',
            message: `${oldNickname} changed their name to ${newNickname}`
        });
    }
    return true;

        case 'help':
            // Send available commands to the user
            socket.emit('chat', {
                id: 'system',
                nickname: 'System',
                message: 'Available commands:\n' +
                        '/name <new name> - Change your nickname\n' +
                        '/help - Show this help message\n' +
                        '/users - Show users in current room'
            });
            return true;

        case 'users':
            // Get all users in the current room
            const roomUsers = Array.from(rooms.get(user.roomId) || [])
                .map(id => users.get(id))
                .filter(Boolean)
                .map(u => u.nickname)
                .join(', ');
            
            socket.emit('chat', {
                id: 'system',
                nickname: 'System',
                message: `Users in room: ${roomUsers}`
            });
            return true;

        default:
            socket.emit('chat', {
                id: 'system',
                nickname: 'System',
                message: 'Unknown command. Type /help for available commands.'
            });
            return true;
    }
}

io.on('connection', (socket) => {
    console.log('User connected');

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
        const targetRoom = roomId || DEFAULT_ROOM;
        const limitedNickname = nickname.substring(0, MAX_NAME_LENGTH);
        
        // Leave current room
        const currentUser = users.get(socket.id);
        if (currentUser) {
            const currentRoom = rooms.get(currentUser.roomId);
            if (currentRoom) {
                currentRoom.delete(socket.id);
                if (currentRoom.size === 0) {
                    rooms.delete(currentUser.roomId);
                }
            }
            socket.leave(currentUser.roomId);
        }

        // Join new room
        users.set(socket.id, { nickname: limitedNickname, roomId: targetRoom });
        socket.join(targetRoom);

        if (!rooms.has(targetRoom)) {
            rooms.set(targetRoom, new Set());
        }
        rooms.get(targetRoom).add(socket.id);

        io.to(targetRoom).emit('userJoined', {
            id: socket.id,
            nickname: limitedNickname
        });
    });

    socket.on('chat', (message) => {
        const user = users.get(socket.id);
        if (!user) return;

        // Handle commands
        if (message.startsWith('/')) {
            handleCommand(socket, message);
            return;
        }

        // Regular chat message
        io.to(user.roomId).emit('chat', {
            id: socket.id,
            nickname: user.nickname,
            message: message
        });
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
