CREATE TABLE IF NOT EXISTS strokes (
  id         TEXT PRIMARY KEY,
  board_id   TEXT NOT NULL,
  seq        BIGSERIAL,
  tool       TEXT NOT NULL,
  color      TEXT NOT NULL,
  points     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strokes_board_seq_idx ON strokes (board_id, seq);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  board_id   TEXT NOT NULL,
  x          DOUBLE PRECISION NOT NULL,
  y          DOUBLE PRECISION NOT NULL,
  text       TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL,
  version    INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_board_idx ON notes (board_id);
