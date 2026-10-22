import { WebRTCMessage } from '../game/types';

export type ConnectionState =
  | 'disconnected'
  | 'creating_room'
  | 'waiting_for_peer'
  | 'connecting'
  | 'connected_p2p'
  | 'connected_relay'
  | 'reconnecting'
  | 'error';

export interface NetworkStats {
  mode: 'p2p' | 'relay' | 'none';
  latencyMs: number;
  packetsSent: number;
  packetsReceived: number;
  lastPingTime: number;
}

export type MessageHandler = (message: WebRTCMessage) => void;
export type StatusHandler = (status: ConnectionState, message?: string) => void;

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private pingInterval: any = null;

  public roomCode: string = '';
  public myPeerId: string = '';
  public remotePeerId: string = '';
  public isHost: boolean = false;
  public status: ConnectionState = 'disconnected';
  public stats: NetworkStats = {
    mode: 'none',
    latencyMs: 0,
    packetsSent: 0,
    packetsReceived: 0,
    lastPingTime: 0,
  };

  private onMessageCallback: MessageHandler | null = null;
  private onStatusCallback: StatusHandler | null = null;
  private lastSignalTimestamp: number = 0;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor() {}

  public onMessage(callback: MessageHandler) {
    this.onMessageCallback = callback;
  }

  public onStatus(callback: StatusHandler) {
    this.onStatusCallback = callback;
  }

  private updateStatus(status: ConnectionState, msg?: string) {
    this.status = status;
    if (this.onStatusCallback) {
      this.onStatusCallback(status, msg);
    }
  }

  /**
   * HOST: Create room on server and prepare WebRTC PeerConnection
   */
  public async createRoom(
    hostName: string,
    teamMode: 'same_team' | 'opposite_teams',
    botDifficulty: 'easy' | 'normal' | 'hard'
  ): Promise<{ roomCode: string; hostId: string }> {
    this.isHost = true;
    this.updateStatus('creating_room', 'Creating online room...');

    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName, teamMode, botDifficulty }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create room');
    }

    this.roomCode = data.roomCode;
    this.myPeerId = data.hostId;
    this.updateStatus('waiting_for_peer', `Room ${this.roomCode} ready. Waiting for Player 2...`);

    // Connect SSE listener to receive guest join & signals
    this.startSignalListener();
    return { roomCode: this.roomCode, hostId: this.myPeerId };
  }

  /**
   * GUEST: Join room with code and initiate WebRTC handshake
   */
  public async joinRoom(
    roomCode: string,
    guestName: string
  ): Promise<{ hostName: string; teamMode: any; botDifficulty: any }> {
    this.isHost = false;
    this.updateStatus('connecting', 'Joining room...');

    const res = await fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, guestName }),
    });

    const data = await res.json();
    if (!data.success) {
      this.updateStatus('error', data.error || 'Could not join room');
      throw new Error(data.error || 'Could not join room');
    }

    this.roomCode = data.roomCode;
    this.myPeerId = data.guestId;
    this.remotePeerId = 'host'; // or host's ID once received

    // Connect SSE listener
    this.startSignalListener();
    this.initPeerConnection();

    return {
      hostName: data.hostName,
      teamMode: data.teamMode,
      botDifficulty: data.botDifficulty,
    };
  }

  /**
   * Initialize RTCPeerConnection and event handlers
   */
  private initPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
    }

    this.pc = new RTCPeerConnection(STUN_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ICE_CANDIDATE',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state === 'connected') {
        this.stats.mode = 'p2p';
        this.updateStatus('connected_p2p', 'Direct P2P WebRTC connected');
        this.startPing();
      } else if (state === 'disconnected' || state === 'failed') {
        // Fallback to live relay mode
        console.warn('[WebRTC] P2P interrupted. Switching to live relay fallback.');
        this.stats.mode = 'relay';
        this.updateStatus('connected_relay', 'Connected via Live Relay');
      }
    };

    if (this.isHost) {
      // Host creates the data channel
      this.dataChannel = this.pc.createDataChannel('shanex-omi-game', {
        ordered: true,
      });
      this.setupDataChannel(this.dataChannel);
    } else {
      // Guest listens for incoming data channel
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log('[WebRTC] DataChannel opened!');
      this.stats.mode = 'p2p';
      this.updateStatus('connected_p2p', 'Direct P2P DataChannel active');
      this.startPing();
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel closed.');
      if (this.status === 'connected_p2p') {
        this.stats.mode = 'relay';
        this.updateStatus('connected_relay', 'DataChannel closed, active via relay');
      }
    };

    channel.onerror = (err) => {
      console.error('[WebRTC] DataChannel error:', err);
    };

    channel.onmessage = (event) => {
      this.stats.packetsReceived++;
      try {
        const msg = JSON.parse(event.data) as WebRTCMessage;
        this.handleIncomingMessage(msg);
      } catch (e) {
        console.error('[WebRTC] Invalid JSON received:', e);
      }
    };
  }

  /**
   * Handle WebRTC internal messages (e.g. latency ping/pong) & forward game actions
   */
  private handleIncomingMessage(msg: WebRTCMessage) {
    if (msg.type === 'PING') {
      this.sendRawMessage({ type: 'PONG', timestamp: msg.timestamp });
      return;
    }
    if (msg.type === 'PONG') {
      const now = Date.now();
      this.stats.latencyMs = Math.max(1, Math.round((now - msg.timestamp) / 2));
      return;
    }

    if (this.onMessageCallback) {
      this.onMessageCallback(msg);
    }
  }

  /**
   * Send message to the other peer:
   * Uses direct WebRTC DataChannel if open, or live server relay fallback.
   */
  public sendMessage(msg: WebRTCMessage) {
    this.sendRawMessage(msg);
  }

  private sendRawMessage(msg: WebRTCMessage) {
    const payloadStr = JSON.stringify(msg);
    this.stats.packetsSent++;

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payloadStr);
    } else if (
      this.roomCode &&
      this.roomCode !== 'SOLO-PRACTICE' &&
      this.remotePeerId &&
      this.remotePeerId !== 'none'
    ) {
      // Fallback via relay
      fetch(`/api/rooms/${this.roomCode}/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.myPeerId,
          to: this.remotePeerId,
          payload: msg,
        }),
      }).catch((e) => console.error('[WebRTC Relay Error]', e));
    }
  }

  /**
   * Send signaling packet (Offer, Answer, ICE Candidate)
   */
  private async sendSignal(data: any) {
    try {
      await fetch(`/api/rooms/${this.roomCode}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.myPeerId,
          to: this.remotePeerId,
          data,
        }),
      });
    } catch (e) {
      console.error('[WebRTC] sendSignal error:', e);
    }
  }

  /**
   * Start listening for signals via SSE and polling backup
   */
  private startSignalListener() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const sseUrl = `/api/rooms/${this.roomCode}/events?peerId=${this.myPeerId}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const item = JSON.parse(event.data);
        if (item.type === 'RELAY_PACKET') {
          this.stats.packetsReceived++;
          this.handleIncomingMessage(item.payload);
        } else if (item.data) {
          this.handleRemoteSignal(item.from, item.data);
        }
      } catch (e) {
        console.error('[WebRTC] SSE error:', e);
      }
    };

    this.eventSource.onerror = () => {
      // If SSE errors, use polling backup
      if (!this.pollInterval) {
        this.startPollingBackup();
      }
    };

    // Also run quick polling for fast ICE discovery
    this.startPollingBackup();
  }

  private startPollingBackup() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      if (!this.roomCode || !this.myPeerId) return;
      try {
        const res = await fetch(
          `/api/rooms/${this.roomCode}/signals?peerId=${this.myPeerId}&since=${this.lastSignalTimestamp}`
        );
        const data = await res.json();
        if (data.success && data.signals && data.signals.length > 0) {
          for (const s of data.signals) {
            this.lastSignalTimestamp = Math.max(this.lastSignalTimestamp, s.timestamp);
            this.handleRemoteSignal(s.from, s.data);
          }
        }
      } catch (e) {}
    }, 1200);
  }

  /**
   * Process incoming signaling messages (Offer, Answer, ICE, PEER_JOINED)
   */
  private async handleRemoteSignal(fromPeerId: string, signal: any) {
    if (!signal) return;
    if (fromPeerId && !this.remotePeerId) {
      this.remotePeerId = fromPeerId;
    }

    if (signal.type === 'PEER_JOINED' && this.isHost) {
      // Guest joined! Host starts the WebRTC handshake
      console.log('[WebRTC] Guest joined! Initializing offer...');
      this.remotePeerId = signal.guestId;
      this.updateStatus('connecting', `Player 2 (${signal.guestName}) joined! Connecting...`);
      this.initPeerConnection();

      // Create Offer
      if (this.pc) {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.sendSignal({
          type: 'SDP_OFFER',
          sdp: offer,
        });
      }
    } else if (signal.type === 'SDP_OFFER' && !this.isHost) {
      // Guest receives Host's offer
      console.log('[WebRTC] Received SDP Offer from Host');
      if (!this.pc) this.initPeerConnection();
      if (this.pc) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Add any queued candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.sendSignal({
          type: 'SDP_ANSWER',
          sdp: answer,
        });
      }
    } else if (signal.type === 'SDP_ANSWER' && this.isHost) {
      // Host receives Guest's answer
      console.log('[WebRTC] Received SDP Answer from Guest');
      if (this.pc && this.pc.signalingState !== 'stable') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }
      }
    } else if (signal.type === 'ICE_CANDIDATE') {
      const candidateInit = signal.candidate;
      if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } else {
        this.pendingCandidates.push(candidateInit);
      }
    }
  }

  /**
   * Periodic latency ping over data channel
   */
  private startPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.status === 'connected_p2p' || this.status === 'connected_relay') {
        this.sendRawMessage({ type: 'PING', timestamp: Date.now() });
      }
    }, 4000);
  }

  /**
   * For manual pairing: export local SDP
   */
  public async exportManualSDP(): Promise<string> {
    if (!this.pc) this.initPeerConnection();
    if (!this.pc) return '';

    if (this.isHost && this.pc.signalingState === 'stable') {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
    }
    return JSON.stringify(this.pc.localDescription);
  }

  /**
   * For manual pairing: import remote SDP
   */
  public async importManualSDP(sdpJson: string): Promise<void> {
    if (!this.pc) this.initPeerConnection();
    if (!this.pc) return;

    const desc = JSON.parse(sdpJson);
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));

    if (desc.type === 'offer' && !this.isHost) {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
    }
  }

  public disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.eventSource) this.eventSource.close();
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {}
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
    }
    this.updateStatus('disconnected', 'Disconnected');
  }
}
