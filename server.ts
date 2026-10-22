import http from 'http';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SignalItem {
  id: string;
  from: string;
  to: string;
  data: any;
  timestamp: number;
}

interface RoomData {
  code: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  teamMode: 'same_team' | 'opposite_teams';
  botDifficulty: 'easy' | 'normal' | 'hard';
  createdAt: number;
  lastActive: number;
  signals: SignalItem[];
  sseClients: Map<string, Response>;
}

const rooms = new Map<string, RoomData>();

// Clean up stale rooms older than 3 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActive > 3 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OMI-';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '2mb' }));

  // --- WebRTC Signaling & Room API ---

  // Create Room
  app.post('/api/rooms/create', (req: Request, res: Response) => {
    const { hostName, teamMode = 'same_team', botDifficulty = 'normal' } = req.body;
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const hostId = 'host_' + Math.random().toString(36).substring(2, 9);
    const room: RoomData = {
      code,
      hostId,
      hostName: (hostName || 'Player 1').trim().slice(0, 20),
      teamMode,
      botDifficulty,
      createdAt: Date.now(),
      lastActive: Date.now(),
      signals: [],
      sseClients: new Map(),
    };

    rooms.set(code, room);
    res.json({
      success: true,
      roomCode: code,
      hostId,
      teamMode,
      botDifficulty,
    });
  });

  // Join Room
  app.post('/api/rooms/join', (req: Request, res: Response) => {
    const { roomCode, guestName } = req.body;
    if (!roomCode) {
      return res.status(400).json({ success: false, error: 'Room code is required' });
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found. Check the code.' });
    }

    const guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
    room.guestId = guestId;
    room.guestName = (guestName || 'Player 2').trim().slice(0, 20);
    room.lastActive = Date.now();

    // Notify host via signal queue
    const joinSignal: SignalItem = {
      id: Math.random().toString(36).substring(2, 9),
      from: guestId,
      to: room.hostId,
      data: {
        type: 'PEER_JOINED',
        guestId,
        guestName: room.guestName,
      },
      timestamp: Date.now(),
    };
    room.signals.push(joinSignal);

    // Push to host's SSE if connected
    const hostSse = room.sseClients.get(room.hostId);
    if (hostSse) {
      hostSse.write(`data: ${JSON.stringify(joinSignal)}\n\n`);
    }

    res.json({
      success: true,
      roomCode: room.code,
      guestId,
      hostName: room.hostName,
      teamMode: room.teamMode,
      botDifficulty: room.botDifficulty,
    });
  });

  // Get Room Info
  app.get('/api/rooms/:code/info', (req: Request, res: Response) => {
    const code = req.params.code.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({
      success: true,
      code: room.code,
      hostName: room.hostName,
      hasGuest: !!room.guestId,
      guestName: room.guestName,
      teamMode: room.teamMode,
      botDifficulty: room.botDifficulty,
    });
  });

  // Send Signal (SDP Offer, SDP Answer, ICE Candidate)
  app.post('/api/rooms/:code/signal', (req: Request, res: Response) => {
    const code = req.params.code.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const { from, to, data } = req.body;
    if (!from || !data) {
      return res.status(400).json({ success: false, error: 'Missing signaling data' });
    }

    room.lastActive = Date.now();
    const signal: SignalItem = {
      id: Math.random().toString(36).substring(2, 9),
      from,
      to: to || (from === room.hostId ? room.guestId || '' : room.hostId),
      data,
      timestamp: Date.now(),
    };

    room.signals.push(signal);
    // Keep last 100 signals
    if (room.signals.length > 100) {
      room.signals.splice(0, room.signals.length - 100);
    }

    // Direct SSE push to recipient
    const recipientSse = room.sseClients.get(signal.to);
    if (recipientSse) {
      recipientSse.write(`data: ${JSON.stringify(signal)}\n\n`);
    }

    res.json({ success: true, signalId: signal.id });
  });

  // Poll Signals (fallback for SSE or initial fetch)
  app.get('/api/rooms/:code/signals', (req: Request, res: Response) => {
    const code = req.params.code.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const peerId = (req.query.peerId as string) || '';
    const since = parseInt((req.query.since as string) || '0', 10);

    const pending = room.signals.filter(
      (s) => (s.to === peerId || s.to === '*' || !s.to) && s.timestamp > since && s.from !== peerId
    );

    res.json({
      success: true,
      signals: pending,
      now: Date.now(),
    });
  });

  // Server-Sent Events (SSE) for instant zero-latency signaling
  app.get('/api/rooms/:code/events', (req: Request, res: Response) => {
    const code = req.params.code.trim().toUpperCase();
    const peerId = req.query.peerId as string;
    const room = rooms.get(code);

    if (!room || !peerId) {
      return res.status(404).end('Room or peerId not found');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    room.sseClients.set(peerId, res);

    // Send connected confirmation
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', peerId })}\n\n`);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      if (room.sseClients.get(peerId) === res) {
        room.sseClients.delete(peerId);
      }
    });
  });

  // Fallback data relay if direct WebRTC DataChannel is blocked by symmetric NAT
  app.post('/api/rooms/:code/relay', (req: Request, res: Response) => {
    const code = req.params.code.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const { from, to, payload } = req.body;
    room.lastActive = Date.now();
    const recipientSse = room.sseClients.get(to);
    if (recipientSse) {
      recipientSse.write(
        `data: ${JSON.stringify({ type: 'RELAY_PACKET', from, payload, timestamp: Date.now() })}\n\n`
      );
    }
    res.json({ success: true });
  });

  // Vite middleware in dev or static files in production
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[SHANEX OMI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
