-- Cloudflare D1 schema for SHANEX OMI room creation and signaling.
-- Run once against the D1 database bound as ROOMS_DB.
CREATE TABLE IF NOT EXISTS omi_rooms (
  code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  guest_id TEXT,
  guest_name TEXT,
  team_mode TEXT NOT NULL,
  bot_difficulty TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS omi_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  from_peer TEXT NOT NULL,
  to_peer TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_code) REFERENCES omi_rooms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_omi_messages_recipient
  ON omi_messages (room_code, to_peer, id);
CREATE INDEX IF NOT EXISTS idx_omi_rooms_last_active
  ON omi_rooms (last_active);
