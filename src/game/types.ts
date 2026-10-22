export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string; // e.g. "spades_A"
  suit: Suit;
  rank: Rank;
  value: number; // 1 (for 7) up to 8 (for A)
}

export type TeamMode = 'same_team' | 'opposite_teams';
export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type Language = 'en' | 'si';
export type Theme = 'dark' | 'light';

export interface PlayedCard {
  card: Card;
  playerId: number; // 0..3
}

export interface Trick {
  leadSuit: Suit;
  cards: PlayedCard[];
  winnerPlayerId?: number;
}

export type GamePhase =
  | 'LOBBY'
  | 'DEALING_1'
  | 'SELECTING_TRUMP'
  | 'DEALING_2'
  | 'TRICK_PLAYING'
  | 'TRICK_RESOLVING'
  | 'ROUND_RESOLVING'
  | 'MATCH_OVER';

export interface PlayerInfo {
  id: number; // 0, 1, 2, 3
  name: string;
  isHuman: boolean;
  peerId?: string; // remote WebRTC peer id or 'host' or 'guest'
  team: 1 | 2;
  hand: Card[];
  tricksWon: number;
}

export interface ScoreState {
  team1Tokens: number;
  team2Tokens: number;
  carriedTokens: number;
  team1RoundTricks: number;
  team2RoundTricks: number;
  targetTokens: number;
}

export interface RoundSummary {
  handNumber: number;
  trumpSuit: Suit;
  trumpSelector: number;
  team1Tricks: number;
  team2Tricks: number;
  winnerTeam: 1 | 2 | 0; // 0 for draw
  tokensAwarded: number;
  isKapothi: boolean;
}

export interface GameState {
  roomCode: string;
  teamMode: TeamMode;
  botDifficulty: BotDifficulty;
  phase: GamePhase;
  dealerIndex: number; // 0..3
  trumpSelectorIndex: number; // 0..3
  trumpSuit: Suit | null;
  activePlayerIndex: number; // 0..3
  currentTrick: Trick | null;
  lastCompletedTrick: Trick | null;
  tricksHistory: Trick[];
  score: ScoreState;
  players: PlayerInfo[];
  roundNumber: number;
  roundSummaries: RoundSummary[];
  winningTeam: 1 | 2 | null;
  message: string;
  messageSi: string;
}

export interface SanitizedGameState extends Omit<GameState, 'players'> {
  mySeatIndex: number;
  players: {
    id: number;
    name: string;
    isHuman: boolean;
    team: 1 | 2;
    cardCount: number;
    hand: Card[]; // Only contains cards for mySeatIndex (others are empty or face-down count)
    tricksWon: number;
  }[];
}

export type WebRTCMessage =
  | { type: 'JOIN_REQUEST'; name: string; peerId: string }
  | { type: 'JOIN_ACCEPTED'; seatIndex: number; teamMode: TeamMode; botDifficulty: BotDifficulty }
  | { type: 'STATE_UPDATE'; state: SanitizedGameState; seq: number }
  | { type: 'SELECT_TRUMP'; suit: Suit; playerId: number }
  | { type: 'PLAY_CARD'; cardId: string; playerId: number }
  | { type: 'EMOJI_REACTION'; emoji: string; fromSeat: number }
  | { type: 'REQUEST_REMATCH'; playerId: number }
  | { type: 'ACCEPT_REMATCH'; playerId: number }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };
