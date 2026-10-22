/**
 * Shared Cloudflare Pages Functions and Workers room/signaling API.
 * Route: /api/rooms/*  (this file is a multipath route)
 *
 * Cloudflare edge runtimes cannot run the Node/Express server.ts. D1 provides
 * cross-request persistence for rooms, WebRTC signaling, and relay packets.
 */
type Scalar = string | number | null;
type Statement = {
  bind(...values: Scalar[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
};
type Database = { prepare(sql: string): Statement };
type PagesContext = { request: Request; env: { ROOMS_DB?: Database } };

type Room = {
  code: string;
  host_id: string;
  host_name: string;
  guest_id: string | null;
  guest_name: string | null;
  team_mode: 'same_team' | 'opposite_teams';
  bot_difficulty: 'easy' | 'normal' | 'hard';
  created_at: number;
  last_active: number;
};
type MessageRow = {
  id: number;
  room_code: string;
  from_peer: string;
  to_peer: string;
  kind: string;
  payload: string;
  created_at: number;
};

const CODE_RE = /^OMI-[A-HJ-NP-Z2-9]{4}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

function json(value: object, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
function fail(status: number, error: string): Response {
  return json({ success: false, error }, status);
}
function name(value: unknown, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, 20) : '';
  return trimmed || fallback;
}
function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'OMI-' + Array.from(bytes, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}
function randomPeerId(prefix: 'host' | 'guest'): string {
  return prefix + '_' + crypto.randomUUID();
}
function normalizedCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const result = await request.json();
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
async function getRoom(db: Database, code: string): Promise<Room | null> {
  return db.prepare('SELECT * FROM omi_rooms WHERE code = ?').bind(code).first<Room>();
}
function destination(room: Room, from: string): string | null {
  if (from === room.host_id) return room.guest_id;
  if (from === room.guest_id) return room.host_id;
  return null;
}
function isValidPeer(room: Room, peer: string): boolean {
  return peer === room.host_id || peer === room.guest_id;
}
async function appendMessage(
  db: Database, room: Room, from: string, to: string, kind: 'signal' | 'relay', payload: unknown,
): Promise<void> {
  await db.prepare(
    'INSERT INTO omi_messages (room_code, from_peer, to_peer, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(room.code, from, to, kind, JSON.stringify(payload), Date.now()).run();
  await db.prepare('UPDATE omi_rooms SET last_active = ? WHERE code = ?')
    .bind(Date.now(), room.code).run();
}

// One initialization promise per isolate. IF NOT EXISTS makes it safe across
// separate Cloudflare isolates and allows no-manual-SQL first deployment.
let schemaReady: Promise<void> | null = null;
async function ensureSchema(db: Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS omi_rooms (
        code TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        guest_id TEXT,
        guest_name TEXT,
        team_mode TEXT NOT NULL,
        bot_difficulty TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_active INTEGER NOT NULL
      )`).run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS omi_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT NOT NULL,
        from_peer TEXT NOT NULL,
        to_peer TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (room_code) REFERENCES omi_rooms(code) ON DELETE CASCADE
      )`).run();
      await db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_omi_messages_recipient ON omi_messages (room_code, to_peer, id)'
      ).run();
      await db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_omi_rooms_last_active ON omi_rooms (last_active)'
      ).run();
    })().catch(error => {
      schemaReady = null; // retry after transient D1 failure
      throw error;
    });
  }
  await schemaReady;
}

export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  const db = env.ROOMS_DB;
  if (!db) {
    return fail(503, 'ROOMS_DB binding is missing. Configure the Cloudflare Worker or Pages D1 binding and redeploy.');
  }

  const url = new URL(request.url);
  const parts = url.pathname.slice('/api/rooms/'.length).split('/').filter(Boolean);
  const method = request.method.toUpperCase();

  try {
    await ensureSchema(db);

    if (method === 'GET' && parts.length === 1 && parts[0] === 'health') {
      return json({ success: true, service: 'shanex-omi-rooms', storage: 'D1' });
    }

    if (method === 'POST' && parts.length === 1 && parts[0] === 'create') {
      const input = await body(request);
      if (!input) return fail(400, 'Invalid JSON body');

      const teamMode = input.teamMode === 'opposite_teams' ? 'opposite_teams' : 'same_team';
      const difficulty = input.botDifficulty === 'easy' || input.botDifficulty === 'hard'
        ? input.botDifficulty : 'normal';
      const hostName = name(input.hostName, 'Player 1');
      const hostId = randomPeerId('host');
      const now = Date.now();

      // This also deletes a room's messages via ON DELETE CASCADE.
      await db.prepare('DELETE FROM omi_rooms WHERE last_active < ?').bind(now - MAX_AGE_MS).run();
      for (let i = 0; i < 8; i++) {
        const code = randomCode();
        const created = await db.prepare(
          'INSERT OR IGNORE INTO omi_rooms (code, host_id, host_name, guest_id, guest_name, team_mode, bot_difficulty, created_at, last_active) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)'
        ).bind(code, hostId, hostName, teamMode, difficulty, now, now).run();
        if ((created.meta?.changes ?? 0) > 0) {
          return json({ success: true, roomCode: code, hostId, teamMode, botDifficulty: difficulty });
        }
      }
      return fail(503, 'Could not allocate a unique room code. Please retry.');
    }

    if (method === 'POST' && parts.length === 1 && parts[0] === 'join') {
      const input = await body(request);
      if (!input) return fail(400, 'Invalid JSON body');
      const code = normalizedCode(input.roomCode);
      if (!CODE_RE.test(code)) return fail(400, 'Invalid room code');

      const room = await getRoom(db, code);
      if (!room || room.last_active < Date.now() - MAX_AGE_MS) {
        return fail(404, 'Room not found or expired. Check the code.');
      }
      if (room.guest_id) return fail(409, 'This room already has two players.');

      const guestId = randomPeerId('guest');
      const guestName = name(input.guestName, 'Player 2');
      const joined = await db.prepare(
        'UPDATE omi_rooms SET guest_id = ?, guest_name = ?, last_active = ? WHERE code = ? AND guest_id IS NULL'
      ).bind(guestId, guestName, Date.now(), code).run();
      if ((joined.meta?.changes ?? 0) === 0) return fail(409, 'This room already has two players.');

      await appendMessage(db, room, guestId, room.host_id, 'signal',
        { type: 'PEER_JOINED', guestId, guestName });

      return json({
        success: true, roomCode: room.code, guestId, hostId: room.host_id,
        hostName: room.host_name, teamMode: room.team_mode, botDifficulty: room.bot_difficulty,
      });
    }

    if (parts.length !== 2) return fail(404, 'Unknown room API endpoint');
    const [codeValue, action] = parts;
    const code = normalizedCode(codeValue);
    if (!CODE_RE.test(code)) return fail(400, 'Invalid room code');
    const room = await getRoom(db, code);
    if (!room || room.last_active < Date.now() - MAX_AGE_MS) {
      return fail(404, 'Room not found or expired');
    }

    if (method === 'GET' && action === 'info') {
      return json({
        success: true, code: room.code, hostName: room.host_name,
        hasGuest: !!room.guest_id, guestName: room.guest_name,
        teamMode: room.team_mode, botDifficulty: room.bot_difficulty,
      });
    }

    if (method === 'GET' && action === 'events') {
      // The Express SSE client Map cannot work across stateless Pages Function requests.
      // HTTP 204 tells EventSource to stop retrying; client polls /signals.
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    if (method === 'GET' && action === 'signals') {
      const peerId = url.searchParams.get('peerId') || '';
      if (!isValidPeer(room, peerId)) return fail(403, 'Unknown peerId');
      const rawSeq = Number(url.searchParams.get('sinceSeq') || 0);
      const sinceSeq = Number.isSafeInteger(rawSeq) && rawSeq >= 0 ? rawSeq : 0;
      const rows = await db.prepare(
        'SELECT * FROM omi_messages WHERE room_code = ? AND to_peer = ? AND id > ? ORDER BY id ASC LIMIT 100'
      ).bind(code, peerId, sinceSeq).all<MessageRow>();
      const signals = rows.results.map(row => ({
        id: String(row.id),
        seq: row.id,
        from: row.from_peer,
        to: row.to_peer,
        timestamp: row.created_at,
        data: row.kind === 'relay'
          ? { type: 'RELAY_PACKET', payload: JSON.parse(row.payload) }
          : JSON.parse(row.payload),
      }));
      return json({ success: true, signals, now: Date.now() });
    }

    if (method === 'POST' && (action === 'signal' || action === 'relay')) {
      const input = await body(request);
      if (!input) return fail(400, 'Invalid JSON body');
      const from = typeof input.from === 'string' ? input.from : '';
      const expectedTo = destination(room, from);
      if (!expectedTo) return fail(403, 'Sender is not a participant, or the guest has not joined');
      const to = typeof input.to === 'string' && input.to ? input.to : expectedTo;
      if (to !== expectedTo) return fail(400, 'Invalid signal destination');

      const packet = action === 'signal' ? input.data : input.payload;
      if (!packet || typeof packet !== 'object') return fail(400, 'Missing signal/relay payload');
      if (JSON.stringify(packet).length > 32_000) return fail(413, 'Packet too large');

      await appendMessage(db, room, from, to, action, packet);
      return json({ success: true });
    }

    return fail(405, 'Unsupported method');
  } catch (err) {
    console.error('[SHANEX OMI Edge API]', err);
    return fail(503, 'Room service unavailable. Check the ROOMS_DB binding and Cloudflare Worker/Function logs.');
  }
}
