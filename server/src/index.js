const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { BoardStore } = require('./boardState');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });
const store = new BoardStore();

io.on('connection', (socket) => {
  socket.on('board:join', (boardId) => {
    socket.join(boardId);
    socket.data.boardId = boardId;
    // Late joiners get the current board, not just future updates.
    socket.emit('board:snapshot', store.snapshot(boardId));
  });

  socket.on('stroke:add', (stroke) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    store.addStroke(boardId, stroke);
    socket.to(boardId).emit('stroke:add', stroke);
  });

  // Cursors are ephemeral: relayed to the room, never stored.
  socket.on('cursor:move', ({ x, y, name, color }) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    socket.to(boardId).emit('cursor:move', { id: socket.id, x, y, name, color });
  });

  socket.on('disconnect', () => {
    const { boardId } = socket.data;
    if (boardId) socket.to(boardId).emit('cursor:leave', socket.id);
  });

  // TODO: note:add / note:update, conflict resolution
});

server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
