# Collaborative Whiteboard

A real-time shared canvas where multiple users draw and collaborate at the same time and see each other's changes instantly.

**Stack:** React + Konva.js · Socket.io · Node.js/Express · PostgreSQL (planned) · Jest + React Testing Library

## Getting started

```bash
npm install
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
npm test
```

Open the client in two browser windows to see strokes sync.

## Project layout

```
server/   Express + Socket.io server, in-memory board store
client/   Vite + React + react-konva frontend
```

## Roadmap (v1)

- [x] Project scaffold, socket connection, join snapshot
- [x] Freehand pen + eraser + color picker
- [x] Live stroke streaming (points batched every 40ms)
- [ ] Sticky notes (add, edit, move)
- [x] Live cursors (throttled to 50ms)
- [ ] Conflict resolution for concurrent edits/moves
- [ ] PostgreSQL persistence for board state
- [ ] Stretch: Redis adapter for multi-instance scaling

**Out of scope:** layers/vector shapes, undo/redo, auth/permissions, mobile, Figma-level features.
