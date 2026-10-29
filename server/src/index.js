const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { BoardStore } = require('./boardState');
const { createPersistence } = require('./db/persistence');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });
const store = new BoardStore();
const db = createPersistence(process.env.DATABASE_URL);

// Background writes must never take down the real-time path.
const persist = (promise, what) =>
  promise.catch((err) => console.error(`Failed to save ${what}:`, err.message));

// Loads each board from the database at most once, even if several users
// join while the first load is still in flight.
const loading = new Map();
function ensureBoardLoaded(boardId) {
  if (store.has(boardId)) return Promise.resolve();
  if (!loading.has(boardId)) {
    const load = db
      .loadBoard(boardId)
      .then((saved) => {
        if (saved && !store.has(boardId)) store.hydrate(boardId, saved);
      })
      .finally(() => loading.delete(boardId));
    loading.set(boardId, load);
  }
  return loading.get(boardId);
}

io.on('connection', (socket) => {
  // Strokes this socket has started but not finished, saved if it drops.
  socket.data.openStrokes = new Set();

  socket.on('board:join', async (boardId) => {
    try {
      await ensureBoardLoaded(boardId);
    } catch (err) {
      console.error(`Failed to load board ${boardId}:`, err.message);
      socket.emit('board:error', 'Could not load board');
      return;
    }
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
    socket.data.openStrokes.add(stroke.id);
    socket.to(boardId).emit('stroke:start', stroke);
  });

  socket.on('stroke:points', ({ id, points }) => {
    const { boardId } = socket.data;
    if (!boardId || !store.appendPoints(boardId, id, points)) return;
    socket.to(boardId).emit('stroke:points', { id, points });
  });

  // Strokes are written once, when finished, rather than on every batch.
  const saveStroke = (boardId, strokeId) => {
    socket.data.openStrokes.delete(strokeId);
    const stroke = store.findStroke(boardId, strokeId);
    if (stroke) persist(db.saveStroke(boardId, stroke), `stroke ${strokeId}`);
  };

  socket.on('stroke:end', ({ id }) => {
    const { boardId } = socket.data;
    if (boardId) saveStroke(boardId, id);
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
    persist(db.saveNote(boardId, created), `note ${created.id}`);
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
    if (res.ok) persist(db.saveNote(boardId, res.note), `note ${id}`);
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
    for (const strokeId of socket.data.openStrokes) saveStroke(boardId, strokeId);
    socket.to(boardId).emit('cursor:leave', socket.id);
    for (const note of store.releaseLocks(boardId, socket.id)) {
      socket.to(boardId).emit('note:upsert', note);
    }
  });
});

db.init()
  .then(() => {
    server.listen(PORT, () => {
      const storage = process.env.DATABASE_URL ? 'PostgreSQL' : 'in-memory only';
      console.log(`Server listening on :${PORT} (storage: ${storage})`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to the database:', err.message || err.code);
    console.error('Start it with `npm run db:up`, or unset DATABASE_URL to run in memory.');
    process.exit(1);
  });
