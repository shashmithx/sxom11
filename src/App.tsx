/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  GamePhase,
  GameState,
  SanitizedGameState,
  Suit,
  TeamMode,
  BotDifficulty,
  WebRTCMessage,
  Trick,
} from './game/types';
import {
  createOmiDeck,
  shuffleDeck,
  canDealerShuffle,
  setupInitialPlayers,
  setupSoloPlayers,
  sanitizeStateForPlayer,
  determineTrickWinner,
  calculateRoundScoring,
  checkMatchWinner,
  getNextPlayerIndex,
  isCardPlayable,
} from './game/rules';
import { botChooseTrumpSuit, botChooseCardToPlay } from './game/ai';
import { WebRTCManager, ConnectionState } from './network/webrtc';
import { OmiTable } from './components/OmiTable';
import { ScoreBoard } from './components/ScoreBoard';
import { Lobby } from './components/Lobby';
import { LastTrickModal, HowToPlayModal, ManualSDPModal, VictoryModal } from './components/Modals';
import { sound } from './utils/sound';
import { translations } from './utils/i18n';
import {
  Volume2,
  VolumeX,
  Languages,
  HelpCircle,
  History,
  RotateCcw,
  Smile,
  Radio,
  Sparkles,
} from 'lucide-react';

const EMOJIS = ['❤️', '👏', '🔥', '😮', '😂', '🇱🇰', '🏆'];

export default function App() {
  const [lang, setLang] = useState<'en' | 'si'>('si');
  const t = translations[lang];

  // Keep accessibility and browser text processing in sync with the UI language.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Networking & Session State
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const [isHost, setIsHost] = useState(true);
  const [mySeatIndex, setMySeatIndex] = useState(0);
  const [playerName, setPlayerName] = useState('Kasun');
  const [teamMode, setTeamMode] = useState<TeamMode>('same_team');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [roomCode, setRoomCode] = useState('');
  const [peerStatus, setPeerStatus] = useState<ConnectionState>('disconnected');
  const [peerStatusMsg, setPeerStatusMsg] = useState('Not connected');
  const [hasPeerJoined, setHasPeerJoined] = useState(false);
  const [peerName, setPeerName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [latency, setLatency] = useState(0);

  // Modals & Drawers
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [showManualSDP, setShowManualSDP] = useState(false);
  const [manualLocalSDP, setManualLocalSDP] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [kapothiNotice, setKapothiNotice] = useState<string | null>(null);
  const [badaNotice, setBadaNotice] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Authoritative Host Game State
  const hostStateRef = useRef<GameState | null>(null);
  // Local Render State (sanitized for this player)
  const [renderState, setRenderState] = useState<SanitizedGameState | null>(null);
  const stateSeqRef = useRef<number>(0);
  // Undealt deck is host-private; neither shuffle inputs nor online snapshots
  // reveal its permutation to any player.
  const shuffledDeckRef = useRef<Card[] | null>(null);
  const shuffleEpochRef = useRef(0);
  const lastGuestSeqRef = useRef(0);
  const guestFramesRef = useRef<{ seq: number; state: SanitizedGameState }[]>([]);
  const guestFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The WebRTC event listener is installed once. Always dispatch through the
  // latest React render: otherwise a guest still uses the initial isHost=true
  // closure and can silently ignore remote gameplay actions.
  const latestRemoteHandlerRef = useRef<(msg: WebRTCMessage) => void>(() => {});

  // Initialize WebRTC Manager on Mount
  useEffect(() => {
    const mgr = new WebRTCManager();
    webrtcRef.current = mgr;

    mgr.onStatus((status, msg) => {
      setPeerStatus(status);
      if (msg) setPeerStatusMsg(msg);
      if (status === 'connected_p2p' || status === 'connected_relay' ||
          (status === 'connecting' && !!mgr.remotePeerId)) {
        setHasPeerJoined(true);
      }
    });

    mgr.onMessage((msg: WebRTCMessage) => {
      latestRemoteHandlerRef.current(msg);
    });

    // Check URL parameters for 1-click room joining (?room=OMI-XXXX) or ?autostart=1
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const autoStartParam = params.get('autostart');

    if (roomParam) {
      setPlayerName('Friend');
      handleJoinRoom(roomParam);
    } else if (autoStartParam === '1') {
      // Auto start solo practice for fast verification
      startSoloPractice();
    }

    // Ping interval to update latency UI
    const pingTimer = setInterval(() => {
      if (webrtcRef.current) {
        setLatency(webrtcRef.current.stats.latencyMs);
      }
    }, 2000);

    return () => {
      clearInterval(pingTimer);
      if (guestFrameTimerRef.current) clearTimeout(guestFrameTimerRef.current);
      guestFramesRef.current = [];
      mgr.disconnect();
    };
  }, []);

  // --- Remote Message Handling ---
  // D1 polling can return multiple STATE_UPDATE packets in one tick. React
  // batches synchronous setState calls, skipping over the bot cards entirely.
  // Present them one snapshot at a time (~300ms each) so every played card is
  // visibly dealt to the table, while preserving the authoritative host order.
  const playNextGuestFrame = () => {
    const next = guestFramesRef.current.shift();
    if (!next) {
      guestFrameTimerRef.current = null;
      return;
    }

    setRenderState(next.state);
    setMySeatIndex(next.state.mySeatIndex);
    if (next.state.phase === 'MATCH_OVER' && sound.enabled) {
      sound.playKapothi();
    }

    guestFrameTimerRef.current = setTimeout(playNextGuestFrame, 300);
  };

  const handleRemoteMessage = (msg: WebRTCMessage) => {
    if (msg.type === 'STATE_UPDATE') {
      if (isHost || msg.seq <= lastGuestSeqRef.current) return;
      lastGuestSeqRef.current = msg.seq;
      // Drop oldest frames only during an unusually large backlog, to keep
      // interactive turns responsive after reconnection.
      if (guestFramesRef.current.length >= 8) {
        guestFramesRef.current.splice(0, guestFramesRef.current.length - 3);
      }
      guestFramesRef.current.push({ seq: msg.seq, state: msg.state });
      if (guestFrameTimerRef.current === null) playNextGuestFrame();
    } else if (msg.type === 'SELECT_TRUMP' && isHost) {
      // Never allow the guest to submit a trump choice for an AI/host seat.
      const state = hostStateRef.current;
      const guestSeat = state?.teamMode === 'same_team' ? 2 : 1;
      if (state && msg.playerId === guestSeat) applyTrumpSelection(msg.suit, msg.playerId);
    } else if (msg.type === 'PLAY_CARD' && isHost) {
      const state = hostStateRef.current;
      const guestSeat = state?.teamMode === 'same_team' ? 2 : 1;
      if (state && msg.playerId === guestSeat) applyCardPlay(msg.playerId, msg.cardId);
    } else if (msg.type === 'SHUFFLE_CARDS' && isHost) {
      const state = hostStateRef.current;
      const guestSeat = state?.teamMode === 'same_team' ? 2 : 1;
      if (state && msg.playerId === guestSeat && state.roundNumber === msg.roundNumber) {
        applyShuffleAction(msg.playerId, msg.action);
      }
    } else if (msg.type === 'EMOJI_REACTION') {
      triggerEmoji(msg.fromSeat, msg.emoji);
    } else if (msg.type === 'REQUEST_REMATCH' && isHost) {
      startNewMatch();
    }
  };
  latestRemoteHandlerRef.current = handleRemoteMessage;

  // Broadcast sanitized state to Guest and update local render state
  const broadcastState = (fullState: GameState) => {
    hostStateRef.current = fullState;
    stateSeqRef.current++;

    // Local Host sanitized state (Seat 0)
    const hostSanitized = sanitizeStateForPlayer(fullState, 0);
    setRenderState(hostSanitized);

    // Guest sanitized state (Seat 2 in Mode A, or Seat 1 in Mode B)
    if (webrtcRef.current) {
      const guestSeat = fullState.teamMode === 'same_team' ? 2 : 1;
      const guestSanitized = sanitizeStateForPlayer(fullState, guestSeat);
      webrtcRef.current.sendMessage({
        type: 'STATE_UPDATE',
        state: guestSanitized,
        seq: stateSeqRef.current,
      });
    }
  };

  // Trigger floating emoji reaction
  const triggerEmoji = (seatIndex: number, emoji: string) => {
    setReactions((prev) => ({ ...prev, [seatIndex]: emoji }));
    setTimeout(() => {
      setReactions((prev) => {
        const next = { ...prev };
        delete next[seatIndex];
        return next;
      });
    }, 2500);
  };

  const handleSendEmoji = (emoji: string) => {
    triggerEmoji(mySeatIndex, emoji);
    if (webrtcRef.current) {
      webrtcRef.current.sendMessage({
        type: 'EMOJI_REACTION',
        emoji,
        fromSeat: mySeatIndex,
      });
    }
    setShowEmojiPicker(false);
  };

  // --- Lobby Actions ---
  const handleCreateRoom = async () => {
    if (!webrtcRef.current) return;
    try {
      const { roomCode } = await webrtcRef.current.createRoom(
        playerName,
        teamMode,
        botDifficulty
      );
      setRoomCode(roomCode);
      setIsHost(true);
      setMySeatIndex(0);
    } catch (e: any) {
      setToastError(e.message || 'Failed to create room');
      setTimeout(() => setToastError(null), 4000);
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!webrtcRef.current) return;
    try {
      const res = await webrtcRef.current.joinRoom(code, playerName);
      setRoomCode(code);
      setIsHost(false);
      setTeamMode(res.teamMode);
      setBotDifficulty(res.botDifficulty);
      setPeerName(res.hostName);
      setMySeatIndex(res.teamMode === 'same_team' ? 2 : 1);
    } catch (e: any) {
      setToastError(e.message || 'Failed to join room');
      setTimeout(() => setToastError(null), 4000);
    }
  };

  // Start solo practice match (Host with 3 bots or solo play)
  const startSoloPractice = () => {
    setIsHost(true);
    setMySeatIndex(0);
    const initialPlayers = setupSoloPlayers(teamMode, playerName);

    const fullState: GameState = {
      roomCode: 'SOLO-PRACTICE',
      teamMode,
      botDifficulty,
      phase: 'SHUFFLING',
      shuffleCount: 0,
      // First round: seat 3 deals, so the human host (seat 0) calls trump.
      // Later rounds rotate the dealer and selector in the normal Omi order.
      dealerIndex: 3,
      trumpSelectorIndex: 0,
      trumpSuit: null,
      activePlayerIndex: 0,
      currentTrick: null,
      lastCompletedTrick: null,
      tricksHistory: [],
      score: {
        team1Tokens: 0,
        team2Tokens: 0,
        carriedTokens: 0,
        team1RoundTricks: 0,
        team2RoundTricks: 0,
        targetTokens: 10,
      },
      players: initialPlayers,
      roundNumber: 1,
      roundSummaries: [],
      winningTeam: null,
      message: 'Dealing first 4 cards...',
      messageSi: 'මුල් කාඩ්පත් 4 බෙදමින්...',
    };

    beginShuffle(fullState);
  };

  // Host starts the OMI match with connected Human Player 2
  const handleStartGame = () => {
    if (!isHost || !hasPeerJoined || !webrtcRef.current?.remotePeerId) {
      setToastError(lang === 'si'
        ? 'Player 2 සම්බන්ධ වූ පසුව තරගය පටන්ගන්න. තනිව ක්‍රීඩා කිරීමට Solo තෝරන්න.'
        : 'Wait for Player 2 to join, or choose Solo practice.');
      setTimeout(() => setToastError(null), 4500);
      return;
    }
    const initialPlayers = setupInitialPlayers(
      teamMode,
      playerName,
      peerName || 'Player 2'
    );

    const fullState: GameState = {
      roomCode,
      teamMode,
      botDifficulty,
      phase: 'SHUFFLING',
      shuffleCount: 0,
      // The host chooses trump from their first four cards in the opening round.
      dealerIndex: 3,
      trumpSelectorIndex: 0,
      trumpSuit: null,
      activePlayerIndex: 0,
      currentTrick: null,
      lastCompletedTrick: null,
      tricksHistory: [],
      score: {
        team1Tokens: 0,
        team2Tokens: 0,
        carriedTokens: 0,
        team1RoundTricks: 0,
        team2RoundTricks: 0,
        targetTokens: 10,
      },
      players: initialPlayers,
      roundNumber: 1,
      roundSummaries: [],
      winningTeam: null,
      message: 'Dealing first 4 cards...',
      messageSi: 'මුල් කාඩ්පත් 4 බෙදමින්...',
    };

    beginShuffle(fullState);
  };

  // --- Authoritative Game Loop ---

  // Start every hand with an actual dealer shuffle. Dealer rotates once per
  // round. Bot dealers auto-shuffle; a human dealer decides when to shuffle and
  // when the dealer is ready to deal. Only the host changes the real deck.
  const beginShuffle = (state: GameState) => {
    const epoch = ++shuffleEpochRef.current;
    shuffledDeckRef.current = createOmiDeck();
    state.phase = 'SHUFFLING';
    state.shuffleCount = 0;
    state.activePlayerIndex = state.dealerIndex;
    state.message = `${state.players[state.dealerIndex].name} is shuffling the deck...`;
    state.messageSi = `${state.players[state.dealerIndex].name} කොළ අනමින් සිටී...`;
    broadcastState(state);

    const dealer = state.players[state.dealerIndex];
    if (!dealer.isHuman) {
      // Two visible riffle passes. The epoch + phase checks ensure an old bot
      // timer can never shuffle or deal a new round/rematch accidentally.
      [850, 1780].forEach(delay => {
        setTimeout(() => {
          const current = hostStateRef.current;
          if (epoch !== shuffleEpochRef.current || !current ||
              current.phase !== 'SHUFFLING' || current.roundNumber !== state.roundNumber) return;
          applyShuffleAction(dealer.id, 'shuffle');
        }, delay);
      });
      setTimeout(() => {
        const current = hostStateRef.current;
        if (epoch !== shuffleEpochRef.current || !current ||
            current.phase !== 'SHUFFLING' || current.roundNumber !== state.roundNumber) return;
        applyShuffleAction(dealer.id, 'deal');
      }, 2800);
    }
  };

  const applyShuffleAction = (playerId: number, action: 'shuffle' | 'deal') => {
    if (!isHost || !hostStateRef.current) return;
    const state = hostStateRef.current;
    if (!canDealerShuffle(state, playerId, action) || !shuffledDeckRef.current) return;

    if (action === 'shuffle') {
      // The caller controls WHEN the shuffle occurs. Fisher-Yates on the host
      // controls the secret permutation; arbitrary client-submitted decks are
      // never trusted, even in a peer-to-peer session.
      shuffledDeckRef.current = shuffleDeck(shuffledDeckRef.current);
      const updated = { ...state, shuffleCount: (state.shuffleCount ?? 0) + 1 };
      updated.message = `${updated.players[playerId].name} is shuffling... (${updated.shuffleCount})`;
      updated.messageSi = `${updated.players[playerId].name} කොළ අනනවා... (${updated.shuffleCount})`;
      broadcastState(updated);
      return;
    }

    if ((state.shuffleCount ?? 0) < 1) return;
    const epoch = shuffleEpochRef.current;
    const dealing = { ...state, phase: 'DEALING_1' as const };
    dealing.message = 'Dealing the first four cards...';
    dealing.messageSi = 'පළමු කොළ හතර බෙදමින්...';
    broadcastState(dealing);
    setTimeout(() => {
      if (epoch !== shuffleEpochRef.current || hostStateRef.current !== dealing ||
          hostStateRef.current.phase !== 'DEALING_1') return;
      dealFirstPhase(dealing);
    }, 850);
  };

  // Phase 1: Deal first 4 cards to each player
  const dealFirstPhase = (state: GameState) => {
    sound.playDeal();
    const deck = shuffledDeckRef.current || shuffleDeck(createOmiDeck());
    shuffledDeckRef.current = null;

    // 4 cards each
    const p0 = deck.slice(0, 4);
    const p1 = deck.slice(4, 8);
    const p2 = deck.slice(8, 12);
    const p3 = deck.slice(12, 16);
    const remainingDeck = deck.slice(16, 32);

    (state as any).remainingDeck = remainingDeck;
    state.players[0].hand = p0;
    state.players[1].hand = p1;
    state.players[2].hand = p2;
    state.players[3].hand = p3;

    state.phase = 'SELECTING_TRUMP';
    state.activePlayerIndex = state.trumpSelectorIndex;
    state.message = `${state.players[state.trumpSelectorIndex].name} is choosing Trump...`;
    state.messageSi = `${state.players[state.trumpSelectorIndex].name} තුරුම්පු තෝරමින් සිටී...`;

    broadcastState(state);

    // If trump selector is an AI Bot, let AI pick after brief delay
    const selector = state.players[state.trumpSelectorIndex];
    if (!selector.isHuman) {
      setTimeout(() => {
        const latestState = hostStateRef.current;
        if (latestState?.phase !== 'SELECTING_TRUMP' || latestState.trumpSelectorIndex !== selector.id) return;
        const chosenTrump = botChooseTrumpSuit(latestState.players[selector.id].hand, latestState.botDifficulty);
        applyTrumpSelection(chosenTrump, selector.id);
      }, 900);
    }
  };

  // Trump suit selected -> Deal Phase 2 (remaining 4 cards each -> 8 total)
  const applyTrumpSelection = (suit: Suit, selectorId: number) => {
    if (!isHost || !hostStateRef.current) return;
    const state = { ...hostStateRef.current };
    // Accept a trump choice only from the active caller while the first four cards are dealt.
    if (state.phase !== 'SELECTING_TRUMP' || state.trumpSelectorIndex !== selectorId) return;
    if (!(['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).includes(suit)) return;
    state.trumpSuit = suit;
    sound.playTrumpSelect();

    // Deal remaining 4 cards
    const remaining = (state as any).remainingDeck as Card[];
    if (remaining && remaining.length === 16) {
      state.players[0].hand.push(...remaining.slice(0, 4));
      state.players[1].hand.push(...remaining.slice(4, 8));
      state.players[2].hand.push(...remaining.slice(8, 12));
      state.players[3].hand.push(...remaining.slice(12, 16));
    }

    state.phase = 'TRICK_PLAYING';
    // Trump selector leads the very first trick!
    state.activePlayerIndex = state.trumpSelectorIndex;
    state.currentTrick = null;
    state.message = `Trump is ${suit.toUpperCase()}! ${state.players[state.activePlayerIndex].name} leads the first trick.`;
    state.messageSi = `තුරුම්පු පාට ${translations.si[suit]}! ${state.players[state.activePlayerIndex].name} පළමු අත අදියි.`;

    broadcastState(state);

    // If first player is a Bot, play after brief delay
    checkNextTurn(state);
  };

  // Apply a card play by either Human or Bot
  const applyCardPlay = (playerId: number, cardId: string) => {
    if (!isHost || !hostStateRef.current) return;
    const state = { ...hostStateRef.current };
    if (state.phase !== 'TRICK_PLAYING' || state.activePlayerIndex !== playerId) {
      return;
    }

    const player = state.players[playerId];
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    const leadSuit = state.currentTrick ? state.currentTrick.leadSuit : null;

    // Validate legal move
    if (!isCardPlayable(card, player.hand, leadSuit)) {
      return;
    }

    // Remove card from hand
    player.hand.splice(cardIndex, 1);
    sound.playCardSnap();

    // Add to current trick
    if (!state.currentTrick) {
      state.currentTrick = {
        leadSuit: card.suit,
        cards: [{ card, playerId }],
      };
    } else {
      state.currentTrick.cards.push({ card, playerId });
    }

    // Check if trick is complete (4 cards played)
    if (state.currentTrick.cards.length === 4) {
      state.phase = 'TRICK_RESOLVING';
      broadcastState(state);
      resolveCompletedTrick(state);
    } else {
      // Next player's turn counter-clockwise
      state.activePlayerIndex = getNextPlayerIndex(state.activePlayerIndex);
      broadcastState(state);
      checkNextTurn(state);
    }
  };

  // If next player is an AI bot, schedule bot play
  const checkNextTurn = (state: GameState) => {
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer.isHuman && state.phase === 'TRICK_PLAYING') {
      setTimeout(() => {
        if (!hostStateRef.current || hostStateRef.current.phase !== 'TRICK_PLAYING') return;
        const current = hostStateRef.current;
        if (current.activePlayerIndex !== state.activePlayerIndex) return;
        const bot = current.players[current.activePlayerIndex];
        if (bot.isHuman || bot.hand.length === 0) return;
        const chosenCard = botChooseCardToPlay(
          bot.id,
          bot.hand,
          current.currentTrick,
          current.trumpSuit!,
          current.botDifficulty,
          current.tricksHistory
        );
        applyCardPlay(bot.id, chosenCard.id);
      }, 700 + Math.random() * 400);
    }
  };

  // Resolve completed 4-card trick
  const resolveCompletedTrick = (state: GameState) => {
    if (!state.currentTrick || !state.trumpSuit) return;
    const winningPlay = determineTrickWinner(state.currentTrick, state.trumpSuit);
    const winnerId = winningPlay.playerId;
    const winnerPlayer = state.players[winnerId];

    state.currentTrick.winnerPlayerId = winnerId;
    winnerPlayer.tricksWon++;

    if (winnerPlayer.team === 1) {
      state.score.team1RoundTricks++;
    } else {
      state.score.team2RoundTricks++;
    }

    state.lastCompletedTrick = { ...state.currentTrick };
    state.tricksHistory.push({ ...state.currentTrick });

    // Winner of the trick leads the next trick!
    state.activePlayerIndex = winnerId;
    state.message = `${winnerPlayer.name} won this trick!`;
    state.messageSi = `${winnerPlayer.name} අත දිනුවා!`;

    // Crucial: the earlier TRICK_RESOLVING broadcast happened before the
    // winner was known. Publish the completed trick and winner so BOTH
    // browsers can show all four cards and the capture animation.
    broadcastState(state);
    const finishedTrick = state.currentTrick;

    setTimeout(() => {
      const current = hostStateRef.current;
      if (!current || current.phase !== 'TRICK_RESOLVING' ||
          current.currentTrick !== finishedTrick) return;
      sound.playTrickCollect();
      const nextState = { ...current, currentTrick: null };

      const totalTricks = nextState.score.team1RoundTricks + nextState.score.team2RoundTricks;
      if (totalTricks === 8) {
        resolveCompletedRound(nextState);
      } else {
        nextState.phase = 'TRICK_PLAYING';
        broadcastState(nextState);
        checkNextTurn(nextState);
      }
    }, 1800);
  };

  // Resolve completed 8-trick OMI round
  const resolveCompletedRound = (state: GameState) => {
    state.phase = 'ROUND_RESOLVING';
    const result = calculateRoundScoring(
      state.score.team1RoundTricks,
      state.score.team2RoundTricks,
      state.trumpSelectorIndex,
      state.score
    );

    state.score.team1Tokens = result.newTeam1Tokens;
    state.score.team2Tokens = result.newTeam2Tokens;
    state.score.carriedTokens = result.newCarriedTokens;

    if (result.isKapothi) {
      sound.playKapothi();
      setKapothiNotice(result.messageEn);
      setTimeout(() => setKapothiNotice(null), 4000);
    } else if (result.winnerTeam === 0) {
      setBadaNotice(result.messageEn);
      setTimeout(() => setBadaNotice(null), 3500);
    } else {
      sound.playTokenClink();
    }

    state.message = result.messageEn;
    state.messageSi = result.messageSi;

    // Check Match Victory (first to 10 tokens)
    const matchWinner = checkMatchWinner(state.score.team1Tokens, state.score.team2Tokens, 10);
    if (matchWinner) {
      state.winningTeam = matchWinner;
      state.phase = 'MATCH_OVER';
      sound.playKapothi();
      broadcastState(state);
      return;
    }

    broadcastState(state);

    // Prepare next round after brief intermission. Cancel stale timers if a
    // rematch has started meanwhile.
    setTimeout(() => {
      const current = hostStateRef.current;
      if (current?.phase === 'ROUND_RESOLVING' && current.roundNumber === state.roundNumber) {
        startNextRound(current);
      }
    }, 3800);
  };

  // Next Round / Hand setup
  const startNextRound = (state: GameState) => {
    state.roundNumber++;
    // Dealer rotates counter-clockwise
    state.dealerIndex = getNextPlayerIndex(state.dealerIndex);
    // Trump selector is player to dealer's right
    state.trumpSelectorIndex = getNextPlayerIndex(state.dealerIndex);
    state.trumpSuit = null;
    state.currentTrick = null;
    state.score.team1RoundTricks = 0;
    state.score.team2RoundTricks = 0;

    for (const p of state.players) {
      p.hand = [];
      p.tricksWon = 0;
    }

    beginShuffle(state);
  };

  // Start new rematch
  const startNewMatch = () => {
    if (!isHost) {
      if (webrtcRef.current) {
        webrtcRef.current.sendMessage({ type: 'REQUEST_REMATCH', playerId: mySeatIndex });
      }
      return;
    }
    handleStartGame();
  };

  // Human player clicked a card to play
  const handlePlayCard = (cardId: string) => {
    if (isHost) {
      applyCardPlay(mySeatIndex, cardId);
    } else {
      if (webrtcRef.current) {
        webrtcRef.current.sendMessage({
          type: 'PLAY_CARD',
          cardId,
          playerId: mySeatIndex,
        });
      }
    }
  };

  // Human dealer chooses to riffle (possibly several times), then deal.
  const handleShuffleAction = (action: 'shuffle' | 'deal') => {
    if (!renderState || renderState.phase !== 'SHUFFLING' ||
        renderState.dealerIndex !== mySeatIndex) return;
    if (isHost) {
      applyShuffleAction(mySeatIndex, action);
    } else {
      webrtcRef.current?.sendMessage({
        type: 'SHUFFLE_CARDS',
        playerId: mySeatIndex,
        roundNumber: renderState.roundNumber,
        action,
      });
    }
  };

  // Human player selected trump
  const handleSelectTrump = (suit: Suit) => {
    if (isHost) {
      applyTrumpSelection(suit, mySeatIndex);
    } else {
      if (webrtcRef.current) {
        webrtcRef.current.sendMessage({
          type: 'SELECT_TRUMP',
          suit,
          playerId: mySeatIndex,
        });
      }
    }
  };

  // Open manual SDP modal
  const handleOpenManualSDP = async () => {
    if (webrtcRef.current) {
      const sdp = await webrtcRef.current.exportManualSDP();
      setManualLocalSDP(sdp);
    }
    setShowManualSDP(true);
  };

  const handleApplyRemoteSDP = async (sdp: string) => {
    if (webrtcRef.current) {
      await webrtcRef.current.importManualSDP(sdp);
    }
  };

  // Player Names helper map for last trick modal
  const playerNamesMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (renderState) {
      for (const p of renderState.players) {
        map[p.id] = p.name;
      }
    }
    return map;
  }, [renderState]);

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white flex flex-col font-sans select-none">
      {/* TOP STATUS BAR & HEADER */}
      <header className="w-full bg-zinc-950/90 border-b border-amber-500/30 px-3 sm:px-6 py-2.5 flex items-center justify-between z-30 shadow-md">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center font-serif font-black text-zinc-950 text-base shadow">
            S
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm sm:text-base font-serif tracking-wider text-amber-300 leading-tight">
              SHANEX OMI
            </span>
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest hidden sm:inline">
              Sri Lankan OMI Card Game
            </span>
          </div>
        </div>

        {/* Live Network & Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${
              peerStatus === 'connected_p2p'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : peerStatus === 'connected_relay'
                ? 'bg-blue-950/80 text-blue-300 border-blue-500/50'
                : peerStatus === 'connecting' || peerStatus === 'waiting_for_peer'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>
              {peerStatus === 'connected_p2p'
                ? `${t.connectedP2P} (${latency > 0 ? `${latency}ms` : '<10ms'})`
                : peerStatus === 'connected_relay'
                ? t.connectedRelay
                : peerStatus === 'waiting_for_peer'
                ? t.waitingForPlayer2
                : peerStatusMsg}
            </span>
          </div>

          {roomCode && (
            <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-400 bg-zinc-900 border border-amber-500/30 px-2 py-1 rounded-lg">
              {roomCode}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Last Trick review */}
          {renderState && renderState.phase !== 'LOBBY' && (
            <button
              type="button"
              onClick={() => setShowLastTrick(true)}
              title={t.lastTrick}
              className="p-1.5 sm:p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {/* How to play modal */}
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            title={t.howToPlay}
            className="p-1.5 sm:p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Sound toggle */}
          <button
            type="button"
            onClick={() => {
              const next = sound.toggle();
              setSoundEnabled(next);
            }}
            title={soundEnabled ? t.soundOn : t.soundOff}
            className="p-1.5 sm:p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>

          {/* Bilingual Language toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
            title="Switch Language (සිංහල / English)"
            className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs cursor-pointer flex items-center gap-1 shadow"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="font-bold tracking-tight">{lang === 'en' ? 'සිංහල' : 'English'}</span>
          </button>
        </div>
      </header>

      {/* KAPOTHI NOTIFICATION BANNER */}
      {kapothiNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-linear-to-r from-amber-500 via-yellow-400 to-amber-500 text-zinc-950 font-black text-base sm:text-xl px-6 py-2.5 rounded-full shadow-2xl border-2 border-white flex items-center gap-2 animate-bounce">
          <Sparkles className="w-6 h-6 fill-current" />
          {t.kapothiBanner}
        </div>
      )}

      {/* 4-4 BADA DRAW NOTIFICATION BANNER */}
      {badaNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-blue-900 text-amber-200 font-bold text-sm sm:text-base px-6 py-2 rounded-full shadow-xl border border-amber-400 animate-in fade-in">
          {t.badaBanner}
        </div>
      )}

      {/* ERROR TOAST BANNER */}
      {toastError && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-rose-950 border-2 border-rose-400 text-rose-100 font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-2xl animate-in fade-in">
          {toastError}
        </div>
      )}

      {/* MAIN VIEW AREA: Lobby OR Table Playfield */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 max-w-7xl mx-auto w-full">
        {!renderState || renderState.phase === 'LOBBY' ? (
          <Lobby
            isHost={isHost}
            roomCode={roomCode}
            playerName={playerName}
            setPlayerName={setPlayerName}
            teamMode={teamMode}
            setTeamMode={setTeamMode}
            botDifficulty={botDifficulty}
            setBotDifficulty={setBotDifficulty}
            peerStatus={peerStatusMsg}
            hasPeerJoined={hasPeerJoined}
            peerName={peerName}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartGame={handleStartGame}
            onSoloTestStart={startSoloPractice}
            onOpenManualSDP={handleOpenManualSDP}
            lang={lang}
          />
        ) : (
          <div className="w-full flex-1 flex flex-col gap-2">
            {/* Top Scoreboard */}
            <ScoreBoard
              score={renderState.score}
              trumpSuit={renderState.trumpSuit}
              roundNumber={renderState.roundNumber}
              lang={lang}
            />

            {/* Authentic OMI Table */}
            <OmiTable
              gameState={renderState}
              mySeatIndex={mySeatIndex}
              onPlayCard={handlePlayCard}
              onSelectTrump={handleSelectTrump}
              onShuffleAction={handleShuffleAction}
              reactions={reactions}
              lang={lang}
            />

            {/* Bottom floating reaction & game utility bar */}
            <div className="flex items-center justify-between px-2 pt-1 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-300">
                  {lang === 'si' ? renderState.messageSi : renderState.message}
                </span>
              </div>

              {/* Emoji reaction picker button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 text-amber-300 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow"
                >
                  <Smile className="w-4 h-4" />
                  <span>{t.reactionTitle}</span>
                </button>

                {showEmojiPicker && (
                  <div className="absolute right-0 bottom-10 z-50 bg-zinc-950 border border-amber-400/50 rounded-2xl p-2 flex gap-1 shadow-2xl animate-in zoom-in-95">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleSendEmoji(emoji)}
                        className="text-xl p-1.5 hover:scale-125 transition-transform cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MATCH VICTORY MODAL */}
      {renderState && renderState.phase === 'MATCH_OVER' && renderState.winningTeam && (
        <VictoryModal
          winnerTeam={renderState.winningTeam}
          team1Tokens={renderState.score.team1Tokens}
          team2Tokens={renderState.score.team2Tokens}
          onRematch={startNewMatch}
          lang={lang}
        />
      )}

      {/* LAST TRICK MODAL */}
      <LastTrickModal
        isOpen={showLastTrick}
        onClose={() => setShowLastTrick(false)}
        trick={renderState?.lastCompletedTrick || null}
        playerNames={playerNamesMap}
        lang={lang}
      />

      {/* HOW TO PLAY MODAL */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        lang={lang}
      />

      {/* MANUAL SDP PAIRING MODAL */}
      <ManualSDPModal
        isOpen={showManualSDP}
        onClose={() => setShowManualSDP(false)}
        localSDP={manualLocalSDP}
        onApplyRemoteSDP={handleApplyRemoteSDP}
        lang={lang}
      />
    </div>
  );
}
