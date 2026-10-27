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

  // Strokes stream while being drawn: start, then batched point updates.
  socket.on('stroke:start', (stroke) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    store.addStroke(boardId, stroke);
    socket.to(boardId).emit('stroke:start', stroke);
  });

  socket.on('stroke:points', ({ id, points }) => {
    const { boardId } = socket.data;
    if (!boardId || !store.appendPoints(boardId, id, points)) return;
    socket.to(boardId).emit('stroke:points', { id, points });
  });

  // Cursors are ephemeral: relayed to the room, never stored.
  socket.on('cursor:move', ({ x, y, name, color }) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    socket.to(boardId).emit('cursor:move', { id: socket.id, x, y, name, color });
  });

  // Sticky notes. Writes are acknowledged so the client can roll back
  // when the server rejects them; see BoardStore for the conflict rules.
  const reply = (ack, result) => typeof ack === 'function' && ack(result);

  socket.on('note:add', (note, ack) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    const created = store.addNote(boardId, note);
    io.to(boardId).emit('note:upsert', created);
    reply(ack, { ok: true, note: created });
  });

  socket.on('note:lock', ({ id, name, color }, ack) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    const res = store.lockNote(boardId, id, { id: socket.id, name, color });
    if (res.ok) io.to(boardId).emit('note:upsert', res.note);
    reply(ack, res);
  });

  socket.on('note:move', ({ id, x, y }) => {
    const { boardId } = socket.data;
    if (!boardId || !store.canMove(boardId, id, socket.id)) return;
    socket.to(boardId).emit('note:moving', { id, x, y });
  });

  socket.on('note:commit', ({ id, baseVersion, changes }, ack) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    const res = store.commitNote(boardId, id, socket.id, baseVersion, changes);
    // On success or a stale rejection the stored note changed (new version
    // or released lock), so everyone gets the authoritative copy.
    if (res.ok || res.reason === 'stale') io.to(boardId).emit('note:upsert', res.note);
    reply(ack, res);
  });

  socket.on('note:unlock', ({ id }) => {
    const { boardId } = socket.data;
    if (!boardId) return;
    const note = store.unlockNote(boardId, id, socket.id);
    if (note) io.to(boardId).emit('note:upsert', note);
  });

  socket.on('disconnect', () => {
    const { boardId } = socket.data;
    if (!boardId) return;
    socket.to(boardId).emit('cursor:leave', socket.id);
    for (const note of store.releaseLocks(boardId, socket.id)) {
      socket.to(boardId).emit('note:upsert', note);
    }
  });
});

server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
