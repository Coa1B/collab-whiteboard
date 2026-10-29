# Collaborative Whiteboard

A real-time shared canvas where multiple users draw and collaborate at the same time and see each other's changes instantly.

**Stack:** React + Konva.js · Socket.io · Node.js/Express · PostgreSQL · Docker · Jest + React Testing Library

## Getting started

Requires Node.js 22+ and Docker.

```bash
npm install
cp server/.env.example server/.env
npm run db:up   # start PostgreSQL in Docker
npm run dev     # server on :4000 and client on :5173 together
```

Open the client in two browser windows to see changes sync. Boards are saved to PostgreSQL and survive server restarts.

To run without a database, leave `DATABASE_URL` out of `server/.env`; boards are then kept in memory only.

### Tests

```bash
npm test                      # unit and component tests
npm run test:db -w server     # PostgreSQL integration tests (needs npm run db:up)
```

## Project layout

```
server/   Express + Socket.io server, board store, PostgreSQL persistence
client/   Vite + React + react-konva frontend
```

## Roadmap (v1)

- [x] Project scaffold, socket connection, join snapshot
- [x] Freehand pen + eraser + color picker
- [x] Live stroke streaming (points batched every 40ms)
- [x] Sticky notes (add, edit, move)
- [x] Live cursors (throttled to 50ms)
- [x] Conflict resolution for concurrent edits/moves (locks + versioning)
- [x] PostgreSQL persistence for board state
- [ ] Stretch: Redis adapter for multi-instance scaling

## Conflict resolution

Sticky notes use two layers of protection against concurrent edits:

1. **Locks for in-progress interactions.** Dragging or editing a note first acquires a lock on the server. Other users see the note outlined with the editor's name and cannot grab it until the lock is released (on drop, save, cancel, or disconnect).
2. **Optimistic concurrency for commits.** Each commit includes the version it was based on. If the note changed since then (for example, the client had not yet received another user's commit), the server rejects the commit and the client rolls back to the authoritative state instead of silently overwriting someone else's work.

Drag positions are streamed to other users while dragging but are only stored once the move is committed.

## Persistence

The in-memory board store stays the live source of truth, so real-time sync never waits on the database. Changes are written to PostgreSQL in the background:

- **Strokes** are saved once when finished, not on every batch of points. Strokes left unfinished by a disconnect are saved too.
- **Notes** are saved when created and on every accepted commit. Saves use an upsert guarded by `WHERE notes.version < EXCLUDED.version`, so a delayed older write can never overwrite a newer one.
- **Boards** are loaded from the database the first time someone opens them after a restart. Concurrent joins share one load.

Locks and cursors are never stored; they only make sense while users are connected.

**Out of scope:** layers/vector shapes, undo/redo, auth/permissions, mobile, Figma-level features.
